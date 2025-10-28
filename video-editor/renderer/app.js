// State management
let currentVideo = null;
let videoInfo = null;
let activeTool = null;
let videoLayers = [];
let currentMode = 'video';  // 'video' or 'audio'
let currentAudioFile = null;  // For audio editing mode
let audioFileInfo = null;  // Audio file metadata

// Zoom state for audio waveform
let zoomStart = 0;  // 0-1 (percentage of video)
let zoomEnd = 1;    // 0-1 (percentage of video)
let playheadInteractionSetup = false;  // Flag to prevent duplicate event listeners
let audioLayers = [];

// Slider interaction state
let isUserSeekingSlider = false;  // Flag to prevent auto-skip during manual seek
let isPreviewingRange = false;    // Flag to prevent auto-skip during range preview

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
  setupModeListener();
  updateModeUI();
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
        <button class="property-btn" onclick="executeTrim()">✂️ 영상+오디오 자르기</button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="executeTrimVideoOnly()" style="margin: 0;">🎬 영상만 자르기</button>
          <button class="property-btn secondary" onclick="executeTrimAudioOnly()" style="margin: 0;">🔉 오디오만 자르기</button>
        </div>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 영상만: 오디오 원본 유지 | 오디오만: 영상 원본 유지</small>
        </div>
      `;
      // Add event listeners for real-time duration calculation
      setTimeout(() => {
        document.getElementById('trim-start').addEventListener('input', updateTrimDurationDisplay);
        document.getElementById('trim-end').addEventListener('input', updateTrimDurationDisplay);
        updateTrimDurationDisplay();
      }, 0);
      break;

    case 'import-audio':
      importAudioFile();
      break;

    case 'trim-audio':
      if (!currentAudioFile) {
        alert('먼저 음성 파일을 가져와주세요.');
        return;
      }
      const audioDuration = audioFileInfo ? parseFloat(audioFileInfo.format.duration) : 100;
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>시작 시간 (초)</label>
          <input type="number" id="audio-trim-start" min="0" max="${audioDuration}" step="0.1" value="0" style="width: 100%; padding: 10px;">
          <small style="color: #888; font-size: 11px; display: block; margin-top: 5px;">최대: ${audioDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group">
          <label>끝 시간 (초)</label>
          <input type="number" id="audio-trim-end" min="0" max="${audioDuration}" step="0.1" value="${audioDuration.toFixed(2)}" style="width: 100%; padding: 10px;">
          <small style="color: #888; font-size: 11px; display: block; margin-top: 5px;">최대: ${audioDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group" style="background: #2d2d2d; padding: 10px; border-radius: 5px;">
          <label style="color: #667eea;">자르기 구간 길이</label>
          <div id="audio-trim-duration-display" style="font-size: 16px; font-weight: 600; color: #e0e0e0; margin-top: 5px;">0.00초</div>
        </div>
        <button class="property-btn" onclick="executeTrimAudioFile()">✂️ 음성 자르기</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 MP3, WAV 등 음성 파일을 자를 수 있습니다</small>
        </div>
      `;
      // Add event listeners for real-time duration calculation
      setTimeout(() => {
        document.getElementById('audio-trim-start').addEventListener('input', updateAudioTrimDurationDisplay);
        document.getElementById('audio-trim-end').addEventListener('input', updateAudioTrimDurationDisplay);
        updateAudioTrimDurationDisplay();
      }, 0);
      break;

    case 'audio-volume':
      if (!currentAudioFile) {
        alert('먼저 음성 파일을 가져와주세요.');
        return;
      }
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>볼륨 레벨</label>
          <input type="range" id="audio-volume-level" min="0" max="2" step="0.1" value="1" style="width: 100%;">
          <div style="text-align: center; margin-top: 10px; font-size: 18px; font-weight: 600; color: #667eea;">
            <span id="audio-volume-display">1.0</span>x
          </div>
        </div>
        <button class="property-btn" onclick="executeAudioVolume()">🔊 볼륨 조절 적용</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 1.0 = 원본, 0.5 = 절반, 2.0 = 2배</small>
        </div>
      `;
      setTimeout(() => {
        document.getElementById('audio-volume-level').addEventListener('input', (e) => {
          document.getElementById('audio-volume-display').textContent = parseFloat(e.target.value).toFixed(1);
        });
      }, 0);
      break;

    case 'export-audio':
      if (!currentAudioFile) {
        alert('먼저 음성 파일을 가져와주세요.');
        return;
      }
      alert('현재 음성 파일이 로드되어 있습니다. 편집 후 자동으로 저장됩니다.');
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
          <label>오디오 소스</label>
          <select id="audio-source-type" onchange="toggleAudioSourceUI()" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; margin-bottom: 10px;">
            <option value="file">파일에서 선택</option>
            <option value="silence">무음</option>
          </select>
        </div>
        <div id="audio-file-section" class="property-group">
          <label>오디오 파일</label>
          <button class="property-btn secondary" onclick="selectAudioFile()">오디오 선택</button>
          <div id="selected-audio" style="margin-top: 10px; color: #aaa; font-size: 13px;"></div>
        </div>
        <div id="audio-silence-section" class="property-group" style="display: none;">
          <label>무음 길이 (초)</label>
          <input type="number" id="silence-duration" min="0.1" max="${videoDuration}" step="0.1" value="1" oninput="updateAudioRangeOverlay()" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;">
          <small style="color: #888; font-size: 11px;">무음으로 추가할 길이 (최대: ${videoDuration.toFixed(2)}초)</small>
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
          <label>삽입 모드</label>
          <select id="audio-insert-mode" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;">
            <option value="mix">믹스 (기존 오디오와 합성)</option>
            <option value="overwrite">덮어쓰기 (기존 오디오 대체)</option>
            <option value="push">뒤로 밀기 (기존 오디오를 뒤로 이동)</option>
          </select>
          <small style="color: #888; font-size: 11px; display: block; margin-top: 5px;">
            • 믹스: 기존 오디오와 새 오디오를 함께 재생<br>
            • 덮어쓰기: 삽입 구간의 기존 오디오를 제거하고 새 오디오로 대체<br>
            • 뒤로 밀기: 삽입 지점부터 기존 오디오를 뒤로 이동
          </small>
        </div>
        <div id="audio-volume-section" class="property-group">
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
    // 영상 자르기 모드에서는 처음부터 재생 (선택 구간 제외)
    if (activeTool === 'trim') {
      const startInput = document.getElementById('trim-start');
      if (startInput) {
        const startTime = parseFloat(startInput.value) || 0;
        const endInput = document.getElementById('trim-end');
        const endTime = endInput ? (parseFloat(endInput.value) || video.duration) : video.duration;

        // 처음부터 재생 시작 (선택 구간은 timeupdate에서 스킵)
        if (video.currentTime === 0 || video.currentTime >= video.duration) {
          video.currentTime = 0;
        }
        // 선택 구간 내에 있으면 끝 시간으로 이동
        else if (video.currentTime >= startTime && video.currentTime < endTime) {
          video.currentTime = endTime;
        }
      }
    }

    // 오디오 삽입 모드에서는 오디오 시작 시간부터 재생
    if (activeTool === 'add-audio') {
      const audioStartInput = document.getElementById('audio-start-time');
      const sourceType = document.getElementById('audio-source-type');

      if (audioStartInput) {
        let audioDuration = 0;

        // Determine duration based on source type
        if (sourceType && sourceType.value === 'silence') {
          const silenceDurationInput = document.getElementById('silence-duration');
          audioDuration = silenceDurationInput ? parseFloat(silenceDurationInput.value) || 0 : 0;
        } else if (selectedAudioFile && selectedAudioDuration > 0) {
          audioDuration = selectedAudioDuration;
        }

        if (audioDuration > 0) {
          const audioStartTime = parseFloat(audioStartInput.value) || 0;
          const endTime = Math.min(audioStartTime + audioDuration, video.duration);

          // 현재 시간이 오디오 범위 밖이면 시작 시간으로 이동
          if (video.currentTime < audioStartTime || video.currentTime >= endTime) {
            video.currentTime = audioStartTime;
          }

          // Play audio synchronized with video (only for file mode, not silence)
          if (sourceType && sourceType.value !== 'silence' && selectedAudioFile) {
            playAudioPreview(audioStartTime);
          }
        }
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

      // Update playhead bar position
      updatePlayheadPosition(video.currentTime, video.duration);

      // 영상 자르기 모드에서는 선택 구간을 제외하고 재생
      if (activeTool === 'trim' && !isUserSeekingSlider && !isPreviewingRange) {
        const startInput = document.getElementById('trim-start');
        const endInput = document.getElementById('trim-end');

        if (startInput && endInput) {
          const startTime = parseFloat(startInput.value) || 0;
          const endTime = parseFloat(endInput.value) || video.duration;

          // 선택 구간에 도달하면 자동으로 스킵 (재생 중일 때만)
          if (!video.paused && video.currentTime >= startTime && video.currentTime < endTime) {
            video.currentTime = endTime;
          }

          // 영상 끝까지 재생하면 일시정지
          if (video.currentTime >= video.duration) {
            video.pause();
            video.currentTime = video.duration;
          }
        }
      }

      // 오디오 삽입 모드에서는 오디오 구간만 재생
      if (activeTool === 'add-audio') {
        const audioStartInput = document.getElementById('audio-start-time');
        const sourceType = document.getElementById('audio-source-type');

        if (audioStartInput) {
          let audioDuration = 0;

          // Determine duration based on source type
          if (sourceType && sourceType.value === 'silence') {
            const silenceDurationInput = document.getElementById('silence-duration');
            audioDuration = silenceDurationInput ? parseFloat(silenceDurationInput.value) || 0 : 0;
          } else if (selectedAudioFile && selectedAudioDuration > 0) {
            audioDuration = selectedAudioDuration;
          }

          if (audioDuration > 0) {
            const startTime = parseFloat(audioStartInput.value) || 0;
            const endTime = Math.min(startTime + audioDuration, video.duration);

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
    }
  });

  // Track slider drag using pixel-based coordinates (like audio zoom)
  let sliderDragStartX = null;
  let sliderDragStartTime = null;
  let sliderIsDragging = false;
  const sliderDragSelection = document.getElementById('slider-drag-selection');

  // Get slider container for coordinate calculations
  const sliderContainer = slider.parentElement;

  slider.addEventListener('mousedown', (e) => {
    isUserSeekingSlider = true;

    // Record pixel position for trim mode
    if (activeTool === 'trim' && video.duration && sliderContainer) {
      const rect = sliderContainer.getBoundingClientRect();
      sliderDragStartX = e.clientX - rect.left; // Pixel position, not percentage
      sliderDragStartTime = video.currentTime;
      console.log(`[Slider] Drag start: x=${sliderDragStartX.toFixed(0)}px, time=${sliderDragStartTime.toFixed(2)}s`);
    }
  });

  // Track mouse movement using global document listener (like audio zoom)
  document.addEventListener('mousemove', (e) => {
    if (isUserSeekingSlider && sliderDragStartX !== null && activeTool === 'trim' && sliderContainer) {
      const rect = sliderContainer.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const moveDistance = Math.abs(currentX - sliderDragStartX);

      // Detect actual drag (10px threshold)
      if (moveDistance > 10) {
        sliderIsDragging = true;

        // Show drag selection box using pixel coordinates
        const width = Math.abs(currentX - sliderDragStartX);
        const left = Math.min(sliderDragStartX, currentX);

        sliderDragSelection.style.left = `${left}px`;
        sliderDragSelection.style.width = `${width}px`;
        sliderDragSelection.style.display = 'block';
      }
    }
  });

  slider.addEventListener('input', (e) => {
    if (video.duration) {
      const time = (e.target.value / 100) * video.duration;
      video.currentTime = time;
    }
  });

  // Global mouseup listener (like audio zoom)
  document.addEventListener('mouseup', (e) => {
    if (isUserSeekingSlider && activeTool === 'trim' && sliderIsDragging && sliderDragStartX !== null && video.duration && sliderContainer) {
      const rect = sliderContainer.getBoundingClientRect();
      const currentX = e.clientX - rect.left;

      // Calculate start and end percentages from pixel positions
      const startPercent = Math.min(sliderDragStartX, currentX) / rect.width;
      const endPercent = Math.max(sliderDragStartX, currentX) / rect.width;

      // Convert to time values
      const startTime = startPercent * video.duration;
      const endTime = endPercent * video.duration;

      // Only set if drag distance is significant (at least 0.5 seconds)
      if (Math.abs(endTime - startTime) > 0.5) {
        const startInput = document.getElementById('trim-start');
        const endInput = document.getElementById('trim-end');

        if (startInput && endInput) {
          startInput.value = startTime.toFixed(2);
          endInput.value = endTime.toFixed(2);

          updateTrimDurationDisplay();
          updateTrimRangeOverlay(startTime, endTime, video.duration);
          updateStatus(`구간 선택: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);

          console.log(`[Slider] Trim range set: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (from pixels: ${Math.min(sliderDragStartX, currentX).toFixed(0)}-${Math.max(sliderDragStartX, currentX).toFixed(0)})`);
        }
      }
    }

    // Reset drag state
    if (sliderIsDragging || isUserSeekingSlider) {
      sliderDragStartX = null;
      sliderDragStartTime = null;
      sliderIsDragging = false;

      if (sliderDragSelection) {
        sliderDragSelection.style.display = 'none';
      }

      setTimeout(() => {
        isUserSeekingSlider = false;
      }, 100);
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

    // Generate and display audio waveform
    await generateAndDisplayWaveform(path);

    // Initialize playhead bar
    const playheadBar = document.getElementById('playhead-bar');
    if (playheadBar) {
      playheadBar.style.display = 'block';
      playheadBar.style.left = '0%';
      console.log('Playhead bar initialized');

      // Add click/drag functionality to audio track (only once)
      if (!playheadInteractionSetup) {
        setupPlayheadInteraction();
        playheadInteractionSetup = true;
      }
    } else {
      console.error('Playhead bar element not found!');
    }

    document.getElementById('current-file').textContent = path.split('\\').pop();

    // 도구 선택 초기화 (영상 자르기 설정 제거)
    activeTool = null;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById('tool-properties').innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';

    // 오디오 관련 상태 초기화
    selectedAudioFile = null;
    selectedAudioDuration = 0;
    if (audioPreviewElement) {
      audioPreviewElement.pause();
      audioPreviewElement = null;
    }

    // 타임라인 오버레이 숨기기
    const trimOverlay = document.getElementById('trim-range-overlay');
    const audioOverlay = document.getElementById('audio-range-overlay');
    if (trimOverlay) trimOverlay.style.display = 'none';
    if (audioOverlay) audioOverlay.style.display = 'none';
  } catch (error) {
    handleError('영상 로드', error, '영상을 불러오는데 실패했습니다.');
  }
}

// Display video info
function displayVideoInfo(info) {
  if (!info || !info.streams || !info.format) {
    console.error('Invalid video info:', info);
    return;
  }

  const videoStream = info.streams.find(s => s.codec_type === 'video');
  const duration = parseFloat(info.format.duration) || 0;
  const size = (parseFloat(info.format.size || 0) / (1024 * 1024)).toFixed(2);

  document.getElementById('info-duration').textContent = formatTime(duration);

  if (videoStream && videoStream.width && videoStream.height) {
    document.getElementById('info-resolution').textContent = `${videoStream.width}x${videoStream.height}`;

    if (videoStream.r_frame_rate) {
      try {
        const fps = eval(videoStream.r_frame_rate);
        document.getElementById('info-fps').textContent = `${fps.toFixed(2)} fps`;
      } catch (e) {
        document.getElementById('info-fps').textContent = 'N/A fps';
      }
    } else {
      document.getElementById('info-fps').textContent = 'N/A fps';
    }
  } else {
    document.getElementById('info-resolution').textContent = 'N/A';
    document.getElementById('info-fps').textContent = 'N/A fps';
  }

  document.getElementById('info-size').textContent = `${size} MB`;
  document.getElementById('video-info').style.display = 'flex';
}

// Display timeline tracks
function displayTimelineTracks(info) {
  const duration = parseFloat(info.format.duration);
  const videoStream = info.streams.find(s => s.codec_type === 'video');
  const audioStream = info.streams.find(s => s.codec_type === 'audio');

  // Clear existing tracks (but keep waveform img)
  document.getElementById('video-track').innerHTML = '';

  const audioTrackDiv = document.getElementById('audio-track');
  // Remove all children except the waveform img, playhead bar, and zoom selection
  Array.from(audioTrackDiv.children).forEach(child => {
    if (child.id !== 'audio-waveform' && child.id !== 'playhead-bar' && child.id !== 'zoom-selection') {
      child.remove();
    }
  });

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
    // No text - just background for waveform
    audioTrack.appendChild(audioClip);
  }
}

// Generate and display audio waveform
async function generateAndDisplayWaveform(videoPath) {
  try {
    const waveformImg = document.getElementById('audio-waveform');

    // Check if video has audio stream
    const audioStream = videoInfo.streams.find(s => s.codec_type === 'audio');
    if (!audioStream) {
      console.log('No audio stream found, skipping waveform generation');
      waveformImg.style.display = 'none';
      return;
    }

    console.log('Generating waveform...');
    updateStatus('오디오 파형 생성 중...');

    const result = await window.electronAPI.generateWaveform(videoPath);

    if (result.success && result.waveformPath) {
      // Display the waveform image
      const imgSrc = `file:///${result.waveformPath.replace(/\\/g, '/')}`;
      console.log('Setting waveform src to:', imgSrc);
      console.log('Waveform img element:', waveformImg);

      waveformImg.onload = () => {
        console.log('Waveform image loaded successfully');
        console.log('Image dimensions:', waveformImg.naturalWidth, 'x', waveformImg.naturalHeight);
        console.log('Image display:', waveformImg.style.display);
        console.log('Image computed style:', window.getComputedStyle(waveformImg).display);
      };

      waveformImg.onerror = (e) => {
        console.error('Failed to load waveform image:', e);
        console.error('Image src was:', waveformImg.src);
      };

      waveformImg.src = imgSrc;
      waveformImg.style.display = 'block';
      console.log('Waveform displayed:', result.waveformPath);
      updateStatus('오디오 파형 생성 완료');
    }
  } catch (error) {
    console.error('Failed to generate waveform:', error);
    updateStatus('오디오 파형 생성 실패 (계속 진행...)');
    // Don't throw error - continue loading video even if waveform fails
  }
}

// Update playhead bar position
function updatePlayheadPosition(currentTime, duration) {
  const playheadBar = document.getElementById('playhead-bar');
  if (!playheadBar || !videoInfo) return;

  const audioTrack = document.getElementById('audio-track');
  const waveformImg = document.getElementById('audio-waveform');
  if (!audioTrack) return;

  // Calculate position as percentage of total duration
  const totalPercentage = currentTime / duration;

  // Always show playhead bar
  playheadBar.style.display = 'block';

  // Apply the same zoom transformation as the waveform
  const zoomRange = zoomEnd - zoomStart;
  const scale = 1 / zoomRange;

  // Playhead needs to be positioned at totalPercentage within the FULL waveform
  // But the waveform is now scaled and shifted

  // Position in the original (unscaled) waveform: totalPercentage * 100%
  // After scaling: we need to apply the same width and margin-left as waveform

  // The playhead's left position relative to the SCALED waveform
  const playheadPositionOnScaledWaveform = totalPercentage * scale * 100; // percentage of scaled width

  // Apply the same margin-left shift as the waveform
  const marginLeftPercent = -(zoomStart / zoomRange) * 100;

  // Final position: position on scaled waveform + margin shift
  const finalLeft = playheadPositionOnScaledWaveform + marginLeftPercent;

  console.log(`Playhead update: time=${currentTime.toFixed(2)}s, totalPct=${(totalPercentage*100).toFixed(1)}%, zoom=${(zoomStart*100).toFixed(1)}-${(zoomEnd*100).toFixed(1)}%, finalLeft=${finalLeft.toFixed(1)}%`);

  // Update playhead position
  playheadBar.style.left = `${finalLeft}%`;
}

// Setup playhead interaction (click and drag)
function setupPlayheadInteraction() {
  const audioTrack = document.getElementById('audio-track');
  const playheadBar = document.getElementById('playhead-bar');
  const video = document.getElementById('preview-video');
  const zoomSelection = document.getElementById('zoom-selection');

  if (!audioTrack || !playheadBar || !video || !zoomSelection) return;

  let isDraggingPlayhead = false;
  let isDraggingZoom = false;
  let zoomStartX = 0;

  // Function to update video time based on click position (considering zoom)
  const updateVideoTimeFromClick = (e) => {
    const rect = audioTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width);
    const clampedPercentage = Math.max(0, Math.min(1, percentage));

    if (video.duration) {
      // Map percentage to zoomed time range
      const zoomRange = zoomEnd - zoomStart;
      const timeInZoom = zoomStart + (clampedPercentage * zoomRange);
      const newTime = timeInZoom * video.duration;
      video.currentTime = newTime;
    }
  };

  // Mouse down on audio track
  audioTrack.addEventListener('mousedown', (e) => {
    // Check if clicking on playhead
    if (e.target === playheadBar || e.target.closest('.playhead-bar')) {
      isDraggingPlayhead = true;
      e.preventDefault();
      return;
    }

    // Start zoom selection
    isDraggingZoom = true;
    const rect = audioTrack.getBoundingClientRect();
    zoomStartX = e.clientX - rect.left;
    zoomSelection.style.left = zoomStartX + 'px';
    zoomSelection.style.width = '0px';
    zoomSelection.style.display = 'block';
    e.preventDefault();
  });

  // Mouse move
  document.addEventListener('mousemove', (e) => {
    if (isDraggingPlayhead) {
      updateVideoTimeFromClick(e);
    } else if (isDraggingZoom) {
      const rect = audioTrack.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const width = Math.abs(currentX - zoomStartX);
      const left = Math.min(zoomStartX, currentX);

      zoomSelection.style.left = left + 'px';
      zoomSelection.style.width = width + 'px';
    }
  });

  // Mouse up
  document.addEventListener('mouseup', (e) => {
    if (isDraggingZoom) {
      const rect = audioTrack.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const startPercent = Math.min(zoomStartX, currentX) / rect.width;
      const endPercent = Math.max(zoomStartX, currentX) / rect.width;

      // Only zoom if selection is big enough (at least 5% of track)
      if (endPercent - startPercent > 0.05) {
        // Map percentages to zoom range
        const zoomRange = zoomEnd - zoomStart;
        const newZoomStart = zoomStart + (startPercent * zoomRange);
        const newZoomEnd = zoomStart + (endPercent * zoomRange);

        zoomStart = newZoomStart;
        zoomEnd = newZoomEnd;

        console.log(`Zoomed to: ${(zoomStart * 100).toFixed(1)}% - ${(zoomEnd * 100).toFixed(1)}%`);

        // Apply zoom to waveform
        applyWaveformZoom();
      }

      zoomSelection.style.display = 'none';
    }

    isDraggingPlayhead = false;
    isDraggingZoom = false;
  });

  // Double-click to reset zoom
  audioTrack.addEventListener('dblclick', () => {
    zoomStart = 0;
    zoomEnd = 1;
    console.log('Zoom reset');
    applyWaveformZoom();
  });
}

// Apply zoom transform to waveform image
function applyWaveformZoom() {
  const waveformImg = document.getElementById('audio-waveform');
  const audioTrack = document.getElementById('audio-track');

  if (!waveformImg || !audioTrack) {
    console.error('Waveform image or audio track element not found!');
    return;
  }

  const zoomRange = zoomEnd - zoomStart;
  const scale = 1 / zoomRange;  // Scale factor

  // Using a different approach: margin-left and width scaling
  // This is more predictable than transform
  const containerWidth = audioTrack.offsetWidth;

  // Set the width to scaled size
  waveformImg.style.width = `${scale * 100}%`;

  // Shift left by the start position (as percentage of scaled width)
  // When width is 500% (scale=5), moving left by 46% means: -46% of 500% width
  const marginLeftPercent = -(zoomStart / zoomRange) * 100;
  waveformImg.style.marginLeft = `${marginLeftPercent}%`;

  console.log(`Waveform zoom: zoomStart=${(zoomStart*100).toFixed(1)}%, zoomEnd=${(zoomEnd*100).toFixed(1)}%`);
  console.log(`Applied: width=${(scale*100).toFixed(1)}%, marginLeft=${marginLeftPercent.toFixed(1)}%`);
  console.log(`Container width: ${containerWidth}px`);

  // Update playhead position after zoom
  const video = document.getElementById('preview-video');
  if (video && video.duration) {
    updatePlayheadPosition(video.currentTime, video.duration);
  }

  // Update zoom range overlay on timeline slider
  updateZoomRangeOverlay();
}

// Update zoom range overlay on timeline slider
function updateZoomRangeOverlay() {
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

  // Set preview flag to prevent auto-skip
  isPreviewingRange = true;

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

      // Reset preview flag
      isPreviewingRange = false;

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

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('영상 자르기', error, '영상 자르기에 실패했습니다.');
  }
}

// ==================== Video-Only Trim Functions ====================

// Update trim video duration display
function updateTrimVideoDurationDisplay() {
  const startInput = document.getElementById('trim-video-start');
  const endInput = document.getElementById('trim-video-end');
  const display = document.getElementById('trim-video-duration-display');

  if (!startInput || !endInput || !display) return;

  const maxDuration = videoInfo ? parseFloat(videoInfo.format.duration) : 100;
  let startTime = parseFloat(startInput.value) || 0;
  let endTime = parseFloat(endInput.value) || 0;

  startTime = Math.max(0, Math.min(startTime, maxDuration));
  endTime = Math.max(0, Math.min(endTime, maxDuration));

  if (parseFloat(startInput.value) !== startTime) {
    startInput.value = startTime.toFixed(2);
  }
  if (parseFloat(endInput.value) !== endTime) {
    endInput.value = endTime.toFixed(2);
  }

  const duration = Math.max(0, endTime - startTime);
  display.textContent = `${duration.toFixed(2)}초`;

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

  updateTrimVideoRangeOverlay(startTime, endTime, maxDuration);
}

function updateTrimVideoRangeOverlay(startTime, endTime, maxDuration) {
  const overlay = document.getElementById('trim-range-overlay');
  if (!overlay || !videoInfo) return;

  if (activeTool === 'trim-video-only') {
    overlay.style.display = 'block';
    const startPercent = (startTime / maxDuration) * 100;
    const endPercent = (endTime / maxDuration) * 100;
    const widthPercent = endPercent - startPercent;
    overlay.style.left = `${startPercent}%`;
    overlay.style.width = `${widthPercent}%`;
  } else {
    overlay.style.display = 'none';
  }
}

function updateTrimVideoEndMax() {
  const startInput = document.getElementById('trim-video-start');
  const endInput = document.getElementById('trim-video-end');

  if (!startInput || !endInput || !videoInfo) return;

  const maxDuration = parseFloat(videoInfo.format.duration);
  let startTime = parseFloat(startInput.value) || 0;
  let endTime = parseFloat(endInput.value) || 0;

  startTime = Math.max(0, Math.min(startTime, maxDuration - 0.1));
  startInput.value = startTime.toFixed(2);

  if (endTime <= startTime) {
    endTime = Math.min(startTime + 1, maxDuration);
    endInput.value = endTime.toFixed(2);
  }

  if (endTime > maxDuration) {
    endTime = maxDuration;
    endInput.value = endTime.toFixed(2);
  }

  updateTrimVideoDurationDisplay();
}

function setVideoStartFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-video-start');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  startInput.value = currentTime.toFixed(2);
  updateTrimVideoEndMax();
  updateTrimVideoDurationDisplay();
  updateStatus(`시작 시간 설정: ${formatTime(currentTime)}`);
}

function setVideoEndFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const endInput = document.getElementById('trim-video-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  endInput.value = currentTime.toFixed(2);
  updateTrimVideoDurationDisplay();
  updateStatus(`끝 시간 설정: ${formatTime(currentTime)}`);
}

function previewVideoStartTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-video-start');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const startTime = parseFloat(startInput.value) || 0;
  video.currentTime = startTime;
  updateStatus(`시작 위치로 이동: ${formatTime(startTime)}`);
}

function previewVideoEndTime() {
  const video = document.getElementById('preview-video');
  const endInput = document.getElementById('trim-video-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const endTime = parseFloat(endInput.value) || 0;
  video.currentTime = endTime;
  updateStatus(`끝 위치로 이동: ${formatTime(endTime)}`);
}

function previewVideoTrimRange() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-video-start');
  const endInput = document.getElementById('trim-video-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const startTime = parseFloat(startInput.value) || 0;
  const endTime = parseFloat(endInput.value) || 0;

  if (endTime <= startTime) {
    alert('끝 시간은 시작 시간보다 커야 합니다.');
    return;
  }

  video.currentTime = startTime;
  video.play();

  const stopAtEnd = () => {
    if (video.currentTime >= endTime) {
      video.pause();
      video.removeEventListener('timeupdate', stopAtEnd);
    }
  };

  video.addEventListener('timeupdate', stopAtEnd);
  updateStatus(`구간 미리보기 재생: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);
}

async function executeTrimVideoOnly() {
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

  if (duration < 0.1) {
    alert('구간 길이는 최소 0.1초 이상이어야 합니다.');
    return;
  }

  const outputPath = await window.electronAPI.selectOutput('trimmed_video_only.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '영상만 자르는 중 (오디오 유지)...');

  try {
    const result = await window.electronAPI.trimVideoOnly({
      inputPath: currentVideo,
      outputPath,
      startTime,
      duration
    });

    hideProgress();
    alert('영상만 자르기 완료! (오디오는 원본 유지)');

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('영상만 자르기', error, '영상만 자르기에 실패했습니다.');
  }
}

// ==================== Audio-Only Trim Functions ====================

// Update trim audio duration display
function updateTrimAudioDurationDisplay() {
  const startInput = document.getElementById('trim-audio-start');
  const endInput = document.getElementById('trim-audio-end');
  const display = document.getElementById('trim-audio-duration-display');

  if (!startInput || !endInput || !display) return;

  const maxDuration = videoInfo ? parseFloat(videoInfo.format.duration) : 100;
  let startTime = parseFloat(startInput.value) || 0;
  let endTime = parseFloat(endInput.value) || 0;

  startTime = Math.max(0, Math.min(startTime, maxDuration));
  endTime = Math.max(0, Math.min(endTime, maxDuration));

  if (parseFloat(startInput.value) !== startTime) {
    startInput.value = startTime.toFixed(2);
  }
  if (parseFloat(endInput.value) !== endTime) {
    endInput.value = endTime.toFixed(2);
  }

  const duration = Math.max(0, endTime - startTime);
  display.textContent = `${duration.toFixed(2)}초`;

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

  updateTrimAudioRangeOverlay(startTime, endTime, maxDuration);
}

function updateTrimAudioRangeOverlay(startTime, endTime, maxDuration) {
  const overlay = document.getElementById('audio-range-overlay');
  if (!overlay || !videoInfo) return;

  if (activeTool === 'trim-audio-only') {
    overlay.style.display = 'block';
    const startPercent = (startTime / maxDuration) * 100;
    const endPercent = (endTime / maxDuration) * 100;
    const widthPercent = endPercent - startPercent;
    overlay.style.left = `${startPercent}%`;
    overlay.style.width = `${widthPercent}%`;
  } else {
    overlay.style.display = 'none';
  }
}

function updateTrimAudioEndMax() {
  const startInput = document.getElementById('trim-audio-start');
  const endInput = document.getElementById('trim-audio-end');

  if (!startInput || !endInput || !videoInfo) return;

  const maxDuration = parseFloat(videoInfo.format.duration);
  let startTime = parseFloat(startInput.value) || 0;
  let endTime = parseFloat(endInput.value) || 0;

  startTime = Math.max(0, Math.min(startTime, maxDuration - 0.1));
  startInput.value = startTime.toFixed(2);

  if (endTime <= startTime) {
    endTime = Math.min(startTime + 1, maxDuration);
    endInput.value = endTime.toFixed(2);
  }

  if (endTime > maxDuration) {
    endTime = maxDuration;
    endInput.value = endTime.toFixed(2);
  }

  updateTrimAudioDurationDisplay();
}

function setAudioStartFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-audio-start');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  startInput.value = currentTime.toFixed(2);
  updateTrimAudioEndMax();
  updateTrimAudioDurationDisplay();
  updateStatus(`시작 시간 설정: ${formatTime(currentTime)}`);
}

function setAudioEndFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const endInput = document.getElementById('trim-audio-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  endInput.value = currentTime.toFixed(2);
  updateTrimAudioDurationDisplay();
  updateStatus(`끝 시간 설정: ${formatTime(currentTime)}`);
}

function previewAudioStartTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-audio-start');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const startTime = parseFloat(startInput.value) || 0;
  video.currentTime = startTime;
  updateStatus(`시작 위치로 이동: ${formatTime(startTime)}`);
}

function previewAudioEndTime() {
  const video = document.getElementById('preview-video');
  const endInput = document.getElementById('trim-audio-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const endTime = parseFloat(endInput.value) || 0;
  video.currentTime = endTime;
  updateStatus(`끝 위치로 이동: ${formatTime(endTime)}`);
}

function previewAudioTrimRange() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('trim-audio-start');
  const endInput = document.getElementById('trim-audio-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const startTime = parseFloat(startInput.value) || 0;
  const endTime = parseFloat(endInput.value) || 0;

  if (endTime <= startTime) {
    alert('끝 시간은 시작 시간보다 커야 합니다.');
    return;
  }

  video.currentTime = startTime;
  video.play();

  const stopAtEnd = () => {
    if (video.currentTime >= endTime) {
      video.pause();
      video.removeEventListener('timeupdate', stopAtEnd);
    }
  };

  video.addEventListener('timeupdate', stopAtEnd);
  updateStatus(`구간 미리보기 재생: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);
}

async function executeTrimAudioOnly() {
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

  if (duration < 0.1) {
    alert('구간 길이는 최소 0.1초 이상이어야 합니다.');
    return;
  }

  const outputPath = await window.electronAPI.selectOutput('trimmed_audio_only.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '오디오만 자르는 중 (영상 유지)...');

  try {
    const result = await window.electronAPI.trimAudioOnly({
      inputPath: currentVideo,
      outputPath,
      startTime,
      endTime
    });

    hideProgress();
    alert('오디오만 자르기 완료! (영상은 원본 유지)');

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(result.outputPath);
    currentVideo = result.outputPath;
  } catch (error) {
    hideProgress();
    handleError('오디오만 자르기', error, '오디오만 자르기에 실패했습니다.');
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

// Toggle audio source UI between file and silence
function toggleAudioSourceUI() {
  const sourceType = document.getElementById('audio-source-type').value;
  const fileSection = document.getElementById('audio-file-section');
  const silenceSection = document.getElementById('audio-silence-section');
  const volumeSection = document.getElementById('audio-volume-section');

  if (sourceType === 'file') {
    fileSection.style.display = 'block';
    silenceSection.style.display = 'none';
    volumeSection.style.display = 'block';
  } else {
    fileSection.style.display = 'none';
    silenceSection.style.display = 'block';
    volumeSection.style.display = 'none';
    // Reset selected audio file
    selectedAudioFile = null;
    selectedAudioDuration = 0;
  }

  updateAudioRangeOverlay();
}

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
  const sourceType = document.getElementById('audio-source-type');

  if (!overlay || !videoInfo) {
    if (overlay) {
      overlay.style.display = 'none';
    }
    return;
  }

  // Determine audio duration based on source type
  let audioDuration = 0;
  if (sourceType && sourceType.value === 'silence') {
    const silenceDurationInput = document.getElementById('silence-duration');
    audioDuration = silenceDurationInput ? parseFloat(silenceDurationInput.value) || 0 : 0;
  } else {
    audioDuration = selectedAudioDuration;
    if (!selectedAudioFile || audioDuration === 0) {
      overlay.style.display = 'none';
      return;
    }
  }

  if (audioDuration === 0) {
    overlay.style.display = 'none';
    return;
  }

  // Show overlay only in add-audio mode
  if (activeTool === 'add-audio' && startTimeInput) {
    overlay.style.display = 'block';

    const videoDuration = parseFloat(videoInfo.format.duration);
    const startTime = parseFloat(startTimeInput.value) || 0;
    const endTime = Math.min(startTime + audioDuration, videoDuration);

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

  const sourceType = document.getElementById('audio-source-type').value;
  const audioStartTimeInput = document.getElementById('audio-start-time');
  const audioStartTime = audioStartTimeInput ? parseFloat(audioStartTimeInput.value) || 0 : 0;

  let audioDuration = 0;
  let isSilence = false;

  if (sourceType === 'silence') {
    const silenceDurationInput = document.getElementById('silence-duration');
    audioDuration = silenceDurationInput ? parseFloat(silenceDurationInput.value) || 0 : 0;
    if (audioDuration === 0) {
      alert('무음 길이를 입력해주세요.');
      return;
    }
    isSilence = true;
  } else {
    if (!selectedAudioFile) {
      alert('오디오 파일을 선택해주세요.');
      return;
    }
  }

  const volumeLevel = isSilence ? 0 : parseFloat(document.getElementById('audio-volume').value);
  const insertMode = document.getElementById('audio-insert-mode').value;

  const outputPath = await window.electronAPI.selectOutput('video_with_audio.mp4');

  if (!outputPath) return;

  showProgress();
  updateProgress(0, isSilence ? '무음 추가 중...' : '오디오 추가 중...');

  try {
    const result = await window.electronAPI.addAudio({
      videoPath: currentVideo,
      audioPath: selectedAudioFile,
      outputPath,
      volumeLevel,
      audioStartTime,
      isSilence,
      silenceDuration: audioDuration,
      insertMode
    });

    hideProgress();
    alert(isSilence ? '무음 추가 완료!' : '오디오 추가 완료!');
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

// Audio file editing functions
async function importAudioFile() {
  const audioPath = await window.electronAPI.selectAudio();
  if (!audioPath) return;

  try {
    currentAudioFile = audioPath;
    audioFileInfo = await window.electronAPI.getVideoInfo(audioPath);

    const duration = parseFloat(audioFileInfo.format.duration);
    const size = (parseFloat(audioFileInfo.format.size || 0) / (1024 * 1024)).toFixed(2);

    document.getElementById('current-file').textContent = audioPath.split('\\').pop();
    updateStatus(`음성 파일 로드됨: ${duration.toFixed(2)}초, ${size}MB`);

    alert(`음성 파일이 로드되었습니다.\n길이: ${formatTime(duration)}\n크기: ${size}MB`);
  } catch (error) {
    handleError('음성 파일 로드', error, '음성 파일을 불러오는데 실패했습니다.');
  }
}

function updateAudioTrimDurationDisplay() {
  const startInput = document.getElementById('audio-trim-start');
  const endInput = document.getElementById('audio-trim-end');
  const displayElement = document.getElementById('audio-trim-duration-display');

  if (startInput && endInput && displayElement) {
    const start = parseFloat(startInput.value) || 0;
    const end = parseFloat(endInput.value) || 0;
    const duration = Math.max(0, end - start);
    displayElement.textContent = `${duration.toFixed(2)}초`;
  }
}

async function executeTrimAudioFile() {
  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  if (!audioFileInfo) {
    alert('음성 파일 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  const maxDuration = parseFloat(audioFileInfo.format.duration);
  const startTime = parseFloat(document.getElementById('audio-trim-start').value);
  const endTime = parseFloat(document.getElementById('audio-trim-end').value);

  // Validation
  if (isNaN(startTime) || isNaN(endTime)) {
    alert('유효한 숫자를 입력해주세요.');
    return;
  }

  if (startTime < 0) {
    alert('시작 시간은 0보다 작을 수 없습니다.');
    return;
  }

  if (startTime >= maxDuration) {
    alert(`시작 시간은 음성 길이(${maxDuration.toFixed(2)}초)보다 작아야 합니다.');
    return;
  }

  if (endTime > maxDuration) {
    alert(`끝 시간은 음성 길이(${maxDuration.toFixed(2)}초)를 초과할 수 없습니다.`);
    return;
  }

  if (endTime <= startTime) {
    alert('끝 시간은 시작 시간보다 커야 합니다.');
    return;
  }

  const duration = endTime - startTime;

  if (duration < 0.1) {
    alert('구간 길이는 최소 0.1초 이상이어야 합니다.');
    return;
  }

  const ext = currentAudioFile.split('.').pop();
  const outputPath = await window.electronAPI.selectOutput(`trimmed_audio.${ext}`);

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '음성 자르는 중...');

  try {
    const result = await window.electronAPI.trimAudioFile({
      inputPath: currentAudioFile,
      outputPath,
      startTime,
      endTime
    });

    hideProgress();
    alert('음성 자르기 완료!');

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload the trimmed audio file
    currentAudioFile = result.outputPath;
    audioFileInfo = await window.electronAPI.getVideoInfo(result.outputPath);

    const newDuration = parseFloat(audioFileInfo.format.duration);
    document.getElementById('current-file').textContent = result.outputPath.split('\\').pop();
    updateStatus(`음성 자르기 완료: ${newDuration.toFixed(2)}초`);
  } catch (error) {
    hideProgress();
    handleError('음성 자르기', error, '음성 자르기에 실패했습니다.');
  }
}

async function executeAudioVolume() {
  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('audio-volume-level').value);
  const ext = currentAudioFile.split('.').pop();
  const outputPath = await window.electronAPI.selectOutput(`volume_adjusted.${ext}`);

  if (!outputPath) return;

  showProgress();
  updateProgress(0, '볼륨 조절 중...');

  try {
    // Use add-audio handler with volume adjustment on audio-only file
    const result = await window.electronAPI.addAudio({
      videoPath: currentAudioFile,
      audioPath: null,
      outputPath,
      volumeLevel,
      audioStartTime: 0,
      isSilence: false,
      insertMode: 'overwrite'
    });

    hideProgress();
    alert(`볼륨 조절 완료! (${volumeLevel}x)`);

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload the adjusted audio file
    currentAudioFile = result.outputPath;
    audioFileInfo = await window.electronAPI.getVideoInfo(result.outputPath);

    document.getElementById('current-file').textContent = result.outputPath.split('\\').pop();
    updateStatus(`볼륨 조절 완료: ${volumeLevel}x`);
  } catch (error) {
    hideProgress();
    handleError('볼륨 조절', error, '볼륨 조절에 실패했습니다.');
  }
}

// Mode switching functions
function setupModeListener() {
  if (window.electronAPI && window.electronAPI.onModeSwitch) {
    window.electronAPI.onModeSwitch((mode) => {
      currentMode = mode;
      updateModeUI();
      updateStatus(`${mode === 'video' ? '영상' : '음성'} 편집 모드로 전환됨`);
    });
  }
}

function updateModeUI() {
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.header h1');
  const subtitle = document.querySelector('.header .subtitle');

  if (currentMode === 'audio') {
    // Audio mode
    header.textContent = 'Kiosk Audio Editor';
    subtitle.textContent = '음성 파일 편집 도구';
    sidebar.innerHTML = `
      <h2>편집 도구</h2>
      <div class="tool-section">
        <h3>기본 작업</h3>
        <button class="tool-btn" data-tool="import-audio">
          <span class="icon">📁</span>
          음성 가져오기
        </button>
        <button class="tool-btn" data-tool="trim-audio">
          <span class="icon">✂️</span>
          음성 자르기
        </button>
      </div>
      <div class="tool-section">
        <h3>효과</h3>
        <button class="tool-btn" data-tool="audio-volume">
          <span class="icon">🔊</span>
          볼륨 조절
        </button>
      </div>
      <div class="tool-section">
        <h3>내보내기</h3>
        <button class="tool-btn export-btn" data-tool="export-audio">
          <span class="icon">💾</span>
          음성 내보내기
        </button>
      </div>
    `;
  } else {
    // Video mode
    header.textContent = 'Kiosk Video Editor';
    subtitle.textContent = '고급 영상/음성 편집 도구';
    sidebar.innerHTML = `
      <h2>편집 도구</h2>
      <div class="tool-section">
        <h3>기본 작업</h3>
        <button class="tool-btn" data-tool="import">
          <span class="icon">📁</span>
          영상 가져오기
        </button>
        <button class="tool-btn" data-tool="trim">
          <span class="icon">✂️</span>
          영상 자르기
        </button>
        <button class="tool-btn" data-tool="merge">
          <span class="icon">🔗</span>
          영상 병합
        </button>
      </div>
      <div class="tool-section">
        <h3>오디오</h3>
        <button class="tool-btn" data-tool="add-audio">
          <span class="icon">🎵</span>
          오디오 삽입
        </button>
        <button class="tool-btn" data-tool="extract-audio">
          <span class="icon">🎤</span>
          오디오 추출
        </button>
        <button class="tool-btn" data-tool="volume">
          <span class="icon">🔊</span>
          볼륨 조절
        </button>
      </div>
      <div class="tool-section">
        <h3>효과</h3>
        <button class="tool-btn" data-tool="filter">
          <span class="icon">🎨</span>
          필터/색상 조정
        </button>
        <button class="tool-btn" data-tool="text">
          <span class="icon">📝</span>
          텍스트/자막
        </button>
        <button class="tool-btn" data-tool="transition">
          <span class="icon">✨</span>
          트랜지션
        </button>
        <button class="tool-btn" data-tool="speed">
          <span class="icon">⚡</span>
          속도 조절
        </button>
      </div>
      <div class="tool-section">
        <h3>내보내기</h3>
        <button class="tool-btn export-btn" data-tool="export">
          <span class="icon">💾</span>
          비디오 내보내기
        </button>
      </div>
    `;
  }

  // Re-setup tool buttons after updating sidebar
  setupToolButtons();

  // Clear current tool selection
  activeTool = null;
  document.getElementById('tool-properties').innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';
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
