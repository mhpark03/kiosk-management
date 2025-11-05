/**
 * PreviewHelpers.js
 * 비디오 및 오디오 미리보기 관련 헬퍼 함수
 *
 * @module PreviewHelpers
 */

// ============================================================================
// Preview Control
// ============================================================================

/**
 * Jump to specific time in media
 * @param {number} time - Time in seconds
 * @param {string} mode - 'video' or 'audio'
 */
export function seekToTime(time, mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.currentTime = time;
    console.log(`[PreviewHelpers] Seeked to ${time}s in ${mode}`);
  }
}

/**
 * Play media
 * @param {string} mode - 'video' or 'audio'
 */
export function playMedia(mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.play();
  }
}

/**
 * Pause media
 * @param {string} mode - 'video' or 'audio'
 */
export function pauseMedia(mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.pause();
  }
}

/**
 * Preview time range
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {string} mode - 'video' or 'audio'
 * @param {Function} onComplete - Callback when preview completes
 */
export function previewTimeRange(startTime, endTime, mode = 'video', onComplete = null) {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (!element) {
    console.error(`[PreviewHelpers] ${mode} element not found`);
    return;
  }

  // Set start time
  element.currentTime = startTime;

  // Play
  element.play();

  // Stop at end time
  const checkTime = () => {
    if (element.currentTime >= endTime) {
      element.pause();
      element.removeEventListener('timeupdate', checkTime);

      if (onComplete) {
        onComplete();
      }
    }
  };

  element.addEventListener('timeupdate', checkTime);

  console.log(`[PreviewHelpers] Previewing ${mode} from ${startTime}s to ${endTime}s`);
}

/**
 * Stop preview and return to start
 * @param {number} returnTime - Time to return to (default: 0)
 * @param {string} mode - 'video' or 'audio'
 */
export function stopPreview(returnTime = 0, mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.pause();
    element.currentTime = returnTime;
  }
}

// ============================================================================
// Volume Control
// ============================================================================

/**
 * Set media volume
 * @param {number} volume - Volume level (0.0 - 1.0)
 * @param {string} mode - 'video' or 'audio'
 */
export function setVolume(volume, mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Mute/unmute media
 * @param {boolean} muted - Whether to mute
 * @param {string} mode - 'video' or 'audio'
 */
export function setMuted(muted, mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.muted = muted;
  }
}

// ============================================================================
// Playback State
// ============================================================================

/**
 * Get current playback time
 * @param {string} mode - 'video' or 'audio'
 * @returns {number} Current time in seconds
 */
export function getCurrentTime(mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  return element ? element.currentTime : 0;
}

/**
 * Get media duration
 * @param {string} mode - 'video' or 'audio'
 * @returns {number} Duration in seconds
 */
export function getDuration(mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  return element ? element.duration : 0;
}

/**
 * Check if media is playing
 * @param {string} mode - 'video' or 'audio'
 * @returns {boolean}
 */
export function isPlaying(mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  return element ? !element.paused : false;
}

// ============================================================================
// Frame Control (Video Only)
// ============================================================================

/**
 * Step forward one frame (approximately)
 * @param {number} fps - Frames per second (default: 30)
 */
export function stepFrameForward(fps = 30) {
  const video = document.getElementById('preview-video');
  if (video) {
    const frameDuration = 1 / fps;
    video.currentTime = Math.min(video.currentTime + frameDuration, video.duration);
  }
}

/**
 * Step backward one frame (approximately)
 * @param {number} fps - Frames per second (default: 30)
 */
export function stepFrameBackward(fps = 30) {
  const video = document.getElementById('preview-video');
  if (video) {
    const frameDuration = 1 / fps;
    video.currentTime = Math.max(video.currentTime - frameDuration, 0);
  }
}

// ============================================================================
// Snapshot
// ============================================================================

/**
 * Capture current frame as image
 * @param {number} width - Output width (default: video width)
 * @param {number} height - Output height (default: video height)
 * @returns {string|null} Base64 image data URL
 */
export function captureFrame(width = null, height = null) {
  const video = document.getElementById('preview-video');
  if (!video) {
    console.error('[PreviewHelpers] Video element not found');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width || video.videoWidth;
  canvas.height = height || video.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

// ============================================================================
// Loop Control
// ============================================================================

/**
 * Set media loop
 * @param {boolean} loop - Whether to loop
 * @param {string} mode - 'video' or 'audio'
 */
export function setLoop(loop, mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (element) {
    element.loop = loop;
  }
}

/**
 * Loop time range (custom loop between two points)
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {string} mode - 'video' or 'audio'
 * @returns {Function} Cleanup function to stop looping
 */
export function loopTimeRange(startTime, endTime, mode = 'video') {
  const elementId = mode === 'video' ? 'preview-video' : 'preview-audio';
  const element = document.getElementById(elementId);

  if (!element) {
    console.error(`[PreviewHelpers] ${mode} element not found`);
    return () => {};
  }

  // Set initial position
  element.currentTime = startTime;
  element.play();

  // Loop logic
  const loopHandler = () => {
    if (element.currentTime >= endTime) {
      element.currentTime = startTime;
    }
  };

  element.addEventListener('timeupdate', loopHandler);

  // Return cleanup function
  return () => {
    element.removeEventListener('timeupdate', loopHandler);
    element.pause();
  };
}
