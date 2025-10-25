const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Config management
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  checkConfigExists: () => ipcRenderer.invoke('check-config-exists'),
  deleteConfig: () => ipcRenderer.invoke('delete-config'),
  selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),

  // Authentication
  login: (apiUrl, email, password) => ipcRenderer.invoke('login', apiUrl, email, password),

  // Kiosk management
  getKioskByKioskId: (apiUrl, kioskid) => ipcRenderer.invoke('get-kiosk-by-kioskid', apiUrl, kioskid),

  // Video management
  getVideos: (apiUrl, kioskId) => ipcRenderer.invoke('get-videos', apiUrl, kioskId),
  downloadVideo: (params) => ipcRenderer.invoke('download-video', params),
  updateDownloadStatus: (params) => ipcRenderer.invoke('update-download-status', params),

  // File system operations
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openVideoPlayer: (params) => ipcRenderer.invoke('open-video-player', params),

  // Event listeners
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },

  // WebSocket
  connectWebSocket: (apiUrl, kioskId, posId, kioskNo) => ipcRenderer.invoke('websocket-connect', apiUrl, kioskId, posId, kioskNo),
  disconnectWebSocket: () => ipcRenderer.invoke('websocket-disconnect'),
  sendWebSocketStatus: (kioskId, status, details) => ipcRenderer.invoke('websocket-send-status', kioskId, status, details),
  syncViaWebSocket: (kioskId) => ipcRenderer.invoke('websocket-sync', kioskId),
  onWebSocketMessage: (callback) => {
    ipcRenderer.on('websocket-message', (event, data) => callback(data));
  },
  onWebSocketStatus: (callback) => {
    ipcRenderer.on('websocket-status', (event, data) => callback(data));
  }
});

console.log('Preload script loaded - API bridge established');
