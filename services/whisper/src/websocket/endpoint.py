"""
WebSocket endpoint module for Whisper service.
Defines the main WebSocket endpoint and connection handling.
"""

import asyncio
import json
from typing import Union, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from .handlers import session_manager, message_handler, transcription_sender
from ..transcription.engine import transcription_engine
from ..config.settings import BUFFER_DURATION_SECONDS, get_logger

logger = get_logger(__name__)

async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for handling transcription sessions.

    Args:
        websocket: FastAPI WebSocket instance
    """
    logger.info(f"WebSocket connection attempt received from {websocket.client}")

    try:
        # Accept the WebSocket connection first
        await websocket.accept()
        logger.info(f"WebSocket connection accepted from {websocket.client}")

        # Create new session after accepting
        session_data = session_manager.create_session(websocket)
        session_id = session_data["session_id"]
        
        # Start background tasks
        sender_task = asyncio.create_task(transcription_sender.send_transcriptions(session_data))
        session_data["processing_task"] = asyncio.create_task(
            transcription_engine.process_audio_stream(session_data)
        )
        session_data["sender_task"] = sender_task
        
        logger.info(f"[{session_id}] Session started. Entering receive loop.")
        
        # Main message receiving loop
        while True:
            try:
                # Receive message from WebSocket
                message_received: Union[WebSocket.WebSocketMessage, Dict[str, Any]] = await websocket.receive()
                logger.debug(f"[{session_id}] Message received (type: {message_received.get('type')}).")
                
                if message_received["type"] == "websocket.receive":
                    if "text" in message_received:
                        # Handle text messages (start/end commands)
                        data = json.loads(message_received["text"])
                        
                        if data.get("type") == "start":
                            await message_handler.handle_start_message(session_data, data)
                        elif data.get("type") == "end":
                            await message_handler.handle_end_message(session_data)
                        else:
                            logger.warning(f"[{session_id}] Unknown text message type received: {data.get('type')}")
                    
                    elif "bytes" in message_received:
                        # Handle binary audio data
                        audio_chunk = message_received["bytes"]
                        message_handler.handle_audio_chunk(session_data, audio_chunk)
                    else:
                        logger.warning(f"[{session_id}] Received websocket.receive with no text or bytes payload.")
                
                elif message_received["type"] == "websocket.disconnect":
                    logger.info(f"[{session_id}] Received websocket.disconnect message. Signaling shutdown.")
                    session_data["shutdown_event"].set()
                    break
                
                else:
                    logger.warning(f"[{session_id}] Unexpected ASGI message format: {message_received}")
            
            except WebSocketDisconnect:
                logger.info(f"[{session_id}] Client disconnected (WebSocketDisconnect exception). Signaling shutdown.")
                session_data["shutdown_event"].set()
                break
            except json.JSONDecodeError:
                logger.error(f"[{session_id}] Received invalid JSON text message.", exc_info=True)
            except Exception as e:
                logger.error(f"[{session_id}] Unexpected error during receive loop: {e}", exc_info=True)
                session_data["shutdown_event"].set()
                break
    
    finally:
        await _cleanup_session(session_data)

async def _cleanup_session(session_data: Dict[str, Any]):
    """
    Clean up session resources and tasks.
    
    Args:
        session_data: Session metadata and state
    """
    session_id = session_data["session_id"]
    logger.info(f"[{session_id}] WebSocket endpoint entering finally block for cleanup.")
    
    # Ensure shutdown signal is set
    if not session_data["shutdown_event"].is_set():
        session_data["shutdown_event"].set()
        logger.info(f"[{session_id}] Shutdown event forcefully set in finally block.")
    
    # Wait for processing task to finish
    if session_data["processing_task"]:
        try:
            timeout = BUFFER_DURATION_SECONDS * 2 + 5
            await asyncio.wait_for(session_data["processing_task"], timeout=timeout)
            logger.info(f"[{session_id}] Processing task completed gracefully.")
        except asyncio.TimeoutError:
            logger.warning(f"[{session_id}] Processing task did not finish in time. Cancelling.")
            session_data["processing_task"].cancel()
            try:
                await session_data["processing_task"]
            except asyncio.CancelledError:
                logger.info(f"[{session_id}] Processing task caught CancelledError during await.")
            except Exception as e:
                logger.error(f"[{session_id}] Error during processing task cancellation await: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"[{session_id}] Error awaiting processing task: {e}", exc_info=True)
    
    # Wait for transcription to finish
    try:
        await asyncio.wait_for(session_data["transcription_finished_event"].wait(), timeout=5)
        logger.info(f"[{session_id}] All transcriptions processed and queued.")
    except asyncio.TimeoutError:
        logger.warning(f"[{session_id}] transcription_finished_event not set in time.")
    except Exception as e:
        logger.error(f"[{session_id}] Error waiting for transcription_finished_event: {e}", exc_info=True)
    
    # Signal sender task to stop
    session_data["websocket_closed_by_endpoint"].set()
    logger.info(f"[{session_id}] Signaled sender task that websocket is closing.")
    
    # Give sender task time to acknowledge closure
    await asyncio.sleep(0.1)
    
    # Ensure sender task is done
    if session_data["sender_task"] and not session_data["sender_task"].done():
        session_data["sender_task"].cancel()
        logger.info(f"[{session_id}] Sender task cancelled.")
        try:
            await session_data["sender_task"]
            logger.info(f"[{session_id}] Sender task successfully awaited after cancellation.")
        except asyncio.CancelledError:
            logger.info(f"[{session_id}] Sender task caught asyncio.CancelledError as expected.")
        except Exception as e:
            logger.error(f"[{session_id}] Error awaiting sender task after cancellation: {e}", exc_info=True)
    elif session_data["sender_task"] and session_data["sender_task"].done():
        logger.info(f"[{session_id}] Sender task was already finished.")
    
    # Clean up session
    session_manager.remove_session(session_id)
    
    # Close WebSocket
    try:
        await session_data["websocket"].close()
        logger.info(f"[{session_id}] WebSocket explicitly closed by server.")
    except RuntimeError as e:
        logger.warning(f"[{session_id}] Could not explicitly close WebSocket (might be already closed): {e}")
    except Exception as e:
        logger.error(f"[{session_id}] Error closing WebSocket: {e}", exc_info=True)
    
    logger.info(f"[{session_id}] Final cleanup for connection completed.")
