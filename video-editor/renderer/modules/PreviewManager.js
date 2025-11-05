// ============================================================================
// PreviewManager - Unified Preview Management System
// ============================================================================
class PreviewManager {
  constructor() {
    this.elements = {
      video: null,
      audio: null,
      audioPlaceholder: null,
      audioFilename: null,
      image: null,
      placeholder: null,
      textOverlay: null,
      videoInfo: null,
      playBtn: null,
      pauseBtn: null,
      timelineSlider: null,
      currentTimeDisplay: null
    };

    this.currentPreviewType = 'none'; // 'video', 'audio', 'image', 'none'
    this.currentMediaElement = null; // Current playable media element
    this.initialized = false;
  }

  // Initialize - must be called after DOM is ready
  init() {
    if (this.initialized) return;

    this.elements.video = document.getElementById('preview-video');
    this.elements.audio = document.getElementById('preview-audio');
    this.elements.audioPlaceholder = document.getElementById('audio-placeholder');
    this.elements.audioFilename = document.getElementById('audio-filename');
    this.elements.image = document.getElementById('generated-image-preview');
    this.elements.placeholder = document.getElementById('preview-placeholder');
    this.elements.textOverlay = document.getElementById('text-overlay');
    this.elements.videoInfo = document.getElementById('video-info');
    this.elements.playPauseBtn = document.getElementById('play-pause-btn');
    this.elements.timelineSlider = document.getElementById('timeline-slider');
    this.elements.currentTimeDisplay = document.getElementById('current-time');

    // Backward compatibility: keep references to old separate buttons if they exist
    this.elements.playBtn = document.getElementById('play-btn') || this.elements.playPauseBtn;
    this.elements.pauseBtn = document.getElementById('pause-btn') || this.elements.playPauseBtn;

    this.initialized = true;
    console.log('[PreviewManager] Initialized');
  }

  // Hide all preview elements
  hideAll() {
    if (!this.initialized) this.init();

    // Hide and clear video
    if (this.elements.video) {
      this.elements.video.style.display = 'none';
      this.elements.video.pause();
      this.elements.video.src = '';
    }

    // Hide and clear audio
    if (this.elements.audio) {
      this.elements.audio.style.display = 'none';
      this.elements.audio.pause();
      this.elements.audio.src = '';
    }

    // Hide audio placeholder
    if (this.elements.audioPlaceholder) {
      this.elements.audioPlaceholder.style.display = 'none';
    }

    // Hide and clear image
    if (this.elements.image) {
      this.elements.image.style.display = 'none';
      this.elements.image.src = '';
    }

    // Hide text overlay
    if (this.elements.textOverlay) {
      this.elements.textOverlay.style.display = 'none';
    }

    // Hide video info
    if (this.elements.videoInfo) {
      this.elements.videoInfo.style.display = 'none';
    }

    // Hide placeholder
    if (this.elements.placeholder) {
      this.elements.placeholder.style.display = 'none';
    }

    this.currentPreviewType = 'none';
    this.currentMediaElement = null;
  }

  // Show video preview
  showVideo(src, options = {}) {
    if (!this.initialized) this.init();

    this.hideAll();

    if (!this.elements.video) {
      console.error('[PreviewManager] Video element not found');
      return;
    }

    this.elements.video.style.display = 'block';
    this.elements.video.style.width = '100%';
    this.elements.video.style.height = '100%';
    this.elements.video.style.objectFit = options.objectFit || 'contain';
    this.elements.video.src = src;
    this.elements.video.load();

    // Show video info if requested
    if (options.showInfo !== false && this.elements.videoInfo) {
      this.elements.videoInfo.style.display = 'flex';
    }

    this.currentPreviewType = 'video';
    this.currentMediaElement = this.elements.video;

    this.enableControls();
    this.setAudioTrackInteractive(true); // Enable audio track interaction

    console.log('[PreviewManager] Video preview activated');
  }

  // Show audio preview
  showAudio(src, filename = '', options = {}) {
    if (!this.initialized) this.init();

    this.hideAll();

    if (!this.elements.audio) {
      console.error('[PreviewManager] Audio element not found');
      return;
    }

    this.elements.audio.src = src;
    this.elements.audio.load();

    // Show audio placeholder UI
    if (this.elements.audioPlaceholder) {
      this.elements.audioPlaceholder.style.display = 'flex';
      if (filename && this.elements.audioFilename) {
        this.elements.audioFilename.textContent = filename;
      }
    }

    this.currentPreviewType = 'audio';
    this.currentMediaElement = this.elements.audio;

    this.enableControls();
    this.setAudioTrackInteractive(true); // Enable audio track interaction

    console.log('[PreviewManager] Audio preview activated:', filename);
  }

  // Show image preview
  showImage(src, options = {}) {
    if (!this.initialized) this.init();

    this.hideAll();

    if (!this.elements.image) {
      console.error('[PreviewManager] Image element not found');
      return;
    }

    this.elements.image.style.display = 'block';
    this.elements.image.style.width = '100%';
    this.elements.image.style.height = '100%';
    this.elements.image.style.objectFit = options.objectFit || 'contain';
    this.elements.image.src = src;

    this.currentPreviewType = 'image';
    this.currentMediaElement = null; // Images are not playable

    this.disableControls();
    this.setAudioTrackInteractive(false); // Disable audio track interaction for images

    console.log('[PreviewManager] Image preview activated');
  }

  // Show placeholder
  showPlaceholder(message = '영상을 가져와주세요') {
    if (!this.initialized) this.init();

    this.hideAll();

    if (this.elements.placeholder) {
      this.elements.placeholder.style.display = 'flex';
      const placeholderText = this.elements.placeholder.querySelector('p');
      if (placeholderText) {
        placeholderText.textContent = message;
      }
    }

    this.currentPreviewType = 'none';
    this.currentMediaElement = null;

    this.disableControls();
    this.setAudioTrackInteractive(false);

    console.log('[PreviewManager] Placeholder shown');
  }

  // Show text overlay (only works with video)
  showTextOverlay(text, styles = {}) {
    if (this.currentPreviewType !== 'video') return;

    if (this.elements.textOverlay) {
      this.elements.textOverlay.textContent = text;
      this.elements.textOverlay.style.display = 'block';

      // Apply styles
      Object.assign(this.elements.textOverlay.style, styles);
    }
  }

  // Hide text overlay
  hideTextOverlay() {
    if (this.elements.textOverlay) {
      this.elements.textOverlay.style.display = 'none';
    }
  }

  // Playback control - play
  play() {
    if (!this.currentMediaElement) {
      console.warn('[PreviewManager] No playable media element');
      return Promise.reject(new Error('No media to play'));
    }

    return this.currentMediaElement.play();
  }

  // Playback control - pause
  pause() {
    if (!this.currentMediaElement) {
      console.warn('[PreviewManager] No playable media element');
      return;
    }

    this.currentMediaElement.pause();
  }

  // Playback control - seek
  seek(time) {
    if (!this.currentMediaElement || !this.currentMediaElement.duration) {
      console.warn('[PreviewManager] Cannot seek: no media or duration');
      return;
    }

    this.currentMediaElement.currentTime = Math.max(0, Math.min(time, this.currentMediaElement.duration));
  }

  // Get current time
  getCurrentTime() {
    return this.currentMediaElement?.currentTime || 0;
  }

  // Get duration
  getDuration() {
    return this.currentMediaElement?.duration || 0;
  }

  // Check if media can play
  canPlay() {
    return this.currentMediaElement !== null && this.currentMediaElement.readyState >= 2;
  }

  // Get current preview type
  getPreviewType() {
    return this.currentPreviewType;
  }

  // Get current media element
  getMediaElement() {
    return this.currentMediaElement;
  }

  // Enable playback controls
  enableControls() {
    if (this.elements.playBtn) this.elements.playBtn.disabled = false;
    if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = false;
    if (this.elements.timelineSlider) this.elements.timelineSlider.disabled = false;
  }

  // Disable playback controls
  disableControls() {
    if (this.elements.playBtn) this.elements.playBtn.disabled = true;
    if (this.elements.pauseBtn) this.elements.pauseBtn.disabled = true;
    if (this.elements.timelineSlider) this.elements.timelineSlider.disabled = true;
  }

  // Update video info display
  updateVideoInfo(info) {
    if (this.currentPreviewType !== 'video' || !this.elements.videoInfo) return;

    const durationEl = document.getElementById('info-duration');
    const resolutionEl = document.getElementById('info-resolution');
    const fpsEl = document.getElementById('info-fps');
    const sizeEl = document.getElementById('info-size');

    if (durationEl && info.duration) durationEl.textContent = info.duration;
    if (resolutionEl && info.resolution) resolutionEl.textContent = info.resolution;
    if (fpsEl && info.fps) fpsEl.textContent = info.fps + ' fps';
    if (sizeEl && info.size) sizeEl.textContent = info.size + ' MB';

    this.elements.videoInfo.style.display = 'flex';
  }

  // Update play/pause button state
  updatePlayPauseButton(isPlaying) {
    const btn = this.elements.playPauseBtn;
    if (!btn) return;

    if (isPlaying) {
      btn.textContent = '⏸️';
      btn.setAttribute('data-state', 'playing');
      btn.setAttribute('title', '일시정지');
    } else {
      btn.textContent = '▶️';
      btn.setAttribute('data-state', 'paused');
      btn.setAttribute('title', '재생');
    }
  }

  // Check if currently playing
  isPlaying() {
    if (!this.currentMediaElement) return false;
    return !this.currentMediaElement.paused;
  }

  // Enable/disable audio track interaction
  setAudioTrackInteractive(enabled) {
    const audioTrack = document.getElementById('audio-track');
    if (!audioTrack) return;

    if (enabled) {
      audioTrack.style.pointerEvents = 'auto';
      audioTrack.style.cursor = 'pointer';
    } else {
      audioTrack.style.pointerEvents = 'none';
      audioTrack.style.cursor = 'default';
    }
  }
}

// Create global instance
const previewManager = new PreviewManager();

// ============================================================================
// Preview Helper Functions - Wrapper functions for backwards compatibility
// ============================================================================

// Helper: Load audio file in content mode
function loadAudioPreview(src, filename) {
  previewManager.showAudio(src, filename);
}

// Helper: Load image in content mode
function loadImagePreview(src) {
  previewManager.showImage(src);
}

// Helper: Load video in content mode
function loadVideoPreview(src) {
  previewManager.showVideo(src, { showInfo: false });
}

// Helper: Show placeholder
function showPreviewPlaceholder(message) {
  previewManager.showPlaceholder(message);
}

// Helper: Reset preview area
function resetPreviewArea() {
  previewManager.hideAll();
  previewManager.showPlaceholder();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PreviewManager,
    previewManager,
    loadAudioPreview,
    loadImagePreview,
    loadVideoPreview,
    showPreviewPlaceholder,
    resetPreviewArea
  };
}
