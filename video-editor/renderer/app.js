// State management
let currentVideo = null;
let videoInfo = null;
let activeTool = null;
let videoLayers = [];
let currentMode = 'video';  // 'video' or 'audio'
let currentAudioFile = null;  // For audio editing mode
let audioFileInfo = null;  // Audio file metadata
let currentAudioMetadata = { title: '', description: '' };  // Audio file title and description from S3
let textColorHistory = [];  // Color history for text mode
let audioListCurrentPage = 1;  // Current page for audio list pagination
let audioListItemsPerPage = 10;  // Items per page for audio list

// Zoom state for audio waveform
let zoomStart = 0;  // 0-1 (percentage of video)
let zoomEnd = 1;    // 0-1 (percentage of video)
let playheadInteractionSetup = false;  // Flag to prevent duplicate event listeners
let videoPlayheadInteractionSetup = false;  // For video mode
let audioPlayheadInteractionSetup = false;  // For audio mode
let audioLayers = [];

// Debounce state for waveform regeneration
let waveformRegenerateTimer = null;
let isRegeneratingWaveform = false;
let isWaveformRegenerated = false;  // Flag to track if current waveform is regenerated (zoomed-in detail)

// Slider interaction state
let isUserSeekingSlider = false;  // Flag to prevent auto-skip during manual seek
let isPreviewingRange = false;    // Flag to prevent auto-skip during range preview

// Silent audio tracking
let hasSilentAudio = false;  // Flag to track if current video has auto-generated silent audio

// Audio preview listener tracking
let audioPreviewListener = null;  // Store preview timeupdate listener reference for explicit removal

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
  showCustomDialog(`${userMessage}\n\n상세한 오류 내용은 개발자 도구(F12)의 콘솔에서 확인해주세요.`);
  updateStatus(`${operation} 실패`);
}

// Custom dialog that doesn't break input focus
function showCustomDialog(message) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; max-width: 500px; color: #e0e0e0;">
      <p style="margin: 0 0 20px 0; white-space: pre-wrap; line-height: 1.5;">${message}</p>
      <button onclick="closeCustomDialog()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">확인</button>
    </div>
  `;

  overlay.style.display = 'flex';
}

function closeCustomDialog() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
}

// Make closeCustomDialog global
window.closeCustomDialog = closeCustomDialog;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupToolButtons();
  setupVideoControls();
  setupFFmpegProgressListener();
  setupModeListener();
  setupModeButtons();
  setupImportButton();
  updateModeUI();
  updateStatus('준비 완료');
});

// Setup import button in preview placeholder
function setupImportButton() {
  const importBtn = document.getElementById('import-video-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      if (currentMode === 'video') {
        importVideo();
      } else {
        importAudioFile();
      }
    });
  }
}

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
  // Check if file is loaded based on current mode
  if (currentMode === 'video') {
    // Video mode: require video for all tools except import
    if (tool !== 'import' && !currentVideo) {
      alert('먼저 영상을 가져와주세요.');
      return;
    }
  } else if (currentMode === 'audio') {
    // Audio mode: require audio for all tools except import-audio
    if (tool !== 'import-audio' && !currentAudioFile) {
      alert('먼저 음성 파일을 가져와주세요.');
      return;
    }
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

  // Hide text range overlay when switching tools
  if (tool !== 'text') {
    const textOverlay = document.getElementById('text-range-overlay');
    if (textOverlay) {
      textOverlay.style.display = 'none';
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

  // Force webContents focus when switching tools (fixes input activation issues)
  setTimeout(async () => {
    try {
      await window.electronAPI.focusWebContents();
      console.log('[selectTool] WebContents focused after tool switch to:', tool);
    } catch (err) {
      console.error('[selectTool] Failed to focus webContents:', err);
    }
  }, 100);
}

// Show tool properties panel
function showToolProperties(tool) {
  const propertiesPanel = document.getElementById('tool-properties');

  switch (tool) {
    case 'import':
      importVideo();
      break;

    case 'import-audio':
      importAudioFile();
      break;

    case 'trim':
      const maxDuration = videoInfo ? parseFloat(videoInfo.format.duration) : 100;
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>시작 시간 (초)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="trim-start" min="0" max="${maxDuration}" step="0.1" value="${maxDuration.toFixed(2)}" oninput="updateTrimEndMax()" style="flex: 1;">
            <button class="property-btn secondary" onclick="setStartFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 시작 시간으로">🔄</button>
          </div>
          <small style="color: #888; font-size: 11px;">최대: ${maxDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group">
          <label>끝 시간 (초)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="trim-end" min="0" max="${maxDuration}" step="0.1" value="${maxDuration.toFixed(2)}" style="flex: 1;">
            <button class="property-btn secondary" onclick="setEndFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 끝 시간으로">🔄</button>
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
        <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
          <div style="font-weight: 600; color: #667eea; margin-bottom: 8px;">✂️ 자르기 옵션</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button class="property-btn" onclick="executeTrim()" style="margin: 0; background: #667eea;">✅ 선택 구간 유지</button>
            <button class="property-btn" onclick="executeDeleteRange()" style="margin: 0; background: #e74c3c;">🗑️ 선택 구간 삭제</button>
          </div>
          <small style="color: #aaa; display: block; margin-top: 8px;">
            • 유지: 선택 구간만 남김<br>
            • 삭제: 선택 구간 제외한 앞뒤 병합
          </small>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="executeTrimVideoOnly()" style="margin: 0;">🎬 영상만 자르기</button>
          <button class="property-btn secondary" onclick="executeTrimAudioOnly()" style="margin: 0;">🔉 오디오만 자르기</button>
        </div>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 영상만: 영상에서 선택 구간 삭제, 오디오는 뒤에서 자름 | 오디오만: 영상 원본 유지, 오디오에서 선택 구간 삭제 후 뒤 오디오 앞으로 이동</small>
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
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="audio-trim-start" min="0" max="${audioDuration}" step="0.1" value="${audioDuration.toFixed(2)}" style="flex: 1; padding: 8px;">
            <button class="property-btn secondary" onclick="setAudioStartFromSlider()" style="width: auto; padding: 8px 12px; margin: 0;" title="타임라인 위치를 시작 시간으로">🔄</button>
          </div>
          <small style="color: #888; font-size: 11px;">최대: ${audioDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group">
          <label>끝 시간 (초)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="audio-trim-end" min="0" max="${audioDuration}" step="0.1" value="${audioDuration.toFixed(2)}" style="flex: 1; padding: 8px;">
            <button class="property-btn secondary" onclick="setAudioEndFromSlider()" style="width: auto; padding: 8px 12px; margin: 0;" title="타임라인 위치를 끝 시간으로">🔄</button>
          </div>
          <small style="color: #888; font-size: 11px;">최대: ${audioDuration.toFixed(2)}초</small>
        </div>
        <div class="property-group" style="background: #2d2d2d; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <label style="color: #667eea;">자르기 구간 길이</label>
          <div id="audio-trim-duration-display" style="font-size: 16px; font-weight: 600; color: #e0e0e0; margin-top: 5px;">0.00초</div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="previewAudioTrimRange()" style="flex: 1;">🎵 구간 미리듣기</button>
        </div>
        <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
          <div style="font-weight: 600; color: #667eea; margin-bottom: 8px;">✂️ 자르기 옵션</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button class="property-btn" onclick="executeTrimAudioFile()" style="margin: 0; background: #667eea;">✅ 선택 구간 유지</button>
            <button class="property-btn" onclick="executeDeleteAudioRange()" style="margin: 0; background: #e74c3c;">🗑️ 선택 구간 삭제</button>
          </div>
          <small style="display: block; color: #aaa; margin-top: 8px; font-size: 11px;">
            • 유지: 선택 구간만 남김<br>
            • 삭제: 선택 구간 제외한 앞뒤 연결
          </small>
        </div>
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
        <button class="property-btn secondary" onclick="previewAudioVolume()" id="preview-volume-btn">🎧 미리듣기</button>
        <button class="property-btn" onclick="executeAudioVolume()">💾 볼륨 조절하여 저장</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 1.0 = 원본, 0.5 = 절반, 2.0 = 2배<br>저장 위치를 선택하면 새 파일로 저장됩니다.</small>
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

      // Blur any focused element (especially sidebar buttons) to release keyboard focus
      if (document.activeElement) {
        document.activeElement.blur();
      }

      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label style="pointer-events: none;">현재 음성 파일</label>
          <div style="background: #2d2d2d; padding: 15px; border-radius: 5px; margin-top: 10px;">
            <div style="color: #e0e0e0; font-size: 14px; margin-bottom: 8px;">📄 ${currentAudioFile.split('\\').pop()}</div>
            <div style="color: #888; font-size: 12px;">
              ${audioFileInfo ? `길이: ${formatTime(parseFloat(audioFileInfo.format.duration))} | 크기: ${(parseFloat(audioFileInfo.format.size || 0) / (1024 * 1024)).toFixed(2)}MB` : '파일 정보 로드 중...'}
            </div>
          </div>
        </div>
        <div class="property-group">
          <label style="pointer-events: none; user-select: none; display: block; margin-bottom: 5px; color: #aaa;">제목 *</label>
          <input type="text" id="export-audio-title" placeholder="음성 파일 제목을 입력하세요" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #555; border-radius: 4px; color: #e0e0e0; font-size: 14px;"/>
        </div>
        <div class="property-group">
          <label style="pointer-events: none; user-select: none; display: block; margin-bottom: 5px; color: #aaa;">설명</label>
          <textarea id="export-audio-description" placeholder="음성 파일 설명 (선택사항)" rows="4" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #555; border-radius: 4px; color: #e0e0e0; font-size: 14px; resize: vertical;"></textarea>
        </div>
        <button class="property-btn" onclick="executeExportAudioToS3()" style="width: 100%;">☁️ S3 업로드</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 제목과 설명을 입력하고 S3에 업로드하여 관리할 수 있습니다. (제목 필수)</small>
        </div>
      `;

      // Set values immediately - no focus manipulation needed
      setTimeout(() => {
        const titleInput = document.getElementById('export-audio-title');
        const descriptionInput = document.getElementById('export-audio-description');

        if (titleInput) {
          titleInput.value = currentAudioMetadata.title || '';
        }

        if (descriptionInput) {
          descriptionInput.value = currentAudioMetadata.description || '';
        }
      }, 50);
      break;

    case 'merge':
      // 현재 로드된 영상이 있으면 병합 리스트에 자동 추가
      if (currentVideo && !mergeVideos.includes(currentVideo)) {
        mergeVideos = [currentVideo]; // 현재 영상을 첫 번째로 설정
      }

      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>병합할 영상들 (순서대로)</label>
          <div id="merge-files" class="file-list"></div>
          <button class="property-btn secondary" onclick="addVideoToMerge()">+ 영상 추가</button>
        </div>
        <div class="property-group">
          <label>트랜지션 효과</label>
          <select id="merge-transition" onchange="updateTransitionDurationVisibility()">
            <option value="concat">없음 (이어붙이기)</option>
            <option value="fade">페이드</option>
            <option value="xfade-fade">크로스페이드 - Fade</option>
            <option value="xfade-wipeleft">크로스페이드 - Wipe Left</option>
            <option value="xfade-wiperight">크로스페이드 - Wipe Right</option>
            <option value="xfade-wipeup">크로스페이드 - Wipe Up</option>
            <option value="xfade-wipedown">크로스페이드 - Wipe Down</option>
            <option value="xfade-slideleft">크로스페이드 - Slide Left</option>
            <option value="xfade-slideright">크로스페이드 - Slide Right</option>
            <option value="xfade-slideup">크로스페이드 - Slide Up</option>
            <option value="xfade-slidedown">크로스페이드 - Slide Down</option>
          </select>
          <small id="transition-description" style="color: #888; display: block; margin-top: 5px;"></small>
        </div>
        <div class="property-group" id="duration-group">
          <label>트랜지션 지속시간 (초)</label>
          <input type="number" id="merge-duration" min="0.5" max="3" step="0.1" value="1">
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="previewMerge()" style="flex: 1;">🎬 미리보기</button>
          <button class="property-btn secondary" onclick="stopMergePreview()" style="flex: 1;">⏹️ 중지</button>
        </div>
        <button class="property-btn" onclick="executeMerge()">영상 병합</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 영상들을 순서대로 병합합니다. 트랜지션은 영상과 영상 사이에 적용됩니다.</small>
        </div>
      `;

      // 파일 리스트 업데이트
      updateMergeFileList();
      // 트랜지션 설명 업데이트
      updateTransitionDescription();
      updateTransitionDurationVisibility();
      break;

    case 'merge-audio':
      // 현재 로드된 오디오가 있으면 병합 리스트에 자동 추가
      if (currentAudioFile) {
        const alreadyAdded = mergeAudios.some(item => {
          const itemPath = typeof item === 'string' ? item : item.path;
          return itemPath === currentAudioFile;
        });

        if (!alreadyAdded) {
          mergeAudios = [{ type: 'file', path: currentAudioFile }]; // 현재 오디오를 첫 번째로 설정
        }
      }

      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>병합할 오디오 파일들 (순서대로 이어붙이기)</label>
          <div id="merge-audio-files" class="file-list"></div>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button class="property-btn secondary" onclick="addAudioToMerge()" style="flex: 1;">+ 오디오 추가</button>
            <button class="property-btn secondary" onclick="addSilenceToMerge()" style="flex: 1;">🔇 무음 추가</button>
          </div>
        </div>
        <button class="property-btn" onclick="executeMergeAudio()">오디오 병합</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 오디오 파일과 무음을 순서대로 병합할 수 있습니다</small>
        </div>
      `;

      // 파일 리스트 업데이트
      updateMergeAudioFileList();
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
      // Use video metadata as default values if available
      const extractTitle = currentVideoMetadata?.title || '';
      const extractDescription = currentVideoMetadata?.description || '';

      propertiesPanel.innerHTML = `
        <p style="margin-bottom: 20px;">현재 영상에서 오디오를 추출합니다.</p>
        <div class="property-group">
          <label>제목</label>
          <input type="text" id="extract-audio-title" placeholder="추출된 오디오 제목 입력" value="${extractTitle.replace(/"/g, '&quot;')}">
        </div>
        <div class="property-group">
          <label>설명</label>
          <textarea id="extract-audio-description" rows="3" placeholder="설명 입력 (선택사항)">${extractDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        <button class="property-btn" onclick="executeExtractAudioToS3()">S3에 저장</button>
      `;
      break;

    case 'volume':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>볼륨 조절 <span class="property-value" id="volume-adjust-value">1.0</span></label>
          <input type="range" id="volume-adjust" min="0" max="3" step="0.1" value="1" oninput="updateVolumeAdjustDisplay()">
          <small style="color: #888;">1.0 = 원본, 2.0 = 2배 증폭</small>
        </div>
        <button class="property-btn secondary" onclick="previewVideoVolume()" id="preview-video-volume-btn">🎧 미리듣기</button>
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
          <textarea id="text-content" placeholder="입력할 텍스트" oninput="updateTextContentPreview()"></textarea>
        </div>
        <div style="display: grid; grid-template-columns: 0.8fr 1fr 1.2fr; gap: 10px;">
          <div class="property-group" style="margin: 0;">
            <label>폰트 크기</label>
            <input type="number" id="text-size" min="10" max="200" value="48" oninput="updateTextSizePreview()">
          </div>
          <div class="property-group" style="margin: 0; position: relative;">
            <label>색상</label>
            <div style="display: flex; gap: 5px; align-items: center;">
              <input type="color" id="text-color" value="#ffffff" oninput="updateTextColorPreview()" onchange="saveColorToHistory()" style="flex: 1;">
              <button type="button" onclick="toggleColorHistory(event)" style="width: 24px; height: 30px; padding: 0; font-size: 14px; background: #3a3a3a; border: 1px solid #555; border-radius: 3px; cursor: pointer;" title="색상 히스토리">🎨</button>
            </div>
            <div id="color-history-popup" style="display: none; position: absolute; top: 100%; left: 0; background: #2d2d2d; border: 1px solid #555; border-radius: 5px; padding: 10px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.5); margin-top: 5px;">
              <div id="color-history" style="display: flex; gap: 5px; flex-wrap: wrap; max-width: 220px;"></div>
            </div>
          </div>
          <div class="property-group" style="margin: 0;">
            <label>정렬</label>
            <select id="text-align" onchange="updateTextAlignPreview()">
              <option value="left">← 왼쪽</option>
              <option value="center">↔ 가운데</option>
              <option value="right">→ 오른쪽</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="property-group" style="margin: 0;">
            <label>폰트</label>
            <select id="text-font" onchange="updateTextFontPreview()">
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Verdana">Verdana</option>
              <option value="Georgia">Georgia</option>
              <option value="Malgun Gothic" selected>맑은 고딕</option>
              <option value="Gulim">굴림</option>
              <option value="Dotum">돋움</option>
              <option value="Batang">바탕</option>
            </select>
          </div>
          <div class="property-group" style="margin: 0;">
            <label>글꼴 스타일</label>
            <select id="text-style" onchange="updateTextStylePreview()">
              <option value="regular">기본</option>
              <option value="bold">굵게</option>
              <option value="italic">기울임</option>
              <option value="bold-italic">굵게+기울임</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="property-group" style="margin: 0;">
            <label>가로 위치</label>
            <select id="text-x" onchange="updateTextOverlayPreview()">
              <option value="(w-text_w)/2">중앙</option>
              <option value="30">왼쪽</option>
              <option value="(w-text_w-30)">오른쪽</option>
            </select>
          </div>
          <div class="property-group" style="margin: 0;">
            <label>세로 위치</label>
            <select id="text-y" onchange="updateTextOverlayPreview()">
              <option value="(h-text_h)/2">중앙</option>
              <option value="30">상단</option>
              <option value="(h-text_h-30)" selected>하단</option>
            </select>
          </div>
        </div>
        <div class="property-group">
          <label>시작 시간 (초, 비워두면 전체)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="text-start" min="0" step="0.1" placeholder="선택사항" oninput="updateTextRangeDisplay()" style="flex: 1;">
            <button class="property-btn secondary" onclick="setTextStartFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 시작 시간으로">🔄</button>
          </div>
        </div>
        <div class="property-group">
          <label>끝시간 (초, 비워두면 끝까지)</label>
          <div style="display: flex; gap: 5px; align-items: center;">
            <input type="number" id="text-end" min="0.1" step="0.1" placeholder="선택사항" oninput="updateTextRangeDisplay()" style="flex: 1;">
            <button class="property-btn secondary" onclick="setTextEndFromCurrentTime()" style="width: auto; padding: 8px 12px; margin: 0;" title="현재 재생 위치를 끝 시간으로">🔄</button>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="previewTextRange()" style="flex: 1;">🎬 구간 미리보기</button>
        </div>
        <button class="property-btn" onclick="executeAddText()">텍스트 추가</button>
      `;
      // Load and display color history
      loadColorHistory();
      renderColorHistory();
      break;

    case 'speed':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>속도 배율 <span class="property-value" id="speed-value">1.0x</span></label>
          <input type="range" id="speed-factor" min="0.25" max="4" step="0.25" value="1" oninput="updateSpeedDisplay()">
          <small style="color: #888;">0.5x = 슬로우모션, 2.0x = 배속</small>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="previewSpeed()" style="flex: 1;">🎬 미리보기</button>
          <button class="property-btn secondary" onclick="stopSpeedPreview()" style="flex: 1;">⏹️ 중지</button>
        </div>
        <button class="property-btn" onclick="executeSpeed()">속도 적용</button>
      `;
      break;

    case 'audio-speed':
      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>속도 배율 <span class="property-value" id="audio-speed-value">1.0x</span></label>
          <input type="range" id="audio-speed-factor" min="0.25" max="4" step="0.25" value="1" oninput="updateAudioSpeedDisplay()">
          <small style="color: #888;">0.5x = 슬로우모션, 2.0x = 배속</small>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="property-btn secondary" onclick="previewAudioSpeed()" style="flex: 1;">🎬 미리보기</button>
          <button class="property-btn secondary" onclick="stopAudioSpeedPreview()" style="flex: 1;">⏹️ 중지</button>
        </div>
        <button class="property-btn" onclick="executeAudioSpeed()">속도 적용</button>
      `;
      break;

    case 'export':
      if (!currentVideo) {
        alert('먼저 영상을 가져와주세요.');
        return;
      }

      // Use video metadata as default values if available
      const exportVideoTitle = currentVideoMetadata?.title || '';
      const exportVideoDescription = currentVideoMetadata?.description || '';

      propertiesPanel.innerHTML = `
        <div class="property-group">
          <label>현재 영상 파일</label>
          <div style="background: #2d2d2d; padding: 15px; border-radius: 5px; margin-top: 10px;">
            <div style="color: #e0e0e0; font-size: 14px; margin-bottom: 8px;">📄 ${currentVideo.split('\\').pop()}</div>
            <div style="color: #888; font-size: 12px;">
              ${videoInfo ? `길이: ${formatTime(parseFloat(videoInfo.format.duration))} | 크기: ${(parseFloat(videoInfo.format.size || 0) / (1024 * 1024)).toFixed(2)}MB` : ''}
            </div>
          </div>
        </div>
        <div class="property-group">
          <label>제목</label>
          <input type="text" id="export-video-title" placeholder="영상 제목 입력" value="${exportVideoTitle.replace(/"/g, '&quot;')}">
        </div>
        <div class="property-group">
          <label>설명</label>
          <textarea id="export-video-description" rows="3" placeholder="설명 입력 (선택사항)">${exportVideoDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        <button class="property-btn" onclick="executeExportVideoToS3()">S3에 저장</button>
        <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
          <small style="color: #aaa;">💡 편집된 영상 파일을 S3에 저장합니다</small>
        </div>
      `;
      break;

    // Import tools for content mode
    case 'import-image':
      propertiesPanel.innerHTML = `
        <div style="height: calc(100vh - 250px); overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">🖼️ 이미지 가져오기</h3>

          <div class="property-group">
            <label>선택된 파일</label>
            <div id="selected-image-info" style="padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #aaa; font-size: 13px; min-height: 40px; display: flex; align-items: center;">
              파일이 선택되지 않았습니다
            </div>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #4ade80;">
            <input type="file" id="import-image-file" accept="image/*" style="display: none;" onchange="updateSelectedImageInfo()">
            <button class="property-btn" onclick="document.getElementById('import-image-file').click()" style="margin: 0; background: #4ade80; width: 100%;">
              📁 이미지 파일 선택
            </button>
          </div>

          <div class="property-group">
            <label>제목 *</label>
            <input
              type="text"
              id="import-image-title"
              placeholder="이미지 제목을 입력하세요"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            />
          </div>

          <div class="property-group">
            <label>설명</label>
            <textarea
              id="import-image-description"
              rows="3"
              placeholder="이미지 설명을 입력하세요 (선택사항)"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="uploadImageToS3()" style="margin: 0; background: #667eea; width: 100%;">
              ☁️ S3에 업로드
            </button>
          </div>
        </div>
      `;
      break;

    case 'import-video-content':
      propertiesPanel.innerHTML = `
        <div style="height: calc(100vh - 250px); overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">🎬 영상 가져오기</h3>

          <div class="property-group">
            <label>선택된 파일</label>
            <div id="selected-video-content-info" style="padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #aaa; font-size: 13px; min-height: 40px; display: flex; align-items: center;">
              파일이 선택되지 않았습니다
            </div>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #4ade80;">
            <input type="file" id="import-video-content-file" accept="video/*" style="display: none;" onchange="updateSelectedVideoContentInfo()">
            <button class="property-btn" onclick="document.getElementById('import-video-content-file').click()" style="margin: 0; background: #4ade80; width: 100%;">
              📁 영상 파일 선택
            </button>
          </div>

          <div class="property-group">
            <label>제목 *</label>
            <input
              type="text"
              id="import-video-content-title"
              placeholder="영상 제목을 입력하세요"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            />
          </div>

          <div class="property-group">
            <label>설명</label>
            <textarea
              id="import-video-content-description"
              rows="3"
              placeholder="영상 설명을 입력하세요 (선택사항)"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="uploadVideoContentToS3()" style="margin: 0; background: #667eea; width: 100%;">
              ☁️ S3에 업로드
            </button>
          </div>
        </div>
      `;
      break;

    case 'import-audio-content':
      propertiesPanel.innerHTML = `
        <div style="height: calc(100vh - 250px); overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">📁 음성 가져오기</h3>

          <div class="property-group">
            <label>선택된 파일</label>
            <div id="selected-audio-info" style="padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #aaa; font-size: 13px; min-height: 40px; display: flex; align-items: center;">
              파일이 선택되지 않았습니다
            </div>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #4ade80;">
            <button class="property-btn" onclick="selectAudioFileForUpload()" style="margin: 0; background: #4ade80; width: 100%;">
              📁 음성 파일 선택
            </button>
          </div>

          <div class="property-group">
            <label>제목 *</label>
            <input
              type="text"
              id="audio-upload-title"
              placeholder="음성 제목을 입력하세요"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            />
          </div>

          <div class="property-group">
            <label>설명</label>
            <textarea
              id="audio-upload-description"
              rows="3"
              placeholder="음성 설명을 입력하세요 (선택사항)"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="uploadAudioToS3()" style="margin: 0; background: #667eea; width: 100%;">
              ☁️ S3에 업로드
            </button>
          </div>
        </div>
      `;
      break;

    // Runway Image Generation
    case 'generate-image-runway':
      propertiesPanel.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">🎨 Runway 이미지 생성</h3>

          <div class="property-group">
            <label>참조 이미지 (1~5개)</label>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px;">
              <div id="ref-image-slot-0" style="border: 2px dashed #444; border-radius: 8px; padding: 8px; aspect-ratio: 1/1; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #2a2a2a;" onclick="selectReferenceImage(0)">
                <span style="font-size: 32px;">🖼️</span>
              </div>
              <div id="ref-image-slot-1" style="border: 2px dashed #444; border-radius: 8px; padding: 8px; aspect-ratio: 1/1; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #2a2a2a;" onclick="selectReferenceImage(1)">
                <span style="font-size: 32px;">🖼️</span>
              </div>
              <div id="ref-image-slot-2" style="border: 2px dashed #444; border-radius: 8px; padding: 8px; aspect-ratio: 1/1; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #2a2a2a;" onclick="selectReferenceImage(2)">
                <span style="font-size: 32px;">🖼️</span>
              </div>
              <div id="ref-image-slot-3" style="border: 2px dashed #444; border-radius: 8px; padding: 8px; aspect-ratio: 1/1; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #2a2a2a;" onclick="selectReferenceImage(3)">
                <span style="font-size: 32px;">🖼️</span>
              </div>
              <div id="ref-image-slot-4" style="border: 2px dashed #444; border-radius: 8px; padding: 8px; aspect-ratio: 1/1; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #2a2a2a;" onclick="selectReferenceImage(4)">
                <span style="font-size: 32px;">🖼️</span>
              </div>
            </div>
          </div>

          <div class="property-group">
            <label>프롬프트 *</label>
            <textarea
              id="image-prompt-runway"
              rows="4"
              placeholder="생성할 이미지에 대한 설명을 입력하세요..."
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div class="property-group">
            <label>이미지 스타일</label>
            <select
              id="image-style-runway"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            >
              <option value="realistic">사실적 (Realistic)</option>
              <option value="anime">애니메이션 (Anime)</option>
              <option value="artistic">예술적 (Artistic)</option>
              <option value="photograph">사진 (Photograph)</option>
              <option value="illustration">일러스트 (Illustration)</option>
            </select>
          </div>

          <div class="property-group">
            <label>종횡비</label>
            <select
              id="image-aspect-runway"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            >
              <option value="1024:1024">정사각형 (1:1)</option>
              <option value="1920:1080">가로 (16:9)</option>
              <option value="1080:1920">세로 (9:16)</option>
              <option value="1440:1080">가로 (4:3)</option>
              <option value="1080:1440">세로 (3:4)</option>
            </select>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="executeGenerateImageRunway()" style="width: 100%; margin: 0; background: #667eea;">
              🎨 이미지 생성
            </button>
          </div>

          <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
            <small style="color: #aaa;">💡 Runway ML API를 사용하여 AI 이미지를 생성합니다</small>
            <br>
            <small style="color: #888; font-size: 10px;">⚙️ 백엔드 서버 필요: RUNWAY_API_KEY 설정</small>
          </div>
        </div>
      `;
      break;

    // Veo Image Generation
    case 'generate-image-veo':
      propertiesPanel.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">✨ Veo 이미지 생성</h3>

          <div class="property-group">
            <label>프롬프트 *</label>
            <textarea
              id="image-prompt-veo"
              rows="4"
              placeholder="생성할 이미지에 대한 설명을 입력하세요..."
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div class="property-group">
            <label>종횡비</label>
            <select
              id="image-aspect-veo"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            >
              <option value="16:9">16:9 (가로)</option>
              <option value="9:16">9:16 (세로)</option>
              <option value="1:1">1:1 (정사각형)</option>
            </select>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="executeGenerateImageVeo()" style="width: 100%; margin: 0; background: #667eea;">
              ✨ 이미지 생성
            </button>
          </div>

          <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
            <small style="color: #aaa;">💡 Google Veo API를 사용하여 AI 이미지를 생성합니다</small>
            <br>
            <small style="color: #888; font-size: 10px;">⚙️ 환경변수 필요: GOOGLE_AI_API_KEY</small>
          </div>
        </div>
      `;
      break;

    // Runway Video Generation
    case 'generate-video-runway':
      propertiesPanel.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">🎥 Runway 영상 생성</h3>

          <div class="property-group">
            <label>프롬프트 *</label>
            <textarea
              id="video-prompt-runway"
              rows="4"
              placeholder="생성할 영상에 대한 설명을 입력하세요..."
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="property-group">
              <label>영상 길이 (초)</label>
              <select
                id="video-duration-runway"
                style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
              >
                <option value="5">5초</option>
                <option value="10" selected>10초</option>
                <option value="15">15초</option>
              </select>
            </div>

            <div class="property-group">
              <label>해상도</label>
              <select
                id="video-resolution-runway"
                style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
              >
                <option value="1280x720">HD (1280x720)</option>
                <option value="1920x1080" selected>Full HD (1920x1080)</option>
              </select>
            </div>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="executeGenerateVideoRunway()" style="width: 100%; margin: 0; background: #667eea;">
              🎥 영상 생성
            </button>
          </div>

          <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
            <small style="color: #aaa;">💡 Runway ML API를 사용하여 AI 영상을 생성합니다</small>
            <br>
            <small style="color: #888; font-size: 10px;">⚙️ 환경변수 필요: RUNWAY_API_KEY</small>
          </div>
        </div>
      `;
      break;

    // Veo Video Generation
    case 'generate-video-veo':
      propertiesPanel.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">🌟 Veo 영상 생성</h3>

          <div class="property-group">
            <label>프롬프트 *</label>
            <textarea
              id="video-prompt-veo"
              rows="4"
              placeholder="생성할 영상에 대한 설명을 입력하세요..."
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="property-group">
              <label>영상 길이 (초)</label>
              <select
                id="video-duration-veo"
                style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
              >
                <option value="5">5초</option>
                <option value="8" selected>8초</option>
                <option value="10">10초</option>
              </select>
            </div>

            <div class="property-group">
              <label>종횡비</label>
              <select
                id="video-aspect-veo"
                style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
              >
                <option value="16:9" selected>16:9 (가로)</option>
                <option value="9:16">9:16 (세로)</option>
              </select>
            </div>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="executeGenerateVideoVeo()" style="width: 100%; margin: 0; background: #667eea;">
              🌟 영상 생성
            </button>
          </div>

          <div style="background: #3a3a3a; padding: 10px; border-radius: 5px; margin-top: 10px;">
            <small style="color: #aaa;">💡 Google Veo API를 사용하여 AI 영상을 생성합니다</small>
            <br>
            <small style="color: #888; font-size: 10px;">⚙️ 환경변수 필요: GOOGLE_AI_API_KEY</small>
          </div>
        </div>
      `;
      break;

    // Google TTS Audio Generation
    case 'generate-audio-google':
    case 'generate-audio':
    case 'generate-tts':
      propertiesPanel.innerHTML = `
        <div style="height: calc(100vh - 250px); overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
          <h3 style="margin-bottom: 15px; color: #667eea;">🗣️ Google TTS 음성 생성</h3>

          <div class="property-group">
            <label>텍스트 입력 (최대 5000자) *</label>
            <textarea
              id="tts-text"
              maxlength="5000"
              rows="4"
              placeholder="음성으로 변환할 텍스트를 입력하세요..."
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
              oninput="updateTtsCharCount()"
            ></textarea>
            <small id="tts-char-count" style="color: #888; font-size: 11px;">0 / 5000 자</small>
          </div>

          <div class="property-group">
            <label>제목 *</label>
            <input
              type="text"
              id="tts-title"
              placeholder="음성 제목을 입력하세요"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px;"
            />
          </div>

          <div class="property-group">
            <label>설명</label>
            <textarea
              id="tts-description"
              rows="2"
              placeholder="음성 설명을 입력하세요 (선택사항)"
              style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <input type="hidden" id="tts-language" value="ko-KR" />

          <div class="property-group">
            <label>음성 종류</label>
            <select
              id="tts-voice"
              style="width: 100%; padding: 8px; background: #2d2d2d; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 13px;"
            >
              <option value="ko-KR-Neural2-A">Neural2-A (여성, 자연스러운 톤)</option>
              <option value="ko-KR-Neural2-B">Neural2-B (여성, 부드러운 톤)</option>
              <option value="ko-KR-Neural2-C">Neural2-C (남성, 차분한 톤)</option>
              <option value="ko-KR-Standard-A">Standard-A (여성, 표준 음질)</option>
              <option value="ko-KR-Standard-B">Standard-B (여성, 표준 음질)</option>
              <option value="ko-KR-Standard-C">Standard-C (남성, 표준 음질)</option>
              <option value="ko-KR-Standard-D">Standard-D (남성, 표준 음질)</option>
              <option value="ko-KR-Wavenet-A">Wavenet-A (여성, 최고 음질)</option>
              <option value="ko-KR-Wavenet-B">Wavenet-B (여성, 최고 음질)</option>
              <option value="ko-KR-Wavenet-C">Wavenet-C (남성, 최고 음질)</option>
              <option value="ko-KR-Wavenet-D">Wavenet-D (남성, 최고 음질)</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div class="property-group" style="margin-bottom: 0;">
              <label>속도: <span id="tts-speed-value">1.0</span>x</label>
              <input
                type="range"
                id="tts-speed"
                min="0.5"
                max="2.0"
                step="0.1"
                value="1.0"
                oninput="updateTtsSpeedDisplay()"
                style="width: 100%;"
              />
            </div>

            <div class="property-group" style="margin-bottom: 0;">
              <label>피치: <span id="tts-pitch-value">0</span></label>
              <input
                type="range"
                id="tts-pitch"
                min="-20"
                max="20"
                step="1"
                value="0"
                oninput="updateTtsPitchDisplay()"
                style="width: 100%;"
              />
            </div>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #4ade80;">
            <button class="property-btn" onclick="previewTTS()" style="margin: 0; background: #4ade80; width: 100%;">
              🎧 미리듣기
            </button>
          </div>

          <div style="background: #2a2a3e; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #667eea;">
            <button class="property-btn" onclick="executeGenerateTTSAndUpload()" style="margin: 0; background: #667eea; width: 100%;">
              🎵 음성 생성 및 S3 저장
            </button>
          </div>
        </div>
      `;
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
    // Audio mode: play audio file
    if (currentMode === 'audio') {
      const audioElement = document.getElementById('preview-audio');
      if (audioElement) {
        // Check if audio is ready to play
        if (audioElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
          audioElement.play().catch(err => {
            console.error('Audio play error:', err);
            updateStatus('재생 실패: ' + err.message);
          });
          updateStatus('재생 중...');
        } else {
          console.log('[Play] Audio not ready, readyState:', audioElement.readyState);
          updateStatus('음성 파일 로딩 중... 잠시 후 다시 시도해주세요.');
        }
      }
      return;
    }

    // Video mode: existing video playback logic
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
    // Audio mode: pause audio file
    if (currentMode === 'audio') {
      const audioElement = document.getElementById('preview-audio');
      if (audioElement) {
        audioElement.pause();
        updateStatus('일시정지');
      }
      return;
    }

    // Video mode: existing video pause logic
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

      // Update text overlay preview
      updateTextOverlay(video.currentTime);

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

  // Function to check if click is near the thumb position
  const isClickNearThumb = (clickX, sliderValue, sliderMax, sliderWidth) => {
    const thumbPosition = (sliderValue / sliderMax) * sliderWidth;
    const distance = Math.abs(clickX - thumbPosition);
    const threshold = 15; // pixels - thumb hit area
    return distance <= threshold;
  };

  // Add mousedown listener to slider for both thumb drag and trim range selection
  slider.addEventListener('mousedown', (e) => {
    const isVideoTrim = activeTool === 'trim' && currentMode === 'video' && video.duration;
    const isAudioTrim = activeTool === 'trim-audio' && currentMode === 'audio' && audioFileInfo;
    const isTextMode = activeTool === 'text' && currentMode === 'video' && video.duration;

    if (isVideoTrim || isAudioTrim || isTextMode) {
      const rect = slider.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const sliderWidth = rect.width;
      const sliderValue = parseFloat(slider.value);
      const sliderMax = parseFloat(slider.max);

      // Check if clicking near the thumb
      const clickingThumb = isClickNearThumb(clickX, sliderValue, sliderMax, sliderWidth);

      if (clickingThumb) {
        // Clicking on thumb - allow normal seeking
        // Set flag to prevent auto-skip during thumb drag
        isUserSeekingSlider = true;
        // DO NOT call preventDefault() - let the slider handle it
      } else {
        // Clicking away from thumb - start trim range selection
        isUserSeekingSlider = true;
        sliderDragStartX = clickX;

        if (isVideoTrim) {
          sliderDragStartTime = video.currentTime;
        } else if (isAudioTrim) {
          sliderDragStartTime = 0;
        } else if (isTextMode) {
          sliderDragStartTime = video.currentTime;
        }
        e.preventDefault(); // Prevent slider from seeking
      }
    }
  });

  // Track mouse movement using global document listener (like audio zoom)
  document.addEventListener('mousemove', (e) => {
    const isDragMode = activeTool === 'trim' || activeTool === 'trim-audio' || activeTool === 'text';

    if (isUserSeekingSlider && sliderDragStartX !== null && isDragMode && slider) {
      const rect = slider.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const moveDistance = Math.abs(currentX - sliderDragStartX);

      // Detect actual drag (10px threshold)
      if (moveDistance > 10) {
        sliderIsDragging = true;
      }

      if (sliderIsDragging) {
        // Show drag selection box using pixel coordinates relative to slider
        const width = Math.abs(currentX - sliderDragStartX);
        const left = Math.min(sliderDragStartX, currentX);

        sliderDragSelection.style.left = `${left}px`;
        sliderDragSelection.style.width = `${width}px`;
        sliderDragSelection.style.display = 'block';
      }
    }
  });

  slider.addEventListener('input', (e) => {
    // Only update video time in video mode
    if (currentMode === 'video' && video && video.duration) {
      const time = (e.target.value / 100) * video.duration;
      video.currentTime = time;
    }

    // In audio mode, slider value is already in seconds (slider.max = duration)
    if (currentMode === 'audio' && audioFileInfo) {
      const audioDuration = parseFloat(audioFileInfo.format.duration);
      const time = parseFloat(e.target.value); // Direct time value in seconds
      const currentTimeDisplay = document.getElementById('current-time');
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(time);
      }

      // Seek audio element to slider position
      const audioElement = document.getElementById('preview-audio');
      if (audioElement && !isNaN(audioElement.duration)) {
        audioElement.currentTime = time;
      }

      // Update playhead bar position in audio track
      const playheadBar = document.getElementById('playhead-bar');
      if (playheadBar) {
        // Calculate percentage relative to full duration
        const percentage = time / audioDuration;

        // Check if current time is within zoomed range
        if (percentage >= zoomStart && percentage <= zoomEnd) {
          // Show playhead and position it relative to zoomed range
          playheadBar.style.display = 'block';
          const relativePosition = ((percentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
          playheadBar.style.left = `${relativePosition}%`;
        } else {
          // Hide playhead when outside zoomed range
          playheadBar.style.display = 'none';
        }
      }
    }
  });

  // Global mouseup listener (like audio zoom)
  document.addEventListener('mouseup', (e) => {
    const isVideoTrim = activeTool === 'trim' && currentMode === 'video' && video.duration;
    const isAudioTrim = activeTool === 'trim-audio' && currentMode === 'audio' && audioFileInfo;
    const isTextMode = activeTool === 'text' && currentMode === 'video' && video.duration;

    // Handle drag to set trim range
    if (isUserSeekingSlider && sliderIsDragging && sliderDragStartX !== null && slider) {
      const rect = slider.getBoundingClientRect();
      const currentX = e.clientX - rect.left;

      // Calculate start and end percentages from pixel positions (relative to slider)
      const startPercent = Math.min(sliderDragStartX, currentX) / rect.width;
      const endPercent = Math.max(sliderDragStartX, currentX) / rect.width;

      if (isVideoTrim) {
        // Video trim mode
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

            console.log(`[Slider] Video trim range set: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
          }
        }
      } else if (isAudioTrim) {
        // Audio trim mode
        const audioDuration = parseFloat(audioFileInfo.format.duration);
        const startTime = startPercent * audioDuration;
        const endTime = endPercent * audioDuration;

        // Only set if drag distance is significant (at least 0.2 seconds)
        if (Math.abs(endTime - startTime) > 0.2) {
          const startInput = document.getElementById('audio-trim-start');
          const endInput = document.getElementById('audio-trim-end');

          if (startInput && endInput) {
            startInput.value = startTime.toFixed(2);
            endInput.value = endTime.toFixed(2);

            updateAudioTrimDurationDisplay();
            updateStatus(`구간 선택: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);
          }
        }
      } else if (isTextMode) {
        // Text mode - set start and end time
        const startTime = startPercent * video.duration;
        const endTime = endPercent * video.duration;

        // Only set if drag distance is significant (at least 0.5 seconds)
        if (Math.abs(endTime - startTime) > 0.5) {
          const startInput = document.getElementById('text-start');
          const endInput = document.getElementById('text-end');

          if (startInput && endInput) {
            startInput.value = startTime.toFixed(2);
            endInput.value = endTime.toFixed(2);

            updateTextRangeOverlay(startTime, endTime, video.duration);
            updateStatus(`텍스트 표시 시간: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);
          }
        }
      }
    }
    // Handle click (not drag) - seek to clicked position
    else if (isUserSeekingSlider && !sliderIsDragging && sliderDragStartX !== null && slider) {
      const rect = slider.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = clickX / rect.width;

      if (isVideoTrim || isTextMode) {
        // Video mode: seek to clicked position
        if (video && video.duration) {
          const targetTime = clickPercent * video.duration;
          video.currentTime = Math.max(0, Math.min(targetTime, video.duration));

          // Update slider
          slider.value = clickPercent * 100;

          // Update time display
          const currentTimeDisplay = document.getElementById('current-time');
          if (currentTimeDisplay) {
            currentTimeDisplay.textContent = formatTime(video.currentTime);
          }
        }
      } else if (isAudioTrim) {
        // Audio mode: seek to clicked position
        const audioDuration = parseFloat(audioFileInfo.format.duration);
        const targetTime = clickPercent * audioDuration;

        // Update slider
        slider.value = Math.max(0, Math.min(targetTime, audioDuration));

        // Update time display
        const currentTimeDisplay = document.getElementById('current-time');
        if (currentTimeDisplay) {
          currentTimeDisplay.textContent = formatTime(targetTime);
        }

        // Seek audio element
        const audioElement = document.getElementById('preview-audio');
        if (audioElement && !isNaN(audioElement.duration)) {
          audioElement.currentTime = targetTime;
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
  // Check authentication
  if (!authToken || !currentUser) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      const videoPath = await window.electronAPI.selectVideo();
      if (!videoPath) return;
      await loadVideoWithAudioCheck(videoPath);
    } else {
      // Show login modal
      showLoginModal();
    }
    return;
  }

  // Show video list from S3
  await showVideoListFromS3();
}

// Load video with audio check (helper function)
async function loadVideoWithAudioCheck(videoPath) {
  try {
    // Check if video has audio track, add silent audio if missing
    console.log('[Import Video] Checking audio for:', videoPath);
    updateStatus('영상 오디오 확인 중...');
    const result = await window.electronAPI.ensureVideoHasAudio(videoPath);

    console.log('[Import Video] Result:', result);

    if (result.addedAudio) {
      console.log('[Import Video] Silent audio track added, new path:', result.videoPath);
      alert('영상에 오디오가 없어 무음 스테레오 트랙이 자동으로 추가되었습니다.');
      updateStatus('무음 오디오 트랙이 추가되었습니다');
      hasSilentAudio = true;  // Mark as having silent audio
      currentVideo = result.videoPath;
      loadVideo(result.videoPath);
    } else {
      console.log('[Import Video] Video already has audio:', result.videoPath);
      hasSilentAudio = false;  // Has real audio
      currentVideo = result.videoPath;
      loadVideo(result.videoPath);
      updateStatus(`영상 로드: ${videoPath}`);
    }
  } catch (error) {
    console.error('[Import Video] Error ensuring audio:', error);
    alert('오디오 트랙 추가 중 오류가 발생했습니다. 원본 파일을 로드합니다.');
    // Fallback to original path if audio adding fails
    hasSilentAudio = false;  // Assume original file, not silent
    currentVideo = videoPath;
    loadVideo(videoPath);
    updateStatus(`영상 로드: ${videoPath} (오디오 확인 실패)`);
  }
}

// Load video
async function loadVideo(path) {
  try {
    const video = document.getElementById('preview-video');
    const placeholder = document.getElementById('preview-placeholder');

    // Reset volume preview button if exists
    const previewBtn = document.getElementById('preview-video-volume-btn');
    if (previewBtn) {
      previewBtn.textContent = '🎧 미리듣기';
      previewBtn.classList.remove('active');
    }

    // Load video
    video.src = `file:///${path.replace(/\\/g, '/')}`;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    video.volume = 1.0; // Reset volume to original

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
      if (!videoPlayheadInteractionSetup) {
        setupPlayheadInteraction();
        videoPlayheadInteractionSetup = true;
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
      // Also hide silent audio indicator
      const silentIndicator = document.getElementById('silent-audio-indicator');
      if (silentIndicator) {
        silentIndicator.style.display = 'none';
      }
      return;
    }

    console.log('Generating waveform...');
    updateStatus('오디오 파형 생성 중...');

    // Reset regenerated flag when loading new waveform
    isWaveformRegenerated = false;

    const base64Image = await window.electronAPI.generateWaveform(videoPath);

    if (base64Image) {
      // Display the waveform image (base64 format)
      console.log('Setting waveform src (base64, length:', base64Image.length, ')');
      console.log('Waveform img element:', waveformImg);

      waveformImg.onload = () => {
        console.log('Waveform image loaded successfully');
        console.log('Image dimensions:', waveformImg.naturalWidth, 'x', waveformImg.naturalHeight);
        console.log('Image display:', waveformImg.style.display);
        console.log('Image computed style:', window.getComputedStyle(waveformImg).display);
      };

      waveformImg.onerror = (e) => {
        console.error('Failed to load waveform image:', e);
        console.error('Image src length:', waveformImg.src.length);
      };

      waveformImg.src = base64Image;
      waveformImg.style.display = 'block';
      console.log('Waveform displayed successfully');
      updateStatus('오디오 파형 생성 완료');

      // Show channel labels if stereo (2 channels)
      const channelLabels = document.getElementById('channel-labels');
      if (channelLabels && audioStream.channels === 2) {
        channelLabels.style.display = 'flex';
      } else if (channelLabels) {
        channelLabels.style.display = 'none';
      }

      // Show/hide silent audio indicator
      const silentIndicator = document.getElementById('silent-audio-indicator');
      if (silentIndicator) {
        if (hasSilentAudio) {
          silentIndicator.style.display = 'block';
          console.log('Showing silent audio indicator');
        } else {
          silentIndicator.style.display = 'none';
        }
      }
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

  let finalLeft;

  // Check if waveform has been regenerated for zoom range
  if (isWaveformRegenerated) {
    // Regenerated waveform: 0% = zoomStart, 100% = zoomEnd
    // Calculate relative position within zoom range
    if (totalPercentage < zoomStart || totalPercentage > zoomEnd) {
      // Playhead is outside zoom range - hide it
      playheadBar.style.display = 'none';
      return;
    }

    // Position relative to zoom range
    const zoomRange = zoomEnd - zoomStart;
    const relativePosition = (totalPercentage - zoomStart) / zoomRange;
    finalLeft = relativePosition * 100;

    console.log(`Playhead (regenerated): time=${currentTime.toFixed(2)}s, totalPct=${(totalPercentage*100).toFixed(1)}%, zoom=${(zoomStart*100).toFixed(1)}-${(zoomEnd*100).toFixed(1)}%, finalLeft=${finalLeft.toFixed(1)}%`);
  } else {
    // Original waveform with CSS scaling (fallback)
    const zoomRange = zoomEnd - zoomStart;
    const scale = 1 / zoomRange;

    // The playhead's left position relative to the SCALED waveform
    const playheadPositionOnScaledWaveform = totalPercentage * scale * 100;

    // Apply the same margin-left shift as the waveform
    const marginLeftPercent = -(zoomStart / zoomRange) * 100;

    // Final position: position on scaled waveform + margin shift
    finalLeft = playheadPositionOnScaledWaveform + marginLeftPercent;
  }

  // Update playhead position
  playheadBar.style.left = `${finalLeft}%`;
}

// Setup playhead interaction (click and drag)
function setupPlayheadInteraction() {
  const audioTrack = document.getElementById('audio-track');
  const playheadBar = document.getElementById('playhead-bar');
  const video = document.getElementById('preview-video');
  const zoomSelection = document.getElementById('zoom-selection');

  if (!audioTrack || !playheadBar || !zoomSelection) return;
  if (!video && currentMode === 'video') return; // Video is required only in video mode

  let isDraggingPlayhead = false;
  let isDraggingZoom = false;
  let zoomStartX = 0;

  // Function to update time based on click position (considering zoom)
  const updateVideoTimeFromClick = (e) => {
    const rect = audioTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width);
    const clampedPercentage = Math.max(0, Math.min(1, percentage));

    if (currentMode === 'video' && video) {
      // Video mode: update video element
      if (video.duration) {
        // Map percentage to zoomed time range
        const zoomRange = zoomEnd - zoomStart;
        const timeInZoom = zoomStart + (clampedPercentage * zoomRange);
        const newTime = timeInZoom * video.duration;
        video.currentTime = newTime;
      }
    } else if (currentMode === 'audio' && audioFileInfo) {
      // Audio mode: update audio element and timeline slider
      const audioElement = document.getElementById('preview-audio');
      const timelineSlider = document.getElementById('timeline-slider');

      if (audioElement && audioFileInfo.format && audioFileInfo.format.duration) {
        const duration = parseFloat(audioFileInfo.format.duration);

        // Map percentage to zoomed time range
        const zoomRange = zoomEnd - zoomStart;
        const timeInZoom = zoomStart + (clampedPercentage * zoomRange);
        const newTime = timeInZoom * duration;

        audioElement.currentTime = newTime;

        // Update timeline slider
        if (timelineSlider) {
          timelineSlider.value = newTime;
        }

        // Update time display
        const currentTimeDisplay = document.getElementById('current-time');
        if (currentTimeDisplay) {
          currentTimeDisplay.textContent = formatTime(newTime);
        }
      }
    }
  };

  // Mouse down on audio track
  audioTrack.addEventListener('mousedown', (e) => {
    // Check if clicking on playhead
    if (e.target === playheadBar || e.target.closest('.playhead-bar')) {
      isDraggingPlayhead = true;
      isUserSeekingSlider = true; // Prevent auto-skip during playhead drag
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
  document.addEventListener('mouseup', async (e) => {
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

        // Get duration for time display
        const duration = videoInfo?.format?.duration || audioFileInfo?.format?.duration;
        if (duration) {
          const startTime = zoomStart * duration;
          const endTime = zoomEnd * duration;
          console.log(`Zoomed to: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${(zoomStart * 100).toFixed(1)}% - ${(zoomEnd * 100).toFixed(1)}%)`);
        } else {
          console.log(`Zoomed to: ${(zoomStart * 100).toFixed(1)}% - ${(zoomEnd * 100).toFixed(1)}%`);
        }

        // Apply zoom to waveform
        applyWaveformZoom();
      } else {
        // Click (not drag) - seek to clicked position
        const clickPercent = (zoomStartX / rect.width);
        updateVideoTimeFromClick(e);
      }

      zoomSelection.style.display = 'none';
    }

    if (isDraggingPlayhead) {
      isUserSeekingSlider = false; // Reset flag after playhead drag
    }

    isDraggingPlayhead = false;
    isDraggingZoom = false;
  });

  // Double-click to reset zoom
  audioTrack.addEventListener('dblclick', async () => {
    zoomStart = 0;
    zoomEnd = 1;
    console.log('Zoom reset - reloading full waveform');

    // Cancel any pending regeneration
    if (waveformRegenerateTimer) {
      clearTimeout(waveformRegenerateTimer);
      waveformRegenerateTimer = null;
    }

    // Reset regenerated flag since we're loading the original full waveform
    isWaveformRegenerated = false;

    // Reload original full waveform
    const videoPath = currentVideo || currentAudioFile;
    if (videoPath) {
      try {
        const base64Image = await window.electronAPI.generateWaveform(videoPath);
        if (base64Image) {
          const waveformImg = document.getElementById('audio-waveform');
          if (waveformImg) {
            waveformImg.style.width = '100%';
            waveformImg.style.marginLeft = '0';
            waveformImg.src = base64Image;
            console.log('Full waveform reloaded');
          }
        }
      } catch (error) {
        console.error('Failed to reload full waveform:', error);
      }
    }

    applyWaveformZoom();
  });
}

// Setup audio track interaction for audio mode (zoom only, no playhead)
function setupAudioTrackInteraction() {
  const audioTrack = document.getElementById('audio-track');
  const zoomSelection = document.getElementById('zoom-selection');
  const playheadBar = document.getElementById('playhead-bar');

  if (!audioTrack || !zoomSelection) {
    console.error('Audio track or zoom selection element not found');
    return;
  }

  let isDraggingZoom = false;
  let isDraggingPlayhead = false;
  let zoomStartX = 0;

  // Function to update audio time based on click position (considering zoom)
  const updateAudioTimeFromClick = (e) => {
    if (currentMode !== 'audio' || !audioFileInfo) return;

    const rect = audioTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width);
    const clampedPercentage = Math.max(0, Math.min(1, percentage));

    const audioDuration = parseFloat(audioFileInfo.format.duration);
    if (audioDuration) {
      // Map percentage to zoomed time range
      const zoomRange = zoomEnd - zoomStart;
      const timeInZoom = zoomStart + (clampedPercentage * zoomRange);
      const newTime = timeInZoom * audioDuration;

      // Update audio element
      const audioElement = document.getElementById('preview-audio');
      if (audioElement) {
        audioElement.currentTime = newTime;
      }

      // Update timeline slider
      const timelineSlider = document.getElementById('timeline-slider');
      if (timelineSlider) {
        timelineSlider.value = newTime;
      }

      // Update time display
      const currentTimeDisplay = document.getElementById('current-time');
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(newTime);
      }
    }
  };

  // Mouse down on audio track
  audioTrack.addEventListener('mousedown', (e) => {
    // Check if clicking on playhead
    if (e.target === playheadBar || e.target.closest('.playhead-bar')) {
      isDraggingPlayhead = true;
      isUserSeekingSlider = true; // Prevent auto-skip during playhead drag
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
      updateAudioTimeFromClick(e);
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
  document.addEventListener('mouseup', async (e) => {
    if (isDraggingZoom) {
      const rect = audioTrack.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const startPercent = Math.min(zoomStartX, currentX) / rect.width;
      const endPercent = Math.max(zoomStartX, currentX) / rect.width;

      // Only zoom if selection is big enough (at least 5% of visible track)
      if (endPercent - startPercent > 0.05) {
        // Map percentages to zoom range
        const zoomRange = zoomEnd - zoomStart;
        const newZoomStart = zoomStart + (startPercent * zoomRange);
        const newZoomEnd = zoomStart + (endPercent * zoomRange);

        zoomStart = newZoomStart;
        zoomEnd = newZoomEnd;

        // Apply zoom to waveform
        applyWaveformZoom();
      } else {
        // Click (not drag) - seek to clicked position
        const clickPercent = (zoomStartX / rect.width);
        updateAudioTimeFromClick(e);
      }

      zoomSelection.style.display = 'none';
    }

    if (isDraggingPlayhead) {
      isUserSeekingSlider = false; // Reset flag after playhead drag
    }

    isDraggingZoom = false;
    isDraggingPlayhead = false;
  });

  // Double-click to reset zoom
  audioTrack.addEventListener('dblclick', async () => {
    zoomStart = 0;
    zoomEnd = 1;
    console.log('Audio zoom reset - reloading full waveform');

    // Cancel any pending regeneration
    if (waveformRegenerateTimer) {
      clearTimeout(waveformRegenerateTimer);
      waveformRegenerateTimer = null;
    }

    // Reset regenerated flag since we're loading the original full waveform
    isWaveformRegenerated = false;

    // Reload original full waveform
    const audioPath = currentAudioFile;
    if (audioPath) {
      try {
        const base64Image = await window.electronAPI.generateWaveform(audioPath);
        if (base64Image) {
          const waveformImg = document.getElementById('audio-waveform');
          if (waveformImg) {
            waveformImg.style.width = '100%';
            waveformImg.style.marginLeft = '0';
            waveformImg.src = base64Image;
            console.log('Full waveform reloaded');
          }
        }
      } catch (error) {
        console.error('Failed to reload full waveform:', error);
      }
    }

    applyWaveformZoom();
  });
}

// Apply zoom transform to waveform image (immediate, for smooth interaction)
function applyWaveformZoom() {
  const waveformImg = document.getElementById('audio-waveform');
  const audioTrack = document.getElementById('audio-track');

  if (!waveformImg || !audioTrack) {
    console.error('Waveform image or audio track element not found!');
    return;
  }

  const zoomRange = zoomEnd - zoomStart;

  console.log(`Waveform zoom: zoomStart=${(zoomStart*100).toFixed(1)}%, zoomEnd=${(zoomEnd*100).toFixed(1)}%, range=${(zoomRange*100).toFixed(1)}%`);

  // Update playhead position after zoom
  const video = document.getElementById('preview-video');
  if (video && video.duration) {
    updatePlayheadPosition(video.currentTime, video.duration);
  }

  // Update zoom range overlay on timeline slider
  updateZoomRangeOverlay();

  // Directly regenerate waveform for zoomed range (no CSS scaling)
  // Use shorter delay for better responsiveness
  applyWaveformZoomDebounced();
}


// Regenerate waveform for zoomed range (debounced)
async function applyWaveformZoomDebounced() {
  // Clear existing timer
  if (waveformRegenerateTimer) {
    clearTimeout(waveformRegenerateTimer);
  }

  // Set new timer for 300ms delay (faster response)
  waveformRegenerateTimer = setTimeout(async () => {
    // Don't regenerate if already in progress
    if (isRegeneratingWaveform) {
      console.log('Waveform regeneration already in progress, skipping...');
      return;
    }

    // Don't regenerate if not zoomed or if zoom range is invalid
    const zoomRange = zoomEnd - zoomStart;
    if (zoomRange >= 0.99 || zoomRange <= 0) {
      console.log('Not zoomed or invalid range, skipping waveform regeneration');
      return;
    }

    // Get video info
    const videoPath = currentVideo || currentAudioFile;
    if (!videoPath) {
      console.log('No video/audio loaded, skipping waveform regeneration');
      return;
    }

    const duration = videoInfo?.format?.duration || audioFileInfo?.format?.duration;
    if (!duration) {
      console.log('No duration info, skipping waveform regeneration');
      return;
    }

    try {
      isRegeneratingWaveform = true;

      // Save the zoom range we're generating for
      const savedZoomStart = zoomStart;
      const savedZoomEnd = zoomEnd;

      const startTime = zoomStart * duration;
      const endTime = zoomEnd * duration;
      const rangeDuration = zoomRange * duration;

      // Generate waveform for the zoomed range
      const base64Image = await window.electronAPI.generateWaveformRange({
        videoPath: videoPath,
        startTime: startTime,
        duration: rangeDuration
      });

      // Check if zoom range has changed during generation
      if (savedZoomStart !== zoomStart || savedZoomEnd !== zoomEnd) {
        console.log(`Zoom range changed during generation (${(savedZoomStart*100).toFixed(1)}%-${(savedZoomEnd*100).toFixed(1)}% -> ${(zoomStart*100).toFixed(1)}%-${(zoomEnd*100).toFixed(1)}%), discarding result`);
        return; // Discard this result, newer generation will take over
      }

      if (base64Image) {
        const waveformImg = document.getElementById('audio-waveform');
        if (waveformImg) {
          // Replace with the zoomed-in waveform at 100% width
          waveformImg.style.width = '100%';
          waveformImg.style.marginLeft = '0';
          waveformImg.src = base64Image;

          // Mark waveform as regenerated to prevent re-scaling
          isWaveformRegenerated = true;

          // Move video to the start of the zoomed range if in video mode
          const video = document.getElementById('preview-video');
          if (video && video.duration && currentMode === 'video') {
            // Only move if current time is outside the zoom range
            const currentPercentage = video.currentTime / video.duration;
            if (currentPercentage < zoomStart || currentPercentage > zoomEnd) {
              video.currentTime = startTime;
              console.log(`Moved playhead to zoom start: ${startTime.toFixed(2)}s`);
            }
            updatePlayheadPosition(video.currentTime, video.duration);
          }
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('No audio stream')) {
        console.warn('Video has no audio stream, skipping waveform regeneration');
      } else {
        console.error('Failed to regenerate zoomed waveform:', error);
      }
      // Keep the current waveform on error
    } finally {
      isRegeneratingWaveform = false;
    }
  }, 300);
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

// Update text range overlay on timeline
function updateTextRangeOverlay(startTime, endTime, maxDuration) {
  const overlay = document.getElementById('text-range-overlay');
  if (!overlay || !videoInfo) return;

  // Show overlay only in text mode
  if (activeTool === 'text') {
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

// Update text range display when inputs change
function updateTextRangeDisplay() {
  const startInput = document.getElementById('text-start');
  const endInput = document.getElementById('text-end');

  if (!startInput || !endInput || !videoInfo) return;

  const maxDuration = parseFloat(videoInfo.format.duration);
  let startTime = parseFloat(startInput.value);
  let endTime = parseFloat(endInput.value);

  // Only update overlay if both values are set
  if (!isNaN(startTime) && !isNaN(endTime)) {
    // Clamp values to valid range
    startTime = Math.max(0, Math.min(startTime, maxDuration));
    endTime = Math.max(0, Math.min(endTime, maxDuration));

    // Update overlay
    updateTextRangeOverlay(startTime, endTime, maxDuration);
  } else {
    // Hide overlay if values are not set
    const overlay = document.getElementById('text-range-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
}

// Update text content preview
function updateTextContentPreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Update text size preview
function updateTextSizePreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Update text color preview
function updateTextColorPreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Load color history from localStorage
function loadColorHistory() {
  const saved = localStorage.getItem('textColorHistory');
  if (saved) {
    try {
      textColorHistory = JSON.parse(saved);
    } catch (e) {
      textColorHistory = [];
    }
  }
}

// Save color to history
function saveColorToHistory() {
  const colorInput = document.getElementById('text-color');
  if (!colorInput) return;

  const color = colorInput.value.toLowerCase();

  // Remove if already exists (to move to front)
  textColorHistory = textColorHistory.filter(c => c !== color);

  // Add to front
  textColorHistory.unshift(color);

  // Keep only last 10 colors
  if (textColorHistory.length > 10) {
    textColorHistory = textColorHistory.slice(0, 10);
  }

  // Save to localStorage
  localStorage.setItem('textColorHistory', JSON.stringify(textColorHistory));

  // Update display
  renderColorHistory();

  // Close color picker
  colorInput.blur();

  // Update preview
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Render color history buttons
function renderColorHistory() {
  const container = document.getElementById('color-history');
  if (!container) return;

  container.innerHTML = '';

  textColorHistory.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.width = '40px';
    btn.style.height = '40px';
    btn.style.backgroundColor = color;
    btn.style.border = '2px solid #555';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.style.padding = '0';
    btn.style.margin = '0';
    btn.title = color;
    btn.onclick = () => selectColorFromHistory(color);
    container.appendChild(btn);
  });
}

// Toggle color history popup
function toggleColorHistory(event) {
  event.stopPropagation(); // Prevent document click from immediately closing
  const popup = document.getElementById('color-history-popup');
  if (popup) {
    if (popup.style.display === 'none') {
      popup.style.display = 'block';
      // Add document click listener to close popup when clicking outside
      setTimeout(() => {
        document.addEventListener('click', closeColorHistoryOnOutsideClick);
      }, 0);
    } else {
      popup.style.display = 'none';
      document.removeEventListener('click', closeColorHistoryOnOutsideClick);
    }
  }
}

// Close color history popup when clicking outside
function closeColorHistoryOnOutsideClick(event) {
  const popup = document.getElementById('color-history-popup');
  const historyButton = event.target.closest('button[onclick*="toggleColorHistory"]');

  if (popup && popup.style.display === 'block' && !popup.contains(event.target) && !historyButton) {
    popup.style.display = 'none';
    document.removeEventListener('click', closeColorHistoryOnOutsideClick);
  }
}

// Select color from history
function selectColorFromHistory(color) {
  const colorInput = document.getElementById('text-color');
  if (colorInput) {
    colorInput.value = color;
    updateTextColorPreview();
  }
  // Close the popup after selection
  const popup = document.getElementById('color-history-popup');
  if (popup) {
    popup.style.display = 'none';
    document.removeEventListener('click', closeColorHistoryOnOutsideClick);
  }
}

// Update text alignment preview
function updateTextAlignPreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Update text font preview
function updateTextFontPreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Update text style preview
function updateTextStylePreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Update text overlay position preview
function updateTextOverlayPreview() {
  const video = document.getElementById('preview-video');
  if (video && video.currentTime !== undefined) {
    updateTextOverlay(video.currentTime);
  }
}

// Update text overlay preview on video
function updateTextOverlay(currentTime) {
  const textOverlay = document.getElementById('text-overlay');
  if (!textOverlay) return;

  // Only show overlay in text mode
  if (activeTool !== 'text') {
    textOverlay.style.display = 'none';
    return;
  }

  const textContent = document.getElementById('text-content');
  const textSize = document.getElementById('text-size');
  const textColor = document.getElementById('text-color');
  const textAlign = document.getElementById('text-align');
  const textFont = document.getElementById('text-font');
  const textStyle = document.getElementById('text-style');
  const textX = document.getElementById('text-x');
  const textY = document.getElementById('text-y');
  const textStart = document.getElementById('text-start');
  const textEnd = document.getElementById('text-end');

  // Check if text is entered
  if (!textContent || !textContent.value) {
    textOverlay.style.display = 'none';
    return;
  }

  // Get time range
  const startTime = textStart && textStart.value ? parseFloat(textStart.value) : 0;
  const endTime = textEnd && textEnd.value ? parseFloat(textEnd.value) : Infinity;

  // Check if current time is within range
  if (currentTime < startTime || currentTime > endTime) {
    textOverlay.style.display = 'none';
    return;
  }

  // Get video element to calculate actual display area
  const video = document.getElementById('preview-video');
  if (!video || !video.videoWidth || !video.videoHeight) return;

  // Calculate video's actual display position and size (object-fit: contain)
  const videoContainer = video.parentElement;
  const containerRect = videoContainer.getBoundingClientRect();
  const videoAspect = video.videoWidth / video.videoHeight;
  const containerAspect = containerRect.width / containerRect.height;

  let displayWidth, displayHeight, offsetX, offsetY;

  if (containerAspect > videoAspect) {
    // Container is wider - video limited by height
    displayHeight = containerRect.height;
    displayWidth = displayHeight * videoAspect;
    offsetX = (containerRect.width - displayWidth) / 2;
    offsetY = 0;
  } else {
    // Container is taller - video limited by width
    displayWidth = containerRect.width;
    displayHeight = displayWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerRect.height - displayHeight) / 2;
  }

  // Calculate scale factor (display size vs original video resolution)
  const scaleFactor = displayWidth / video.videoWidth;

  // Show and update overlay
  textOverlay.style.display = 'block';
  textOverlay.textContent = textContent.value;

  // Apply styles with scaling
  if (textSize && textSize.value) {
    const scaledFontSize = parseFloat(textSize.value) * scaleFactor;
    textOverlay.style.fontSize = scaledFontSize + 'px';
  }

  if (textColor && textColor.value) {
    textOverlay.style.color = textColor.value;
  }

  // Apply font family
  if (textFont && textFont.value) {
    textOverlay.style.fontFamily = `'${textFont.value}', sans-serif`;
  }

  // Apply font style
  if (textStyle && textStyle.value) {
    const styleValue = textStyle.value;
    if (styleValue === 'bold') {
      textOverlay.style.fontWeight = 'bold';
      textOverlay.style.fontStyle = 'normal';
    } else if (styleValue === 'italic') {
      textOverlay.style.fontWeight = 'normal';
      textOverlay.style.fontStyle = 'italic';
    } else if (styleValue === 'bold-italic') {
      textOverlay.style.fontWeight = 'bold';
      textOverlay.style.fontStyle = 'italic';
    } else {
      textOverlay.style.fontWeight = 'normal';
      textOverlay.style.fontStyle = 'normal';
    }
  }

  // Position overlay to match video display area
  textOverlay.style.width = displayWidth + 'px';
  textOverlay.style.maxWidth = displayWidth + 'px';
  textOverlay.style.left = offsetX + 'px';
  textOverlay.style.top = offsetY + 'px';
  textOverlay.style.height = displayHeight + 'px';

  // Apply text alignment and position
  textOverlay.style.display = 'flex';
  textOverlay.style.padding = '30px';

  const alignValue = textAlign && textAlign.value ? textAlign.value : 'left';
  textOverlay.style.textAlign = alignValue;

  // Map text-align to justify-content for flex layout (horizontal)
  const xValue = textX && textX.value ? textX.value : '(w-text_w)/2';
  if (xValue === '30') {
    // Left
    textOverlay.style.justifyContent = 'flex-start';
  } else if (xValue === '(w-text_w-30)') {
    // Right
    textOverlay.style.justifyContent = 'flex-end';
  } else {
    // Center
    textOverlay.style.justifyContent = 'center';
  }

  // Map Y position to align-items (vertical)
  const yValue = textY && textY.value ? textY.value : '(h-text_h)/2';
  if (yValue === '30') {
    // Top
    textOverlay.style.alignItems = 'flex-start';
  } else if (yValue === '(h-text_h-30)') {
    // Bottom
    textOverlay.style.alignItems = 'flex-end';
  } else {
    // Center
    textOverlay.style.alignItems = 'center';
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

// Text mode: Set start time from current video position
function setTextStartFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const startInput = document.getElementById('text-start');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  startInput.value = currentTime.toFixed(2);

  // Update overlay if end time is also set
  const endInput = document.getElementById('text-end');
  if (endInput && endInput.value) {
    const endTime = parseFloat(endInput.value);
    updateTextRangeOverlay(currentTime, endTime, video.duration);
  }

  updateStatus(`시작 시간 설정: ${formatTime(currentTime)}`);
}

// Text mode: Set end time from current video position
function setTextEndFromCurrentTime() {
  const video = document.getElementById('preview-video');
  const endInput = document.getElementById('text-end');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const currentTime = video.currentTime;
  endInput.value = currentTime.toFixed(2);

  // Update overlay if start time is also set
  const startInput = document.getElementById('text-start');
  if (startInput && startInput.value) {
    const startTime = parseFloat(startInput.value);
    updateTextRangeOverlay(startTime, currentTime, video.duration);
  }

  updateStatus(`끝 시간 설정: ${formatTime(currentTime)}`);
}

// Text mode: Preview start time
function previewTextStartTime() {
  const startInput = document.getElementById('text-start');
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

// Text mode: Preview end time
function previewTextEndTime() {
  const endInput = document.getElementById('text-end');
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
// setAudioStartFromCurrentTime function consolidated below (around line 3815)
// This duplicate function has been removed to prevent override issues

// Preview audio start time
// previewAudioStartTime function consolidated below (around line 3851)
// This duplicate function has been removed to prevent override issues

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

// Text mode: Preview text time range
function previewTextRange() {
  const startInput = document.getElementById('text-start');
  const endInput = document.getElementById('text-end');
  const video = document.getElementById('preview-video');
  const currentTimeDisplay = document.getElementById('current-time');
  const slider = document.getElementById('timeline-slider');

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const startTime = startInput && startInput.value ? parseFloat(startInput.value) : 0;
  const endTime = endInput && endInput.value ? parseFloat(endInput.value) : video.duration;

  if (endTime <= startTime) {
    alert('끝시간은 시작 시간보다 커야 합니다.');
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

  updateStatus(`텍스트 구간 재생 중: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);
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

  showProgress();
  updateProgress(0, '영상 자르는 중...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.trimVideo({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      startTime,
      duration
    });

    hideProgress();
    alert('영상 자르기 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
  } catch (error) {
    hideProgress();
    handleError('영상 자르기', error, '영상 자르기에 실패했습니다.');
  }
}

// Execute delete range (keep beginning and end, remove middle)
async function executeDeleteRange() {
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

  const deleteLength = endTime - startTime;
  const firstPartLength = startTime;
  const secondPartLength = maxDuration - endTime;

  // Check if there's anything to keep
  if (firstPartLength < 0.1 && secondPartLength < 0.1) {
    alert('삭제 후 남는 구간이 너무 짧습니다. 최소 0.1초 이상이어야 합니다.');
    return;
  }

  const confirmMsg = `선택 구간 삭제:\n\n` +
    `• 삭제 구간: ${formatTime(startTime)} ~ ${formatTime(endTime)} (${deleteLength.toFixed(2)}초)\n` +
    `• 유지 구간: 0~${formatTime(startTime)} + ${formatTime(endTime)}~${formatTime(maxDuration)}\n` +
    `• 최종 길이: ${(firstPartLength + secondPartLength).toFixed(2)}초\n\n` +
    `계속하시겠습니까?`;

  if (!confirm(confirmMsg)) {
    return;
  }

  showProgress();
  updateProgress(0, '선택 구간 삭제 중...');

  const previousVideo = currentVideo;

  try {
    // Step 1: Trim first part (0 ~ startTime)
    if (firstPartLength >= 0.1) {
      updateProgress(20, '앞부분 자르는 중...');
      var firstPart = await window.electronAPI.trimVideo({
        inputPath: currentVideo,
        outputPath: null,
        startTime: 0,
        duration: startTime
      });
    }

    // Step 2: Trim second part (endTime ~ maxDuration)
    if (secondPartLength >= 0.1) {
      updateProgress(40, '뒷부분 자르는 중...');
      var secondPart = await window.electronAPI.trimVideo({
        inputPath: currentVideo,
        outputPath: null,
        startTime: endTime,
        duration: secondPartLength
      });
    }

    // Step 3: Merge if both parts exist
    let finalResult;
    if (firstPartLength >= 0.1 && secondPartLength >= 0.1) {
      updateProgress(60, '앞뒤 병합 중...');
      finalResult = await window.electronAPI.mergeVideos({
        videoPaths: [firstPart.outputPath, secondPart.outputPath],
        transition: 'concat',
        outputPath: null
      });

      // Clean up intermediate files
      await window.electronAPI.deleteTempFile(firstPart.outputPath);
      await window.electronAPI.deleteTempFile(secondPart.outputPath);
    } else if (firstPartLength >= 0.1) {
      finalResult = firstPart;
    } else {
      finalResult = secondPart;
    }

    updateProgress(90, '결과 로딩 중...');

    hideProgress();
    alert('선택 구간 삭제 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');

    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(finalResult.outputPath);
    currentVideo = finalResult.outputPath;
    hasSilentAudio = false;

    // Delete previous temp file
    if (previousVideo && previousVideo !== finalResult.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
  } catch (error) {
    hideProgress();
    handleError('선택 구간 삭제', error, '선택 구간 삭제에 실패했습니다.');
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

  showProgress();
  updateProgress(0, '영상만 자르는 중 (선택 구간 삭제)...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.trimVideoOnly({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      startTime,
      duration
    });

    hideProgress();
    alert('영상만 자르기 완료!\n• 영상: 선택 구간 삭제됨\n• 오디오: 뒤에서 자름\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
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

  // Check which tool is active to get the correct input element
  let startInput;
  if (currentMode === 'audio') {
    // Audio edit mode (trim-audio tool)
    startInput = document.getElementById('trim-audio-start');
  } else {
    // Video mode (add-audio tool)
    startInput = document.getElementById('audio-start-time');
  }

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (!startInput) {
    console.error('Start time input not found');
    return;
  }

  const currentTime = video.currentTime;
  startInput.value = currentTime.toFixed(2);

  // Call appropriate update functions based on mode
  if (currentMode === 'audio') {
    updateTrimAudioEndMax();
    updateTrimAudioDurationDisplay();
  } else {
    updateAudioRangeOverlay();
  }

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

  // Check which tool is active to get the correct input element
  let startInput;
  if (currentMode === 'audio') {
    // Audio edit mode (trim-audio tool)
    startInput = document.getElementById('trim-audio-start');
  } else {
    // Video mode (add-audio tool)
    startInput = document.getElementById('audio-start-time');
  }

  if (!video || !video.src) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  if (!startInput) {
    console.error('Start time input not found');
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

  showProgress();
  updateProgress(0, '오디오만 자르는 중 (선택 구간 삭제)...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.trimAudioOnly({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      startTime,
      endTime
    });

    hideProgress();
    alert('오디오만 자르기 완료!\n• 영상: 원본 유지\n• 오디오: 선택 구간 삭제, 뒤 오디오 앞으로 이동, 끝 무음 처리\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    await loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
  } catch (error) {
    hideProgress();
    handleError('오디오만 자르기', error, '오디오만 자르기에 실패했습니다.');
  }
}

// Merge videos
let mergeVideos = [];
let mergeAudios = [];
let mergePreviewIndex = 0;
let isMergePreviewPlaying = false;

async function addVideoToMerge() {
  // Check authentication
  if (!authToken || !currentUser) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      const videoPath = await window.electronAPI.selectVideo();
      if (!videoPath) return;
      mergeVideos.push(videoPath);
      updateMergeFileList();
    } else {
      // Show login modal
      showLoginModal();
    }
    return;
  }

  // Show video list from S3 for merge
  await showVideoListForMerge();
}

function updateMergeFileList() {
  const list = document.getElementById('merge-files');
  if (!list) return;

  list.innerHTML = mergeVideos.map((path, index) => `
    <div class="file-item" style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px; padding: 5px; background: #2d2d2d; border-radius: 3px;">
      <span style="color: #888; min-width: 20px;">${index + 1}.</span>
      <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${path.split('\\').pop()}</span>
      <button onclick="moveMergeVideoUp(${index})" ${index === 0 ? 'disabled' : ''} style="padding: 2px 8px; font-size: 12px;" title="위로">↑</button>
      <button onclick="moveMergeVideoDown(${index})" ${index === mergeVideos.length - 1 ? 'disabled' : ''} style="padding: 2px 8px; font-size: 12px;" title="아래로">↓</button>
      <button onclick="removeMergeVideo(${index})" style="padding: 2px 8px; font-size: 12px;">제거</button>
    </div>
  `).join('');
}

function moveMergeVideoUp(index) {
  if (index === 0) return;
  [mergeVideos[index], mergeVideos[index - 1]] = [mergeVideos[index - 1], mergeVideos[index]];
  updateMergeFileList();
}

function moveMergeVideoDown(index) {
  if (index === mergeVideos.length - 1) return;
  [mergeVideos[index], mergeVideos[index + 1]] = [mergeVideos[index + 1], mergeVideos[index]];
  updateMergeFileList();
}

function removeMergeVideo(index) {
  mergeVideos.splice(index, 1);
  updateMergeFileList();
}

// Update transition description based on selection
function updateTransitionDescription() {
  const transitionSelect = document.getElementById('merge-transition');
  const descriptionElement = document.getElementById('transition-description');
  if (!transitionSelect || !descriptionElement) return;

  const descriptions = {
    'concat': '트랜지션 없이 영상을 이어붙입니다.',
    'fade': '첫 번째 영상이 페이드 아웃되고 두 번째 영상이 페이드 인됩니다.',
    'xfade-fade': '두 영상이 서로 교차하며 페이드됩니다.',
    'xfade-wipeleft': '두 번째 영상이 왼쪽에서 오른쪽으로 닦아내듯 나타납니다.',
    'xfade-wiperight': '두 번째 영상이 오른쪽에서 왼쪽으로 닦아내듯 나타납니다.',
    'xfade-wipeup': '두 번째 영상이 아래에서 위로 닦아내듯 나타납니다.',
    'xfade-wipedown': '두 번째 영상이 위에서 아래로 닦아내듯 나타납니다.',
    'xfade-slideleft': '첫 번째 영상이 왼쪽으로 슬라이드되며 두 번째 영상이 나타납니다.',
    'xfade-slideright': '첫 번째 영상이 오른쪽으로 슬라이드되며 두 번째 영상이 나타납니다.',
    'xfade-slideup': '첫 번째 영상이 위로 슬라이드되며 두 번째 영상이 나타납니다.',
    'xfade-slidedown': '첫 번째 영상이 아래로 슬라이드되며 두 번째 영상이 나타납니다.'
  };

  descriptionElement.textContent = descriptions[transitionSelect.value] || '';
}

// Update transition duration visibility
function updateTransitionDurationVisibility() {
  const transitionSelect = document.getElementById('merge-transition');
  const durationGroup = document.getElementById('duration-group');
  if (!transitionSelect || !durationGroup) return;

  // Hide duration for concat (no transition)
  if (transitionSelect.value === 'concat') {
    durationGroup.style.display = 'none';
  } else {
    durationGroup.style.display = 'block';
  }

  // Update description
  updateTransitionDescription();
}

// Preview merge videos
async function previewMerge() {
  if (mergeVideos.length < 1) {
    alert('미리보기할 영상이 없습니다.');
    return;
  }

  // Start preview from first video
  mergePreviewIndex = 0;
  isMergePreviewPlaying = true;

  await playNextMergeVideo();
}

// Play next video in merge list
async function playNextMergeVideo() {
  if (!isMergePreviewPlaying || mergePreviewIndex >= mergeVideos.length) {
    stopMergePreview();
    return;
  }

  const videoPath = mergeVideos[mergePreviewIndex];
  const video = document.getElementById('preview-video');

  if (!video) return;

  // Load and play the video
  video.src = `file://${videoPath}`;

  // Update status
  updateStatus(`미리보기: ${mergePreviewIndex + 1}/${mergeVideos.length} - ${videoPath.split('\\').pop()}`);

  // Remove previous ended listener
  video.onended = null;

  // When this video ends, play the next one
  video.onended = () => {
    if (isMergePreviewPlaying) {
      mergePreviewIndex++;
      playNextMergeVideo();
    }
  };

  // Start playing
  try {
    await video.play();
  } catch (error) {
    console.error('Failed to play video:', error);
    updateStatus('미리보기 재생 실패');
    stopMergePreview();
  }
}

// Stop merge preview
function stopMergePreview() {
  isMergePreviewPlaying = false;
  mergePreviewIndex = 0;

  const video = document.getElementById('preview-video');
  if (video) {
    video.pause();
    video.onended = null;
  }

  updateStatus('미리보기 중지됨');
}

async function executeMerge() {
  if (mergeVideos.length < 2) {
    alert('최소 2개 이상의 영상이 필요합니다.');
    return;
  }

  const transition = document.getElementById('merge-transition').value;
  const transitionDuration = parseFloat(document.getElementById('merge-duration').value);

  showProgress();
  updateProgress(0, '영상 병합 중...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.mergeVideos({
      videoPaths: mergeVideos,
      outputPath: null, // null means create temp file
      transition,
      transitionDuration
    });

    hideProgress();
    alert('영상 병합 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Reset silent audio flag after merge

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }

    mergeVideos = [];
  } catch (error) {
    hideProgress();
    handleError('영상 병합', error, '영상 병합에 실패했습니다.');
  }
}

// Audio merge functions
async function addAudioToMerge() {
  // Check authentication
  if (!authToken || !currentUser) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      const audioPath = await window.electronAPI.selectAudio();
      if (!audioPath) return;
      mergeAudios.push({ type: 'file', path: audioPath });
      updateMergeAudioFileList();
    } else {
      // Show login modal
      showLoginModal();
    }
    return;
  }

  // Show audio list from S3 for merge
  await showAudioListForMerge();
}

function addSilenceToMerge() {
  showSilenceInputModal();
}

function showSilenceInputModal() {
  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div style="background: #2d2d2d; padding: 30px; border-radius: 10px; min-width: 400px;">
      <h2 style="margin: 0 0 20px 0; color: #e0e0e0;">무음 추가</h2>
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 10px; color: #e0e0e0;">무음 길이 (초)</label>
        <input type="number" id="silence-duration-input" min="0.1" max="300" step="0.1" value="1.0"
               style="width: 100%; padding: 12px; background: #1a1a1a; border: 1px solid #444; border-radius: 5px; color: #e0e0e0; font-size: 16px;">
        <small style="color: #888; display: block; margin-top: 5px;">0.1초 ~ 300초</small>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button onclick="createSilenceFile()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: 600;">추가</button>
        <button onclick="closeSilenceInputModal()" style="flex: 1; padding: 12px; background: #444; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">취소</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeSilenceInputModal();
    }
  };

  // Focus input and select all
  setTimeout(() => {
    const input = document.getElementById('silence-duration-input');
    if (input) {
      input.focus();
      input.select();

      // Allow Enter key to submit
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          createSilenceFile();
        }
      });
    }
  }, 100);

  // Allow Escape key to close
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeSilenceInputModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function closeSilenceInputModal() {
  const modal = document.getElementById('modal-overlay');
  modal.style.display = 'none';
  modal.onclick = null; // Remove click handler
}

async function createSilenceFile() {
  const input = document.getElementById('silence-duration-input');
  const duration = input ? input.value : '1.0';

  const durationNum = parseFloat(duration);
  if (isNaN(durationNum) || durationNum <= 0) {
    alert('유효한 숫자를 입력해주세요 (0보다 큰 값)');
    return;
  }

  if (durationNum > 300) {
    alert('무음 길이는 최대 300초까지 가능합니다.');
    return;
  }

  // Close modal
  closeSilenceInputModal();

  showProgress();
  updateProgress(0, `무음 파일 생성 중... (${durationNum}초)`);

  try {
    // Generate temporary silence file
    const result = await window.electronAPI.generateSilenceFile({
      duration: durationNum
    });

    hideProgress();

    if (result && result.outputPath) {
      mergeAudios.push({
        type: 'silence',
        path: result.outputPath,
        duration: durationNum
      });
      updateMergeAudioFileList();
      updateStatus(`무음 파일 추가됨: ${durationNum}초`);
    }
  } catch (error) {
    hideProgress();
    handleError('무음 파일 생성', error, '무음 파일 생성에 실패했습니다.');
  }
}

function updateMergeAudioFileList() {
  const list = document.getElementById('merge-audio-files');
  list.innerHTML = mergeAudios.map((item, index) => {
    let displayName;
    if (typeof item === 'string') {
      // Legacy format support
      displayName = item.split('\\').pop();
    } else if (item.type === 'silence') {
      displayName = `🔇 무음 (${item.duration}초)`;
    } else {
      displayName = item.path.split('\\').pop();
    }

    return `
      <div class="file-item">
        <span>${displayName}</span>
        <button onclick="removeMergeAudio(${index})">제거</button>
      </div>
    `;
  }).join('');
}

function removeMergeAudio(index) {
  mergeAudios.splice(index, 1);
  updateMergeAudioFileList();
}

async function executeMergeAudio() {
  if (mergeAudios.length < 2) {
    alert('최소 2개 이상의 오디오가 필요합니다.');
    return;
  }

  showProgress();
  updateProgress(0, '오디오 병합 중...');

  // Save previous audio file path for cleanup
  const previousAudioFile = currentAudioFile;

  try {
    // Convert to array of paths (support both old string format and new object format)
    const audioPaths = mergeAudios.map(item => {
      if (typeof item === 'string') {
        return item; // Legacy format
      } else {
        return item.path; // New format (both file and silence have path)
      }
    });

    const result = await window.electronAPI.mergeAudios({
      audioPaths: audioPaths,
      outputPath: null // null means create temp file
    });

    hideProgress();
    alert('오디오 병합 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "음성 내보내기"를 사용하세요.');
    await loadAudioFile(result.outputPath);

    // Delete previous temp file if it exists
    if (previousAudioFile && previousAudioFile !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousAudioFile);
    }

    mergeAudios = [];
  } catch (error) {
    hideProgress();
    handleError('오디오 병합', error, '오디오 병합에 실패했습니다.');
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
  // Check authentication
  if (!authToken || !currentUser) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      selectedAudioFile = await window.electronAPI.selectAudio();
      if (selectedAudioFile) {
        document.getElementById('selected-audio').textContent = selectedAudioFile.split('\\').pop();
        // Get audio duration
        getAudioDuration(selectedAudioFile);
      }
    } else {
      // Show login modal
      showLoginModal();
    }
    return;
  }

  // Show audio list from S3 for insertion
  await showAudioListForInsertion();
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

  showProgress();
  updateProgress(0, isSilence ? '무음 추가 중...' : '오디오 추가 중...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.addAudio({
      videoPath: currentVideo,
      audioPath: selectedAudioFile,
      outputPath: null, // null means create temp file
      volumeLevel,
      audioStartTime,
      isSilence,
      silenceDuration: audioDuration,
      insertMode
    });

    hideProgress();
    const message = isSilence ? '무음 추가 완료!' : '오디오 추가 완료!';
    alert(`${message}\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.`);
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
  } catch (error) {
    hideProgress();
    handleError('오디오 추가', error, '오디오 추가에 실패했습니다.');
  }
}

// Extract audio to local file
async function executeExtractAudioLocal() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  // Check if video has audio stream
  try {
    const videoInfo = await window.electronAPI.getVideoInfo(currentVideo);
    const hasAudio = videoInfo.streams && videoInfo.streams.some(stream => stream.codec_type === 'audio');

    if (!hasAudio) {
      alert('이 영상 파일에는 오디오가 포함되어 있지 않습니다.\n\n오디오 추출을 할 수 없습니다.');
      return;
    }
  } catch (error) {
    console.error('[Extract Audio Local] Failed to check video info:', error);
    alert('영상 정보를 확인할 수 없습니다.');
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

// Extract audio and upload to S3
async function executeExtractAudioToS3() {
  console.log('[Extract Audio S3] Function called');

  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  // Check if video has audio stream
  try {
    const videoInfo = await window.electronAPI.getVideoInfo(currentVideo);
    const hasAudio = videoInfo.streams && videoInfo.streams.some(stream => stream.codec_type === 'audio');

    if (!hasAudio) {
      alert('이 영상 파일에는 오디오가 포함되어 있지 않습니다.\n\n오디오 추출을 할 수 없습니다.');
      return;
    }
  } catch (error) {
    console.error('[Extract Audio S3] Failed to check video info:', error);
    alert('영상 정보를 확인할 수 없습니다.');
    return;
  }

  // Check if user is logged in
  if (!authToken || !currentUser) {
    alert('S3에 업로드하려면 로그인이 필요합니다.');
    return;
  }

  // Get title and description from input fields
  const titleInput = document.getElementById('extract-audio-title');
  const descriptionInput = document.getElementById('extract-audio-description');

  const title = titleInput ? titleInput.value.trim() : '';
  const description = descriptionInput ? descriptionInput.value.trim() : '';

  if (!title) {
    alert('제목을 입력해주세요.');
    if (titleInput) titleInput.focus();
    return;
  }

  showProgress();
  updateProgress(0, '제목 중복 확인 중...');

  try {
    // Check for duplicate title
    console.log('[Extract Audio S3] Checking for duplicate title:', title);
    const checkResponse = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`제목 확인 실패: ${checkResponse.status}`);
    }

    const allVideos = await checkResponse.json();
    const audioFiles = allVideos.filter(v => v.contentType && v.contentType.startsWith('audio/'));
    const duplicateTitle = audioFiles.find(audio => audio.title === title);

    if (duplicateTitle) {
      hideProgress();
      alert(`같은 제목의 음성 파일이 이미 존재합니다.\n\n제목: ${title}\n\n다른 제목을 사용해주세요.`);
      if (titleInput) titleInput.focus();
      return;
    }

    // First, extract audio to a temporary file
    updateProgress(30, '영상에서 오디오 추출 중...');

    console.log('[Extract Audio S3] Extracting audio to temp file');

    const extractResult = await window.electronAPI.extractAudio({
      videoPath: currentVideo,
      outputPath: null  // null means create temp file
    });

    console.log('[Extract Audio S3] Extraction complete:', extractResult.outputPath);

    // Upload extracted audio to S3
    updateProgress(60, 'S3에 음성 파일 업로드 중...');

    // Read file and create FormData
    const fileUrl = `file:///${extractResult.outputPath.replace(/\\/g, '/')}`;
    const fileResponse = await fetch(fileUrl);
    const audioBlob = await fileResponse.blob();
    const fileName = `${title}.mp3`;

    console.log('[Extract Audio S3] Uploading to S3:', { title, description, fileName, size: audioBlob.size });

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, fileName);
    formData.append('title', title);
    formData.append('description', description);

    // Upload to backend (audios/uploads folder)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/audios/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('[Extract Audio S3] Upload successful:', result);

    // Clean up temp file
    try {
      await window.electronAPI.deleteTempFile(extractResult.outputPath);
    } catch (cleanupError) {
      console.warn('[Extract Audio S3] Failed to delete temp file:', cleanupError);
    }

    updateProgress(100, '오디오 추출 및 업로드 완료!');
    hideProgress();

    alert(`S3 업로드 완료!\n\n제목: ${title}\n파일명: ${fileName}\n\n클라우드 (audios/uploads/)에 성공적으로 저장되었습니다.`);
    updateStatus(`S3 업로드 완료: ${title}`);

    // Clear input fields after successful upload
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
  } catch (error) {
    hideProgress();
    console.error('[Extract Audio S3] Error:', error);
    handleError('오디오 추출 및 S3 업로드', error, 'S3 업로드에 실패했습니다.');
  }
}

// Volume adjust
function updateVolumeAdjustDisplay() {
  const value = document.getElementById('volume-adjust').value;
  document.getElementById('volume-adjust-value').textContent = value;
}

// Preview video volume
function previewVideoVolume() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('volume-adjust').value);
  const previewBtn = document.getElementById('preview-video-volume-btn');
  const video = document.getElementById('preview-video');

  if (!video) {
    alert('영상을 먼저 로드해주세요.');
    return;
  }

  // Toggle play/pause
  if (!video.paused) {
    video.pause();
    previewBtn.textContent = '🎧 미리듣기';
    previewBtn.classList.remove('active');
    // Reset volume to original
    video.volume = 1.0;
    return;
  }

  // Set volume (capped at 1.0 for preview to prevent distortion)
  video.volume = Math.min(1.0, volumeLevel);

  // If at the end (within 1 second), start from beginning
  if (videoInfo && videoInfo.format && videoInfo.format.duration) {
    const duration = parseFloat(videoInfo.format.duration);
    if (duration - video.currentTime < 1.0) {
      video.currentTime = 0;
    }
  }

  // Update button state
  previewBtn.textContent = '⏸️ 정지';
  previewBtn.classList.add('active');

  // Play video
  video.play().catch(error => {
    console.error('Video playback error:', error);
    alert('영상 재생에 실패했습니다.');
    previewBtn.textContent = '🎧 미리듣기';
    previewBtn.classList.remove('active');
  });

  // Reset button when playback ends
  const handleEnded = () => {
    previewBtn.textContent = '🎧 미리듣기';
    previewBtn.classList.remove('active');
    video.volume = 1.0;
    video.removeEventListener('ended', handleEnded);
  };
  video.addEventListener('ended', handleEnded);

  updateStatus(`볼륨 미리듣기: ${volumeLevel}x`);
}

async function executeVolumeAdjust() {
  // Stop preview if playing
  const video = document.getElementById('preview-video');
  const previewBtn = document.getElementById('preview-video-volume-btn');
  if (video && !video.paused) {
    video.pause();
    video.volume = 1.0;
    if (previewBtn) {
      previewBtn.textContent = '🎧 미리듣기';
      previewBtn.classList.remove('active');
    }
  }

  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('volume-adjust').value);

  showProgress();
  updateProgress(0, '볼륨 조절 중...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      filterName: 'volume',
      filterParams: { volume: volumeLevel }
    });

    hideProgress();
    alert('볼륨 조절 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
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

  showProgress();
  updateProgress(0, `${filterType} 필터 적용 중...`);

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      filterName: filterType,
      filterParams
    });

    hideProgress();
    alert('필터 적용 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
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
  const fontFamily = document.getElementById('text-font').value || 'Malgun Gothic';
  const fontStyle = document.getElementById('text-style').value || 'regular';
  const x = document.getElementById('text-x').value || '(w-text_w)/2';
  const y = document.getElementById('text-y').value || '(h-text_h)/2';
  const startTime = document.getElementById('text-start').value ? parseFloat(document.getElementById('text-start').value) : undefined;
  const endTime = document.getElementById('text-end').value ? parseFloat(document.getElementById('text-end').value) : undefined;

  // Calculate duration from start and end time
  let duration = undefined;
  if (endTime !== undefined) {
    if (startTime !== undefined) {
      duration = endTime - startTime;
      if (duration <= 0) {
        alert('끝시간은 시작 시간보다 커야 합니다.');
        return;
      }
    } else {
      // If no start time, assume start from 0
      duration = endTime;
    }
  }

  showProgress();
  updateProgress(0, '텍스트 추가 중...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.addText({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      text,
      fontSize,
      fontColor,
      fontFamily,
      fontStyle,
      position: { x, y },
      startTime,
      duration
    });

    hideProgress();
    alert('텍스트 추가 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
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

// Preview speed change
function previewSpeed() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const video = document.getElementById('preview-video');
  const speedFactor = parseFloat(document.getElementById('speed-factor').value);

  if (video) {
    video.playbackRate = speedFactor;
    // Start playing from current position
    if (video.paused) {
      video.play();
    }
    updateStatus(`미리보기 재생 중 (${speedFactor}x 속도)`);
  }
}

// Stop speed preview and reset to normal
function stopSpeedPreview() {
  const video = document.getElementById('preview-video');

  if (video) {
    video.playbackRate = 1.0;
    video.pause();
    updateStatus('미리보기 중지됨 (속도 1.0x로 복원)');
  }
}

async function executeSpeed() {
  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  const speed = parseFloat(document.getElementById('speed-factor').value);

  showProgress();
  updateProgress(0, '속도 조절 중...');

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      filterName: 'speed',
      filterParams: { speed }
    });

    hideProgress();
    alert('속도 조절 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');
    loadVideo(result.outputPath);
    currentVideo = result.outputPath;
    hasSilentAudio = false;  // Video has been edited, no longer original silent track

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousVideo);
    }
  } catch (error) {
    hideProgress();
    handleError('속도 조절', error, '속도 조절에 실패했습니다.');
  }
}

// Audio Speed adjust
function updateAudioSpeedDisplay() {
  const value = document.getElementById('audio-speed-factor').value;
  document.getElementById('audio-speed-value').textContent = `${value}x`;
}

// Preview audio speed change
function previewAudioSpeed() {
  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const audioElement = document.getElementById('preview-audio');
  const speedFactor = parseFloat(document.getElementById('audio-speed-factor').value);

  if (audioElement) {
    audioElement.playbackRate = speedFactor;
    // Start playing from current position
    if (audioElement.paused) {
      audioElement.play();
    }
    updateStatus(`미리보기 재생 중 (${speedFactor}x 속도)`);
  }
}

// Stop audio speed preview and reset to normal
function stopAudioSpeedPreview() {
  const audioElement = document.getElementById('preview-audio');

  if (audioElement) {
    audioElement.playbackRate = 1.0;
    audioElement.pause();
    updateStatus('미리보기 중지됨 (속도 1.0x로 복원)');
  }
}

async function executeAudioSpeed() {
  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const speed = parseFloat(document.getElementById('audio-speed-factor').value);

  showProgress();
  updateProgress(0, '오디오 속도 조절 중...');

  // Save previous audio file path for cleanup
  const previousAudio = currentAudioFile;

  try {
    const result = await window.electronAPI.adjustAudioSpeed({
      inputPath: currentAudioFile,
      outputPath: null, // null means create temp file
      speed
    });

    hideProgress();
    alert('오디오 속도 조절 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.');

    // Reload audio with new file
    await loadAudioFile(result.outputPath);
    currentAudioFile = result.outputPath;

    // Delete previous temp file if it exists
    if (previousAudio && previousAudio !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousAudio);
    }
  } catch (error) {
    hideProgress();
    handleError('오디오 속도 조절', error, '오디오 속도 조절에 실패했습니다.');
  }
}

// Export dialog
function showExportDialog() {
  alert('현재 편집된 영상은 이미 저장되어 있습니다.\n각 편집 작업 시 저장 위치를 선택하셨습니다.');
}

// Progress management
function setupFFmpegProgressListener() {
  window.electronAPI.onFFmpegProgress((message) => {
    // Parse FFmpeg output for progress updates
    // This is simplified - real implementation would parse time codes
  });
}

// Log management - Removed (console log UI was removed)

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
  // Check authentication
  if (!authToken || !currentUser) {
    const useLocal = confirm('로그인이 필요합니다.\n\n로컬 파일을 선택하시겠습니까?\n(취소를 누르면 로그인 화면으로 이동합니다)');
    if (useLocal) {
      const audioPath = await window.electronAPI.selectAudio();
      if (!audioPath) return;
      await loadAudioFile(audioPath);
    } else {
      // Show login modal
      showLoginModal();
    }
    return;
  }

  // Show audio list from S3
  await showAudioListFromS3();
}

// Show audio list modal from S3
async function showAudioListFromS3() {
  try {
    showProgress();
    updateProgress(30, 'S3에서 음성 목록 불러오는 중...');
    updateStatus('음성 목록 로드 중...');

    // Fetch audio list from backend
    const response = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio list: ${response.status}`);
    }

    const videos = await response.json();

    // Filter only audio files (check contentType starts with 'audio/')
    const audioFiles = videos.filter(v => v.contentType && v.contentType.startsWith('audio/'));

    console.log('[Audio Import] Found audio files:', audioFiles.length);

    updateProgress(100, '음성 목록 로드 완료');
    hideProgress();

    if (audioFiles.length === 0) {
      const useLocal = confirm('S3에 저장된 음성 파일이 없습니다.\n\n로컬 파일을 선택하시겠습니까?');
      if (useLocal) {
        const audioPath = await window.electronAPI.selectAudio();
        if (!audioPath) return;
        await loadAudioFile(audioPath);
      }
      return;
    }

    // Show modal with audio list
    showAudioSelectionModal(audioFiles);

  } catch (error) {
    console.error('[Audio Import] Failed to fetch audio list:', error);
    hideProgress();

    const useLocal = confirm('S3 음성 목록을 불러오는데 실패했습니다.\n\n로컬 파일을 선택하시겠습니까?');
    if (useLocal) {
      const audioPath = await window.electronAPI.selectAudio();
      if (!audioPath) return;
      await loadAudioFile(audioPath);
    }
  }
}

// Show modal with audio selection
function showAudioSelectionModal(audioFiles) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');

  if (!modalOverlay || !modalContent) {
    console.error('[Audio Import] Modal elements not found');
    return;
  }

  // Sort by upload date (newest first)
  audioFiles.sort((a, b) => {
    const dateA = new Date(a.uploadedAt || a.createdAt || 0);
    const dateB = new Date(b.uploadedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  // Reset to first page
  audioListCurrentPage = 1;

  // Render the audio list
  renderAudioList(audioFiles, modalContent);

  modalOverlay.style.display = 'flex';
}

// Render audio list with pagination
function renderAudioList(audioFiles, modalContent) {
  const totalPages = Math.ceil(audioFiles.length / audioListItemsPerPage);
  const startIndex = (audioListCurrentPage - 1) * audioListItemsPerPage;
  const endIndex = Math.min(startIndex + audioListItemsPerPage, audioFiles.length);
  const currentPageItems = audioFiles.slice(startIndex, endIndex);

  // Create modal HTML with table layout
  modalContent.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1400px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">📁 S3 음성 파일 선택</h2>
        <button onclick="closeAudioSelectionModal()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="color: #aaa; font-size: 13px;">
          총 ${audioFiles.length}개의 음성 파일 (${audioListCurrentPage}/${totalPages} 페이지)
        </div>
      </div>

      <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
            <tr style="border-bottom: 2px solid #555;">
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 45%;">설명</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
              <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">삭제</th>
            </tr>
          </thead>
          <tbody>
            ${currentPageItems.map((audio, index) => {
              const sizeInMB = audio.fileSize ? (audio.fileSize / (1024 * 1024)).toFixed(2) : '?';
              let uploadDate = '날짜 없음';
              const dateField = audio.uploadedAt || audio.createdAt;
              if (dateField) {
                const date = new Date(dateField);
                if (!isNaN(date.getTime())) {
                  uploadDate = date.toLocaleDateString('ko-KR');
                }
              }
              const folder = audio.s3Key ? (audio.s3Key.includes('audios/tts/') ? 'TTS' : audio.s3Key.includes('audios/uploads/') ? '업로드' : '기타') : '?';
              const rowBg = index % 2 === 0 ? '#2d2d2d' : '#333';

              return `
                <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s;"
                    onmouseover="this.style.background='#3a3a5a'"
                    onmouseout="this.style.background='${rowBg}'">
                  <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;"
                      onclick="selectAudioFromS3(${audio.id}, '${audio.title.replace(/'/g, "\\'")}', '${(audio.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    <div style="font-weight: 600;">🎵 ${audio.title || audio.filename}</div>
                  </td>
                  <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;"
                      onclick="selectAudioFromS3(${audio.id}, '${audio.title.replace(/'/g, "\\'")}', '${(audio.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    ${audio.description || '설명 없음'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; cursor: pointer;"
                      onclick="selectAudioFromS3(${audio.id}, '${audio.title.replace(/'/g, "\\'")}', '${(audio.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; white-space: nowrap;">
                      ${folder}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;"
                      onclick="selectAudioFromS3(${audio.id}, '${audio.title.replace(/'/g, "\\'")}', '${(audio.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    ${sizeInMB} MB
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;"
                      onclick="selectAudioFromS3(${audio.id}, '${audio.title.replace(/'/g, "\\'")}', '${(audio.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    ${uploadDate}
                  </td>
                  <td style="padding: 12px 8px; text-align: center;">
                    <button onclick="event.stopPropagation(); deleteAudioFromS3(${audio.id}, '${audio.title.replace(/'/g, "\\'")}')"
                            style="background: #dc2626; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: background 0.2s;"
                            onmouseover="this.style.background='#b91c1c'"
                            onmouseout="this.style.background='#dc2626'">
                      🗑️ 삭제
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="goToAudioListPage(1)" ${audioListCurrentPage === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            처음
          </button>
          <button onclick="goToAudioListPage(${audioListCurrentPage - 1})" ${audioListCurrentPage === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            이전
          </button>
          <span style="color: #e0e0e0; font-size: 13px;">${audioListCurrentPage} / ${totalPages}</span>
          <button onclick="goToAudioListPage(${audioListCurrentPage + 1})" ${audioListCurrentPage === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            다음
          </button>
          <button onclick="goToAudioListPage(${totalPages})" ${audioListCurrentPage === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            마지막
          </button>
        </div>
        <button onclick="closeAudioSelectionModal()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
          취소
        </button>
      </div>
    </div>
  `;

  // Store audio files in window for pagination
  window.currentAudioFilesList = audioFiles;
}

// Navigate to a specific page
window.goToAudioListPage = function(page) {
  if (!window.currentAudioFilesList) return;

  const totalPages = Math.ceil(window.currentAudioFilesList.length / audioListItemsPerPage);
  if (page < 1 || page > totalPages) return;

  audioListCurrentPage = page;
  const modalContent = document.getElementById('modal-content');
  if (modalContent) {
    renderAudioList(window.currentAudioFilesList, modalContent);
  }
};

// Close audio selection modal
window.closeAudioSelectionModal = function() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
};

// Select local audio file
window.selectLocalAudioFile = async function() {
  closeAudioSelectionModal();
  const audioPath = await window.electronAPI.selectAudio();
  if (!audioPath) return;
  await loadAudioFile(audioPath);
};

// Select audio from S3
window.selectAudioFromS3 = async function(audioId, audioTitle, audioDescription = '') {
  try {
    closeAudioSelectionModal();
    showProgress();
    updateProgress(30, 'S3에서 음성 다운로드 중...');
    updateStatus(`음성 다운로드 중: ${audioTitle}`);

    console.log('[Audio Import] Downloading audio from S3:', audioId);

    // Save metadata for later use in export
    currentAudioMetadata = {
      title: audioTitle || '',
      description: audioDescription || ''
    };

    // Get download URL from backend
    const response = await fetch(`${backendBaseUrl}/api/videos/${audioId}/download-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.status}`);
    }

    const data = await response.json();
    const downloadUrl = data.url;

    console.log('[Audio Import] Got presigned URL:', downloadUrl);

    updateProgress(60, '음성 파일 다운로드 중...');

    // Download audio file using electron API
    const result = await window.electronAPI.downloadFile(downloadUrl, audioTitle);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    console.log('[Audio Import] Downloaded to:', result.filePath);

    updateProgress(90, '음성 파일 로드 중...');

    // Load the downloaded audio file
    await loadAudioFile(result.filePath);

    updateProgress(100, '음성 파일 로드 완료');
    hideProgress();

  } catch (error) {
    console.error('[Audio Import] Failed to download audio from S3:', error);
    hideProgress();
    alert('S3에서 음성 다운로드에 실패했습니다.\n\n' + error.message);
  }
};

// Show audio list from S3 for merge (병합용)
async function showAudioListForMerge() {
  try {
    showProgress();
    updateProgress(30, 'S3에서 음성 목록 불러오는 중...');
    updateStatus('음성 목록 로드 중...');

    // Fetch audio list from backend
    const response = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio list: ${response.status}`);
    }

    const videos = await response.json();

    // Filter only audio files (check contentType starts with 'audio/')
    const audioFiles = videos.filter(v => v.contentType && v.contentType.startsWith('audio/'));

    console.log('[Audio Merge] Found audio files:', audioFiles.length);

    updateProgress(100, '음성 목록 로드 완료');
    hideProgress();

    if (audioFiles.length === 0) {
      const useLocal = confirm('S3에 저장된 음성 파일이 없습니다.\n\n로컬 파일을 선택하시겠습니까?');
      if (useLocal) {
        const audioPath = await window.electronAPI.selectAudio();
        if (!audioPath) return;
        mergeAudios.push({ type: 'file', path: audioPath });
        updateMergeAudioFileList();
      }
      return;
    }

    // Show modal with audio list for merge
    showAudioSelectionModalForMerge(audioFiles);

  } catch (error) {
    console.error('[Audio Merge] Failed to fetch audio list:', error);
    hideProgress();

    const useLocal = confirm('S3 음성 목록을 불러오는데 실패했습니다.\n\n로컬 파일을 선택하시겠습니까?');
    if (useLocal) {
      const audioPath = await window.electronAPI.selectAudio();
      if (!audioPath) return;
      mergeAudios.push({ type: 'file', path: audioPath });
      updateMergeAudioFileList();
    }
  }
}

// Show audio selection modal for merge (병합용 - selectAudioFromS3ForMerge 호출)
function showAudioSelectionModalForMerge(audioFiles) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');

  if (!modalOverlay || !modalContent) {
    console.error('[Audio Merge] Modal elements not found');
    return;
  }

  // Sort by upload date (newest first)
  audioFiles.sort((a, b) => {
    const dateA = new Date(a.uploadedAt || a.createdAt || 0);
    const dateB = new Date(b.uploadedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  // Reset to first page
  audioListCurrentPage = 1;

  // Render the audio list for merge
  renderAudioListForMerge(audioFiles, modalContent);

  modalOverlay.style.display = 'flex';
}

// Render audio list with pagination for merge (병합용)
function renderAudioListForMerge(audioFiles, modalContent) {
  const totalPages = Math.ceil(audioFiles.length / audioListItemsPerPage);
  const startIndex = (audioListCurrentPage - 1) * audioListItemsPerPage;
  const endIndex = Math.min(startIndex + audioListItemsPerPage, audioFiles.length);
  const currentPageItems = audioFiles.slice(startIndex, endIndex);

  // Create modal HTML with table layout - 병합용이므로 selectAudioFromS3ForMerge 호출
  modalContent.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1400px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">📁 S3 음성 파일 선택 (병합에 추가)</h2>
        <button onclick="closeAudioSelectionModalForMerge()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="color: #aaa; font-size: 13px;">
          총 ${audioFiles.length}개의 음성 파일 (${audioListCurrentPage}/${totalPages} 페이지)
        </div>
      </div>

      <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
            <tr style="border-bottom: 2px solid #555;">
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 45%;">설명</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
              <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
            </tr>
          </thead>
          <tbody>
            ${currentPageItems.map((audio, index) => {
              const sizeInMB = audio.fileSize ? (audio.fileSize / (1024 * 1024)).toFixed(2) : '?';
              let uploadDate = '날짜 없음';
              const dateField = audio.uploadedAt || audio.createdAt;
              if (dateField) {
                const date = new Date(dateField);
                if (!isNaN(date.getTime())) {
                  uploadDate = date.toLocaleDateString('ko-KR');
                }
              }
              const folder = audio.s3Key ? (audio.s3Key.includes('audios/tts/') ? 'TTS' : audio.s3Key.includes('audios/uploads/') ? '업로드' : '기타') : '?';
              const rowBg = index % 2 === 0 ? '#2d2d2d' : '#333';

              return `
                <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s;"
                    onmouseover="this.style.background='#3a3a5a'"
                    onmouseout="this.style.background='${rowBg}'"
                    onclick="selectAudioFromS3ForMerge(${audio.id}, '${audio.title.replace(/'/g, "\\'")}')">
                  <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <div style="font-weight: 600;">🎵 ${audio.title || audio.filename}</div>
                  </td>
                  <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    ${audio.description || '설명 없음'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; cursor: pointer;">
                    <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; white-space: nowrap;">
                      ${folder}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;">
                    ${sizeInMB} MB
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;">
                    ${uploadDate}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="goToAudioListPageForMerge(1)" ${audioListCurrentPage === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            처음
          </button>
          <button onclick="goToAudioListPageForMerge(${audioListCurrentPage - 1})" ${audioListCurrentPage === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            이전
          </button>
          <span style="color: #e0e0e0; font-size: 13px;">${audioListCurrentPage} / ${totalPages}</span>
          <button onclick="goToAudioListPageForMerge(${audioListCurrentPage + 1})" ${audioListCurrentPage === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            다음
          </button>
          <button onclick="goToAudioListPageForMerge(${totalPages})" ${audioListCurrentPage === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPage === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            마지막
          </button>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="selectLocalAudioFileForMerge()" style="padding: 10px 20px; background: #764ba2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            💾 로컬 파일 선택
          </button>
          <button onclick="closeAudioSelectionModalForMerge()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            취소
          </button>
        </div>
      </div>
    </div>
  `;

  // Store audio files in window for pagination
  window.currentAudioFilesListForMerge = audioFiles;
}

// Navigate to a specific page for merge
window.goToAudioListPageForMerge = function(page) {
  if (!window.currentAudioFilesListForMerge) return;

  const totalPages = Math.ceil(window.currentAudioFilesListForMerge.length / audioListItemsPerPage);
  if (page < 1 || page > totalPages) return;

  audioListCurrentPage = page;
  const modalContent = document.getElementById('modal-content');
  if (modalContent) {
    renderAudioListForMerge(window.currentAudioFilesListForMerge, modalContent);
  }
};

// Close audio selection modal for merge
window.closeAudioSelectionModalForMerge = function() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
};

// Select local audio file for merge
window.selectLocalAudioFileForMerge = async function() {
  closeAudioSelectionModalForMerge();
  const audioPath = await window.electronAPI.selectAudio();
  if (!audioPath) return;
  mergeAudios.push({ type: 'file', path: audioPath });
  updateMergeAudioFileList();
};

// Select audio from S3 for merge (병합 리스트에 추가)
window.selectAudioFromS3ForMerge = async function(audioId, audioTitle) {
  try {
    closeAudioSelectionModalForMerge();
    showProgress();
    updateProgress(30, 'S3에서 음성 다운로드 중...');
    updateStatus(`음성 다운로드 중: ${audioTitle}`);

    console.log('[Audio Merge] Downloading audio from S3:', audioId);

    // Get download URL from backend
    const response = await fetch(`${backendBaseUrl}/api/videos/${audioId}/download-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.status}`);
    }

    const data = await response.json();
    const downloadUrl = data.url;

    console.log('[Audio Merge] Got presigned URL:', downloadUrl);

    updateProgress(60, '음성 파일 다운로드 중...');

    // Download audio file using electron API
    const result = await window.electronAPI.downloadFile(downloadUrl, audioTitle);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    console.log('[Audio Merge] Downloaded to:', result.filePath);

    updateProgress(90, '병합 목록에 추가 중...');

    // Add to merge list
    mergeAudios.push({ type: 'file', path: result.filePath });
    updateMergeAudioFileList();

    updateProgress(100, '음성 파일 추가 완료');
    hideProgress();
    updateStatus(`음성 파일 추가됨: ${audioTitle}`);

  } catch (error) {
    console.error('[Audio Merge] Failed to download audio from S3:', error);
    hideProgress();
    alert('S3에서 음성 다운로드에 실패했습니다.\n\n' + error.message);
  }
};

// Show video list from S3
async function showVideoListFromS3() {
  try {
    showProgress();
    updateProgress(30, 'S3에서 영상 목록 불러오는 중...');
    updateStatus('영상 목록 로드 중...');

    // Fetch video list from backend
    const response = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video list: ${response.status}`);
    }

    const videos = await response.json();

    // Filter only video files (check contentType starts with 'video/')
    const videoFiles = videos.filter(v => v.contentType && v.contentType.startsWith('video/'));

    console.log('[Video Import] Found video files:', videoFiles.length);

    updateProgress(100, '영상 목록 로드 완료');
    hideProgress();

    if (videoFiles.length === 0) {
      const useLocal = confirm('S3에 저장된 영상 파일이 없습니다.\n\n로컬 파일을 선택하시겠습니까?');
      if (useLocal) {
        const videoPath = await window.electronAPI.selectVideo();
        if (!videoPath) return;
        await loadVideoWithAudioCheck(videoPath);
      }
      return;
    }

    // Show modal with video list
    showVideoSelectionModal(videoFiles);

  } catch (error) {
    console.error('[Video Import] Failed to fetch video list:', error);
    hideProgress();

    const useLocal = confirm('S3 영상 목록을 불러오는데 실패했습니다.\n\n로컬 파일을 선택하시겠습니까?');
    if (useLocal) {
      const videoPath = await window.electronAPI.selectVideo();
      if (!videoPath) return;
      await loadVideoWithAudioCheck(videoPath);
    }
  }
}

// Show modal with video selection
function showVideoSelectionModal(videoFiles) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');

  if (!modalOverlay || !modalContent) {
    console.error('[Video Import] Modal elements not found');
    return;
  }

  // Sort by upload date (newest first)
  videoFiles.sort((a, b) => {
    const dateA = new Date(a.uploadedAt || a.createdAt || 0);
    const dateB = new Date(b.uploadedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  // Reset to first page
  videoListCurrentPage = 1;

  // Render the video list
  renderVideoList(videoFiles, modalContent);

  modalOverlay.style.display = 'flex';
}

// Pagination variables for video list
let videoListCurrentPage = 1;
const videoListItemsPerPage = 10;

// Render video list with pagination
function renderVideoList(videoFiles, modalContent) {
  const totalPages = Math.ceil(videoFiles.length / videoListItemsPerPage);
  const startIndex = (videoListCurrentPage - 1) * videoListItemsPerPage;
  const endIndex = Math.min(startIndex + videoListItemsPerPage, videoFiles.length);
  const currentPageItems = videoFiles.slice(startIndex, endIndex);

  // Create modal HTML with table layout
  modalContent.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1400px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">📁 S3 영상 파일 선택</h2>
        <button onclick="closeVideoSelectionModal()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="color: #aaa; font-size: 13px;">
          총 ${videoFiles.length}개의 영상 파일 (${videoListCurrentPage}/${totalPages} 페이지)
        </div>
      </div>

      <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
            <tr style="border-bottom: 2px solid #555;">
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 45%;">설명</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
              <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">삭제</th>
            </tr>
          </thead>
          <tbody>
            ${currentPageItems.map((video, index) => {
              const sizeInMB = video.fileSize ? (video.fileSize / (1024 * 1024)).toFixed(2) : '?';
              let uploadDate = '날짜 없음';
              const dateField = video.uploadedAt || video.createdAt;
              if (dateField) {
                const date = new Date(dateField);
                if (!isNaN(date.getTime())) {
                  uploadDate = date.toLocaleDateString('ko-KR');
                }
              }
              const folder = video.s3Key ? (video.s3Key.includes('videos/ai/') ? 'AI' : video.s3Key.includes('videos/uploads/') ? '업로드' : '기타') : '?';
              const rowBg = index % 2 === 0 ? '#2d2d2d' : '#333';

              return `
                <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s;"
                    onmouseover="this.style.background='#3a3a5a'"
                    onmouseout="this.style.background='${rowBg}'">
                  <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;"
                      onclick="selectVideoFromS3(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    <div style="font-weight: 600;">🎬 ${video.title || video.filename}</div>
                  </td>
                  <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;"
                      onclick="selectVideoFromS3(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    ${video.description || '설명 없음'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; cursor: pointer;"
                      onclick="selectVideoFromS3(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; white-space: nowrap;">
                      ${folder}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;"
                      onclick="selectVideoFromS3(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    ${sizeInMB} MB
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;"
                      onclick="selectVideoFromS3(${video.id}, '${video.title.replace(/'/g, "\\'")}', '${(video.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ')}')">
                    ${uploadDate}
                  </td>
                  <td style="padding: 12px 8px; text-align: center;">
                    <button onclick="event.stopPropagation(); deleteVideoFromS3(${video.id}, '${video.title.replace(/'/g, "\\'")}')"
                            style="background: #dc2626; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: 600; transition: background 0.2s;"
                            onmouseover="this.style.background='#b91c1c'"
                            onmouseout="this.style.background='#dc2626'">
                      🗑️ 삭제
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="goToVideoListPage(1)" ${videoListCurrentPage === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPage === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            처음
          </button>
          <button onclick="goToVideoListPage(${videoListCurrentPage - 1})" ${videoListCurrentPage === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPage === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            이전
          </button>
          <span style="color: #e0e0e0; font-size: 13px;">${videoListCurrentPage} / ${totalPages}</span>
          <button onclick="goToVideoListPage(${videoListCurrentPage + 1})" ${videoListCurrentPage === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPage === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            다음
          </button>
          <button onclick="goToVideoListPage(${totalPages})" ${videoListCurrentPage === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPage === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            마지막
          </button>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="selectLocalVideoFile()" style="padding: 10px 20px; background: #764ba2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            💾 로컬 파일 선택
          </button>
          <button onclick="closeVideoSelectionModal()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            취소
          </button>
        </div>
      </div>
    </div>
  `;

  // Store video files in window for pagination
  window.currentVideoFilesList = videoFiles;
}

// Navigate to a specific page
window.goToVideoListPage = function(page) {
  if (!window.currentVideoFilesList) return;

  const totalPages = Math.ceil(window.currentVideoFilesList.length / videoListItemsPerPage);
  if (page < 1 || page > totalPages) return;

  videoListCurrentPage = page;
  const modalContent = document.getElementById('modal-content');
  if (modalContent) {
    renderVideoList(window.currentVideoFilesList, modalContent);
  }
};

// Close video selection modal
window.closeVideoSelectionModal = function() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
};

// Select local video file
window.selectLocalVideoFile = async function() {
  closeVideoSelectionModal();
  const videoPath = await window.electronAPI.selectVideo();
  if (!videoPath) return;
  await loadVideoWithAudioCheck(videoPath);
};

// Select video from S3
window.selectVideoFromS3 = async function(videoId, videoTitle, videoDescription = '') {
  try {
    closeVideoSelectionModal();
    showProgress();
    updateProgress(30, 'S3에서 영상 다운로드 중...');
    updateStatus(`영상 다운로드 중: ${videoTitle}`);

    console.log('[Video Import] Downloading video from S3:', videoId);

    // Save metadata for later use in export
    currentVideoMetadata = {
      title: videoTitle || '',
      description: videoDescription || ''
    };

    // Get download URL from backend
    const response = await fetch(`${backendBaseUrl}/api/videos/${videoId}/download-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.status}`);
    }

    const data = await response.json();
    const downloadUrl = data.url;

    console.log('[Video Import] Got presigned URL:', downloadUrl);

    updateProgress(60, '영상 파일 다운로드 중...');

    // Download video file using electron API
    const result = await window.electronAPI.downloadFile(downloadUrl, videoTitle);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    console.log('[Video Import] Downloaded to:', result.filePath);

    updateProgress(90, '영상 파일 로드 중...');

    // Load the downloaded video file with audio check
    await loadVideoWithAudioCheck(result.filePath);

    updateProgress(100, '영상 파일 로드 완료');
    hideProgress();

  } catch (error) {
    console.error('[Video Import] Failed to download video from S3:', error);
    hideProgress();
    alert('S3에서 영상 다운로드에 실패했습니다.\n\n' + error.message);
  }
};

// Delete video from S3
window.deleteVideoFromS3 = async function(videoId, videoTitle) {
  try {
    // Confirm deletion
    const confirmed = confirm(`영상 파일 "${videoTitle}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) {
      return;
    }

    console.log('[Video Delete] Deleting video from S3:', videoId);

    // Delete from backend (which will also delete from S3)
    const response = await fetch(`${backendBaseUrl}/api/videos/${videoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete video: ${response.status} - ${errorText}`);
    }

    console.log('[Video Delete] Video deleted successfully');
    alert(`영상 파일 "${videoTitle}"이(가) 삭제되었습니다.`);

    // Refresh the video list
    await showVideoListFromS3();

  } catch (error) {
    console.error('[Video Delete] Failed to delete video:', error);
    alert('영상 삭제에 실패했습니다.\n\n' + error.message);
  }
};

// Show video list from S3 for merge (병합용)
async function showVideoListForMerge() {
  try {
    showProgress();
    updateProgress(30, 'S3에서 영상 목록 불러오는 중...');
    updateStatus('영상 목록 로드 중...');

    // Fetch video list from backend
    const response = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video list: ${response.status}`);
    }

    const videos = await response.json();

    // Filter only video files (check contentType starts with 'video/')
    const videoFiles = videos.filter(v => v.contentType && v.contentType.startsWith('video/'));

    console.log('[Video Merge] Found video files:', videoFiles.length);

    updateProgress(100, '영상 목록 로드 완료');
    hideProgress();

    if (videoFiles.length === 0) {
      const useLocal = confirm('S3에 저장된 영상 파일이 없습니다.\n\n로컬 파일을 선택하시겠습니까?');
      if (useLocal) {
        const videoPath = await window.electronAPI.selectVideo();
        if (!videoPath) return;
        mergeVideos.push(videoPath);
        updateMergeFileList();
      }
      return;
    }

    // Show modal with video list for merge
    showVideoSelectionModalForMerge(videoFiles);

  } catch (error) {
    console.error('[Video Merge] Failed to fetch video list:', error);
    hideProgress();

    const useLocal = confirm('S3 영상 목록을 불러오는데 실패했습니다.\n\n로컬 파일을 선택하시겠습니까?');
    if (useLocal) {
      const videoPath = await window.electronAPI.selectVideo();
      if (!videoPath) return;
      mergeVideos.push(videoPath);
      updateMergeFileList();
    }
  }
}

// Show video selection modal for merge (병합용)
function showVideoSelectionModalForMerge(videoFiles) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');

  if (!modalOverlay || !modalContent) {
    console.error('[Video Merge] Modal elements not found');
    return;
  }

  // Sort by upload date (newest first)
  videoFiles.sort((a, b) => {
    const dateA = new Date(a.uploadedAt || a.createdAt || 0);
    const dateB = new Date(b.uploadedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  // Reset to first page
  videoListCurrentPageForMerge = 1;

  // Render the video list for merge
  renderVideoListForMerge(videoFiles, modalContent);

  modalOverlay.style.display = 'flex';
}

// Pagination variables for video merge list
let videoListCurrentPageForMerge = 1;
const videoListItemsPerPageForMerge = 10;

// Render video list with pagination for merge (병합용)
function renderVideoListForMerge(videoFiles, modalContent) {
  const totalPages = Math.ceil(videoFiles.length / videoListItemsPerPageForMerge);
  const startIndex = (videoListCurrentPageForMerge - 1) * videoListItemsPerPageForMerge;
  const endIndex = Math.min(startIndex + videoListItemsPerPageForMerge, videoFiles.length);
  const currentPageItems = videoFiles.slice(startIndex, endIndex);

  // Create modal HTML with table layout - 병합용이므로 selectVideoFromS3ForMerge 호출
  modalContent.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1400px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">📁 S3 영상 파일 선택 (병합에 추가)</h2>
        <button onclick="closeVideoSelectionModalForMerge()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="color: #aaa; font-size: 13px;">
          총 ${videoFiles.length}개의 영상 파일 (${videoListCurrentPageForMerge}/${totalPages} 페이지)
        </div>
      </div>

      <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
            <tr style="border-bottom: 2px solid #555;">
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 45%;">설명</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
              <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
            </tr>
          </thead>
          <tbody>
            ${currentPageItems.map((video, index) => {
              const sizeInMB = video.fileSize ? (video.fileSize / (1024 * 1024)).toFixed(2) : '?';
              let uploadDate = '날짜 없음';
              const dateField = video.uploadedAt || video.createdAt;
              if (dateField) {
                const date = new Date(dateField);
                if (!isNaN(date.getTime())) {
                  uploadDate = date.toLocaleDateString('ko-KR');
                }
              }
              const folder = video.s3Key ? (video.s3Key.includes('videos/ai/') ? 'AI' : video.s3Key.includes('videos/uploads/') ? '업로드' : '기타') : '?';
              const rowBg = index % 2 === 0 ? '#2d2d2d' : '#333';

              return `
                <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s;"
                    onmouseover="this.style.background='#3a3a5a'"
                    onmouseout="this.style.background='${rowBg}'"
                    onclick="selectVideoFromS3ForMerge(${video.id}, '${video.title.replace(/'/g, "\\'")}')">
                  <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <div style="font-weight: 600;">🎬 ${video.title || video.filename}</div>
                  </td>
                  <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    ${video.description || '설명 없음'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; cursor: pointer;">
                    <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; white-space: nowrap;">
                      ${folder}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;">
                    ${sizeInMB} MB
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;">
                    ${uploadDate}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="goToVideoListPageForMerge(1)" ${videoListCurrentPageForMerge === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPageForMerge === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPageForMerge === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            처음
          </button>
          <button onclick="goToVideoListPageForMerge(${videoListCurrentPageForMerge - 1})" ${videoListCurrentPageForMerge === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPageForMerge === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPageForMerge === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            이전
          </button>
          <span style="color: #e0e0e0; font-size: 13px;">${videoListCurrentPageForMerge} / ${totalPages}</span>
          <button onclick="goToVideoListPageForMerge(${videoListCurrentPageForMerge + 1})" ${videoListCurrentPageForMerge === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPageForMerge === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPageForMerge === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            다음
          </button>
          <button onclick="goToVideoListPageForMerge(${totalPages})" ${videoListCurrentPageForMerge === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${videoListCurrentPageForMerge === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${videoListCurrentPageForMerge === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            마지막
          </button>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="selectLocalVideoFileForMerge()" style="padding: 10px 20px; background: #764ba2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            💾 로컬 파일 선택
          </button>
          <button onclick="closeVideoSelectionModalForMerge()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            취소
          </button>
        </div>
      </div>
    </div>
  `;

  // Store video files in window for pagination
  window.currentVideoFilesListForMerge = videoFiles;
}

// Navigate to a specific page for merge
window.goToVideoListPageForMerge = function(page) {
  if (!window.currentVideoFilesListForMerge) return;

  const totalPages = Math.ceil(window.currentVideoFilesListForMerge.length / videoListItemsPerPageForMerge);
  if (page < 1 || page > totalPages) return;

  videoListCurrentPageForMerge = page;
  const modalContent = document.getElementById('modal-content');
  if (modalContent) {
    renderVideoListForMerge(window.currentVideoFilesListForMerge, modalContent);
  }
};

// Close video selection modal for merge
window.closeVideoSelectionModalForMerge = function() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
};

// Select local video file for merge
window.selectLocalVideoFileForMerge = async function() {
  closeVideoSelectionModalForMerge();
  const videoPath = await window.electronAPI.selectVideo();
  if (!videoPath) return;
  mergeVideos.push(videoPath);
  updateMergeFileList();
};

// Select video from S3 for merge (병합 리스트에 추가)
window.selectVideoFromS3ForMerge = async function(videoId, videoTitle) {
  try {
    closeVideoSelectionModalForMerge();
    showProgress();
    updateProgress(30, 'S3에서 영상 다운로드 중...');
    updateStatus(`영상 다운로드 중: ${videoTitle}`);

    console.log('[Video Merge] Downloading video from S3:', videoId);

    // Get download URL from backend
    const response = await fetch(`${backendBaseUrl}/api/videos/${videoId}/download-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.status}`);
    }

    const data = await response.json();
    const downloadUrl = data.url;

    console.log('[Video Merge] Got presigned URL:', downloadUrl);

    updateProgress(60, '영상 파일 다운로드 중...');

    // Download video file using electron API
    const result = await window.electronAPI.downloadFile(downloadUrl, videoTitle);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    console.log('[Video Merge] Downloaded to:', result.filePath);

    updateProgress(90, '병합 목록에 추가 중...');

    // Add to merge list
    mergeVideos.push(result.filePath);
    updateMergeFileList();

    updateProgress(100, '영상 파일 추가 완료');
    hideProgress();
    updateStatus(`영상 파일 추가됨: ${videoTitle}`);

  } catch (error) {
    console.error('[Video Merge] Failed to download video from S3:', error);
    hideProgress();
    alert('S3에서 영상 다운로드에 실패했습니다.\n\n' + error.message);
  }
};

// Show audio list from S3 for insertion (삽입용)
async function showAudioListForInsertion() {
  try {
    showProgress();
    updateProgress(30, 'S3에서 음성 목록 불러오는 중...');
    updateStatus('음성 목록 로드 중...');

    // Fetch audio list from backend
    const response = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio list: ${response.status}`);
    }

    const videos = await response.json();

    // Filter only audio files (check contentType starts with 'audio/')
    const audioFiles = videos.filter(v => v.contentType && v.contentType.startsWith('audio/'));

    console.log('[Audio Insert] Found audio files:', audioFiles.length);

    updateProgress(100, '음성 목록 로드 완료');
    hideProgress();

    if (audioFiles.length === 0) {
      const useLocal = confirm('S3에 저장된 음성 파일이 없습니다.\n\n로컬 파일을 선택하시겠습니까?');
      if (useLocal) {
        selectedAudioFile = await window.electronAPI.selectAudio();
        if (selectedAudioFile) {
          document.getElementById('selected-audio').textContent = selectedAudioFile.split('\\').pop();
          getAudioDuration(selectedAudioFile);
        }
      }
      return;
    }

    // Show modal with audio list for insertion
    showAudioSelectionModalForInsertion(audioFiles);

  } catch (error) {
    console.error('[Audio Insert] Failed to fetch audio list:', error);
    hideProgress();

    const useLocal = confirm('S3 음성 목록을 불러오는데 실패했습니다.\n\n로컬 파일을 선택하시겠습니까?');
    if (useLocal) {
      selectedAudioFile = await window.electronAPI.selectAudio();
      if (selectedAudioFile) {
        document.getElementById('selected-audio').textContent = selectedAudioFile.split('\\').pop();
        getAudioDuration(selectedAudioFile);
      }
    }
  }
}

// Show audio selection modal for insertion (삽입용)
function showAudioSelectionModalForInsertion(audioFiles) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');

  if (!modalOverlay || !modalContent) {
    console.error('[Audio Insert] Modal elements not found');
    return;
  }

  // Sort by upload date (newest first)
  audioFiles.sort((a, b) => {
    const dateA = new Date(a.uploadedAt || a.createdAt || 0);
    const dateB = new Date(b.uploadedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  // Reset to first page
  audioListCurrentPageForInsertion = 1;

  // Render the audio list for insertion
  renderAudioListForInsertion(audioFiles, modalContent);

  modalOverlay.style.display = 'flex';
}

// Pagination variables for audio insertion list
let audioListCurrentPageForInsertion = 1;
const audioListItemsPerPageForInsertion = 10;

// Render audio list with pagination for insertion (삽입용)
function renderAudioListForInsertion(audioFiles, modalContent) {
  const totalPages = Math.ceil(audioFiles.length / audioListItemsPerPageForInsertion);
  const startIndex = (audioListCurrentPageForInsertion - 1) * audioListItemsPerPageForInsertion;
  const endIndex = Math.min(startIndex + audioListItemsPerPageForInsertion, audioFiles.length);
  const currentPageItems = audioFiles.slice(startIndex, endIndex);

  // Create modal HTML with table layout - 삽입용이므로 selectAudioFromS3ForInsertion 호출
  modalContent.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1400px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">📁 S3 음성 파일 선택 (삽입용)</h2>
        <button onclick="closeAudioSelectionModalForInsertion()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="color: #aaa; font-size: 13px;">
          총 ${audioFiles.length}개의 음성 파일 (${audioListCurrentPageForInsertion}/${totalPages} 페이지)
        </div>
      </div>

      <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
            <tr style="border-bottom: 2px solid #555;">
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
              <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 45%;">설명</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
              <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
              <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
            </tr>
          </thead>
          <tbody>
            ${currentPageItems.map((audio, index) => {
              const sizeInMB = audio.fileSize ? (audio.fileSize / (1024 * 1024)).toFixed(2) : '?';
              let uploadDate = '날짜 없음';
              const dateField = audio.uploadedAt || audio.createdAt;
              if (dateField) {
                const date = new Date(dateField);
                if (!isNaN(date.getTime())) {
                  uploadDate = date.toLocaleDateString('ko-KR');
                }
              }
              const folder = audio.s3Key ? (audio.s3Key.includes('audios/tts/') ? 'TTS' : audio.s3Key.includes('audios/uploads/') ? '업로드' : '기타') : '?';
              const rowBg = index % 2 === 0 ? '#2d2d2d' : '#333';

              return `
                <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s;"
                    onmouseover="this.style.background='#3a3a5a'"
                    onmouseout="this.style.background='${rowBg}'"
                    onclick="selectAudioFromS3ForInsertion(${audio.id}, '${audio.title.replace(/'/g, "\\'")}')">
                  <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    <div style="font-weight: 600;">🎵 ${audio.title || audio.filename}</div>
                  </td>
                  <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">
                    ${audio.description || '설명 없음'}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; cursor: pointer;">
                    <span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; white-space: nowrap;">
                      ${folder}
                    </span>
                  </td>
                  <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;">
                    ${sizeInMB} MB
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px; white-space: nowrap; cursor: pointer;">
                    ${uploadDate}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="goToAudioListPageForInsertion(1)" ${audioListCurrentPageForInsertion === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPageForInsertion === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPageForInsertion === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            처음
          </button>
          <button onclick="goToAudioListPageForInsertion(${audioListCurrentPageForInsertion - 1})" ${audioListCurrentPageForInsertion === 1 ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPageForInsertion === 1 ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPageForInsertion === 1 ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            이전
          </button>
          <span style="color: #e0e0e0; font-size: 13px;">${audioListCurrentPageForInsertion} / ${totalPages}</span>
          <button onclick="goToAudioListPageForInsertion(${audioListCurrentPageForInsertion + 1})" ${audioListCurrentPageForInsertion === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPageForInsertion === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPageForInsertion === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            다음
          </button>
          <button onclick="goToAudioListPageForInsertion(${totalPages})" ${audioListCurrentPageForInsertion === totalPages ? 'disabled' : ''}
                  style="padding: 8px 12px; background: ${audioListCurrentPageForInsertion === totalPages ? '#444' : '#667eea'}; color: white; border: none; border-radius: 4px; cursor: ${audioListCurrentPageForInsertion === totalPages ? 'not-allowed' : 'pointer'}; font-size: 12px;">
            마지막
          </button>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="selectLocalAudioFileForInsertion()" style="padding: 10px 20px; background: #764ba2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            💾 로컬 파일 선택
          </button>
          <button onclick="closeAudioSelectionModalForInsertion()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            취소
          </button>
        </div>
      </div>
    </div>
  `;

  // Store audio files in window for pagination
  window.currentAudioFilesListForInsertion = audioFiles;
}

// Navigate to a specific page for insertion
window.goToAudioListPageForInsertion = function(page) {
  if (!window.currentAudioFilesListForInsertion) return;

  const totalPages = Math.ceil(window.currentAudioFilesListForInsertion.length / audioListItemsPerPageForInsertion);
  if (page < 1 || page > totalPages) return;

  audioListCurrentPageForInsertion = page;
  const modalContent = document.getElementById('modal-content');
  if (modalContent) {
    renderAudioListForInsertion(window.currentAudioFilesListForInsertion, modalContent);
  }
};

// Close audio selection modal for insertion
window.closeAudioSelectionModalForInsertion = function() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
};

// Select local audio file for insertion
window.selectLocalAudioFileForInsertion = async function() {
  closeAudioSelectionModalForInsertion();
  selectedAudioFile = await window.electronAPI.selectAudio();
  if (selectedAudioFile) {
    document.getElementById('selected-audio').textContent = selectedAudioFile.split('\\').pop();
    getAudioDuration(selectedAudioFile);
  }
};

// Select audio from S3 for insertion (삽입용)
window.selectAudioFromS3ForInsertion = async function(audioId, audioTitle) {
  try {
    closeAudioSelectionModalForInsertion();
    showProgress();
    updateProgress(30, 'S3에서 음성 다운로드 중...');
    updateStatus(`음성 다운로드 중: ${audioTitle}`);

    console.log('[Audio Insert] Downloading audio from S3:', audioId);

    // Get download URL from backend
    const response = await fetch(`${backendBaseUrl}/api/videos/${audioId}/download-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.status}`);
    }

    const data = await response.json();
    const downloadUrl = data.url;

    console.log('[Audio Insert] Got presigned URL:', downloadUrl);

    updateProgress(60, '음성 파일 다운로드 중...');

    // Download audio file using electron API
    const result = await window.electronAPI.downloadFile(downloadUrl, audioTitle);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    console.log('[Audio Insert] Downloaded to:', result.filePath);

    updateProgress(90, '음성 파일 설정 중...');

    // Set the selected audio file
    selectedAudioFile = result.filePath;
    document.getElementById('selected-audio').textContent = audioTitle;

    // Get audio duration
    await getAudioDuration(result.filePath);

    updateProgress(100, '음성 파일 선택 완료');
    hideProgress();
    updateStatus(`음성 파일 선택됨: ${audioTitle}`);

  } catch (error) {
    console.error('[Audio Insert] Failed to download audio from S3:', error);
    hideProgress();
    alert('S3에서 음성 다운로드에 실패했습니다.\n\n' + error.message);
  }
};

// Delete audio from S3
window.deleteAudioFromS3 = async function(audioId, audioTitle) {
  try {
    // Confirm deletion
    const confirmed = confirm(`음성 파일 "${audioTitle}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) {
      return;
    }

    console.log('[Audio Delete] Deleting audio from S3:', audioId);

    // Delete from backend (which will also delete from S3)
    const response = await fetch(`${backendBaseUrl}/api/videos/${audioId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete audio: ${response.status} - ${errorText}`);
    }

    console.log('[Audio Delete] Successfully deleted audio:', audioId);
    alert('음성 파일이 삭제되었습니다.');

    // Refresh the audio list
    if (window.currentAudioFilesList) {
      // Remove the deleted item from the current list
      window.currentAudioFilesList = window.currentAudioFilesList.filter(audio => audio.id !== audioId);

      // Check if current page is now empty and should go back
      const totalPages = Math.ceil(window.currentAudioFilesList.length / audioListItemsPerPage);
      if (audioListCurrentPage > totalPages && totalPages > 0) {
        audioListCurrentPage = totalPages;
      } else if (window.currentAudioFilesList.length === 0) {
        audioListCurrentPage = 1;
      }

      // Re-render the list
      const modalContent = document.getElementById('modal-content');
      if (modalContent) {
        renderAudioList(window.currentAudioFilesList, modalContent);
      }
    }

  } catch (error) {
    console.error('[Audio Delete] Failed to delete audio from S3:', error);
    alert('음성 파일 삭제에 실패했습니다.\n\n' + error.message);
  }
};

async function loadAudioFile(audioPath) {
  try {
    currentAudioFile = audioPath;
    audioFileInfo = await window.electronAPI.getVideoInfo(audioPath);

    const duration = parseFloat(audioFileInfo.format.duration);
    const size = (parseFloat(audioFileInfo.format.size || 0) / (1024 * 1024)).toFixed(2);

    // Update status bar
    document.getElementById('current-file').textContent = audioPath.split('\\').pop();
    updateStatus(`음성 파일 로드됨: ${duration.toFixed(2)}초, ${size}MB`);

    // Update preview area to show audio mode
    const placeholder = document.getElementById('preview-placeholder');
    const placeholderP = placeholder.querySelector('p');
    const importBtn = document.getElementById('import-video-btn');

    if (placeholderP) {
      placeholderP.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 15px;">🎵</div>
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">음성 파일 편집 중</div>
          <div style="font-size: 14px; color: #aaa;">${audioPath.split('\\').pop()}</div>
          <div style="font-size: 12px; color: #888; margin-top: 8px;">길이: ${formatTime(duration)} | 크기: ${size}MB</div>
        </div>
      `;
    }

    if (importBtn) {
      importBtn.textContent = '🔄 다른 음성 선택';
    }

    // Generate and display waveform in audio track
    updateStatus('파형 생성 중...');

    // Reset regenerated flag when loading new audio file
    isWaveformRegenerated = false;

    try {
      const waveformBase64 = await window.electronAPI.generateWaveform(audioPath);
      console.log('Waveform generated:', waveformBase64 ? 'Success' : 'Failed');

      const waveformImg = document.getElementById('audio-waveform');
      if (waveformImg) {
        if (waveformBase64) {
          waveformImg.src = waveformBase64;
          waveformImg.style.display = 'block';
          console.log('Waveform image src set successfully');

          // Show channel labels if stereo (2 channels)
          const channelLabels = document.getElementById('channel-labels');
          const audioStream = audioFileInfo.streams.find(s => s.codec_type === 'audio');
          if (channelLabels && audioStream && audioStream.channels === 2) {
            channelLabels.style.display = 'flex';
          } else if (channelLabels) {
            channelLabels.style.display = 'none';
          }
        } else {
          console.error('Waveform generation returned empty result');
          // Show placeholder waveform
          waveformImg.style.display = 'none';
        }
      } else {
        console.error('audio-waveform element not found');
      }
    } catch (waveformError) {
      console.error('Waveform generation error:', waveformError);
      // Continue without waveform - not critical
    }

    // Enable timeline controls
    const timelineSlider = document.getElementById('timeline-slider');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const playheadBar = document.getElementById('playhead-bar');
    const audioElement = document.getElementById('preview-audio');

    if (timelineSlider) {
      timelineSlider.max = duration;
      timelineSlider.disabled = false;
    }

    // Load audio file into audio element
    if (audioElement) {
      // Remove any preview listeners before cloning
      if (audioPreviewListener) {
        console.log('[loadAudioFile] Explicitly removing preview listener before reload');
        audioElement.removeEventListener('timeupdate', audioPreviewListener);
        audioPreviewListener = null;
      }

      // Clone the audio element to remove ALL event listeners (including from preview)
      const newAudioElement = audioElement.cloneNode(true);
      audioElement.parentNode.replaceChild(newAudioElement, audioElement);
      const audioEl = document.getElementById('preview-audio');

      audioEl.src = `file:///${audioPath.replace(/\\/g, '/')}`;

      // Wait for audio to be ready before enabling controls
      audioEl.addEventListener('loadedmetadata', () => {
        console.log('[loadAudioFile] Audio metadata loaded, ready to play');
        // Enable play/pause buttons for audio playback
        if (playBtn) playBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = false;
      }, { once: true });

      audioEl.load();

      // Update slider and playhead as audio plays
      audioEl.addEventListener('timeupdate', () => {
        if (audioEl.duration && timelineSlider) {
          timelineSlider.value = audioEl.currentTime;

          // Update current time display
          const currentTimeDisplay = document.getElementById('current-time');
          if (currentTimeDisplay) {
            currentTimeDisplay.textContent = formatTime(audioEl.currentTime);
          }

          // Update playhead bar
          if (playheadBar) {
            // Calculate percentage relative to full duration
            const percentage = audioEl.currentTime / audioEl.duration;

            // Check if current time is within zoomed range
            if (percentage >= zoomStart && percentage <= zoomEnd) {
              // Show playhead and position it relative to zoomed range
              playheadBar.style.display = 'block';
              const relativePosition = ((percentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
              playheadBar.style.left = `${relativePosition}%`;
            } else {
              // Hide playhead when outside zoomed range
              playheadBar.style.display = 'none';
            }
          }
        }
      });

      // Handle audio end
      audioEl.addEventListener('ended', () => {
        updateStatus('재생 완료');
      });
    }

    // Show playhead bar for audio mode
    if (playheadBar) {
      playheadBar.style.display = 'block';
      playheadBar.style.left = '0%';
    }

    // Setup zoom drag interaction (only once)
    if (!audioPlayheadInteractionSetup) {
      setupAudioTrackInteraction();
      audioPlayheadInteractionSetup = true;
    }

    updateStatus(`음성 파일 로드 완료: ${duration.toFixed(2)}초, ${size}MB`);
  } catch (error) {
    handleError('음성 파일 로드', error, '음성 파일을 불러오는데 실패했습니다.');
  }
}

function updateAudioTrimDurationDisplay() {
  const startInput = document.getElementById('audio-trim-start');
  const endInput = document.getElementById('audio-trim-end');
  const displayElement = document.getElementById('audio-trim-duration-display');

  if (startInput && endInput && displayElement && audioFileInfo) {
    const start = parseFloat(startInput.value) || 0;
    const end = parseFloat(endInput.value) || 0;
    const duration = Math.max(0, end - start);
    displayElement.textContent = `${duration.toFixed(2)}초`;

    // Update timeline overlay for audio trim
    updateAudioTrimRangeOverlay(start, end, parseFloat(audioFileInfo.format.duration));
  }
}

function updateAudioTrimRangeOverlay(startTime, endTime, maxDuration) {
  const overlay = document.getElementById('trim-range-overlay');
  if (!overlay || !audioFileInfo) return;

  // Show overlay only in audio trim mode
  if (activeTool === 'trim-audio') {
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
    alert(`시작 시간은 음성 길이(${maxDuration.toFixed(2)}초)보다 작아야 합니다.`);
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

  showProgress();
  updateProgress(0, '음성 자르는 중 (선택 구간 유지)...');

  // Save previous audio file path for cleanup
  const previousAudioFile = currentAudioFile;

  try {
    // Generate temporary file path
    const result = await window.electronAPI.trimAudioFile({
      inputPath: currentAudioFile,
      outputPath: null, // null means create temp file
      startTime,
      endTime
    });

    hideProgress();
    showCustomDialog('음성 자르기 완료!\n• 선택 구간만 남김\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "음성 내보내기"를 사용하세요.');

    // Force webContents focus after dialog (not needed for custom dialog)
    try {
      await window.electronAPI.focusWebContents();
      console.log('[Trim Audio] WebContents refocused after alert');
    } catch (err) {
      console.error('[Trim Audio] Failed to refocus webContents:', err);
    }

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload the trimmed audio file
    await loadAudioFile(result.outputPath);

    // Delete previous temp file if it exists
    if (previousAudioFile && previousAudioFile !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousAudioFile);
    }

    // Keep trim mode active for continuous editing
    // Reactivate the trim-audio tool to show the UI again
    const trimAudioBtn = document.querySelector('.tool-btn[data-tool="trim-audio"]');
    if (trimAudioBtn) {
      trimAudioBtn.click();
    }

    const newDuration = parseFloat(audioFileInfo.format.duration);
    updateStatus(`음성 자르기 완료 (임시 저장): ${newDuration.toFixed(2)}초`);
  } catch (error) {
    hideProgress();
    handleError('음성 자르기', error, '음성 자르기에 실패했습니다.');
  }
}

// Execute delete audio range (keep beginning and end, remove middle)
async function executeDeleteAudioRange() {
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
    alert(`시작 시간은 음성 길이(${maxDuration.toFixed(2)}초)보다 작아야 합니다.`);
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

  const deleteLength = endTime - startTime;
  const firstPartLength = startTime;
  const secondPartLength = maxDuration - endTime;
  const finalDuration = maxDuration - deleteLength;

  if (deleteLength < 0.1) {
    alert('구간 길이는 최소 0.1초 이상이어야 합니다.');
    return;
  }

  // Confirm with user
  const confirmMsg = `선택 구간 삭제:\n\n` +
    `• 삭제 구간: ${formatTime(startTime)} ~ ${formatTime(endTime)} (${deleteLength.toFixed(2)}초)\n` +
    `• 유지 구간: 0~${formatTime(startTime)} + ${formatTime(endTime)}~${formatTime(maxDuration)}\n` +
    `• 최종 길이: ${finalDuration.toFixed(2)}초\n\n` +
    `계속하시겠습니까?`;

  if (!confirm(confirmMsg)) {
    return;
  }

  showProgress();
  updateProgress(0, '음성 자르는 중 (선택 구간 삭제)...');

  // Save previous audio file path for cleanup
  const previousAudioFile = currentAudioFile;

  try {
    let firstPart = null;
    let secondPart = null;
    let finalResult = null;

    // Trim first part (0 ~ startTime)
    if (firstPartLength >= 0.1) {
      updateProgress(25, '앞부분 추출 중...');
      firstPart = await window.electronAPI.trimAudioFile({
        inputPath: currentAudioFile,
        outputPath: null,
        startTime: 0,
        endTime: startTime
      });
    }

    // Trim second part (endTime ~ maxDuration)
    if (secondPartLength >= 0.1) {
      updateProgress(50, '뒷부분 추출 중...');
      secondPart = await window.electronAPI.trimAudioFile({
        inputPath: currentAudioFile,
        outputPath: null,
        startTime: endTime,
        endTime: maxDuration
      });
    }

    // Merge both parts
    if (firstPart && secondPart) {
      updateProgress(75, '앞뒤 부분 병합 중...');
      finalResult = await window.electronAPI.mergeAudios({
        audioPaths: [firstPart.outputPath, secondPart.outputPath],
        outputPath: null
      });
    } else if (firstPart) {
      finalResult = firstPart;
    } else if (secondPart) {
      finalResult = secondPart;
    } else {
      throw new Error('유효한 음성 구간이 없습니다.');
    }

    hideProgress();
    showCustomDialog('음성 자르기 완료!\n• 선택 구간 삭제됨\n• 앞뒤 부분 연결됨\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "음성 내보내기"를 사용하세요.');

    // Force webContents focus after dialog (not needed for custom dialog)
    try {
      await window.electronAPI.focusWebContents();
      console.log('[Delete Audio Range] WebContents refocused after alert');
    } catch (err) {
      console.error('[Delete Audio Range] Failed to refocus webContents:', err);
    }

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload the trimmed audio file
    await loadAudioFile(finalResult.outputPath);

    // Delete previous temp files
    if (previousAudioFile && previousAudioFile !== finalResult.outputPath) {
      await window.electronAPI.deleteTempFile(previousAudioFile);
    }
    if (firstPart && firstPart.outputPath !== finalResult.outputPath) {
      await window.electronAPI.deleteTempFile(firstPart.outputPath);
    }
    if (secondPart && secondPart.outputPath !== finalResult.outputPath) {
      await window.electronAPI.deleteTempFile(secondPart.outputPath);
    }

    // Keep trim mode active for continuous editing
    // Reactivate the trim-audio tool to show the UI again
    const trimAudioBtn = document.querySelector('.tool-btn[data-tool="trim-audio"]');
    if (trimAudioBtn) {
      trimAudioBtn.click();
    }

    const newDuration = parseFloat(audioFileInfo.format.duration);
    updateStatus(`음성 자르기 완료 (임시 저장): ${newDuration.toFixed(2)}초`);
  } catch (error) {
    hideProgress();
    handleError('음성 구간 삭제', error, '음성 구간 삭제에 실패했습니다.');
  }
}

// Preview audio with volume adjustment
let volumePreviewAudio = null;

function previewAudioVolume() {
  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('audio-volume-level').value);
  const previewBtn = document.getElementById('preview-volume-btn');

  // Stop existing preview if playing
  if (volumePreviewAudio && !volumePreviewAudio.paused) {
    volumePreviewAudio.pause();
    volumePreviewAudio.currentTime = 0;
    volumePreviewAudio = null;
    previewBtn.textContent = '🎧 미리듣기';
    previewBtn.classList.remove('active');
    return;
  }

  // Create audio element with file path
  volumePreviewAudio = new Audio(`file:///${currentAudioFile.replace(/\\/g, '/')}`);

  // Set volume (capped at 1.0 for preview to prevent distortion)
  volumePreviewAudio.volume = Math.min(1.0, volumeLevel);

  // Get current playback position from timeline slider
  const timelineSlider = document.getElementById('timeline-slider');
  if (timelineSlider && audioFileInfo) {
    const audioDuration = parseFloat(audioFileInfo.format.duration);
    const currentTime = parseFloat(timelineSlider.value);

    // If at the end (within 1 second), start from beginning
    if (audioDuration - currentTime < 1.0) {
      volumePreviewAudio.currentTime = 0;
      timelineSlider.value = 0;

      // Update time display
      const currentTimeDisplay = document.getElementById('current-time');
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(0);
      }

      // Update playhead bar
      const playheadBar = document.getElementById('playhead-bar');
      if (playheadBar) {
        playheadBar.style.left = '0%';
      }
    } else {
      volumePreviewAudio.currentTime = currentTime;
    }
  }

  // Update button state
  previewBtn.textContent = '⏸️ 정지';
  previewBtn.classList.add('active');

  // Update timeline during playback
  volumePreviewAudio.addEventListener('timeupdate', () => {
    if (!volumePreviewAudio || !audioFileInfo) return;

    const currentTime = volumePreviewAudio.currentTime;
    const audioDuration = parseFloat(audioFileInfo.format.duration);

    // Update timeline slider
    const timelineSlider = document.getElementById('timeline-slider');
    if (timelineSlider) {
      timelineSlider.value = currentTime;
    }

    // Update time display
    const currentTimeDisplay = document.getElementById('current-time');
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = formatTime(currentTime);
    }

    // Update playhead bar position
    const playheadBar = document.getElementById('playhead-bar');
    if (playheadBar) {
      // Calculate percentage relative to full duration
      const percentage = currentTime / audioDuration;
      // Map percentage to zoomed range
      const zoomRange = zoomEnd - zoomStart;
      const relativePercentage = (percentage - zoomStart) / zoomRange;
      const clampedPercentage = Math.max(0, Math.min(1, relativePercentage));
      playheadBar.style.left = (clampedPercentage * 100) + '%';
    }
  });

  // Play audio
  volumePreviewAudio.play().catch(error => {
    console.error('Audio playback error:', error);
    alert('오디오 재생에 실패했습니다.');
    previewBtn.textContent = '🎧 미리듣기';
    previewBtn.classList.remove('active');
  });

  // Reset button when playback ends
  volumePreviewAudio.addEventListener('ended', () => {
    previewBtn.textContent = '🎧 미리듣기';
    previewBtn.classList.remove('active');
    volumePreviewAudio = null;
  });

  updateStatus(`볼륨 미리듣기: ${volumeLevel}x`);
}

async function executeAudioVolume() {
  // Stop preview if playing
  if (volumePreviewAudio && !volumePreviewAudio.paused) {
    volumePreviewAudio.pause();
    volumePreviewAudio.currentTime = 0;
    volumePreviewAudio = null;
    const previewBtn = document.getElementById('preview-volume-btn');
    if (previewBtn) {
      previewBtn.textContent = '🎧 미리듣기';
      previewBtn.classList.remove('active');
    }
  }

  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const volumeLevel = parseFloat(document.getElementById('audio-volume-level').value);

  showProgress();
  updateProgress(0, '볼륨 조절 중...');

  // Save previous audio file path for cleanup
  const previousAudioFile = currentAudioFile;

  try {
    // Use dedicated audio volume adjustment handler
    const result = await window.electronAPI.adjustAudioVolume({
      inputPath: currentAudioFile,
      outputPath: null, // null means create temp file
      volumeLevel
    });

    hideProgress();
    alert(`볼륨 조절 완료!\n\n볼륨 레벨: ${volumeLevel}x\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "음성 내보내기"를 사용하세요.`);

    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload the adjusted audio file
    await loadAudioFile(result.outputPath);

    // Delete previous temp file if it exists
    if (previousAudioFile && previousAudioFile !== result.outputPath) {
      await window.electronAPI.deleteTempFile(previousAudioFile);
    }

    updateStatus(`볼륨 조절 완료 (임시 저장): ${volumeLevel}x`);
  } catch (error) {
    hideProgress();
    handleError('볼륨 조절', error, '볼륨 조절에 실패했습니다.');
  }
}

// Export audio to local file
async function executeExportAudioLocal() {
  console.log('[Export Audio Local] Function called');

  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  // Generate default filename
  const fileName = currentAudioFile.split('\\').pop().split('/').pop();
  const defaultName = fileName.endsWith('.mp3') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp3');

  console.log('[Export Audio Local] Requesting file save dialog', { currentFile: fileName, defaultName });
  const outputPath = await window.electronAPI.selectOutput(defaultName);

  console.log('[Export Audio Local] Dialog returned', { outputPath });
  if (!outputPath) {
    console.log('[Export Audio Local] Export canceled by user');
    updateStatus('내보내기 취소됨');
    return;
  }

  showProgress();
  updateProgress(0, '음성 파일 내보내는 중...');

  try {
    // Copy current audio file to selected location
    const result = await window.electronAPI.copyAudioFile({
      inputPath: currentAudioFile,
      outputPath
    });

    hideProgress();

    const savedFileName = result.outputPath.split('\\').pop();
    alert(`음성 내보내기 완료!\n\n저장된 파일: ${savedFileName}`);
    updateStatus(`내보내기 완료: ${savedFileName}`);

    // Update current audio file to exported file (temp file was deleted)
    currentAudioFile = result.outputPath;

    // Reload audio from new location
    await loadAudioFile(result.outputPath);
  } catch (error) {
    hideProgress();
    handleError('음성 내보내기', error, '음성 내보내기에 실패했습니다.');
  }
}

// Export audio to S3
async function executeExportAudioToS3() {
  console.log('[Export Audio S3] Function called');

  if (!currentAudioFile) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  // Check if user is logged in
  if (!authToken || !currentUser) {
    alert('S3에 업로드하려면 로그인이 필요합니다.');
    return;
  }

  // Get title and description from input fields
  const titleInput = document.getElementById('export-audio-title');
  const descriptionInput = document.getElementById('export-audio-description');

  const title = titleInput ? titleInput.value.trim() : '';
  const description = descriptionInput ? descriptionInput.value.trim() : '';

  if (!title) {
    alert('제목을 입력해주세요.');
    if (titleInput) titleInput.focus();
    return;
  }

  showProgress();
  updateProgress(0, '제목 중복 확인 중...');

  try {
    // Check for duplicate title
    console.log('[Export Audio S3] Checking for duplicate title:', title);
    const checkResponse = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`제목 확인 실패: ${checkResponse.status}`);
    }

    const allVideos = await checkResponse.json();
    const audioFiles = allVideos.filter(v => v.contentType && v.contentType.startsWith('audio/'));
    const duplicateTitle = audioFiles.find(audio => audio.title === title);

    if (duplicateTitle) {
      hideProgress();
      const overwrite = confirm(`같은 제목의 음성 파일이 이미 존재합니다.\n\n제목: ${title}\n\n다른 제목을 사용해주세요.`);
      if (titleInput) titleInput.focus();
      return;
    }

    updateProgress(50, 'S3에 음성 파일 업로드 중...');

    // Read file and create FormData
    const fileUrl = `file:///${currentAudioFile.replace(/\\/g, '/')}`;
    const fileResponse = await fetch(fileUrl);
    const audioBlob = await fileResponse.blob();
    const fileName = currentAudioFile.split('\\').pop().split('/').pop();

    console.log('[Export Audio S3] Uploading to S3:', { title, description, fileName, size: audioBlob.size });

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, fileName);
    formData.append('title', title);
    formData.append('description', description);

    // Upload to backend (audios/uploads folder)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/audios/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('[Export Audio S3] Upload successful:', result);

    updateProgress(100, '음성 파일 업로드 완료!');
    hideProgress();

    alert(`S3 업로드 완료!\n\n제목: ${title}\n파일명: ${fileName}\n\n클라우드 (audios/uploads/)에 성공적으로 저장되었습니다.`);
    updateStatus(`S3 업로드 완료: ${title}`);

    // Clear input fields after successful upload
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
  } catch (error) {
    hideProgress();
    console.error('[Export Audio S3] Error:', error);
    handleError('S3 업로드', error, 'S3 업로드에 실패했습니다.');
  }
}

// Export video function
// Export video to local file
async function executeExportVideoLocal() {
  console.log('[Export Video Local] Function called');

  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  // Generate default filename
  const fileName = currentVideo.split('\\').pop().split('/').pop();
  const defaultName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');

  console.log('[Export Video Local] Requesting file save dialog', { currentFile: fileName, defaultName });
  const outputPath = await window.electronAPI.selectOutput(defaultName);

  console.log('[Export Video Local] Dialog returned', { outputPath });
  if (!outputPath) {
    console.log('[Export Video Local] Export canceled by user');
    updateStatus('내보내기 취소됨');
    return;
  }

  showProgress();
  updateProgress(0, '비디오 파일 내보내는 중...');

  try {
    // Copy current video file to selected location
    const result = await window.electronAPI.copyAudioFile({
      inputPath: currentVideo,
      outputPath
    });

    hideProgress();

    const savedFileName = result.outputPath.split('\\').pop();
    alert(`비디오 내보내기 완료!\n\n저장된 파일: ${savedFileName}`);
    updateStatus(`내보내기 완료: ${savedFileName}`);

    // Update current video to exported file (temp file was deleted)
    currentVideo = result.outputPath;

    // Reload video from new location
    await loadVideo(result.outputPath);
  } catch (error) {
    hideProgress();
    handleError('비디오 내보내기', error, '비디오 내보내기에 실패했습니다.');
  }
}

// Export video to S3
async function executeExportVideoToS3() {
  console.log('[Export Video S3] Function called');

  if (!currentVideo) {
    alert('먼저 영상을 가져와주세요.');
    return;
  }

  // Check if user is logged in
  if (!authToken || !currentUser) {
    alert('S3에 업로드하려면 로그인이 필요합니다.');
    return;
  }

  // Get title and description from input fields
  const titleInput = document.getElementById('export-video-title');
  const descriptionInput = document.getElementById('export-video-description');

  const title = titleInput ? titleInput.value.trim() : '';
  const description = descriptionInput ? descriptionInput.value.trim() : '';

  if (!title) {
    alert('제목을 입력해주세요.');
    if (titleInput) titleInput.focus();
    return;
  }

  showProgress();
  updateProgress(0, '제목 중복 확인 중...');

  try {
    // Check for duplicate title
    console.log('[Export Video S3] Checking for duplicate title:', title);
    const checkResponse = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`제목 확인 실패: ${checkResponse.status}`);
    }

    const allVideos = await checkResponse.json();
    const videoFiles = allVideos.filter(v => v.contentType && v.contentType.startsWith('video/'));
    const duplicateTitle = videoFiles.find(video => video.title === title);

    if (duplicateTitle) {
      hideProgress();
      alert(`같은 제목의 영상 파일이 이미 존재합니다.\n\n제목: ${title}\n\n다른 제목을 사용해주세요.`);
      if (titleInput) titleInput.focus();
      return;
    }

    updateProgress(50, 'S3에 영상 파일 업로드 중...');

    // Read file and create FormData
    const fileUrl = `file:///${currentVideo.replace(/\\/g, '/')}`;
    const fileResponse = await fetch(fileUrl);
    const videoBlob = await fileResponse.blob();
    const fileName = currentVideo.split('\\').pop().split('/').pop();

    console.log('[Export Video S3] Uploading to S3:', { title, description, fileName, size: videoBlob.size });

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', videoBlob, fileName);
    formData.append('title', title);
    formData.append('description', description);

    // Upload to backend (videos folder)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('[Export Video S3] Upload successful:', result);

    updateProgress(100, '영상 파일 업로드 완료!');
    hideProgress();

    alert(`S3 업로드 완료!\n\n제목: ${title}\n파일명: ${fileName}\n\n클라우드에 성공적으로 저장되었습니다.`);
    updateStatus(`S3 업로드 완료: ${title}`);

    // Clear input fields after successful upload
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
  } catch (error) {
    hideProgress();
    console.error('[Export Video S3] Error:', error);
    handleError('영상 내보내기 및 S3 업로드', error, 'S3 업로드에 실패했습니다.');
  }
}

// Audio trim helper functions
function setAudioStartFromSlider() {
  if (!audioFileInfo) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const slider = document.getElementById('timeline-slider');
  const startInput = document.getElementById('audio-trim-start');

  if (!slider || !startInput) return;

  // Slider value is already in seconds (slider.max = duration)
  const currentTime = parseFloat(slider.value);

  startInput.value = currentTime.toFixed(2);
  updateAudioTrimDurationDisplay();
  updateStatus(`시작 시간 설정: ${formatTime(currentTime)}`);
}

function setAudioEndFromSlider() {
  if (!audioFileInfo) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const slider = document.getElementById('timeline-slider');
  const endInput = document.getElementById('audio-trim-end');

  if (!slider || !endInput) return;

  // Slider value is already in seconds (slider.max = duration)
  const currentTime = parseFloat(slider.value);

  endInput.value = currentTime.toFixed(2);
  updateAudioTrimDurationDisplay();
  updateStatus(`끝 시간 설정: ${formatTime(currentTime)}`);
}

function moveSliderToAudioStart() {
  if (!audioFileInfo) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const startInput = document.getElementById('audio-trim-start');
  const slider = document.getElementById('timeline-slider');
  const currentTimeDisplay = document.getElementById('current-time');
  const playheadBar = document.getElementById('playhead-bar');
  const audioDuration = parseFloat(audioFileInfo.format.duration);

  if (!startInput || !slider) return;

  const startTime = parseFloat(startInput.value) || 0;
  const targetTime = Math.min(startTime, audioDuration);

  // Update slider
  slider.value = targetTime;

  // Update current time display
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(targetTime);
  }

  // Update playhead bar position
  if (playheadBar) {
    // Calculate percentage relative to full duration
    const percentage = targetTime / audioDuration;

    // Check if current time is within zoomed range
    if (percentage >= zoomStart && percentage <= zoomEnd) {
      // Show playhead and position it relative to zoomed range
      playheadBar.style.display = 'block';
      const relativePosition = ((percentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
      playheadBar.style.left = `${relativePosition}%`;
    } else {
      // Hide playhead when outside zoomed range
      playheadBar.style.display = 'none';
    }
  }

  updateStatus(`시작 위치로 이동: ${formatTime(targetTime)}`);
}

function moveSliderToAudioEnd() {
  if (!audioFileInfo) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const endInput = document.getElementById('audio-trim-end');
  const slider = document.getElementById('timeline-slider');
  const currentTimeDisplay = document.getElementById('current-time');
  const playheadBar = document.getElementById('playhead-bar');
  const audioDuration = parseFloat(audioFileInfo.format.duration);

  if (!endInput || !slider) return;

  const endTime = parseFloat(endInput.value) || 0;
  const targetTime = Math.min(endTime, audioDuration);

  // Update slider
  slider.value = targetTime;

  // Update current time display
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(targetTime);
  }

  // Update playhead bar position
  if (playheadBar) {
    // Calculate percentage relative to full duration
    const percentage = targetTime / audioDuration;

    // Check if current time is within zoomed range
    if (percentage >= zoomStart && percentage <= zoomEnd) {
      // Show playhead and position it relative to zoomed range
      playheadBar.style.display = 'block';
      const relativePosition = ((percentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
      playheadBar.style.left = `${relativePosition}%`;
    } else {
      // Hide playhead when outside zoomed range
      playheadBar.style.display = 'none';
    }
  }

  updateStatus(`끝 위치로 이동: ${formatTime(targetTime)}`);
}

async function previewAudioTrimRange() {
  if (!currentAudioFile || !audioFileInfo) {
    alert('먼저 음성 파일을 가져와주세요.');
    return;
  }

  const startTime = parseFloat(document.getElementById('audio-trim-start').value) || 0;
  const endTime = parseFloat(document.getElementById('audio-trim-end').value) || 0;

  if (endTime <= startTime) {
    alert('끝 시간은 시작 시간보다 커야 합니다.');
    return;
  }

  const duration = endTime - startTime;
  if (duration < 0.1) {
    alert('구간 길이는 최소 0.1초 이상이어야 합니다.');
    return;
  }

  // Play the selected range directly in the app using the audio element
  const audioElement = document.getElementById('preview-audio');
  if (!audioElement) {
    alert('오디오 요소를 찾을 수 없습니다.');
    return;
  }

  // Set flag to prevent auto-skip during preview
  isPreviewingRange = true;

  // Set the start position
  audioElement.currentTime = startTime;

  // Update UI
  const timelineSlider = document.getElementById('timeline-slider');
  if (timelineSlider) {
    timelineSlider.value = startTime;
  }

  // Play the audio
  audioElement.play();
  updateStatus(`구간 미리듣기 중: ${formatTime(startTime)} ~ ${formatTime(endTime)} (${duration.toFixed(2)}초)`);

  // Remove previous preview listener if it exists
  if (audioPreviewListener) {
    console.log('[previewAudioTrimRange] Removing previous preview listener');
    audioElement.removeEventListener('timeupdate', audioPreviewListener);
  }

  // Stop playback when reaching the end time
  const checkTime = () => {
    if (audioElement.currentTime >= endTime) {
      audioElement.pause();
      isPreviewingRange = false; // Reset flag

      // Move to end position instead of start
      audioElement.currentTime = endTime;

      // Update UI to show end position
      const playheadBar = document.getElementById('playhead-bar');
      const audioDuration = parseFloat(audioFileInfo.format.duration);

      if (timelineSlider) {
        timelineSlider.value = endTime;
      }

      if (playheadBar) {
        // Calculate percentage relative to full duration
        const percentage = endTime / audioDuration;

        // Check if end time is within zoomed range
        if (percentage >= zoomStart && percentage <= zoomEnd) {
          // Show playhead and position it relative to zoomed range
          playheadBar.style.display = 'block';
          const relativePosition = ((percentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
          playheadBar.style.left = `${relativePosition}%`;
        } else {
          // Hide playhead when outside zoomed range
          playheadBar.style.display = 'none';
        }
      }

      const currentTimeDisplay = document.getElementById('current-time');
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(endTime);
      }

      updateStatus(`구간 미리듣기 완료: ${formatTime(startTime)} ~ ${formatTime(endTime)}`);

      // Remove listener and clear reference
      audioElement.removeEventListener('timeupdate', checkTime);
      audioPreviewListener = null;
    }
  };

  // Store listener reference for explicit removal later
  audioPreviewListener = checkTime;
  audioElement.addEventListener('timeupdate', checkTime);
  console.log('[previewAudioTrimRange] Added new preview listener');
}

// Mode switching functions
function setupModeButtons() {
  const videoModeBtn = document.getElementById('video-mode-btn');
  const audioModeBtn = document.getElementById('audio-mode-btn');
  const contentModeBtn = document.getElementById('content-mode-btn');

  if (videoModeBtn) {
    videoModeBtn.addEventListener('click', () => {
      switchMode('video');
    });
  }

  if (audioModeBtn) {
    audioModeBtn.addEventListener('click', () => {
      switchMode('audio');
    });
  }

  if (contentModeBtn) {
    contentModeBtn.addEventListener('click', () => {
      switchMode('content');
    });
  }
}

function switchMode(mode) {
  if (currentMode === mode) {
    return; // Already in this mode
  }

  // Check if there's work in progress
  const hasVideoWork = currentMode === 'video' && currentVideo;
  const hasAudioWork = currentMode === 'audio' && currentAudioFile;

  if (hasVideoWork || hasAudioWork) {
    const currentType = currentMode === 'video' ? '영상' : '음성';
    const targetType = mode === 'video' ? '영상' : (mode === 'audio' ? '음성' : 'TTS 생성');
    const confirmed = confirm(
      `현재 ${currentType} 편집 작업이 있습니다.\n` +
      `${targetType} 모드로 전환하면 작업 내용이 초기화됩니다.\n` +
      `계속하시겠습니까?`
    );

    if (!confirmed) {
      updateStatus('모드 전환 취소됨');
      return;
    }
  }

  // Switch mode
  currentMode = mode;
  resetWorkspace();
  updateModeUI();

  // Update status message based on mode
  let modeMessage = '';
  if (mode === 'video') {
    modeMessage = '영상 편집 모드로 전환됨';
  } else if (mode === 'audio') {
    modeMessage = '음성 편집 모드로 전환됨';
  } else if (mode === 'tts') {
    modeMessage = 'TTS 음성 생성 모드로 전환됨';
    // TTS 모드로 전환 시 자동으로 TTS 패널 표시
    showPropertyPanel('generate-tts');
  }
  updateStatus(modeMessage);
}

function setupModeListener() {
  if (window.electronAPI && window.electronAPI.onModeSwitch) {
    window.electronAPI.onModeSwitch((mode) => {
      switchMode(mode);
    });
  }
}

function resetWorkspace() {
  // Reset video mode state
  if (currentMode === 'video' && currentVideo) {
    currentVideo = null;
    videoInfo = null;
    const videoElement = document.getElementById('preview-video');
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
    }
  }

  // Reset audio mode state
  if (currentMode === 'audio' && currentAudioFile) {
    currentAudioFile = null;
    audioFileInfo = null;
  }

  // Reset timeline
  const timelineSlider = document.getElementById('timeline-slider');
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');

  if (timelineSlider) {
    timelineSlider.value = 0;
    timelineSlider.disabled = true;
  }

  if (playBtn) playBtn.disabled = true;
  if (pauseBtn) pauseBtn.disabled = true;

  // Reset overlays
  const trimOverlay = document.getElementById('trim-range-overlay');
  const audioOverlay = document.getElementById('audio-range-overlay');
  const zoomOverlay = document.getElementById('zoom-range-overlay');
  const dragSelection = document.getElementById('slider-drag-selection');

  if (trimOverlay) trimOverlay.style.display = 'none';
  if (audioOverlay) audioOverlay.style.display = 'none';
  if (zoomOverlay) zoomOverlay.style.display = 'none';
  if (dragSelection) dragSelection.style.display = 'none';

  // Reset waveform
  const waveform = document.getElementById('audio-waveform');
  const playheadBar = document.getElementById('playhead-bar');
  const zoomSelection = document.getElementById('zoom-selection');

  if (waveform) waveform.style.display = 'none';
  if (playheadBar) playheadBar.style.display = 'none';
  if (zoomSelection) zoomSelection.style.display = 'none';

  // Reset video info
  const videoInfoDiv = document.getElementById('video-info');
  if (videoInfoDiv) videoInfoDiv.style.display = 'none';

  // Show placeholder
  const placeholder = document.getElementById('preview-placeholder');
  const videoPreview = document.getElementById('preview-video');

  if (placeholder) placeholder.style.display = 'flex';
  if (videoPreview) videoPreview.style.display = 'none';

  // Reset current time display
  const currentTimeDisplay = document.getElementById('current-time');
  if (currentTimeDisplay) currentTimeDisplay.textContent = '00:00:00.00';

  // Reset status bar
  const currentFileDisplay = document.getElementById('current-file');
  if (currentFileDisplay) currentFileDisplay.textContent = '파일 없음';

  // Clear tool properties
  activeTool = null;
  document.getElementById('tool-properties').innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';

  // Reset merge videos list
  mergeVideos = [];

  // Reset zoom state
  zoomStart = 0;
  zoomEnd = 1;

  // Reset playhead interaction flags to allow re-setup in new mode
  videoPlayheadInteractionSetup = false;
  audioPlayheadInteractionSetup = false;
  isWaveformRegenerated = false;
}

function updateModeUI() {
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.header h1');
  const subtitle = document.querySelector('.header .subtitle');

  if (currentMode === 'content') {
    // Content generation mode
    header.textContent = '컨텐츠 생성';
    subtitle.textContent = 'AI를 활용한 이미지, 영상, 음성 생성';
    sidebar.innerHTML = `
      <h2>생성 도구</h2>

      <div class="tool-section">
        <h3>🖼️ 이미지 만들기</h3>
        <button class="tool-btn" data-tool="import-image">
          <span class="icon">📁</span>
          이미지 가져오기
        </button>
        <button class="tool-btn" data-tool="generate-image-runway">
          <span class="icon">🎨</span>
          Runway 이미지 생성
        </button>
        <button class="tool-btn" data-tool="generate-image-veo">
          <span class="icon">✨</span>
          Veo 이미지 생성
        </button>
      </div>

      <div class="tool-section">
        <h3>🎬 영상 만들기</h3>
        <button class="tool-btn" data-tool="import-video-content">
          <span class="icon">📁</span>
          영상 가져오기
        </button>
        <button class="tool-btn" data-tool="generate-video-runway">
          <span class="icon">🎥</span>
          Runway 영상 생성
        </button>
        <button class="tool-btn" data-tool="generate-video-veo">
          <span class="icon">🌟</span>
          Veo 영상 생성
        </button>
      </div>

      <div class="tool-section">
        <h3>🗣️ 음성 만들기</h3>
        <button class="tool-btn" data-tool="import-audio-content">
          <span class="icon">📁</span>
          음성 가져오기
        </button>
        <button class="tool-btn" data-tool="generate-audio-google">
          <span class="icon">🎵</span>
          Google TTS 생성
        </button>
      </div>

      <div class="tool-section">
        <h3>정보</h3>
        <p style="color: #aaa; font-size: 12px; padding: 10px; line-height: 1.5;">
          Runway ML, Google Veo 및 Google Cloud API를 사용하여 AI 기반 컨텐츠를 생성합니다.
        </p>
        <p style="color: #888; font-size: 11px; padding: 0 10px;">
          ⚙️ 환경변수 필요:<br>
          RUNWAY_API_KEY (Runway)<br>
          GOOGLE_AI_API_KEY (Veo/TTS)
        </p>
      </div>
    `;
  } else if (currentMode === 'audio') {
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
        <button class="tool-btn" data-tool="merge-audio">
          <span class="icon">🔗</span>
          음성 병합
        </button>
      </div>
      <div class="tool-section">
        <h3>효과</h3>
        <button class="tool-btn" data-tool="audio-volume">
          <span class="icon">🔊</span>
          볼륨 조절
        </button>
        <button class="tool-btn" data-tool="audio-speed">
          <span class="icon">⚡</span>
          속도 조절
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

  // Update placeholder text based on mode
  const placeholderP = document.querySelector('#preview-placeholder p');
  const importBtn = document.getElementById('import-video-btn');
  if (placeholderP && importBtn) {
    if (currentMode === 'audio') {
      placeholderP.textContent = '음성 파일을 가져와주세요';
      importBtn.textContent = '🎵 음성 선택';
    } else if (currentMode === 'tts') {
      placeholderP.textContent = 'TTS 음성 생성 모드';
      importBtn.style.display = 'none'; // TTS 모드에서는 가져오기 버튼 숨김
    } else {
      placeholderP.textContent = '영상을 가져와주세요';
      importBtn.textContent = '📁 영상 선택';
      importBtn.style.display = 'block';
    }
  }

  // Clear current tool selection
  activeTool = null;
  document.getElementById('tool-properties').innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';

  // Update header mode buttons
  const videoModeBtn = document.getElementById('video-mode-btn');
  const audioModeBtn = document.getElementById('audio-mode-btn');
  const ttsModeBtn = document.getElementById('tts-mode-btn');

  if (videoModeBtn && audioModeBtn && ttsModeBtn) {
    // Remove active from all
    videoModeBtn.classList.remove('active');
    audioModeBtn.classList.remove('active');
    ttsModeBtn.classList.remove('active');

    // Add active to current mode
    if (currentMode === 'video') {
      videoModeBtn.classList.add('active');
    } else if (currentMode === 'audio') {
      audioModeBtn.classList.add('active');
    } else if (currentMode === 'tts') {
      ttsModeBtn.classList.add('active');
    }
  }
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

// ==================== TTS Functions ====================

// Update TTS character count
function updateTtsCharCount() {
  const text = document.getElementById('tts-text')?.value || '';
  const charCount = document.getElementById('tts-char-count');
  if (charCount) {
    charCount.textContent = `${text.length} / 5000 자`;
  }
}

// Update TTS voice options based on language
function updateTtsVoiceOptions() {
  const language = document.getElementById('tts-language')?.value;
  const voiceSelect = document.getElementById('tts-voice');

  if (!voiceSelect) return;

  const voiceOptions = {
    'ko-KR': [
      { value: 'ko-KR-Neural2-A', label: 'Korean Female A (Neural2)' },
      { value: 'ko-KR-Neural2-B', label: 'Korean Female B (Neural2)' },
      { value: 'ko-KR-Neural2-C', label: 'Korean Male C (Neural2)' },
      { value: 'ko-KR-Standard-A', label: 'Korean Female A (Standard)' },
      { value: 'ko-KR-Standard-B', label: 'Korean Female B (Standard)' },
      { value: 'ko-KR-Standard-C', label: 'Korean Male C (Standard)' },
      { value: 'ko-KR-Standard-D', label: 'Korean Male D (Standard)' }
    ],
    'en-US': [
      { value: 'en-US-Neural2-A', label: 'English Female A (Neural2)' },
      { value: 'en-US-Neural2-C', label: 'English Female C (Neural2)' },
      { value: 'en-US-Neural2-D', label: 'English Male D (Neural2)' },
      { value: 'en-US-Standard-A', label: 'English Female A (Standard)' },
      { value: 'en-US-Standard-B', label: 'English Male B (Standard)' }
    ],
    'ja-JP': [
      { value: 'ja-JP-Neural2-B', label: 'Japanese Female B (Neural2)' },
      { value: 'ja-JP-Neural2-C', label: 'Japanese Male C (Neural2)' },
      { value: 'ja-JP-Standard-A', label: 'Japanese Female A (Standard)' },
      { value: 'ja-JP-Standard-B', label: 'Japanese Female B (Standard)' }
    ],
    'zh-CN': [
      { value: 'cmn-CN-Standard-A', label: 'Chinese Female A (Standard)' },
      { value: 'cmn-CN-Standard-B', label: 'Chinese Male B (Standard)' },
      { value: 'cmn-CN-Standard-C', label: 'Chinese Male C (Standard)' }
    ]
  };

  const options = voiceOptions[language] || voiceOptions['ko-KR'];
  voiceSelect.innerHTML = options.map(opt =>
    `<option value="${opt.value}">${opt.label}</option>`
  ).join('');
}

// Update TTS speed display
function updateTtsSpeedDisplay() {
  const speed = document.getElementById('tts-speed')?.value;
  const speedValue = document.getElementById('tts-speed-value');
  if (speedValue && speed) {
    speedValue.textContent = parseFloat(speed).toFixed(1);
  }
}

// Update TTS pitch display
function updateTtsPitchDisplay() {
  const pitch = document.getElementById('tts-pitch')?.value;
  const pitchValue = document.getElementById('tts-pitch-value');
  if (pitchValue && pitch) {
    const pitchNum = parseInt(pitch);
    pitchValue.textContent = pitchNum > 0 ? `+${pitchNum}` : pitchNum;
  }
}

// Execute TTS generation
async function executeGenerateTTS() {
  // Get input values
  const text = document.getElementById('tts-text')?.value;
  const title = document.getElementById('tts-title')?.value;
  const description = document.getElementById('tts-description')?.value || '';
  const languageCode = document.getElementById('tts-language')?.value;
  const voiceName = document.getElementById('tts-voice')?.value;
  const speakingRate = parseFloat(document.getElementById('tts-speed')?.value || 1.0);
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || 0);

  // Validate inputs
  if (!text || !title) {
    alert('텍스트와 제목을 입력해주세요.');
    return;
  }

  if (text.length > 5000) {
    alert('텍스트는 최대 5000자까지 입력 가능합니다.');
    return;
  }

  try {
    // Ask user where to save the audio file
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const defaultFilename = `${sanitizedTitle}.mp3`;

    const savePath = await window.electronAPI.selectOutput(defaultFilename);

    if (!savePath) {
      console.log('[TTS] User canceled save dialog');
      return;
    }

    showProgress();
    updateProgress(10, 'Google TTS API 호출 준비 중...');
    updateStatus('TTS 음성 생성 중...');

    console.log('[TTS] Starting direct Google TTS API call...');

    // Determine gender from voice name (Korean voices)
    // Female voices: A, B, D
    // Male voices: C
    const femaleSuffixes = ['-A', '-B', '-D'];
    const maleSuffixes = ['-C'];

    let gender = 'FEMALE'; // default
    if (maleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
      gender = 'MALE';
    } else if (femaleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
      gender = 'FEMALE';
    }

    updateProgress(30, 'Google TTS API 호출 중...');

    // Direct Google API call with save path (no backend dependency)
    const directResult = await window.electronAPI.generateTtsDirect({
      text,
      title,
      languageCode,
      voiceName,
      gender,
      speakingRate,
      pitch,
      savePath  // User-selected save path
    });

    if (!directResult.success) {
      throw new Error('Google TTS API call failed: ' + (directResult.error || 'Unknown error'));
    }

    updateProgress(80, '음성 생성 완료, 파일 저장 중...');

    const audioResult = {
      title,
      voiceName,
      languageCode,
      speakingRate,
      pitch,
      audioPath: directResult.audioPath,
      filename: directResult.filename,
      fileSize: directResult.fileSize
    };

    console.log('[TTS] Direct API success:', audioResult);

    updateProgress(100, 'TTS 음성 생성 완료!');

    // Show success message with audio details
    alert(
      `TTS 음성이 성공적으로 생성되었습니다!\n\n` +
      `제목: ${audioResult.title}\n` +
      `음성: ${audioResult.voiceName}\n` +
      `언어: ${audioResult.languageCode}\n` +
      `속도: ${audioResult.speakingRate}x\n` +
      `피치: ${audioResult.pitch}\n\n` +
      `저장 위치: ${audioResult.audioPath}\n` +
      `파일명: ${audioResult.filename}\n` +
      `파일 크기: ${(audioResult.fileSize / 1024).toFixed(2)} KB`
    );

    // Clear form
    const textField = document.getElementById('tts-text');
    const titleField = document.getElementById('tts-title');

    if (textField) textField.value = '';
    if (titleField) titleField.value = '';
    updateTtsCharCount();

    updateStatus('TTS 음성 생성 완료');
    hideProgress();
  } catch (error) {
    console.error('TTS 생성 실패:', error);
    handleError('TTS 음성 생성', error, 'TTS 음성 생성에 실패했습니다.');
    hideProgress();
  }
}

// Generate TTS and upload to S3 via backend
async function executeGenerateTTSAndUpload() {
  // Get input values
  const text = document.getElementById('tts-text')?.value;
  const title = document.getElementById('tts-title')?.value;
  const description = document.getElementById('tts-description')?.value || '';
  const languageCode = 'ko-KR'; // Always Korean as per requirement
  const voiceName = document.getElementById('tts-voice')?.value;
  const speakingRate = parseFloat(document.getElementById('tts-speed')?.value || 1.0);
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || 0);

  // Validate inputs
  if (!text || !title) {
    alert('텍스트와 제목을 입력해주세요.');
    return;
  }

  if (text.length > 5000) {
    alert('텍스트는 최대 5000자까지 입력 가능합니다.');
    return;
  }

  // Check authentication
  if (!authToken || !currentUser) {
    alert('로그인이 필요합니다.\n먼저 로그인해주세요.');
    return;
  }

  try {
    showProgress();
    updateStatus('TTS 음성 업로드 준비 중...');

    console.log('[TTS Upload] Starting Google TTS generation and S3 upload...');

    // Check if we can reuse preview file (same parameters)
    let audioPath, filename;
    let reusingPreview = false;

    if (lastPreviewState &&
        lastPreviewState.text === text &&
        lastPreviewState.languageCode === languageCode &&
        lastPreviewState.voiceName === voiceName &&
        lastPreviewState.speakingRate === speakingRate &&
        lastPreviewState.pitch === pitch) {

      // Reuse preview file
      console.log('[TTS Upload] Reusing preview file (parameters unchanged)');
      audioPath = lastPreviewState.audioPath;
      filename = lastPreviewState.filename;
      reusingPreview = true;
      updateProgress(60, '미리듣기 파일 재사용 중...');

    } else {
      // Generate new TTS audio
      updateProgress(10, 'Google TTS API 호출 준비 중...');
      console.log('[TTS Upload] Generating new TTS audio (parameters changed or no preview)');

      // Determine gender from voice name (Korean voices)
      // Female voices: A, B, D
      // Male voices: C
      const femaleSuffixes = ['-A', '-B', '-D'];
      const maleSuffixes = ['-C'];

      let gender = 'FEMALE'; // default
      if (maleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
        gender = 'MALE';
      } else if (femaleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
        gender = 'FEMALE';
      }

      updateProgress(30, 'Google TTS API 호출 중...');

      // Generate TTS audio to temporary file (no save path = temp file)
      const directResult = await window.electronAPI.generateTtsDirect({
        text,
        title,
        languageCode,
        voiceName,
        gender,
        speakingRate,
        pitch,
        savePath: null  // No save path = create temp file
      });

      if (!directResult.success) {
        throw new Error('Google TTS API call failed: ' + (directResult.error || 'Unknown error'));
      }

      console.log('[TTS Upload] TTS generation successful:', directResult);
      audioPath = directResult.audioPath;
      filename = directResult.filename;
      updateProgress(60, 'S3 업로드 준비 중...');
    }

    // Read the generated file using fetch API (works with file:// protocol)
    const fileUrl = `file:///${audioPath.replace(/\\/g, '/')}`;
    const fileResponse = await fetch(fileUrl);
    const audioBlob = await fileResponse.blob();

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('title', title);
    formData.append('description', description);

    updateProgress(70, 'S3에 업로드 중...');

    // Upload to backend (TTS-specific endpoint)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/audios/upload-tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[TTS Upload] Upload successful:', uploadResult);

    updateProgress(100, 'TTS 음성 생성 및 S3 저장 완료!');

    // Show success message
    const successMessage = reusingPreview
      ? `TTS 음성이 성공적으로 S3에 저장되었습니다!\n(미리듣기 파일 재사용)\n\n`
      : `TTS 음성이 성공적으로 생성되고 S3에 저장되었습니다!\n\n`;

    alert(
      successMessage +
      `제목: ${title}\n` +
      `음성: ${voiceName}\n` +
      `설명: ${description || '(없음)'}\n` +
      `속도: ${speakingRate}x\n` +
      `피치: ${pitch}`
    );

    // Clear form
    const textField = document.getElementById('tts-text');
    const titleField = document.getElementById('tts-title');
    const descField = document.getElementById('tts-description');

    if (textField) textField.value = '';
    if (titleField) titleField.value = '';
    if (descField) descField.value = '';
    updateTtsCharCount();

    // Clear preview state after upload
    lastPreviewState = null;

    // Clean up temp file
    try {
      await window.electronAPI.deleteTempFile(audioPath);
      console.log('[TTS Upload] Temp file cleaned up');
    } catch (cleanupError) {
      console.warn('[TTS Upload] Failed to clean up temp file:', cleanupError);
    }

    updateStatus('TTS 음성 생성 및 S3 저장 완료');
    hideProgress();
  } catch (error) {
    console.error('[TTS Upload] Failed:', error);
    handleError('TTS 음성 생성 및 S3 업로드', error, 'TTS 음성 생성 및 S3 업로드에 실패했습니다.');
    hideProgress();
  }
}

// Update selected image info display
function updateSelectedImageInfo() {
  const fileInput = document.getElementById('import-image-file');
  const infoDiv = document.getElementById('selected-image-info');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (infoDiv) {
      infoDiv.innerHTML = '파일이 선택되지 않았습니다';
    }
    return;
  }

  const file = fileInput.files[0];
  const filename = file.name;
  const fileSize = (file.size / (1024 * 1024)).toFixed(2);

  if (infoDiv) {
    infoDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: #4ade80;">✓</span>
        <div style="flex: 1; overflow: hidden;">
          <div style="color: #e0e0e0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${filename}</div>
          <div style="color: #888; font-size: 12px; margin-top: 2px;">${fileSize} MB</div>
        </div>
      </div>
    `;
  }
}

// Update selected video content info display
function updateSelectedVideoContentInfo() {
  const fileInput = document.getElementById('import-video-content-file');
  const infoDiv = document.getElementById('selected-video-content-info');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (infoDiv) {
      infoDiv.innerHTML = '파일이 선택되지 않았습니다';
    }
    return;
  }

  const file = fileInput.files[0];
  const filename = file.name;
  const fileSize = (file.size / (1024 * 1024)).toFixed(2);

  if (infoDiv) {
    infoDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="color: #4ade80;">✓</span>
        <div style="flex: 1; overflow: hidden;">
          <div style="color: #e0e0e0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${filename}</div>
          <div style="color: #888; font-size: 12px; margin-top: 2px;">${fileSize} MB</div>
        </div>
      </div>
    `;
  }
}

// Upload Video Content to S3
async function uploadVideoContentToS3() {
  console.log('[Upload Video Content S3] Function called');

  // Check if user is logged in
  if (!authToken || !currentUser) {
    alert('S3에 업로드하려면 로그인이 필요합니다.');
    return;
  }

  // Get file input
  const fileInput = document.getElementById('import-video-content-file');
  const titleInput = document.getElementById('import-video-content-title');
  const descriptionInput = document.getElementById('import-video-content-description');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('영상 파일을 선택해주세요.');
    return;
  }

  const videoFile = fileInput.files[0];
  const title = titleInput ? titleInput.value.trim() : '';
  const description = descriptionInput ? descriptionInput.value.trim() : '';

  if (!title) {
    alert('제목을 입력해주세요.');
    if (titleInput) titleInput.focus();
    return;
  }

  // Ensure description is always a string (empty string if not provided)
  const finalDescription = description || '';

  // Validate video file type
  if (!videoFile.type.startsWith('video/')) {
    alert('영상 파일만 업로드할 수 있습니다.');
    return;
  }

  showProgress();
  updateProgress(0, '제목 중복 확인 중...');

  try {
    // Check for duplicate title
    console.log('[Upload Video Content S3] Checking for duplicate title:', title);
    const checkResponse = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`제목 확인 실패: ${checkResponse.status}`);
    }

    const allFiles = await checkResponse.json();
    const videoFiles = allFiles.filter(f => f.contentType && f.contentType.startsWith('video/'));
    const duplicateTitle = videoFiles.find(vid => vid.title === title);

    if (duplicateTitle) {
      hideProgress();
      alert(`같은 제목의 영상 파일이 이미 존재합니다.\n\n제목: ${title}\n\n다른 제목을 사용해주세요.`);
      if (titleInput) titleInput.focus();
      return;
    }

    updateProgress(50, 'S3에 영상 파일 업로드 중...');

    console.log('[Upload Video Content S3] Uploading to S3:', {
      title,
      description: finalDescription,
      fileName: videoFile.name,
      size: videoFile.size,
      type: videoFile.type
    });

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('title', title);
    formData.append('description', finalDescription);

    // Upload to backend
    const uploadResponse = await fetch(`${backendBaseUrl}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('[Upload Video Content S3] Upload successful:', result);

    updateProgress(100, '영상 파일 업로드 완료!');
    hideProgress();

    alert(`S3 업로드 완료!\n\n제목: ${title}\n파일명: ${videoFile.name}\n\n클라우드에 성공적으로 저장되었습니다.`);
    updateStatus(`S3 업로드 완료: ${title}`);

    // Clear input fields after successful upload
    if (fileInput) fileInput.value = '';
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
  } catch (error) {
    hideProgress();
    console.error('[Upload Video Content S3] Error:', error);
    handleError('영상 S3 업로드', error, 'S3 업로드에 실패했습니다.');
  }
}

// Upload Image to S3
async function uploadImageToS3() {
  console.log('[Upload Image S3] Function called');

  // Check if user is logged in
  if (!authToken || !currentUser) {
    alert('S3에 업로드하려면 로그인이 필요합니다.');
    return;
  }

  // Get file input
  const fileInput = document.getElementById('import-image-file');
  const titleInput = document.getElementById('import-image-title');
  const descriptionInput = document.getElementById('import-image-description');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('이미지 파일을 선택해주세요.');
    return;
  }

  const imageFile = fileInput.files[0];
  const title = titleInput ? titleInput.value.trim() : '';
  const description = descriptionInput ? descriptionInput.value.trim() : '';

  if (!title) {
    alert('제목을 입력해주세요.');
    if (titleInput) titleInput.focus();
    return;
  }

  // Ensure description is always a string (empty string if not provided)
  const finalDescription = description || '';

  // Validate image file type
  if (!imageFile.type.startsWith('image/')) {
    alert('이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  showProgress();
  updateProgress(0, '제목 중복 확인 중...');

  try {
    // Check for duplicate title
    console.log('[Upload Image S3] Checking for duplicate title:', title);
    const checkResponse = await fetch(`${backendBaseUrl}/api/videos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`제목 확인 실패: ${checkResponse.status}`);
    }

    const allFiles = await checkResponse.json();
    const imageFiles = allFiles.filter(f => f.contentType && f.contentType.startsWith('image/'));
    const duplicateTitle = imageFiles.find(img => img.title === title);

    if (duplicateTitle) {
      hideProgress();
      alert(`같은 제목의 이미지 파일이 이미 존재합니다.\n\n제목: ${title}\n\n다른 제목을 사용해주세요.`);
      if (titleInput) titleInput.focus();
      return;
    }

    updateProgress(50, 'S3에 이미지 파일 업로드 중...');

    console.log('[Upload Image S3] Uploading to S3:', {
      title,
      description: finalDescription,
      fileName: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    });

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('title', title);
    formData.append('description', finalDescription);

    // Upload to backend (videos endpoint handles all media types including images)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('[Upload Image S3] Upload successful:', result);

    updateProgress(100, '이미지 파일 업로드 완료!');
    hideProgress();

    alert(`S3 업로드 완료!\n\n제목: ${title}\n파일명: ${imageFile.name}\n\n클라우드 (images/uploads/)에 성공적으로 저장되었습니다.`);
    updateStatus(`S3 업로드 완료: ${title}`);

    // Clear input fields after successful upload
    if (fileInput) fileInput.value = '';
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
  } catch (error) {
    hideProgress();
    console.error('[Upload Image S3] Error:', error);
    handleError('이미지 S3 업로드', error, 'S3 업로드에 실패했습니다.');
  }
}

// ============================================================================
// Runway Image Generation
// ============================================================================

// Global state for reference images
let referenceImages = [null, null, null, null, null];

/**
 * Select reference image for a slot
 */
async function selectReferenceImage(slotIndex) {
  console.log(`[Runway Image] Selecting reference image for slot ${slotIndex}`);

  try {
    const filePath = await window.electronAPI.selectFile({
      title: `참조 이미지 ${slotIndex + 1} 선택`,
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ]
    });

    if (!filePath) {
      console.log('[Runway Image] No file selected');
      return;
    }

    console.log(`[Runway Image] Selected file for slot ${slotIndex}:`, filePath);

    // Store the file path
    referenceImages[slotIndex] = filePath;

    // Update UI to show preview
    const slot = document.getElementById(`ref-image-slot-${slotIndex}`);
    if (slot) {
      slot.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%;">
          <img src="file:///${filePath.replace(/\\/g, '/')}"
               style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;"/>
          <button onclick="clearReferenceImage(${slotIndex})"
                  style="position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(220, 38, 38, 0.9); color: #fff; cursor: pointer; font-size: 16px; line-height: 1; padding: 0;">
            ✕
          </button>
        </div>
      `;
    }

  } catch (error) {
    console.error('[Runway Image] Error selecting image:', error);
    alert(`이미지 선택 중 오류가 발생했습니다: ${error.message}`);
  }
}

/**
 * Clear reference image from a slot
 */
function clearReferenceImage(slotIndex) {
  console.log(`[Runway Image] Clearing reference image for slot ${slotIndex}`);

  referenceImages[slotIndex] = null;

  const slot = document.getElementById(`ref-image-slot-${slotIndex}`);
  if (slot) {
    slot.innerHTML = `<span style="font-size: 32px;">🖼️</span>`;
  }
}

/**
 * Execute Runway image generation
 */
async function executeGenerateImageRunway() {
  const prompt = document.getElementById('image-prompt-runway')?.value;
  const style = document.getElementById('image-style-runway')?.value;
  const aspectRatio = document.getElementById('image-aspect-runway')?.value;

  console.log('[Runway Image] Starting generation', { prompt, style, aspectRatio });

  // Validate inputs
  if (!prompt || prompt.trim() === '') {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  // Get selected images
  const selectedImages = referenceImages.filter(img => img !== null);

  if (selectedImages.length === 0) {
    alert('참조 이미지를 최소 1개 이상 선택해주세요.');
    return;
  }

  console.log(`[Runway Image] Found ${selectedImages.length} reference images`);

  try {
    // Disable generate button
    const generateBtn = event.target;
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = '이미지 생성 중...';
    }

    updateStatus('Runway ML API 호출 중...');

    // Call Runway ML API via main process
    const result = await window.electronAPI.generateImageRunway({
      imagePaths: selectedImages,
      prompt: prompt,
      style: style,
      aspectRatio: aspectRatio
    });

    console.log('[Runway Image] Generation started:', result);

    if (!result.success || !result.taskId) {
      throw new Error('작업 시작에 실패했습니다.');
    }

    const taskId = result.taskId;
    updateStatus(`작업 시작됨 (Task ID: ${taskId})`);

    // Poll for completion
    const imageUrl = await pollImageGeneration(taskId);

    console.log('[Runway Image] Generation completed:', imageUrl);

    // Download the generated image
    updateStatus('생성된 이미지 다운로드 중...');
    const savePath = await window.electronAPI.selectOutput(`runway-image-${Date.now()}.png`);

    if (savePath) {
      await downloadImageFromUrl(imageUrl, savePath);
      updateStatus(`이미지가 저장되었습니다: ${savePath}`);
      alert(`이미지 생성 완료!\n\n저장 위치: ${savePath}`);

      // Open the saved file location
      const path = require('path');
      await window.electronAPI.openPath(path.dirname(savePath));
    } else {
      updateStatus('이미지 생성 완료 (저장 취소됨)');
      alert('이미지 생성은 완료되었으나 저장하지 않았습니다.');
    }

  } catch (error) {
    console.error('[Runway Image] Generation failed:', error);
    updateStatus('이미지 생성 실패');
    alert(`이미지 생성 중 오류가 발생했습니다:\n\n${error.message}`);
  } finally {
    // Re-enable generate button
    const generateBtn = event.target;
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = '🎨 이미지 생성';
    }
  }
}

/**
 * Poll for image generation completion
 */
async function pollImageGeneration(taskId, maxAttempts = 60, interval = 3000) {
  console.log(`[Runway Poll] Starting to poll task ${taskId}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      updateStatus(`이미지 생성 중... (${attempt}/${maxAttempts})`);

      const taskStatus = await window.electronAPI.pollRunwayTask(taskId);

      console.log(`[Runway Poll] Attempt ${attempt}: Status = ${taskStatus.status}`);

      if (taskStatus.status === 'SUCCEEDED') {
        // Extract image URL from output
        const imageUrl = taskStatus.output?.[0] || taskStatus.output?.url;

        if (!imageUrl) {
          console.error('[Runway Poll] No image URL in output:', taskStatus.output);
          throw new Error('생성된 이미지 URL을 찾을 수 없습니다.');
        }

        console.log('[Runway Poll] Image generation succeeded:', imageUrl);
        return imageUrl;
      }

      if (taskStatus.status === 'FAILED') {
        const errorMsg = taskStatus.failure || taskStatus.failureCode || '알 수 없는 오류';
        throw new Error(`이미지 생성 실패: ${errorMsg}`);
      }

      if (taskStatus.status === 'CANCELLED') {
        throw new Error('이미지 생성이 취소되었습니다.');
      }

      // Status is PENDING or RUNNING, wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));

    } catch (error) {
      if (error.message.includes('generation')) {
        // Re-throw generation-specific errors
        throw error;
      }
      // For other errors, continue polling
      console.warn(`[Runway Poll] Poll attempt ${attempt} failed:`, error.message);
    }
  }

  throw new Error('이미지 생성 시간이 초과되었습니다.\n\n생성이 오래 걸리고 있습니다.');
}

/**
 * Download image from URL to local file
 */
async function downloadImageFromUrl(imageUrl, savePath) {
  console.log('[Runway Download] Downloading image from:', imageUrl);

  try {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const url = require('url');

    const parsedUrl = url.parse(imageUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(savePath);

      protocol.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`다운로드 실패: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('[Runway Download] Download completed:', savePath);
          resolve();
        });
      }).on('error', (error) => {
        fs.unlink(savePath, () => {}); // Delete incomplete file
        reject(error);
      });

      file.on('error', (error) => {
        fs.unlink(savePath, () => {}); // Delete incomplete file
        reject(error);
      });
    });

  } catch (error) {
    console.error('[Runway Download] Download failed:', error);
    throw new Error(`이미지 다운로드 실패: ${error.message}`);
  }
}

// Veo Image Generation
async function executeGenerateImageVeo() {
  const prompt = document.getElementById('image-prompt-veo')?.value;
  const aspect = document.getElementById('image-aspect-veo')?.value;

  if (!prompt) {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  alert('Veo 이미지 생성 기능은 곧 구현될 예정입니다.\n\n' +
        `프롬프트: ${prompt}\n` +
        `종횡비: ${aspect}\n\n` +
        '⚙️ Google Veo API 연동이 필요합니다.');

  console.log('[Veo Image] Placeholder called with:', { prompt, aspect });
}

// Runway Video Generation
async function executeGenerateVideoRunway() {
  const prompt = document.getElementById('video-prompt-runway')?.value;
  const duration = document.getElementById('video-duration-runway')?.value;
  const resolution = document.getElementById('video-resolution-runway')?.value;

  if (!prompt) {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  alert('Runway 영상 생성 기능은 곧 구현될 예정입니다.\n\n' +
        `프롬프트: ${prompt}\n` +
        `길이: ${duration}초\n` +
        `해상도: ${resolution}\n\n` +
        '⚙️ Runway ML API 연동이 필요합니다.');

  console.log('[Runway Video] Placeholder called with:', { prompt, duration, resolution });
}

// Veo Video Generation
async function executeGenerateVideoVeo() {
  const prompt = document.getElementById('video-prompt-veo')?.value;
  const duration = document.getElementById('video-duration-veo')?.value;
  const aspect = document.getElementById('video-aspect-veo')?.value;

  if (!prompt) {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  alert('Veo 영상 생성 기능은 곧 구현될 예정입니다.\n\n' +
        `프롬프트: ${prompt}\n` +
        `길이: ${duration}초\n` +
        `종횡비: ${aspect}\n\n` +
        '⚙️ Google Veo API 연동이 필요합니다.');

  console.log('[Veo Video] Placeholder called with:', { prompt, duration, aspect });
}

// Preview TTS audio before saving
let previewAudioElement = null;
let lastPreviewState = null; // Track last preview parameters and file path

async function previewTTS() {
  const text = document.getElementById('tts-text')?.value;
  const languageCode = document.getElementById('tts-language')?.value;
  const voiceName = document.getElementById('tts-voice')?.value;
  const speakingRate = parseFloat(document.getElementById('tts-speed')?.value || 1.0);
  const pitch = parseFloat(document.getElementById('tts-pitch')?.value || 0);

  // Validate inputs
  if (!text || text.trim().length === 0) {
    alert('텍스트를 입력해주세요.');
    return;
  }

  // Limit preview text length
  const previewText = text.length > 500 ? text.substring(0, 500) + '...' : text;

  if (text.length > 500) {
    console.log('[TTS Preview] Text truncated to 500 characters for preview');
  }

  try {
    console.log('[TTS Preview] Starting preview generation...');

    // Determine gender from voice name (Korean voices)
    // Female voices: A, B, D
    // Male voices: C
    const femaleSuffixes = ['-A', '-B', '-D'];
    const maleSuffixes = ['-C'];

    let gender = 'FEMALE'; // default
    if (maleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
      gender = 'MALE';
    } else if (femaleSuffixes.some(suffix => voiceName.endsWith(suffix))) {
      gender = 'FEMALE';
    }

    // Generate preview audio
    const result = await window.electronAPI.generateTtsDirect({
      text: previewText,
      title: 'preview',
      languageCode,
      voiceName,
      gender,
      speakingRate,
      pitch
    });

    if (!result.success) {
      throw new Error('Preview generation failed: ' + (result.error || 'Unknown error'));
    }

    console.log('[TTS Preview] Preview generated:', result.audioPath);

    // Store preview state for reuse
    lastPreviewState = {
      text,
      languageCode,
      voiceName,
      speakingRate,
      pitch,
      audioPath: result.audioPath,
      filename: result.filename
    };

    // Stop any existing preview
    if (previewAudioElement) {
      previewAudioElement.pause();
      previewAudioElement.src = '';
    }

    // Create and play audio element with file:// protocol
    const audioUrl = `file:///${result.audioPath.replace(/\\/g, '/')}`;
    console.log('[TTS Preview] Audio URL:', audioUrl);
    previewAudioElement = new Audio(audioUrl);

    previewAudioElement.onended = () => {
      console.log('[TTS Preview] Playback ended');
    };

    previewAudioElement.onerror = (error) => {
      console.error('[TTS Preview] Playback error:', error);
      alert('미리듣기 재생 중 오류가 발생했습니다.');
    };

    await previewAudioElement.play();
    console.log('[TTS Preview] Playing preview audio');

    alert('미리듣기 재생 중입니다.');

  } catch (error) {
    console.error('[TTS Preview] Preview failed:', error);
    alert('미리듣기 생성에 실패했습니다.\n\n' + error.message);
  }
}

// ============================================================================
// Backend Authentication System
// ============================================================================

// Global authentication state
let authToken = null;
let currentUser = null;
let backendBaseUrl = 'http://localhost:8080';
let selectedServerType = 'local'; // 'local', 'dev', 'custom'

// Server configurations
const SERVER_URLS = {
  local: 'http://localhost:8080',
  dev: 'http://kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com'
};

/**
 * Initialize authentication UI
 */
function initializeAuth() {
  console.log('[Auth] Initializing authentication UI');

  const logoutBtn = document.getElementById('logout-btn');

  // Logout button click
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  // Check for saved auth token
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('currentUser');
  const savedBackendUrl = localStorage.getItem('backendUrl');
  const savedServerType = localStorage.getItem('serverType');

  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    backendBaseUrl = savedBackendUrl || 'http://localhost:8080';
    selectedServerType = savedServerType || 'local';
    updateAuthUI();
    console.log('[Auth] Restored session from localStorage');
  } else {
    // Show login modal on startup if not logged in
    showLoginModal();
  }
}

/**
 * Select server type
 */
function selectServer(serverType) {
  console.log('[Auth] Server selected:', serverType);
  selectedServerType = serverType;

  const backendUrlInput = document.getElementById('backend-url');
  const localBtn = document.getElementById('server-local-btn');
  const devBtn = document.getElementById('server-dev-btn');
  const customBtn = document.getElementById('server-custom-btn');

  // Update button styles
  [localBtn, devBtn, customBtn].forEach(btn => {
    if (btn) btn.style.background = '#444';
  });

  if (serverType === 'local') {
    if (localBtn) localBtn.style.background = '#667eea';
    if (backendUrlInput) {
      backendUrlInput.value = SERVER_URLS.local;
      backendUrlInput.readOnly = true;
    }
  } else if (serverType === 'dev') {
    if (devBtn) devBtn.style.background = '#667eea';
    if (backendUrlInput) {
      backendUrlInput.value = SERVER_URLS.dev;
      backendUrlInput.readOnly = true;
    }
  } else if (serverType === 'custom') {
    if (customBtn) customBtn.style.background = '#667eea';
    if (backendUrlInput) {
      backendUrlInput.readOnly = false;
      backendUrlInput.focus();
    }
  }
}

// Make selectServer globally accessible
window.selectServer = selectServer;

/**
 * Show login modal
 */
function showLoginModal() {
  const modal = document.getElementById('login-modal');
  const errorDiv = document.getElementById('login-error');

  if (modal) {
    modal.style.display = 'flex';
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    // Initialize server selection
    const savedServerType = localStorage.getItem('serverType') || 'local';
    selectServer(savedServerType);
  }
}

/**
 * Hide login modal
 */
function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Handle login form submission
 */
async function handleLogin() {
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  const backendUrl = document.getElementById('backend-url')?.value;
  const errorDiv = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  // Validate inputs
  if (!email || !password) {
    showLoginError('이메일과 비밀번호를 입력해주세요.');
    return;
  }

  if (!backendUrl) {
    showLoginError('백엔드 서버 URL을 입력해주세요.');
    return;
  }

  try {
    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '로그인 중...';
    }

    console.log('[Auth] Attempting login:', { email, backendUrl });

    // Call backend login API
    const result = await window.electronAPI.backendLogin({
      email,
      password,
      backendUrl
    });

    console.log('[Auth] Login successful');

    // Save auth state
    authToken = result.token;
    currentUser = result.user;
    backendBaseUrl = backendUrl;

    // Save to localStorage
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('backendUrl', backendBaseUrl);
    localStorage.setItem('serverType', selectedServerType);

    // Update UI
    updateAuthUI();
    hideLoginModal();

    // Clear form
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';

    updateStatus(`로그인 성공: ${currentUser.email}`);

  } catch (error) {
    console.error('[Auth] Login failed:', error);
    showLoginError(error.message);
  } finally {
    // Re-enable submit button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '로그인';
    }
  }
}

/**
 * Show login error message
 */
function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Make handleLogin globally accessible
window.handleLogin = handleLogin;

// Make executeGenerateTTSAndUpload globally accessible
window.executeGenerateTTSAndUpload = executeGenerateTTSAndUpload;

// ============================================================================
// Audio File Upload to S3
// ============================================================================

// Global variable to store selected audio file path
let selectedAudioFilePath = null;

/**
 * Select audio file for upload
 */
async function selectAudioFileForUpload() {
  try {
    const audioPath = await window.electronAPI.selectAudio();

    if (!audioPath) {
      console.log('[Audio Upload] No file selected');
      return;
    }

    selectedAudioFilePath = audioPath;
    console.log('[Audio Upload] File selected:', audioPath);

    // Extract filename from path
    const filename = audioPath.split(/[/\\]/).pop();

    // Update UI to show selected file
    const infoDiv = document.getElementById('selected-audio-info');
    if (infoDiv) {
      infoDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #4ade80;">✓</span>
          <span style="color: #e0e0e0;">${filename}</span>
        </div>
      `;
    }

    // Auto-fill title with filename (without extension)
    const titleInput = document.getElementById('audio-upload-title');
    if (titleInput && !titleInput.value) {
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      titleInput.value = nameWithoutExt;
    }

  } catch (error) {
    console.error('[Audio Upload] File selection error:', error);
    alert('파일 선택 중 오류가 발생했습니다.');
  }
}

/**
 * Upload selected audio file to S3
 */
async function uploadAudioToS3() {
  const title = document.getElementById('audio-upload-title')?.value;
  const description = document.getElementById('audio-upload-description')?.value || '';

  // Validate inputs
  if (!selectedAudioFilePath) {
    alert('먼저 음성 파일을 선택해주세요.');
    return;
  }

  if (!title || title.trim().length === 0) {
    alert('제목을 입력해주세요.');
    return;
  }

  // Check authentication
  if (!authToken || !currentUser) {
    alert('로그인이 필요합니다.\n먼저 로그인해주세요.');
    return;
  }

  try {
    showProgress();
    updateProgress(20, '파일 읽는 중...');
    updateStatus('음성 파일 업로드 준비 중...');

    console.log('[Audio Upload] Starting upload:', selectedAudioFilePath);

    // Read the audio file using fetch API
    const fileUrl = `file:///${selectedAudioFilePath.replace(/\\/g, '/')}`;
    const fileResponse = await fetch(fileUrl);
    const audioBlob = await fileResponse.blob();

    const filename = selectedAudioFilePath.split(/[/\\]/).pop();

    updateProgress(50, 'S3에 업로드 중...');

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('title', title);
    formData.append('description', description);

    // Upload to backend (audios/uploads folder)
    const uploadResponse = await fetch(`${backendBaseUrl}/api/audios/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[Audio Upload] Upload successful:', uploadResult);

    updateProgress(100, '음성 파일 업로드 완료!');

    // Show success message
    alert(
      `음성 파일이 성공적으로 S3에 업로드되었습니다!\n\n` +
      `제목: ${title}\n` +
      `설명: ${description || '(없음)'}\n` +
      `파일: ${filename}`
    );

    // Clear form and selected file
    selectedAudioFilePath = null;
    const titleInput = document.getElementById('audio-upload-title');
    const descInput = document.getElementById('audio-upload-description');
    const infoDiv = document.getElementById('selected-audio-info');

    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (infoDiv) {
      infoDiv.innerHTML = '파일이 선택되지 않았습니다';
      infoDiv.style.color = '#aaa';
    }

    updateStatus('음성 파일 업로드 완료');
    hideProgress();

  } catch (error) {
    console.error('[Audio Upload] Upload failed:', error);
    handleError('음성 파일 업로드', error, '음성 파일 업로드에 실패했습니다.');
    hideProgress();
  }
}

// Make functions globally accessible
window.selectAudioFileForUpload = selectAudioFileForUpload;
window.uploadAudioToS3 = uploadAudioToS3;

/**
 * Logout
 */
function logout() {
  console.log('[Auth] Logging out');

  // Clear auth state
  authToken = null;
  currentUser = null;

  // Clear localStorage
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');

  // Update UI
  updateAuthUI();
  updateStatus('로그아웃되었습니다.');

  // Show login modal
  showLoginModal();
}

/**
 * Update authentication UI
 */
function updateAuthUI() {
  const modeSwitchContainer = document.getElementById('mode-switch-container');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');
  const mainContent = document.getElementById('main-content');

  if (authToken && currentUser) {
    // Logged in state
    if (modeSwitchContainer) modeSwitchContainer.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'block';
    if (userEmail) userEmail.textContent = currentUser.name || currentUser.email;
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (mainContent) mainContent.style.display = 'flex';
  } else {
    // Logged out state
    if (modeSwitchContainer) modeSwitchContainer.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
  }
}

/**
 * Get current auth token
 */
function getAuthToken() {
  return authToken;
}

/**
 * Get backend base URL
 */
function getBackendUrl() {
  return backendBaseUrl;
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeAuth();
});
