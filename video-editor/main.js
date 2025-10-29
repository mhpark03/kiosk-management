const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let ffmpegPath;
let ffprobePath;

// Logging system
const LOGS_DIR = path.join(__dirname, 'logs');
let currentLogFilePath = null;
let currentLogDate = null;

// Ensure logs directory exists
function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Get Korea Standard Time formatted string
function toKST(date) {
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day}-${hours}:${minutes}:${seconds}`;
}

// Get log file path for current date
function getLogFilePath() {
  const date = new Date();
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  if (currentLogFilePath && currentLogDate === dateStr) {
    return currentLogFilePath;
  }

  ensureLogsDirectory();

  let sequence = 1;
  let logPath;

  while (true) {
    const seqStr = String(sequence).padStart(3, '0');
    logPath = path.join(LOGS_DIR, `video-editor-${dateStr}-${seqStr}.log`);

    if (!fs.existsSync(logPath)) {
      break;
    }
    sequence++;

    if (sequence > 999) {
      const timestamp = toKST(new Date()).replace(/[/:]/g, '-');
      logPath = path.join(LOGS_DIR, `video-editor-${dateStr}-${timestamp}.log`);
      break;
    }
  }

  currentLogFilePath = logPath;
  currentLogDate = dateStr;
  console.log(`Log file: ${path.basename(logPath)}`);

  return logPath;
}

// Write log entry
function writeLog(level, eventType, message, data = null) {
  const timestamp = toKST(new Date());
  let logEntry = `[${timestamp}] [${level}] [${eventType}] ${message}`;

  if (data) {
    logEntry += ` | Data: ${JSON.stringify(data)}`;
  }

  logEntry += '\n';

  console.log(logEntry.trim());

  const logPath = getLogFilePath();
  try {
    // Write with UTF-8 BOM to ensure proper encoding
    const BOM = '\uFEFF';
    const existingContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

    // Only add BOM if file is new or empty
    if (existingContent.length === 0) {
      fs.writeFileSync(logPath, BOM + logEntry, 'utf8');
    } else {
      fs.appendFileSync(logPath, logEntry, 'utf8');
    }
  } catch (error) {
    console.error('Error writing log:', error);
  }

  // Send to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('log-entry', {
      timestamp,
      level,
      eventType,
      message,
      data
    });
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
          label: '로그 폴더 열기',
          click: () => {
            ensureLogsDirectory();
            shell.openPath(LOGS_DIR);
          }
        },
        { type: 'separator' },
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
      label: '편집',
      submenu: [
        {
          label: '영상 편집 모드',
          accelerator: 'Ctrl+1',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-mode', 'video');
            }
          }
        },
        {
          label: '음성 편집 모드',
          accelerator: 'Ctrl+2',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-mode', 'audio');
            }
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
              title: 'Kiosk Video Editor',
              message: 'Kiosk Video Editor v1.0.0',
              detail: '키오스크 관리 시스템을 위한 고급 영상/음성 편집 도구입니다.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Find FFmpeg executable
function findFFmpegPath() {
  // Check if bundled FFmpeg exists
  const bundledPath = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Check local development path
  const devPath = path.join(__dirname, 'ffmpeg', 'ffmpeg.exe');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Fall back to system PATH
  return 'ffmpeg';
}

// Find FFprobe executable
function findFFprobePath() {
  // Check if bundled FFprobe exists
  const bundledPath = path.join(process.resourcesPath, 'ffmpeg', 'ffprobe.exe');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Check local development path
  const devPath = path.join(__dirname, 'ffmpeg', 'ffprobe.exe');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Fall back to system PATH
  return 'ffprobe';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('renderer/index.html');

  // Create application menu
  createMenu();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logInfo('APP_START', 'Video Editor started');
}

// Set console encoding to UTF-8 for Windows
if (process.platform === 'win32') {
  try {
    // Try to set console output to UTF-8
    const { execSync } = require('child_process');
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch (e) {
    // Ignore if fails
  }
}

app.whenReady().then(() => {
  ffmpegPath = findFFmpegPath();
  ffprobePath = findFFprobePath();
  console.log('FFmpeg path:', ffmpegPath);
  console.log('FFprobe path:', ffprobePath);
  logInfo('SYSTEM', 'FFmpeg tools found', { ffmpegPath, ffprobePath });
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

// IPC Handlers

// Select video file
ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Select audio file
ipcMain.handle('select-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Select output path
ipcMain.handle('select-output', async (event, defaultName) => {
  logInfo('SELECT_OUTPUT', 'File save dialog requested', { defaultName });

  // Detect file type from default name
  const ext = defaultName ? path.extname(defaultName).toLowerCase() : '.mp4';
  let filters;

  if (ext === '.mp3' || ext === '.wav' || ext === '.aac' || ext === '.ogg') {
    // Audio file
    filters = [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'ogg'] },
      { name: 'All Files', extensions: ['*'] }
    ];
  } else {
    // Video file
    filters = [
      { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
      { name: 'All Files', extensions: ['*'] }
    ];
  }

  logInfo('SELECT_OUTPUT', 'Opening save dialog', { defaultPath: defaultName || 'output.mp4', fileType: ext });
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'output.mp4',
    filters: filters
  });

  logInfo('SELECT_OUTPUT', 'Save dialog result', { canceled: result.canceled, filePath: result.filePath });

  if (!result.canceled) {
    let filePath = result.filePath;

    // Check if file exists and add number suffix if needed
    if (fs.existsSync(filePath)) {
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);

      let counter = 1;
      let newFilePath;

      // Find an available filename
      do {
        newFilePath = path.join(dir, `${baseName} (${counter})${ext}`);
        counter++;
      } while (fs.existsSync(newFilePath));

      filePath = newFilePath;
      logInfo('FILE_RENAME', 'File exists, renamed with counter', {
        original: result.filePath,
        renamed: filePath
      });
    }

    return filePath;
  }
  return null;
});

// Get video metadata using FFprobe
ipcMain.handle('get-video-info', async (event, videoPath) => {
  logInfo('VIDEO_INFO_START', 'Getting video information', { videoPath });

  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ];

    logInfo('VIDEO_INFO', 'Running FFprobe', { ffprobePath, args });

    const ffprobe = spawn(ffprobePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString('utf8');
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8');
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          logInfo('VIDEO_INFO_SUCCESS', 'Video information retrieved', {
            duration: info.format.duration,
            size: info.format.size
          });
          resolve(info);
        } catch (e) {
          logError('VIDEO_INFO_FAILED', 'Failed to parse video info', { error: e.message });
          reject(new Error('Failed to parse video info'));
        }
      } else {
        logError('VIDEO_INFO_FAILED', 'FFprobe failed', { code, error: errorOutput });
        reject(new Error(errorOutput || 'FFprobe failed'));
      }
    });

    ffprobe.on('error', (err) => {
      logError('VIDEO_INFO_FAILED', 'FFprobe spawn error', { error: err.message });
      reject(new Error(`FFprobe error: ${err.message}`));
    });
  });
});

// Generate audio waveform image
ipcMain.handle('generate-waveform', async (event, videoPath) => {
  logInfo('WAVEFORM_START', 'Generating audio waveform', { videoPath });

  const path = require('path');
  const os = require('os');

  // Create temp file path for waveform image
  const tempDir = os.tmpdir();
  const waveformPath = path.join(tempDir, `waveform_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    // Generate waveform using FFmpeg showwavespic filter
    // draw=scale - draws a center line for silent parts
    // scale=lin - linear scale for better visibility
    // split_channels=1 - separate stereo channels (L/R) vertically
    const args = [
      '-i', videoPath,
      '-filter_complex',
      '[0:a]showwavespic=s=1200x300:colors=#667eea:draw=scale:scale=lin:split_channels=1[wave]',
      '-map', '[wave]',
      '-frames:v', '1',
      '-y',
      waveformPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8');
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        try {
          // Read the generated PNG and convert to base64
          const imageBuffer = fs.readFileSync(waveformPath);
          const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

          // Clean up temp file
          try {
            fs.unlinkSync(waveformPath);
          } catch (cleanupErr) {
            logError('WAVEFORM_CLEANUP', 'Failed to delete temp waveform file', { error: cleanupErr.message });
          }

          logInfo('WAVEFORM_SUCCESS', 'Waveform generated and converted to base64', { length: base64Image.length });
          resolve(base64Image);
        } catch (readErr) {
          logError('WAVEFORM_READ_FAILED', 'Failed to read waveform file', { error: readErr.message });
          reject(new Error(`Failed to read waveform: ${readErr.message}`));
        }
      } else {
        logError('WAVEFORM_FAILED', 'Waveform generation failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg waveform generation failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      logError('WAVEFORM_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Generate waveform for a specific time range (for zoom)
ipcMain.handle('generate-waveform-range', async (event, options) => {
  const { videoPath, startTime, duration } = options;

  logInfo('WAVEFORM_RANGE_START', 'Generating waveform for time range', {
    videoPath,
    startTime,
    duration
  });

  const path = require('path');
  const os = require('os');

  // First, check if the file has an audio stream
  const hasAudio = await new Promise((resolve) => {
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString('utf8');
    });

    ffprobe.on('close', (code) => {
      const hasAudioStream = output.trim() === 'audio';
      logInfo('AUDIO_STREAM_CHECK', 'Audio stream detection for waveform range', {
        videoPath,
        hasAudioStream,
        output: output.trim()
      });
      resolve(hasAudioStream);
    });
  });

  if (!hasAudio) {
    logError('WAVEFORM_RANGE_NO_AUDIO', 'No audio stream found in video', { videoPath });
    return Promise.reject(new Error('No audio stream found in video file'));
  }

  // Create temp file path for waveform image
  const tempDir = os.tmpdir();
  const waveformPath = path.join(tempDir, `waveform_range_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    // Generate waveform for specific time range using FFmpeg
    // Use atrim filter to precisely trim audio before generating waveform
    const endTime = startTime + duration;
    const args = [
      '-i', videoPath,
      '-filter_complex',
      `[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[trimmed];[trimmed]showwavespic=s=1200x300:colors=#667eea:draw=scale:scale=lin:split_channels=1[wave]`,
      '-map', '[wave]',
      '-frames:v', '1',
      '-y',
      waveformPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8');
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        try {
          // Read the generated PNG and convert to base64
          const imageBuffer = fs.readFileSync(waveformPath);
          const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

          // Clean up temp file
          try {
            fs.unlinkSync(waveformPath);
          } catch (cleanupErr) {
            logError('WAVEFORM_RANGE_CLEANUP', 'Failed to delete temp waveform file', {
              error: cleanupErr.message
            });
          }

          logInfo('WAVEFORM_RANGE_SUCCESS', 'Range waveform generated', {
            length: base64Image.length,
            startTime,
            duration
          });
          resolve(base64Image);
        } catch (readErr) {
          logError('WAVEFORM_RANGE_READ_FAILED', 'Failed to read waveform file', {
            error: readErr.message
          });
          reject(new Error(`Failed to read waveform: ${readErr.message}`));
        }
      } else {
        logError('WAVEFORM_RANGE_FAILED', 'Waveform range generation failed', {
          error: errorOutput
        });
        reject(new Error(errorOutput || 'FFmpeg waveform range generation failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      logError('WAVEFORM_RANGE_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Trim video
ipcMain.handle('trim-video', async (event, options) => {
  let { inputPath, outputPath, startTime, duration } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(tempDir, `${fileName}_trimmed_${timestamp}.mp4`);
  }

  logInfo('TRIM_START', 'Starting video trim', { inputPath, outputPath, startTime, duration });

  // Check if input has audio stream
  const hasAudio = await new Promise((resolve) => {
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString('utf8');
    });

    ffprobe.on('close', (code) => {
      const audioExists = output.trim() === 'audio';
      logInfo('TRIM_AUDIO_CHECK', 'Input audio stream check', { inputPath, hasAudio: audioExists });
      resolve(audioExists);
    });
  });

  return new Promise((resolve, reject) => {
    // Build args based on audio presence
    // IMPORTANT: Put -ss BEFORE -i for faster and more accurate seeking
    const args = [
      '-ss', startTime.toString(),  // Seek before input (faster, more accurate)
      '-i', inputPath,
      '-t', duration.toString(),     // Duration after input
      '-map', '0:v',                 // Map video stream
    ];

    // Add audio mapping only if audio exists
    if (hasAudio) {
      args.push('-map', '0:a');      // Map audio stream
      args.push('-c:v', 'copy');     // Copy video codec
      args.push('-c:a', 'aac');      // Re-encode audio to AAC
      args.push('-b:a', '192k');     // Audio bitrate
      args.push('-ar', '44100');     // Sample rate
      args.push('-ac', '2');         // Stereo channels
    } else {
      args.push('-c:v', 'copy');     // Copy video codec only
      logInfo('TRIM_NO_AUDIO', 'Input has no audio, video only trim', { inputPath });
    }

    args.push('-y', outputPath);

    logInfo('TRIM_FFMPEG_CMD', 'FFmpeg trim command', { hasAudio, args: args.join(' ') });

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;

      // Send progress updates
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('TRIM_SUCCESS', 'Video trim completed', { outputPath, hasAudio });
        resolve({ success: true, outputPath });
      } else {
        logError('TRIM_FAILED', 'Video trim failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });
  });
});

// Trim video only (keep audio intact)
ipcMain.handle('trim-video-only', async (event, options) => {
  let { inputPath, outputPath, startTime, duration } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(tempDir, `${fileName}_trimmed_video_only_${timestamp}.mp4`);
  }

  logInfo('TRIM_VIDEO_ONLY_START', 'Starting video-only trim', { inputPath, outputPath, startTime, duration });

  // Check if input and output are the same file
  const isSameFile = path.resolve(inputPath) === path.resolve(outputPath);

  // If same file, create temp file with proper extension
  let actualOutputPath = outputPath;
  if (isSameFile) {
    const ext = path.extname(outputPath);
    const base = outputPath.slice(0, -ext.length);
    actualOutputPath = `${base}_temp_${Date.now()}${ext}`;
    logInfo('TRIM_VIDEO_ONLY_SAME_FILE', 'Same file detected, using temp file', { actualOutputPath });
  }

  return new Promise((resolve, reject) => {
    // Trim video stream, and also trim audio to match video duration
    const args = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-map', '0:v',    // Map video stream
      '-map', '0:a',    // Map audio stream
      '-c:v', 'libx264', // Re-encode video
      '-c:a', 'aac',    // Re-encode audio (trim applies to both streams)
      '-y',
      actualOutputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // If we used a temp file, replace the original
        if (isSameFile) {
          try {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            fs.renameSync(actualOutputPath, outputPath);
            logInfo('TRIM_VIDEO_ONLY_SUCCESS', 'Video-only trim completed, temp file replaced', { outputPath });
          } catch (err) {
            logError('TRIM_VIDEO_ONLY_REPLACE_FAILED', 'Failed to replace original file', { error: err.message });
            reject(new Error(`Failed to replace file: ${err.message}`));
            return;
          }
        } else {
          logInfo('TRIM_VIDEO_ONLY_SUCCESS', 'Video-only trim completed', { outputPath });
        }
        resolve({ success: true, outputPath });
      } else {
        // Clean up temp file if it exists
        if (isSameFile && fs.existsSync(actualOutputPath)) {
          try {
            fs.unlinkSync(actualOutputPath);
          } catch (err) {
            logError('TRIM_VIDEO_ONLY_CLEANUP_FAILED', 'Failed to clean up temp file', { error: err.message });
          }
        }
        logError('TRIM_VIDEO_ONLY_FAILED', 'Video-only trim failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      // Clean up temp file if it exists
      if (isSameFile && fs.existsSync(actualOutputPath)) {
        try {
          fs.unlinkSync(actualOutputPath);
        } catch (cleanupErr) {
          logError('TRIM_VIDEO_ONLY_CLEANUP_FAILED', 'Failed to clean up temp file', { error: cleanupErr.message });
        }
      }
      logError('TRIM_VIDEO_ONLY_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Trim audio only (keep video intact)
ipcMain.handle('trim-audio-only', async (event, options) => {
  let { inputPath, outputPath, startTime, endTime } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(tempDir, `${fileName}_trimmed_audio_only_${timestamp}.mp4`);
  }

  logInfo('TRIM_AUDIO_ONLY_START', 'Starting audio-only trim', { inputPath, outputPath, startTime, endTime });

  // Check if input and output are the same file
  const isSameFile = path.resolve(inputPath) === path.resolve(outputPath);

  // If same file, create temp file with proper extension
  let actualOutputPath = outputPath;
  if (isSameFile) {
    const ext = path.extname(outputPath);
    const base = outputPath.slice(0, -ext.length);
    actualOutputPath = `${base}_temp_${Date.now()}${ext}`;
    logInfo('TRIM_AUDIO_ONLY_SAME_FILE', 'Same file detected, using temp file', { actualOutputPath });
  }

  // Get video duration using ffprobe
  const getVideoDuration = () => {
    return new Promise((resolve) => {
      const ffprobe = spawn(ffprobePath, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        inputPath
      ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

      let output = '';
      ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
      ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
    });
  };

  return new Promise(async (resolve, reject) => {
    const videoDuration = await getVideoDuration();

    // Use aselect filter to trim audio, then pad with silence to match video duration
    const args = [
      '-i', inputPath,
      '-filter_complex',
      `[0:a]aselect='between(t,${startTime},${endTime})',asetpts=N/SR/TB,apad=whole_dur=${videoDuration}[aout]`,
      '-map', '0:v',    // Map video stream (copy completely)
      '-map', '[aout]', // Map filtered and padded audio
      '-c:v', 'copy',   // Copy video without modification
      '-c:a', 'aac',    // Encode filtered audio
      '-y',
      actualOutputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // If we used a temp file, replace the original
        if (isSameFile) {
          try {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            fs.renameSync(actualOutputPath, outputPath);
            logInfo('TRIM_AUDIO_ONLY_SUCCESS', 'Audio-only trim completed, temp file replaced', { outputPath, videoDuration });
          } catch (err) {
            logError('TRIM_AUDIO_ONLY_REPLACE_FAILED', 'Failed to replace original file', { error: err.message });
            reject(new Error(`Failed to replace file: ${err.message}`));
            return;
          }
        } else {
          logInfo('TRIM_AUDIO_ONLY_SUCCESS', 'Audio-only trim completed (padded to video duration)', { outputPath, videoDuration });
        }
        resolve({ success: true, outputPath });
      } else {
        // Clean up temp file if it exists
        if (isSameFile && fs.existsSync(actualOutputPath)) {
          try {
            fs.unlinkSync(actualOutputPath);
          } catch (err) {
            logError('TRIM_AUDIO_ONLY_CLEANUP_FAILED', 'Failed to clean up temp file', { error: err.message });
          }
        }
        logError('TRIM_AUDIO_ONLY_FAILED', 'Audio-only trim failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      // Clean up temp file if it exists
      if (isSameFile && fs.existsSync(actualOutputPath)) {
        try {
          fs.unlinkSync(actualOutputPath);
        } catch (cleanupErr) {
          logError('TRIM_AUDIO_ONLY_CLEANUP_FAILED', 'Failed to clean up temp file', { error: cleanupErr.message });
        }
      }
      logError('TRIM_AUDIO_ONLY_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Adjust audio volume (audio-only files)
ipcMain.handle('adjust-audio-volume', async (event, options) => {
  const { inputPath, outputPath, volumeLevel } = options;

  logInfo('ADJUST_AUDIO_VOLUME_START', 'Starting audio volume adjustment', { inputPath, outputPath, volumeLevel });

  // If outputPath is null, create temp file
  let actualOutputPath = outputPath;
  if (!actualOutputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    actualOutputPath = path.join(tempDir, `${fileName}_volume_${volumeLevel}x_${timestamp}.mp3`);
    logInfo('ADJUST_AUDIO_VOLUME_TEMP', 'Creating temp file', { actualOutputPath });
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-af', `volume=${volumeLevel}`,
      '-c:a', 'libmp3lame',  // Use MP3 encoder
      '-b:a', '192k',  // Bitrate
      '-y',  // Overwrite output file
      actualOutputPath
    ];

    logInfo('ADJUST_AUDIO_VOLUME_COMMAND', 'Executing FFmpeg command', { ffmpegPath, args });

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stderrOutput = '';

    ffmpeg.stdout.on('data', (data) => {
      const message = data.toString('utf8');
      logInfo('ADJUST_AUDIO_VOLUME_STDOUT', 'FFmpeg stdout', { message: message.trim() });
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      stderrOutput += message;
      logInfo('ADJUST_AUDIO_VOLUME_STDERR', 'FFmpeg stderr', { message: message.trim() });
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('ADJUST_AUDIO_VOLUME_SUCCESS', 'Audio volume adjustment completed', { outputPath: actualOutputPath, code });
        resolve({ outputPath: actualOutputPath, success: true });
      } else {
        logError('ADJUST_AUDIO_VOLUME_FAILED', 'FFmpeg exited with non-zero code', { code, stderr: stderrOutput });
        reject(new Error(stderrOutput || `FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      logError('ADJUST_AUDIO_VOLUME_ERROR', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Add audio to video
ipcMain.handle('add-audio', async (event, options) => {
  let { videoPath, audioPath, outputPath, volumeLevel, audioStartTime, isSilence, silenceDuration, insertMode } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(videoPath, path.extname(videoPath));
    outputPath = path.join(tempDir, `${fileName}_with_audio_${timestamp}.mp4`);
  }

  logInfo('ADD_AUDIO_START', 'Starting audio addition', { videoPath, audioPath, outputPath, volumeLevel, audioStartTime, isSilence, silenceDuration, insertMode });

  // First, check if video has audio stream
  const checkAudio = () => {
    return new Promise((resolve) => {
      const ffprobe = spawn(ffprobePath, [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString('utf8');
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString('utf8');
      });

      ffprobe.on('close', (code) => {
        const hasAudio = output.trim() === 'audio';
        logInfo('AUDIO_CHECK', 'Audio stream detection', {
          code,
          output: output.trim(),
          errorOutput: errorOutput.trim(),
          hasAudio
        });
        resolve(hasAudio);
      });
    });
  };

  return new Promise(async (resolve, reject) => {
    try {
      // Check if input and output are the same file
      const isSameFile = path.resolve(videoPath) === path.resolve(outputPath);

      // If same file, create temp file with proper extension
      let actualOutputPath = outputPath;
      if (isSameFile) {
        const ext = path.extname(outputPath);
        const base = outputPath.slice(0, -ext.length);
        actualOutputPath = `${base}_temp_${Date.now()}${ext}`;
      }

      const hasAudio = await checkAudio();
      logInfo('ADD_AUDIO_CHECK', 'Video audio check', { hasAudio, isSameFile, actualOutputPath });

      let args;
      const startTimeMs = (audioStartTime || 0) * 1000; // Convert to milliseconds

      // Handle silence insertion
      if (isSilence) {
        const mode = insertMode || 'mix';

        if (hasAudio) {
          if (mode === 'overwrite') {
            // Overwrite mode: Replace audio segment with silence
            const endTime = audioStartTime + silenceDuration;

            // Get video duration to ensure audio matches video length
            const getVideoDuration = () => {
              return new Promise((resolve) => {
                const ffprobe = spawn(ffprobePath, [
                  '-v', 'error',
                  '-show_entries', 'format=duration',
                  '-of', 'default=noprint_wrappers=1:nokey=1',
                  videoPath
                ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

                let output = '';
                ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
                ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
              });
            };

            const videoDuration = await getVideoDuration();

            args = [
              '-i', videoPath,
              '-f', 'lavfi',
              '-i', `anullsrc=r=44100:cl=stereo:d=${silenceDuration}`,
              '-filter_complex',
              `[0:a]aselect='lt(t,${audioStartTime})',asetpts=N/SR/TB[before];` +
              `[0:a]aselect='gte(t,${endTime})',asetpts=N/SR/TB[after];` +
              `[before][1:a][after]concat=n=3:v=0:a=1,apad=whole_dur=${videoDuration}[aout]`,
              '-map', '0:v',
              '-map', '[aout]',
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-y',
              actualOutputPath
            ];
          } else if (mode === 'push') {
            // Push mode: Insert silence and push existing audio backward
            args = [
              '-i', videoPath,
              '-f', 'lavfi',
              '-i', `anullsrc=r=44100:cl=stereo:d=${silenceDuration}`,
              '-filter_complex',
              `[0:a]aselect='lt(t,${audioStartTime})',asetpts=N/SR/TB[before];` +
              `[0:a]aselect='gte(t,${audioStartTime})',asetpts=N/SR/TB[after];` +
              `[before][1:a][after]concat=n=3:v=0:a=1[aout]`,
              '-map', '0:v',
              '-map', '[aout]',
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-y',
              actualOutputPath
            ];
          } else {
            // Mix mode (default): Mix silence with existing audio (effectively mutes that section)
            // Get video duration to ensure output matches video length
            const getVideoDuration = () => {
              return new Promise((resolve) => {
                const ffprobe = spawn(ffprobePath, [
                  '-v', 'error',
                  '-show_entries', 'format=duration',
                  '-of', 'default=noprint_wrappers=1:nokey=1',
                  videoPath
                ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

                let output = '';
                ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
                ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
              });
            };

            const videoDuration = await getVideoDuration();

            args = [
              '-i', videoPath,
              '-f', 'lavfi',
              '-i', `anullsrc=r=44100:cl=stereo:d=${silenceDuration}`,
              '-filter_complex', `[1:a]adelay=${startTimeMs}|${startTimeMs}[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=0,volume=1,apad=whole_dur=${videoDuration}[aout]`,
              '-map', '0:v',
              '-map', '[aout]',
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-y',
              actualOutputPath
            ];
          }
        } else {
          // Video has no audio - add silence as new track
          // Get video duration and pad audio to match
          const getVideoDuration = () => {
            return new Promise((resolve) => {
              const ffprobe = spawn(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                videoPath
              ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

              let output = '';
              ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
              ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
            });
          };

          const videoDuration = await getVideoDuration();

          args = [
            '-f', 'lavfi',
            '-i', `anullsrc=r=44100:cl=stereo:d=${silenceDuration}`,
            '-i', videoPath,
            '-filter_complex', `[0:a]adelay=${startTimeMs}|${startTimeMs},apad=whole_dur=${videoDuration}[a1]`,
            '-map', '1:v',
            '-map', '[a1]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-y',
            actualOutputPath
          ];
        }
      } else if (hasAudio) {
        // Video has audio - handle based on insert mode
        const mode = insertMode || 'mix'; // Default to mix if not specified

        if (mode === 'mix') {
          // Mix: Combine existing audio with new audio
          // Get video duration to ensure output matches video length
          const getVideoDuration = () => {
            return new Promise((resolve) => {
              const ffprobe = spawn(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                videoPath
              ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

              let output = '';
              ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
              ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
            });
          };

          const videoDuration = await getVideoDuration();

          args = [
            '-i', videoPath,
            '-i', audioPath,
            '-filter_complex', `[1:a]volume=${volumeLevel},adelay=${startTimeMs}|${startTimeMs}[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2,apad=whole_dur=${videoDuration}[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-y',
            actualOutputPath
          ];
        } else if (mode === 'overwrite') {
          // Overwrite: Replace audio in specified range with new audio
          // Get audio duration and video duration
          const getDuration = (path) => {
            return new Promise((resolve) => {
              const ffprobe = spawn(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                path
              ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

              let output = '';
              ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
              ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
            });
          };

          const audioDuration = await getDuration(audioPath);
          const videoDuration = await getDuration(videoPath);
          const endTime = audioStartTime + audioDuration;

          // Complex filter: extract before/after segments and insert new audio, then pad to video duration
          args = [
            '-i', videoPath,
            '-i', audioPath,
            '-filter_complex',
            `[0:a]aselect='lt(t,${audioStartTime})',asetpts=N/SR/TB[before];` +
            `[1:a]volume=${volumeLevel}[new];` +
            `[0:a]aselect='gte(t,${endTime})',asetpts=N/SR/TB[after];` +
            `[before][new][after]concat=n=3:v=0:a=1,apad=whole_dur=${videoDuration}[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-y',
            actualOutputPath
          ];
        } else if (mode === 'push') {
          // Push: Insert new audio and push existing audio backward
          // Get audio duration from audioPath
          const getAudioDuration = () => {
            return new Promise((resolve) => {
              const ffprobe = spawn(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                audioPath
              ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

              let output = '';
              ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
              ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
            });
          };

          const audioDuration = await getAudioDuration();

          // Split original audio: before insertion point and after
          // Then concatenate: before + new audio + after (with delay)
          args = [
            '-i', videoPath,
            '-i', audioPath,
            '-filter_complex',
            `[0:a]aselect='lt(t,${audioStartTime})',asetpts=N/SR/TB[before];` +
            `[1:a]volume=${volumeLevel}[new];` +
            `[0:a]aselect='gte(t,${audioStartTime})',asetpts=N/SR/TB[after];` +
            `[before][new][after]concat=n=3:v=0:a=1[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-y',
            actualOutputPath
          ];
        }
      } else {
        // Video has no audio - add audio as new track
        // Get video duration and pad audio to match
        const getVideoDuration = () => {
          return new Promise((resolve) => {
            const ffprobe = spawn(ffprobePath, [
              '-v', 'error',
              '-show_entries', 'format=duration',
              '-of', 'default=noprint_wrappers=1:nokey=1',
              videoPath
            ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

            let output = '';
            ffprobe.stdout.on('data', (data) => { output += data.toString('utf8'); });
            ffprobe.on('close', () => { resolve(parseFloat(output.trim()) || 0); });
          });
        };

        const videoDuration = await getVideoDuration();

        args = [
          '-i', videoPath,
          '-i', audioPath,
          '-filter_complex', `[1:a]volume=${volumeLevel},adelay=${startTimeMs}|${startTimeMs},apad=whole_dur=${videoDuration}[a1]`,
          '-map', '0:v',
          '-map', '[a1]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-y',
          actualOutputPath
        ];
      }

      logInfo('ADD_AUDIO_COMMAND', 'FFmpeg command', { args: args.join(' ') });

      const ffmpeg = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        const message = data.toString('utf8');
        errorOutput += message;
        mainWindow.webContents.send('ffmpeg-progress', message);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // If we used a temporary file, replace the original
          if (isSameFile) {
            try {
              fs.unlinkSync(videoPath); // Delete original
              fs.renameSync(actualOutputPath, outputPath); // Rename temp to original
              logInfo('ADD_AUDIO_SUCCESS', 'Audio addition completed (replaced original)', { outputPath });
              resolve({ success: true, outputPath });
            } catch (err) {
              logError('ADD_AUDIO_REPLACE_FAILED', 'Failed to replace original file', { error: err.message });
              reject(new Error(`파일 교체 실패: ${err.message}`));
            }
          } else {
            logInfo('ADD_AUDIO_SUCCESS', 'Audio addition completed', { outputPath });
            resolve({ success: true, outputPath });
          }
        } else {
          // Clean up temp file if it exists
          if (isSameFile && fs.existsSync(actualOutputPath)) {
            try {
              fs.unlinkSync(actualOutputPath);
            } catch (err) {
              // Ignore cleanup errors
            }
          }
          logError('ADD_AUDIO_FAILED', 'Audio addition failed', { error: errorOutput });
          reject(new Error(errorOutput || 'FFmpeg failed'));
        }
      });
    } catch (error) {
      logError('ADD_AUDIO_ERROR', 'Error during audio addition setup', { error: error.message });
      reject(error);
    }
  });
});

// Apply video filter
ipcMain.handle('apply-filter', async (event, options) => {
  let { inputPath, outputPath, filterName, filterParams } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(tempDir, `${fileName}_${filterName}_${timestamp}.mp4`);
  }

  logInfo('FILTER_START', `Applying ${filterName} filter`, { inputPath, outputPath, filterParams });

  let filterString = '';
  switch (filterName) {
    case 'brightness':
      filterString = `eq=brightness=${filterParams.brightness}`;
      break;
    case 'contrast':
      filterString = `eq=contrast=${filterParams.contrast}`;
      break;
    case 'saturation':
      filterString = `eq=saturation=${filterParams.saturation}`;
      break;
    case 'blur':
      filterString = `gblur=sigma=${filterParams.sigma}`;
      break;
    case 'sharpen':
      filterString = `unsharp=5:5:${filterParams.amount}:5:5:0`;
      break;
    case 'rotate':
      filterString = `rotate=${filterParams.angle * Math.PI / 180}`;
      break;
    case 'speed':
      filterString = `setpts=${1 / filterParams.speed}*PTS`;
      break;
    default:
      logError('FILTER_FAILED', 'Unknown filter', { filterName });
      return Promise.reject(new Error('Unknown filter'));
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-vf', filterString,
      '-c:a', 'copy',
      '-y',
      actualOutputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('FILTER_SUCCESS', `${filterName} filter applied`, { outputPath });
        resolve({ success: true, outputPath });
      } else {
        logError('FILTER_FAILED', `${filterName} filter failed`, { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });
  });
});

// Merge multiple videos with transitions
ipcMain.handle('merge-videos', async (event, options) => {
  let { videoPaths, outputPath, transition, transitionDuration } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    outputPath = path.join(tempDir, `merged_video_${timestamp}.mp4`);
  }

  logInfo('MERGE_START', 'Starting video merge', { videoCount: videoPaths.length, transition, outputPath });

  // Helper function to check if video has audio stream
  const hasAudioStream = (videoPath) => {
    return new Promise((resolve) => {
      const ffprobe = spawn(ffprobePath, [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString('utf8');
      });

      ffprobe.on('close', (code) => {
        const hasAudio = output.trim() === 'audio';
        resolve(hasAudio);
      });
    });
  };

  // Helper function to add silent audio to video
  const addSilentAudio = async (videoPath, duration) => {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(videoPath, path.extname(videoPath));
    const outputPathWithAudio = path.join(tempDir, `${fileName}_with_audio_${timestamp}.mp4`);

    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'lavfi',
        '-t', duration.toString(),  // Limit lavfi input duration
        '-i', `aevalsrc='random(0)/10000000:random(1)/10000000':s=44100:c=stereo`,  // Inaudible noise for proper AAC encoding
        '-i', videoPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',   // HIGH BITRATE for silent audio (important!)
        '-ar', '44100',   // Sample rate
        '-ac', '2',       // Stereo channels
        '-map', '1:v',
        '-map', '0:a',
        '-movflags', '+faststart',  // Write moov atom at start for better compatibility
        '-y',
        outputPathWithAudio
      ];

      logInfo('ADD_SILENT_AUDIO', 'Adding silent audio for merge with 192k bitrate', { videoPath, outputPathWithAudio, duration });

      const ffmpeg = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let errorOutput = '';
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString('utf8');
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          logInfo('ADD_SILENT_AUDIO_SUCCESS', 'Silent audio added', { outputPathWithAudio });
          resolve(outputPathWithAudio);
        } else {
          logError('ADD_SILENT_AUDIO_FAILED', 'Failed to add silent audio', { error: errorOutput });
          reject(new Error(errorOutput || 'Failed to add silent audio'));
        }
      });

      ffmpeg.on('error', (err) => {
        logError('ADD_SILENT_AUDIO_ERROR', 'FFmpeg spawn error', { error: err.message });
        reject(new Error(`FFmpeg error: ${err.message}`));
      });
    });
  };

  // Helper function to get video duration
  const getVideoDuration = (videoPath) => {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString('utf8');
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString('utf8');
      });

      ffprobe.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const info = JSON.parse(output);
            const duration = parseFloat(info.format.duration);
            if (isNaN(duration) || duration <= 0) {
              logError('GET_DURATION_INVALID', 'Invalid duration value', { videoPath, duration, output });
              reject(new Error(`Invalid duration: ${duration}`));
            } else {
              resolve(duration);
            }
          } catch (err) {
            logError('GET_DURATION_PARSE_ERROR', 'Failed to parse ffprobe output', { error: err.message, output });
            reject(new Error('Failed to parse duration'));
          }
        } else {
          logError('GET_DURATION_FAILED', 'FFprobe failed', { code, errorOutput });
          reject(new Error('Failed to get video duration'));
        }
      });
    });
  };

  return new Promise(async (resolve, reject) => {
    try {
      // Check all videos for audio and add silent audio if missing
      const processedVideoPaths = [];
      const videoHasAudio = [];  // Track which videos have audio after processing

      for (let i = 0; i < videoPaths.length; i++) {
        const videoPath = videoPaths[i];
        const hasAudio = await hasAudioStream(videoPath);

        if (!hasAudio) {
          logInfo('MERGE_NO_AUDIO', 'Video has no audio, adding silent track', { videoPath, index: i });
          try {
            const duration = await getVideoDuration(videoPath);
            const videoWithAudio = await addSilentAudio(videoPath, duration);

            // Verify audio was actually added
            const hasAudioAfter = await hasAudioStream(videoWithAudio);
            if (hasAudioAfter) {
              processedVideoPaths.push(videoWithAudio);
              videoHasAudio.push(true);
              logInfo('MERGE_AUDIO_ADDED', 'Silent audio added successfully', { index: i, newPath: videoWithAudio });
            } else {
              logWarn('MERGE_AUDIO_ADD_FAILED', 'Audio addition failed, will use anullsrc in filter', { videoPath, index: i });
              processedVideoPaths.push(videoPath);
              videoHasAudio.push(false);
            }
          } catch (err) {
            logError('MERGE_AUDIO_ADD_ERROR', 'Failed to add silent audio', { error: err.message, index: i });
            processedVideoPaths.push(videoPath);
            videoHasAudio.push(false);
          }
        } else {
          logInfo('MERGE_HAS_AUDIO', 'Video already has audio', { videoPath, index: i });
          processedVideoPaths.push(videoPath);
          videoHasAudio.push(true);
        }
      }

      // Use processed video paths for merge
      videoPaths = processedVideoPaths;

      let filterComplex = '';
      let inputs = [];

      // Add all input files
      videoPaths.forEach(path => {
        inputs.push('-i', path);
      });

      // Build filter chain based on transition type
      if (transition === 'xfade') {
        // Get durations of all videos
        const durations = await Promise.all(videoPaths.map(path => getVideoDuration(path)));
        logInfo('MERGE_DURATIONS', 'Video durations', { durations });

        // Normalize all videos first
        for (let i = 0; i < videoPaths.length; i++) {
          filterComplex += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;

          // Generate audio - use input stream if available, otherwise generate silence
          if (videoHasAudio[i]) {
            filterComplex += `[${i}:a]anull[a${i}];`; // Pass through audio stream
          } else {
            filterComplex += `anullsrc=channel_layout=stereo:sample_rate=44100[a${i}];`; // Generate silent audio
          }
        }

        // Apply xfade transitions with correct offsets
        let currentLabel = 'v0';
        let offset = durations[0] - transitionDuration;
        for (let i = 1; i < videoPaths.length; i++) {
          const nextLabel = i === videoPaths.length - 1 ? 'outv' : `v${i}x`;
          filterComplex += `[${currentLabel}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(2)}[${nextLabel}];`;
          currentLabel = nextLabel;
          if (i < videoPaths.length - 1) {
            offset += durations[i] - transitionDuration;
          }
        }

        // Concatenate audio separately (simple concat, no crossfade for audio)
        filterComplex += videoPaths.map((_, i) => `[a${i}]`).join('') + `concat=n=${videoPaths.length}:v=0:a=1[outa]`;
      } else {
        // Simple concatenation - normalize videos and concat with audio
        for (let i = 0; i < videoPaths.length; i++) {
          filterComplex += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;

          // Generate audio - use input stream if available, otherwise generate silence
          if (videoHasAudio[i]) {
            filterComplex += `[${i}:a]anull[a${i}];`; // Pass through audio stream
          } else {
            filterComplex += `anullsrc=channel_layout=stereo:sample_rate=44100[a${i}];`; // Generate silent audio
          }
        }
        // Concat both video and audio
        filterComplex += videoPaths.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;
      }

      const args = [
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-map', '[outa]',  // Map audio output
        '-c:v', 'libx264',
        '-c:a', 'aac',      // Encode audio as AAC
        '-b:a', '192k',     // Audio bitrate (important for quality)
        '-ar', '44100',     // Sample rate
        '-ac', '2',         // Stereo channels
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',  // Write moov atom at start
        '-y',
        outputPath
      ];

      logInfo('MERGE_FFMPEG_CMD', 'FFmpeg merge command', { filterComplex });

      const ffmpeg = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        const message = data.toString('utf8');
        errorOutput += message;
        mainWindow.webContents.send('ffmpeg-progress', message);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          logInfo('MERGE_SUCCESS', 'Video merge completed', { outputPath });
          resolve({ success: true, outputPath });
        } else {
          logError('MERGE_FAILED', 'Video merge failed', { error: errorOutput });
          reject(new Error(errorOutput || 'FFmpeg failed'));
        }
      });
    } catch (error) {
      logError('MERGE_ERROR', 'Error during merge setup', { error: error.message });
      reject(error);
    }
  });
});

// Merge audio files (simple concatenation only)
ipcMain.handle('merge-audios', async (event, options) => {
  const { audioPaths, outputPath } = options;

  logInfo('MERGE_AUDIO_START', 'Starting audio merge (concat)', { audioCount: audioPaths.length });

  return new Promise(async (resolve, reject) => {
    try {
      // If outputPath is null, create temp file
      let actualOutputPath = outputPath;
      if (!actualOutputPath) {
        const os = require('os');
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        actualOutputPath = path.join(tempDir, `merged_audio_${timestamp}.mp3`);
        logInfo('MERGE_AUDIO_TEMP', 'Creating temp file', { actualOutputPath });
      }
      actualOutputPath = actualOutputPath.replace(/\\/g, '/');
      let inputs = [];

      // Add all input files
      audioPaths.forEach(path => {
        inputs.push('-i', path);
      });

      // Simple concatenation using concat filter
      const filterComplex = audioPaths.map((_, i) => `[${i}:a]`).join('') + `concat=n=${audioPaths.length}:v=0:a=1[outa]`;

      const args = [
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[outa]',
        '-c:a', 'libmp3lame',
        '-q:a', '2',
        '-y',
        actualOutputPath
      ];

      logInfo('MERGE_AUDIO_FFMPEG_CMD', 'FFmpeg audio merge command', { args });

      const ffmpeg = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        const message = data.toString('utf8');
        errorOutput += message;
        mainWindow.webContents.send('ffmpeg-progress', message);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          logInfo('MERGE_AUDIO_SUCCESS', 'Audio merge completed', { outputPath: actualOutputPath });
          resolve({ success: true, outputPath: actualOutputPath });
        } else {
          logError('MERGE_AUDIO_FAILED', 'Audio merge failed', { error: errorOutput });
          reject(new Error(errorOutput || 'FFmpeg failed'));
        }
      });
    } catch (error) {
      logError('MERGE_AUDIO_ERROR', 'Error during audio merge setup', { error: error.message });
      reject(error);
    }
  });
});

// Add text/subtitle overlay
ipcMain.handle('add-text', async (event, options) => {
  let { inputPath, outputPath, text, fontSize, fontColor, position, startTime, duration } = options;

  // If outputPath is null, create temp file
  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(tempDir, `${fileName}_text_${timestamp}.mp4`);
  }

  logInfo('ADD_TEXT_START', 'Adding text overlay', { text, fontSize, outputPath });

  return new Promise((resolve, reject) => {
    const x = position.x || '(w-text_w)/2';
    const y = position.y || '(h-text_h)/2';

    let filterString = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;

    if (startTime !== undefined && duration !== undefined) {
      filterString += `:enable='between(t,${startTime},${startTime + duration})'`;
    }

    const args = [
      '-i', inputPath,
      '-vf', filterString,
      '-c:a', 'copy',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('ADD_TEXT_SUCCESS', 'Text overlay added', { outputPath });
        resolve({ success: true, outputPath });
      } else {
        logError('ADD_TEXT_FAILED', 'Text overlay failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });
  });
});

// Extract audio from video
ipcMain.handle('extract-audio', async (event, options) => {
  const { videoPath, outputPath } = options;

  logInfo('EXTRACT_AUDIO_START', 'Extracting audio from video', { videoPath });

  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'mp3',
      '-ab', '192k',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('EXTRACT_AUDIO_SUCCESS', 'Audio extraction completed', { outputPath });
        resolve({ success: true, outputPath });
      } else {
        logError('EXTRACT_AUDIO_FAILED', 'Audio extraction failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      logError('EXTRACT_AUDIO_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Generate silence file
ipcMain.handle('generate-silence-file', async (event, options) => {
  const { duration } = options;

  logInfo('GENERATE_SILENCE_START', 'Generating silence file', { duration });

  // Create temporary file path
  const os = require('os');
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const outputPath = path.join(tempDir, `silence_${timestamp}_${duration}s.mp3`);

  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo:d=${duration}`,
      '-acodec', 'libmp3lame',
      '-ab', '192k',
      '-y',
      outputPath
    ];

    logInfo('GENERATE_SILENCE', 'Running FFmpeg', { ffmpegPath, args });

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('GENERATE_SILENCE_SUCCESS', 'Silence file generated', { outputPath, duration });
        resolve({ success: true, outputPath });
      } else {
        logError('GENERATE_SILENCE_FAILED', 'Silence generation failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      logError('GENERATE_SILENCE_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Trim audio file (for MP3, WAV, etc.)
ipcMain.handle('trim-audio-file', async (event, options) => {
  const { inputPath, outputPath, startTime, endTime } = options;

  logInfo('TRIM_AUDIO_FILE_START', 'Starting audio file trim', { inputPath, startTime, endTime });

  // If outputPath is null, create temp file
  let actualOutputPath;
  let isSameFile = false;

  if (!outputPath) {
    const os = require('os');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const fileName = path.basename(inputPath, path.extname(inputPath));
    actualOutputPath = path.join(tempDir, `${fileName}_trimmed_${timestamp}.mp3`);
    logInfo('TRIM_AUDIO_FILE_TEMP', 'Creating temp file', { actualOutputPath });
  } else {
    // Check if input and output are the same file
    isSameFile = path.resolve(inputPath) === path.resolve(outputPath);

    // If same file, create temp file with proper extension
    if (isSameFile) {
      const ext = path.extname(outputPath);
      const base = outputPath.slice(0, -ext.length);
      actualOutputPath = `${base}_temp_${Date.now()}${ext}`;
      logInfo('TRIM_AUDIO_FILE_SAME_FILE', 'Same file detected, using temp file', { actualOutputPath });
    } else {
      actualOutputPath = outputPath;
    }
  }

  const duration = endTime - startTime;

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-acodec', 'copy',  // Copy codec for lossless trim
      '-y',
      actualOutputPath
    ];

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString('utf8');
      errorOutput += message;
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        let finalOutputPath = actualOutputPath;

        // If we used a temp file for same file replacement, replace the original
        if (isSameFile) {
          try {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            fs.renameSync(actualOutputPath, outputPath);
            finalOutputPath = outputPath;
            logInfo('TRIM_AUDIO_FILE_SUCCESS', 'Audio file trim completed, temp file replaced', { outputPath });
          } catch (err) {
            logError('TRIM_AUDIO_FILE_REPLACE_FAILED', 'Failed to replace original file', { error: err.message });
            reject(new Error(`Failed to replace file: ${err.message}`));
            return;
          }
        } else {
          logInfo('TRIM_AUDIO_FILE_SUCCESS', 'Audio file trim completed', { outputPath: actualOutputPath });
        }
        resolve({ success: true, outputPath: finalOutputPath });
      } else {
        // Clean up temp file if it exists
        if (isSameFile && fs.existsSync(actualOutputPath)) {
          try {
            fs.unlinkSync(actualOutputPath);
          } catch (err) {
            logError('TRIM_AUDIO_FILE_CLEANUP_FAILED', 'Failed to clean up temp file', { error: err.message });
          }
        }
        logError('TRIM_AUDIO_FILE_FAILED', 'Audio file trim failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      // Clean up temp file if it exists
      if (isSameFile && fs.existsSync(actualOutputPath)) {
        try {
          fs.unlinkSync(actualOutputPath);
        } catch (cleanupErr) {
          logError('TRIM_AUDIO_FILE_CLEANUP_FAILED', 'Failed to clean up temp file', { error: cleanupErr.message });
        }
      }
      logError('TRIM_AUDIO_FILE_FAILED', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

// Copy audio file
ipcMain.handle('copy-audio-file', async (event, options) => {
  const { inputPath, outputPath } = options;

  logInfo('COPY_AUDIO_FILE_START', 'Starting audio file copy', { inputPath, outputPath });

  return new Promise((resolve, reject) => {
    try {
      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        const error = 'Input file does not exist';
        logError('COPY_AUDIO_FILE_FAILED', error, { inputPath });
        reject(new Error(error));
        return;
      }

      // Copy file
      fs.copyFileSync(inputPath, outputPath);

      // Check if input file is in temp directory and delete it
      const os = require('os');
      const tempDir = os.tmpdir();
      const inputDir = path.dirname(inputPath);

      if (inputDir === tempDir) {
        try {
          fs.unlinkSync(inputPath);
          logInfo('COPY_AUDIO_FILE_CLEANUP', 'Temp file deleted after export', { inputPath });
        } catch (cleanupError) {
          logError('COPY_AUDIO_FILE_CLEANUP_FAILED', 'Failed to delete temp file', {
            inputPath,
            error: cleanupError.message
          });
          // Don't fail the operation if cleanup fails
        }
      }

      logInfo('COPY_AUDIO_FILE_SUCCESS', 'Audio file copied successfully', { outputPath });
      resolve({ success: true, outputPath });
    } catch (error) {
      logError('COPY_AUDIO_FILE_ERROR', 'Error copying audio file', { error: error.message });
      reject(new Error(`Copy error: ${error.message}`));
    }
  });
});

// Open file with system default application
ipcMain.handle('open-path', async (event, filePath) => {
  const { shell } = require('electron');
  logInfo('OPEN_PATH', 'Opening file with system default application', { filePath });

  try {
    const result = await shell.openPath(filePath);
    if (result) {
      logError('OPEN_PATH_FAILED', 'Failed to open file', { error: result });
      throw new Error(result);
    }
    logInfo('OPEN_PATH_SUCCESS', 'File opened successfully', { filePath });
    return { success: true };
  } catch (error) {
    logError('OPEN_PATH_ERROR', 'Error opening file', { error: error.message });
    throw error;
  }
});

// Delete temp file
ipcMain.handle('delete-temp-file', async (event, filePath) => {
  logInfo('DELETE_TEMP_FILE_START', 'Deleting temp file', { filePath });

  return new Promise((resolve, reject) => {
    try {
      // Check if file is in temp directory
      const os = require('os');
      const tempDir = os.tmpdir();
      const fileDir = path.dirname(filePath);

      if (fileDir !== tempDir) {
        logInfo('DELETE_TEMP_FILE_SKIP', 'File is not in temp directory, skipping', { filePath, fileDir, tempDir });
        resolve({ success: true, skipped: true });
        return;
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logInfo('DELETE_TEMP_FILE_NOT_FOUND', 'File does not exist', { filePath });
        resolve({ success: true, notFound: true });
        return;
      }

      // Delete file
      fs.unlinkSync(filePath);
      logInfo('DELETE_TEMP_FILE_SUCCESS', 'Temp file deleted successfully', { filePath });
      resolve({ success: true });
    } catch (error) {
      logError('DELETE_TEMP_FILE_ERROR', 'Error deleting temp file', { filePath, error: error.message });
      // Don't reject - temp file cleanup failures shouldn't break the app
      resolve({ success: false, error: error.message });
    }
  });
});

// Ensure video has audio track (add silent audio if missing)
ipcMain.handle('ensure-video-has-audio', async (event, videoPath) => {
  logInfo('ENSURE_AUDIO_START', 'Checking video for audio track', { videoPath });

  // Check if video has audio stream
  const hasAudio = await new Promise((resolve) => {
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString('utf8');
    });

    ffprobe.on('close', (code) => {
      const hasAudio = output.trim() === 'audio';
      logInfo('ENSURE_AUDIO_CHECK', 'Audio stream check result', { hasAudio });
      resolve(hasAudio);
    });
  });

  // If video has audio, return original path
  if (hasAudio) {
    logInfo('ENSURE_AUDIO_EXISTS', 'Video already has audio', { videoPath });
    return { hasAudio: true, videoPath };
  }

  // Get video duration
  const duration = await new Promise((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString('utf8');
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()));
      } else {
        reject(new Error('Failed to get video duration'));
      }
    });
  });

  logInfo('ENSURE_AUDIO_DURATION', 'Video duration for silent audio', { duration });

  // Create temp file with silent audio
  const os = require('os');
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const fileName = path.basename(videoPath, path.extname(videoPath));
  const outputPath = path.join(tempDir, `${fileName}_with_audio_${timestamp}.mp4`);

  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'lavfi',
      '-t', duration.toString(),  // Limit lavfi input duration
      '-i', `aevalsrc='random(0)/10000000:random(1)/10000000':s=44100:c=stereo`,  // Inaudible noise for proper AAC encoding
      '-i', videoPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',   // HIGH BITRATE for silent audio (important!)
      '-ar', '44100',   // Sample rate
      '-ac', '2',       // Stereo channels
      '-map', '1:v',  // Map video from second input (videoPath)
      '-map', '0:a',  // Map audio from first input (low noise)
      '-movflags', '+faststart',  // Write moov atom at start for better compatibility
      '-y',
      outputPath
    ];

    logInfo('ENSURE_AUDIO_FFMPEG', 'Adding silent audio track with 192k bitrate', { duration, videoPath, outputPath });

    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString('utf8');
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('ENSURE_AUDIO_SUCCESS', 'Silent audio added successfully', { outputPath });
        resolve({ hasAudio: false, videoPath: outputPath, addedAudio: true });
      } else {
        logError('ENSURE_AUDIO_FAILED', 'Failed to add silent audio', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });

    ffmpeg.on('error', (err) => {
      logError('ENSURE_AUDIO_ERROR', 'FFmpeg spawn error', { error: err.message });
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
});

logInfo('SYSTEM', 'Kiosk Video Editor initialized');
