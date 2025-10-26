const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const SockJS = require('sockjs-client');
const { Client } = require('@stomp/stompjs');

let mainWindow;
let config = null;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const LOGS_DIR = path.join(__dirname, 'logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// WebSocket client
let stompClient = null;
let isWebSocketConnected = false;
let heartbeatInterval = null;

// Current log file path and date (reset when date changes)
let currentLogFilePath = null;
let currentLogDate = null; // Format: YYYY-MM-DD

// Logging System
function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Get Korea Standard Time (KST) formatted string
 * @param {Date} date - Date object
 * @returns {string} - Formatted string in KST (YYYY/MM/DD-HH:mm:ss)
 */
function toKST(date) {
  // Convert to Korea timezone (UTC+9)
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');

  return `${year}/${month}/${day}-${hours}:${minutes}:${seconds}`;
}

/**
 * Get unique log file path for current date
 * Creates a new log file when:
 * 1. App starts for the first time
 * 2. Date changes (midnight rollover)
 * Format: kiosk-events-YYYY-MM-DD-NNN.log
 */
function getLogFilePath() {
  const date = new Date();
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD in KST

  // Check if date has changed - if so, create new log file
  if (currentLogFilePath && currentLogDate === dateStr) {
    return currentLogFilePath; // Same date, use existing file
  }

  // Date changed or first run - create new log file
  ensureLogsDirectory();

  // Find next available sequence number
  let sequence = 1;
  let logPath;

  while (true) {
    const seqStr = String(sequence).padStart(3, '0');
    logPath = path.join(LOGS_DIR, `kiosk-events-${dateStr}-${seqStr}.log`);

    // Check if this file already exists
    if (!fs.existsSync(logPath)) {
      break; // Found available filename
    }
    sequence++;

    // Safety check to prevent infinite loop
    if (sequence > 999) {
      // Fallback to timestamp-based name if we somehow have 999 files today
      const timestamp = toKST(new Date()).replace(/[/:]/g, '-');
      logPath = path.join(LOGS_DIR, `kiosk-events-${dateStr}-${timestamp}.log`);
      break;
    }
  }

  // Cache the determined path and date
  currentLogFilePath = logPath;
  currentLogDate = dateStr;
  console.log(`Log file for this session: ${path.basename(logPath)}`);

  return logPath;
}

function rotateLogIfNeeded(logPath) {
  try {
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > MAX_LOG_SIZE) {
        // Find a unique rotated filename
        let rotatedPath;
        let rotateSeq = 1;

        while (true) {
          const seqStr = String(rotateSeq).padStart(3, '0');
          rotatedPath = logPath.replace('.log', `-rotated-${seqStr}.log`);

          if (!fs.existsSync(rotatedPath)) {
            break; // Found available filename
          }
          rotateSeq++;

          // Safety check
          if (rotateSeq > 999) {
            const timestamp = toKST(new Date()).replace(/[/:]/g, '-');
            rotatedPath = logPath.replace('.log', `-rotated-${timestamp}.log`);
            break;
          }
        }

        fs.renameSync(logPath, rotatedPath);
        console.log(`Log file rotated: ${path.basename(rotatedPath)}`);

        // Reset current log path and date so a new one will be created
        currentLogFilePath = null;
        currentLogDate = null;
      }
    }
  } catch (error) {
    console.error('Error rotating log file:', error);
  }
}

function writeLog(level, eventType, message, data = null) {
  try {
    ensureLogsDirectory();
    const logPath = getLogFilePath();
    rotateLogIfNeeded(logPath);

    const timestamp = toKST(new Date());
    const dataStr = data ? ` - ${JSON.stringify(data)}` : '';
    const logLine = `[${timestamp}] [${level}] [${eventType}] ${message}${dataStr}\n`;

    fs.appendFileSync(logPath, logLine, 'utf8');

    // Also log to console
    console.log(logLine.trim());
  } catch (error) {
    console.error('Error writing log:', error);
  }
}

// Log level helpers
function logInfo(eventType, message, data = null) {
  writeLog('INFO', eventType, message, data);
}

function logWarn(eventType, message, data = null) {
  writeLog('WARN', eventType, message, data);
}

function logError(eventType, message, data = null) {
  writeLog('ERROR', eventType, message, data);
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '종료',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '개발자 도구',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: '새로고침',
          accelerator: 'F5',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '키오스크 영상 다운로더',
              message: '키오스크 영상 다운로더 v1.0.0',
              detail: '키오스크에 할당된 영상을 다운로드하고 관리하는 애플리케이션입니다.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create the main browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Create application menu
  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  loadConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Config management
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(data);
      console.log('Config loaded successfully');
    } else {
      // Create default config
      config = {
        apiUrl: 'http://localhost:8080/api',
        kioskId: '',
        posId: '',
        kioskNo: null,
        downloadPath: path.join(app.getPath('downloads'), 'KioskVideos'),
        autoSync: true,
        syncInterval: 12, // hours
        lastSync: null
      };
      saveConfig();
    }
  } catch (error) {
    console.error('Error loading config:', error);
    config = null;
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('Config saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// IPC Handlers
ipcMain.handle('get-config', async () => {
  return config;
});

ipcMain.handle('save-config', async (event, newConfig) => {
  console.log("[IPC] save-config called with:", newConfig);
  console.trace("[STACK TRACE] save-config call stack:");
  config = { ...config, ...newConfig };
  const success = saveConfig();
  return { success, config };
});

ipcMain.handle('check-config-exists', async () => {
  // Check if config file exists AND has kioskId set
  if (config && config.kioskId && config.kioskId.trim() !== '') {
    return true;
  }
  return false;
});

ipcMain.handle('delete-config', async () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      // Reset to default config
      config = {
        apiUrl: 'http://localhost:8080/api',
        kioskId: '',
        downloadPath: path.join(app.getPath('downloads'), 'KioskVideos'),
        autoSync: true,
        syncInterval: 12,
        lastSync: null
      };
      console.log('Config deleted successfully');
      return { success: true, config };
    }
    return { success: false, error: 'Config file not found' };
  } catch (error) {
    console.error('Error deleting config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-download-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('login', async (event, apiUrl, email, password) => {
  try {
    const axios = require('axios');
    const response = await axios.post(`${apiUrl}/auth/login`, {
      email,
      password
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error logging in:', error);
    return { success: false, error: error.response?.data?.message || error.message };
  }
});

ipcMain.handle('get-kiosk-by-kioskid', async (event, apiUrl, kioskid) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`${apiUrl}/kiosks/kioskid/${encodeURIComponent(kioskid)}`);
    
    // Get kiosk info from config for authentication headers
    const headers = {};
    if (config && config.posId && config.kioskId && config.kioskNo) {
      headers['X-Kiosk-PosId'] = config.posId;
      headers['X-Kiosk-Id'] = config.kioskId;
      headers['X-Kiosk-No'] = config.kioskNo.toString();
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching kiosk by kioskid:', error);
    return { success: false, error: error.response?.data?.message || error.message };
  }
});

ipcMain.handle('get-videos', async (event, apiUrl, kioskId) => {
  try {
    const axios = require('axios');
    // Use by-kioskid endpoint to get kiosk by kioskid string instead of numeric id
    
    // Add kiosk authentication headers
    const headers = {};
    if (config && config.posId && config.kioskId && config.kioskNo) {
      headers['X-Kiosk-PosId'] = config.posId;
      headers['X-Kiosk-Id'] = config.kioskId;
      headers['X-Kiosk-No'] = config.kioskNo.toString();
    }
    
    const response = await axios.get(`${apiUrl}/kiosks/by-kioskid/${encodeURIComponent(kioskId)}/videos-with-status`, { headers });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching videos:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-video', async (event, { apiUrl, videoId, downloadPath, fileName }) => {
  try {
    const axios = require('axios');


    // Add kiosk authentication headers
    const headers = {};
    if (config && config.posId && config.kioskId && config.kioskNo) {
      headers['X-Kiosk-PosId'] = config.posId;
      headers['X-Kiosk-Id'] = config.kioskId;
      headers['X-Kiosk-No'] = config.kioskNo.toString();
    }

    // Get video details with download URL
    const videoResponse = await axios.get(`${apiUrl}/videos/${videoId}`, { headers });
    const video = videoResponse.data;

    if (!video.s3Url) {
      throw new Error('Video URL not found');
    }

    // Ensure download directory exists
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const filePath = path.join(downloadPath, fileName);
    const writer = fs.createWriteStream(filePath);

    // Download video file
    const response = await axios({
      method: 'get',
      url: video.s3Url,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        mainWindow.webContents.send('download-progress', {
          videoId,
          progress: percentCompleted,
          loaded: progressEvent.loaded,
          total: progressEvent.total
        });
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve({ success: true, filePath });
      });
      writer.on('error', (error) => {
        fs.unlink(filePath, () => {}); // Clean up partial file
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-download-status', async (event, { apiUrl, kioskId, videoId, status }) => {
  try {
    const axios = require('axios');
    // Use by-kioskid endpoint to update status by kioskid string instead of numeric id
    
    // Add kiosk authentication headers
    const headers = {};
    if (config && config.posId && config.kioskId && config.kioskNo) {
      headers['X-Kiosk-PosId'] = config.posId;
      headers['X-Kiosk-Id'] = config.kioskId;
      headers['X-Kiosk-No'] = config.kioskNo.toString();
    }
    
    await axios.patch(
      `${apiUrl}/kiosks/by-kioskid/${encodeURIComponent(kioskId)}/videos/${videoId}/status`,
      null,
      { params: { status } }
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating download status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const result = await shell.openPath(filePath);
      if (result) {
        // If result is not empty string, it means there was an error
        return { success: false, error: result };
      }
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-video-player', async (event, { filePath, title }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    // Create video player window
    const videoWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      show: false
    });

    // Encode parameters for URL
    const encodedPath = encodeURIComponent(filePath);
    const encodedTitle = encodeURIComponent(title || 'Video Player');
    const videoPlayerUrl = `file://${path.join(__dirname, 'renderer', 'video-player.html')}?path=${encodedPath}&title=${encodedTitle}`;

    videoWindow.loadURL(videoPlayerUrl);

    // Show window when ready
    videoWindow.once('ready-to-show', () => {
      videoWindow.show();
    });

    // Clean up when window is closed
    videoWindow.on('closed', () => {
      // Window cleanup
    });

    return { success: true };
  } catch (error) {
    console.error('Error opening video player:', error);
    return { success: false, error: error.message };
  }
});

// =====================================
// WebSocket IPC Handlers
// =====================================

ipcMain.handle('websocket-connect', async (event, apiUrl, kioskId, posId, kioskNo) => {
  try {
    console.log('Connecting WebSocket:', apiUrl, kioskId, posId, kioskNo);

    // Disconnect existing connection
    if (stompClient) {
      stompClient.deactivate();
    }

    // Get authentication token
    let accessToken;
    try {
      accessToken = await getKioskToken(apiUrl, kioskId, posId, kioskNo);
    } catch (error) {
      console.error('Failed to get kiosk token:', error);
      return {
        success: false,
        error: 'Failed to authenticate: ' + (error.response?.data?.error || error.message)
      };
    }

    const baseUrl = apiUrl.replace('/api', '');
    const wsUrl = `${baseUrl}/ws`;

    stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        'Authorization': `Bearer ${accessToken}`
      },
      debug: (str) => {
        console.log('STOMP Debug:', str);
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,

      onConnect: (frame) => {
        console.log('WebSocket Connected:', frame);
        isWebSocketConnected = true;

        // Subscribe to kiosk-specific topic FIRST
        stompClient.subscribe(`/topic/kiosk/${kioskId}`, (message) => {
          const data = JSON.parse(message.body);
          console.log('Received kiosk message:', data);
          logInfo('WEBSOCKET_MESSAGE_RECEIVED', `WebSocket 메시지 수신: ${data.type}`, {
            kioskId,
            type: data.type,
            hasData: !!data.data
          });
          if (mainWindow) {
            mainWindow.webContents.send('websocket-message', data);
          }
        });

        // Subscribe to broadcast topic
        stompClient.subscribe('/topic/kiosk/broadcast', (message) => {
          const data = JSON.parse(message.body);
          console.log('Received broadcast message:', data);
          if (mainWindow) {
            mainWindow.webContents.send('websocket-message', data);
          }
        });

        // Send initial connection message
        stompClient.publish({
          destination: '/app/kiosk/connect',
          body: JSON.stringify({ kioskId: kioskId })
        });

        // Start heartbeat
        startWebSocketHeartbeat(kioskId);

        // Notify renderer AFTER subscriptions are set up
        if (mainWindow) {
          mainWindow.webContents.send('websocket-status', {
            connected: true,
            message: 'Connected to server'
          });
        }
      },

      onStompError: (frame) => {
        console.error('STOMP Error:', frame.headers['message']);
        isWebSocketConnected = false;
        if (mainWindow) {
          mainWindow.webContents.send('websocket-status', {
            connected: false,
            message: 'Connection error'
          });
        }
      },

      onWebSocketClose: () => {
        console.log('WebSocket connection closed');
        isWebSocketConnected = false;
        stopWebSocketHeartbeat();
        if (mainWindow) {
          mainWindow.webContents.send('websocket-status', {
            connected: false,
            message: 'Disconnected'
          });
        }
      },

      onWebSocketError: (error) => {
        console.error('WebSocket error:', error);
        isWebSocketConnected = false;
        if (mainWindow) {
          mainWindow.webContents.send('websocket-status', {
            connected: false,
            message: 'Connection failed'
          });
        }
      }
    });

    stompClient.activate();

    return { success: true };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket-disconnect', async () => {
  try {
    if (stompClient) {
      stompClient.deactivate();
      stompClient = null;
    }
    isWebSocketConnected = false;
    stopWebSocketHeartbeat();
    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect WebSocket:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket-send-status', async (event, kioskId, status, details) => {
  try {
    if (!isWebSocketConnected || !stompClient) {
      return { success: false, error: 'Not connected' };
    }

    stompClient.publish({
      destination: '/app/kiosk/status',
      body: JSON.stringify({
        kioskId: kioskId,
        status: status,
        details: details,
        timestamp: new Date().toISOString()
      })
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send WebSocket status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket-sync', async (event, kioskId) => {
  try {
    console.log('WebSocket sync request for kiosk:', kioskId);
    logInfo('SYNC_REQUEST_SENT', 'WebSocket 동기화 요청 전송', { kioskId });

    if (!isWebSocketConnected || !stompClient) {
      console.error('WebSocket not connected');
      logError('SYNC_REQUEST_FAILED', 'WebSocket 미연결 상태', { kioskId });
      return { success: false, error: 'WebSocket not connected' };
    }

    const payload = {
      kioskId: kioskId,
      timestamp: new Date().toISOString()
    };

    console.log('Sending sync request to /app/kiosk/sync:', payload);

    stompClient.publish({
      destination: '/app/kiosk/sync',
      body: JSON.stringify(payload)
    });

    console.log('Sync request sent via WebSocket');
    logInfo('SYNC_REQUEST_SENT', 'WebSocket 동기화 요청 전송 완료', { kioskId });
    return { success: true };
  } catch (error) {
    console.error('Failed to send WebSocket sync request:', error);
    logError('SYNC_REQUEST_ERROR', 'WebSocket 동기화 요청 전송 실패', { kioskId, error: error.message });
    return { success: false, error: error.message };
  }
});

/**
 * Get kiosk authentication token from server
 */
async function getKioskToken(apiUrl, kioskId, posId, kioskNo) {
  try {
    console.log('Requesting kiosk token...');
    const response = await axios.post(`${apiUrl}/kiosk-auth/token`, {
      kioskId: kioskId,
      posId: posId,
      kioskNo: kioskNo
    });

    if (response.data && response.data.accessToken) {
      console.log('Kiosk token obtained successfully');
      return response.data.accessToken;
    } else {
      throw new Error('No access token in response');
    }
  } catch (error) {
    console.error('Error getting kiosk token:', error.response?.data || error.message);
    throw error;
  }
}

function startWebSocketHeartbeat(kioskId) {
  stopWebSocketHeartbeat();

  heartbeatInterval = setInterval(() => {
    if (isWebSocketConnected && stompClient) {
      stompClient.publish({
        destination: '/app/kiosk/heartbeat',
        body: JSON.stringify({
          kioskId: kioskId,
          timestamp: new Date().toISOString()
        })
      });
    }
  }, 30000); // Every 30 seconds
}

function stopWebSocketHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// IPC Handler for logging from renderer process
ipcMain.handle('write-log', async (event, level, eventType, message, data) => {
  try {
    writeLog(level, eventType, message, data);
    return { success: true };
  } catch (error) {
    console.error('Error writing log from renderer:', error);
    return { success: false, error: error.message };
  }
});

// Log app start
logInfo('APP_START', 'Kiosk Video Downloader - Main process started');
console.log('Kiosk Video Downloader - Main process started');
