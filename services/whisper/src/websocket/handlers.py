"""
WebSocket handlers for Whisper service.
Manages WebSocket connections, message handling, and transcription sending.
"""

import asyncio
import time
import io
import json
from typing import Dict, Any, Optional
from fastapi import WebSocket

from ..config.settings import get_logger, SESSION_INACTIVITY_TIMEOUT

logger = get_logger(__name__)

class WebSocketConnectionManager:
    """Manages WebSocket connections and session data."""
    
    def __init__(self):
        self.active_connections = {}
        self.heartbeat_task = None
        self.start_heartbeat_monitor()
    
    def start_heartbeat_monitor(self):
        """Start a background task to monitor connection health."""
        if self.heartbeat_task is None:
            self.heartbeat_task = asyncio.create_task(self.monitor_connections())
    
    async def monitor_connections(self):
        """Periodically check connection health and send heartbeats."""
        while True:
            try:
                await asyncio.sleep(15)  # Check every 15 seconds
                
                # Send heartbeats to all connections
                disconnected = []
                for session_id, session_data in self.active_connections.items():
                    websocket = session_data.get("websocket")
                    last_activity = session_data.get("last_activity", 0)
                    
                    # Check for timeout
                    if time.time() - last_activity > SESSION_INACTIVITY_TIMEOUT:
                        logger.warning(f"[{session_id}] Session timeout after {SESSION_INACTIVITY_TIMEOUT}s of inactivity")
                        disconnected.append(session_id)
                        continue
                    
                    if websocket and not websocket.closed:
                        try:
                            # Send a ping to keep the connection alive
                            await websocket.send_json({"type": "ping", "timestamp": time.time()})
                            logger.debug(f"[{session_id}] Sent heartbeat ping")
                        except Exception as e:
                            logger.warning(f"[{session_id}] Failed to send heartbeat: {e}")
                            disconnected.append(session_id)
                    else:
                        disconnected.append(session_id)
                
                # Clean up disconnected sessions
                for session_id in disconnected:
                    await self.disconnect(session_id)
                    
            except Exception as e:
                logger.error(f"Error in connection monitor: {e}")
    
    async def connect(self, websocket: WebSocket, session_id: str) -> Dict[str, Any]:
        """
        Register a new WebSocket connection.
        
        Args:
            websocket: The WebSocket connection
            session_id: Unique session identifier
            
        Returns:
            Session data dictionary
        """
        await websocket.accept()
        
        # Create session data structure
        session_data = {
            "session_id": session_id,
            "websocket": websocket,
            "connected_at": time.time(),
            "last_activity": time.time(),
            "audio_buffer": io.BytesIO(),
            "transcript_queue": asyncio.Queue(),
            "shutdown_event": asyncio.Event(),
            "transcription_finished_event": asyncio.Event(),
            "connection_active": True  # Flag to track if connection is still considered active
        }
        
        self.active_connections[session_id] = session_data
        logger.info(f"[{session_id}] WebSocket connection established")
        
        return session_data
    
    async def disconnect(self, session_id: str):
        """
        Unregister a WebSocket connection.
        
        Args:
            session_id: Session identifier to disconnect
        """
        if session_id in self.active_connections:
            session_data = self.active_connections[session_id]
            
            # Set shutdown event to signal processing to stop
            if "shutdown_event" in session_data:
                session_data["shutdown_event"].set()
            
            # Mark connection as inactive
            session_data["connection_active"] = False
            
            # Wait briefly for processing to finish
            if "transcription_finished_event" in session_data:
                try:
                    await asyncio.wait_for(session_data["transcription_finished_event"].wait(), timeout=3.0)
                except asyncio.TimeoutError:
                    logger.warning(f"[{session_id}] Timeout waiting for transcription to finish")
            
            # Close WebSocket if still open
            if "websocket" in session_data and not session_data["websocket"].closed:
                try:
                    await session_data["websocket"].close()
                except Exception as e:
                    logger.error(f"[{session_id}] Error closing WebSocket: {e}")
            
            # Remove from active connections
            del self.active_connections[session_id]
            logger.info(f"[{session_id}] WebSocket connection closed")
    
    def update_activity(self, session_id: str):
        """Update the last activity timestamp for a session."""
        if session_id in self.active_connections:
            self.active_connections[session_id]["last_activity"] = time.time()

# Global connection manager instance
connection_manager = WebSocketConnectionManager()

class WebSocketMessageHandler:
    """Handles WebSocket messages from clients."""
    
    @staticmethod
    def handle_audio_chunk(session_data: Dict[str, Any], audio_chunk: bytes):
        """Handle binary audio data from client."""
        session_id = session_data["session_id"]
        
        # Update last activity timestamp
        if "last_activity" in session_data:
            session_data["last_activity"] = time.time()
        
        # Use the processor's add_audio_data method which has better silence handling
        if "processor" in session_data and hasattr(session_data["processor"], "add_audio_data"):
            session_data["processor"].add_audio_data(audio_chunk)
        else:
            # Fallback to direct buffer writing
            session_data["audio_buffer"].write(audio_chunk)
        
        # Update connection manager activity
        connection_manager = session_data.get("connection_manager")
        if connection_manager and hasattr(connection_manager, "update_activity"):
            connection_manager.update_activity(session_id)
        
        logger.debug(f"[{session_id}] Received audio chunk of {len(audio_chunk)} bytes.")

class WebSocketTranscriptionSender:
    """Sends transcription results to clients via WebSocket."""
    
    @staticmethod
    async def send_transcriptions(session_id: str, session_data: Dict[str, Any]):
        """
        Background task to send transcription results to the client.
        
        Args:
            session_id: Session identifier
            session_data: Session data dictionary
        """
        transcript_queue = session_data["transcript_queue"]
        websocket = session_data["websocket"]
        
        try:
            while True:
                # Wait for transcription result
                try:
                    result = await asyncio.wait_for(transcript_queue.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    # Check if session is closed
                    if session_data["shutdown_event"].is_set():
                        break
                    continue
                
                # Check if session is closed
                if session_data["shutdown_event"].is_set() and transcript_queue.empty():
                    break
                
                # Send result to client
                if result:
                    try:
                        if isinstance(result, dict):
                            await websocket.send_json(result)
                        else:
                            await websocket.send_text(json.dumps(result))
                        
                        # Log transcription (if present)
                        if "text" in result:
                            logger.info(f"[{session_id}] Sent transcription: {result['text']}")
                    except Exception as e:
                        logger.error(f"[{session_id}] Error sending transcription: {e}")
                        break
                
                # Mark task as done
                transcript_queue.task_done()
        except Exception as e:
            logger.error(f"[{session_id}] Error in send_transcriptions: {e}")
        finally:
            # Signal that transcription sending is finished
            session_data["transcription_finished_event"].set()
            logger.info(f"[{session_id}] Transcription sender task finished")

# Global instances
session_manager = WebSocketSessionManager()
message_handler = WebSocketMessageHandler()
transcription_sender = WebSocketTranscriptionSender()



