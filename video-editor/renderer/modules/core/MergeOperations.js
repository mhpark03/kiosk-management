/**
 * MergeOperations.js
 * 비디오/오디오 병합, 트랜지션 효과
 *
 * @module MergeOperations
 *
 * NOTE: 이 모듈은 기본 구조와 인터페이스를 제공합니다.
 * app.js의 해당 함수들을 이 모듈로 옮겨주세요.
 */

// ============================================================================
// Merge State
// ============================================================================

let videosToMerge = [];

// ============================================================================
// Video List Management
// ============================================================================

/**
 * Add video to merge list
 * @param {string} videoPath - Video file path
 * @param {object} videoInfo - Video information
 * @param {Function} updateMergeList - Callback to update UI
 * @returns {boolean} Success
 *
 * Location in app.js: Line ~4319
 *
 * TODO: Move implementation from app.js
 */
export function addVideoToMerge(videoPath, videoInfo, updateMergeList) {
  if (!videoPath) {
    console.error('[MergeOperations] No video path provided');
    return false;
  }

  // Check if already added
  const alreadyExists = videosToMerge.some(v => v.path === videoPath);
  if (alreadyExists) {
    console.warn('[MergeOperations] Video already in merge list');
    return false;
  }

  const duration = parseFloat(videoInfo?.format?.duration || 0);
  const videoStream = videoInfo?.streams?.find(s => s.codec_type === 'video');
  const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : 'N/A';

  videosToMerge.push({
    path: videoPath,
    duration: duration,
    resolution: resolution,
    info: videoInfo
  });

  console.log(`[MergeOperations] Added video to merge list (${videosToMerge.length} total)`);

  // Update UI
  if (updateMergeList) {
    updateMergeList(videosToMerge);
  }

  return true;
}

/**
 * Remove video from merge list
 * @param {number} index - Index of video to remove
 * @param {Function} updateMergeList - Callback to update UI
 */
export function removeVideoFromMerge(index, updateMergeList) {
  if (index < 0 || index >= videosToMerge.length) {
    console.error('[MergeOperations] Invalid index:', index);
    return;
  }

  videosToMerge.splice(index, 1);
  console.log(`[MergeOperations] Removed video at index ${index} (${videosToMerge.length} remaining)`);

  if (updateMergeList) {
    updateMergeList(videosToMerge);
  }
}

/**
 * Move video up in merge list
 * @param {number} index - Index of video to move
 * @param {Function} updateMergeList - Callback to update UI
 */
export function moveVideoUp(index, updateMergeList) {
  if (index <= 0 || index >= videosToMerge.length) {
    return;
  }

  [videosToMerge[index - 1], videosToMerge[index]] = [videosToMerge[index], videosToMerge[index - 1]];

  if (updateMergeList) {
    updateMergeList(videosToMerge);
  }
}

/**
 * Move video down in merge list
 * @param {number} index - Index of video to move
 * @param {Function} updateMergeList - Callback to update UI
 */
export function moveVideoDown(index, updateMergeList) {
  if (index < 0 || index >= videosToMerge.length - 1) {
    return;
  }

  [videosToMerge[index], videosToMerge[index + 1]] = [videosToMerge[index + 1], videosToMerge[index]];

  if (updateMergeList) {
    updateMergeList(videosToMerge);
  }
}

/**
 * Clear all videos from merge list
 * @param {Function} updateMergeList - Callback to update UI
 */
export function clearMergeList(updateMergeList) {
  videosToMerge = [];

  if (updateMergeList) {
    updateMergeList(videosToMerge);
  }
}

/**
 * Get current merge list
 * @returns {Array<object>} List of videos to merge
 */
export function getMergeList() {
  return [...videosToMerge];
}

// ============================================================================
// Merge Execution
// ============================================================================

/**
 * Merge videos with optional transition
 * @param {string} transitionType - Transition type (none, fade, dissolve, wipe)
 * @param {number} transitionDuration - Transition duration in seconds
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string, duration: number}>}
 *
 * Location in app.js: Line ~4450
 *
 * TODO: Move implementation from app.js
 */
export async function executeMerge(transitionType, transitionDuration, UIHelpers, loadVideo) {
  if (videosToMerge.length < 2) {
    UIHelpers.showAlert('병합하려면 최소 2개의 영상이 필요합니다.');
    return null;
  }

  // Validate transition
  const validation = validateTransition(transitionType, transitionDuration);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `${videosToMerge.length}개 영상 병합 중...`);

  try {
    const videoPaths = videosToMerge.map(v => v.path);

    const result = await window.electronAPI.mergeVideos({
      inputPaths: videoPaths,
      outputPath: null,
      transition: transitionType || 'none',
      transitionDuration: transitionDuration || 0
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('병합 완료!', 'success');

    const totalDuration = videosToMerge.reduce((sum, v) => sum + v.duration, 0);
    const transitionOverlap = transitionDuration * (videosToMerge.length - 1);
    const finalDuration = totalDuration - transitionOverlap;

    UIHelpers.showCustomDialog(
      `병합 완료!\n\n영상 수: ${videosToMerge.length}개\n총 길이: ${formatTime(finalDuration)}\n트랜지션: ${transitionType}`
    );

    await loadVideo(result.outputPath);

    // Clear merge list after successful merge
    clearMergeList();

    return {
      outputPath: result.outputPath,
      duration: finalDuration
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('영상 병합', error, '영상 병합에 실패했습니다.');
    return null;
  }
}

/**
 * Merge audio files
 * @param {Array<string>} audioPaths - Audio file paths
 * @param {string} mergeMode - Merge mode (concatenate, overlay, mix)
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadAudioFile - Load audio callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~4600
 *
 * TODO: Move implementation from app.js
 */
export async function mergeAudioFiles(audioPaths, mergeMode, UIHelpers, loadAudioFile) {
  if (!audioPaths || audioPaths.length < 2) {
    UIHelpers.showAlert('병합하려면 최소 2개의 오디오가 필요합니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `${audioPaths.length}개 오디오 병합 중...`);

  try {
    const result = await window.electronAPI.mergeAudioFiles({
      inputPaths: audioPaths,
      outputPath: null,
      mode: mergeMode || 'concatenate'
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('오디오 병합 완료!', 'success');

    await loadAudioFile(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 병합', error, '오디오 병합에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Preview
// ============================================================================

/**
 * Preview merge result (play videos sequentially)
 * @param {Function} seekToTime - Seek callback
 * @param {Function} playVideo - Play callback
 * @returns {Promise<void>}
 *
 * Location in app.js: Line ~4680
 *
 * TODO: Move implementation from app.js
 */
export async function previewMerge(seekToTime, playVideo) {
  if (videosToMerge.length < 2) {
    console.warn('[MergeOperations] Not enough videos to preview merge');
    return;
  }

  console.log('[MergeOperations] Starting merge preview...');

  for (let i = 0; i < videosToMerge.length; i++) {
    const video = videosToMerge[i];
    console.log(`[MergeOperations] Preview video ${i + 1}/${videosToMerge.length}`);

    // Load and play each video
    await playVideo(video.path);

    // Wait for video to finish
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const videoElement = document.getElementById('preview-video');
        if (videoElement && videoElement.ended) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  console.log('[MergeOperations] Merge preview complete');
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate transition parameters
 * @param {string} transitionType - Transition type
 * @param {number} transitionDuration - Transition duration
 * @returns {{valid: boolean, error: string}}
 */
export function validateTransition(transitionType, transitionDuration) {
  const validTransitions = ['none', 'fade', 'dissolve', 'wipe', 'slide'];

  if (!validTransitions.includes(transitionType)) {
    return {
      valid: false,
      error: `유효하지 않은 트랜지션입니다. 가능한 값: ${validTransitions.join(', ')}`
    };
  }

  if (transitionType !== 'none') {
    if (typeof transitionDuration !== 'number' || transitionDuration <= 0) {
      return { valid: false, error: '트랜지션 시간은 0보다 커야 합니다.' };
    }

    if (transitionDuration > 5) {
      return { valid: false, error: '트랜지션 시간은 5초를 초과할 수 없습니다.' };
    }
  }

  return { valid: true, error: '' };
}

/**
 * Validate merge list compatibility
 * @param {Array<object>} videos - Videos to merge
 * @returns {{valid: boolean, error: string, warnings: Array<string>}}
 */
export function validateMergeCompatibility(videos) {
  if (!videos || videos.length < 2) {
    return { valid: false, error: '최소 2개의 영상이 필요합니다.', warnings: [] };
  }

  const warnings = [];

  // Check resolutions
  const resolutions = videos.map(v => v.resolution);
  const uniqueResolutions = [...new Set(resolutions)];
  if (uniqueResolutions.length > 1) {
    warnings.push(`해상도가 다릅니다: ${uniqueResolutions.join(', ')}. 첫 번째 영상의 해상도로 통일됩니다.`);
  }

  // Check frame rates
  const frameRates = videos.map(v => {
    const videoStream = v.info?.streams?.find(s => s.codec_type === 'video');
    if (videoStream && videoStream.r_frame_rate) {
      try {
        return eval(videoStream.r_frame_rate);
      } catch (e) {
        return null;
      }
    }
    return null;
  }).filter(fps => fps !== null);

  const uniqueFrameRates = [...new Set(frameRates)];
  if (uniqueFrameRates.length > 1) {
    warnings.push(`프레임레이트가 다릅니다. 첫 번째 영상의 프레임레이트로 통일됩니다.`);
  }

  return { valid: true, error: '', warnings };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
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
 * Calculate total duration of merge
 * @param {Array<object>} videos - Videos to merge
 * @param {number} transitionDuration - Transition duration
 * @returns {number} Total duration in seconds
 */
export function calculateMergeDuration(videos, transitionDuration) {
  if (!videos || videos.length === 0) return 0;

  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
  const transitionOverlap = transitionDuration * (videos.length - 1);

  return Math.max(0, totalDuration - transitionOverlap);
}

/**
 * Generate merge info summary
 * @param {Array<object>} videos - Videos to merge
 * @param {string} transitionType - Transition type
 * @param {number} transitionDuration - Transition duration
 * @returns {string} Summary text
 */
export function generateMergeSummary(videos, transitionType, transitionDuration) {
  if (!videos || videos.length === 0) {
    return '병합할 영상이 없습니다.';
  }

  const totalDuration = calculateMergeDuration(videos, transitionDuration);
  const lines = [
    `영상 수: ${videos.length}개`,
    `총 길이: ${formatTime(totalDuration)}`,
    `트랜지션: ${transitionType}`,
  ];

  if (transitionType !== 'none') {
    lines.push(`트랜지션 시간: ${transitionDuration}초`);
  }

  // Resolution info
  const resolutions = videos.map(v => v.resolution);
  const uniqueResolutions = [...new Set(resolutions)];
  if (uniqueResolutions.length === 1) {
    lines.push(`해상도: ${uniqueResolutions[0]}`);
  } else {
    lines.push(`해상도: ${uniqueResolutions.join(', ')} (첫 번째 영상으로 통일됨)`);
  }

  return lines.join('\n');
}
