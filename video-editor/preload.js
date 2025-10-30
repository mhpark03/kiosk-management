const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectVideo: () => ipcRenderer.invoke('select-video'),
  selectAudio: () => ipcRenderer.invoke('select-audio'),
  selectOutput: (defaultName) => ipcRenderer.invoke('select-output', defaultName),

  // Video info
  getVideoInfo: (videoPath) => ipcRenderer.invoke('get-video-info', videoPath),
  generateWaveform: (videoPath) => ipcRenderer.invoke('generate-waveform', videoPath),
  generateWaveformRange: (options) => ipcRenderer.invoke('generate-waveform-range', options),

  // Video operations
  trimVideo: (options) => ipcRenderer.invoke('trim-video', options),
  trimVideoOnly: (options) => ipcRenderer.invoke('trim-video-only', options),
  trimAudioOnly: (options) => ipcRenderer.invoke('trim-audio-only', options),
  trimAudioFile: (options) => ipcRenderer.invoke('trim-audio-file', options),
  addAudio: (options) => ipcRenderer.invoke('add-audio', options),
  adjustAudioVolume: (options) => ipcRenderer.invoke('adjust-audio-volume', options),
  adjustAudioSpeed: (options) => ipcRenderer.invoke('adjust-audio-speed', options),
  applyFilter: (options) => ipcRenderer.invoke('apply-filter', options),
  mergeVideos: (options) => ipcRenderer.invoke('merge-videos', options),
  mergeAudios: (options) => ipcRenderer.invoke('merge-audios', options),
  addText: (options) => ipcRenderer.invoke('add-text', options),
  extractAudio: (options) => ipcRenderer.invoke('extract-audio', options),
  generateSilenceFile: (options) => ipcRenderer.invoke('generate-silence-file', options),
  copyAudioFile: (options) => ipcRenderer.invoke('copy-audio-file', options),
  deleteTempFile: (filePath) => ipcRenderer.invoke('delete-temp-file', filePath),
  ensureVideoHasAudio: (videoPath) => ipcRenderer.invoke('ensure-video-has-audio', videoPath),

  // Progress listener
  onFFmpegProgress: (callback) => {
    ipcRenderer.on('ffmpeg-progress', (event, message) => callback(message));
  },

  // Log listener
  onLogEntry: (callback) => {
    ipcRenderer.on('log-entry', (event, logData) => callback(logData));
  },

  // Mode switch listener
  onModeSwitch: (callback) => {
    ipcRenderer.on('switch-mode', (event, mode) => callback(mode));
  },

  // Shell operations
  openPath: (path) => ipcRenderer.invoke('open-path', path),

  // TTS operations
  generateTtsDirect: (params) => ipcRenderer.invoke('generate-tts-direct', params)
});
