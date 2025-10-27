const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectVideo: () => ipcRenderer.invoke('select-video'),
  selectAudio: () => ipcRenderer.invoke('select-audio'),
  selectOutput: (defaultName) => ipcRenderer.invoke('select-output', defaultName),

  // Video info
  getVideoInfo: (videoPath) => ipcRenderer.invoke('get-video-info', videoPath),

  // Video operations
  trimVideo: (options) => ipcRenderer.invoke('trim-video', options),
  addAudio: (options) => ipcRenderer.invoke('add-audio', options),
  applyFilter: (options) => ipcRenderer.invoke('apply-filter', options),
  mergeVideos: (options) => ipcRenderer.invoke('merge-videos', options),
  addText: (options) => ipcRenderer.invoke('add-text', options),
  extractAudio: (options) => ipcRenderer.invoke('extract-audio', options),

  // Progress listener
  onFFmpegProgress: (callback) => {
    ipcRenderer.on('ffmpeg-progress', (event, message) => callback(message));
  },

  // Log listener
  onLogEntry: (callback) => {
    ipcRenderer.on('log-entry', (event, logData) => callback(logData));
  }
});
