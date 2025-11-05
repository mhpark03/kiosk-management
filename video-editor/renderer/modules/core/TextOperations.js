/**
 * TextOperations.js
 * 텍스트 오버레이 추가 및 편집
 *
 * @module TextOperations
 *
 * NOTE: 이 모듈은 기본 구조와 인터페이스를 제공합니다.
 * app.js의 해당 함수들을 이 모듈로 옮겨주세요.
 */

// ============================================================================
// Text Overlay Execution
// ============================================================================

/**
 * Add text overlay to video
 * @param {string} videoPath - Video file path
 * @param {string} text - Text content
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {object} textOptions - Text styling options
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string}>}
 *
 * Location in app.js: Line ~2824
 *
 * TODO: Move implementation from app.js
 */
export async function executeAddText(videoPath, text, startTime, endTime, textOptions, UIHelpers, loadVideo) {
  if (!videoPath) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  if (!text || text.trim().length === 0) {
    UIHelpers.showAlert('텍스트를 입력해주세요.');
    return null;
  }

  // Validate time range
  const validation = validateTextRange(startTime, endTime);
  if (!validation.valid) {
    UIHelpers.showAlert(validation.error);
    return null;
  }

  // Validate text options
  const optionsValidation = validateTextOptions(textOptions);
  if (!optionsValidation.valid) {
    UIHelpers.showAlert(optionsValidation.error);
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, '텍스트 추가 중...');

  const previousVideo = videoPath;

  try {
    const result = await window.electronAPI.addText({
      inputPath: videoPath,
      outputPath: null,
      text: text,
      startTime: startTime,
      endTime: endTime,
      fontFile: textOptions.fontFile || 'Arial',
      fontSize: textOptions.fontSize || 48,
      fontColor: textOptions.fontColor || 'white',
      backgroundColor: textOptions.backgroundColor || 'transparent',
      position: textOptions.position || 'center',
      x: textOptions.x || 0,
      y: textOptions.y || 0,
      borderWidth: textOptions.borderWidth || 0,
      borderColor: textOptions.borderColor || 'black',
      shadowX: textOptions.shadowX || 0,
      shadowY: textOptions.shadowY || 0,
      shadowColor: textOptions.shadowColor || 'black'
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('텍스트 추가 완료!', 'success');
    UIHelpers.showCustomDialog(
      `텍스트 추가 완료!\n\n구간: ${formatTime(startTime)} - ${formatTime(endTime)}\n\n편집된 내용은 임시 저장되었습니다.`
    );

    await loadVideo(result.outputPath);

    // Delete previous temp file
    if (previousVideo && previousVideo !== result.outputPath) {
      try {
        await window.electronAPI.deleteTempFile(previousVideo);
      } catch (deleteError) {
        console.error('[TextOperations] Failed to delete temp file:', deleteError);
      }
    }

    return { outputPath: result.outputPath };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('텍스트 추가', error, '텍스트 추가에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Text Overlay UI
// ============================================================================

/**
 * Update text overlay preview on video
 * @param {string} text - Text content
 * @param {object} textOptions - Text styling options
 *
 * Location in app.js: Line ~3100
 *
 * TODO: Move implementation from app.js
 */
export function updateTextOverlay(text, textOptions) {
  const video = document.getElementById('preview-video');
  if (!video) return;

  // Get or create text overlay element
  let textOverlay = document.getElementById('text-overlay-preview');
  if (!textOverlay) {
    textOverlay = document.createElement('div');
    textOverlay.id = 'text-overlay-preview';
    textOverlay.style.position = 'absolute';
    textOverlay.style.pointerEvents = 'none';
    textOverlay.style.zIndex = '1000';
    video.parentElement.appendChild(textOverlay);
  }

  // Apply text content
  textOverlay.textContent = text || '';

  // Apply styling
  const fontSize = textOptions.fontSize || 48;
  const fontColor = textOptions.fontColor || 'white';
  const backgroundColor = textOptions.backgroundColor || 'transparent';
  const borderWidth = textOptions.borderWidth || 0;
  const borderColor = textOptions.borderColor || 'black';
  const shadowX = textOptions.shadowX || 0;
  const shadowY = textOptions.shadowY || 0;
  const shadowColor = textOptions.shadowColor || 'black';

  textOverlay.style.fontSize = `${fontSize}px`;
  textOverlay.style.color = fontColor;
  textOverlay.style.backgroundColor = backgroundColor;
  textOverlay.style.fontFamily = textOptions.fontFamily || 'Arial';
  textOverlay.style.fontWeight = textOptions.fontWeight || 'normal';
  textOverlay.style.textAlign = textOptions.textAlign || 'center';
  textOverlay.style.padding = '10px 20px';

  // Border
  if (borderWidth > 0) {
    textOverlay.style.border = `${borderWidth}px solid ${borderColor}`;
  } else {
    textOverlay.style.border = 'none';
  }

  // Text shadow
  if (shadowX !== 0 || shadowY !== 0) {
    textOverlay.style.textShadow = `${shadowX}px ${shadowY}px 4px ${shadowColor}`;
  } else {
    textOverlay.style.textShadow = 'none';
  }

  // Position
  const position = textOptions.position || 'center';
  const videoRect = video.getBoundingClientRect();

  switch (position) {
    case 'top':
      textOverlay.style.top = '10%';
      textOverlay.style.left = '50%';
      textOverlay.style.transform = 'translateX(-50%)';
      break;
    case 'center':
      textOverlay.style.top = '50%';
      textOverlay.style.left = '50%';
      textOverlay.style.transform = 'translate(-50%, -50%)';
      break;
    case 'bottom':
      textOverlay.style.bottom = '10%';
      textOverlay.style.left = '50%';
      textOverlay.style.transform = 'translateX(-50%)';
      break;
    case 'top-left':
      textOverlay.style.top = '10%';
      textOverlay.style.left = '10%';
      textOverlay.style.transform = 'none';
      break;
    case 'top-right':
      textOverlay.style.top = '10%';
      textOverlay.style.right = '10%';
      textOverlay.style.left = 'auto';
      textOverlay.style.transform = 'none';
      break;
    case 'bottom-left':
      textOverlay.style.bottom = '10%';
      textOverlay.style.left = '10%';
      textOverlay.style.top = 'auto';
      textOverlay.style.transform = 'none';
      break;
    case 'bottom-right':
      textOverlay.style.bottom = '10%';
      textOverlay.style.right = '10%';
      textOverlay.style.left = 'auto';
      textOverlay.style.top = 'auto';
      textOverlay.style.transform = 'none';
      break;
    case 'custom':
      const x = textOptions.x || 0;
      const y = textOptions.y || 0;
      textOverlay.style.left = `${x}px`;
      textOverlay.style.top = `${y}px`;
      textOverlay.style.transform = 'none';
      break;
    default:
      textOverlay.style.top = '50%';
      textOverlay.style.left = '50%';
      textOverlay.style.transform = 'translate(-50%, -50%)';
  }

  // Show overlay
  textOverlay.style.display = text ? 'block' : 'none';
}

/**
 * Clear text overlay preview
 */
export function clearTextOverlay() {
  const textOverlay = document.getElementById('text-overlay-preview');
  if (textOverlay) {
    textOverlay.style.display = 'none';
    textOverlay.textContent = '';
  }
}

/**
 * Update text color preview
 * @param {string} color - Color value (hex, rgb, named)
 *
 * Location in app.js: Line ~3300
 *
 * TODO: Move implementation from app.js
 */
export function updateTextColorPreview(color) {
  const textOverlay = document.getElementById('text-overlay-preview');
  if (textOverlay) {
    textOverlay.style.color = color;
  }

  const colorPreview = document.getElementById('text-color-preview');
  if (colorPreview) {
    colorPreview.style.backgroundColor = color;
  }
}

/**
 * Update text background color preview
 * @param {string} color - Color value (hex, rgb, named, transparent)
 */
export function updateTextBackgroundColorPreview(color) {
  const textOverlay = document.getElementById('text-overlay-preview');
  if (textOverlay) {
    textOverlay.style.backgroundColor = color;
  }

  const colorPreview = document.getElementById('text-bg-color-preview');
  if (colorPreview) {
    colorPreview.style.backgroundColor = color === 'transparent' ? '#ffffff' : color;
    colorPreview.style.opacity = color === 'transparent' ? '0' : '1';
  }
}

// ============================================================================
// Text Font Management
// ============================================================================

/**
 * Get available system fonts
 * @returns {Promise<Array<string>>} List of font names
 */
export async function getAvailableFonts() {
  try {
    const fonts = await window.electronAPI.getSystemFonts();
    return fonts;
  } catch (error) {
    console.error('[TextOperations] Failed to get fonts:', error);
    return ['Arial', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'Georgia'];
  }
}

/**
 * Load custom font file
 * @param {string} fontPath - Font file path
 * @returns {Promise<string>} Font family name
 */
export async function loadCustomFont(fontPath) {
  try {
    const fontName = await window.electronAPI.loadCustomFont(fontPath);
    return fontName;
  } catch (error) {
    console.error('[TextOperations] Failed to load custom font:', error);
    throw error;
  }
}

// ============================================================================
// Text Presets
// ============================================================================

/**
 * Apply text style preset
 * @param {string} presetName - Preset name
 * @returns {object} Text options
 */
export function applyTextPreset(presetName) {
  const presets = {
    // Classic subtitle style
    subtitle: {
      fontSize: 36,
      fontColor: 'white',
      backgroundColor: 'rgba(0,0,0,0.7)',
      position: 'bottom',
      borderWidth: 0,
      shadowX: 2,
      shadowY: 2,
      shadowColor: 'black'
    },
    // Movie title style
    title: {
      fontSize: 72,
      fontColor: 'white',
      backgroundColor: 'transparent',
      position: 'center',
      borderWidth: 3,
      borderColor: 'gold',
      shadowX: 4,
      shadowY: 4,
      shadowColor: 'black'
    },
    // Lower third style
    lowerThird: {
      fontSize: 32,
      fontColor: 'white',
      backgroundColor: 'rgba(0,100,200,0.8)',
      position: 'bottom-left',
      borderWidth: 0,
      shadowX: 0,
      shadowY: 0
    },
    // Watermark style
    watermark: {
      fontSize: 24,
      fontColor: 'rgba(255,255,255,0.5)',
      backgroundColor: 'transparent',
      position: 'top-right',
      borderWidth: 0,
      shadowX: 1,
      shadowY: 1,
      shadowColor: 'black'
    },
    // Karaoke style
    karaoke: {
      fontSize: 48,
      fontColor: 'yellow',
      backgroundColor: 'transparent',
      position: 'bottom',
      borderWidth: 2,
      borderColor: 'black',
      shadowX: 3,
      shadowY: 3,
      shadowColor: 'black'
    }
  };

  return presets[presetName] || presets.subtitle;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate text time range
 * @param {number} startTime - Start time
 * @param {number} endTime - End time
 * @returns {{valid: boolean, error: string}}
 */
export function validateTextRange(startTime, endTime) {
  if (typeof startTime !== 'number' || isNaN(startTime)) {
    return { valid: false, error: '시작 시간은 숫자여야 합니다.' };
  }

  if (typeof endTime !== 'number' || isNaN(endTime)) {
    return { valid: false, error: '종료 시간은 숫자여야 합니다.' };
  }

  if (startTime < 0) {
    return { valid: false, error: '시작 시간은 0보다 커야 합니다.' };
  }

  if (endTime < 0) {
    return { valid: false, error: '종료 시간은 0보다 커야 합니다.' };
  }

  if (startTime >= endTime) {
    return { valid: false, error: '시작 시간은 종료 시간보다 작아야 합니다.' };
  }

  if (endTime - startTime < 0.1) {
    return { valid: false, error: '텍스트 표시 시간은 최소 0.1초 이상이어야 합니다.' };
  }

  return { valid: true, error: '' };
}

/**
 * Validate text options
 * @param {object} textOptions - Text styling options
 * @returns {{valid: boolean, error: string}}
 */
export function validateTextOptions(textOptions) {
  if (!textOptions) {
    return { valid: true, error: '' }; // Use defaults
  }

  // Validate font size
  if (textOptions.fontSize !== undefined) {
    if (typeof textOptions.fontSize !== 'number' || textOptions.fontSize < 8 || textOptions.fontSize > 200) {
      return { valid: false, error: '폰트 크기는 8에서 200 사이여야 합니다.' };
    }
  }

  // Validate border width
  if (textOptions.borderWidth !== undefined) {
    if (typeof textOptions.borderWidth !== 'number' || textOptions.borderWidth < 0 || textOptions.borderWidth > 20) {
      return { valid: false, error: '테두리 두께는 0에서 20 사이여야 합니다.' };
    }
  }

  // Validate position
  const validPositions = ['top', 'center', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom'];
  if (textOptions.position && !validPositions.includes(textOptions.position)) {
    return {
      valid: false,
      error: `유효하지 않은 위치입니다. 가능한 값: ${validPositions.join(', ')}`
    };
  }

  return { valid: true, error: '' };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert color name to hex
 * @param {string} color - Color name or value
 * @returns {string} Hex color value
 */
export function colorToHex(color) {
  const colorMap = {
    'white': '#FFFFFF',
    'black': '#000000',
    'red': '#FF0000',
    'green': '#00FF00',
    'blue': '#0000FF',
    'yellow': '#FFFF00',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF',
    'orange': '#FFA500',
    'purple': '#800080',
    'pink': '#FFC0CB',
    'gray': '#808080',
    'transparent': 'transparent'
  };

  return colorMap[color.toLowerCase()] || color;
}

/**
 * Get text bounding box size
 * @param {string} text - Text content
 * @param {number} fontSize - Font size
 * @param {string} fontFamily - Font family
 * @returns {{width: number, height: number}}
 */
export function getTextSize(text, fontSize, fontFamily) {
  // Create temporary canvas to measure text
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}`;

  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const height = fontSize * 1.2; // Approximate height

  return { width, height };
}
