import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { forwardToWhisper } from '../services/whisper';
import { connectionStore } from './connection';
import {
  FrontendToServerMessage,
  StartMessage,
  EndMessage,
  TranscriptionResult,
  StartConfirmationMessage,
  SessionMeta
} from '@shared/types';

// ✅ Buffer to temporarily hold audio chunks before Whisper is ready
const tempAudioBufferMap = new Map<WebSocket, Buffer[]>();

export const handleSocketMessage = async (clientWs: WebSocket, message: Buffer | string) => {
  try {
    if (typeof message === 'string') {
      const data: FrontendToServerMessage = JSON.parse(message);
      console.log(`[Backend] Received JSON message from client: ${JSON.stringify(data.type)}`);

      if (data.type === 'start') {
        const startData = data as StartMessage;
        const meetingId = startData.meetingId;
        const proposedSpeakerName = startData.proposedSpeakerName || 'AnonymousSpeaker';

        const assignedSpeakerId = `${proposedSpeakerName.replace(/\s/g, '_').substring(0, 20)}-${uuidv4()}`;
        console.log(`[Backend] Client requested session start for meeting: ${meetingId}, proposed speaker: ${proposedSpeakerName}. Assigned speakerId: ${assignedSpeakerId}`);

        const newSessionMeta: SessionMeta = {
          meetingId,
          speaker: assignedSpeakerId,
          whisperWs: null
        };
        connectionStore.setSessionMeta(clientWs, newSessionMeta);

        await forwardToWhisper(clientWs, meetingId, assignedSpeakerId);

        // ✅ Flush buffered audio chunks after whisper connects
        const bufferedChunks = tempAudioBufferMap.get(clientWs);
        if (bufferedChunks && newSessionMeta.whisperWs?.readyState === WebSocket.OPEN) {
          for (const chunk of bufferedChunks) {
            newSessionMeta.whisperWs.send(chunk);
            console.debug(`[Backend] Flushed buffered chunk of ${chunk.byteLength} bytes.`);
          }
          tempAudioBufferMap.delete(clientWs);
        }

        const confirmationMessage: StartConfirmationMessage = {
          type: 'status',
          message: `Whisper session started. Your speaker ID is: ${assignedSpeakerId}`,
          meetingId,
          speakerId: assignedSpeakerId
        };
        clientWs.send(JSON.stringify(confirmationMessage));
      } else if (data.type === 'end') {
        const endData = data as EndMessage;
        console.log(`[Backend] Client requested session end for meeting: ${endData.meetingId}`);

        const sessionMeta = connectionStore.getSessionMeta(clientWs);
        if (sessionMeta && sessionMeta.whisperWs) {
          sessionMeta.whisperWs.send(JSON.stringify({
            type: 'end',
            meetingId: endData.meetingId,
            speaker: sessionMeta.speaker
          }));
        }
        clientWs.close();
      }

    } else if (Buffer.isBuffer(message)) {
      const sessionMeta = connectionStore.getSessionMeta(clientWs);

      if (!sessionMeta || !sessionMeta.whisperWs || sessionMeta.whisperWs.readyState !== WebSocket.OPEN) {
        console.warn('[Backend] Received audio chunk for unknown or disconnected session. Buffering temporarily.');
        const existing = tempAudioBufferMap.get(clientWs) || [];
        existing.push(message);
        tempAudioBufferMap.set(clientWs, existing);
        return;
      }

      sessionMeta.whisperWs.send(message);
      console.debug(`[Backend] Forwarded audio chunk of ${message.byteLength} bytes for ${sessionMeta.speaker}`);
    }
  } catch (error) {
    console.error('[Backend] Error handling message:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'error', message: 'Backend processing error.' }));
    }
  }
};

export const handleSocketClose = (clientWs: WebSocket) => {
  console.log('[Backend] Client WebSocket disconnected.');
  const sessionMeta = connectionStore.getSessionMeta(clientWs);

  if (sessionMeta) {
    console.log(`[Backend] Cleaning up session for meeting: ${sessionMeta.meetingId}, speaker: ${sessionMeta.speaker}`);
    if (sessionMeta.whisperWs && sessionMeta.whisperWs.readyState === WebSocket.OPEN) {
      sessionMeta.whisperWs.send(JSON.stringify({
        type: 'end',
        meetingId: sessionMeta.meetingId,
        speaker: sessionMeta.speaker
      }));
      sessionMeta.whisperWs.close();
      console.log(`[Backend] Closed Whisper WebSocket for ${sessionMeta.speaker}.`);
    }
    connectionStore.removeSessionMeta(clientWs);
    console.log(`[Backend] Session data removed for ${sessionMeta.speaker}. Active sessions: ${connectionStore.size()}.`);
  } else {
    console.log('[Backend] No session data found for disconnected client.');
  }

  // ✅ Always clear temp buffer
  tempAudioBufferMap.delete(clientWs);
};

export const handleSocketError = (clientWs: WebSocket, error: Error) => {
  console.error('[Backend] Client WebSocket error:', error);
};

export const handleWhisperMessage = (clientWs: WebSocket, message: string) => {
  try {
    const transcriptionResult: TranscriptionResult = JSON.parse(message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(transcriptionResult));
      console.debug(`[Backend] Relayed transcription from Whisper for ${transcriptionResult.speaker}: ${transcriptionResult.text.substring(0, 50)}...`);
    } else {
      console.warn('[Backend] Client WebSocket not open, cannot relay transcription.');
    }
  } catch (error) {
    console.error('[Backend] Error parsing Whisper message or relaying:', error);
  }
};

export const handleWhisperClose = (clientWs: WebSocket, whisperWs: WebSocket) => {
  console.log('[Backend] Whisper WebSocket closed for a session.');
  const sessionMeta = connectionStore.findSessionMetaByWhisperWs(whisperWs);
  if (sessionMeta) {
    console.log(`[Backend] Whisper WS for speaker ${sessionMeta.speaker} closed. Client WS ready state: ${clientWs.readyState}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'status', message: `Transcription service disconnected for ${sessionMeta.speaker}.` }));
    }
  } else {
    console.warn('[Backend] Whisper WS closed, but no corresponding session found.');
  }
};

export const handleWhisperError = (clientWs: WebSocket, error: unknown) => {
  console.error('[Backend] Whisper WebSocket error:', error);
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(JSON.stringify({
      type: 'error',
      message: `Transcription service error: ${error instanceof Error ? error.message : String(error)}`
    }));
  }
};
