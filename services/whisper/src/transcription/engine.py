"""
Transcription engine module for Whisper service.
Handles model loading and transcription processing.
"""

import asyncio
import time
from typing import Dict, Any, Optional
from faster_whisper import WhisperModel
from ..config.settings import (
    WHISPER_MODEL_SIZE, DEVICE, COMPUTE_TYPE, TRANSCRIPTION_CONFIG, get_logger
)
from ..audio.processor import AudioProcessor

logger = get_logger(__name__)

class TranscriptionEngine:
    """Handles Whisper model loading and transcription processing."""
    
    def __init__(self):
        self.model: Optional[WhisperModel] = None
        self._load_model()
        self.last_successful_transcription = time.time()
        self.WATCHDOG_TIMEOUT = 10  # seconds
        self.active_sessions = {}  # Track active sessions and their last activity

    def _load_model(self):
        """Load the Whisper model with configured settings."""
        try:
            self.model = WhisperModel(WHISPER_MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
            logger.info(f"[Whisper Service] Model '{WHISPER_MODEL_SIZE}' loaded on {DEVICE} with {COMPUTE_TYPE}.")
        except Exception as e:
            logger.critical(f"[Whisper Service] Failed to load Whisper model '{WHISPER_MODEL_SIZE}': {e}. "
                             "Ensure the model name is correct and necessary files are downloaded. Exiting.")
            raise
    
    def transcribe_audio(self, audio_np) -> tuple:
        """Transcribe audio using the Whisper model."""
        start_time = time.time()
        
        if not self.model:
            raise RuntimeError("Whisper model not loaded")
        
        try:
            segments_generator, info = self.model.transcribe(
                audio_np,
                beam_size=TRANSCRIPTION_CONFIG["beam_size"],
                word_timestamps=TRANSCRIPTION_CONFIG["word_timestamps"],
                language=TRANSCRIPTION_CONFIG["language"],
                condition_on_previous_text=TRANSCRIPTION_CONFIG["condition_on_previous_text"],
            )
            
            transcribed_text_parts = []
            # Consume the generator fully
            for segment in segments_generator:
                transcribed_text_parts.append(segment.text)
            
            transcribed_text = " ".join(transcribed_text_parts).strip()
            
            # Update successful transcription time
            self.last_successful_transcription = time.time()
            logger.info(f"Transcription took {time.time() - start_time:.2f} seconds")
            
            return transcribed_text, info
            
        except Exception as e:
            logger.error(f"Error in transcription: {e}")
            # If transcription fails, return empty result
            return "", None
    
    def create_transcription_result(self, session_data: Dict[str, Any], 
                                   transcribed_text: str, info) -> Dict[str, Any]:
        """
        Create a transcription result dictionary.
        
        Args:
            session_data: Session metadata
            transcribed_text: The transcribed text
            info: Transcription info from Whisper
            
        Returns:
            Transcription result dictionary
        """
        return {
            "type": "transcription",
            "meetingId": session_data["meeting_id"],
            "speaker": session_data["speaker"],
            "text": transcribed_text,
            "language": info.language if info and info.language else "unknown",
            "is_final": False  # Not necessarily final for continuous chunks
        }
    
    async def process_audio_stream(self, session_id: str, session_data: Dict[str, Any], processor: AudioProcessor):
        """Process audio stream for a session."""
        transcript_queue = session_data["transcript_queue"]
        
        # Store session data for watchdog
        if not hasattr(self, 'session_data'):
            self.session_data = {}
        self.session_data[session_id] = session_data
        
        # Track session activity
        self.active_sessions[session_id] = time.time()
        
        # Start watchdog task
        watchdog_task = asyncio.create_task(self.check_watchdog(session_id))
        
        # Add a processing queue with max size to prevent memory issues
        processing_queue = asyncio.Queue(maxsize=settings.MAX_QUEUE_SIZE)
        
        # Start a background task for actual transcription
        transcription_task = asyncio.create_task(
            self._transcribe_from_queue(session_id, processing_queue, transcript_queue)
        )
        
        # Periodic reset task to ensure fresh state
        reset_task = asyncio.create_task(
            self._periodic_reset(session_id, processor)
        )
        
        try:
            while True:
                # Sleep briefly to yield control
                await asyncio.sleep(0.05)
                
                # Check if processor should process buffer
                if processor.should_process_buffer():
                    # Read and clear the buffer
                    audio_bytes = processor.read_and_clear_buffer()
                    if not audio_bytes:
                        continue
                    
                    # Update session activity timestamp
                    self.active_sessions[session_id] = time.time()
                    
                    # Convert to numpy array
                    try:
                        audio_np = processor.bytes_to_numpy(audio_bytes)
                        
                        # Check if queue is full
                        if processing_queue.full():
                            logger.warning(f"[{session_id}] Processing queue full, dropping oldest chunk")
                            # Remove oldest item to make room (backpressure)
                            try:
                                processing_queue.get_nowait()
                                processing_queue.task_done()
                            except asyncio.QueueEmpty:
                                pass
                        
                        # Add to processing queue
                        await processing_queue.put({
                            "audio_np": audio_np,
                            "timestamp": time.time()
                        })
                        
                    except Exception as e:
                        logger.error(f"[{session_id}] Error processing audio: {e}")
                    
                # Check if session is closed
                if processor.is_shutdown():
                    logger.info(f"[{session_id}] Processor shutdown detected")
                    break
                    
        except Exception as e:
            logger.error(f"[{session_id}] Error in process_audio_stream: {e}")
        finally:
            # Signal transcription task to finish
            await processing_queue.put(None)
            
            # Wait for transcription task to complete
            try:
                await asyncio.wait_for(transcription_task, timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning(f"[{session_id}] Transcription task did not complete in time")
                
            # Cancel other tasks
            watchdog_task.cancel()
            reset_task.cancel()
            
            # Clean up session data
            if hasattr(self, 'session_data') and session_id in self.session_data:
                del self.session_data[session_id]
            
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]

    async def check_watchdog(self, session_id: str):
        """Check if transcription is stuck and restart if needed."""
        while True:
            await asyncio.sleep(5)  # Check every 5 seconds
            
            # Check model health
            time_since_last = time.time() - self.last_successful_transcription
            if time_since_last > self.WATCHDOG_TIMEOUT:
                logger.warning(f"[{session_id}] Transcription appears stuck for {time_since_last:.1f}s. Restarting model.")
                # Reload model as a last resort
                try:
                    self.model = None
                    self._load_model()
                    self.last_successful_transcription = time.time()
                except Exception as e:
                    logger.error(f"Failed to reload model: {e}")
            
            # Check session activity
            if session_id in self.active_sessions:
                time_since_activity = time.time() - self.active_sessions[session_id]
                # If no activity for 30 seconds, send a ping transcription to keep the connection alive
                if time_since_activity > 30:
                    logger.info(f"[{session_id}] No activity for {time_since_activity:.1f}s, sending keepalive")
                    try:
                        # Get the transcript queue for this session
                        if hasattr(self, 'session_data') and self.session_data.get(session_id):
                            transcript_queue = self.session_data[session_id].get("transcript_queue")
                            if transcript_queue:
                                # Put a keepalive message in the queue
                                await transcript_queue.put({
                                    "type": "keepalive",
                                    "timestamp": time.time()
                                })
                                # Update activity time
                                self.active_sessions[session_id] = time.time()
                    except Exception as e:
                        logger.error(f"[{session_id}] Error sending keepalive: {e}")

    async def _periodic_reset(self, session_id: str, processor: AudioProcessor):
        """Periodically reset the transcription state to ensure fresh processing."""
        while True:
            await asyncio.sleep(30)  # Check every 30 seconds
            
            # Get time since last activity
            if session_id in self.active_sessions:
                time_since_activity = time.time() - self.active_sessions[session_id]
                
                # If it's been more than 15 seconds since activity, do a soft reset
                if time_since_activity > 15:
                    logger.info(f"[{session_id}] Performing periodic reset after {time_since_activity:.1f}s inactivity")
                    
                    # Reset the processor buffer
                    processor.reset_buffer()
                    
                    # Send a status message to client
                    try:
                        if hasattr(self, 'session_data') and self.session_data.get(session_id):
                            transcript_queue = self.session_data[session_id].get("transcript_queue")
                            if transcript_queue:
                                await transcript_queue.put({
                                    "type": "status",
                                    "message": "Connection refreshed due to inactivity",
                                    "timestamp": time.time()
                                })
                    except Exception as e:
                        logger.error(f"[{session_id}] Error sending reset status: {e}")

# Global transcription engine instance
transcription_engine = TranscriptionEngine()






