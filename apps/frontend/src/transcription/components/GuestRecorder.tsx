// apps/frontend/src/components/GuestRecorder.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MicrophoneStreamer } from '../utils/microphoneStream';
import type { TranscriptionResult } from '@shared/types';
import '../../App.css'; // Assuming you have some basic CSS in App.css
interface GuestRecorderProps {
  setTranscriptions?: (results: TranscriptionResult[]) => void;
}

const GUEST_WEBSOCKET_URL = 'ws://localhost:3000'; // Or your deployed backend WebSocket URL

const GuestRecorder: React.FC<GuestRecorderProps> = ({ setTranscriptions }) => {
    const [searchParams] = useSearchParams();
    const meetingId = searchParams.get('meetingId') || 'default-meeting';
    const displayName = searchParams.get('displayName') || 'GuestSpeaker'; // Use displayName for user-friendly name
    
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

const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);

const handleTranscription = (result: TranscriptionResult) => {
  setLastTranscription(result.text);
  setTranscripts(prev => {
    const updated = [...prev, result];
    setTranscriptions?.(updated); // Send up to parent if provided
    return updated;
  });

  console.log(`[Guest] Transcription: ${result.speaker}: ${result.text}`);
};


    const handleStatus = (message: string) => {
        setStatus(message);
    };

    const handleError = (error: string) => {
        setStatus(`Error: ${error}`);
        console.error('[Guest] Streamer Error:', error);
        setIsRecording(false);
    };

    const handleStreamEnd = () => {
        setIsRecording(false);
        setStatus('Recording stopped.');
        console.log('[Guest] Stream ended.');
    };

    const startRecording = async () => {
        if (isRecording) return;

        setStatus('Starting...');
        setLastTranscription('');

        // Ensure cleanup if previous streamer instance exists
        if (streamerRef.current) {
            streamerRef.current.stop(); // This will also call cleanup
            streamerRef.current = null;
        }

        streamerRef.current = new MicrophoneStreamer({
            websocketUrl: GUEST_WEBSOCKET_URL,
            meetingId: meetingId,
            proposedSpeakerName: displayName, // Send display name to backend
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
        <div className="guest-recorder-container">
            <h1>Guest Voice Input</h1>
            <p>Meeting ID: <strong>{meetingId}</strong></p>
            <p>Your Display Name: <strong>{displayName}</strong></p>
            <p>Status: <span className={isRecording ? 'status-active' : 'status-idle'}>{status}</span></p>
            
            <div className="button-group">
                <button onClick={startRecording} disabled={isRecording}>
                    Start Recording
                </button>
                <button onClick={stopRecording} disabled={!isRecording}>
                    Stop Recording
                </button>
            </div>
            
            {lastTranscription && (
                <div className="transcription-display">
                    <h3>Last Spoken:</h3>
                    <p>{lastTranscription}</p>
                </div>
            )}
            
            <p className="note">
                Ensure microphone access is granted in your browser. Audio is streamed live for transcription.
            </p>
        </div>
    );
};

export default GuestRecorder;