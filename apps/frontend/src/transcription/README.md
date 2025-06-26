# Frontend Transcription Module

This module contains all transcription-related functionality for the frontend application, including real-time audio capture, streaming, and transcription display.

## Structure

```
apps/frontend/src/transcription/
├── components/           # React components for transcription UI
│   ├── UploadWAV.tsx    # Audio upload and live transcription component
│   ├── TranscriptListener.tsx  # WebSocket transcript listener
│   └── MicSettingsManager.tsx  # Microphone settings and controls
├── utils/               # Utility functions and classes
│   ├── microphoneStream.ts     # MicrophoneStreamer class for audio streaming
│   ├── uploadAndStream.ts      # Audio upload and streaming utilities
│   └── micDeviceManager.ts     # Microphone device management
├── types/               # TypeScript type definitions (if needed)
├── index.ts            # Main module exports
└── README.md           # This file
```

## Components

### UploadWAV
Main component for live transcription functionality. Handles microphone access, audio streaming, and displays transcription results.

### TranscriptListener
WebSocket-based component that listens for transcript updates from the backend and displays them in real-time.

### MicSettingsManager
Component for managing microphone settings, device selection, and audio controls.

## Utils

### MicrophoneStreamer
Core class that handles:
- Microphone access and audio capture
- WebSocket connection to backend
- Audio processing and streaming
- Real-time transcription handling

### uploadAndStream
Utilities for audio file upload and streaming functionality.

### micDeviceManager
Functions for managing microphone devices, selection, and configuration.

## Usage

```typescript
import { UploadWAV, MicrophoneStreamer, TranscriptListener } from '../transcription';

// Use components in your React app
<UploadWAV />
<TranscriptListener />

// Use MicrophoneStreamer for custom implementations
const streamer = new MicrophoneStreamer({
  websocketUrl: 'ws://localhost:3000',
  meetingId: 'meeting123',
  proposedSpeakerName: 'host',
  onTranscription: (result) => console.log(result),
  onStatus: (message) => console.log(message),
  onError: (error) => console.error(error),
  onStreamEnd: () => console.log('Stream ended')
});
```

## Integration

This module integrates with:
- Backend transcription service (`apps/backend/src/transcription`)
- Whisper service (`services/whisper`)
- Shared types (`shared/types`)

## Configuration

The module uses environment variables and configuration from the main app. WebSocket URLs and other settings should be configured at the app level.
