# Kiosk Event Recording Implementation Plan

## Status
- Backend: COMPLETE - KioskEvent entity, repository, service, controller all created
- Frontend: PARTIAL - recordKioskEvent() function added, APP_START event added

## Additional Event Calls to Add

### 1. Authentication Events (renderer/app.js)

#### handleLogin() - Line ~1140
After successful login:
```javascript
recordKioskEvent('USER_LOGIN', `User logged in: ${currentUser.name}`);
```

#### handleLogout() - Line ~1167
After logout:
```javascript
recordKioskEvent('USER_LOGOUT', 'User logged out');
```

### 2. Configuration Events (renderer/app.js)

#### saveConfig() - Line ~480
After successful config save:
```javascript
if (configExists) {
  recordKioskEvent('CONFIG_SAVED', 'Configuration updated');
} else {
  recordKioskEvent('CONFIG_SAVED', 'New configuration saved');
}
```

#### deleteConfig() - Line ~280
After successful config deletion:
```javascript
recordKioskEvent('CONFIG_DELETED', 'Configuration deleted');
```

### 3. Connection Test Events (renderer/app.js)

#### testConnection() - Line ~518-524
After connection test:
```javascript
if (result.success) {
  updateConnectionStatus(true);
  recordKioskEvent('CONNECTION_SUCCESS', 'Connection test successful');
  showNotification('연결 성공!', 'success');
} else {
  updateConnectionStatus(false);
  recordKioskEvent('CONNECTION_FAILED', `Connection test failed: ${result.error}`);
  showNotification('연결 실패: ' + result.error, 'error');
}
```

### 4. Sync Events (renderer/app.js)

#### syncVideos() - Line ~560, ~620, ~635
After sync completion:
```javascript
if (result.success) {
  // ... existing code ...
  
  if (!isAutoSync) {
    recordKioskEvent('SYNC_COMPLETED', `Synced ${videos.length} videos`);
    showNotification(`${videos.length}개의 영상을 동기화했습니다.`, 'success');
  } else {
    recordKioskEvent('AUTO_SYNC_TRIGGERED', `Auto-sync completed: ${videos.length} videos`);
  }
} else {
  updateConnectionStatus(false);
  recordKioskEvent('SYNC_FAILED', `Sync failed: ${result.error}`);
  // ... rest of error handling ...
}
```

Before sync starts (line ~536):
```javascript
if (!isAutoSync) {
  recordKioskEvent('SYNC_STARTED', 'Manual video sync initiated');
}
```

### 5. Download Events (renderer/app.js)

#### downloadVideo() - Line ~755, ~760
After download completion/failure:
```javascript
if (result.success) {
  video.downloadStatus = 'COMPLETED';
  video.progress = 100;
  
  await window.electronAPI.updateDownloadStatus({...});
  
  recordKioskEvent('DOWNLOAD_COMPLETED', `Download completed: ${video.title}`, JSON.stringify({
    videoId: video.videoId,
    fileName: fileName
  }));
  
  showNotification(`${video.title} 다운로드 완료`, 'success');
} else {
  video.downloadStatus = 'PENDING';
  video.progress = 0;
  
  recordKioskEvent('DOWNLOAD_FAILED', `Download failed: ${video.title}`, JSON.stringify({
    videoId: video.videoId,
    error: result.error
  }));
  
  showNotification(`다운로드 실패: ${result.error}`, 'error');
}
```

Before download starts (line ~732):
```javascript
video.downloadStatus = 'DOWNLOADING';
video.progress = 0;
recordKioskEvent('DOWNLOAD_STARTED', `Download started: ${video.title}`, JSON.stringify({
  videoId: video.videoId,
  fileName: fileName
}));
renderVideoList();
```

#### deleteVideo() - Line ~815
After file deletion:
```javascript
if (result.success) {
  video.downloadStatus = 'PENDING';
  video.progress = 0;
  
  await window.electronAPI.updateDownloadStatus({...});
  
  recordKioskEvent('FILE_DELETED', `File deleted: ${video.title}`, JSON.stringify({
    videoId: video.videoId,
    fileName: fileName
  }));
  
  renderVideoList();
  updateStats();
  showNotification('영상이 삭제되었습니다.', 'success');
}
```

### 6. Background Download Events

#### downloadVideoInBackground() - Line ~695, ~699
Similar to downloadVideo() but for background downloads:
```javascript
if (result.success) {
  video.downloadStatus = 'COMPLETED';
  video.progress = 100;
  
  await window.electronAPI.updateDownloadStatus({...});
  
  recordKioskEvent('DOWNLOAD_COMPLETED', `Background download completed: ${video.title}`, JSON.stringify({
    videoId: video.videoId,
    fileName: fileName,
    background: true
  }));
  
  console.log(`Background download completed: ${video.title}`);
} else {
  video.downloadStatus = 'PENDING';
  video.progress = 0;
  
  recordKioskEvent('DOWNLOAD_FAILED', `Background download failed: ${video.title}`, JSON.stringify({
    videoId: video.videoId,
    error: result.error,
    background: true
  }));
  
  console.error(`Background download failed: ${video.title} - ${result.error}`);
}
```

## Implementation Notes

1. All event recording calls are wrapped in try-catch within the recordKioskEvent() function
2. Events will only be recorded if config.kioskId and config.apiUrl are set
3. The metadata parameter (3rd argument) should be JSON string for complex data
4. User info (email, name) is automatically added from currentUser if available
5. Events are fire-and-forget - failures don't block the UI

## Testing

After adding all event calls, test by:
1. Refreshing a kiosk-downloader instance (F5)
2. Performing various actions (login, config save, sync, download)
3. Checking events in database: `curl http://localhost:8080/api/kiosk-events | jq`
4. Or via UI: `curl http://localhost:8080/api/kiosk-events/kiosk/000000000009 | jq`

## Database Query Examples

```bash
# Get all events
curl http://localhost:8080/api/kiosk-events

# Get events for specific kiosk
curl http://localhost:8080/api/kiosk-events/kiosk/000000000009

# Get recent events (last 50)
curl http://localhost:8080/api/kiosk-events/kiosk/000000000009/recent

# Get events by type
curl http://localhost:8080/api/kiosk-events/type/DOWNLOAD_COMPLETED

# Count events for kiosk
curl http://localhost:8080/api/kiosk-events/kiosk/000000000009/count
```
