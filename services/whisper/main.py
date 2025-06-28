"""
Whisper Service Main Application
Modular FastAPI application for real-time audio transcription using Whisper.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import io
import uuid
from src.transcription.engine import TranscriptionEngine
from src.audio.processor import AudioProcessor
from src.config.settings import get_logger, SERVER_HOST, SERVER_PORT, DEBUG_MODE

# Initialize logger and transcription engine
logger = get_logger(__name__)
transcription_engine = TranscriptionEngine()

# --- FastAPI Application Setup ---
app = FastAPI(title="Whisper Transcription Service", version="1.0.0")

# Add CORS middleware to allow WebSocket connections from backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HTTP Routes ---
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "whisper-transcription"}

# --- HTTP Routes ---
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    # Returns a JSON response indicating the service status
    return {"status": "healthy", "service": "whisper-transcription"}

@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time transcription WebSocket endpoint."""
    # Generate a unique session ID for each WebSocket connection
    session_id = str(uuid.uuid4())
    # Initialize session data with default values
    session_data = {
        "session_id": session_id,
        "websocket": websocket,
        "meeting_id": "N/A",
        "speaker": "N/A",
        "audio_buffer": io.BytesIO(),  # Buffer to store incoming audio data
        "transcript_queue": asyncio.Queue(),  # Queue for storing transcription results
        "shutdown_event": asyncio.Event(),  # Event to signal shutdown
        "transcription_finished_event": asyncio.Event()  # Event to signal transcription completion
    }

    try:
        # Log the connection attempt
        logger.info(f"[{session_id}] WebSocket connection attempt from {websocket.client}")
        await websocket.accept()  # Accept the WebSocket connection
        # Log the successful connection
        logger.info(f"[{session_id}] WebSocket connection accepted")

        # Send a confirmation message to the client
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "Connected to Whisper service"
        }))

        # Initialize the audio processor for handling audio data
        processor = AudioProcessor(session_data)

        # Main message loop to handle incoming WebSocket messages
        while True:
            try:
                # Code for processing incoming messages will be here
                pass
            except WebSocketDisconnect:
                # Handle WebSocket disconnection
                logger.info(f"[{session_id}] WebSocket disconnected")
                break
            except Exception as e:
                # Log any unexpected exceptions
                logger.error(f"[{session_id}] Error: {e}")
                break

@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time transcription WebSocket endpoint."""
    session_id = str(uuid.uuid4())
    session_data = {
        "session_id": session_id,
        "websocket": websocket,
        "meeting_id": "N/A",
        "speaker": "N/A",
        "audio_buffer": io.BytesIO(),
        "transcript_queue": asyncio.Queue(),
        "shutdown_event": asyncio.Event(),
        "transcription_finished_event": asyncio.Event()
    }  # End of session data initialization

    try:
        logger.info(f"[{session_id}] WebSocket connection attempt from {websocket.client}")
        await websocket.accept()
        logger.info(f"[{session_id}] WebSocket connection accepted")

        # Send confirmation message
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "Connected to Whisper service"
        }))

       

        # Main message loop
        while True:
            try:
                message = await websocket.receive()
                logger.debug(f"[{session_id}] Received message type: {message.get('type')}")

                if message["type"] == "websocket.receive":
                    if "text" in message:
                        # Handle JSON messages
                        data = json.loads(message["text"])
                        logger.info(f"[{session_id}] Received JSON: {data}")

                        if data.get("type") == "start":
                            session_data["meeting_id"] = data.get("meetingId", "unknown")
                            session_data["speaker"] = data.get("speaker", "unknown")

                            await websocket.send_text(json.dumps({
                                "type": "status",
                                "message": f"Session started for {session_data['speaker']}"
                            }))
                            logger.info(f"[{session_id}] Session started for meeting: {session_data['meeting_id']}, speaker: {session_data['speaker']}")

                        elif data.get("type") == "end":
                            logger.info(f"[{session_id}] Session end requested")
                            break

                    elif "bytes" in message:
                        # Handle binary audio data
                        audio_data = message["bytes"]
                        logger.debug(f"[{session_id}] Received audio chunk: {len(audio_data)} bytes")

                        # Write audio data to buffer
                        session_data["audio_buffer"].write(audio_data)

                        # Process audio if buffer has enough data
                        if processor.should_process_buffer():
                            try:
                                # Read audio from buffer
                                audio_bytes = processor.read_and_clear_buffer()
                                if audio_bytes:
                                    # Convert to numpy array for Whisper
                                    audio_np = processor.convert_audio_bytes_to_numpy(audio_bytes)

                                    # Transcribe audio
                                    transcribed_text, info = transcription_engine.transcribe_audio(audio_np)

                                    if transcribed_text and transcribed_text.strip():
                                        # Create transcription result
                                        result = transcription_engine.create_transcription_result(
                                            session_data, transcribed_text, info
                                        )

                                        # Send transcription result
                                        await websocket.send_text(json.dumps(result))
                                        logger.info(f"[{session_id}] Sent transcription: {transcribed_text}")

                            except Exception as e:
                                logger.error(f"[{session_id}] Transcription error: {e}")
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "message": f"Transcription failed: {str(e)}"
                                }))

                elif message["type"] == "websocket.disconnect":
                    logger.info(f"[{session_id}] Client disconnected")
                    break

            except WebSocketDisconnect:
                logger.info(f"[{session_id}] WebSocket disconnected")
                break
            except Exception as e:
                logger.error(f"[{session_id}] Error in message loop: {e}")
                break

    except Exception as e:
        logger.error(f"[{session_id}] WebSocket error: {e}")
    finally:
        # Cleanup
        session_data["shutdown_event"].set()
        logger.info(f"[{session_id}] WebSocket connection closed")


# --- Application Startup ---
if __name__ == "__main__":
    import uvicorn
    print("Starting Whisper Transcription Service...")
    log_level = "debug" if DEBUG_MODE else "info"
    uvicorn.run(
        app,
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level=log_level
    )
