/**
 * AudioOperations.js
 * 오디오 가져오기, 로드, 추출, S3 업로드
 *
 * @module AudioOperations
 *
 * NOTE: 이 모듈은 기본 구조와 인터페이스를 제공합니다.
 * app.js의 해당 함수들을 이 모듈로 옮겨주세요.
 */

// ============================================================================
// Audio Import
// ============================================================================

/**
 * Import audio file from local filesystem or S3
 * @param {object} authState - Authentication state {token, user}
 * @param {Function} showLoginModal - Login modal callback
 * @param {Function} showAudioListFromS3 - S3 audio list callback
 * @returns {Promise<void>}
 *
 * Location in app.js: Line ~4700
 *
 * TODO: Move implementation from app.js
 */
export async function importAudioFile(authState, showLoginModal, showAudioListFromS3) {
  const { token, user } = authState;

  if (!token || !user) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      const audioPath = await window.electronAPI.selectAudio();
      if (!audioPath) return;
      await loadAudioFile(audioPath);
    } else {
      showLoginModal();
    }
    return;
  }

  await showAudioListFromS3();
}

/**
 * Load audio file into preview
 * @param {string} path - Audio file path
 * @param {object} previewManager - PreviewManager instance
 * @param {object} WaveformManager - WaveformManager module
 * @param {Function} updateStatus - Status update callback
 * @returns {Promise<object>} Audio info
 *
 * Location in app.js: Line ~4730
 *
 * TODO: Move full implementation from app.js
 */
export async function loadAudioFile(path, previewManager, WaveformManager, updateStatus) {
  try {
    updateStatus(`오디오 로드: ${path}`);

    // Load audio using PreviewManager
    const audioUrl = `file:///${path.replace(/\\/g, '/')}`;
    previewManager.showAudio(audioUrl, { showInfo: true });

    // Get audio info
    const audioInfo = await window.electronAPI.getAudioInfo(path);

    // Display audio info
    displayAudioInfo(audioInfo);

    // Generate and display audio waveform
    await WaveformManager.loadAudioWaveform(path, audioInfo, updateStatus);

    // Update current file display
    document.getElementById('current-file').textContent = path.split('\\').pop();

    updateStatus(`오디오 로드 완료: ${path}`);

    return audioInfo;
  } catch (error) {
    console.error('[AudioOperations] Failed to load audio:', error);
    throw error;
  }
}

/**
 * Display audio information
 * @param {object} info - Audio information from FFprobe
 *
 * Location in app.js: Line ~4760
 */
export function displayAudioInfo(info) {
  if (!info || !info.streams || !info.format) {
    console.error('[AudioOperations] Invalid audio info:', info);
    return;
  }

  const audioStream = info.streams.find(s => s.codec_type === 'audio');
  const duration = parseFloat(info.format.duration) || 0;
  const size = (parseFloat(info.format.size || 0) / (1024 * 1024)).toFixed(2);

  let sampleRate = 'N/A';
  let channels = 'N/A';
  let bitrate = 'N/A';

  if (audioStream) {
    sampleRate = audioStream.sample_rate ? `${(audioStream.sample_rate / 1000).toFixed(1)} kHz` : 'N/A';
    channels = audioStream.channels || 'N/A';
    bitrate = info.format.bit_rate ? `${(info.format.bit_rate / 1000).toFixed(0)} kbps` : 'N/A';
  }

  // Update UI
  const infoElement = document.getElementById('audio-info');
  if (infoElement) {
    infoElement.innerHTML = `
      <div><strong>길이:</strong> ${duration.toFixed(2)}초</div>
      <div><strong>샘플레이트:</strong> ${sampleRate}</div>
      <div><strong>채널:</strong> ${channels}</div>
      <div><strong>비트레이트:</strong> ${bitrate}</div>
      <div><strong>크기:</strong> ${size} MB</div>
    `;
  }
}

// ============================================================================
// Audio Extraction
// ============================================================================

/**
 * Extract audio from video to local file
 * @param {string} videoPath - Video file path
 * @param {string} outputFormat - Output format (mp3, wav, aac)
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadAudioFile - Load audio callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~5600
 *
 * TODO: Move implementation from app.js
 */
export async function executeExtractAudio(videoPath, outputFormat, UIHelpers, loadAudioFile) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '오디오 추출 중...');

  try {
    const result = await window.electronAPI.extractAudio({
      inputPath: videoPath,
      outputPath: null, // null = create temp file
      format: outputFormat || 'mp3'
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('오디오 추출 완료!', 'success');

    // Load extracted audio
    await loadAudioFile(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 추출', error, '오디오 추출에 실패했습니다.');
    return null;
  }
}

/**
 * Extract audio from video and upload to S3
 * @param {string} videoPath - Video file path
 * @param {string} title - Audio title
 * @param {string} description - Audio description
 * @param {object} authState - Authentication state
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<{url: string, key: string}>}
 *
 * Location in app.js: Line ~6100
 *
 * TODO: Move implementation from app.js
 */
export async function executeExtractAudioToS3(videoPath, title, description, authState, UIHelpers) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  const { token } = authState;
  if (!token) {
    UIHelpers.showAlert('로그인이 필요합니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '오디오 추출 중...');

  try {
    // Extract audio to temp file
    UIHelpers.updateProgress(30, '오디오 추출 중...');
    const extractResult = await window.electronAPI.extractAudio({
      inputPath: videoPath,
      outputPath: null,
      format: 'mp3'
    });

    // Upload to S3
    UIHelpers.updateProgress(60, 'S3에 업로드 중...');
    const uploadResult = await window.electronAPI.uploadAudioToS3({
      audioPath: extractResult.outputPath,
      token: token,
      title: title || 'Extracted Audio',
      description: description || ''
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('오디오 추출 및 업로드 완료!', 'success');

    return uploadResult;
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 추출 및 업로드', error, '오디오 처리에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Audio Volume Control
// ============================================================================

/**
 * Adjust audio volume
 * @param {string} audioPath - Audio file path
 * @param {number} volume - Volume level (0-2, 1=original)
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadAudioFile - Load audio callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~5800
 *
 * TODO: Move implementation from app.js
 */
export async function executeAdjustVolume(audioPath, volume, UIHelpers, loadAudioFile) {
  if (!audioPath) {
    UIHelpers.showAlert('먼저 오디오를 가져와주세요.');
    return null;
  }

  // Validate volume
  if (volume < 0 || volume > 2) {
    UIHelpers.showAlert('볼륨은 0에서 2 사이여야 합니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '볼륨 조절 중...');

  try {
    const result = await window.electronAPI.adjustVolume({
      inputPath: audioPath,
      outputPath: null,
      volume: volume
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('볼륨 조절 완료!', 'success');

    await loadAudioFile(result.outputPath);

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('볼륨 조절', error, '볼륨 조절에 실패했습니다.');
    return null;
  }
}

/**
 * Preview audio volume change (without processing)
 * @param {number} volume - Volume level (0-2, 1=original)
 */
export function previewAudioVolumeChange(volume) {
  const audio = document.getElementById('preview-audio');
  if (audio) {
    audio.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Stop audio volume preview
 */
export function stopAudioVolumePreview() {
  const audio = document.getElementById('preview-audio');
  if (audio) {
    audio.volume = 1.0;
  }
}

// ============================================================================
// Audio Format Conversion
// ============================================================================

/**
 * Convert audio format
 * @param {string} audioPath - Audio file path
 * @param {string} targetFormat - Target format (mp3, wav, aac, flac)
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadAudioFile - Load audio callback
 * @returns {Promise<{outputPath: string, format: string}>}
 *
 * Location in app.js: Line ~6300
 *
 * TODO: Move implementation from app.js
 */
export async function executeConvertAudioFormat(audioPath, targetFormat, UIHelpers, loadAudioFile) {
  if (!audioPath) {
    UIHelpers.showAlert('먼저 오디오를 가져와주세요.');
    return null;
  }

  const supportedFormats = ['mp3', 'wav', 'aac', 'flac'];
  if (!supportedFormats.includes(targetFormat)) {
    UIHelpers.showAlert(`지원되지 않는 형식입니다. 지원 형식: ${supportedFormats.join(', ')}`);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `${targetFormat.toUpperCase()} 형식으로 변환 중...`);

  try {
    const result = await window.electronAPI.convertAudioFormat({
      inputPath: audioPath,
      outputPath: null,
      format: targetFormat
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('형식 변환 완료!', 'success');

    await loadAudioFile(result.outputPath);

    return {
      outputPath: result.outputPath,
      format: targetFormat
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('형식 변환', error, '형식 변환에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// S3 Upload
// ============================================================================

/**
 * Upload audio to S3
 * @param {string} audioPath - Audio file path
 * @param {string} title - Audio title
 * @param {string} description - Audio description
 * @param {object} authState - Authentication state
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<{url: string, key: string}>}
 *
 * Location in app.js: Line ~11800
 *
 * TODO: Move implementation from app.js
 */
export async function uploadAudioToS3(audioPath, title, description, authState, UIHelpers) {
  const { token } = authState;
  if (!token) {
    UIHelpers.showAlert('로그인이 필요합니다.');
    return null;
  }

  if (!audioPath) {
    UIHelpers.showAlert('업로드할 오디오가 없습니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, 'S3에 업로드 중...');

  try {
    const result = await window.electronAPI.uploadAudioToS3({
      audioPath: audioPath,
      token: token,
      title: title || 'Untitled Audio',
      description: description || ''
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('오디오 업로드 완료!', 'success');

    return result;
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('오디오 업로드', error, '오디오 업로드에 실패했습니다.');
    return null;
  }
}

/**
 * Select audio file for upload
 * @returns {Promise<string|null>} Selected audio file path
 *
 * Location in app.js: Line ~11900
 *
 * TODO: Move implementation from app.js
 */
export async function selectAudioFileForUpload() {
  try {
    const audioPath = await window.electronAPI.selectAudio();
    return audioPath;
  } catch (error) {
    console.error('[AudioOperations] Failed to select audio:', error);
    return null;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate audio format
 * @param {string} format - Audio format
 * @returns {{valid: boolean, error: string}}
 */
export function validateAudioFormat(format) {
  const supportedFormats = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'];

  if (!format) {
    return { valid: false, error: '형식이 지정되지 않았습니다.' };
  }

  if (!supportedFormats.includes(format.toLowerCase())) {
    return {
      valid: false,
      error: `지원되지 않는 형식입니다. 지원 형식: ${supportedFormats.join(', ')}`
    };
  }

  return { valid: true, error: '' };
}

/**
 * Validate volume level
 * @param {number} volume - Volume level
 * @returns {{valid: boolean, error: string}}
 */
export function validateVolume(volume) {
  if (typeof volume !== 'number' || isNaN(volume)) {
    return { valid: false, error: '볼륨 값은 숫자여야 합니다.' };
  }

  if (volume < 0 || volume > 2) {
    return { valid: false, error: '볼륨은 0에서 2 사이여야 합니다.' };
  }

  return { valid: true, error: '' };
}
