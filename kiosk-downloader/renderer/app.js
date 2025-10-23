// Server URL constants
const SERVER_URLS = {
  local: 'http://localhost:8080/api',
  aws: 'http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api'
};

// Application state
let config = null;
let videos = [];
let currentFilter = 'all';
let autoSyncInterval = null;
let autoSyncDebounceTimer = null;
let isOnline = true;
let authToken = null;
let currentUser = null;

// DOM elements
const elements = {
  apiUrl: document.getElementById('api-url'),
  storeId: document.getElementById('store-id'),
  kioskId: document.getElementById('kiosk-id'),
  downloadPath: document.getElementById('download-path'),
  autoSync: document.getElementById('auto-sync'),
  syncInterval: document.getElementById('sync-interval'),
  serverRadios: document.querySelectorAll('input[name="server"]'),
  saveConfigBtn: document.getElementById('save-config-btn'),
  deleteConfigBtn: document.getElementById('delete-config-btn'),
  testConnectionBtn: document.getElementById('test-connection-btn'),
  selectPathBtn: document.getElementById('select-path-btn'),
  syncBtn: document.getElementById('sync-btn'),
  videoList: document.getElementById('video-list'),
  connectionStatus: document.getElementById('connection-status'),
  lastSync: document.getElementById('last-sync'),
  totalVideos: document.getElementById('total-videos'),
  downloadedVideos: document.getElementById('downloaded-videos'),
  pendingVideos: document.getElementById('pending-videos'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingMessage: document.getElementById('loading-message'),
  offlineMode: document.getElementById('offline-mode'),
  loginModal: document.getElementById('login-modal'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginSubmitBtn: document.getElementById('login-submit-btn'),
  loginSkipBtn: document.getElementById('login-skip-btn'),
  loginError: document.getElementById('login-error'),
  userInfo: document.getElementById('user-info'),
  loginHeaderBtn: document.getElementById('login-header-btn'),
  logoutBtn: document.getElementById('logout-btn')
};

// Initialize app
async function initialize() {
  console.log('Initializing Kiosk Video Downloader...');

  // Explicitly enable all input fields
  elements.apiUrl.readOnly = false;
  elements.apiUrl.disabled = false;
  elements.storeId.readOnly = false;
  elements.storeId.disabled = false;
  elements.kioskId.readOnly = false;
  elements.kioskId.disabled = false;
  elements.downloadPath.readOnly = false;
  elements.downloadPath.disabled = false;

  // Setup event listeners FIRST
  setupEventListeners();

  // Load config
  config = await window.electronAPI.getConfig();
  if (config) {
    elements.apiUrl.value = config.apiUrl || '';
    elements.storeId.value = config.posId || '';
    elements.kioskId.value = config.kioskId || '';
    elements.downloadPath.value = config.downloadPath || '';
    elements.autoSync.checked = config.autoSync || false;
    elements.syncInterval.value = config.syncInterval || 12;

    // Set the correct server radio button based on saved API URL
    const apiUrl = config.apiUrl || '';
    if (apiUrl === SERVER_URLS.local) {
      document.querySelector('input[name="server"][value="local"]').checked = true;
    } else if (apiUrl === SERVER_URLS.aws) {
      document.querySelector('input[name="server"][value="aws"]').checked = true;
    } else {
      document.querySelector('input[name="server"][value="custom"]').checked = true;
    }

    if (config.lastSync) {
      updateLastSyncTime(new Date(config.lastSync));
    }


    // Auto-sync if enabled (works with or without login)
    if (config.autoSync && config.apiUrl && config.kioskId) {
      startAutoSync();
    }
  }

  // Explicitly enable all input fields AGAIN after loading config
  elements.apiUrl.readOnly = false;
  elements.apiUrl.disabled = false;
  elements.storeId.readOnly = false;
  elements.storeId.disabled = false;
  elements.kioskId.readOnly = false;
  elements.kioskId.disabled = false;
  elements.downloadPath.readOnly = false;
  elements.downloadPath.disabled = false;

  // Update save/delete button based on config state
  const configExists = await window.electronAPI.checkConfigExists();
  if (configExists) {
    elements.saveConfigBtn.textContent = '설정 수정';
    elements.deleteConfigBtn.disabled = false;

  } else {
    elements.saveConfigBtn.textContent = '설정 저장';
    elements.deleteConfigBtn.disabled = true;
  }

  console.log('App initialized');
  // Record app start event (only if config exists)
  if (config && config.kioskId && config.apiUrl) {
    recordKioskEvent('APP_START', 'AiOZ App 시작');
  }
}

// Setup event listeners
function setupEventListeners() {
  elements.saveConfigBtn.addEventListener('click', saveConfig);
  elements.deleteConfigBtn.addEventListener('click', deleteConfig);
  elements.testConnectionBtn.addEventListener('click', testConnection);
  elements.selectPathBtn.addEventListener('click', selectDownloadPath);
  elements.syncBtn.addEventListener('click', () => syncVideos());

  // Server selection change
  elements.serverRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const selectedServer = e.target.value;

      if (selectedServer === 'custom') {
        // Enable manual input for custom server
        elements.apiUrl.focus();
      } else {
        // Use predefined server URL
        elements.apiUrl.value = SERVER_URLS[selectedServer];
      }
    });
  });

  // Filter change
  document.querySelectorAll('input[name="filter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      renderVideoList();
    });
  });

  // Auto-sync toggle
  elements.autoSync.addEventListener('change', (e) => {
    if (e.target.checked) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
  });

  // Sync interval change - removed auto-save, will save when user clicks save button

  // Download progress listener
  window.electronAPI.onDownloadProgress(handleDownloadProgress);

  // Login/logout event listeners
  elements.loginSubmitBtn.addEventListener('click', handleLogin);
  elements.loginSkipBtn.addEventListener('click', () => {
    hideLoginModal();
    console.log('Login skipped');
  });
  elements.loginHeaderBtn.addEventListener('click', () => {
    showLoginModal();
  });
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Enter key login
  elements.loginEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
  elements.loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
}

// Update input fields based on config state
async function updateConfigButton() {
  const configExists = await window.electronAPI.checkConfigExists();

  if (configExists) {
    // Config exists -> Change button text and enable delete
    elements.saveConfigBtn.textContent = '설정 수정';
    elements.deleteConfigBtn.disabled = false;
  } else {
    // No config -> Change button text and disable delete
    elements.saveConfigBtn.textContent = '설정 저장';
    elements.deleteConfigBtn.disabled = true;
  }
}

// Delete configuration
async function deleteConfig() {
  // 로그인 체크
  if (!authToken) {
    // alert 대신 바로 로그인 모달 표시
    showLoginModal();
    return;
  }

  if (!confirm('설정을 삭제하시겠습니까? 저장된 키오스크 ID와 모든 설정이 초기화됩니다.')) {
    return;
  }

  showLoading('설정 삭제 중...');

  // Save old config for event recording
  const oldConfig = config;

  const result = await window.electronAPI.deleteConfig();

  if (result.success) {
    // Record event BEFORE updating config
    if (oldConfig && oldConfig.apiUrl && oldConfig.kioskId) {
      await fetch(`${oldConfig.apiUrl}/kiosk-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kioskId: oldConfig.kioskId,
          eventType: 'CONFIG_DELETED',
          userEmail: currentUser?.email || null,
          userName: currentUser?.name || null,
          message: '설정이 삭제됨',
          metadata: null
        })
      }).catch(err => console.error('Failed to record CONFIG_DELETED event:', err));
    }

    // Update config after recording event
    config = result.config;

    // Update button state
    elements.saveConfigBtn.textContent = '설정 저장';
    elements.deleteConfigBtn.disabled = true;

    hideLoading();

    // Explicitly enable all input fields
    elements.apiUrl.readOnly = false;
    elements.apiUrl.disabled = false;
    elements.storeId.readOnly = false;
    elements.storeId.disabled = false;
    elements.kioskId.readOnly = false;
    elements.kioskId.disabled = false;
    elements.downloadPath.readOnly = false;
    elements.downloadPath.disabled = false;

    // Remove any disabled attributes that might exist
    elements.apiUrl.removeAttribute('disabled');
    elements.apiUrl.removeAttribute('readonly');
    elements.storeId.removeAttribute('disabled');
    elements.storeId.removeAttribute('readonly');
    elements.kioskId.removeAttribute('disabled');
    elements.kioskId.removeAttribute('readonly');
    elements.downloadPath.removeAttribute('disabled');
    elements.downloadPath.removeAttribute('readonly');

    // Clear input fields
    elements.apiUrl.value = config.apiUrl || '';
    elements.storeId.value = '';
    elements.kioskId.value = '';
    elements.downloadPath.value = config.downloadPath || '';
    elements.autoSync.checked = config.autoSync || false;
    elements.syncInterval.value = 12; // Reset to default

    // Reset server selection to local (default)
    document.querySelector('input[name="server"][value="local"]').checked = true;

    // Stop auto-sync and cancel debounce timer
    stopAutoSync();
    cancelAutoSyncDebounce();

    // Clear video list
    videos = [];
    renderVideoList();
    updateStats();

    // Update connection status
    updateConnectionStatus(false);

    // Show notification after a short delay to avoid blocking UI
    setTimeout(() => {
      showNotification('설정이 삭제되었습니다.', 'success');
    }, 100);
  } else {
    hideLoading();

    // Record failed deletion event using old config
    if (oldConfig && oldConfig.apiUrl && oldConfig.kioskId) {
      await fetch(`${oldConfig.apiUrl}/kiosk-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kioskId: oldConfig.kioskId,
          eventType: 'CONFIG_DELETE_FAILED',
          userEmail: currentUser?.email || null,
          userName: currentUser?.name || null,
          message: '설정 삭제 실패',
          metadata: null
        })
      }).catch(err => console.error('Failed to record CONFIG_DELETE_FAILED event:', err));
    }

    setTimeout(() => {
      showNotification('설정 삭제에 실패했습니다.', 'error');
    }, 100);
  }

}

// Record kiosk event to backend
async function recordKioskEvent(eventType, message, metadata = null) {
  try {
    if (!config || !config.apiUrl) {
      console.log('Skipping event recording - config not set');
      return;
    }

    const eventData = {
      kioskid: config.kioskId,
      eventType: eventType,
      userEmail: currentUser?.email || null,
      userName: currentUser?.name || null,
      message: message,
      metadata: metadata ? JSON.stringify(metadata) : null
    };

    const response = await fetch(`${config.apiUrl}/kiosk-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });

    if (response.ok) {
      console.log(`Event recorded: ${eventType} - ${message}`);
    } else {
      console.error(`Failed to record event: ${response.status}`);
    }
  } catch (error) {
    console.error('Error recording kiosk event:', error);
  }
}

// Save configuration
async function saveConfig() {
  // 로그인 체크
  if (!authToken) {
    // alert 대신 바로 로그인 모달 표시
    showLoginModal();
    return;
  }

  const configExists = await window.electronAPI.checkConfigExists();

  let newConfig;
  let shouldAutoSync = false;

  const storeId = elements.storeId.value.trim();
  const kioskId = elements.kioskId.value.trim();

  // Validate required fields first
  if (!elements.apiUrl.value.trim()) {
    showNotification('API URL을 입력하세요.', 'warning');
    return;
  }

  if (!storeId) {
    showNotification('매장 ID를 입력하세요.', 'warning');
    return;
  }

  if (!kioskId) {
    showNotification('키오스크 ID를 입력하세요.', 'warning');
    return;
  }

  if (!elements.downloadPath.value) {
    showNotification('다운로드 경로를 선택하세요.', 'warning');
    return;
  }

  // Pad storeId to 8 digits and kioskId to 12 digits
  const paddedStoreId = storeId.padStart(8, '0');
  const paddedKioskId = kioskId.padStart(12, '0');

  // Check if storeId or kioskId actually changed (only verify if changed or new config)
  const storeIdChanged = !configExists || !config.posId || config.posId !== paddedStoreId;
  const kioskIdChanged = !configExists || !config.kioskId || config.kioskId !== paddedKioskId;
  const needsVerification = storeIdChanged || kioskIdChanged;

  let kioskNo;

  if (needsVerification) {
    // Verify kiosk exists on server and cross-check with user input
    showLoading('서버에서 키오스크 정보 확인 중...');
    const kioskResult = await window.electronAPI.getKioskByKioskId(elements.apiUrl.value.trim(), paddedKioskId);
    hideLoading();

    if (!kioskResult.success) {
      showNotification(`키오스크 정보를 찾을 수 없습니다: ${kioskResult.error}`, 'error');
      return;
    }

    // Cross-check: server's posid should match user's input
    const serverKiosk = kioskResult.data;
    if (serverKiosk.posid !== paddedStoreId) {
      showNotification(`매장 ID가 일치하지 않습니다. 서버: ${serverKiosk.posid}, 입력: ${paddedStoreId}`, 'error');
      return;
    }

    // Get kioskno from server response
    kioskNo = serverKiosk.kioskno;
    console.log('Server verification completed - kioskNo:', kioskNo);
  } else {
    // Use existing kioskNo if storeId and kioskId haven't changed
    kioskNo = config.kioskNo;
    console.log('Using existing kioskNo (no verification needed):', kioskNo);
  }

  if (configExists) {
    // 설정 수정 모드: 모든 필드 업데이트 가능
    newConfig = {
      apiUrl: elements.apiUrl.value.trim(),
      posId: paddedStoreId,
      kioskNo: kioskNo,
      kioskId: paddedKioskId,
      downloadPath: elements.downloadPath.value,
      autoSync: elements.autoSync.checked,
      syncInterval: parseInt(elements.syncInterval.value) || 12
    };

    // Check if apiUrl or kioskId changed
    if (config.apiUrl !== newConfig.apiUrl || config.kioskId !== newConfig.kioskId) {
      shouldAutoSync = true;
    }

  } else {
    // 새 설정 저장 모드: 모든 필드 저장
    newConfig = {
      apiUrl: elements.apiUrl.value.trim(),
      posId: paddedStoreId,
      kioskNo: kioskNo,
      kioskId: paddedKioskId,
      downloadPath: elements.downloadPath.value,
      autoSync: elements.autoSync.checked,
      syncInterval: parseInt(elements.syncInterval.value) || 12
    };

    shouldAutoSync = true; // New config always triggers auto sync

  }

  // Check if any values actually changed (before showing loading)
  if (configExists && config) {
    const apiUrlUnchanged = config.apiUrl === newConfig.apiUrl;
    const storeIdUnchanged = config.posId === newConfig.storeId;
    const kioskIdUnchanged = config.kioskId === newConfig.kioskId;
    const kioskNoUnchanged = config.kioskNo === newConfig.kioskNo;
    const downloadPathUnchanged = config.downloadPath === newConfig.downloadPath;
    const autoSyncUnchanged = config.autoSync === newConfig.autoSync;
    const syncIntervalUnchanged = config.syncInterval === newConfig.syncInterval;

    if (apiUrlUnchanged && storeIdUnchanged && kioskIdUnchanged && kioskNoUnchanged &&
        downloadPathUnchanged && autoSyncUnchanged && syncIntervalUnchanged) {
      console.log('No changes detected, skipping save');
      
      // Ensure fields remain enabled
      elements.apiUrl.disabled = false;
      elements.storeId.disabled = false;
      elements.kioskId.disabled = false;
      elements.downloadPath.disabled = false;
      
      showNotification('변경 사항이 없습니다.', 'info');
      return;
    }
  }

  // Now show loading since we know there are changes
  if (configExists) {
    showLoading('설정 수정 중...');
  } else {
    showLoading('설정 저장 중...');
  }



  console.log("[SAVE 1] saveConfig() function called from button click");


  const result = await window.electronAPI.saveConfig(newConfig);

  hideLoading();

  if (result.success) {
    config = result.config;

    // Explicitly enable all input fields after saving
    elements.apiUrl.readOnly = false;
    elements.apiUrl.disabled = false;
    elements.storeId.readOnly = false;
    elements.storeId.disabled = false;
    elements.kioskId.readOnly = false;
    elements.kioskId.disabled = false;
    elements.downloadPath.readOnly = false;
    elements.downloadPath.disabled = false;

    // Remove any disabled attributes that might exist
    elements.apiUrl.removeAttribute('disabled');
    elements.apiUrl.removeAttribute('readonly');
    elements.storeId.removeAttribute('disabled');
    elements.storeId.removeAttribute('readonly');
    elements.kioskId.removeAttribute('disabled');
    elements.kioskId.removeAttribute('readonly');
    elements.downloadPath.removeAttribute('disabled');
    elements.downloadPath.removeAttribute('readonly');

    // Restart auto-sync if needed
    if (config.autoSync) {
      startAutoSync();
    } else {
      stopAutoSync();
    }

    // Update button state directly
    elements.saveConfigBtn.textContent = '설정 수정';
    elements.deleteConfigBtn.disabled = false;


    // Show notification after a short delay to avoid blocking UI
    setTimeout(() => {
      if (configExists) {
        showNotification('설정이 수정되었습니다.', 'success');
      } else {
        showNotification('설정이 저장되었습니다.', 'success');
      }
      recordKioskEvent('CONFIG_SAVED', configExists ? '설정이 수정됨' : '설정이 저장됨');
    }, 100);

    // Force enable input fields after a short delay to ensure they stay enabled
    setTimeout(() => {
      elements.apiUrl.disabled = false;
      elements.storeId.disabled = false;
      elements.kioskId.disabled = false;
      elements.downloadPath.disabled = false;
      console.log('Input fields forcefully enabled');
    }, 200);
  } else {
    setTimeout(() => {
      showNotification('설정 저장에 실패했습니다.', 'error');
    }, 100);
  }
}

// Test connection
async function testConnection() {
  if (!config || !config.apiUrl || !config.kioskId) {
    showNotification('API URL과 키오스크 ID를 먼저 설정하세요.', 'warning');
    return;
  }

  // Disable button and show loading state
  const originalText = elements.testConnectionBtn.textContent;
  elements.testConnectionBtn.disabled = true;
  elements.testConnectionBtn.textContent = '연결 테스트 중...';

  const result = await window.electronAPI.getVideos(config.apiUrl, config.kioskId);

  // Re-enable button and restore text
  elements.testConnectionBtn.disabled = false;
  elements.testConnectionBtn.textContent = originalText;

  if (result.success) {
    updateConnectionStatus(true);
    recordKioskEvent('CONNECTION_SUCCESS', '연결 테스트 성공');
    showNotification('연결 성공!', 'success');
  } else {
    updateConnectionStatus(false);
    recordKioskEvent('CONNECTION_FAILED', `연결테스트 실패: ${result.error}`);
    showNotification('연결 실패: ' + result.error, 'error');
  }
}

// Select download path
async function selectDownloadPath() {
  const path = await window.electronAPI.selectDownloadPath();
  if (path) {
    elements.downloadPath.value = path;
  }
}

// Sync videos from server
async function syncVideos(isAutoSync = false) {
  console.log('[DEBUG] syncVideos called, isAutoSync:', isAutoSync, 'config:', config);
  if (!config || !config.apiUrl || !config.kioskId) {
    console.log('[DEBUG] Missing config, showing error notification');
    if (!isAutoSync) {
      showNotification('키오스크 정보가 설정되지 않았습니다. 설정 탭에서 먼저 키오스크 정보를 입력하세요.', 'error');
    }
    return;
  }

  // Disable sync button and show loading state (only for manual sync)
  let originalText;
  if (!isAutoSync) {
    originalText = elements.syncBtn.textContent;
    elements.syncBtn.disabled = true;
    elements.syncBtn.innerHTML = '<span class="icon">🔄</span> 동기화 중...';
    recordKioskEvent('SYNC_STARTED', '수동 영상 동기화 시작');
  }

  const result = await window.electronAPI.getVideos(config.apiUrl, config.kioskId);

  // Re-enable sync button and restore text (only for manual sync)
  if (!isAutoSync) {
    elements.syncBtn.disabled = false;
    elements.syncBtn.innerHTML = originalText;
  }

  if (result.success) {
    videos = result.data.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // Debug: Log thumbnail URLs
    console.log('Synced videos:', videos.length);
    videos.forEach(v => {
      console.log(`Video ${v.videoId}: ${v.title}`);
      console.log(`  Thumbnail URL: ${v.thumbnailUrl || 'NONE'}`);
    });

    // Check which videos already exist locally and sync status
    for (let video of videos) {
      const fileName = generateFileName(video);
      const filePath = `${config.downloadPath}\\${fileName}`;
      const exists = await window.electronAPI.checkFileExists(filePath);

      if (exists && video.downloadStatus !== 'COMPLETED') {
        // File exists locally but server status is not COMPLETED -> Update to COMPLETED
        await window.electronAPI.updateDownloadStatus({
          apiUrl: config.apiUrl,
          kioskId: config.kioskId,
          videoId: video.videoId,
          status: 'COMPLETED'
        });
        video.downloadStatus = 'COMPLETED';
      } else if (!exists && video.downloadStatus === 'COMPLETED') {
        // File doesn't exist locally but server status is COMPLETED -> Update to PENDING
        await window.electronAPI.updateDownloadStatus({
          apiUrl: config.apiUrl,
          kioskId: config.kioskId,
          videoId: video.videoId,
          status: 'PENDING'
        });
        video.downloadStatus = 'PENDING';
      }
    }

    // Update last sync time
    config.lastSync = new Date().toISOString();
    console.log("[SAVE 2] saveConfig called from syncVideos - updating lastSync");

    await window.electronAPI.saveConfig({ lastSync: config.lastSync });
    updateLastSyncTime(new Date(config.lastSync));

    if (!isAutoSync) {
      recordKioskEvent('SYNC_COMPLETED', `수동 영상 파일 ${videos.length} 개 동기완료`);
    } else {
      recordKioskEvent('AUTO_SYNC_TRIGGERED', `자동 영상 동기화하여 ${videos.length} 개 동기완료`);
    }

    updateConnectionStatus(true);
    renderVideoList();
    updateStats();

    // Re-enable all input fields after sync completes
    elements.apiUrl.disabled = false;
    elements.apiUrl.readOnly = false;
    elements.storeId.disabled = false;
    elements.storeId.readOnly = false;
    elements.kioskId.disabled = false;
    elements.kioskId.readOnly = false;
    elements.downloadPath.disabled = false;
    elements.downloadPath.readOnly = false;

    // Only show notification for manual sync
    if (!isAutoSync) {
      showNotification(`${videos.length}개의 영상을 동기화했습니다.`, 'success');
    }

    // Auto-download pending videos in background
    const pendingVideos = videos.filter(v => v.downloadStatus === 'PENDING');
    if (pendingVideos.length > 0) {
      console.log(`Found ${pendingVideos.length} pending videos, starting background download...`);
      // Start downloads in background without waiting
      downloadPendingVideosInBackground(pendingVideos);
    }
  } else {
    updateConnectionStatus(false);
    isOnline = false;
    elements.offlineMode.style.display = 'inline-block';
    if (!isAutoSync) {
      recordKioskEvent('SYNC_FAILED', `동기화 실패: ${result.error}`);
      showNotification('동기화 실패: ' + result.error, 'error');
    }
  }
}

// Download pending videos in background
async function downloadPendingVideosInBackground(pendingVideos) {
  for (let video of pendingVideos) {
    try {
      await downloadVideoInBackground(video);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Background download failed for video ${video.videoId}:`, error);
    }
  }
}

// Download single video in background (no prompts)
async function downloadVideoInBackground(video) {
  if (!config || !config.downloadPath || !config.kioskId) {
    console.log('Download path or kiosk ID not set, skipping background download');
    return;
  }

  const fileName = generateFileName(video);
  const kioskDownloadPath = `${config.downloadPath}\\${config.kioskId}`;
  const filePath = `${kioskDownloadPath}\\${fileName}`;

  // Check if file already exists - skip if it does
  const fileExists = await window.electronAPI.checkFileExists(filePath);
  if (fileExists) {
    console.log(`File already exists, skipping: ${fileName}`);

    // Update status to COMPLETED since file exists
    video.downloadStatus = 'COMPLETED';
    video.progress = 100;

    // Update status on server
    await window.electronAPI.updateDownloadStatus({
      apiUrl: config.apiUrl,
      kioskId: config.kioskId,
      videoId: video.videoId,
      status: 'COMPLETED'
    });

    renderVideoList();
    updateStats();
    return;
  }

  // Update status to downloading
  video.downloadStatus = 'DOWNLOADING';
  video.progress = 0;
  recordKioskEvent('DOWNLOAD_STARTED', `다운로드 시작: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      fileName: fileName
    }));
  renderVideoList();

  const result = await window.electronAPI.downloadVideo({
    apiUrl: config.apiUrl,
    videoId: video.videoId,
    downloadPath: kioskDownloadPath,
    fileName: fileName
  });

  if (result.success) {
    video.downloadStatus = 'COMPLETED';
    video.progress = 100;

    // Update status on server
    await window.electronAPI.updateDownloadStatus({
      apiUrl: config.apiUrl,
      kioskId: config.kioskId,
      videoId: video.videoId,
      status: 'COMPLETED'
    });

    recordKioskEvent('DOWNLOAD_COMPLETED', `다운로드 완료: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      fileName: fileName
    }));
    console.log(`Background download completed: ${video.title}`);
  } else {
    video.downloadStatus = 'PENDING';
    video.progress = 0;
    recordKioskEvent('DOWNLOAD_FAILED', `다운로드 실패: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      error: result.error
    }));
    console.error(`Background download failed: ${video.title} - ${result.error}`);
  }

  renderVideoList();
  updateStats();
}

// Download single video
async function downloadVideo(video) {
  if (!config || !config.downloadPath) {
    showNotification('다운로드 경로를 먼저 설정하세요.', 'warning');
    return;
  }

  if (!config.kioskId) {
    showNotification('키오스크 ID를 먼저 설정하세요.', 'warning');
    return;
  }

  const fileName = generateFileName(video);
  const kioskDownloadPath = `${config.downloadPath}\\${config.kioskId}`;
  const filePath = `${kioskDownloadPath}\\${fileName}`;

  // Check if file already exists
  const fileExists = await window.electronAPI.checkFileExists(filePath);
  if (fileExists) {
    const confirmOverwrite = confirm(`파일 "${fileName}"이(가) 이미 존재합니다.\n덮어쓰시겠습니까?`);
    if (!confirmOverwrite) {
      showNotification('다운로드가 취소되었습니다.', 'info');
      return;
    }
  }

  // Update status to downloading
  video.downloadStatus = 'DOWNLOADING';
  video.progress = 0;
  renderVideoList();

  const result = await window.electronAPI.downloadVideo({
    apiUrl: config.apiUrl,
    videoId: video.videoId,
    downloadPath: kioskDownloadPath,
    fileName: fileName
  });

  if (result.success) {
    video.downloadStatus = 'COMPLETED';
    video.progress = 100;

    // Update status on server
    await window.electronAPI.updateDownloadStatus({
      apiUrl: config.apiUrl,
      kioskId: config.kioskId,
      videoId: video.videoId,
      status: 'COMPLETED'
    });

    recordKioskEvent('DOWNLOAD_COMPLETED', `다운로드 완료: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      fileName: fileName
    }));
    showNotification(`${video.title} 다운로드 완료`, 'success');
  } else {
    video.downloadStatus = 'PENDING';
    video.progress = 0;
    recordKioskEvent('DOWNLOAD_FAILED', `다운로드 실패: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      error: result.error
    }));
    showNotification(`다운로드 실패: ${result.error}`, 'error');
  }

  renderVideoList();
  updateStats();
}

// Delete video file
async function deleteVideo(video) {
  const fileName = generateFileName(video);
  const kioskDownloadPath = `${config.downloadPath}\\${config.kioskId}`;
  const filePath = `${kioskDownloadPath}\\${fileName}`;

  // Check if file exists first
  const fileExists = await window.electronAPI.checkFileExists(filePath);

  if (!fileExists) {
    // File already deleted, update status to PENDING
    video.downloadStatus = 'PENDING';
    video.progress = 0;

    // Update status on server
    await window.electronAPI.updateDownloadStatus({
      apiUrl: config.apiUrl,
      kioskId: config.kioskId,
      videoId: video.videoId,
      status: 'PENDING'
    });

    renderVideoList();
    updateStats();
    showNotification('파일이 이미 삭제되어 상태를 대기중으로 변경했습니다.', 'info');
    return;
  }

  if (!confirm(`파일 "${fileName}"을(를) 삭제하시겠습니까?`)) {
    return;
  }

  const result = await window.electronAPI.deleteFile(filePath);

  if (result.success) {
    video.downloadStatus = 'PENDING';
    video.progress = 0;

    // Update status on server
    await window.electronAPI.updateDownloadStatus({
      apiUrl: config.apiUrl,
      kioskId: config.kioskId,
      videoId: video.videoId,
      status: 'PENDING'
    });

    recordKioskEvent('FILE_DELETED', `영상 파일 삭제: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      fileName: fileName
    }));
    renderVideoList();
    updateStats();
    showNotification('영상이 삭제되었습니다.', 'success');
  } else {
    recordKioskEvent('FILE_DELETE_FAIL', `영상 파일 삭제 실패: ${video.title}`, JSON.stringify({
      videoId: video.videoId,
      fileName: fileName
    }));
    showNotification('삭제 실패: ' + result.error, 'error');
  }
}

// Generate file name from video title
function generateFileName(video) {
  const ext = video.fileName ? video.fileName.split('.').pop() : 'mp4';
  const sanitizedTitle = (video.title || 'untitled').replace(/[<>:"/\\|?*]/g, '_');
  return `${sanitizedTitle}.${ext}`;
}

// Handle download progress
function handleDownloadProgress(data) {
  const video = videos.find(v => v.videoId === data.videoId);
  if (video) {
    video.progress = data.progress;
    updateVideoProgress(data.videoId, data.progress);
  }
}

// Render video list
function renderVideoList() {
  const filteredVideos = videos.filter(video => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'pending') return video.downloadStatus === 'PENDING';
    if (currentFilter === 'downloading') return video.downloadStatus === 'DOWNLOADING';
    if (currentFilter === 'completed') return video.downloadStatus === 'COMPLETED';
    return true;
  });

  if (filteredVideos.length === 0) {
    elements.videoList.innerHTML = '<div class="empty-state"><p>영상이 없습니다.</p></div>';
    return;
  }

  elements.videoList.innerHTML = filteredVideos.map(video => `
    <div class="video-item" data-video-id="${video.videoId}">
      <div class="video-order">${String(video.displayOrder || 0).padStart(3, '0')}</div>
      <div class="video-thumbnail">
        ${video.thumbnailUrl
          ? `<img src="${video.thumbnailUrl}" alt="${escapeHtml(video.title)}" onerror="this.parentElement.innerHTML='<div class=\\'thumbnail-placeholder\\'>📹</div>'" />`
          : '<div class="thumbnail-placeholder">📹</div>'}
      </div>
      <div class="video-info">
        <div class="video-title">${escapeHtml(video.title)}</div>
        ${video.description ? `<div class="video-description">${escapeHtml(video.description)}</div>` : ''}
        <div class="video-meta">
          <span>${formatFileSize(video.fileSize)}</span>
          <span>${formatDuration(video.duration)}</span>
        </div>
      </div>
      <div class="video-status">
        ${renderVideoStatus(video)}
      </div>
      <div class="video-actions">
        ${renderVideoActions(video)}
      </div>
    </div>
  `).join('');

  // Add event listeners to buttons
  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const videoId = parseInt(e.target.dataset.videoId);
      const video = videos.find(v => v.videoId === videoId);
      if (video) downloadVideo(video);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const videoId = parseInt(e.target.dataset.videoId);
      const video = videos.find(v => v.videoId === videoId);
      if (video) deleteVideo(video);
    });
  });
}

// Render video status
function renderVideoStatus(video) {
  const status = video.downloadStatus || 'PENDING';

  if (status === 'COMPLETED') {
    return '<span class="status-badge status-completed">완료</span>';
  } else if (status === 'DOWNLOADING') {
    return `
      <div class="download-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${video.progress || 0}%"></div>
        </div>
        <span class="progress-text">${video.progress || 0}%</span>
      </div>
    `;
  } else {
    return '<span class="status-badge status-pending">대기 중</span>';
  }
}

// Render video actions
function renderVideoActions(video) {
  const status = video.downloadStatus || 'PENDING';

  if (status === 'COMPLETED') {
    return `<button class="btn-icon btn-delete" data-video-id="${video.videoId}" title="삭제">🗑️</button>`;
  } else if (status === 'DOWNLOADING') {
    return '<span class="downloading-text">다운로드 중...</span>';
  } else {
    return `<button class="btn-icon btn-download" data-video-id="${video.videoId}" title="다운로드">⬇️</button>`;
  }
}

// Update video progress
function updateVideoProgress(videoId, progress) {
  const videoItem = document.querySelector(`[data-video-id="${videoId}"]`);
  if (videoItem) {
    const progressFill = videoItem.querySelector('.progress-fill');
    const progressText = videoItem.querySelector('.progress-text');
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${progress}%`;
  }
}

// Update statistics
function updateStats() {
  const total = videos.length;
  const downloaded = videos.filter(v => v.downloadStatus === 'COMPLETED').length;
  const pending = total - downloaded;

  elements.totalVideos.textContent = total;
  elements.downloadedVideos.textContent = downloaded;
  elements.pendingVideos.textContent = pending;
}

// Update connection status
function updateConnectionStatus(online) {
  isOnline = online;

  if (online) {
    elements.connectionStatus.className = 'status-indicator online';
    elements.connectionStatus.textContent = '연결됨';
    elements.offlineMode.style.display = 'none';
  } else {
    elements.connectionStatus.className = 'status-indicator offline';
    elements.connectionStatus.textContent = '연결 안됨';
    elements.offlineMode.style.display = 'inline-block';
  }
}

// Update last sync time
function updateLastSyncTime(date) {
  const formatted = formatDateTime(date);
  elements.lastSync.textContent = `마지막 동기화: ${formatted}`;
}

// Auto-sync functions
function startAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  const interval = (config.syncInterval || 12) * 60 * 60 * 1000; // Convert hours to milliseconds

  autoSyncInterval = setInterval(() => {
    console.log('Auto-syncing videos...');
    syncVideos(true); // Auto-sync, suppress notifications
  }, interval);

  console.log(`Auto-sync started (every ${config.syncInterval || 12} hours)`);
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('Auto-sync stopped');
  }
}

// Schedule auto-sync with debounce
function scheduleAutoSync() {
  // Cancel existing debounce timer
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
  }

  // Schedule sync after 1 second
  autoSyncDebounceTimer = setTimeout(async () => {
    console.log('Auto-sync triggered after 1 second debounce');
    await syncVideos(true);
    console.log('Auto-sync completed');
  }, 1000);
}

// Cancel auto-sync debounce
function cancelAutoSyncDebounce() {
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = null;
    console.log('Auto-sync debounce cancelled');
  }
}

// Utility functions
function showLoading(message = '처리 중...') {
  elements.loadingMessage.textContent = message;
  elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  elements.loadingOverlay.style.display = 'none';
}

function showNotification(message, type = 'info') {
  // Simple alert for now - can be enhanced with custom notification UI
  console.log(`[${type.toUpperCase()}] ${message}`);
  alert(message);
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDuration(seconds) {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Authentication functions
function showLoginModal() {
  // Clear previous values first
  elements.loginEmail.value = '';
  elements.loginPassword.value = '';
  elements.loginError.style.display = 'none';

  // Explicitly enable login input fields BEFORE showing modal
  elements.loginEmail.disabled = false;
  elements.loginEmail.readOnly = false;
  elements.loginPassword.disabled = false;
  elements.loginPassword.readOnly = false;

  // Remove any disabled attributes that might exist
  elements.loginEmail.removeAttribute('disabled');
  elements.loginEmail.removeAttribute('readonly');
  elements.loginPassword.removeAttribute('disabled');
  elements.loginPassword.removeAttribute('readonly');

  // Show modal
  elements.loginModal.classList.add('show');

  // Focus after a short delay to ensure modal is fully displayed
  setTimeout(() => {
    // Re-enable fields again after modal is shown
    elements.loginEmail.disabled = false;
    elements.loginEmail.readOnly = false;
    elements.loginPassword.disabled = false;
    elements.loginPassword.readOnly = false;

    elements.loginEmail.focus();
  }, 100);
}

function hideLoginModal() {
  elements.loginModal.classList.remove('show');
}

async function handleLogin() {
  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  if (!email || !password) {
    elements.loginError.textContent = '이메일과 비밀번호를 입력하세요.';
    elements.loginError.style.display = 'block';
    return;
  }

  // Use the current API URL from the input field (not from saved config)
  const apiUrl = elements.apiUrl.value.trim();
  
  if (!apiUrl) {
    elements.loginError.textContent = 'API URL을 먼저 설정하세요. (서버 선택 또는 직접 입력)';
    elements.loginError.style.display = 'block';
    return;
  }

  // Disable login button
  elements.loginSubmitBtn.disabled = true;
  elements.loginSubmitBtn.textContent = '로그인 중...';
  elements.loginError.style.display = 'none';

  const result = await window.electronAPI.login(apiUrl, email, password);

  if (result.success) {
    authToken = result.data.token;
    currentUser = result.data;
    currentUser.name = result.data.displayName;


    // Update UI
    elements.userInfo.textContent = currentUser.name;
    elements.userInfo.style.display = 'inline';
    elements.loginHeaderBtn.style.display = 'none';
    elements.logoutBtn.style.display = 'inline-block';

    hideLoginModal();
    console.log('Login successful');
    recordKioskEvent('USER_LOGIN', `로그인 성공: ${currentUser.name}`);
  } else {
    // Check for specific error messages
    const errorMessage = result.error || '로그인 실패';

    // Check if it's an account approval required error
    if (errorMessage.includes('관리자의 승인이 필요합니다') || errorMessage.includes('승인이 필요합니다')) {
      recordKioskEvent('USER_LOGIN', `로그인 실패: 승인대기 - ${email}`);
      alert('⚠️ 계정 승인 필요\n\n관리자의 승인이 필요합니다.\n승인 후 로그인해 주세요.\n\n문의사항이 있으시면 관리자에게 연락해주세요.');
      // Clear the error message below the form since we showed an alert
      elements.loginError.style.display = 'none';
    } else if (errorMessage.includes('계정이 정지되었습니다') || errorMessage.includes('정지')) {
      recordKioskEvent('USER_LOGIN', `로그인 실패: 계정정지 - ${email}`);
      alert('🚫 계정 정지\n\n계정이 정지되었습니다.\n관리자에게 문의하세요.');
      elements.loginError.style.display = 'none';
    } else {
      recordKioskEvent('USER_LOGIN', `로그인 실패: ${errorMessage}`);
      elements.loginError.textContent = errorMessage;
      elements.loginError.style.display = 'block';
    }
  }

  // Re-enable login button
  elements.loginSubmitBtn.disabled = false;
  elements.loginSubmitBtn.textContent = '로그인';
}

async function handleLogout() {
  if (!confirm('로그아웃하시겠습니까?')) {
    return;
  }

  authToken = null;
  currentUser = null;


  // Update UI
  elements.userInfo.style.display = 'none';
  elements.loginHeaderBtn.style.display = 'inline-block';
  elements.logoutBtn.style.display = 'none';

  console.log('Logout successful - app continues to function without authentication');
  recordKioskEvent('USER_LOGOUT', '로그아웃');
}

function checkAuthentication() {
  if (!authToken) {
    showLoginModal();
    return false;
  }
  return true;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
