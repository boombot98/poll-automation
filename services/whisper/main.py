"""
Whisper Service Main Application
Modular FastAPI application for real-time audio transcription using Whisper.
"""

from fastapi import FastAPI
from src.websocket.endpoint import websocket_endpoint
from src.config.settings import get_logger

# Initialize logger
logger = get_logger(__name__)

# --- FastAPI Application Setup ---
app = FastAPI(title="Whisper Transcription Service", version="1.0.0")

# --- WebSocket Routes ---
@app.websocket("/")
async def websocket_route(websocket):
    """Main WebSocket endpoint for transcription."""
    await websocket_endpoint(websocket)


# --- Application Startup ---
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Whisper Transcription Service...")
    uvicorn.run(app, host="0.0.0.0", port=8000)