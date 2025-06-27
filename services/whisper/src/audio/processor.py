"""
Audio processing module for Whisper service.
Handles audio buffer management and preprocessing.
"""

import io
import numpy as np
import asyncio
import time
from typing import Dict, Any
from ..config.settings import SAMPLE_RATE, BUFFER_SIZE_BYTES, BUFFER_DURATION_SECONDS, get_logger

logger = get_logger(__name__)

class AudioProcessor:
    """Handles audio buffer management and processing for transcription sessions."""
    
    def __init__(self, session_data: Dict[str, Any]):
        self.session_data = session_data
        self.session_id = session_data["session_id"]
        self.audio_buffer: io.BytesIO = session_data["audio_buffer"]
        self.transcript_queue: asyncio.Queue = session_data["transcript_queue"]
        self.shutdown_event: asyncio.Event = session_data["shutdown_event"]
        self.transcription_finished_event: asyncio.Event = session_data["transcription_finished_event"]
        self.last_text_sent = ""  # To help reduce redundant transmissions
        self.last_processing_time = time.time()  # Initialize the last processing time
        self.last_audio_received_time = time.time()  # Track when we last received audio
        self.silence_duration = 0  # Track duration of silence
        self.needs_reset = False  # Flag to indicate if buffer needs reset

    def add_audio_data(self, audio_data: bytes):
        """
        Add audio data to the buffer.
        
        Args:
            audio_data: Audio bytes to add to buffer
        """
        # Check if we need to reset first
        if self.needs_reset:
            self.reset_buffer()
            self.needs_reset = False
        
        # Update last audio received time
        current_time = time.time()
        
        # Check if this is new audio after a long silence
        time_since_last_audio = current_time - self.last_audio_received_time
        if time_since_last_audio > 5.0:
            logger.info(f"[{self.session_id}] New audio after {time_since_last_audio:.1f}s silence. Resetting buffer.")
            self.reset_buffer()
        
        self.last_audio_received_time = current_time
        
        # Add to buffer
        self.audio_buffer.write(audio_data)
        
        # Log buffer size periodically
        current_buffer_length = self.audio_buffer.tell()
        if current_buffer_length % 8000 == 0:  # Log every ~0.5s of audio
            logger.debug(f"[{self.session_id}] Buffer size: {current_buffer_length} bytes")

    def reset_buffer(self):
        """Reset the audio buffer completely."""
        self.audio_buffer.seek(0)
        self.audio_buffer.truncate(0)
        logger.debug(f"[{self.session_id}] Audio buffer reset")
        self.last_processing_time = time.time()

    def convert_audio_bytes_to_numpy(self, audio_bytes: bytes) -> np.ndarray:
        """
        Convert raw audio bytes to numpy array suitable for Whisper.
        
        Args:
            audio_bytes: Raw audio bytes from client
            
        Returns:
            numpy array of float32 audio data normalized to [-1, 1]
        """
        return np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    
    def should_process_buffer(self) -> bool:
        """
        Determine if the audio buffer should be processed.
        
        Returns:
            True if buffer should be processed, False otherwise
        """
        current_buffer_length = self.audio_buffer.tell()
        current_time = time.time()
        
        # Calculate silence duration
        time_since_last_audio = current_time - self.last_audio_received_time
        
        # If we're in a long silence (>10s), mark for reset on next audio
        if time_since_last_audio > 10.0:
            self.needs_reset = True
        
        # Force processing in these cases:
        # 1. If buffer has some data and it's been 3+ seconds since last processing
        # 2. If we're in a silence period >5s and have any data
        force_processing = False
        if current_buffer_length > 0:
            time_since_last_processing = current_time - self.last_processing_time
            if time_since_last_processing > 3.0:
                force_processing = True
                logger.debug(f"[{self.session_id}] Forcing buffer processing after {time_since_last_processing:.1f}s")
            elif time_since_last_audio > 5.0 and not self.needs_reset:
                force_processing = True
                logger.debug(f"[{self.session_id}] Processing buffer before reset due to {time_since_last_audio:.1f}s silence")
        
        # Update last processing time if we're going to process
        if current_buffer_length >= BUFFER_SIZE_BYTES or force_processing or self.shutdown_event.is_set():
            self.last_processing_time = current_time
        
        # Trigger transcription if buffer is full enough OR if shutdown is signaled AND there's audio
        # OR if we need to force processing due to silence
        return (current_buffer_length >= BUFFER_SIZE_BYTES or 
                (self.shutdown_event.is_set() and current_buffer_length > 0) or
                force_processing)
    
    def read_and_clear_buffer(self) -> bytes:
        """
        Read all audio data from buffer and clear it.
        
        Returns:
            Audio bytes from buffer
        """
        current_buffer_length = self.audio_buffer.tell()
        
        if current_buffer_length == 0:
            return b""
        
        # Read accumulated audio bytes
        self.audio_buffer.seek(0)
        audio_bytes = self.audio_buffer.read(current_buffer_length)
        self.audio_buffer.seek(0)  # Reset buffer pointer
        self.audio_buffer.truncate(0)  # Clear the buffer completely
        
        return audio_bytes
    
    def is_buffer_empty(self) -> bool:
        """Check if the audio buffer is empty."""
        return self.audio_buffer.tell() == 0
    
    def get_audio_duration(self, audio_np: np.ndarray) -> float:
        """
        Calculate the duration of audio data in seconds.
        
        Args:
            audio_np: Audio data as numpy array
            
        Returns:
            Duration in seconds
        """
        return audio_np.shape[0] / SAMPLE_RATE
    
    def log_audio_info(self, audio_np: np.ndarray):
        """Log information about the audio being processed."""
        duration = self.get_audio_duration(audio_np)
        logger.info(f"[{self.session_id}] Transcribing {duration:.2f} seconds of audio.")
    
    def should_send_transcription(self, transcribed_text: str) -> bool:
        """
        Determine if transcription should be sent to avoid duplicates.
        
        Args:
            transcribed_text: The transcribed text
            
        Returns:
            True if transcription should be sent, False otherwise
        """
        return transcribed_text and transcribed_text != self.last_text_sent
    
    def update_last_sent_text(self, text: str):
        """Update the last sent text to avoid duplicates."""
        self.last_text_sent = text


