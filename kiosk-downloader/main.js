const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let config = null;
const CONFIG_FILE = path.join(__dirname, 'config.json');

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

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

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
        downloadPath: path.join(app.getPath('downloads'), 'KioskVideos'),
        autoSync: true,
        syncInterval: 5, // minutes
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
  config = { ...config, ...newConfig };
  const success = saveConfig();
  return { success, config };
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

ipcMain.handle('get-videos', async (event, apiUrl, kioskId) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`${apiUrl}/kiosks/${kioskId}/videos-with-status`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching videos:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-video', async (event, { apiUrl, videoId, downloadPath, fileName }) => {
  try {
    const axios = require('axios');

    // Get video details with download URL
    const videoResponse = await axios.get(`${apiUrl}/videos/${videoId}`);
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
    await axios.patch(
      `${apiUrl}/kiosks/${kioskId}/videos/${videoId}/status`,
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

console.log('Kiosk Video Downloader - Main process started');
