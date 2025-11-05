/**
 * UploadOperations.js
 * S3 업로드 및 백엔드 연동
 *
 * @module UploadOperations
 *
 * NOTE: 이 모듈은 기본 구조와 인터페이스를 제공합니다.
 * app.js의 해당 함수들을 이 모듈로 옮겨주세요.
 */

// ============================================================================
// Video Upload to S3
// ============================================================================

/**
 * Upload video to S3
 * @param {string} videoPath - Video file path
 * @param {string} title - Video title
 * @param {string} description - Video description
 * @param {object} authState - Authentication state {token, user}
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<{url: string, key: string, id: number}>}
 *
 * Location in app.js: Line ~11632
 *
 * TODO: Move implementation from app.js
 */
export async function uploadVideoToS3(videoPath, title, description, authState, UIHelpers) {
  const { token } = authState;

  if (!token) {
    UIHelpers.showAlert('로그인이 필요합니다.');
    return null;
  }

  if (!videoPath) {
    UIHelpers.showAlert('업로드할 비디오가 없습니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, 'S3에 업로드 중...');

  try {
    const result = await window.electronAPI.uploadVideoToS3({
      videoPath: videoPath,
      token: token,
      title: title || 'Untitled Video',
      description: description || ''
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('비디오 업로드 완료!', 'success');
    UIHelpers.showCustomDialog(`비디오 업로드 완료!\n\nID: ${result.id}\n제목: ${title}`);

    return result;
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('비디오 업로드', error, '비디오 업로드에 실패했습니다.');
    return null;
  }
}

/**
 * Select video file for upload
 * @returns {Promise<string|null>} Selected video file path
 *
 * Location in app.js: Line ~11750
 *
 * TODO: Move implementation from app.js
 */
export async function selectVideoFileForUpload() {
  try {
    const videoPath = await window.electronAPI.selectVideo();
    return videoPath;
  } catch (error) {
    console.error('[UploadOperations] Failed to select video:', error);
    return null;
  }
}

// ============================================================================
// Audio Upload to S3
// ============================================================================

/**
 * Upload audio to S3
 * @param {string} audioPath - Audio file path
 * @param {string} title - Audio title
 * @param {string} description - Audio description
 * @param {object} authState - Authentication state
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<{url: string, key: string, id: number}>}
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
    console.error('[UploadOperations] Failed to select audio:', error);
    return null;
  }
}

// ============================================================================
// Image Upload to S3
// ============================================================================

/**
 * Upload image to S3
 * @param {string} imagePath - Image file path
 * @param {string} title - Image title
 * @param {string} description - Image description
 * @param {object} authState - Authentication state
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<{url: string, key: string, id: number}>}
 *
 * TODO: Add this functionality to app.js or implement here
 */
export async function uploadImageToS3(imagePath, title, description, authState, UIHelpers) {
  const { token } = authState;

  if (!token) {
    UIHelpers.showAlert('로그인이 필요합니다.');
    return null;
  }

  if (!imagePath) {
    UIHelpers.showAlert('업로드할 이미지가 없습니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, 'S3에 업로드 중...');

  try {
    const result = await window.electronAPI.uploadImageToS3({
      imagePath: imagePath,
      token: token,
      title: title || 'Untitled Image',
      description: description || ''
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('이미지 업로드 완료!', 'success');

    return result;
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('이미지 업로드', error, '이미지 업로드에 실패했습니다.');
    return null;
  }
}

/**
 * Select image file for upload
 * @returns {Promise<string|null>} Selected image file path
 */
export async function selectImageFileForUpload() {
  try {
    const imagePath = await window.electronAPI.selectImage();
    return imagePath;
  } catch (error) {
    console.error('[UploadOperations] Failed to select image:', error);
    return null;
  }
}

// ============================================================================
// S3 Video List
// ============================================================================

/**
 * Get video list from S3
 * @param {object} authState - Authentication state
 * @param {string} backendUrl - Backend base URL
 * @returns {Promise<Array<object>>} List of videos
 *
 * Location in app.js: Line ~1000
 *
 * TODO: Move implementation from app.js
 */
export async function getS3VideoList(authState, backendUrl) {
  const { token } = authState;

  if (!token) {
    console.error('[UploadOperations] No authentication token');
    return [];
  }

  try {
    const response = await fetch(`${backendUrl}/api/videos/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const videos = await response.json();
    return videos;
  } catch (error) {
    console.error('[UploadOperations] Failed to get video list:', error);
    return [];
  }
}

/**
 * Show video list modal from S3
 * @param {object} authState - Authentication state
 * @param {string} backendUrl - Backend base URL
 * @param {Function} onSelectVideo - Callback when video is selected
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<void>}
 *
 * Location in app.js: Line ~1050
 *
 * TODO: Move implementation from app.js
 */
export async function showVideoListFromS3(authState, backendUrl, onSelectVideo, UIHelpers) {
  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '비디오 목록 가져오는 중...');

  try {
    const videos = await getS3VideoList(authState, backendUrl);

    UIHelpers.hideProgress();

    if (videos.length === 0) {
      UIHelpers.showAlert('저장된 비디오가 없습니다.');
      return;
    }

    // Show video list modal
    const modal = createVideoListModal(videos, onSelectVideo, UIHelpers);
    document.body.appendChild(modal);
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('비디오 목록 가져오기', error, '비디오 목록을 가져오는데 실패했습니다.');
  }
}

/**
 * Create video list modal
 * @param {Array<object>} videos - Video list
 * @param {Function} onSelectVideo - Callback when video is selected
 * @param {object} UIHelpers - UI helpers module
 * @returns {HTMLElement} Modal element
 */
function createVideoListModal(videos, onSelectVideo, UIHelpers) {
  const modal = document.createElement('div');
  modal.className = 'video-list-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 80%;
    max-height: 80%;
    overflow-y: auto;
  `;

  const title = document.createElement('h2');
  title.textContent = 'S3 비디오 목록';
  content.appendChild(title);

  const list = document.createElement('div');
  list.className = 'video-list';

  videos.forEach(video => {
    const item = document.createElement('div');
    item.className = 'video-list-item';
    item.style.cssText = `
      padding: 10px;
      margin: 5px 0;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
    `;
    item.innerHTML = `
      <div><strong>${video.title}</strong></div>
      <div style="font-size: 0.9em; color: #666;">${video.description || ''}</div>
      <div style="font-size: 0.8em; color: #999;">ID: ${video.id}</div>
    `;

    item.addEventListener('click', async () => {
      modal.remove();
      if (onSelectVideo) {
        await onSelectVideo(video);
      }
    });

    list.appendChild(item);
  });

  content.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '닫기';
  closeBtn.style.cssText = `
    margin-top: 10px;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  closeBtn.addEventListener('click', () => modal.remove());

  content.appendChild(closeBtn);
  modal.appendChild(content);

  return modal;
}

// ============================================================================
// Download from S3
// ============================================================================

/**
 * Download video from S3 to local
 * @param {number} videoId - Video ID
 * @param {object} authState - Authentication state
 * @param {string} backendUrl - Backend base URL
 * @param {object} UIHelpers - UI helpers module
 * @returns {Promise<string|null>} Downloaded file path
 *
 * TODO: Implement this functionality
 */
export async function downloadVideoFromS3(videoId, authState, backendUrl, UIHelpers) {
  const { token } = authState;

  if (!token) {
    UIHelpers.showAlert('로그인이 필요합니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, 'S3에서 다운로드 중...');

  try {
    const result = await window.electronAPI.downloadVideoFromS3({
      videoId: videoId,
      token: token,
      backendUrl: backendUrl
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('다운로드 완료!', 'success');

    return result.localPath;
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('비디오 다운로드', error, '비디오 다운로드에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Upload Progress Tracking
// ============================================================================

/**
 * Track upload progress
 * @param {Function} onProgress - Progress callback (percent, message)
 * @returns {Function} Progress updater function
 */
export function createUploadProgressTracker(onProgress) {
  let lastPercent = 0;

  return (loaded, total) => {
    const percent = Math.round((loaded / total) * 100);

    // Only update if percent changed
    if (percent !== lastPercent) {
      lastPercent = percent;
      if (onProgress) {
        onProgress(percent, `업로드 중... ${percent}%`);
      }
    }
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate file for upload
 * @param {string} filePath - File path
 * @param {string} fileType - File type (video, audio, image)
 * @returns {{valid: boolean, error: string}}
 */
export function validateFileForUpload(filePath, fileType) {
  if (!filePath) {
    return { valid: false, error: '파일 경로가 지정되지 않았습니다.' };
  }

  // Check file extension
  const validExtensions = {
    video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'],
    audio: ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  };

  const extensions = validExtensions[fileType];
  if (!extensions) {
    return { valid: false, error: '유효하지 않은 파일 타입입니다.' };
  }

  const fileExt = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  if (!extensions.includes(fileExt)) {
    return {
      valid: false,
      error: `지원되지 않는 파일 형식입니다. 지원 형식: ${extensions.join(', ')}`
    };
  }

  return { valid: true, error: '' };
}

/**
 * Validate upload metadata
 * @param {string} title - Upload title
 * @param {string} description - Upload description
 * @returns {{valid: boolean, error: string}}
 */
export function validateUploadMetadata(title, description) {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: '제목을 입력해주세요.' };
  }

  if (title.length > 200) {
    return { valid: false, error: '제목은 200자를 초과할 수 없습니다.' };
  }

  if (description && description.length > 1000) {
    return { valid: false, error: '설명은 1000자를 초과할 수 없습니다.' };
  }

  return { valid: true, error: '' };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get file size in human-readable format
 * @param {string} filePath - File path
 * @returns {Promise<string>} File size (e.g., "15.2 MB")
 */
export async function getFileSize(filePath) {
  try {
    const stats = await window.electronAPI.getFileStats(filePath);
    const bytes = stats.size;

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  } catch (error) {
    console.error('[UploadOperations] Failed to get file size:', error);
    return 'Unknown';
  }
}

/**
 * Get file name from path
 * @param {string} filePath - File path
 * @returns {string} File name
 */
export function getFileName(filePath) {
  if (!filePath) return '';
  return filePath.split(/[/\\]/).pop();
}

/**
 * Get file extension from path
 * @param {string} filePath - File path
 * @returns {string} File extension (with dot)
 */
export function getFileExtension(filePath) {
  if (!filePath) return '';
  const fileName = getFileName(filePath);
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.substring(lastDotIndex) : '';
}

/**
 * Generate upload summary
 * @param {string} filePath - File path
 * @param {string} title - Upload title
 * @param {string} fileType - File type
 * @returns {Promise<string>} Summary text
 */
export async function generateUploadSummary(filePath, title, fileType) {
  const fileName = getFileName(filePath);
  const fileSize = await getFileSize(filePath);

  return `파일명: ${fileName}\n제목: ${title}\n타입: ${fileType}\n크기: ${fileSize}`;
}
