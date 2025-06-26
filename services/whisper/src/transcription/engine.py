"""
Transcription engine module for Whisper service.
Handles model loading and transcription processing.
"""

import asyncio
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
        """
        Transcribe audio using the Whisper model.
        
        Args:
            audio_np: Audio data as numpy array
            
        Returns:
            Tuple of (transcribed_text, language_info)
        """
        if not self.model:
            raise RuntimeError("Whisper model not loaded")
        
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
        return transcribed_text, info
    
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
    
    async def process_audio_stream(self, session_data: Dict[str, Any]):
        """
        Main audio processing loop for a transcription session.
        
        Args:
            session_data: Session metadata and state
        """
        session_id = session_data["session_id"]
        processor = AudioProcessor(session_data)
        
        logger.info(f"[{session_id}] Processing task started.")
        
        try:
            while True:
                # Sleep briefly to yield control and prevent busy-waiting
                await asyncio.sleep(0.05)
                logger.debug(f"[{session_id}] Processing task: Checking buffer.")
                
                if not processor.should_process_buffer():
                    # Exit condition for the processing task: shutdown signaled AND buffer is empty
                    if session_data["shutdown_event"].is_set() and processor.is_buffer_empty():
                        logger.info(f"[{session_id}] Processing task: Shutdown signaled and buffer empty. Exiting.")
                        break
                    continue
                
                audio_bytes = processor.read_and_clear_buffer()
                if not audio_bytes:
                    logger.warning(f"[{session_id}] Processing task: Read 0 bytes despite positive buffer length. Skipping.")
                    continue
                
                audio_np = processor.convert_audio_bytes_to_numpy(audio_bytes)
                processor.log_audio_info(audio_np)
                
                try:
                    transcribed_text, info = self.transcribe_audio(audio_np)
                    
                    # Only send if new transcription is available and different from last
                    if processor.should_send_transcription(transcribed_text):
                        result = self.create_transcription_result(session_data, transcribed_text, info)
                        await session_data["transcript_queue"].put(result)
                        processor.update_last_sent_text(transcribed_text)
                        logger.debug(f"[{session_id}] Put transcription in queue: {transcribed_text[:70]}...")
                    else:
                        logger.debug(f"[{session_id}] No new speech or identical transcription in chunk.")
                
                except Exception as e:
                    logger.error(f"[{session_id}] Error during transcription: {e}", exc_info=True)
                    await session_data["transcript_queue"].put({
                        "type": "error", 
                        "message": str(e), 
                        "is_final": True
                    })
        
        except asyncio.CancelledError:
            logger.info(f"[{session_id}] Processing task cancelled.")
        except Exception as e:
            logger.error(f"[{session_id}] Unhandled error in processing task: {e}", exc_info=True)
            # Attempt to signal sender task about the error
            await session_data["transcript_queue"].put({
                "type": "error", 
                "message": "Internal processing error", 
                "is_final": True
            })
        finally:
            # Signal that this task has finished putting all its results into the queue
            session_data["transcription_finished_event"].set()
            logger.info(f"[{session_id}] Processing task finished. Transcription_finished_event set.")

# Global transcription engine instance
transcription_engine = TranscriptionEngine()
