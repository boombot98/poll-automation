# Whisper Service - Modular Architecture

This directory contains the modularized Whisper transcription service, broken down into focused, maintainable modules.

## Structure

```
services/whisper/src/
├── config/              # Configuration and settings
│   ├── settings.py      # Environment variables, model config, constants
│   └── __init__.py
├── audio/               # Audio processing functionality
│   ├── processor.py     # AudioProcessor class for buffer management
│   └── __init__.py
├── transcription/       # Transcription engine and logic
│   ├── engine.py        # TranscriptionEngine class with Whisper model
│   └── __init__.py
├── websocket/           # WebSocket handling
│   ├── handlers.py      # Session management and message handling
│   ├── endpoint.py      # Main WebSocket endpoint logic
│   └── __init__.py
├── __init__.py
└── README.md           # This file
```

## Modules

### config/settings.py
- Environment variable loading
- Device and compute type detection (CUDA/CPU)
- Model configuration constants
- Audio processing constants
- Transcription configuration
- Logging setup

### audio/processor.py
- `AudioProcessor` class for managing audio buffers
- Audio format conversion (bytes to numpy)
- Buffer management and processing logic
- Audio duration calculations
- Duplicate transcription prevention

### transcription/engine.py
- `TranscriptionEngine` class for Whisper model management
- Model loading with error handling
- Audio transcription processing
- Transcription result formatting
- Main audio processing loop

### websocket/handlers.py
- `WebSocketSessionManager` for session lifecycle
- `WebSocketMessageHandler` for message processing
- `WebSocketTranscriptionSender` for result streaming
- Session creation and cleanup

### websocket/endpoint.py
- Main WebSocket endpoint implementation
- Connection handling and message routing
- Session cleanup and resource management
- Error handling and graceful shutdown

## Key Improvements

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Maintainability**: Smaller, focused files are easier to understand and modify
3. **Testability**: Individual modules can be tested in isolation
4. **Reusability**: Components can be reused across different parts of the application
5. **Configuration Management**: Centralized configuration in settings.py
6. **Error Handling**: Improved error handling and logging throughout

## Usage

The main application (`main.py`) imports and uses these modules:

```python
from src.websocket.endpoint import websocket_endpoint
from src.config.settings import get_logger

# FastAPI app setup
app = FastAPI()

@app.websocket("/")
async def websocket_route(websocket):
    await websocket_endpoint(websocket)
```

## Migration from Original

The original 400-line `main.py` has been broken down as follows:
- Configuration logic → `config/settings.py`
- Audio processing → `audio/processor.py`
- Transcription logic → `transcription/engine.py`
- WebSocket handling → `websocket/handlers.py` and `websocket/endpoint.py`
- Main app → simplified `main.py`

All functionality remains the same, but the code is now more organized and maintainable.
