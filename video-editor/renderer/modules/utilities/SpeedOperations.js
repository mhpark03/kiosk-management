/**
 * SpeedOperations.js
 * 비디오 및 오디오 속도 조절
 *
 * @module SpeedOperations
 */

// ============================================================================
// Speed Configurations
// ============================================================================

export const SPEED_PRESETS = {
  SLOW_QUARTER: 0.25,
  SLOW_HALF: 0.5,
  SLOW_THREE_QUARTERS: 0.75,
  NORMAL: 1.0,
  FAST_1_25: 1.25,
  FAST_1_5: 1.5,
  FAST_2X: 2.0,
  FAST_4X: 4.0
};

// ============================================================================
// Video Speed
// ============================================================================

/**
 * Preview video speed change (realtime)
 * @param {number} speed - Speed multiplier (0.25 - 4.0)
 */
export function previewVideoSpeedChange(speed) {
  const video = document.getElementById('preview-video');
  if (!video) {
    console.error('[SpeedOperations] Video element not found');
    return;
  }

  video.playbackRate = speed;
  console.log(`[SpeedOperations] Video playback rate set to ${speed}x`);
}

/**
 * Stop speed preview and reset to normal
 */
export function stopVideoSpeedPreview() {
  const video = document.getElementById('preview-video');
  if (video) {
    video.playbackRate = 1.0;
    console.log('[SpeedOperations] Video playback rate reset to 1.0x');
  }
}

/**
 * Execute video speed adjustment (permanent)
 * @param {string} currentVideo - Current video path
 * @param {number} speed - Speed multiplier
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<object|null>}
 */
export async function executeVideoSpeedAdjust(currentVideo, speed, UIHelpers, loadVideo) {
  if (!currentVideo) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  if (speed < 0.25 || speed > 4.0) {
    UIHelpers.showAlert('속도는 0.25x에서 4.0x 사이여야 합니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `속도 ${speed}x 적용 중...`);

  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.adjustSpeed({
      inputPath: currentVideo,
      outputPath: null,
      speed: speed
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast(`속도 ${speed}x 적용 완료!`, 'success');
    UIHelpers.showCustomDialog(
      `속도 조정 완료!\n\n${speed}배속으로 변환되었습니다.\n편집된 내용은 임시 저장되었습니다.`
    );

    await loadVideo(result.outputPath);

    // Cleanup previous temp file
    if (previousVideo && previousVideo !== result.outputPath) {
      try {
        await window.electronAPI.deleteTempFile(previousVideo);
      } catch (error) {
        console.error('[SpeedOperations] Failed to delete temp file:', error);
      }
    }

    return {
      outputPath: result.outputPath,
      speed: speed
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('속도 조정', error, '속도 조정에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Audio Speed
// ============================================================================

/**
 * Preview audio speed change (realtime)
 * @param {number} speed - Speed multiplier (0.25 - 4.0)
 */
export function previewAudioSpeedChange(speed) {
  const audio = document.getElementById('preview-audio');
  if (!audio) {
    console.error('[SpeedOperations] Audio element not found');
    return;
  }

  audio.playbackRate = speed;
  console.log(`[SpeedOperations] Audio playback rate set to ${speed}x`);
}

/**
 * Stop audio speed preview and reset to normal
 */
export function stopAudioSpeedPreview() {
  const audio = document.getElementById('preview-audio');
  if (audio) {
    audio.playbackRate = 1.0;
    console.log('[SpeedOperations] Audio playback rate reset to 1.0x');
  }
}

/**
 * Execute audio speed adjustment (permanent)
 * @param {string} currentAudioFile - Current audio file path
 * @param {number} speed - Speed multiplier
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadAudioFile - Load audio callback
 * @returns {Promise<object|null>}
 */
export async function executeAudioSpeedAdjust(currentAudioFile, speed, UIHelpers, loadAudioFile) {
  if (!currentAudioFile) {
    UIHelpers.showAlert('먼저 음성 파일을 가져와주세요.');
    return null;
  }

  if (speed < 0.25 || speed > 4.0) {
    UIHelpers.showAlert('속도는 0.25x에서 4.0x 사이여야 합니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `오디오 속도 ${speed}x 적용 중...`);

  const previousAudio = currentAudioFile;

  try {
    const result = await window.electronAPI.adjustAudioSpeed({
      inputPath: currentAudioFile,
      outputPath: null,
      speed: speed
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast(`오디오 속도 ${speed}x 적용 완료!`, 'success');

    await loadAudioFile(result.outputPath);

    // Cleanup previous temp file
    if (previousAudio && previousAudio !== result.outputPath) {
      try {
        await window.electronAPI.deleteTempFile(previousAudio);
      } catch (error) {
        console.error('[SpeedOperations] Failed to delete temp file:', error);
      }
    }

    return {
      outputPath: result.outputPath,
      speed: speed
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 속도 조정', error, '오디오 속도 조정에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Speed Utilities
// ============================================================================

/**
 * Get speed label for display
 * @param {number} speed - Speed multiplier
 * @returns {string}
 */
export function getSpeedLabel(speed) {
  if (speed < 1) {
    return `슬로우모션 (${speed}x)`;
  } else if (speed === 1) {
    return '정상 속도';
  } else {
    return `배속 (${speed}x)`;
  }
}

/**
 * Validate speed value
 * @param {number} speed - Speed multiplier
 * @returns {{valid: boolean, error: string}}
 */
export function validateSpeed(speed) {
  if (typeof speed !== 'number' || isNaN(speed)) {
    return { valid: false, error: '속도 값은 숫자여야 합니다.' };
  }

  if (speed < 0.25) {
    return { valid: false, error: '속도는 최소 0.25x 이상이어야 합니다.' };
  }

  if (speed > 4.0) {
    return { valid: false, error: '속도는 최대 4.0x 이하여야 합니다.' };
  }

  return { valid: true, error: '' };
}
