// DOM elements
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const customServerInput = document.getElementById('custom-server-input');
const customUrlInput = document.getElementById('custom-url');

// Server radio buttons
const serverRadios = document.querySelectorAll('input[name="server"]');

// Show/hide custom server input
serverRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customServerInput.classList.add('show');
    } else {
      customServerInput.classList.remove('show');
    }
  });
});

// Get selected server URL
function getServerUrl() {
  const selectedServer = document.querySelector('input[name="server"]:checked').value;

  switch (selectedServer) {
    case 'local':
      return 'http://localhost:8080/api';
    case 'aws':
      return 'http://kiosk-backend-env.eba-jmvpmpzx.ap-northeast-2.elasticbeanstalk.com/api';
    case 'custom':
      const customUrl = customUrlInput.value.trim();
      if (!customUrl) {
        throw new Error('커스텀 URL을 입력해주세요.');
      }
      return customUrl.endsWith('/api') ? customUrl : `${customUrl}/api`;
    default:
      return 'http://localhost:8080/api';
  }
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

// Set loading state
function setLoading(loading) {
  if (loading) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading-spinner"></span>로그인 중...';
    emailInput.disabled = true;
    passwordInput.disabled = true;
  } else {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '로그인';
    emailInput.disabled = false;
    passwordInput.disabled = false;
  }
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('이메일과 비밀번호를 모두 입력해주세요.');
    return;
  }

  try {
    setLoading(true);
    const serverUrl = getServerUrl();

    // Call login API through Electron
    const result = await window.electronAPI.login({
      email,
      password,
      serverUrl
    });

    if (result.success) {
      // Login successful - Electron will handle window transition
      console.log('Login successful:', result.user);
    } else {
      showError(result.error || '로그인에 실패했습니다.');
      setLoading(false);
    }
  } catch (error) {
    console.error('Login error:', error);
    showError(error.message || '로그인 중 오류가 발생했습니다.');
    setLoading(false);
  }
});

// Auto-focus email input
emailInput.focus();

// Load saved server preference
window.electronAPI.getSavedServerUrl().then(savedUrl => {
  if (savedUrl) {
    if (savedUrl.includes('localhost')) {
      document.getElementById('server-local').checked = true;
    } else if (savedUrl.includes('elasticbeanstalk')) {
      document.getElementById('server-aws').checked = true;
    } else {
      document.getElementById('server-custom').checked = true;
      customUrlInput.value = savedUrl;
      customServerInput.classList.add('show');
    }
  }
});

// Listen for login errors from main process
window.electronAPI.onLoginError((error) => {
  showError(error);
  setLoading(false);
});
