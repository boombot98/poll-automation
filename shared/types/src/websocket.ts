// shared\types\src\websocket.ts
import type * as ws from 'ws';

export type SpeakerRole = 'host' | 'participant';

export interface TranscriptionResult {
    type: 'transcription' | 'error' | 'status';
    meetingId: string;
    speaker: string; // This will now be the backend-generated unique speaker ID
    text: string;
    segment_start?: number; // Optional, as it might not always be present or relevant for partials
    segment_end?: number;    // Optional
    language?: string;       // Optional
    is_final: boolean;
    message?: string; // For 'status' or 'error' messages from backend
}

// Client sends this to initiate a session
export interface StartMessage {
    type: 'start';
    meetingId: string;
    proposedSpeakerName?: string; // New: Client suggests a display name
}

// Client sends this to end a session
export interface EndMessage {
    type: 'end';
    meetingId: string;
    // For 'end', the backend should primarily use the session's stored speakerId,
    // so no need to explicitly send it from frontend here.
}

// Backend sends this back to the client to confirm session start and provide the assigned speakerId
export interface StartConfirmationMessage {
    type: 'status';
    message: string;
    meetingId: string;
    speakerId: string; // The uniquely generated speaker ID for this session
}


// Union type for all JSON messages the frontend might send to backend
// Note: Binary audio (ArrayBuffer) is sent directly, not as a JSON message type in this union
export type FrontendToServerMessage = StartMessage | EndMessage;

// Union type for all messages the frontend might receive from backend
export type ServerToFrontendMessage = TranscriptionResult | StartConfirmationMessage;

export interface SessionMeta {
  meetingId: string;
  speaker: string;
  whisperWs: ws.WebSocket | null;
  audioBuffer?: Buffer[];
}

