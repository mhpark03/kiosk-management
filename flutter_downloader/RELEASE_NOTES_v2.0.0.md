# Flutter Kiosk Downloader v2.0.0

## Features
- Cross-platform kiosk video downloader (Windows & Android)
- Dual authentication: User login + Kiosk headers
- Real-time sync via WebSocket/STOMP
- Background auto-sync support
- Video player with local file playback
- Configurable server URL (Local/AWS)

## Downloads
- **Windows**: Download and extract the ZIP file, then run `flutter_downloader.exe`
- **Android**: Download and install the APK file

## Requirements
- Backend server running (see `../backend`)
- Kiosk configuration (Server URL, Kiosk ID, POS ID)

## Installation

### Windows
1. Download `flutter_downloader_v2.0.0_windows.zip`
2. Extract to any folder
3. Run `flutter_downloader.exe`
4. Configure settings:
   - Server URL (e.g., `http://localhost:8080/api` or AWS URL)
   - Kiosk ID (GUID format)
   - POS ID
   - Download Path (where videos will be saved)

### Android
1. Download `flutter_downloader_v2.0.0.apk`
2. Enable "Install from Unknown Sources" in Android settings
3. Install the APK
4. Open the app and configure settings

## Configuration

First-time setup:
1. Open Settings (⚙️ icon)
2. Enter Server URL
3. Enter Kiosk ID and POS ID
4. Select Download Path
5. Optionally enable Auto-sync
6. Tap "Test Connection" to verify

## Usage

1. **Manual Sync**: Tap the sync button to download latest videos
2. **Auto Sync**: Enable in settings for automatic periodic sync
3. **Video Playback**: Tap any downloaded video to play
4. **Real-time Updates**: App receives push notifications when admin updates video list

🤖 Generated with [Claude Code](https://claude.com/claude-code)
