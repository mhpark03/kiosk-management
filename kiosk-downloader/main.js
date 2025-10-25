const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const SockJS = require('sockjs-client');
const { Client } = require('@stomp/stompjs');

let mainWindow;
let config = null;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// WebSocket client
let stompClient = null;
let isWebSocketConnected = false;
let heartbeatInterval = null;

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

    if (!isWebSocketConnected || !stompClient) {
      console.error('WebSocket not connected');
      return { success: false, error: 'WebSocket not connected' };
    }

    stompClient.publish({
      destination: '/app/kiosk/sync',
      body: JSON.stringify({
        kioskId: kioskId,
        timestamp: new Date().toISOString()
      })
    });

    console.log('Sync request sent via WebSocket');
    return { success: true };
  } catch (error) {
    console.error('Failed to send WebSocket sync request:', error);
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

console.log('Kiosk Video Downloader - Main process started');
