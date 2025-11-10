# Kiosk Video Downloader (Flutter)

Flutter-based kiosk video downloader application for Android and Windows. Connects to a Spring Boot backend to download and manage video content for unattended kiosk displays.

## 📱 Features

- **Dual Authentication**: User JWT + Kiosk header-based authentication
- **Real-Time Sync**: WebSocket integration for remote sync commands
- **Auto Token Renewal**: Automatic recovery when WebSocket token expires
- **Unattended Operation**: Designed for 24/7 kiosk environments
- **Video Management**: Download, track, and play videos locally
- **Event Logging**: Comprehensive logging for debugging and auditing
- **Cross-Platform**: Supports Android and Windows
- **🎥 Camera-Based Person Detection**: AI-powered presence detection using ONNX Runtime
  - Automatic kiosk activation when person detected
  - Touch/mouse fallback mode for testing
  - Works on Windows and Android

## 🚀 Quick Start

### Prerequisites
- Flutter SDK 3.0+
- Android Studio / VS Code with Flutter plugin
- Spring Boot backend running (see `../backend`)

### Installation

```bash
# Get dependencies
flutter pub get

# Run on connected device
flutter run

# Build for production
flutter build apk           # Android
flutter build windows       # Windows
```

## 🔐 Authentication System

### Two Types of Tokens

1. **User JWT Token** (Optional)
   - For API authentication
   - Stored in `flutter_secure_storage`
   - Header: `Authorization: Bearer {token}`

2. **Kiosk WebSocket Token** (Required for real-time sync)
   - Separate token for WebSocket connections
   - Issued via `/api/kiosk-auth/token`
   - Requires: `kioskId`, `posId`, `kioskNo`

### Auto Token Renewal 🔄

When WebSocket connection fails (expired token), the app **automatically recovers**:

```
WebSocket Failure → Check Login Status → Call updateKioskConfig()
  → Get New Token → Reconnect WebSocket ✅
```

**Key Benefits:**
- ✅ Automatic recovery when logged in
- ✅ Works on app restart with stale tokens
- ✅ Clear admin notification when login required
- ✅ Manual refresh always available as fallback
- ✅ Uses existing config update endpoint

**When Login Required:**
- Shows dialog: "WebSocket 실시간 연결을 위해서는 로그인이 필요합니다"
- Options: Login now or continue with manual refresh
- Ensures admin intervention for token issues in unattended kiosks

See [CLAUDE.md](./CLAUDE.md#websocket-token-management--auto-renewal) for detailed implementation.

## 📂 Project Structure

```
lib/
├── models/           # Data models (Video, Kiosk, KioskConfig, User)
├── screens/          # UI screens (Login, Settings, VideoList, VideoPlayer)
├── services/         # Business logic
│   ├── api_service.dart          # HTTP client & API calls
│   ├── storage_service.dart      # Local storage & secure token storage
│   ├── download_service.dart     # Video download manager
│   ├── websocket_service.dart    # Real-time WebSocket connection
│   └── event_logger.dart         # Event logging to local files
└── utils/            # Utility classes (DeviceInfoUtil)
```

## 🔧 Configuration

Configure in Settings screen:
- **Server URL**: Backend API endpoint
- **Kiosk ID**: 12-digit unique identifier
- **POS ID**: 8-digit point-of-sale ID
- **Download Path**: Local directory for videos
- **Auto Sync**: Enable/disable automatic sync
- **Sync Interval**: Hours between auto-sync (1-24)

## 📡 Backend Integration

Connects to Spring Boot backend (`../backend`):

**REST API:**
- `POST /api/auth/login` - User authentication
- `GET /api/kiosks/kioskid/{id}` - Fetch kiosk info
- `GET /api/kiosks/by-kioskid/{id}/videos-with-status` - Get video list
- `PATCH /api/kiosks/by-kioskid/{id}/config` - Update config & renew token
- `POST /api/kiosk-auth/token` - Issue WebSocket kiosk token

**WebSocket:**
- Endpoint: `/ws` (SockJS)
- Subscribe: `/topic/kiosk/{kioskId}`
- Receives: Sync commands from admin dashboard

## 📝 Event Logging

Logs all kiosk activities to local files:
- **Location**: `{downloadPath}/logs/events_YYYYMMDD.log`
- **Events**: LOGIN, SYNC, DOWNLOAD, CONFIG updates
- **Format**: `[timestamp] [eventType] message | metadata: {...}`

## 🎥 Person Detection (Windows & Android)

AI-powered presence detection for automatic kiosk activation:

### How It Works

The kiosk operates in two modes:
- **Idle Mode**: Plays fullscreen advertisement videos (menuId == null)
- **Kiosk Mode**: Activates when person detected, shows split-screen menu

### Detection Methods

**1. Camera-Based Detection (Default)**
- Uses ONNX Runtime with SSD MobileNet v2 model
- Real-time person detection from camera feed
- Confidence threshold: 50%
- Detection timeout: 3 seconds
- **Windows Support**: Uses `flutter_lite_camera` (640x480 RGB888)
- **Android Support**: Uses official `camera` plugin (YUV420)

**2. Touch/Mouse Detection (Fallback)**
- Detects screen interaction
- Idle timeout: 30 seconds (configurable)
- Useful for testing without camera

### Technical Implementation

```dart
// Using AutoKioskScreen with camera detection
AutoKioskScreen(
  videos: videos,
  detectionMode: DetectionMode.camera,  // or DetectionMode.touch
  idleTimeout: Duration(seconds: 30),
);
```

**Components:**
- `PersonDetectionService` - ONNX inference engine
- `CameraPresenceDetectionService` - Camera-based wrapper
- `TouchPresenceDetectionService` - Touch/mouse fallback
- `AutoKioskScreen` - Auto-switching UI

**Requirements:**
- ONNX model: `assets/detect.onnx` (29MB, included)
- Camera permission (Android)
- Working webcam (Windows)

### Platform-Specific Notes

**Windows:**
- Uses `flutter_lite_camera` package (pub.dev)
- Image format: RGB888 (no conversion needed)
- Resolution: Fixed 640x480
- Simpler than Android (direct RGB stream)

**Android:**
- Uses official `camera` plugin
- Image format: YUV420 → RGB conversion
- Resolution: Low preset (adaptive)
- Requires camera permission in AndroidManifest.xml

## 🛠️ Development

```bash
# Run in debug mode
flutter run

# Analyze code
flutter analyze

# Format code
flutter format .

# Run tests
flutter test
```

## 📖 Documentation

For detailed architecture, implementation notes, and troubleshooting, see:
- [CLAUDE.md](./CLAUDE.md) - Complete technical documentation

## 📄 License

Copyright © 2025 Kiosk Management System
