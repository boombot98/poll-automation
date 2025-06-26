import WebSocket from 'ws';
import { connectionStore } from '../websocket/connection';
import { handleWhisperMessage, handleWhisperClose, handleWhisperError } from '../websocket/handlers';
const WHISPER_SERVICE_URL = 'ws://localhost:8000';


export const forwardToWhisper = (clientWs: WebSocket, meetingId: string, speaker: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const whisperWs = new WebSocket(WHISPER_SERVICE_URL);

    whisperWs.onopen = () => {
      console.log(`[WhisperService] Connected to Whisper service for ${speaker}.`);
      connectionStore.updateSessionWhisperWs(clientWs, whisperWs);

      const sessionMeta = connectionStore.getSessionMeta(clientWs);

      if (sessionMeta?.audioBuffer?.length) {
        sessionMeta.audioBuffer.forEach((chunk: Buffer) => {
          whisperWs.send(chunk);
        });

        console.log(`[WhisperService] Flushed ${sessionMeta.audioBuffer.length} buffered audio chunks.`);
        sessionMeta.audioBuffer = [];
      }

      const startMessage = JSON.stringify({
        type: 'start',
        meetingId,
        speaker
      });
      whisperWs.send(startMessage);
      resolve();
    };

    whisperWs.onmessage = (event) => {
      handleWhisperMessage(clientWs, event.data.toString());
    };

    whisperWs.onclose = (event) => {
      console.log(`[WhisperService] Whisper WebSocket closed for ${speaker}: ${event.code} - ${event.reason}`);
      handleWhisperClose(clientWs, whisperWs);
      reject(new Error(`Whisper WebSocket closed: ${event.reason}`));
    };

    whisperWs.onerror = (event: any) => {
      console.error(`[WhisperService] Whisper WebSocket error for ${speaker}:`, event);
      handleWhisperError(clientWs, event?.error || new Error('Unknown Whisper WebSocket error'));
      reject(event?.error || new Error('Whisper WebSocket connection error'));
    };
  });
};

export const transcribeAudioChunk = async (audioChunk: Buffer): Promise<any> => {
  console.warn("transcribeAudioChunk is deprecated for real-time streaming. Use WebSocket instead.");
  return Promise.resolve({ transcript: "Deprecated", confidence: 0 });
};
