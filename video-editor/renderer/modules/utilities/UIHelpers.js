/**
 * UIHelpers.js
 * UI 관련 헬퍼 함수들 (다이얼로그, 진행 상태, 상태 업데이트 등)
 *
 * @module UIHelpers
 */

// ============================================================================
// Error Handling
// ============================================================================

/**
 * 공통 오류 처리 함수
 * @param {string} operation - 작업 이름
 * @param {Error} error - 에러 객체
 * @param {string} userMessage - 사용자에게 표시할 메시지
 */
export function handleError(operation, error, userMessage) {
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

// ============================================================================
// Dialog Management
// ============================================================================

/**
 * Custom dialog that doesn't break input focus
 * @param {string} message - 표시할 메시지
 */
export function showCustomDialog(message) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  if (!overlay || !content) {
    console.warn('[UIHelpers] Modal elements not found, falling back to alert');
    alert(message);
    return;
  }

  content.innerHTML = `
    <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; max-width: 500px; color: #e0e0e0;">
      <p style="margin: 0 0 20px 0; white-space: pre-wrap; line-height: 1.5;">${message}</p>
      <button onclick="window.closeCustomDialog()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">확인</button>
    </div>
  `;

  overlay.style.display = 'flex';
}

/**
 * Close custom dialog
 */
export function closeCustomDialog() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ============================================================================
// Progress Display
// ============================================================================

/**
 * Show progress overlay
 */
export function showProgress() {
  const progressOverlay = document.getElementById('progress-overlay');
  if (progressOverlay) {
    progressOverlay.style.display = 'flex';
  }
}

/**
 * Hide progress overlay
 */
export function hideProgress() {
  const progressOverlay = document.getElementById('progress-overlay');
  if (progressOverlay) {
    progressOverlay.style.display = 'none';
  }
}

/**
 * Update progress display
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} message - Progress message
 */
export function updateProgress(percent, message) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const progressPercentage = document.getElementById('progress-percentage');

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  if (progressText) {
    progressText.textContent = message || '';
  }

  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(percent)}%`;
  }
}

// ============================================================================
// Status Bar
// ============================================================================

/**
 * Update status bar message
 * @param {string} message - Status message
 */
export function updateStatus(message) {
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.textContent = message;
  }
  console.log('[Status]', message);
}

// ============================================================================
// Export Dialog
// ============================================================================

/**
 * Open file save dialog
 * @param {string} defaultFilename - Default filename
 * @param {string} defaultExtension - Default file extension
 * @returns {Promise<string|null>} Selected file path or null
 */
export async function openSaveDialog(defaultFilename, defaultExtension = 'mp4') {
  try {
    const savePath = await window.electronAPI.saveFile({
      defaultPath: defaultFilename,
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv'] },
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    return savePath;
  } catch (error) {
    console.error('[UIHelpers] Save dialog error:', error);
    return null;
  }
}

// ============================================================================
// Confirmation Dialogs
// ============================================================================

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @returns {boolean} True if confirmed, false otherwise
 */
export function confirmAction(message) {
  return confirm(message);
}

/**
 * Show alert dialog
 * @param {string} message - Alert message
 */
export function showAlert(message) {
  alert(message);
}

// ============================================================================
// Tool Properties Panel
// ============================================================================

/**
 * Clear tool properties panel
 */
export function clearToolProperties() {
  const propertiesPanel = document.getElementById('tool-properties');
  if (propertiesPanel) {
    propertiesPanel.innerHTML = '<p class="placeholder-text">편집 도구를 선택하세요</p>';
  }
}

/**
 * Set tool properties HTML content
 * @param {string} html - HTML content
 */
export function setToolPropertiesHTML(html) {
  const propertiesPanel = document.getElementById('tool-properties');
  if (propertiesPanel) {
    propertiesPanel.innerHTML = html;
  }
}

// ============================================================================
// Loading Indicators
// ============================================================================

/**
 * Show loading spinner
 * @param {string} elementId - Element ID to show spinner in
 */
export function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '<div class="spinner">로딩 중...</div>';
  }
}

/**
 * Hide loading spinner
 * @param {string} elementId - Element ID to hide spinner from
 */
export function hideLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '';
  }
}

// ============================================================================
// Toast Notifications (Optional Enhancement)
// ============================================================================

/**
 * Show toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type ('success', 'error', 'info', 'warning')
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast element if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    min-width: 200px;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  }, duration);
}

// ============================================================================
// Modal Management
// ============================================================================

/**
 * Show modal by ID
 * @param {string} modalId - Modal element ID
 */
export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * Hide modal by ID
 * @param {string} modalId - Modal element ID
 */
export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// ============================================================================
// Exports for Window (for backwards compatibility)
// ============================================================================

// Make closeCustomDialog global for onclick handlers
if (typeof window !== 'undefined') {
  window.closeCustomDialog = closeCustomDialog;
}
