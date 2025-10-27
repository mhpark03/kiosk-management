// State management
let currentVideo = null;
let videoInfo = null;
let activeTool = null;
let videoLayers = [];
let audioLayers = [];

// 공통 오류 처리 함수
function handleError(operation, error, userMessage) {
  // 콘솔에 상세한 오류 정보 기록
  console.error(`=== ${operation} 오류 ===`);
  console.error('오류 메시지:', error.message);
  console.error('전체 오류 객체:', error);
  if (error.stack) {
    console.error('스택 트레이스:', error.stack);
  }
  console.error('=====================');

  // 사용자에게는 간단한 한글 메시지 표시
  alert(`${userMessage}\n\n상세한 오류 내용은 콘솔 로그를 확인해주세요.\n(우측 속성 패널의 콘솔 로그 또는 F12 개발자 도구)`);
  updateStatus(`${operation} 실패`);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupToolButtons();
  setupVideoControls();
  setupFFmpegProgressListener();
  setupLogListener();
  setupClearLogsButton();
  updateStatus('준비 완료');
});

// Setup tool buttons
function setupToolButtons() {
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      selectTool(tool);
    });
  });
}

// Select tool
function selectTool(tool) {
  // 영상 가져오기를 제외한 모든 도구는 영상이 로드되지 않았으면 선택 불가
  if (tool !== 'import' && !currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  activeTool = tool;

  // Update active button
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');

  // Hide trim range overlay when switching tools
  if (tool !== 'trim') {
    const overlay = document.getElementById('trim-range-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // Hide audio range overlay when switching tools
  if (tool !== 'add-audio') {
    const audioOverlay = document.getElementById('audio-range-overlay');
    if (audioOverlay) {
      audioOverlay.style.display = 'none';
    }
  }

  // Show tool properties
  showToolProperties(tool);

  updateStatus(`도구 선택: ${tool}`);
}

// Show tool properties panel
function showToolProperties(tool) {
  const propertiesPanel = document.getElementById('tool-properties');

  switch (tool) {
    case 'import':
      importVideo();
      break;

    case 'trim':
      const maxDuration = videoInfo ? parseFloat(videoInfo.format.duration) : 100;
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>시작 시간 (초)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="trim-start" min="0" max="${maxDuration}" step="0.1" value="0" oninput="updateTrimEndMax()" style="flex: 1;">
            <button class="property-btn secondary" onclick="setStartFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 시작 시간으로">🔄</button>
            <button class="property-btn secondary" onclick="previewStartTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="시작 위치로 이동">▶️</button>
          </div>
          <small style="color: #888; font-size: 11px;">최대: ${maxDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group">
          <label>끝 시간 (초)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="trim-end" min="0" max="${maxDuration}" step="0.1" value="${maxDuration.toFixed(2)}" style="flex: 1;">
            <button class="property-btn secondary" onclick="setEndFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 끝 시간으로">🔄</button>
            <button class="property-btn secondary" onclick="previewEndTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="끝 위치로 이동">▶️</button>
          </div>
          <small style="color: #888; font-size: 11px;">최대: ${maxDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group" style="background: #2d2d2d; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <label style="color: #667eea;">자르기 구간 길이</label>
          <div id="trim-duration-display" style="font-size: 16px; font-weight: 600; color: #e0e0e0; margin-top: 5px;">0.00초</div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="previewTrimRange()" style="flex: 1;">🎬 구간 미리보기</button>
        </div>
        <button class="property-btn" onclick="executeTrim()">영상 자르기</button>
      `;
      // Add event listeners for real-time duration calculation
      setTimeout(() => {
        document.getElementById('trim-start').addEventListener('input', updateTrimDurationDisplay);
        document.getElementById('trim-end').addEventListener('input', updateTrimDurationDisplay);
        updateTrimDurationDisplay();
      }, 0);
      break;

    case 'merge':
      // 현재 로드된 영상이 있으면 병합 리스트에 자동 추가
      if (currentVideo && !mergeVideos.includes(currentVideo)) {
        mergeVideos = [currentVideo]; // 현재 영상을 첫 번째로 설정
      }

      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>병합할 영상들</label>
          <div id="merge-files" class="file-list"></div>
          <button class="property-btn secondary" onclick="addVideoToMerge()">+ 영상 추가</button>
        </div>
        <div class="property-group">
          <label>트랜지션</label>
          <select id="merge-transition">
            <option value="concat">없음 (이어붙이기)</option>
            <option value="xfade">크로스페이드</option>
          </select>
        </div>
        <div class="property-group">
          <label>트랜지션 지속시간 (초)</label>
          <input type="number" id="merge-duration" min="0.5" max="3" step="0.1" value="1">
        </div>
        <button class="property-btn" onclick="executeMerge()">영상 병합</button>
      `;

      // 파일 리스트 업데이트
      updateMergeFileList();
      break;

    case 'add-audio':
      const videoDuration = videoInfo ? parseFloat(videoInfo.format.duration) : 100;
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>오디오 파일</label>
          <button class="property-btn secondary" onclick="selectAudioFile()">오디오 선택</button>
          <div id="selected-audio" style="margin-top: 10px; color: #aaa; font-size: 13px;"></div>
        </div>
        <div class="property-group">
          <label>시작 시간 (초)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="audio-start-time" min="0" max="${videoDuration}" step="0.1" value="0" oninput="updateAudioRangeOverlay()" style="flex: 1;">
            <button class="property-btn secondary" onclick="setAudioStartFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 시작 시간으로">🔄</button>
            <button class="property-btn secondary" onclick="previewAudioStartTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="시작 위치로 이동">▶️</button>
          </div>
          <small style="color: #888; font-size: 11px;">오디오가 삽입될 영상의 시작 위치 (최대: ${videoDuration.toFixed(2)}초)</small>
        </div>
        <div class="property-group">
          <label>볼륨 <span class="property-value" id="volume-value">1.0</span></label>
          <input type="range" id="audio-volume" min="0" max="2" step="0.1" value="1" oninput="updateVolumeDisplay()">
        </div>
        <button class="property-btn" onclick="executeAddAudio()">오디오 추가</button>
      `;
      break;

    case 'extract-audio':
      propertiesPanel.innerHTML = `
        <p style="margin-bottom: 20px;">현재 영상에서 오디오를 추출합니다.</p>
        <button class="property-btn" onclick="executeExtractAudio()">오디오 추출</button>
      `;
      break;

    case 'volume':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>볼륨 조절 <span class="property-value" id="volume-adjust-value">1.0</span></label>
          <input type="range" id="volume-adjust" min="0" max="3" step="0.1" value="1" oninput="updateVolumeAdjustDisplay()">
          <small style="color: #888;">1.0 = 원본, 2.0 = 2배 증폭</small>
        </div>
        <button class="property-btn" onclick="executeVolumeAdjust()">볼륨 적용</button>
      `;
      break;

    case 'filter':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>필터 종류</label>
          <select id="filter-type" onchange="updateFilterControls()">
            <option value="brightness">밝기</option>
            <option value="contrast">대비</option>
            <option value="saturation">채도</option>
            <option value="blur">블러</option>
            <option value="sharpen">샤픈</option>
          </select>
        </div>
        <div id="filter-controls"></div>
        <button class="property-btn" onclick="executeFilter()">필터 적용</button>
      `;
      updateFilterControls();
      break;

    case 'text':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>텍스트</label>
          <textarea id="text-content" placeholder="입력할 텍스트"></textarea>
        </div>
        <div class="property-group">
          <label>폰트 크기</label>
          <input type="number" id="text-size" min="10" max="200" value="48">
        </div>
        <div class="property-group">
          <label>색상</label>
          <input type="color" id="text-color" value="#ffffff">
        </div>
        <div class="property-group">
          <label>위치 X (픽셀, 비워두면 중앙)</label>
          <input type="text" id="text-x" placeholder="(w-text_w)/2">
        </div>
        <div class="property-group">
          <label>위치 Y (픽셀, 비워두면 중앙)</label>
          <input type="text" id="text-y" placeholder="(h-text_h)/2">
        </div>
        <div class="property-group">
          <label>시작 시간 (초, 비워두면 전체)</label>
          <input type="number" id="text-start" min="0" step="0.1" placeholder="선택사항">
        </div>
        <div class="property-group">
          <label>지속 시간 (초, 비워두면 끝까지)</label>
          <input type="number" id="text-duration" min="0.1" step="0.1" placeholder="선택사항">
        </div>
        <button class="property-btn" onclick="executeAddText()">텍스트 추가</button>
      `;
      break;

    case 'speed':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>속도 배율 <span class="property-value" id="speed-value">1.0x</span></label>
          <input type="range" id="speed-factor" min="0.25" max="4" step="0.25" value="1" oninput="updateSpeedDisplay()">
          <small style="color: #888;">0.5x = 슬로우모션, 2.0x = 배속</small>
        </div>
        <button class="property-btn" onclick="executeSpeed()">속도 적용</button>
      `;
      break;

    case 'export':
      showExportDialog();
      break;

    default:
      propertiesPanel.innerHTML = '<p class="placeholder-text">이 도구는 아직 구현되지 않았습니다.</p>';
  }
}

// Setup video controls
function setupVideoControls() {
  const video = document.getElementById('preview-video');
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const slider = document.getElementById('timeline-slider');
  const currentTimeDisplay = document.getElementById('current-time');

  playBtn.addEventListener('click', () => {
    // 영상 자르기 모드에서는 시작 시간부터 재생
    if (activeTool === 'trim') {
      const startInput = document.getElementById('trim-start');
      if (startInput) {
        const startTime = parseFloat(startInput.value) || 0;
        const endInput = document.getElementById('trim-end');
        const endTime = endInput ? (parseFloat(endInput.value) || video.duration) : video.duration;

        // 현재 시간이 범위 밖이면 시작 시간으로 이동
        if (video.currentTime < startTime || video.currentTime >= endTime) {
          video.currentTime = startTime;
        }
      }
    }

    // 오디오 삽입 모드에서는 오디오 시작 시간부터 재생
    if (activeTool === 'add-audio') {
      const audioStartInput = document.getElementById('audio-start-time');
      if (audioStartInput && selectedAudioFile && selectedAudioDuration > 0) {
        const audioStartTime = parseFloat(audioStartInput.value) || 0;
        const endTime = Math.min(audioStartTime + selectedAudioDuration, video.duration);

        // 현재 시간이 오디오 범위 밖이면 시작 시간으로 이동
        if (video.currentTime < audioStartTime || video.currentTime >= endTime) {
          video.currentTime = audioStartTime;
        }

        // Play audio synchronized with video
        playAudioPreview(audioStartTime);
      }
    }

    video.play();
  });

  pauseBtn.addEventListener('click', () => {
    video.pause();
    // Stop audio preview when pausing
    if (audioPreviewElement) {
      audioPreviewElement.pause();
    }
  });

  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      const progress = (video.currentTime / video.duration) * 100;
      slider.value = progress;
      currentTimeDisplay.textContent = formatTime(video.currentTime);

      // 영상 자르기 모드에서는 설정된 범위 내에서만 재생
      if (activeTool === 'trim') {
        const startInput = document.getElementById('trim-start');
        const endInput = document.getElementById('trim-end');

        if (startInput && endInput) {
          const startTime = parseFloat(startInput.value) || 0;
          const endTime = parseFloat(endInput.value) || video.duration;

          // 끝 시간을 초과하면 일시정지 (1회 재생)
          if (video.currentTime >= endTime) {
            video.pause();
            video.currentTime = endTime;
          }
        }
      }

      // 오디오 삽입 모드에서는 오디오 구간만 재생
      if (activeTool === 'add-audio') {
        const audioStartInput = document.getElementById('audio-start-time');
        if (audioStartInput && selectedAudioFile && selectedAudioDuration > 0) {
          const startTime = parseFloat(audioStartInput.value) || 0;
          const endTime = Math.min(startTime + selectedAudioDuration, video.duration);

          // 오디오 구간 끝을 초과하면 일시정지
          if (video.currentTime >= endTime) {
            video.pause();
            video.currentTime = endTime;
            // Stop audio preview
            if (audioPreviewElement) {
              audioPreviewElement.pause();
            }
          }
        }
      }
    }
  });

  slider.addEventListener('input', (e) => {
    if (video.duration) {
      const time = (e.target.value / 100) * video.duration;
      video.currentTime = time;
    }
  });

  video.addEventListener('loadedmetadata', () => {
    playBtn.disabled = false;
    pauseBtn.disabled = false;
    slider.disabled = false;
  });
}

// Import video
async function importVideo() {
  const videoPath = await window.electronAPI.selectVideo();
  if (!videoPath) return;

  currentVideo = videoPath;
  loadVideo(videoPath);
  updateStatus(`영상 로드: ${videoPath}`);
}

// Load video
async function loadVideo(path) {
  try {
    const video = document.getElementById('preview-video');
    const placeholder = document.getElementById('preview-placeholder');

    // Load video
    video.src = `file:///${path.replace(/\\/g, '/')}`;
    video.style.display = 'block';
    placeholder.style.display = 'none';

    // Get video info
    videoInfo = await window.electronAPI.getVideoInfo(path);
    displayVideoInfo(videoInfo);
    displayTimelineTracks(videoInfo);

    document.getElementById('current-file').textContent = path.split('\\').pop();

    // 도구 선택 초기화 (영상 자르기 설정 제거)
    activeTool = null;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById('tool-properties').innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';
  } catch (error) {
    handleError('영상 로드', error, '영상을 불러오는데 실패했습니다.');
  }
}

// Display video info
function displayVideoInfo(info) {
  const videoStream = info.streams.find(s => s.codec_type === 'video');
  const duration = parseFloat(info.format.duration);
  const size = (parseFloat(info.format.size) / (1024 * 1024)).toFixed(2);

  document.getElementById('info-duration').textContent = formatTime(duration);
  document.getElementById('info-resolution').textContent = `${videoStream.width}x${videoStream.height}`;
  document.getElementById('info-fps').textContent = `${eval(videoStream.r_frame_rate).toFixed(2)} fps`;
  document.getElementById('info-size').textContent = `${size} MB`;
  document.getElementById('video-info').style.display = 'flex';
}

// Display timeline tracks
function displayTimelineTracks(info) {
  const duration = parseFloat(info.format.duration);
  const videoStream = info.streams.find(s => s.codec_type === 'video');
  const audioStream = info.streams.find(s => s.codec_type === 'audio');

  // Clear existing tracks
  document.getElementById('video-track').innerHTML = '';
  document.getElementById('audio-track').innerHTML = '';

  // Add video track
  if (videoStream) {
    const videoTrack = document.getElementById('video-track');
    const videoClip = document.createElement('div');
    videoClip.className = 'timeline-clip video-clip';
    videoClip.style.width = '100%';
    videoClip.innerHTML = `
      <div class="clip-label">Video</div>
      <div class="clip-duration">${formatTime(duration)}</div>
    `;
    videoTrack.appendChild(videoClip);
  }

  // Add audio track
  if (audioStream) {
    const audioTrack = document.getElementById('audio-track');
    const audioClip = document.createElement('div');
    audioClip.className = 'timeline-clip audio-clip';
    audioClip.style.width = '100%';
    audioClip.innerHTML = `
      <div class="clip-label">Audio</div>
      <div class="clip-duration">${formatTime(duration)}</div>
    `;
    audioTrack.appendChild(audioClip);
  }
}

// Update trim duration display
function updateTrimDurationDisplay() {
  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');
  const display = document.getElementById('trim-duration-display');

  if (!startInput || !endInput || !display) return;

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
  if (endTime <= startTime) {
    display.style.color = '#dc3545';
    display.textContent += ' (끝 시간이 시작 시간보다 커야 함)';
  } else if (duration < 0.1) {
    display.style.color = '#ffc107';
    display.textContent += ' (최소 0.1초 이상)';
  } else if (startTime >= maxDuration) {
    display.style.color = '#dc3545';
    display.textContent += ' (시작 시간이 영상 길이 초과)';
  } else if (endTime > maxDuration) {
    display.style.color = '#dc3545';
    display.textContent += ' (끝 시간이 영상 길이 초과)';
  } else {
    display.style.color = '#28a745';
    display.textContent += ' ✓';
  }

  // Update timeline range overlay
  updateTrimRangeOverlay(startTime, endTime, maxDuration);
}

// Update trim range overlay on timeline
function updateTrimRangeOverlay(startTime, endTime, maxDuration) {
  const overlay = document.getElementById('trim-range-overlay');
  if (!overlay || !videoInfo) return;

  // Show overlay only in trim mode
  if (activeTool === 'trim') {
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

// Update trim end max value based on start time
function updateTrimEndMax() {
  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');

  if (!startInput || !endInput || !videoInfo) return;

  const maxDuration = parseFloat(videoInfo.format.duration);
  let startTime = parseFloat(startInput.value) || 0;
  let endTime = parseFloat(endInput.value) || 0;

  // Clamp start time
  startTime = Math.max(0, Math.min(startTime, maxDuration - 0.1));
  startInput.value = startTime.toFixed(2);

  // Ensure end time is at least greater than start time
  if (endTime <= startTime) {
    endTime = Math.min(startTime + 1, maxDuration);
    endInput.value = endTime.toFixed(2);
  }

  // Clamp end time
  if (endTime > maxDuration) {
    endTime = maxDuration;
    endInput.value = endTime.toFixed(2);
  }

  updateTrimDurationDisplay();
}

// Set start time from current video position
function setStartFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-start');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  startInput.value = currentTime.toFixed(2);

  // Update end time if needed
  updateTrimEndMax();
  updateTrimDurationDisplay();

  updateStatus(`시작 시간 설정: ${formatTime(currentTime)}`);
}

// Set end time from current video position
function setEndFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const endInput = document.getElementById('trim-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  endInput.value = currentTime.toFixed(2);

  updateTrimDurationDisplay();

  updateStatus(`끝 시간 설정: ${formatTime(currentTime)}`);
}

// Preview functions for trim
function previewStartTime() {
  const startInput = document.getElementById('trim-start');
  const video = document.getElementById('preview-video');
  const currentTimeDisplay = document.getElementById('current-time');
  const slider = document.getElementById('timeline-slider');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const startTime = parseFloat(startInput.value) || 0;

  // Clamp to valid range
  const maxDuration = video.duration;
  const targetTime = Math.min(startTime, maxDuration);

  // Move video to start time
  video.currentTime = targetTime;
  video.pause();

  // Wait for video to update, then sync UI
  setTimeout(() => {
    // Update timeline slider
    if (video.duration && slider) {
      const progress = (video.currentTime / video.duration) * 100;
      slider.value = progress;
    }

    // Update current time display
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = formatTime(video.currentTime);
    }

    updateStatus(`시작 위치로 이동: ${formatTime(video.currentTime)}`);
  }, 50);
}

function previewEndTime() {
  const endInput = document.getElementById('trim-end');
  const video = document.getElementById('preview-video');
  const currentTimeDisplay = document.getElementById('current-time');
  const slider = document.getElementById('timeline-slider');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const endTime = parseFloat(endInput.value) || 0;

  // Clamp to valid range
  const maxDuration = video.duration;
  const targetTime = Math.min(endTime, maxDuration);

  // Move video to end time
  video.currentTime = targetTime;
  video.pause();

  // Wait for video to update, then sync UI
  setTimeout(() => {
    // Update timeline slider
    if (video.duration && slider) {
      const progress = (video.currentTime / video.duration) * 100;
      slider.value = progress;
    }

    // Update current time display
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = formatTime(video.currentTime);
    }

    updateStatus(`끝 위치로 이동: ${formatTime(video.currentTime)}`);
  }, 50);
}

// Set audio start time from current video time
function setAudioStartFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('audio-start-time');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (!startInput) {
    return;
  }

  const currentTime = video.currentTime;
  startInput.value = currentTime.toFixed(2);
  updateAudioRangeOverlay();
  updateStatus(`오디오 시작 시간 설정: ${formatTime(currentTime)}`);
}

// Preview audio start time
function previewAudioStartTime() {
  const startInput = document.getElementById('audio-start-time');
  const video = document.getElementById('preview-video');
  const currentTimeDisplay = document.getElementById('current-time');
  const slider = document.getElementById('timeline-slider');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (!startInput) {
    return;
  }

  const startTime = parseFloat(startInput.value) || 0;
  const maxDuration = video.duration;
  const targetTime = Math.min(startTime, maxDuration);

  video.currentTime = targetTime;
  video.pause();

  setTimeout(() => {
    if (video.duration && slider) {
      const progress = (video.currentTime / video.duration) * 100;
      slider.value = progress;
    }

    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = formatTime(video.currentTime);
    }

    updateStatus(`오디오 시작 위치로 이동: ${formatTime(video.currentTime)}`);
  }, 50);
}

function previewTrimRange() {
  const startTime = parseFloat(document.getElementById('trim-start').value) || 0;
  const endTime = parseFloat(document.getElementById('trim-end').value) || 0;
  const video = document.getElementById('preview-video');
  const currentTimeDisplay = document.getElementById('current-time');
  const slider = document.getElementById('timeline-slider');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (endTime <= startTime) {
    alert('끝 시간은 시작 시간보다 커야 합니다.');
    return;
  }

  // Move to start position and play
  video.currentTime = startTime;
  video.play();

  // Update timeline slider
  if (video.duration && slider) {
    const progress = (startTime / video.duration) * 100;
    slider.value = progress;
  }

  // Update current time display
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(startTime);
  }

  // Stop at end position
  const checkTime = setInterval(() => {
    if (video.currentTime >= endTime) {
      video.pause();
      clearInterval(checkTime);

      // Update timeline to end position
      if (video.duration && slider) {
        const progress = (endTime / video.duration) * 100;
        slider.value = progress;
      }

      // Update current time display
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(endTime);
      }

      updateStatus(`구간 재생 완료 (${formatTime(startTime)} ~ ${formatTime(endTime)})`);
    }
  }, 100);

  updateStatus(`구간 재생 중: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);
}

// Execute trim
async function executeTrim() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (!videoInfo) {
    alert('영상 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  const maxDuration = parseFloat(videoInfo.format.duration);
  const startTime = parseFloat(document.getElementById('trim-start').value);
  const endTime = parseFloat(document.getElementById('trim-end').value);

  // Comprehensive validation
  if (isNaN(startTime) || isNaN(endTime)) {
    alert('유효한 숫자를 입력해주세요.');
    return;
  }

  if (startTime < 0) {
    alert('시작 시간은 0보다 작을 수 없습니다.');
    return;
  }

  if (startTime >= maxDuration) {
    alert(`시작 시간은 영상 길이(${maxDuration.toFixed(2)}초)보다 작아야 합니다.`);
    return;
  }

  if (endTime > maxDuration) {
    alert(`끝 시간은 영상 길이(${maxDuration.toFixed(2)}초)를 초과할 수 없습니다.`);
    return;
  }

  if (endTime <= startTime) {
    alert('끝 시간은 시작 시간보다 커야 합니다.');
    return;
  }

  const duration = endTime - startTime;

  if (duration <= 0) {
    alert('유효한 구간을 선택해주세요.');
    return;
  }

  if (duration < 0.1) {
    alert('구간 길이는 최소 0.1초 이상이어야 합니다.');
    return;
  }

  const outputPath = await window.electronAPI.selectOutput('trimmed_video.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '영상 자르는 중...');

  try {
    const result = await window.electronAPI.trimVideo({
      inputPath: currentVideo,
      outputPath,
      startTime,
      duration
    });

    hideProgress();
    alert('영상 자르기 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('영상 자르기', error, '영상 자르기에 실패했습니다.');
  }
}

// Merge videos
let mergeVideos = [];

async function addVideoToMerge() {
  const videoPath = await window.electronAPI.selectVideo();
  if (!videoPath) return;

  mergeVideos.push(videoPath);
  updateMergeFileList();
}

function updateMergeFileList() {
  const list = document.getElementById('merge-files');
  list.innerHTML = mergeVideos.map((path, index) => `
    <div class="file-item">
      <span>${path.split('\\').pop()}</span>
      <button onclick="removeMergeVideo(${index})">제거</button>
    </div>
  `).join('');
}

function removeMergeVideo(index) {
  mergeVideos.splice(index, 1);
  updateMergeFileList();
}

async function executeMerge() {
  if (mergeVideos.length < 2) {
    alert('최소 2개 이상의 영상이 필요합니다.');
    return;
  }

  const transition = document.getElementById('merge-transition').value;
  const transitionDuration = parseFloat(document.getElementById('merge-duration').value);
  const outputPath = await window.electronAPI.selectOutput('merged_video.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '영상 병합 중...');

  try {
    const result = await window.electronAPI.mergeVideos({
      videoPaths: mergeVideos,
      outputPath,
      transition,
      transitionDuration
    });

    hideProgress();
    alert('영상 병합 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    mergeVideos = [];
  } catch (error) {
    hideProgress();
    handleError('영상 병합', error, '영상 병합에 실패했습니다.');
  }
}

// Add audio
let selectedAudioFile = null;

// Audio file duration
let selectedAudioDuration = 0;

// Audio preview element for playback
let audioPreviewElement = null;

async function selectAudioFile() {
  selectedAudioFile = await window.electronAPI.selectAudio();
  if (selectedAudioFile) {
    document.getElementById('selected-audio').textContent = selectedAudioFile.split('\\').pop();

    // Get audio duration
    getAudioDuration(selectedAudioFile);
  }
}

// Get audio file duration
async function getAudioDuration(audioPath) {
  try {
    const audioInfo = await window.electronAPI.getVideoInfo(audioPath); // FFprobe works for audio too
    if (audioInfo && audioInfo.format && audioInfo.format.duration) {
      selectedAudioDuration = parseFloat(audioInfo.format.duration);

      // Update selected audio display with duration
      const selectedAudioDiv = document.getElementById('selected-audio');
      if (selectedAudioDiv) {
        selectedAudioDiv.textContent = `${audioPath.split('\\').pop()} (${formatTime(selectedAudioDuration)})`;
      }

      // Update audio range overlay
      updateAudioRangeOverlay();

      updateStatus(`오디오 파일 선택: ${formatTime(selectedAudioDuration)}`);
    }
  } catch (error) {
    console.error('Failed to get audio duration:', error);
    selectedAudioDuration = 0;
  }
}

// Update audio range overlay on timeline
function updateAudioRangeOverlay() {
  const overlay = document.getElementById('audio-range-overlay');
  const startTimeInput = document.getElementById('audio-start-time');

  if (!overlay || !videoInfo || !selectedAudioFile || selectedAudioDuration === 0) {
    if (overlay) {
      overlay.style.display = 'none';
    }
    return;
  }

  // Show overlay only in add-audio mode
  if (activeTool === 'add-audio' && startTimeInput) {
    overlay.style.display = 'block';

    const videoDuration = parseFloat(videoInfo.format.duration);
    const startTime = parseFloat(startTimeInput.value) || 0;
    const endTime = Math.min(startTime + selectedAudioDuration, videoDuration);

    // Calculate percentages
    const startPercent = (startTime / videoDuration) * 100;
    const endPercent = (endTime / videoDuration) * 100;
    const widthPercent = endPercent - startPercent;

    // Update overlay position and size
    overlay.style.left = `${startPercent}%`;
    overlay.style.width = `${widthPercent}%`;
  } else {
    overlay.style.display = 'none';
  }
}

// Play audio preview synchronized with video
function playAudioPreview(videoStartTime) {
  if (!selectedAudioFile) return;

  // Stop any currently playing audio
  if (audioPreviewElement) {
    audioPreviewElement.pause();
    audioPreviewElement = null;
  }

  // Create new audio element
  audioPreviewElement = new Audio(`file:///${selectedAudioFile.replace(/\\/g, '/')}`);

  // Get volume from slider
  const volumeSlider = document.getElementById('audio-volume');
  if (volumeSlider) {
    audioPreviewElement.volume = Math.min(1.0, parseFloat(volumeSlider.value));
  }

  // Set audio current time to 0 (audio always starts from beginning)
  audioPreviewElement.currentTime = 0;

  // Play audio
  audioPreviewElement.play().catch(err => {
    console.error('Audio playback error:', err);
  });

  // Stop audio when it ends
  audioPreviewElement.addEventListener('ended', () => {
    audioPreviewElement = null;
  });
}

function updateVolumeDisplay() {
  const value = document.getElementById('audio-volume').value;
  document.getElementById('volume-value').textContent = value;
}

async function executeAddAudio() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (!selectedAudioFile) {
    alert('오디오 파일을 선택해주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('audio-volume').value);
  const audioStartTimeInput = document.getElementById('audio-start-time');
  const audioStartTime = audioStartTimeInput ? parseFloat(audioStartTimeInput.value) || 0 : 0;

  const outputPath = await window.electronAPI.selectOutput('video_with_audio.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '오디오 추가 중...');

  try {
    const result = await window.electronAPI.addAudio({
      videoPath: currentVideo,
      audioPath: selectedAudioFile,
      outputPath,
      volumeLevel,
      audioStartTime
    });

    hideProgress();
    alert('오디오 추가 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('오디오 추가', error, '오디오 추가에 실패했습니다.');
  }
}

// Extract audio
async function executeExtractAudio() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const outputPath = await window.electronAPI.selectOutput('extracted_audio.mp3');
  if (!outputPath) return;

  showProgress();
  updateProgress(0, '오디오 추출 중...');

  try {
    const result = await window.electronAPI.extractAudio({
      videoPath: currentVideo,
      outputPath
    });

    hideProgress();
    alert(`오디오 추출 완료!\n저장 위치: ${result.outputPath}`);
  } catch (error) {
    hideProgress();
    handleError('오디오 추출', error, '오디오 추출에 실패했습니다.');
  }
}

// Volume adjust
function updateVolumeAdjustDisplay() {
  const value = document.getElementById('volume-adjust').value;
  document.getElementById('volume-adjust-value').textContent = value;
}

async function executeVolumeAdjust() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('volume-adjust').value);
  const outputPath = await window.electronAPI.selectOutput('volume_adjusted.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '볼륨 조절 중...');

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath,
      filterName: 'volume',
      filterParams: { volume: volumeLevel }
    });

    hideProgress();
    alert('볼륨 조절 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('볼륨 조절', error, '볼륨 조절에 실패했습니다.');
  }
}

// Filter controls
function updateFilterControls() {
  const filterType = document.getElementById('filter-type').value;
  const controlsDiv = document.getElementById('filter-controls');

  switch (filterType) {
    case 'brightness':
      controlsDiv.innerHTML = `
        <div class="property-group">
          <label>밝기 <span class="property-value" id="brightness-value">0</span></label>
          <input type="range" id="brightness" min="-1" max="1" step="0.1" value="0" oninput="updateFilterValue('brightness')">
          <small style="color: #888;">-1 = 어둡게, 0 = 원본, 1 = 밝게</small>
        </div>
      `;
      break;
    case 'contrast':
      controlsDiv.innerHTML = `
        <div class="property-group">
          <label>대비 <span class="property-value" id="contrast-value">1</span></label>
          <input type="range" id="contrast" min="0" max="3" step="0.1" value="1" oninput="updateFilterValue('contrast')">
          <small style="color: #888;">1 = 원본, 2 = 대비 2배</small>
        </div>
      `;
      break;
    case 'saturation':
      controlsDiv.innerHTML = `
        <div class="property-group">
          <label>채도 <span class="property-value" id="saturation-value">1</span></label>
          <input type="range" id="saturation" min="0" max="3" step="0.1" value="1" oninput="updateFilterValue('saturation')">
          <small style="color: #888;">0 = 흑백, 1 = 원본, 2 = 채도 2배</small>
        </div>
      `;
      break;
    case 'blur':
      controlsDiv.innerHTML = `
        <div class="property-group">
          <label>블러 강도 <span class="property-value" id="sigma-value">2</span></label>
          <input type="range" id="sigma" min="0" max="10" step="0.5" value="2" oninput="updateFilterValue('sigma')">
        </div>
      `;
      break;
    case 'sharpen':
      controlsDiv.innerHTML = `
        <div class="property-group">
          <label>샤픈 강도 <span class="property-value" id="amount-value">1</span></label>
          <input type="range" id="amount" min="0" max="3" step="0.1" value="1" oninput="updateFilterValue('amount')">
        </div>
      `;
      break;
  }
}

function updateFilterValue(filterType) {
  const value = document.getElementById(filterType).value;
  document.getElementById(`${filterType}-value`).textContent = value;
}

async function executeFilter() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const filterType = document.getElementById('filter-type').value;
  let filterParams = {};

  switch (filterType) {
    case 'brightness':
      filterParams.brightness = parseFloat(document.getElementById('brightness').value);
      break;
    case 'contrast':
      filterParams.contrast = parseFloat(document.getElementById('contrast').value);
      break;
    case 'saturation':
      filterParams.saturation = parseFloat(document.getElementById('saturation').value);
      break;
    case 'blur':
      filterParams.sigma = parseFloat(document.getElementById('sigma').value);
      break;
    case 'sharpen':
      filterParams.amount = parseFloat(document.getElementById('amount').value);
      break;
  }

  const outputPath = await window.electronAPI.selectOutput(`${filterType}_applied.mp4`);
  if (!outputPath) return;

  showProgress();
  updateProgress(0, `${filterType} 필터 적용 중...`);

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath,
      filterName: filterType,
      filterParams
    });

    hideProgress();
    alert('필터 적용 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('필터 적용', error, '필터 적용에 실패했습니다.');
  }
}

// Add text
async function executeAddText() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const text = document.getElementById('text-content').value;
  if (!text) {
    alert('텍스트를 입력해주세요.');
    return;
  }

  const fontSize = parseInt(document.getElementById('text-size').value);
  const fontColor = document.getElementById('text-color').value;
  const x = document.getElementById('text-x').value || '(w-text_w)/2';
  const y = document.getElementById('text-y').value || '(h-text_h)/2';
  const startTime = document.getElementById('text-start').value ? parseFloat(document.getElementById('text-start').value) : undefined;
  const duration = document.getElementById('text-duration').value ? parseFloat(document.getElementById('text-duration').value) : undefined;

  const outputPath = await window.electronAPI.selectOutput('text_added.mp4');
  if (!outputPath) return;

  showProgress();
  updateProgress(0, '텍스트 추가 중...');

  try {
    const result = await window.electronAPI.addText({
      inputPath: currentVideo,
      outputPath,
      text,
      fontSize,
      fontColor,
      position: { x, y },
      startTime,
      duration
    });

    hideProgress();
    alert('텍스트 추가 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('텍스트 추가', error, '텍스트 추가에 실패했습니다.');
  }
}

// Speed adjust
function updateSpeedDisplay() {
  const value = document.getElementById('speed-factor').value;
  document.getElementById('speed-value').textContent = `${value}x`;
}

async function executeSpeed() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const speed = parseFloat(document.getElementById('speed-factor').value);
  const outputPath = await window.electronAPI.selectOutput('speed_adjusted.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '속도 조절 중...');

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath,
      filterName: 'speed',
      filterParams: { speed }
    });

    hideProgress();
    alert('속도 조절 완료!');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('속도 조절', error, '속도 조절에 실패했습니다.');
  }
}

// Export dialog
function showExportDialog() {
  alert('현재 편집된 영상은 이미 저장되어 있습니다.\n각 편집 작업 시 저장 위치를 선택하셨습니다.');
}

// Progress management
function setupFFmpegProgressListener() {
  window.electronAPI.onFFmpegProgress((message) => {
    console.log('FFmpeg:', message);
    // Parse FFmpeg output for progress updates
    // This is simplified - real implementation would parse time codes
  });
}

// Log management
function setupLogListener() {
  window.electronAPI.onLogEntry((logData) => {
    addLogEntry(logData);
  });
}

function setupClearLogsButton() {
  document.getElementById('clear-logs-btn').addEventListener('click', () => {
    document.getElementById('console-logs').innerHTML = '';
  });
}

function addLogEntry(logData) {
  const logsContainer = document.getElementById('console-logs');
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';

  let logHTML = `
    <span class="log-timestamp">${logData.timestamp}</span>
    <span class="log-level ${logData.level}">${logData.level}</span>
    <span class="log-event-type">[${logData.eventType}]</span>
    <span class="log-message">${logData.message}</span>
  `;

  if (logData.data) {
    logHTML += `<div class="log-data">${JSON.stringify(logData.data)}</div>`;
  }

  logEntry.innerHTML = logHTML;
  logsContainer.appendChild(logEntry);

  // Auto-scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;

  // Limit log entries to 100
  while (logsContainer.children.length > 100) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
}

function showProgress() {
  document.getElementById('progress-section').style.display = 'block';
}

function hideProgress() {
  document.getElementById('progress-section').style.display = 'none';
  updateProgress(0, '대기 중...');
}

function updateProgress(percent, text) {
  document.getElementById('progress-fill').style.width = `${percent}%`;
  document.getElementById('progress-text').textContent = text;
}

function updateStatus(text) {
  document.getElementById('status-text').textContent = text;
}

// Utility functions
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const decimal = Math.round((seconds % 1) * 100); // 소수점 둘째 자리

  // 항상 소수점 2자리 표시
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad2(decimal)}`;
}

function pad(num) {
  return num.toString().padStart(2, '0');
}

function pad2(num) {
  return num.toString().padStart(2, '0');
}
