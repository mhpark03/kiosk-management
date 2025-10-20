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
let isOnline = true;

// DOM elements
const elements = {
  apiUrl: document.getElementById('api-url'),
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
  downloadAllBtn: document.getElementById('download-all-btn'),
  videoList: document.getElementById('video-list'),
  connectionStatus: document.getElementById('connection-status'),
  lastSync: document.getElementById('last-sync'),
  totalVideos: document.getElementById('total-videos'),
  downloadedVideos: document.getElementById('downloaded-videos'),
  pendingVideos: document.getElementById('pending-videos'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingMessage: document.getElementById('loading-message'),
  offlineMode: document.getElementById('offline-mode')
};

// Initialize app
async function initialize() {
  console.log('Initializing Kiosk Video Downloader...');

  // Load config
  config = await window.electronAPI.getConfig();
  if (config) {
    elements.apiUrl.value = config.apiUrl || '';
    elements.kioskId.value = config.kioskId || '';
    elements.downloadPath.value = config.downloadPath || '';
    elements.autoSync.checked = config.autoSync || false;
    elements.syncInterval.value = config.syncInterval || 12;

    // Set the correct server radio button based on saved API URL
    const apiUrl = config.apiUrl || '';
    if (apiUrl === SERVER_URLS.local) {
      document.querySelector('input[name="server"][value="local"]').checked = true;
      elements.apiUrl.readOnly = true;
    } else if (apiUrl === SERVER_URLS.aws) {
      document.querySelector('input[name="server"][value="aws"]').checked = true;
      elements.apiUrl.readOnly = true;
    } else {
      document.querySelector('input[name="server"][value="custom"]').checked = true;
      elements.apiUrl.readOnly = false;
    }

    if (config.lastSync) {
      updateLastSyncTime(new Date(config.lastSync));
    }

    // Auto-sync if enabled
    if (config.autoSync && config.apiUrl && config.kioskId) {
      startAutoSync();
    }
  }

  // Initialize input fields as enabled by default
  elements.apiUrl.disabled = false;
  elements.kioskId.disabled = false;
  elements.autoSync.disabled = false;

  // Setup event listeners
  setupEventListeners();

  // Update save/delete button based on config state
  await updateConfigButton();

  // Auto test connection and sync if config exists
  if (config && config.apiUrl && config.kioskId) {
    console.log('Auto-connecting and syncing on startup...');
    // Run connection test and sync (non-blocking)
    setTimeout(async () => {
      await testConnection();
      await syncVideos();
    }, 500);
  }

  console.log('App initialized');
}

// Setup event listeners
function setupEventListeners() {
  elements.saveConfigBtn.addEventListener('click', saveConfig);
  elements.deleteConfigBtn.addEventListener('click', deleteConfig);
  elements.testConnectionBtn.addEventListener('click', testConnection);
  elements.selectPathBtn.addEventListener('click', selectDownloadPath);
  elements.syncBtn.addEventListener('click', syncVideos);
  elements.downloadAllBtn.addEventListener('click', downloadAllVideos);

  // Server selection change
  elements.serverRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const selectedServer = e.target.value;

      if (selectedServer === 'custom') {
        // Enable manual input for custom server
        elements.apiUrl.readOnly = false;
        elements.apiUrl.focus();
      } else {
        // Use predefined server URL
        elements.apiUrl.readOnly = true;
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

  // Sync interval change
  elements.syncInterval.addEventListener('change', async (e) => {
    const newInterval = parseInt(e.target.value) || 12;

    // Update config with new interval
    if (config) {
      config.syncInterval = newInterval;
      await window.electronAPI.saveConfig({ syncInterval: newInterval });

      // Restart auto-sync if it's enabled
      if (config.autoSync && elements.autoSync.checked) {
        startAutoSync();
      }

      console.log(`Sync interval updated to ${newInterval} hours`);
    }
  });

  // Download progress listener
  window.electronAPI.onDownloadProgress(handleDownloadProgress);
}

// Update input fields based on config state
async function updateConfigButton() {
  const configExists = await window.electronAPI.checkConfigExists();

  if (configExists) {
    // Config exists -> Change button text and enable delete
    elements.saveConfigBtn.textContent = '설정 수정';
    elements.deleteConfigBtn.disabled = false;

    // Disable main config inputs
    elements.apiUrl.disabled = true;
    elements.kioskId.disabled = true;
    elements.autoSync.disabled = true;
    // Keep syncInterval enabled for editing
    elements.syncInterval.disabled = false;

    // Disable server selection radios
    elements.serverRadios.forEach(radio => {
      radio.disabled = true;
    });
  } else {
    // No config -> Change button text and disable delete
    elements.saveConfigBtn.textContent = '설정 저장';
    elements.deleteConfigBtn.disabled = true;

    // Enable all inputs
    elements.apiUrl.disabled = false;
    elements.kioskId.disabled = false;
    elements.autoSync.disabled = false;
    elements.syncInterval.disabled = false;

    // Enable server selection radios
    elements.serverRadios.forEach(radio => {
      radio.disabled = false;
    });

    // Set readonly state based on server selection
    const selectedServer = document.querySelector('input[name="server"]:checked')?.value || 'local';
    elements.apiUrl.readOnly = selectedServer !== 'custom';
  }
}

// Delete configuration
async function deleteConfig() {
  if (!confirm('설정을 삭제하시겠습니까? 저장된 키오스크 ID와 모든 설정이 초기화됩니다.')) {
    return;
  }

  showLoading('설정 삭제 중...');

  const result = await window.electronAPI.deleteConfig();

  hideLoading();

  if (result.success) {
    config = result.config;

    // Clear input fields
    elements.apiUrl.value = config.apiUrl || '';
    elements.kioskId.value = '';
    elements.downloadPath.value = config.downloadPath || '';
    elements.autoSync.checked = config.autoSync || false;
    elements.syncInterval.value = 12; // Reset to default

    // Reset server selection to local (default)
    document.querySelector('input[name="server"][value="local"]').checked = true;
    elements.apiUrl.readOnly = true;

    // Stop auto-sync
    stopAutoSync();

    // Clear video list
    videos = [];
    renderVideoList();
    updateStats();

    // Update connection status
    updateConnectionStatus(false);

    showNotification('설정이 삭제되었습니다.', 'success');

    // Update button and input states
    await updateConfigButton();
  } else {
    showNotification('설정 삭제에 실패했습니다.', 'error');
  }
}

// Save configuration
async function saveConfig() {
  const configExists = await window.electronAPI.checkConfigExists();

  let newConfig;

  if (configExists) {
    // 설정 수정 모드: 동기화 시간과 다운로드 경로만 업데이트
    if (!elements.downloadPath.value) {
      showNotification('다운로드 경로를 선택하세요.', 'warning');
      return;
    }

    newConfig = {
      ...config, // 기존 설정 유지
      downloadPath: elements.downloadPath.value,
      syncInterval: parseInt(elements.syncInterval.value) || 12
    };

    showLoading('설정 수정 중...');
  } else {
    // 새 설정 저장 모드: 모든 필드 저장
    newConfig = {
      apiUrl: elements.apiUrl.value.trim(),
      kioskId: elements.kioskId.value.trim(),
      downloadPath: elements.downloadPath.value,
      autoSync: elements.autoSync.checked,
      syncInterval: parseInt(elements.syncInterval.value) || 12
    };

    // Validate required fields
    if (!newConfig.apiUrl) {
      showNotification('API URL을 입력하세요.', 'warning');
      return;
    }

    if (!newConfig.kioskId) {
      showNotification('키오스크 ID를 입력하세요.', 'warning');
      return;
    }

    if (!newConfig.downloadPath) {
      showNotification('다운로드 경로를 선택하세요.', 'warning');
      return;
    }

    showLoading('설정 저장 중...');
  }

  const result = await window.electronAPI.saveConfig(newConfig);

  hideLoading();

  if (result.success) {
    config = result.config;

    if (configExists) {
      showNotification('설정이 수정되었습니다.', 'success');
    } else {
      showNotification('설정이 저장되었습니다.', 'success');
    }

    // Restart auto-sync if needed
    if (config.autoSync) {
      startAutoSync();
    } else {
      stopAutoSync();
    }

    // Update button state
    await updateConfigButton();

    // Auto test connection and sync after saving config
    if (config.apiUrl && config.kioskId) {
      console.log('Auto-connecting and syncing after config save...');
      setTimeout(async () => {
        await testConnection();
        await syncVideos();
      }, 500);
    }
  } else {
    showNotification('설정 저장에 실패했습니다.', 'error');
  }
}

// Test connection
async function testConnection() {
  if (!config || !config.apiUrl || !config.kioskId) {
    showNotification('API URL과 키오스크 ID를 먼저 설정하세요.', 'warning');
    return;
  }

  showLoading('연결 테스트 중...');

  const result = await window.electronAPI.getVideos(config.apiUrl, config.kioskId);

  hideLoading();

  if (result.success) {
    updateConnectionStatus(true);
    showNotification('연결 성공!', 'success');
  } else {
    updateConnectionStatus(false);
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
async function syncVideos() {
  if (!config || !config.apiUrl || !config.kioskId) {
    showNotification('API URL과 키오스크 ID를 먼저 설정하세요.', 'warning');
    return;
  }

  showLoading('영상 목록 동기화 중...');

  const result = await window.electronAPI.getVideos(config.apiUrl, config.kioskId);

  hideLoading();

  if (result.success) {
    videos = result.data.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // Debug: Log thumbnail URLs
    console.log('Synced videos:', videos.length);
    videos.forEach(v => {
      console.log(`Video ${v.videoId}: ${v.title}`);
      console.log(`  Thumbnail URL: ${v.thumbnailUrl || 'NONE'}`);
    });

    // Check which videos already exist locally
    for (let video of videos) {
      const fileName = generateFileName(video);
      const filePath = `${config.downloadPath}\\${fileName}`;
      const exists = await window.electronAPI.checkFileExists(filePath);

      if (exists && video.downloadStatus !== 'COMPLETED') {
        // Update status on server if file exists locally
        await window.electronAPI.updateDownloadStatus({
          apiUrl: config.apiUrl,
          kioskId: config.kioskId,
          videoId: video.videoId,
          status: 'COMPLETED'
        });
        video.downloadStatus = 'COMPLETED';
      }
    }

    // Update last sync time
    config.lastSync = new Date().toISOString();
    await window.electronAPI.saveConfig({ lastSync: config.lastSync });
    updateLastSyncTime(new Date(config.lastSync));

    updateConnectionStatus(true);
    renderVideoList();
    updateStats();
    showNotification(`${videos.length}개의 영상을 동기화했습니다.`, 'success');
  } else {
    updateConnectionStatus(false);
    isOnline = false;
    elements.offlineMode.style.display = 'inline-block';
    showNotification('동기화 실패: ' + result.error, 'error');
  }
}

// Download all pending videos
async function downloadAllVideos() {
  const pendingVideos = videos.filter(v => v.downloadStatus !== 'COMPLETED');

  if (pendingVideos.length === 0) {
    showNotification('다운로드할 영상이 없습니다.', 'info');
    return;
  }

  if (!confirm(`${pendingVideos.length}개의 영상을 다운로드하시겠습니까?`)) {
    return;
  }

  for (let video of pendingVideos) {
    await downloadVideo(video);
    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Download single video
async function downloadVideo(video) {
  if (!config || !config.downloadPath) {
    showNotification('다운로드 경로를 먼저 설정하세요.', 'warning');
    return;
  }

  const fileName = generateFileName(video);
  const filePath = `${config.downloadPath}\\${fileName}`;

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
    downloadPath: config.downloadPath,
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

    showNotification(`${video.title} 다운로드 완료`, 'success');
  } else {
    video.downloadStatus = 'PENDING';
    video.progress = 0;
    showNotification(`다운로드 실패: ${result.error}`, 'error');
  }

  renderVideoList();
  updateStats();
}

// Delete video file
async function deleteVideo(video) {
  const fileName = generateFileName(video);
  const filePath = `${config.downloadPath}\\${fileName}`;

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

    renderVideoList();
    updateStats();
    showNotification('영상이 삭제되었습니다.', 'success');
  } else {
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
    syncVideos();
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
