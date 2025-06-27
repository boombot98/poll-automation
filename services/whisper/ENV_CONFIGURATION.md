# Whisper Service Environment Configuration

This document explains all the configurable parameters in the Whisper service `.env` file.

## Quick Start - Essential Settings

### 🚀 **Performance vs Accuracy Trade-off**
```env
# Fast response (good for testing)
WHISPER_MODEL_SIZE=tiny
BUFFER_DURATION_SECONDS=1.5

# Balanced (recommended for production)
WHISPER_MODEL_SIZE=small
BUFFER_DURATION_SECONDS=2.0

# High accuracy (slower response)
WHISPER_MODEL_SIZE=medium
BUFFER_DURATION_SECONDS=3.0
```

### 🌍 **Language Settings**
```env
# Auto-detect language (slower)
WHISPER_LANGUAGE=auto

# Specific language (faster, more accurate)
WHISPER_LANGUAGE=en  # English
WHISPER_LANGUAGE=es  # Spanish
WHISPER_LANGUAGE=fr  # French
```

## Model Configuration

| Parameter | Options | Description |
|-----------|---------|-------------|
| `WHISPER_MODEL_SIZE` | tiny, base, small, medium, large-v2, large-v3 | Model size affects speed vs accuracy |
| `WHISPER_DEVICE` | auto, cpu, cuda | Force specific device (auto-detected if not set) |
| `WHISPER_COMPUTE_TYPE` | int8, float16, float32 | Computation precision |

### Model Size Comparison
- **tiny** (~39 MB): Fastest, lowest accuracy - good for testing
- **base** (~74 MB): Good balance for development
- **small** (~244 MB): Recommended for production
- **medium** (~769 MB): High accuracy, slower
- **large-v2/v3** (~1550 MB): Best accuracy, very slow

## Audio Processing

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BUFFER_DURATION_SECONDS` | 2.0 | Audio buffer size - affects latency vs accuracy |
| `SAMPLE_RATE` | 16000 | Audio sample rate (Hz) |
| `BYTES_PER_SAMPLE` | 2 | Audio bit depth (16-bit) |

### Buffer Duration Guidelines
- **1.0-1.5s**: Very fast response, may miss context
- **2.0-2.5s**: Good balance for real-time use
- **3.0-4.0s**: Better accuracy, higher latency

## Transcription Settings

| Parameter | Default | Description |
|-----------|---------|-------------|
| `WHISPER_BEAM_SIZE` | 5 | Search beam size (1-10, higher = more accurate) |
| `WHISPER_WORD_TIMESTAMPS` | true | Enable word-level timing |
| `WHISPER_CONDITION_ON_PREVIOUS_TEXT` | false | Use previous context (can cause repetition) |

## Server Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `WHISPER_HOST` | 127.0.0.1 | Server bind address |
| `WHISPER_PORT` | 8000 | Server port |
| `MAX_CONCURRENT_SESSIONS` | 10 | Maximum simultaneous connections |
| `SESSION_TIMEOUT` | 300 | Session timeout in seconds |

## Logging & Debugging

| Parameter | Options | Description |
|-----------|---------|-------------|
| `LOG_LEVEL` | DEBUG, INFO, WARNING, ERROR | Logging verbosity |
| `DEBUG_MODE` | true/false | Enable debug features |
| `ENABLE_REQUEST_LOGGING` | true/false | Log all requests |

### Debugging Settings
```env
# For troubleshooting
LOG_LEVEL=DEBUG
DEBUG_MODE=true
ENABLE_REQUEST_LOGGING=true

# For production
LOG_LEVEL=INFO
DEBUG_MODE=false
ENABLE_REQUEST_LOGGING=false
```

## Performance Tuning

### For Slow Hardware
```env
WHISPER_MODEL_SIZE=tiny
BUFFER_DURATION_SECONDS=1.5
WHISPER_BEAM_SIZE=1
MAX_CONCURRENT_SESSIONS=3
```

### For High Performance
```env
WHISPER_MODEL_SIZE=small
BUFFER_DURATION_SECONDS=2.0
WHISPER_BEAM_SIZE=5
MAX_CONCURRENT_SESSIONS=20
```

### For Maximum Accuracy
```env
WHISPER_MODEL_SIZE=medium
BUFFER_DURATION_SECONDS=3.0
WHISPER_BEAM_SIZE=10
WHISPER_WORD_TIMESTAMPS=true
```

## Testing & Development

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TEST_MODE` | false | Enable test mode with reduced timeouts |
| `MOCK_TRANSCRIPTION` | false | Return dummy transcriptions for testing |

## Common Configuration Scenarios

### 🧪 **Development/Testing**
```env
WHISPER_MODEL_SIZE=tiny
BUFFER_DURATION_SECONDS=1.5
LOG_LEVEL=DEBUG
DEBUG_MODE=true
TEST_MODE=true
```

### 🏭 **Production**
```env
WHISPER_MODEL_SIZE=small
BUFFER_DURATION_SECONDS=2.0
WHISPER_LANGUAGE=en
LOG_LEVEL=INFO
DEBUG_MODE=false
MAX_CONCURRENT_SESSIONS=20
```

### 🎯 **High Accuracy**
```env
WHISPER_MODEL_SIZE=medium
BUFFER_DURATION_SECONDS=3.0
WHISPER_BEAM_SIZE=10
WHISPER_WORD_TIMESTAMPS=true
```

## Notes

- Changes to model size require service restart
- Buffer duration changes take effect immediately
- Language changes apply to new sessions only
- Performance settings affect memory usage
- Debug mode increases log verbosity significantly
