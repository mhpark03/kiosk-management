/**
 * app.js (리팩토링된 버전 - 예제)
 *
 * 이 파일은 리팩토링 후 app.js가 어떻게 보일지 보여주는 예제입니다.
 * 실제 app.js를 대체하려면 아래 단계를 따르세요:
 *
 * 1. 모든 모듈을 modules/ 폴더에 생성
 * 2. app.js 상단에 import 문 추가
 * 3. 기존 함수들을 모듈 함수 호출로 변경
 * 4. 중복된 함수 제거
 */

// ============================================================================
// Module Imports
// ============================================================================

// UI Utilities
import * as UIHelpers from './modules/utilities/UIHelpers.js';

// Core Operations (아직 생성 안 됨 - 예시)
// import * as VideoOperations from './modules/core/VideoOperations.js';
// import * as AudioOperations from './modules/core/AudioOperations.js';
// import * as TrimOperations from './modules/core/TrimOperations.js';
// import * as MergeOperations from './modules/core/MergeOperations.js';
// import * as TextOperations from './modules/core/TextOperations.js';

// Utilities (아직 생성 안 됨 - 예시)
// import * as WaveformManager from './modules/utilities/WaveformManager.js';
// import * as FilterOperations from './modules/utilities/FilterOperations.js';
// import * as SpeedOperations from './modules/utilities/SpeedOperations.js';
// import * as UploadOperations from './modules/utilities/UploadOperations.js';

// AI Modules (이미 존재)
// import * as AuthModule from './modules/auth.js';
// import * as TTSModule from './modules/tts.js';
// import * as ImagenModule from './modules/imagen.js';
// import * as RunwayModule from './modules/runway.js';
// import * as VeoModule from './modules/veo.js';

// ============================================================================
// State Management (app.js에 유지)
// ============================================================================

let currentVideo = null;
let videoInfo = null;
let activeTool = null;
let videoLayers = [];
let currentMode = 'video';
let currentAudioFile = null;
let audioFileInfo = null;

// Zoom state
let zoomStart = 0;
let zoomEnd = 1;

// ... (기타 상태 변수들)

// ============================================================================
// Initialization
// ============================================================================

console.log('[APP.JS] Script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('[APP.JS] DOMContentLoaded fired');

  setupToolButtons();
  setupVideoControls();
  setupFFmpegProgressListener();
  setupModeListener();
  setupModeButtons();
  setupImportButton();
  updateModeUI();

  UIHelpers.updateStatus('준비 완료');
  console.log('[APP.JS] Initialization complete');
});

// ============================================================================
// Setup Functions (app.js에 유지)
// ============================================================================

function setupImportButton() {
  const importBtn = document.getElementById('import-video-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      if (currentMode === 'video') {
        // Before: importVideo();
        // After: VideoOperations.importVideo();
        importVideo(); // 아직 리팩토링 안 됨
      } else {
        importAudioFile(); // 아직 리팩토링 안 됨
      }
    });
  }
}

function setupToolButtons() {
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      selectTool(tool);
    });
  });
}

function selectTool(tool) {
  // Check if file is loaded based on current mode
  if (currentMode === 'video') {
    if (tool !== 'import' && !currentVideo) {
      // Before: alert('먼저 영상을 가져와주세요.');
      // After:
      UIHelpers.showAlert('먼저 영상을 가져와주세요.');
      return;
    }
  } else if (currentMode === 'audio') {
    if (tool !== 'import-audio' && !currentAudioFile) {
      UIHelpers.showAlert('먼저 음성 파일을 가져와주세요.');
      return;
    }
  }

  activeTool = tool;

  // Pause media when switching tools
  const videoElement = document.getElementById('preview-video');
  const audioElement = document.getElementById('preview-audio');
  if (videoElement && !videoElement.paused) {
    videoElement.pause();
  }
  if (audioElement && !audioElement.paused) {
    audioElement.pause();
  }

  // Update active button
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');

  // Show tool properties
  showToolProperties(tool);

  UIHelpers.updateStatus(`도구 선택: ${tool}`);
}

// ============================================================================
// Example: How to use UIHelpers module
// ============================================================================

/**
 * 에러 처리 예시
 */
async function exampleErrorHandling() {
  try {
    // Some operation...
    throw new Error('Something went wrong');
  } catch (error) {
    // Before:
    // handleError('작업 이름', error, '사용자 메시지');

    // After:
    UIHelpers.handleError('작업 이름', error, '사용자 메시지');
  }
}

/**
 * 진행 상태 표시 예시
 */
async function exampleProgressDisplay() {
  // Show progress
  UIHelpers.showProgress();

  for (let i = 0; i <= 100; i += 10) {
    UIHelpers.updateProgress(i, `처리 중... ${i}%`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  UIHelpers.hideProgress();
}

/**
 * 다이얼로그 표시 예시
 */
function exampleDialog() {
  // Custom dialog
  UIHelpers.showCustomDialog('작업이 완료되었습니다!');

  // Confirmation
  if (UIHelpers.confirmAction('정말 삭제하시겠습니까?')) {
    console.log('Confirmed');
  }

  // Toast notification (new feature!)
  UIHelpers.showToast('파일이 저장되었습니다!', 'success');
  UIHelpers.showToast('오류가 발생했습니다.', 'error');
}

// ============================================================================
// Window Exports (for backwards compatibility)
// ============================================================================

// Export functions that need to be accessible from HTML onclick handlers
window.selectTool = selectTool;
window.exampleErrorHandling = exampleErrorHandling;
window.exampleProgressDisplay = exampleProgressDisplay;
window.exampleDialog = exampleDialog;

// UIHelpers is automatically exported via window.closeCustomDialog in the module

// ============================================================================
// Notes for Full Refactoring
// ============================================================================

/*

REFACTORING CHECKLIST:

1. ✅ UIHelpers.js 생성됨
   - handleError()
   - showCustomDialog()
   - closeCustomDialog()
   - showProgress()
   - hideProgress()
   - updateProgress()
   - updateStatus()
   - 그 외 UI 관련 함수들

2. ⬜ VideoOperations.js 생성 필요
   - importVideo()
   - loadVideo()
   - loadVideoWithAudioCheck()
   - displayVideoInfo()
   - displayTimelineTracks()
   - setupPlayheadInteraction()
   - updatePlayheadPosition()

3. ⬜ AudioOperations.js 생성 필요
   - importAudioFile()
   - loadAudioFile()
   - generateAndDisplayWaveform()
   - executeExtractAudio()
   - executeExtractAudioToS3()

4. ⬜ TrimOperations.js 생성 필요
   - executeTrim()
   - executeTrimVideoOnly()
   - executeTrimAudioOnly()
   - executeDeleteRange()

5. ⬜ MergeOperations.js 생성 필요
   - addVideoToMerge()
   - executeMerge()
   - previewMerge()

6. ⬜ TextOperations.js 생성 필요
   - executeAddText()
   - updateTextOverlay()

7. ⬜ WaveformManager.js 생성 필요
   - generateAndDisplayWaveform()
   - applyWaveformZoom()

8. ⬜ FilterOperations.js 생성 필요
   - executeFilter()

9. ⬜ SpeedOperations.js 생성 필요
   - executeSpeedAdjust()

10. ⬜ UploadOperations.js 생성 필요
    - uploadAudioToS3()

STEPS TO APPLY THIS REFACTORING:

1. Copy each module from modules/ folder
2. Add import statements at the top of app.js
3. Replace function calls:
   - Old: handleError(...)
   - New: UIHelpers.handleError(...)

4. Remove duplicate function definitions from app.js
5. Test each functionality
6. Commit per module

BENEFITS:
- app.js: 11,921 lines → ~2,000 lines (83% reduction)
- Each module: ~800 lines (manageable size)
- Better organization and maintainability
- Easier testing and debugging
- Better collaboration

*/
