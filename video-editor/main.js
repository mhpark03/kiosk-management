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
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'output.mp4',
    filters: [
      { name: 'Videos', extensions: ['mp4'] }
    ]
  });

  if (!result.canceled) {
    return result.filePath;
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

// Trim video
ipcMain.handle('trim-video', async (event, options) => {
  const { inputPath, outputPath, startTime, duration } = options;

  logInfo('TRIM_START', 'Starting video trim', { inputPath, startTime, duration });

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-c', 'copy',
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

      // Send progress updates
      mainWindow.webContents.send('ffmpeg-progress', message);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logInfo('TRIM_SUCCESS', 'Video trim completed', { outputPath });
        resolve({ success: true, outputPath });
      } else {
        logError('TRIM_FAILED', 'Video trim failed', { error: errorOutput });
        reject(new Error(errorOutput || 'FFmpeg failed'));
      }
    });
  });
});

// Add audio to video
ipcMain.handle('add-audio', async (event, options) => {
  const { videoPath, audioPath, outputPath, volumeLevel, audioStartTime } = options;

  logInfo('ADD_AUDIO_START', 'Starting audio addition', { videoPath, audioPath, volumeLevel, audioStartTime });

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
      const hasAudio = await checkAudio();
      logInfo('ADD_AUDIO_CHECK', 'Video audio check', { hasAudio });

      let args;
      const startTimeMs = (audioStartTime || 0) * 1000; // Convert to milliseconds

      if (hasAudio) {
        // Video has audio - mix with new audio
        args = [
          '-i', videoPath,
          '-i', audioPath,
          '-filter_complex', `[1:a]volume=${volumeLevel},adelay=${startTimeMs}|${startTimeMs}[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2`,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-y',
          outputPath
        ];
      } else {
        // Video has no audio - add audio as new track
        args = [
          '-i', videoPath,
          '-i', audioPath,
          '-filter_complex', `[1:a]volume=${volumeLevel},adelay=${startTimeMs}|${startTimeMs}[a1]`,
          '-map', '0:v',
          '-map', '[a1]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          '-y',
          outputPath
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
          logInfo('ADD_AUDIO_SUCCESS', 'Audio addition completed', { outputPath });
          resolve({ success: true, outputPath });
        } else {
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
  const { inputPath, outputPath, filterName, filterParams } = options;

  logInfo('FILTER_START', `Applying ${filterName} filter`, { inputPath, filterParams });

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
  const { videoPaths, outputPath, transition, transitionDuration } = options;

  logInfo('MERGE_START', 'Starting video merge', { videoCount: videoPaths.length, transition });

  // Helper function to get video duration
  const getVideoDuration = (videoPath) => {
    return new Promise((resolve, reject) => {
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
  };

  return new Promise(async (resolve, reject) => {
    try {
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
      } else {
        // Simple concatenation
        for (let i = 0; i < videoPaths.length; i++) {
          filterComplex += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;
        }
        filterComplex += videoPaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${videoPaths.length}:v=1:a=0[outv]`;
      }

      const args = [
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
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

// Add text/subtitle overlay
ipcMain.handle('add-text', async (event, options) => {
  const { inputPath, outputPath, text, fontSize, fontColor, position, startTime, duration } = options;

  logInfo('ADD_TEXT_START', 'Adding text overlay', { text, fontSize });

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
  });
});

logInfo('SYSTEM', 'Kiosk Video Editor initialized');
