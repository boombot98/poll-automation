"""
Whisper Service Main Application
Modular FastAPI application for real-time audio transcription using Whisper.
"""

import asyncio
import time
import io
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from src.transcription.engine import TranscriptionEngine
from src.audio.processor import AudioProcessor
from src.config.settings import get_logger, SERVER_HOST, SERVER_PORT
from src.websocket.handlers import WebSocketConnectionManager, WebSocketMessageHandler, WebSocketTranscriptionSender

# Initialize logger and transcription engine
logger = get_logger(__name__)
transcription_engine = TranscriptionEngine()

# Initialize connection manager
connection_manager = WebSocketConnectionManager()

# --- FastAPI Application Setup ---
app = FastAPI(title="Whisper Transcription Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket Routes ---
@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time transcription WebSocket endpoint."""
    session_id = str(uuid.uuid4())
    session_data = None
    
    try:
        # Connect and initialize session
        session_data = await connection_manager.connect(websocket, session_id)
        
        # Explicitly set connection as active
        session_data["connection_active"] = True
        
        # Create processor instance and store in session data
        processor = AudioProcessor(session_data)
        session_data["processor"] = processor
        
        # Log connection details
        logger.info(f"[{session_id}] Connection established, starting processing tasks")
        
        # Start transcription engine processing
        process_task = asyncio.create_task(
            transcription_engine.process_audio_stream(
                session_id, session_data, processor
            )
        )
        
        # Start transcription sender task
        sender_task = asyncio.create_task(
            WebSocketTranscriptionSender.send_transcriptions(
                session_id, session_data
            )
        )
        
        # Main message handling loop
        while True:
            # Use a timeout to periodically check connection status
            try:
                message = await asyncio.wait_for(
                    websocket.receive(), 
                    timeout=30.0  # 30 second timeout
                )
            except asyncio.TimeoutError:
                # Check if connection is still considered active
                if not session_data.get("connection_active", False):
                    logger.info(f"[{session_id}] Connection marked as inactive, closing")
                    break
                
                # Send a ping to check connection
                try:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                    logger.debug(f"[{session_id}] Sent ping after receive timeout")
                    continue
                except Exception as e:
                    logger.warning(f"[{session_id}] Failed to send ping, closing connection: {e}")
                    break
            
            # Update activity timestamp
            session_data["last_activity"] = time.time()
            
            # Handle different message types
            if "type" in message and message["type"] == "text":
                if message.get("text") == "end":
                    logger.info(f"[{session_id}] Received end signal")
                    break
            elif "bytes" in message:
                # Binary message (audio data)
                WebSocketMessageHandler.handle_audio_chunk(session_data, message["bytes"])
            else:
                # Unknown message type
                logger.warning(f"[{session_id}] Received unknown message type: {message}")
    
    except WebSocketDisconnect:
        logger.info(f"[{session_id}] WebSocket disconnected")
    except Exception as e:
        logger.error(f"[{session_id}] WebSocket error: {e}")
        # Try to send error message to client
        if session_data and "websocket" in session_data and not websocket.closed:
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Server error: {str(e)}",
                    "timestamp": time.time()
                })
            except Exception:
                pass
    finally:
        # Clean up
        if session_data:
            # Signal processing to stop
            session_data["shutdown_event"].set()
            
            # Wait for tasks to complete
            try:
                if 'process_task' in locals():
                    await asyncio.wait_for(process_task, timeout=5.0)
                if 'sender_task' in locals():
                    await asyncio.wait_for(sender_task, timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning(f"[{session_id}] Timeout waiting for tasks to complete")
            
            # Disconnect from connection manager
            await connection_manager.disconnect(session_id)

# Add a named WebSocket endpoint as well
@app.websocket("/ws/{session_id}")
async def named_websocket_endpoint(websocket: WebSocket, session_id: str):
    """Named WebSocket endpoint for real-time audio transcription."""
    session_data = None
    
    try:
        # Connect and initialize session
        session_data = await connection_manager.connect(websocket, session_id)
        
        # Create processor instance and store in session data
        processor = AudioProcessor(session_data)
        session_data["processor"] = processor
        
        # Start transcription engine processing
        process_task = asyncio.create_task(
            transcription_engine.process_audio_stream(
                session_id, session_data, processor
            )
        )
        
        # Start transcription sender task
        sender_task = asyncio.create_task(
            WebSocketTranscriptionSender.send_transcriptions(
                session_id, session_data
            )
        )
        
        # Main message handling loop
        while True:
            # Use a timeout to periodically check connection status
            try:
                message = await asyncio.wait_for(
                    websocket.receive(), 
                    timeout=30.0  # 30 second timeout
                )
            except asyncio.TimeoutError:
                # Check if connection is still considered active
                if not session_data.get("connection_active", False):
                    logger.info(f"[{session_id}] Connection marked as inactive, closing")
                    break
                
                # Send a ping to check connection
                try:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                    logger.debug(f"[{session_id}] Sent ping after receive timeout")
                    continue
                except Exception as e:
                    logger.warning(f"[{session_id}] Failed to send ping, closing connection: {e}")
                    break
            
            # Update activity timestamp
            session_data["last_activity"] = time.time()
            
            # Handle different message types
            if "type" in message and message["type"] == "text":
                if message.get("text") == "end":
                    logger.info(f"[{session_id}] Received end signal")
                    break
            elif "bytes" in message:
                # Binary message (audio data)
                WebSocketMessageHandler.handle_audio_chunk(session_data, message["bytes"])
            else:
                # Unknown message type
                logger.warning(f"[{session_id}] Received unknown message type: {message}")
    
    except WebSocketDisconnect:
        logger.info(f"[{session_id}] WebSocket disconnected")
    except Exception as e:
        logger.error(f"[{session_id}] WebSocket error: {e}")
        # Try to send error message to client
        if session_data and "websocket" in session_data and not websocket.closed:
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Server error: {str(e)}",
                    "timestamp": time.time()
                })
            except Exception:
                pass
    finally:
        # Clean up
        if session_data:
            # Signal processing to stop
            session_data["shutdown_event"].set()
            
            # Wait for tasks to complete
            try:
                if 'process_task' in locals():
                    await asyncio.wait_for(process_task, timeout=5.0)
                if 'sender_task' in locals():
                    await asyncio.wait_for(sender_task, timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning(f"[{session_id}] Timeout waiting for tasks to complete")
            
            # Disconnect from connection manager
            await connection_manager.disconnect(session_id)

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)


