// apps/backend/src/websocket/connection.ts
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http'; // Import http module for the Server type
import { SessionMeta } from '@shared/types'; // Assuming SessionMeta is defined in your shared types
import { handleSocketMessage, handleSocketClose, handleSocketError, handleWhisperMessage, handleWhisperClose, handleWhisperError } from './handlers'; // Import handlers

// Define SessionMeta if it's not in @shared/types or if you prefer to define it locally
// export interface SessionMeta {
//     meetingId: string;
//     speaker: string;
//     whisperWs: WebSocket | null;
// }

// --- ConnectionStore Class (Remains the same as previous correction) ---
class ConnectionStore {
    private sessions = new Map<WebSocket, SessionMeta>();
    private whisperToClientMap = new Map<WebSocket, WebSocket>(); // Maps Whisper WS to Client WS

    setSessionMeta(clientWs: WebSocket, meta: SessionMeta) {
        this.sessions.set(clientWs, meta);
        if (meta.whisperWs) {
            this.whisperToClientMap.set(meta.whisperWs, clientWs);
        }
    }

    getSessionMeta(clientWs: WebSocket): SessionMeta | undefined {
        return this.sessions.get(clientWs);
    }

    removeSessionMeta(clientWs: WebSocket) {
        const meta = this.sessions.get(clientWs);
        if (meta && meta.whisperWs) {
            this.whisperToClientMap.delete(meta.whisperWs);
        }
        this.sessions.delete(clientWs);
    }

    updateSessionWhisperWs(clientWs: WebSocket, whisperWs: WebSocket) {
        const meta = this.sessions.get(clientWs);
        if (meta) {
            if (meta.whisperWs) {
                this.whisperToClientMap.delete(meta.whisperWs);
            }
            meta.whisperWs = whisperWs;
            this.whisperToClientMap.set(whisperWs, clientWs);
            // No need to set this.sessions.set(clientWs, meta) again if 'meta' is a reference
            // But it's safer if you're unsure how TS handles mutations of objects in Maps
            // For now, assume direct mutation of the object fetched by get() is sufficient.
        } else {
            console.warn(`[ConnectionStore] Attempted to update whisperWs for non-existent clientWs.`);
        }
    }

    findSessionMetaByWhisperWs(whisperWs: WebSocket): SessionMeta | undefined {
        const clientWs = this.whisperToClientMap.get(whisperWs);
        if (clientWs) {
            return this.sessions.get(clientWs);
        }
        return undefined;
    }

    size(): number {
        return this.sessions.size;
    }
}

export const connectionStore = new ConnectionStore(); // Export the singleton instance


// --- WebSocket Server Setup Function (Reintroduced) ---
// Define a type for WebSocket with an 'isAlive' property for heartbeat
interface CustomWebSocket extends WebSocket {
    isAlive: boolean;
}

export const setupWebSocketServer = (server: http.Server) => {
    const wss = new WebSocketServer({ server });

    // Store active clients for managing heartbeats
    const clients = new Set<CustomWebSocket>();

    wss.on('connection', (ws: CustomWebSocket) => {
        console.log("[Backend WS] Client connected");
        clients.add(ws);

        // Heartbeat initialization for new connection
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', (data: Buffer | string) => { // data can be Buffer (binary) or string (text)
            console.log(`[Backend WS] Message received (${typeof data === 'string' ? "text" : "binary"})`);
            // Delegate message handling to handlers.ts
            handleSocketMessage(ws, data);
        });

        ws.on('close', () => {
            console.log("[Backend WS] Client disconnected");
            clients.delete(ws);
            // Delegate cleanup to handlers.ts
            handleSocketClose(ws);
        });

        ws.on('error', (err: Error) => { // Error event is an actual Error object
            console.error("[Backend WS] Error:", err);
            // Delegate error handling to handlers.ts
            handleSocketError(ws, err);
        });
    });

    wss.on('error', (error: Error) => {
        console.error("[Backend WS] WebSocket Server error:", error);
    });

    console.log('[Backend WS] WebSocket server setup complete.');

    // --- Periodically check for dead connections (Heartbeat for all clients) ---
    const interval = setInterval(() => {
        clients.forEach((ws: CustomWebSocket) => {
            if (ws.isAlive === false) {
                console.log('[Backend WS] Terminating dead client connection.');
                ws.terminate(); // Force close the connection
                return; // Go to next client
            }
            ws.isAlive = false; // Mark as not alive, expecting a pong
            ws.ping(); // Send a ping frame to the client
        });
    }, 30000); // Ping every 30 seconds

    wss.on('close', () => {
        console.log('[Backend WS] WebSocket server shutting down, clearing ping interval.');
        clearInterval(interval);
    });
};
