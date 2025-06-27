// apps/frontend/src/utils/microphoneStream.ts
import type {
  StartMessage,
   EndMessage,
  TranscriptionResult,
  StartConfirmationMessage,
  ServerToFrontendMessage
} from '@shared/types';

interface MicrophoneStreamerOptions {
    websocketUrl: string;
    meetingId: string;
    proposedSpeakerName: string;
    onTranscription: (result: TranscriptionResult) => void;
    onStatus: (message: string) => void;
    onError: (error: string) => void;
    onStreamEnd: () => void;
}

export class MicrophoneStreamer {
    private ws: WebSocket | null = null;
    private mediaStream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - ScriptProcessorNode is deprecated but widely supported, AudioWorklet for modern apps
    private audioProcessor: ScriptProcessorNode | null = null;
    private isStreaming: boolean = false;
    private assignedSpeakerId: string | null = null; // Store the ID assigned by the backend
    private audioQueue: Int16Array[] = []; // Queue audio until speakerId is assigned
    private processingInterval: number | null = null; // Interval for sending queued audio
    private pingInterval: number | null = null; // Interval for ping messages

    private readonly websocketUrl: string;
    private readonly meetingId: string;
    private readonly proposedSpeakerName: string;
    private readonly onTranscription: (result: TranscriptionResult) => void;
    private readonly onStatus: (message: string) => void;
    private readonly onError: (error: string) => void;
    private readonly onStreamEnd: () => void;

    // Audio constants
    private readonly SAMPLE_RATE = 16000; // Expected by Whisper
    private readonly BUFFER_SIZE = 4096; // ScriptProcessorNode buffer size

    constructor(options: MicrophoneStreamerOptions) {
        this.websocketUrl = options.websocketUrl;
        this.meetingId = options.meetingId;
        this.proposedSpeakerName = options.proposedSpeakerName;
        this.onTranscription = options.onTranscription;
        this.onStatus = options.onStatus;
        this.onError = options.onError;
        this.onStreamEnd = options.onStreamEnd;
    }

    private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: unknown[]) {
        const prefix = `[MicStreamer-${this.meetingId}-${this.proposedSpeakerName}]`;
        if (level === 'error') console.error(prefix, message, ...args);
        else if (level === 'warn') console.warn(prefix, message, ...args);
        else if (level === 'debug') console.debug(prefix, message, ...args);
        else console.log(prefix, message, ...args);
    }

    async start(): Promise<void> {
        if (this.isStreaming) {
            this.log('warn', 'Already streaming.');
            return;
        }

        this.onStatus('Requesting microphone access...');
        this.log('info', 'Starting microphone stream...');

        try {
            // 1. Get Microphone Access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.onStatus('Microphone access granted. Connecting to server...');

            // 2. Initialize AudioContext and ScriptProcessorNode (but don't start processing yet)
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: this.SAMPLE_RATE,
            });
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Using ScriptProcessorNode (deprecated, but widely compatible for quick setup)
            // For production, consider AudioWorklet for better performance and modern API.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - createScriptProcessor is deprecated but needed for compatibility
            this.audioProcessor = this.audioContext.createScriptProcessor(this.BUFFER_SIZE, 1, 1);
            // Don't set onaudioprocess yet - wait for WebSocket connection
            source.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);

            // 3. Initialize WebSocket with proper configuration
            this.ws = new WebSocket(this.websocketUrl);
            // Ensure binary data is handled as ArrayBuffer for audio chunks
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this.log('info', 'WebSocket connected. Sending start message...');
                this.log('info', `WebSocket readyState: ${this.ws?.readyState}`);
                this.onStatus('Connected. Starting session...');

                // Send initial start message with proposedSpeakerName after a small delay
                setTimeout(() => {
                    const startMessage: StartMessage = {
                        type: 'start',
                        meetingId: this.meetingId,
                        proposedSpeakerName: this.proposedSpeakerName,
                    };
                    const messageString = JSON.stringify(startMessage);
                    this.log('info', 'Sending start message:', messageString);
                    this.log('info', `WebSocket readyState before send: ${this.ws?.readyState}`);

                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(messageString);
                        this.log('info', 'Start message sent successfully');
                        this.log('info', `Message sent as: ${typeof messageString}, content: ${messageString}`);
                    } else {
                        this.log('error', 'WebSocket not open when trying to send start message');
                    }
                }, 50); // Small delay to ensure connection is fully established

                // Give the backend a moment to process the start message, then start audio processing
                setTimeout(() => {
                    if (this.audioProcessor && this.ws?.readyState === WebSocket.OPEN) {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore - onaudioprocess is deprecated but needed for compatibility
                        this.audioProcessor.onaudioprocess = this.handleAudioProcess;
                        this.isStreaming = true;
                        this.log('info', 'Audio processing started after WebSocket connection.');
                    }
                }, 200); // 200ms delay to ensure backend processes start message (increased from 100ms)

                // Start sending queued audio only after speakerId is assigned
                this.processingInterval = window.setInterval(() => {
                    if (this.assignedSpeakerId && this.audioQueue.length > 0) {
                        const buffer = this.audioQueue.shift(); // Get oldest chunk
                        if (buffer) {
                            this.ws?.send(buffer.buffer); // Send Int16Array's ArrayBuffer
                            this.log('debug', `Sent ${buffer.byteLength} bytes from queue.`);
                        }
                    }
                }, 50); // Send every 50ms if data is available

                // Send ping every 25 seconds to keep connection alive
                this.pingInterval = window.setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        try {
                            this.ws.send(JSON.stringify({
                                type: 'ping',
                                timestamp: Date.now()
                            }));
                            this.log('debug', 'Sent ping');
                        } catch (error) {
                            this.log('error', 'Failed to send ping:', error);
                        }
                    }
                }, 25000);
            };

            this.ws.onmessage = (event) => {
                const message: ServerToFrontendMessage | { type: 'ping'; timestamp: number } = JSON.parse(event.data);
                this.log('debug', 'Received message:', message);

                // Handle ping messages by sending a pong response
                if (message.type === 'ping') {
                    try {
                        this.ws?.send(JSON.stringify({
                            type: 'pong',
                            timestamp: Date.now()
                        }));
                        this.log('debug', 'Sent pong response');
                    } catch (error) {
                        this.log('error', 'Failed to send pong:', error);
                    }
                    return;
                }
                
                if (message.type === 'status') {
                    const statusMessage = message as StartConfirmationMessage;
                    this.onStatus(statusMessage.message);
                    if (statusMessage.speakerId) {
                        this.assignedSpeakerId = statusMessage.speakerId;
                        this.onStatus(`Session started as speaker: ${this.assignedSpeakerId}`);
                        this.log('info', `Assigned speaker ID: ${this.assignedSpeakerId}`);
                    }
                } else if (message.type === 'transcription') {
                    this.onTranscription(message as TranscriptionResult);
                } else if (message.type === 'error') {
                    this.onError(`Server error: ${message.message}`);
                    this.log('error', 'Server error message:', message.message);
                    this.stop(); // Stop streaming on server error
                }
            };

            this.ws.onclose = (event) => {
                this.log('info', `WebSocket closed: ${event.code} - ${event.reason}`);
                this.onStatus('Connection closed.');
                this.cleanup();

                // Clear ping interval
                if (this.pingInterval !== null) {
                    clearInterval(this.pingInterval);
                    this.pingInterval = null;
                }
            };

            this.ws.onerror = (error) => {
                this.log('error', 'WebSocket error:', error);
                this.onError('WebSocket connection error.');
                this.cleanup();
            };

        } catch (error) {
            this.log('error', 'Error starting microphone stream:', error);
            this.onError(`Could not start microphone: ${error instanceof Error ? error.message : String(error)}`);
            this.cleanup();
        }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - AudioProcessingEvent is deprecated but needed for compatibility
    private handleAudioProcess = (event: AudioProcessingEvent) => {
        if (!this.isStreaming || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - inputBuffer is deprecated but needed for compatibility
        const inputBuffer = event.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array (16-bit PCM) for the Python backend
        const int16Buffer = new Int16Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
            int16Buffer[i] = Math.max(-1, Math.min(1, inputBuffer[i])) * 0x7FFF; // Scale to 16-bit and clamp
        }

        // Queue audio if speakerId not yet assigned, otherwise send directly
        if (this.assignedSpeakerId) {
            this.ws.send(int16Buffer.buffer);
            this.log('debug', `Sent ${int16Buffer.byteLength} bytes audio.`);
        } else {
            this.audioQueue.push(int16Buffer);
            this.log('debug', `Queued ${int16Buffer.byteLength} bytes. Queue size: ${this.audioQueue.length}`);
        }
    };

    stop(): void {
        this.log('info', 'Stopping microphone stream...');
        if (!this.isStreaming) {
            this.log('warn', 'Not currently streaming.');
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const endMessage:  EndMessage = { // Re-using StartMessage interface for simplicity for "end"
                type: 'end',
                meetingId: this.meetingId,
            };
            this.ws.send(JSON.stringify(endMessage));
            this.ws.close();
        }
        this.cleanup();
        this.onStatus('Recording stopped.');
        this.onStreamEnd();
    }

    private cleanup(): void {
        this.isStreaming = false;
        this.assignedSpeakerId = null;
        this.audioQueue = []; // Clear any queued audio
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - onaudioprocess is deprecated but needed for compatibility
            this.audioProcessor.onaudioprocess = null;
            this.audioProcessor = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        this.ws = null;
        this.log('info', 'Microphone stream cleaned up.');
    }
}
