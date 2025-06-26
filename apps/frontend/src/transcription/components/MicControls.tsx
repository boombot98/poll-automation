// apps/frontend/src/components/MicControls.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneStreamer } from '../utils/microphoneStream';
import type { TranscriptionResult } from '@shared/types';

// Assuming this component receives props like meetingId and speaker for the host
interface MicControlsProps {
    meetingId: string;
    speaker: string; // This would be the host's speaker identifier
}

const HOST_WEBSOCKET_URL = 'ws://localhost:3000'; // Or your deployed backend WebSocket URL

const MicControls: React.FC<MicControlsProps> = ({ meetingId, speaker }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [lastTranscription, setLastTranscription] = useState('');
    const streamerRef = useRef<MicrophoneStreamer | null>(null);

    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            if (streamerRef.current) {
                streamerRef.current.stop();
            }
        };
    }, []);

    const handleTranscription = (result: TranscriptionResult) => {
        setLastTranscription(result.text);
        console.log(`[HostMic] Transcription: ${result.speaker}: ${result.text}`);
    };

    const handleStatus = (message: string) => {
        setStatus(message);
    };

    const handleError = (error: string) => {
        setStatus(`Error: ${error}`);
        console.error('[HostMic] Streamer Error:', error);
        setIsRecording(false);
    };

    const handleStreamEnd = () => {
        setIsRecording(false);
        setStatus('Recording stopped.');
        console.log('[HostMic] Stream ended.');
    };

    const startRecording = async () => {
        if (isRecording) return;

        setStatus('Starting...');
        setLastTranscription('');

        if (streamerRef.current) {
            streamerRef.current.stop(); 
            streamerRef.current = null;
        }

        streamerRef.current = new MicrophoneStreamer({
            websocketUrl: HOST_WEBSOCKET_URL,
            meetingId: meetingId,
            proposedSpeakerName: speaker, // Host's speaker name
            onTranscription: handleTranscription,
            onStatus: handleStatus,
            onError: handleError,
            onStreamEnd: handleStreamEnd,
        });

        try {
            await streamerRef.current.start();
            setIsRecording(true);
            setStatus('Recording...');
        } catch (err) {
            console.error('Failed to start recording:', err);
            setStatus(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (!isRecording) return;
        if (streamerRef.current) {
            streamerRef.current.stop();
            streamerRef.current = null;
        }
        setIsRecording(false);
        setStatus('Stopping...');
    };

    return (
        <div>
            <h2>Microphone Controls ({speaker})</h2>
            <p>Status: {status}</p>
            <button onClick={startRecording} disabled={isRecording}>
                Start Microphone
            </button>
            <button onClick={stopRecording} disabled={!isRecording}>
                Stop Microphone
            </button>
            {lastTranscription && (
                <div>
                    <h3>Last Spoken:</h3>
                    <p>{lastTranscription}</p>
                </div>
            )}
        </div>
    );
};

export default MicControls;