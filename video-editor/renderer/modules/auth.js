/**
 * Authentication Module
 * Handles user login, logout, and authentication state management
 */

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
export function initializeAuth() {
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
    const user = JSON.parse(savedUser);

    // Check if saved user is ADMIN
    if (user.role !== 'ADMIN') {
      console.warn('[Auth] Non-admin user found in localStorage, logging out');
      // Clear non-admin user data
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('backendUrl');
      localStorage.removeItem('serverType');
      showLoginModal();
      return;
    }

    authToken = savedToken;
    currentUser = user;
    backendBaseUrl = savedBackendUrl || 'http://localhost:8080';
    selectedServerType = savedServerType || 'local';
    updateAuthUI();
    console.log('[Auth] Restored admin session from localStorage');
  } else {
    // Show login modal on startup if not logged in
    showLoginModal();
  }
}

/**
 * Select server type
 * @param {string} serverType - 'local', 'dev', or 'custom'
 */
export function selectServer(serverType) {
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

/**
 * Show login modal
 */
export function showLoginModal() {
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
export function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Handle login form submission
 */
export async function handleLogin() {
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

    // Check if user is ADMIN
    if (!result.user || result.user.role !== 'ADMIN') {
      console.error('[Auth] Non-admin user attempted login:', result.user);
      showLoginError('관리자 계정만 비디오 에디터에 로그인할 수 있습니다.');
      return;
    }

    console.log('[Auth] Admin user verified');

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

    // Update status (requires external function)
    if (typeof window.updateStatus === 'function') {
      window.updateStatus(`로그인 성공: ${currentUser.email}`);
    }

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
 * @param {string} message - Error message to display
 */
function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

/**
 * Logout
 */
export function logout() {
  console.log('[Auth] Logging out');

  // Clear auth state
  authToken = null;
  currentUser = null;

  // Clear localStorage
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');

  // Update UI
  updateAuthUI();

  // Update status (requires external function)
  if (typeof window.updateStatus === 'function') {
    window.updateStatus('로그아웃되었습니다.');
  }

  // Show login modal
  showLoginModal();
}

/**
 * Update authentication UI
 */
export function updateAuthUI() {
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

    // Re-setup mode buttons after showing them
    if (typeof window.setupModeButtons === 'function') {
      window.setupModeButtons();
      console.log('[Auth] Mode buttons re-setup after login');
    }
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
 * @returns {string|null} - Current authentication token
 */
export function getAuthToken() {
  return authToken;
}

/**
 * Get current user
 * @returns {object|null} - Current user object
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get backend base URL
 * @returns {string} - Backend base URL
 */
export function getBackendUrl() {
  return backendBaseUrl;
}

/**
 * Check if user is authenticated
 * @returns {boolean} - True if authenticated
 */
export function isAuthenticated() {
  return authToken !== null && currentUser !== null;
}
