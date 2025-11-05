/**
 * WaveformManager.js
 * 오디오 웨이브폼 생성, 표시, 줌 관리
 *
 * @module WaveformManager
 */

// ============================================================================
// State (passed from app.js)
// ============================================================================

let waveformRegenerateTimer = null;
let isRegeneratingWaveform = false;
let isWaveformRegenerated = false;

// ============================================================================
// Waveform Generation
// ============================================================================

/**
 * Generate and display audio waveform
 * @param {string} videoPath - Video or audio file path
 * @param {object} videoInfo - Video/audio information
 * @param {boolean} hasSilentAudio - Whether video has auto-generated silent audio
 * @param {Function} updateStatus - Status update callback
 * @returns {Promise<boolean>} Success status
 */
export async function generateAndDisplayWaveform(videoPath, videoInfo, hasSilentAudio, updateStatus) {
  try {
    const waveformImg = document.getElementById('audio-waveform');
    if (!waveformImg) {
      console.error('[WaveformManager] Waveform image element not found');
      return false;
    }

    // Check if video has audio stream
    const audioStream = videoInfo.streams.find(s => s.codec_type === 'audio');
    if (!audioStream) {
      console.log('[WaveformManager] No audio stream found, skipping waveform generation');
      waveformImg.style.display = 'none';

      // Also hide silent audio indicator
      const silentIndicator = document.getElementById('silent-audio-indicator');
      if (silentIndicator) {
        silentIndicator.style.display = 'none';
      }
      return false;
    }

    console.log('[WaveformManager] Generating waveform...');
    updateStatus('오디오 파형 생성 중...');

    // Reset regenerated flag when loading new waveform
    isWaveformRegenerated = false;

    const base64Image = await window.electronAPI.generateWaveform(videoPath);

    if (base64Image) {
      // Display the waveform image (base64 format)
      console.log('[WaveformManager] Setting waveform src (base64, length:', base64Image.length, ')');

      waveformImg.onload = () => {
        console.log('[WaveformManager] Waveform image loaded successfully');
        console.log('Image dimensions:', waveformImg.naturalWidth, 'x', waveformImg.naturalHeight);
      };

      waveformImg.onerror = (e) => {
        console.error('[WaveformManager] Failed to load waveform image:', e);
      };

      waveformImg.src = base64Image;
      waveformImg.style.display = 'block';
      console.log('[WaveformManager] Waveform displayed successfully');
      updateStatus('오디오 파형 생성 완료');

      // Show channel labels if stereo (2 channels)
      const channelLabels = document.getElementById('channel-labels');
      if (channelLabels) {
        channelLabels.style.display = audioStream.channels === 2 ? 'flex' : 'none';
      }

      // Show/hide silent audio indicator
      const silentIndicator = document.getElementById('silent-audio-indicator');
      if (silentIndicator) {
        silentIndicator.style.display = hasSilentAudio ? 'block' : 'none';
        if (hasSilentAudio) {
          console.log('[WaveformManager] Showing silent audio indicator');
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('[WaveformManager] Failed to generate waveform:', error);
    updateStatus('오디오 파형 생성 실패 (계속 진행...)');
    // Don't throw error - continue loading video even if waveform fails
    return false;
  }
}

// ============================================================================
// Waveform Zoom
// ============================================================================

/**
 * Apply zoom transform to waveform image (immediate, for smooth interaction)
 * @param {number} zoomStart - Zoom start position (0-1)
 * @param {number} zoomEnd - Zoom end position (0-1)
 * @param {Function} updatePlayheadPosition - Playhead update callback
 * @param {Function} updateZoomRangeOverlay - Zoom overlay update callback
 */
export function applyWaveformZoom(zoomStart, zoomEnd, updatePlayheadPosition, updateZoomRangeOverlay) {
  const waveformImg = document.getElementById('audio-waveform');
  const audioTrack = document.getElementById('audio-track');

  if (!waveformImg || !audioTrack) {
    console.error('[WaveformManager] Waveform image or audio track element not found!');
    return;
  }

  const zoomRange = zoomEnd - zoomStart;

  console.log(`[WaveformManager] Zoom: start=${(zoomStart*100).toFixed(1)}%, end=${(zoomEnd*100).toFixed(1)}%, range=${(zoomRange*100).toFixed(1)}%`);

  // Update playhead position after zoom
  const video = document.getElementById('preview-video');
  const audio = document.getElementById('preview-audio');
  const mediaElement = video || audio;

  if (mediaElement && mediaElement.duration) {
    updatePlayheadPosition(mediaElement.currentTime, mediaElement.duration);
  }

  // Update zoom range overlay on timeline slider
  updateZoomRangeOverlay();

  // Directly regenerate waveform for zoomed range (debounced)
  applyWaveformZoomDebouncedInternal(zoomStart, zoomEnd);
}

/**
 * Regenerate waveform for zoomed range (debounced)
 * @param {number} zoomStart - Zoom start position (0-1)
 * @param {number} zoomEnd - Zoom end position (0-1)
 * @param {string} videoPath - Current video/audio path
 * @param {object} videoInfo - Video/audio information
 * @returns {Promise<void>}
 */
async function applyWaveformZoomDebouncedInternal(zoomStart, zoomEnd, videoPath, videoInfo) {
  // Clear existing timer
  if (waveformRegenerateTimer) {
    clearTimeout(waveformRegenerateTimer);
  }

  // Set new timer for 300ms delay (faster response)
  waveformRegenerateTimer = setTimeout(async () => {
    // Don't regenerate if already in progress
    if (isRegeneratingWaveform) {
      console.log('[WaveformManager] Regeneration already in progress, skipping...');
      return;
    }

    // Don't regenerate if not zoomed or if zoom range is invalid
    const zoomRange = zoomEnd - zoomStart;
    if (zoomRange >= 0.99 || zoomRange <= 0) {
      console.log('[WaveformManager] Not zoomed or invalid range, skipping regeneration');
      return;
    }

    if (!videoPath) {
      console.log('[WaveformManager] No video/audio loaded, skipping regeneration');
      return;
    }

    const duration = videoInfo?.format?.duration;
    if (!duration) {
      console.log('[WaveformManager] No duration info, skipping regeneration');
      return;
    }

    try {
      isRegeneratingWaveform = true;

      // Save the zoom range we're generating for
      const savedZoomStart = zoomStart;
      const savedZoomEnd = zoomEnd;

      const startTime = zoomStart * duration;
      const rangeDuration = zoomRange * duration;

      console.log(`[WaveformManager] Regenerating waveform for range ${startTime.toFixed(2)}s - ${(startTime + rangeDuration).toFixed(2)}s`);

      // Generate waveform for the zoomed range
      const base64Image = await window.electronAPI.generateWaveformRange({
        videoPath: videoPath,
        startTime: startTime,
        duration: rangeDuration
      });

      // Check if zoom range has changed during generation
      if (savedZoomStart !== zoomStart || savedZoomEnd !== zoomEnd) {
        console.log(`[WaveformManager] Zoom range changed during generation, discarding result`);
        return; // Discard this result, newer generation will take over
      }

      if (base64Image) {
        const waveformImg = document.getElementById('audio-waveform');
        if (waveformImg) {
          // Replace with the zoomed-in waveform at 100% width
          waveformImg.style.width = '100%';
          waveformImg.style.marginLeft = '0';
          waveformImg.src = base64Image;

          // Mark waveform as regenerated
          isWaveformRegenerated = true;

          console.log('[WaveformManager] Waveform regenerated successfully');
        }
      }
    } catch (error) {
      console.error('[WaveformManager] Failed to regenerate waveform:', error);
    } finally {
      isRegeneratingWaveform = false;
    }
  }, 300); // 300ms debounce
}

/**
 * Public wrapper for debounced waveform zoom
 * @param {number} zoomStart - Zoom start position (0-1)
 * @param {number} zoomEnd - Zoom end position (0-1)
 * @param {string} videoPath - Current video/audio path
 * @param {object} videoInfo - Video/audio information
 * @returns {Promise<void>}
 */
export async function applyWaveformZoomDebounced(zoomStart, zoomEnd, videoPath, videoInfo) {
  return applyWaveformZoomDebouncedInternal(zoomStart, zoomEnd, videoPath, videoInfo);
}

// ============================================================================
// Waveform State
// ============================================================================

/**
 * Reset waveform to original (full range)
 */
export function resetWaveformZoom() {
  const waveformImg = document.getElementById('audio-waveform');
  if (waveformImg) {
    waveformImg.style.width = '100%';
    waveformImg.style.marginLeft = '0';
  }

  isWaveformRegenerated = false;

  // Clear any pending regeneration
  if (waveformRegenerateTimer) {
    clearTimeout(waveformRegenerateTimer);
    waveformRegenerateTimer = null;
  }

  console.log('[WaveformManager] Waveform zoom reset');
}

/**
 * Check if waveform has been regenerated (zoomed)
 * @returns {boolean}
 */
export function isWaveformZoomed() {
  return isWaveformRegenerated;
}

/**
 * Clear waveform display
 */
export function clearWaveform() {
  const waveformImg = document.getElementById('audio-waveform');
  if (waveformImg) {
    waveformImg.src = '';
    waveformImg.style.display = 'none';
  }

  const channelLabels = document.getElementById('channel-labels');
  if (channelLabels) {
    channelLabels.style.display = 'none';
  }

  const silentIndicator = document.getElementById('silent-audio-indicator');
  if (silentIndicator) {
    silentIndicator.style.display = 'none';
  }

  resetWaveformZoom();
}

// ============================================================================
// Waveform Display Helpers
// ============================================================================

/**
 * Show/hide waveform
 * @param {boolean} visible - Whether to show waveform
 */
export function setWaveformVisible(visible) {
  const waveformImg = document.getElementById('audio-waveform');
  if (waveformImg) {
    waveformImg.style.display = visible ? 'block' : 'none';
  }
}

/**
 * Update waveform channel labels
 * @param {number} channels - Number of audio channels
 */
export function updateChannelLabels(channels) {
  const channelLabels = document.getElementById('channel-labels');
  if (channelLabels) {
    // Show labels only for stereo (2 channels)
    channelLabels.style.display = channels === 2 ? 'flex' : 'none';
  }
}

/**
 * Set silent audio indicator visibility
 * @param {boolean} hasSilentAudio - Whether audio is silent/auto-generated
 */
export function setSilentAudioIndicator(hasSilentAudio) {
  const silentIndicator = document.getElementById('silent-audio-indicator');
  if (silentIndicator) {
    silentIndicator.style.display = hasSilentAudio ? 'block' : 'none';
  }
}

// ============================================================================
// Waveform Loading Helpers
// ============================================================================

/**
 * Load audio waveform from existing audio file
 * @param {string} audioPath - Audio file path
 * @param {object} audioInfo - Audio file information
 * @param {Function} updateStatus - Status update callback
 * @returns {Promise<boolean>}
 */
export async function loadAudioWaveform(audioPath, audioInfo, updateStatus) {
  return generateAndDisplayWaveform(audioPath, audioInfo, false, updateStatus);
}

/**
 * Reload waveform (useful after changes)
 * @param {string} mediaPath - Video or audio file path
 * @param {object} mediaInfo - Media information
 * @param {boolean} hasSilentAudio - Whether audio is silent
 * @param {Function} updateStatus - Status update callback
 * @returns {Promise<boolean>}
 */
export async function reloadWaveform(mediaPath, mediaInfo, hasSilentAudio, updateStatus) {
  clearWaveform();
  return generateAndDisplayWaveform(mediaPath, mediaInfo, hasSilentAudio, updateStatus);
}
