# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Flutter-based kiosk video downloader application for Android and Windows. It connects to a Spring Boot backend (located in ../backend) to download and manage video content for kiosk displays. The app supports both user authentication and kiosk-specific authentication via custom headers.

## Development Commands

### Running the App
```bash
# Run on connected device/emulator (default: debug mode)
flutter run

# Run on specific device
flutter devices  # List available devices
flutter run -d <device-id>

# Run in release mode
flutter run --release
```

### Building
```bash
# Build APK (Android)
flutter build apk

# Build app bundle (Android)
flutter build appbundle

# Build for Windows
flutter build windows
```

### Dependencies
```bash
# Get dependencies
flutter pub get

# Upgrade dependencies
flutter pub upgrade

# Check for outdated packages
flutter pub outdated
```

### Testing
```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/<test_file>.dart
```

### Code Analysis
```bash
# Analyze code for issues
flutter analyze

# Format code
flutter format .
```

## Architecture

### Authentication System (Dual-Mode)

The app supports two authentication modes that can work independently or together:

1. **User Authentication** (Optional): JWT token-based auth for admin/management access
   - Token stored securely in `flutter_secure_storage`
   - Added via `Authorization: Bearer <token>` header
   - Handled in `ApiService._dio.interceptors`

2. **Kiosk Authentication** (Required for production): Custom header-based auth for unattended operation
   - Uses three headers: `X-Kiosk-PosId`, `X-Kiosk-Id`, `X-Kiosk-No`
   - Allows app to work without user login
   - Set via `ApiService.setKioskAuth()`
   - Must be configured in Settings screen for kiosk deployment

**Important**: Kiosk auth headers are ALWAYS sent when configured, even if user auth token is also present. This allows both authenticated user management and kiosk operation simultaneously.

### WebSocket Token Management & Auto-Renewal

The app uses a **separate token for WebSocket connections** that differs from the user JWT token:

**Token Types:**
1. **User JWT Token** - For REST API authentication (`Authorization: Bearer {token}`)
2. **Kiosk WebSocket Token** - For WebSocket connection authentication (issued via `/api/kiosk-auth/token`)

**WebSocket Token Flow:**
```
App Start (with existing config)
  ↓
VideoListScreen.initState()
  ↓
_initWebSocket()
  ↓
apiService.getKioskToken(kioskId, posId, kioskNo)
  ↓
WebSocket connects with kiosk token
```

**Auto-Renewal Mechanism (Automatic Token Recovery):**

When WebSocket connection fails (e.g., expired/invalid token), the app automatically attempts recovery:

```dart
// video_list_screen.dart: _initWebSocket() catch block
} catch (e) {
  print('WebSocket: Initialization failed: $e');

  // Auto-recovery: If logged in + config exists, renew token
  if (_isLoggedIn && config.kioskId.isNotEmpty) {
    await _attemptTokenRenewalAndReconnect(config, kiosk);
  }
}
```

**Recovery Process:**
1. Detect WebSocket connection failure
2. Check if user is logged in (authentication available)
3. Call `updateKioskConfig()` API (even if settings unchanged)
4. Backend issues new session token in response
5. Save new token to secure storage
6. Re-request kiosk WebSocket token with fresh session
7. Reconnect WebSocket with new token

**Key Implementation Points:**
- Recovery is **automatic** - no user interaction required
- Only triggers when user is logged in (security consideration)
- Uses existing `updateKioskConfig()` endpoint for token renewal
- Settings screen validation (checking for changes) remains unchanged
- Unattended kiosks benefit from automatic recovery on restart

**Why Separate Tokens?**
- User token: Admin/management operations (optional for kiosk operation)
- Kiosk token: Real-time WebSocket sync (requires kiosk credentials: kioskId, posId, kioskNo)
- WebSocket backend validates token type and rejects user tokens for security

**Backend Endpoints:**
- `/api/kiosk-auth/token` - Issue WebSocket kiosk token (requires kioskId, posId, kioskNo)
- `/api/kiosks/by-kioskid/{id}/config` - Update config & renew session token (PATCH)

**Failure Scenarios:**
- **No login**: Shows "Login Required" dialog with options:
  - "나중에" (Later) - Continue with manual refresh only
  - "로그인" (Login) - Navigate to login screen for admin intervention
  - Dialog clearly explains that admin must login to resolve token issue
  - Manual refresh remains available for unattended operation
- **Network error**: Shows orange notification about connection failure
- **Invalid credentials**: Requires manual settings update
- **Token renewal failed**: Shows orange notification, manual refresh still works

**Unattended Operation Considerations:**
- If WebSocket connection fails without login, dialog appears requiring admin action
- This ensures that token expiration issues in unattended kiosks trigger proper alert
- Admin can visit kiosk, login, and automatic token renewal will resolve the issue
- Kiosk continues to function with manual refresh if admin is unavailable

### Service Layer Architecture

**ApiService** (`services/api_service.dart`):
- Central HTTP client using Dio
- Manages both auth token and kiosk headers via interceptors
- Provides methods for login, video listing, kiosk info fetching
- Base URL can be switched between local dev and AWS servers (see `ServerPresets` in `models/kiosk_config.dart`)

**StorageService** (`services/storage_service.dart`):
- Uses `shared_preferences` for config (server URL, kiosk ID, download path, sync settings)
- Uses `flutter_secure_storage` for auth token
- Singleton pattern - initialize once with `StorageService.init()`

**DownloadService** (`services/download_service.dart`):
- Handles video file downloads with progress tracking
- Uses separate Dio instance (not the ApiService instance)
- Saves files to user-selected directory via `file_picker`
- Progress callbacks: `DownloadProgressCallback(received, total)`

**WebSocketService** (`services/websocket_service.dart`):
- STOMP over SockJS connection to backend `/ws` endpoint
- Subscribes to `/topic/kiosk/{kioskId}` for real-time sync commands
- Auto-reconnect with exponential backoff
- Triggers sync when admin sends command from web dashboard

### Data Flow for Video Downloads

1. User triggers sync (manual button or auto-sync schedule)
2. `ApiService.getKioskVideos(kioskId)` fetches video list from backend
3. For each video:
   - Check if already downloaded via `DownloadService.fileExists()`
   - If not, call `DownloadService.downloadFile()` with S3 URL
   - Update UI with progress via callback
4. Downloaded videos stored in user-configured directory (from Settings)
5. Video player (`video_player` package) plays local files from download directory

### Real-Time Sync via WebSocket

- WebSocket connects on app start if kiosk is configured
- Backend can push sync commands to `/topic/kiosk/{kioskId}`
- App subscribes and triggers immediate sync when command received
- Allows admin to force kiosk refresh from web dashboard without manual intervention

### Configuration Management

All kiosk settings stored in `KioskConfig` model:
- `serverUrl`: Backend API base URL (local or AWS)
- `kioskId`: Unique kiosk identifier (GUID format)
- `posId`: Point-of-sale identifier
- `downloadPath`: Local directory for video storage
- `autoSync`: Enable/disable automatic background sync
- `syncIntervalHours`: How often to auto-sync (default: 12 hours)

Configuration is persisted via `StorageService` and can be updated in Settings screen.

## Android-Specific Notes

### Emulator Localhost Access
- Android emulator cannot access `localhost` or `127.0.0.1` on host machine
- Use `10.0.2.2` instead to reach host's localhost (see `ServerPresets.local`)
- Physical devices require host machine's LAN IP address

### Permissions Required
- `INTERNET`: Network access
- `WRITE_EXTERNAL_STORAGE`: File downloads (Android < 13)
- `READ_EXTERNAL_STORAGE`: File access (Android < 13)
- `MANAGE_EXTERNAL_STORAGE`: Full storage access for kiosk operation (Android 11+)
- Handled by `permission_handler` package

### Download Directory
- **Android**: Uses public Download folder `/storage/emulated/0/Download/KioskVideos`
- **Windows**: Uses `%USERPROFILE%\Downloads\KioskVideos`
- Requires storage permissions on Android (see AndroidManifest.xml)

## Windows-Specific Notes

- Windows builds require Visual Studio 2019 or later with C++ desktop development workload
- No special permissions needed for file downloads
- Uses standard Windows file paths

## Backend Integration

This app connects to a Spring Boot backend at `../backend`. Key endpoints:

- `POST /api/auth/login`: User authentication (returns JWT)
- `GET /api/kiosks/{kioskId}`: Fetch kiosk info and assigned video list
- `GET /api/kiosks/{kioskId}/videos`: Get videos for specific kiosk
- WebSocket: `/ws` (SockJS) → Subscribe to `/topic/kiosk/{kioskId}`

Backend uses MySQL database and serves video files from S3. The backend must be running for the app to function.

## State Management

Currently uses basic `setState()` pattern. The app passes `ApiService` and `StorageService` instances down through widget tree (constructor injection). For future scalability, consider migrating to Provider or Riverpod for global state management.

## Key Dependencies

- `dio`: HTTP client for API calls and downloads
- `stomp_dart_client`: WebSocket/STOMP client for real-time sync
- `video_player`: Video playback
- `file_picker`: Directory selection for downloads
- `shared_preferences`: Local config storage
- `flutter_secure_storage`: Secure token storage
- `permission_handler`: Android permissions
- `path_provider`: Platform-specific paths
- `workmanager`: Background sync tasks (auto-sync feature)

## Common Development Workflow

1. Start backend server: `cd ../backend && ./gradlew.bat bootRun`
2. Update `ServerPresets.local` if using different localhost port
3. Run Flutter app: `flutter run`
4. Configure kiosk in Settings screen (server URL, kiosk ID, POS ID, download path)
5. Test sync: Tap sync button or wait for auto-sync
6. Verify WebSocket connection in logs: Look for "WebSocket: Connected"

## Platform-Specific File Paths

- **Android**: Use `getExternalStorageDirectory()` or user-selected path via file picker
- **Windows**: Standard Windows paths (e.g., `C:\Videos\Kiosk`)
- Always use `Platform.pathSeparator` for cross-platform compatibility

## Event Logging System

The Flutter app implements **dual event logging** to synchronize with backend database events:

### Local File Logging
- **Service**: `EventLogger` (`services/event_logger.dart`)
- **Location**: `{downloadPath}/logs/events_YYYYMMDD.log`
- **Format**: `[timestamp] [eventType] message | metadata: {...}`
- **Singleton pattern**: Initialize once with `EventLogger().initialize(downloadPath)`

### Synchronized Events
The app logs the same events that the backend records in the `kiosk_events` table:

**Connection Events:**
- `USER_LOGIN` - User authentication success (api_service.dart:105-110)
- `KIOSK_CONNECTED` - Kiosk connection established (api_service.dart:245-250)
- `USER_LOGOUT` - User logout (settings_screen.dart:284-296)

**Synchronization Events:**
- `SYNC_STARTED` - Video sync initiated (api_service.dart:150-153)
- `SYNC_COMPLETED` - Video sync finished (api_service.dart:164-169)

**Configuration Events:**
- `CONFIG_READ` - Configuration retrieved from server (api_service.dart:372-387)
- `CONFIG_SAVED` - Configuration saved to server (api_service.dart:326-358)

**Download Events:**
- `DOWNLOAD_STARTED` - Video download begins (api_service.dart:431-432)
- `DOWNLOAD_COMPLETED` - Video download finishes (api_service.dart:435-436)
- `DOWNLOAD_FAILED` - Video download fails (api_service.dart:439-440)

### Event Metadata
Events include contextual information:
- User email and role for authentication events
- Session version and expiration for connection events
- Video count for sync events
- Config settings for configuration events
- Video ID and status for download events

### Troubleshooting with Logs
- Compare local event logs with backend `kiosk_events` table for debugging
- Check event timestamps to identify network or timing issues
- Verify event metadata matches between client and server
- Log files rotate daily for manageable file sizes

## Device Information Tracking

The app automatically sends device information to the backend via HTTP headers:

**Headers Added:**
- `X-Device-OS` - Operating system type (Windows, Android, iOS, etc.)
- `X-Device-Version` - OS version string
- `X-Device-Name` - Device hostname or computer name

**Implementation:**
- `DeviceInfoUtil` (`utils/device_info_util.dart`) - Utility class for device detection
- Headers automatically added in `ApiService` Dio interceptor (api_service.dart:47-50)
- Backend stores device info in Kiosk entity (`osType`, `osVersion`, `deviceName` fields)
- Device info included in KIOSK_CONNECTED event metadata

**Platform-Specific Detection:**
- **Windows**: Uses `Platform.environment['COMPUTERNAME']` or `Platform.localHostname`
- **Android**: Uses `Platform.localHostname` or environment variables
- **Fallback**: Returns "Unknown" or "Unknown Device" if detection fails

## Person Detection System (Windows & Android)

### Overview

The kiosk supports camera-based person detection for automatic mode switching:
- **Idle Mode**: Fullscreen advertisement videos when no one is present
- **Kiosk Mode**: Split-screen menu interface when person detected

### Architecture

**Service Layer:**
```
PresenceDetectionService (Abstract Interface)
  ├── CameraPresenceDetectionService
  │   └── PersonDetectionService (ONNX Runtime)
  └── TouchPresenceDetectionService (Fallback)
```

**Key Files:**
- `lib/services/person_detection_service.dart` (409 lines) - ONNX inference engine
- `lib/services/presence_detection_service.dart` (152 lines) - Abstraction layer
- `lib/screens/auto_kiosk_screen.dart` - UI controller with detection mode switching

### PersonDetectionService Implementation

**ONNX Runtime Integration:**
- Model: SSD MobileNet v2 from COCO dataset
- Input: 1200x1200 RGB image in NCHW format (1, 3, 1200, 1200)
- Output: Bounding boxes [1, N, 4], Labels [1, N], Scores [1, N]
- Confidence threshold: 0.5
- Person class index: 1 (COCO dataset)

**Detection Flow:**
```dart
1. Camera captures frame (CameraImage)
2. Convert to RGB:
   - Android: YUV420 → RGB (_convertYUV420ToImage)
   - Windows/iOS: BGRA8888 → RGB (_convertBGRA8888ToImage)
3. Resize to 1200x1200
4. Convert to NCHW tensor format [1, 3, H, W]
5. Normalize pixels to [0, 1] range
6. Run ONNX inference
7. Parse outputs for person detections (class=1, score>=0.5)
8. Emit detection event if person found
```

**Memory Management:**
```dart
// Frame skipping to prevent memory overload
bool _isProcessing = false;

void _processImageAsync(CameraImage image) {
  if (!_isDetecting || _isProcessing) return;
  _isProcessing = true;

  _detectPersonONNX(image).then((detected) {
    // Handle detection result
    _isProcessing = false;
  });
}

// Resource cleanup
Future<void> dispose() async {
  await stopDetection();
  await _cameraController?.dispose();
  _ortSession?.release();
  _sessionOptions?.release();
}
```

**Threading:**
- Camera image stream runs on separate isolate (camera plugin)
- ONNX inference is asynchronous (returns Future)
- Frame processing uses async callbacks to avoid blocking UI thread
- Detection interval: 500ms (controlled by image stream rate)

**Timeout Handling:**
```dart
// Detection timeout: 3 seconds
Timer? _timeoutTimer;

void _checkDetectionTimeout() {
  final timeSinceDetection = DateTime.now().difference(_lastDetectionTime!);

  if (timeSinceDetection > Duration(seconds: 3) && _personPresent) {
    _personPresent = false;
    _personDetectedController.add(false);
  }
}
```

### Platform-Specific Camera Integration

**Windows:**
- **Challenge**: Official `camera` plugin's `startImageStream()` doesn't support Windows
- **Solution**: Uses `flutter_lite_camera` package (lightweight, published on pub.dev)
- **pubspec.yaml:**
```yaml
flutter_lite_camera: ^0.0.2
```
- **Image format**: RGB888 (3 bytes per pixel, already in RGB)
- **Resolution**: Fixed 640x480 (optimized for performance)
- **Data stream**: Direct Uint8List stream (no CameraImage conversion needed)
- **API**: `FlutterLiteCamera.startCamera()` returns `Stream<Uint8List>`

**Android:**
- Uses official `camera` plugin (works out of the box)
- **Image format**: YUV420 (multi-plane format, memory efficient)
- **Conversion complexity**: Higher due to YUV color space math
- **API**: `CameraController.startImageStream()` with `CameraImage`

**Image Conversion Details:**

*YUV420 → RGB (Android):*
```dart
// YUV420 has 3 planes: Y (luminance), U (chrominance), V (chrominance)
final int uvRowStride = image.planes[1].bytesPerRow;
final int uvPixelStride = image.planes[1].bytesPerPixel ?? 1;

// Color space conversion formulas
int r = (yp + vp * 1436 / 1024 - 179).round().clamp(0, 255);
int g = (yp - up * 46549 / 131072 + 44 - vp * 93604 / 131072 + 91).round().clamp(0, 255);
int b = (yp + up * 1814 / 1024 - 227).round().clamp(0, 255);
```

*RGB888 → img.Image (Windows):*
```dart
// flutter_lite_camera provides 640x480 RGB888
// 3 bytes per pixel: R, G, B (already in correct format)
const int width = 640;
const int height = 480;

final image = img.Image(width: width, height: height);
for (int y = 0; y < height; y++) {
  for (int x = 0; x < width; x++) {
    final int index = (y * width + x) * 3;
    final int r = rgb888Data[index];
    final int g = rgb888Data[index + 1];
    final int b = rgb888Data[index + 2];
    image.setPixelRgb(x, y, r, g, b);
  }
}
// No color space conversion needed - much simpler than YUV420!
```

**Platform-Specific Implementation:**

*Windows (flutter_lite_camera):*
```dart
// Initialize camera
_liteCamera = FlutterLiteCamera();
final devices = await _liteCamera!.getDeviceList();
await _liteCamera!.open(0);  // Open first camera

// Start detection with Timer (polling approach)
_captureTimer = Timer.periodic(Duration(milliseconds: 500), (_) async {
  final rgb888Data = await _liteCamera!.captureFrame();
  if (rgb888Data != null) {
    _processRGB888Async(rgb888Data);
  }
});

// Stop detection
_captureTimer?.cancel();
await _liteCamera?.release();
```

**Note**: flutter_lite_camera uses **polling** (Timer + captureFrame) not streaming, as the package doesn't provide a continuous stream API.

*Android (camera package):*
```dart
// Initialize camera
_cameraController = CameraController(camera, ResolutionPreset.low, ...);
await _cameraController!.initialize();

// Start image stream (true streaming)
await _cameraController!.startImageStream((CameraImage image) {
  _processImageAsync(image);
});

// Stop image stream
await _cameraController?.stopImageStream();
```

### AutoKioskScreen Integration

**Detection Mode Selection:**
```dart
enum DetectionMode {
  touch,  // Touch/mouse based detection
  camera, // Camera-based person detection
}

AutoKioskScreen(
  videos: videos,
  detectionMode: DetectionMode.camera,  // Default
  idleTimeout: Duration(seconds: 30),   // For touch mode
);
```

**Mode Switching:**
```dart
// Listen to presence changes
_presenceSubscription = _presenceService.presenceStream.listen((isPresent) {
  setState(() {
    _isKioskMode = isPresent;  // true = kiosk, false = idle
  });
});

// UI updates
Widget build(BuildContext context) {
  return AnimatedSwitcher(
    duration: Duration(milliseconds: 500),
    child: _isKioskMode ? KioskSplitScreen() : IdleScreen(),
  );
}
```

**Video Filtering:**
```dart
// Advertisement videos for idle screen (menuId == null)
_advertisementVideos = widget.videos.where((v) => v.menuId == null).toList();

// All videos for kiosk mode (including menu item videos)
_allVideos = widget.videos;
```

### Assets Required

**ONNX Model:**
- File: `assets/detect.onnx` (29MB)
- Model type: SSD MobileNet v2
- Dataset: COCO (80 classes, person = class 1)
- Downloaded from: ONNX Model Zoo or converted from TensorFlow

**Label Map:**
- File: `assets/labelmap.txt` (665 bytes)
- Format: One class name per line
- Line 1 = class 0, line 2 = class 1 (person), etc.

**pubspec.yaml:**
```yaml
flutter:
  assets:
    - assets/coffee_menu.xml
    - assets/detect.onnx      # ONNX model for person detection
    - assets/labelmap.txt     # Class labels for COCO dataset
```

### Performance Considerations

**Optimization Strategies:**
1. **Low resolution camera preset** - Reduces image size before processing
2. **Frame skipping** - Only process one frame at a time (_isProcessing flag)
3. **Async processing** - Non-blocking inference execution
4. **Resource pooling** - Reuse ONNX session across frames
5. **Early exit** - Stop checking detections once person found

**Expected Performance:**
- **Windows** (i5-8250U, integrated GPU):
  - Inference time: ~200-300ms per frame
  - FPS: ~2-3 frames per second
  - Detection latency: <1 second
- **Android** (mid-range phone):
  - Inference time: ~150-250ms per frame
  - FPS: ~3-4 frames per second
  - Detection latency: <1 second

**Memory Usage:**
- ONNX model: ~29MB (loaded once at startup)
- Camera frames: ~2-3MB per frame (transient, released after processing)
- Total overhead: ~35-40MB

### Troubleshooting

**Camera not working on Windows:**
1. Check webcam is connected and working in Windows Camera app
2. Verify camera permissions (Windows 10/11 Settings → Privacy → Camera)
3. Check if camera is already in use by another application
4. Try restarting the app or system

**Person detection not triggering:**
1. Check console logs: `[PERSON DETECTION] Person detected with confidence: XX%`
2. Ensure adequate lighting (ONNX model trained on well-lit images)
3. Try adjusting confidence threshold (currently 0.5 = 50%)
4. Verify ONNX model is loaded: `[PERSON DETECTION] ONNX model loaded successfully`

**High CPU usage:**
1. Reduce camera resolution in PersonDetectionService (currently ResolutionPreset.low)
2. Increase detection interval (_detectionInterval, currently 500ms)
3. Use touch detection mode instead of camera mode for development

**Build errors after updating pubspec.yaml:**
```bash
# Clear Flutter cache and rebuild
flutter clean
flutter pub get
flutter build windows  # or flutter run
```
