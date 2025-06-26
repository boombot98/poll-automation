"""
Configuration module for Whisper service.
Handles environment variables, model configuration, and audio processing constants.
"""

import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Model Configuration ---
def get_device_and_compute_type():
    """
    Determine the best device and compute type for Whisper model.
    Returns tuple of (device, compute_type)
    """
    try:
        import torch
        # Prioritize CUDA if available, otherwise use CPU
        device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda":
            # For GPUs, float16 offers the best performance with minimal accuracy loss
            compute_type = "float16"
            logger.info(f"[Whisper Service] PyTorch CUDA is available. Using device='cuda' with compute_type='float16'.")
        else:
            # For CPUs, int8 quantization is crucial for performance
            compute_type = "int8"
            logger.info(f"[Whisper Service] PyTorch CUDA not available. Using device='cpu' with compute_type='int8'.")
    except ImportError:
        # Fallback if torch is not installed at all
        device = "cpu"
        compute_type = "int8"
        logger.warning("[WARNING] PyTorch not installed. Defaulting to device='cpu' with compute_type='int8'. "
                        "Install PyTorch for potential CUDA acceleration.")
    except Exception as e:
        # Catch any other import/initialization errors for torch
        device = "cpu"
        compute_type = "int8"
        logger.error(f"[ERROR] Failed to initialize PyTorch/CUDA: {e}. Defaulting to device='cpu' with compute_type='int8'.")
    
    return device, compute_type

# Model configuration
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "medium")  # Default to medium
DEVICE, COMPUTE_TYPE = get_device_and_compute_type()

# --- Audio Processing Constants ---
SAMPLE_RATE = 16000  # Standard for Whisper models
BYTES_PER_SAMPLE = 2  # 16-bit audio (e.g., from browser's Int16Array)

# BUFFER_DURATION_SECONDS: Crucial for real-time responsiveness vs. context
# For live teaching, 1.5-2.5 seconds is ideal for low latency. Let's start with 2.0.
# Made configurable via environment variable for easy tuning in different deployments.
BUFFER_DURATION_SECONDS = float(os.getenv("BUFFER_DURATION_SECONDS", 2.0))
BUFFER_SIZE_BYTES = int(BUFFER_DURATION_SECONDS * SAMPLE_RATE * BYTES_PER_SAMPLE)

# --- Transcription Configuration ---
TRANSCRIPTION_CONFIG = {
    "beam_size": 5,  # Good balance for accuracy
    "word_timestamps": True,  # Useful for more detailed future features
    "language": "en",  # Auto-detect language
    "condition_on_previous_text": False,  # Important for real-time chunking to avoid repetition
}

# --- Logging Configuration ---
def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name."""
    return logging.getLogger(name)
