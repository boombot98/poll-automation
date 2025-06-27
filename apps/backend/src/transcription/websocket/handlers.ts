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
    console.log(`[Backend] Received message type: ${typeof message}, length: ${message.length}`);

    // Handle both string and Buffer messages that might contain JSON
    let messageText: string;
    if (typeof message === 'string') {
      messageText = message;
    } else if (Buffer.isBuffer(message)) {
      // Try to parse as text first (might be JSON sent as Buffer)
      try {
        messageText = message.toString('utf8');
        // Check if it looks like JSON
        if (messageText.trim().startsWith('{') && messageText.trim().endsWith('}')) {
          console.log(`[Backend] Converting Buffer to text message: ${messageText}`);
        } else {
          // It's binary audio data
          throw new Error('Not JSON text');
        }
      } catch {
        // It's definitely binary audio data
        console.log(`[Backend] Processing binary audio data: ${message.length} bytes`);
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
        return;
      }
    } else {
      console.error(`[Backend] Unexpected message type: ${typeof message}`);
      return;
    }

    // Process as JSON text message
    console.log(`[Backend] Processing text message: ${messageText}`);
    const data: FrontendToServerMessage = JSON.parse(messageText);
    console.log(`[Backend] Parsed JSON message:`, data);

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

        try {
          await forwardToWhisper(clientWs, meetingId, assignedSpeakerId);
        } catch (whisperError) {
          console.error(`[Backend] Failed to connect to Whisper service:`, whisperError);
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'Failed to connect to transcription service. Please ensure the Whisper service is running.'
          }));
          return;
        }

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
  console.error(`[Whisper] WebSocket error:`, error);

  try {
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'An error occurred while connecting to the transcription service.',
      })
    );
  } catch (err) {
    console.error('[Whisper] Failed to send error message to client:', err);
  }
};

