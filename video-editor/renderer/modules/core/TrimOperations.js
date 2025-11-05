/**
 * TrimOperations.js
 * 비디오/오디오 트림, 구간 삭제
 *
 * @module TrimOperations
 *
 * NOTE: 이 모듈은 기본 구조와 인터페이스를 제공합니다.
 * app.js의 해당 함수들을 이 모듈로 옮겨주세요.
 */

// ============================================================================
// Video Trim
// ============================================================================

/**
 * Trim video to specified time range
 * @param {string} videoPath - Video file path
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string, duration: number}>}
 *
 * Location in app.js: Line ~3544
 *
 * TODO: Move implementation from app.js
 */
export async function executeTrim(videoPath, startTime, endTime, UIHelpers, loadVideo) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  // Validate time range
  const validation = validateTrimRange(startTime, endTime);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '영상 트림 중...');

  const previousVideo = videoPath;

  try {
    const result = await window.electronAPI.trimVideo({
      inputPath: videoPath,
      outputPath: null,
      startTime: startTime,
      endTime: endTime
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('트림 완료!', 'success');
    UIHelpers.showCustomDialog(
      `트림 완료!\n\n구간: ${formatTime(startTime)} - ${formatTime(endTime)}\n길이: ${formatTime(endTime - startTime)}\n\n편집된 내용은 임시 저장되었습니다.`
    );

    await loadVideo(result.outputPath);

    // Delete previous temp file
    if (previousVideo && previousVideo !== result.outputPath) {
      try {
        await window.electronAPI.deleteTempFile(previousVideo);
      } catch (deleteError) {
        console.error('[TrimOperations] Failed to delete temp file:', deleteError);
      }
    }

    return {
      outputPath: result.outputPath,
      duration: endTime - startTime
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('영상 트림', error, '영상 트림에 실패했습니다.');
    return null;
  }
}

/**
 * Trim video only (keep original audio track)
 * @param {string} videoPath - Video file path
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~3700
 *
 * TODO: Move implementation from app.js
 */
export async function executeTrimVideoOnly(videoPath, startTime, endTime, UIHelpers, loadVideo) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  const validation = validateTrimRange(startTime, endTime);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '비디오 트랙 트림 중...');

  try {
    const result = await window.electronAPI.trimVideoTrack({
      inputPath: videoPath,
      outputPath: null,
      startTime: startTime,
      endTime: endTime,
      trimMode: 'video' // Only trim video track
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('비디오 트랙 트림 완료!', 'success');

    await loadVideo(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('비디오 트랙 트림', error, '비디오 트랙 트림에 실패했습니다.');
    return null;
  }
}

/**
 * Trim audio only (keep original video track)
 * @param {string} videoPath - Video file path
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~3850
 *
 * TODO: Move implementation from app.js
 */
export async function executeTrimAudioOnly(videoPath, startTime, endTime, UIHelpers, loadVideo) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  const validation = validateTrimRange(startTime, endTime);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '오디오 트랙 트림 중...');

  try {
    const result = await window.electronAPI.trimVideoTrack({
      inputPath: videoPath,
      outputPath: null,
      startTime: startTime,
      endTime: endTime,
      trimMode: 'audio' // Only trim audio track
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('오디오 트랙 트림 완료!', 'success');

    await loadVideo(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 트랙 트림', error, '오디오 트랙 트림에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Audio Trim
// ============================================================================

/**
 * Trim audio file to specified time range
 * @param {string} audioPath - Audio file path
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadAudioFile - Load audio callback
 * @returns {Promise<{outputPath: string, duration: number}>}
 *
 * Location in app.js: Line ~4000
 *
 * TODO: Move implementation from app.js
 */
export async function executeTrimAudio(audioPath, startTime, endTime, UIHelpers, loadAudioFile) {
  if (!audioPath) {
    UIHelpers.showAlert('먼저 오디오를 가져와주세요.');
    return null;
  }

  const validation = validateTrimRange(startTime, endTime);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '오디오 트림 중...');

  try {
    const result = await window.electronAPI.trimAudio({
      inputPath: audioPath,
      outputPath: null,
      startTime: startTime,
      endTime: endTime
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('오디오 트림 완료!', 'success');

    await loadAudioFile(result.outputPath);

    return {
      outputPath: result.outputPath,
      duration: endTime - startTime
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 트림', error, '오디오 트림에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Delete Range
// ============================================================================

/**
 * Delete a range from video
 * @param {string} videoPath - Video file path
 * @param {number} startTime - Start time of range to delete
 * @param {number} endTime - End time of range to delete
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~4150
 *
 * TODO: Move implementation from app.js
 */
export async function executeDeleteRange(videoPath, startTime, endTime, UIHelpers, loadVideo) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  const validation = validateTrimRange(startTime, endTime);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '구간 삭제 중...');

  try {
    const result = await window.electronAPI.deleteRange({
      inputPath: videoPath,
      outputPath: null,
      startTime: startTime,
      endTime: endTime
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('구간 삭제 완료!', 'success');

    await loadVideo(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('구간 삭제', error, '구간 삭제에 실패했습니다.');
    return null;
  }
}

/**
 * Delete multiple ranges from video
 * @param {string} videoPath - Video file path
 * @param {Array<{start: number, end: number}>} ranges - Ranges to delete
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~4250
 *
 * TODO: Move implementation from app.js
 */
export async function executeDeleteMultipleRanges(videoPath, ranges, UIHelpers, loadVideo) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  if (!ranges || ranges.length === 0) {
    UIHelpers.showAlert('삭제할 구간을 지정해주세요.');
    return null;
  }

  // Validate all ranges
  for (const range of ranges) {
    const validation = validateTrimRange(range.start, range.end);
    if (!validation.valid) {
      UIHelpers.showAlert(`구간 ${formatTime(range.start)}-${formatTime(range.end)}: ${validation.error}`);
      return null;
    }
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `${ranges.length}개 구간 삭제 중...`);

  try {
    const result = await window.electronAPI.deleteMultipleRanges({
      inputPath: videoPath,
      outputPath: null,
      ranges: ranges
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast(`${ranges.length}개 구간 삭제 완료!`, 'success');

    await loadVideo(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('구간 삭제', error, '구간 삭제에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate trim range
 * @param {number} startTime - Start time
 * @param {number} endTime - End time
 * @param {number} maxDuration - Maximum duration (optional)
 * @returns {{valid: boolean, error: string}}
 */
export function validateTrimRange(startTime, endTime, maxDuration) {
  // Check if times are numbers
  if (typeof startTime !== 'number' || isNaN(startTime)) {
    return { valid: false, error: '시작 시간은 숫자여야 합니다.' };
  }

  if (typeof endTime !== 'number' || isNaN(endTime)) {
    return { valid: false, error: '종료 시간은 숫자여야 합니다.' };
  }

  // Check if times are positive
  if (startTime < 0) {
    return { valid: false, error: '시작 시간은 0보다 커야 합니다.' };
  }

  if (endTime < 0) {
    return { valid: false, error: '종료 시간은 0보다 커야 합니다.' };
  }

  // Check if start < end
  if (startTime >= endTime) {
    return { valid: false, error: '시작 시간은 종료 시간보다 작아야 합니다.' };
  }

  // Check minimum duration (0.1s)
  if (endTime - startTime < 0.1) {
    return { valid: false, error: '트림 구간은 최소 0.1초 이상이어야 합니다.' };
  }

  // Check max duration if provided
  if (maxDuration !== undefined && endTime > maxDuration) {
    return { valid: false, error: `종료 시간은 ${formatTime(maxDuration)}를 초과할 수 없습니다.` };
  }

  return { valid: true, error: '' };
}

/**
 * Validate multiple trim ranges
 * @param {Array<{start: number, end: number}>} ranges - Trim ranges
 * @param {number} maxDuration - Maximum duration
 * @returns {{valid: boolean, error: string}}
 */
export function validateMultipleTrimRanges(ranges, maxDuration) {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return { valid: false, error: '최소 하나의 구간이 필요합니다.' };
  }

  // Validate each range
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const validation = validateTrimRange(range.start, range.end, maxDuration);
    if (!validation.valid) {
      return { valid: false, error: `구간 ${i + 1}: ${validation.error}` };
    }
  }

  // Check for overlapping ranges
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const range1 = ranges[i];
      const range2 = ranges[j];

      if (
        (range1.start <= range2.start && range2.start < range1.end) ||
        (range2.start <= range1.start && range1.start < range2.end)
      ) {
        return {
          valid: false,
          error: `구간 ${i + 1}과 구간 ${j + 1}이 겹칩니다.`
        };
      }
    }
  }

  return { valid: true, error: '' };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time (MM:SS or HH:MM:SS)
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate total duration after deleting ranges
 * @param {number} originalDuration - Original duration in seconds
 * @param {Array<{start: number, end: number}>} ranges - Ranges to delete
 * @returns {number} Resulting duration
 */
export function calculateDurationAfterDeletion(originalDuration, ranges) {
  let totalDeleted = 0;
  for (const range of ranges) {
    totalDeleted += (range.end - range.start);
  }
  return originalDuration - totalDeleted;
}

/**
 * Merge adjacent or overlapping trim ranges
 * @param {Array<{start: number, end: number}>} ranges - Trim ranges
 * @returns {Array<{start: number, end: number}>} Merged ranges
 */
export function mergeAdjacentRanges(ranges) {
  if (ranges.length === 0) return [];

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // If current overlaps or is adjacent to last, merge them
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Split video into segments based on trim ranges
 * @param {number} duration - Total duration
 * @param {Array<{start: number, end: number}>} keepRanges - Ranges to keep
 * @returns {Array<{start: number, end: number}>} Segments
 */
export function splitIntoSegments(duration, keepRanges) {
  if (keepRanges.length === 0) {
    return [{ start: 0, end: duration }];
  }

  const segments = [];
  let currentStart = 0;

  for (const range of keepRanges) {
    // Add segment before this range (if any)
    if (currentStart < range.start) {
      segments.push({ start: currentStart, end: range.start });
    }
    currentStart = range.end;
  }

  // Add final segment (if any)
  if (currentStart < duration) {
    segments.push({ start: currentStart, end: duration });
  }

  return segments;
}
