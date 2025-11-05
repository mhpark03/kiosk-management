/**
 * VideoOperations.js
 * 비디오 가져오기, 로드, 정보 표시, 타임라인 관리
 *
 * @module VideoOperations
 *
 * NOTE: 이 모듈은 기본 구조와 인터페이스를 제공합니다.
 * app.js의 해당 함수들을 이 모듈로 옮겨주세요.
 */

// ============================================================================
// Video Import
// ============================================================================

/**
 * Import video from local file or S3
 * @param {object} authState - Authentication state {token, user}
 * @param {Function} showLoginModal - Login modal callback
 * @param {Function} showVideoListFromS3 - S3 video list callback
 * @returns {Promise<void>}
 *
 * Location in app.js: Line ~1885
 */
export async function importVideo(authState, showLoginModal, showVideoListFromS3) {
  const { token, user } = authState;

  // Check authentication
  if (!token || !user) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      const videoPath = await window.electronAPI.selectVideo();
      if (!videoPath) return;
      await loadVideoWithAudioCheck(videoPath);
    } else {
      showLoginModal();
    }
    return;
  }

  // Show video list from S3
  await showVideoListFromS3();
}

/**
 * Load video with audio check (add silent audio if missing)
 * @param {string} videoPath - Video file path
 * @param {Function} updateStatus - Status update callback
 * @returns {Promise<{videoPath: string, hasSilentAudio: boolean}>}
 *
 * Location in app.js: Line ~1909
 */
export async function loadVideoWithAudioCheck(videoPath, updateStatus) {
  try {
    console.log('[VideoOperations] Checking audio for:', videoPath);
    updateStatus('영상 오디오 확인 중...');

    const result = await window.electronAPI.ensureVideoHasAudio(videoPath);

    console.log('[VideoOperations] Result:', result);

    if (result.addedAudio) {
      console.log('[VideoOperations] Silent audio track added, new path:', result.videoPath);
      alert('영상에 오디오가 없어 무음 스테레오 트랙이 자동으로 추가되었습니다.');
      updateStatus('무음 오디오 트랙이 추가되었습니다');

      return {
        videoPath: result.videoPath,
        hasSilentAudio: true
      };
    } else {
      console.log('[VideoOperations] Video already has audio:', result.videoPath);
      updateStatus(`영상 로드: ${videoPath}`);

      return {
        videoPath: result.videoPath,
        hasSilentAudio: false
      };
    }
  } catch (error) {
    console.error('[VideoOperations] Error ensuring audio:', error);
    alert('오디오 트랙 추가 중 오류가 발생했습니다. 원본 파일을 로드합니다.');
    updateStatus(`영상 로드: ${videoPath} (오디오 확인 실패)`);

    return {
      videoPath: videoPath,
      hasSilentAudio: false
    };
  }
}

/**
 * Load video into preview
 * @param {string} path - Video file path
 * @param {object} previewManager - PreviewManager instance
 * @param {object} WaveformManager - WaveformManager module
 * @param {Function} updateStatus - Status update callback
 * @returns {Promise<object>} Video info
 *
 * Location in app.js: Line ~1944
 *
 * TODO: Move the full implementation from app.js
 * This is a template showing the interface
 */
export async function loadVideo(path, previewManager, WaveformManager, updateStatus) {
  try {
    // Reset volume preview button if exists
    const previewBtn = document.getElementById('preview-video-volume-btn');
    if (previewBtn) {
      previewBtn.textContent = '🎧 미리듣기';
      previewBtn.classList.remove('active');
    }

    // Load video using PreviewManager
    const videoUrl = `file:///${path.replace(/\\/g, '/')}`;
    previewManager.showVideo(videoUrl, { showInfo: true });

    // Reset volume to original
    const video = previewManager.getMediaElement();
    if (video) {
      video.volume = 1.0;
    }

    // Get video info
    const videoInfo = await window.electronAPI.getVideoInfo(path);

    // Display video info
    displayVideoInfo(videoInfo);

    // Display timeline tracks
    displayTimelineTracks(videoInfo);

    // Generate and display audio waveform
    await WaveformManager.generateAndDisplayWaveform(path, videoInfo, false, updateStatus);

    // Initialize playhead bar
    initializePlayheadBar();

    // Update current file display
    document.getElementById('current-file').textContent = path.split('\\').pop();

    // Reset tool selection
    resetToolSelection();

    // Reset audio related state
    resetAudioState();

    // Hide timeline overlays
    hideTimelineOverlays();

    return videoInfo;
  } catch (error) {
    console.error('[VideoOperations] Failed to load video:', error);
    throw error;
  }
}

/**
 * Display video information
 * @param {object} info - Video information from FFprobe
 *
 * Location in app.js: Line ~2015
 */
export function displayVideoInfo(info) {
  if (!info || !info.streams || !info.format) {
    console.error('[VideoOperations] Invalid video info:', info);
    return;
  }

  const videoStream = info.streams.find(s => s.codec_type === 'video');
  const duration = parseFloat(info.format.duration) || 0;
  const size = (parseFloat(info.format.size || 0) / (1024 * 1024)).toFixed(2);

  let fps = 'N/A';
  let resolution = 'N/A';

  if (videoStream && videoStream.width && videoStream.height) {
    resolution = `${videoStream.width}x${videoStream.height}`;

    if (videoStream.r_frame_rate) {
      try {
        fps = eval(videoStream.r_frame_rate).toFixed(2);
      } catch (e) {
        fps = videoStream.r_frame_rate;
      }
    }
  }

  // Update UI
  const infoElement = document.getElementById('video-info');
  if (infoElement) {
    infoElement.innerHTML = `
      <div><strong>길이:</strong> ${duration.toFixed(2)}초</div>
      <div><strong>해상도:</strong> ${resolution}</div>
      <div><strong>FPS:</strong> ${fps}</div>
      <div><strong>크기:</strong> ${size} MB</div>
    `;
  }
}

/**
 * Display timeline tracks
 * @param {object} info - Video information
 *
 * Location in app.js: Line ~2050
 */
export function displayTimelineTracks(info) {
  const tracksContainer = document.getElementById('timeline-tracks');
  if (!tracksContainer) return;

  // Clear existing tracks
  tracksContainer.innerHTML = '';

  // Find video and audio streams
  const videoStream = info.streams.find(s => s.codec_type === 'video');
  const audioStream = info.streams.find(s => s.codec_type === 'audio');

  // Add video track
  if (videoStream) {
    const videoTrack = document.createElement('div');
    videoTrack.className = 'timeline-track video-track';
    videoTrack.innerHTML = `
      <div class="track-label">Video</div>
      <div class="track-content"></div>
    `;
    tracksContainer.appendChild(videoTrack);
  }

  // Add audio track
  if (audioStream) {
    const audioTrack = document.createElement('div');
    audioTrack.className = 'timeline-track audio-track';
    audioTrack.id = 'audio-track';
    audioTrack.innerHTML = `
      <div class="track-label">Audio</div>
      <div class="track-content">
        <img id="audio-waveform" style="display:none; width:100%; height:100%; object-fit:fill;">
      </div>
    `;
    tracksContainer.appendChild(audioTrack);
  }
}

// ============================================================================
// Playhead Control
// ============================================================================

/**
 * Update playhead bar position
 * @param {number} currentTime - Current time in seconds
 * @param {number} duration - Total duration in seconds
 *
 * Location in app.js: Line ~2165
 */
export function updatePlayheadPosition(currentTime, duration) {
  const playheadBar = document.getElementById('playhead-bar');
  if (!playheadBar) return;

  const totalPercentage = currentTime / duration;
  const finalLeft = totalPercentage * 100;

  playheadBar.style.left = `${Math.min(Math.max(finalLeft, 0), 100)}%`;
}

/**
 * Setup playhead interaction (click and drag)
 * @param {object} videoInfo - Video information
 *
 * Location in app.js: Line ~2217
 *
 * TODO: Move the full implementation from app.js
 */
export function setupPlayheadInteraction(videoInfo) {
  const audioTrack = document.getElementById('audio-track');
  const playheadBar = document.getElementById('playhead-bar');

  if (!audioTrack || !playheadBar) {
    console.error('[VideoOperations] Required elements not found');
    return;
  }

  // Remove existing listeners (if any)
  const newAudioTrack = audioTrack.cloneNode(true);
  audioTrack.parentNode.replaceChild(newAudioTrack, audioTrack);

  // Add click listener
  newAudioTrack.addEventListener('click', (e) => {
    handleTimelineClick(e, videoInfo);
  });

  // Add drag listener
  let isDragging = false;

  newAudioTrack.addEventListener('mousedown', (e) => {
    isDragging = true;
    handleTimelineClick(e, videoInfo);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleTimelineDrag(e, newAudioTrack, videoInfo);
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  console.log('[VideoOperations] Playhead interaction setup complete');
}

/**
 * Handle timeline click
 * @param {MouseEvent} e - Click event
 * @param {object} videoInfo - Video information
 */
function handleTimelineClick(e, videoInfo) {
  const audioTrack = e.currentTarget;
  const rect = audioTrack.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const percentage = clickX / rect.width;

  const duration = parseFloat(videoInfo.format.duration);
  const targetTime = percentage * duration;

  // Seek to clicked time
  const video = document.getElementById('preview-video');
  if (video) {
    video.currentTime = targetTime;
  }
}

/**
 * Handle timeline drag
 * @param {MouseEvent} e - Mouse move event
 * @param {HTMLElement} audioTrack - Audio track element
 * @param {object} videoInfo - Video information
 */
function handleTimelineDrag(e, audioTrack, videoInfo) {
  const rect = audioTrack.getBoundingClientRect();
  const dragX = e.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, dragX / rect.width));

  const duration = parseFloat(videoInfo.format.duration);
  const targetTime = percentage * duration;

  const video = document.getElementById('preview-video');
  if (video) {
    video.currentTime = targetTime;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function initializePlayheadBar() {
  const playheadBar = document.getElementById('playhead-bar');
  if (playheadBar) {
    playheadBar.style.display = 'block';
    playheadBar.style.left = '0%';
  }
}

function resetToolSelection() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const toolProperties = document.getElementById('tool-properties');
  if (toolProperties) {
    toolProperties.innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';
  }
}

function resetAudioState() {
  // This would reset audio-related state variables
  // Implementation depends on app.js structure
}

function hideTimelineOverlays() {
  const trimOverlay = document.getElementById('trim-range-overlay');
  const audioOverlay = document.getElementById('audio-range-overlay');
  const textOverlay = document.getElementById('text-range-overlay');

  if (trimOverlay) trimOverlay.style.display = 'none';
  if (audioOverlay) audioOverlay.style.display = 'none';
  if (textOverlay) textOverlay.style.display = 'none';
}

// ============================================================================
// S3 Video List (placeholder)
// ============================================================================

/**
 * Show video list from S3
 * @param {string} token - Auth token
 * @param {string} backendUrl - Backend base URL
 *
 * TODO: Implement or import from existing module
 */
export async function showVideoListFromS3(token, backendUrl) {
  // This function would show a modal with video list from S3
  // Implementation depends on backend API structure
  console.log('[VideoOperations] Show S3 video list');
}
