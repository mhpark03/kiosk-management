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
