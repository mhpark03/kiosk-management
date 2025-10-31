
// ============================================================================
// Backend Authentication System
// ============================================================================

// Global authentication state
let authToken = null;
let currentUser = null;
let backendBaseUrl = 'http://localhost:8080';

/**
 * Initialize authentication UI
 */
function initializeAuth() {
  console.log('[Auth] Initializing authentication UI');

  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginModal = document.getElementById('login-modal');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const loginCancelBtn = document.getElementById('login-cancel-btn');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');

  // Login button click
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      showLoginModal();
    });
  }

  // Logout button click
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  // Login submit
  if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener('click', async () => {
      await handleLogin();
    });
  }

  // Login cancel
  if (loginCancelBtn) {
    loginCancelBtn.addEventListener('click', () => {
      hideLoginModal();
    });
  }

  // Enter key in password field
  if (loginPasswordInput) {
    loginPasswordInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await handleLogin();
      }
    });
  }

  // Close modal on background click
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) {
        hideLoginModal();
      }
    });
  }

  // Check for saved auth token
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('currentUser');
  const savedBackendUrl = localStorage.getItem('backendUrl');

  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    backendBaseUrl = savedBackendUrl || 'http://localhost:8080';
    updateAuthUI();
    console.log('[Auth] Restored session from localStorage');
  }
}

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

    // Load saved backend URL
    const savedUrl = localStorage.getItem('backendUrl');
    const backendUrlInput = document.getElementById('backend-url');
    if (backendUrlInput && savedUrl) {
      backendUrlInput.value = savedUrl;
    }
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
}

/**
 * Update authentication UI
 */
function updateAuthUI() {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');

  if (authToken && currentUser) {
    // Logged in state
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'block';
    if (userEmail) userEmail.textContent = currentUser.email;
  } else {
    // Logged out state
    if (loginBtn) loginBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
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

