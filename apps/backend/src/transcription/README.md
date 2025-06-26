# Backend Transcription Module

This module handles all transcription-related functionality for the backend, including WebSocket connections, audio streaming, and integration with the Whisper service.

## Structure

```
apps/backend/src/transcription/
├── websocket/           # WebSocket connection and message handling
│   ├── connection.ts    # WebSocket server setup and connection management
│   ├── handlers.ts      # Message handlers for client and Whisper communication
│   └── README.md        # WebSocket-specific documentation
├── services/            # External service integrations
│   └── whisper.ts       # Whisper service integration and communication
├── routes/              # Express routes for transcription endpoints
│   └── index.ts         # Transcription API routes
├── types/               # TypeScript type definitions (if needed)
├── index.ts            # Main module exports
└── README.md           # This file
```

## Components

### WebSocket Module
- **connection.ts**: Manages WebSocket server setup, client connections, and session metadata
- **handlers.ts**: Handles incoming messages from clients and Whisper service responses

### Services
- **whisper.ts**: Manages communication with the Whisper transcription service, including WebSocket forwarding and audio chunk processing

### Routes
- **index.ts**: Express routes for transcription-related HTTP endpoints

## Key Features

1. **Real-time Audio Streaming**: WebSocket-based audio streaming from frontend to Whisper service
2. **Session Management**: Tracks active transcription sessions with meeting IDs and speaker information
3. **Audio Buffering**: Temporary buffering of audio chunks when Whisper service is not ready
4. **Error Handling**: Comprehensive error handling for connection issues and service failures
5. **Heartbeat Monitoring**: WebSocket heartbeat mechanism to detect disconnected clients

## Usage

```typescript
import { setupWebSocketServer } from './transcription';

// Setup WebSocket server
const server = http.createServer(app);
setupWebSocketServer(server);
```

## Integration

This module integrates with:
- Frontend transcription module (`apps/frontend/src/transcription`)
- Whisper service (`services/whisper`)
- Shared types (`shared/types`)

## Configuration

The module uses environment variables for:
- Whisper service URL
- WebSocket configuration
- Audio processing settings

## WebSocket Protocol

The module handles the following message types:
- `start`: Initialize transcription session
- `end`: End transcription session
- Binary audio data: Forward to Whisper service
- Transcription results: Relay from Whisper to client
