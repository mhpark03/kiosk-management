/**
 * TimelineHelpers.js
 * 타임라인 관련 헬퍼 함수들 (범위 오버레이, 시간 표시, 유효성 검증 등)
 *
 * @module TimelineHelpers
 */

// ============================================================================
// Zoom Range Overlay
// ============================================================================

/**
 * Update zoom range overlay on timeline slider
 * @param {number} zoomStart - Zoom start position (0-1)
 * @param {number} zoomEnd - Zoom end position (0-1)
 */
export function updateZoomRangeOverlay(zoomStart, zoomEnd) {
  const overlay = document.getElementById('zoom-range-overlay');
  if (!overlay) return;

  // If not zoomed (full range), hide overlay
  if (zoomStart === 0 && zoomEnd === 1) {
    overlay.style.display = 'none';
    return;
  }

  // Show overlay and position it
  overlay.style.display = 'block';
  const startPercent = zoomStart * 100;
  const endPercent = zoomEnd * 100;
  const widthPercent = endPercent - startPercent;

  overlay.style.left = `${startPercent}%`;
  overlay.style.width = `${widthPercent}%`;
}

// ============================================================================
// Trim Range Overlay
// ============================================================================

/**
 * Update trim duration display
 * @param {object} videoInfo - Video information object
 * @returns {object} Validation result { valid: boolean, startTime: number, endTime: number, duration: number }
 */
export function updateTrimDurationDisplay(videoInfo) {
  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');
  const display = document.getElementById('trim-duration-display');

  if (!startInput || !endInput || !display) {
    return { valid: false, startTime: 0, endTime: 0, duration: 0 };
  }

  const maxDuration = videoInfo ? parseFloat(videoInfo.format.duration) : 100;
  let startTime = parseFloat(startInput.value) || 0;
  let endTime = parseFloat(endInput.value) || 0;

  // Clamp values to valid range
  startTime = Math.max(0, Math.min(startTime, maxDuration));
  endTime = Math.max(0, Math.min(endTime, maxDuration));

  // Update input values if they were clamped
  if (parseFloat(startInput.value) !== startTime) {
    startInput.value = startTime.toFixed(2);
  }
  if (parseFloat(endInput.value) !== endTime) {
    endInput.value = endTime.toFixed(2);
  }

  const duration = Math.max(0, endTime - startTime);

  display.textContent = `${duration.toFixed(2)}초`;

  // Validation styling with detailed feedback
  let valid = true;
  if (endTime <= startTime) {
    display.style.color = '#dc3545';
    display.textContent += ' (끝 시간이 시작 시간보다 커야 함)';
    valid = false;
  } else if (duration < 0.1) {
    display.style.color = '#ffc107';
    display.textContent += ' (최소 0.1초 이상)';
    valid = false;
  } else if (startTime >= maxDuration) {
    display.style.color = '#dc3545';
    display.textContent += ' (시작 시간이 영상 길이 초과)';
    valid = false;
  } else if (endTime > maxDuration) {
    display.style.color = '#dc3545';
    display.textContent += ' (끝 시간이 영상 길이 초과)';
    valid = false;
  } else {
    display.style.color = '#28a745';
    display.textContent += ' ✓';
  }

  return { valid, startTime, endTime, duration, maxDuration };
}

/**
 * Update trim range overlay on timeline
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {number} maxDuration - Maximum duration in seconds
 * @param {string} toolName - Current active tool (to check if overlay should be shown)
 */
export function updateTrimRangeOverlay(startTime, endTime, maxDuration, toolName = '') {
  const overlay = document.getElementById('trim-range-overlay');
  if (!overlay) return;

  // Show overlay only in trim mode
  if (toolName === 'trim' || toolName === '') {
    overlay.style.display = 'block';

    // Calculate percentages
    const startPercent = (startTime / maxDuration) * 100;
    const endPercent = (endTime / maxDuration) * 100;
    const widthPercent = endPercent - startPercent;

    // Update overlay position and size
    overlay.style.left = `${startPercent}%`;
    overlay.style.width = `${widthPercent}%`;
  } else {
    overlay.style.display = 'none';
  }
}

// ============================================================================
// Text Range Overlay
// ============================================================================

/**
 * Update text range overlay on timeline
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {number} maxDuration - Maximum duration in seconds
 * @param {string} toolName - Current active tool
 */
export function updateTextRangeOverlay(startTime, endTime, maxDuration, toolName = '') {
  const overlay = document.getElementById('text-range-overlay');
  if (!overlay) return;

  // Show overlay only in text mode
  if (toolName === 'text' || toolName === '') {
    overlay.style.display = 'block';

    // Calculate percentages
    const startPercent = (startTime / maxDuration) * 100;
    const endPercent = (endTime / maxDuration) * 100;
    const widthPercent = endPercent - startPercent;

    // Update overlay position and size
    overlay.style.left = `${startPercent}%`;
    overlay.style.width = `${widthPercent}%`;
  } else {
    overlay.style.display = 'none';
  }
}

/**
 * Update text range display when inputs change
 * @param {object} videoInfo - Video information object
 * @param {string} toolName - Current active tool
 * @returns {object} Range data { startTime: number, endTime: number, valid: boolean }
 */
export function updateTextRangeDisplay(videoInfo, toolName = '') {
  const startInput = document.getElementById('text-start');
  const endInput = document.getElementById('text-end');

  if (!startInput || !endInput || !videoInfo) {
    return { startTime: 0, endTime: 0, valid: false };
  }

  const maxDuration = parseFloat(videoInfo.format.duration);
  let startTime = parseFloat(startInput.value);
  let endTime = parseFloat(endInput.value);

  // Only update overlay if both values are set
  if (!isNaN(startTime) && !isNaN(endTime)) {
    // Clamp values to valid range
    startTime = Math.max(0, Math.min(startTime, maxDuration));
    endTime = Math.max(0, Math.min(endTime, maxDuration));

    // Update overlay
    updateTextRangeOverlay(startTime, endTime, maxDuration, toolName);

    return { startTime, endTime, valid: true };
  } else {
    // Hide overlay if values are not set
    const overlay = document.getElementById('text-range-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    return { startTime: 0, endTime: 0, valid: false };
  }
}

// ============================================================================
// Audio Range Overlay
// ============================================================================

/**
 * Update audio range overlay on timeline
 * @param {number} startTime - Audio start time in seconds
 * @param {number} endTime - Audio end time in seconds (startTime + duration)
 * @param {number} maxDuration - Video max duration in seconds
 */
export function updateAudioRangeOverlay(startTime, endTime, maxDuration) {
  const overlay = document.getElementById('audio-range-overlay');
  if (!overlay) return;

  overlay.style.display = 'block';

  // Calculate percentages
  const startPercent = (startTime / maxDuration) * 100;
  const endPercent = Math.min((endTime / maxDuration) * 100, 100);
  const widthPercent = endPercent - startPercent;

  // Update overlay position and size
  overlay.style.left = `${startPercent}%`;
  overlay.style.width = `${widthPercent}%`;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format seconds to MM:SS or HH:MM:SS
 * @param {number} seconds - Time in seconds
 * @param {boolean} forceHours - Force HH:MM:SS format
 * @returns {string} Formatted time string
 */
export function formatTime(seconds, forceHours = false) {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0 || forceHours) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Parse time string (MM:SS or HH:MM:SS) to seconds
 * @param {string} timeString - Time string
 * @returns {number} Time in seconds
 */
export function parseTimeString(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return 0;
  }

  const parts = timeString.split(':').map(p => parseInt(p, 10));

  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

// ============================================================================
// Range Validation
// ============================================================================

/**
 * Validate time range
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {number} maxDuration - Maximum duration in seconds
 * @param {number} minDuration - Minimum duration in seconds (default: 0.1)
 * @returns {object} Validation result { valid: boolean, error: string }
 */
export function validateTimeRange(startTime, endTime, maxDuration, minDuration = 0.1) {
  if (isNaN(startTime) || isNaN(endTime)) {
    return { valid: false, error: '시간 값이 올바르지 않습니다' };
  }

  if (startTime < 0) {
    return { valid: false, error: '시작 시간은 0 이상이어야 합니다' };
  }

  if (startTime >= maxDuration) {
    return { valid: false, error: '시작 시간이 영상 길이를 초과했습니다' };
  }

  if (endTime > maxDuration) {
    return { valid: false, error: '끝 시간이 영상 길이를 초과했습니다' };
  }

  if (endTime <= startTime) {
    return { valid: false, error: '끝 시간이 시작 시간보다 커야 합니다' };
  }

  const duration = endTime - startTime;
  if (duration < minDuration) {
    return { valid: false, error: `최소 ${minDuration}초 이상이어야 합니다` };
  }

  return { valid: true, error: '' };
}

// ============================================================================
// Timeline Cursor
// ============================================================================

/**
 * Update timeline cursor position
 * @param {number} currentTime - Current time in seconds
 * @param {number} duration - Total duration in seconds
 * @param {string} cursorId - Cursor element ID (default: 'playhead-bar')
 */
export function updateTimelineCursor(currentTime, duration, cursorId = 'playhead-bar') {
  const cursor = document.getElementById(cursorId);
  if (!cursor || !duration) return;

  const percentage = (currentTime / duration) * 100;
  cursor.style.left = `${Math.min(Math.max(percentage, 0), 100)}%`;
}

/**
 * Hide all timeline overlays
 */
export function hideAllOverlays() {
  const overlayIds = [
    'trim-range-overlay',
    'text-range-overlay',
    'audio-range-overlay',
    'zoom-range-overlay'
  ];

  overlayIds.forEach(id => {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.style.display = 'none';
    }
  });
}

/**
 * Show specific overlay
 * @param {string} overlayId - Overlay element ID
 */
export function showOverlay(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.style.display = 'block';
  }
}

// ============================================================================
// Timeline Markers
// ============================================================================

/**
 * Add marker to timeline
 * @param {number} time - Time in seconds
 * @param {number} duration - Total duration in seconds
 * @param {string} label - Marker label
 * @param {string} color - Marker color
 * @returns {HTMLElement} Marker element
 */
export function addTimelineMarker(time, duration, label = '', color = '#667eea') {
  const timelineContainer = document.querySelector('.timeline-slider-container');
  if (!timelineContainer) return null;

  const marker = document.createElement('div');
  marker.className = 'timeline-marker';
  marker.style.cssText = `
    position: absolute;
    left: ${(time / duration) * 100}%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: ${color};
    pointer-events: none;
    z-index: 10;
  `;

  if (label) {
    marker.title = label;
  }

  timelineContainer.appendChild(marker);
  return marker;
}

/**
 * Clear all timeline markers
 */
export function clearTimelineMarkers() {
  const markers = document.querySelectorAll('.timeline-marker');
  markers.forEach(marker => marker.remove());
}
