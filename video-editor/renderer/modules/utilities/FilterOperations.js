/**
 * FilterOperations.js
 * 비디오 필터 적용 (밝기, 대비, 채도, 블러, 샤픈 등)
 *
 * @module FilterOperations
 */

// ============================================================================
// Filter Types and Configurations
// ============================================================================

export const FILTER_TYPES = {
  BRIGHTNESS: 'brightness',
  CONTRAST: 'contrast',
  SATURATION: 'saturation',
  BLUR: 'blur',
  SHARPEN: 'sharpen'
};

export const FILTER_CONFIGS = {
  brightness: {
    label: '밝기',
    min: -1,
    max: 1,
    step: 0.1,
    default: 0,
    unit: '',
    description: '-1 = 어둡게, 0 = 원본, 1 = 밝게'
  },
  contrast: {
    label: '대비',
    min: 0,
    max: 3,
    step: 0.1,
    default: 1,
    unit: '',
    description: '1 = 원본, 2 = 대비 2배'
  },
  saturation: {
    label: '채도',
    min: 0,
    max: 3,
    step: 0.1,
    default: 1,
    unit: '',
    description: '0 = 흑백, 1 = 원본, 2 = 채도 2배'
  },
  blur: {
    label: '블러 강도',
    paramName: 'sigma',
    min: 0,
    max: 10,
    step: 0.5,
    default: 2,
    unit: '',
    description: '높을수록 강한 블러 효과'
  },
  sharpen: {
    label: '샤픈 강도',
    paramName: 'amount',
    min: 0,
    max: 3,
    step: 0.1,
    default: 1,
    unit: '',
    description: '높을수록 강한 샤픈 효과'
  }
};

// ============================================================================
// Filter UI Generation
// ============================================================================

/**
 * Update filter controls based on selected filter type
 * @param {string} filterType - Filter type (brightness, contrast, etc.)
 */
export function updateFilterControls(filterType) {
  const controlsDiv = document.getElementById('filter-controls');
  if (!controlsDiv) {
    console.error('[FilterOperations] filter-controls element not found');
    return;
  }

  const config = FILTER_CONFIGS[filterType];
  if (!config) {
    controlsDiv.innerHTML = '<p>알 수 없는 필터 타입입니다.</p>';
    return;
  }

  const paramName = config.paramName || filterType;

  controlsDiv.innerHTML = `
    <div class="property-group">
      <label>${config.label} <span class="property-value" id="${paramName}-value">${config.default}</span></label>
      <input
        type="range"
        id="${paramName}"
        min="${config.min}"
        max="${config.max}"
        step="${config.step}"
        value="${config.default}"
        oninput="window.updateFilterValue('${paramName}')"
      >
      <small style="color: #888;">${config.description}</small>
    </div>
  `;
}

/**
 * Update filter value display
 * @param {string} paramName - Parameter name (brightness, sigma, etc.)
 */
export function updateFilterValue(paramName) {
  const input = document.getElementById(paramName);
  const display = document.getElementById(`${paramName}-value`);

  if (input && display) {
    display.textContent = input.value;
  }
}

// ============================================================================
// Filter Execution
// ============================================================================

/**
 * Apply filter to video
 * @param {string} currentVideo - Current video path
 * @param {string} filterType - Filter type
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<{outputPath: string, previousVideo: string}>}
 */
export async function executeFilter(currentVideo, filterType, UIHelpers, loadVideo) {
  if (!currentVideo) {
    UIHelpers.showAlert('먼저 영상을 가져와주세요.');
    return null;
  }

  // Get filter parameters
  const filterParams = getFilterParams(filterType);
  if (!filterParams) {
    UIHelpers.showAlert('필터 파라미터를 가져올 수 없습니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `${getFilterLabel(filterType)} 필터 적용 중...`);

  // Save previous video file path for cleanup
  const previousVideo = currentVideo;

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath: null, // null means create temp file
      filterName: filterType,
      filterParams
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast('필터 적용 완료!', 'success');
    UIHelpers.showCustomDialog(
      '필터 적용 완료!\n\n편집된 내용은 임시 저장되었습니다.\n최종 저장하려면 "비디오 내보내기"를 사용하세요.'
    );

    await loadVideo(result.outputPath);

    // Delete previous temp file if it exists
    if (previousVideo && previousVideo !== result.outputPath) {
      try {
        await window.electronAPI.deleteTempFile(previousVideo);
      } catch (deleteError) {
        console.error('[FilterOperations] Failed to delete temp file:', deleteError);
      }
    }

    return {
      outputPath: result.outputPath,
      previousVideo
    };
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('필터 적용', error, '필터 적용에 실패했습니다.');
    return null;
  }
}

/**
 * Get filter parameters from UI inputs
 * @param {string} filterType - Filter type
 * @returns {object|null} Filter parameters
 */
function getFilterParams(filterType) {
  const config = FILTER_CONFIGS[filterType];
  if (!config) return null;

  const paramName = config.paramName || filterType;
  const input = document.getElementById(paramName);

  if (!input) {
    console.error(`[FilterOperations] Input element '${paramName}' not found`);
    return null;
  }

  const value = parseFloat(input.value);
  return { [paramName]: value };
}

/**
 * Get filter label for display
 * @param {string} filterType - Filter type
 * @returns {string}
 */
function getFilterLabel(filterType) {
  const config = FILTER_CONFIGS[filterType];
  return config ? config.label : filterType;
}

// ============================================================================
// Filter Presets
// ============================================================================

/**
 * Apply predefined filter preset
 * @param {string} presetName - Preset name
 * @param {string} currentVideo - Current video path
 * @param {object} UIHelpers - UI helpers module
 * @param {Function} loadVideo - Load video callback
 * @returns {Promise<object|null>}
 */
export async function applyFilterPreset(presetName, currentVideo, UIHelpers, loadVideo) {
  const presets = {
    // Cinematic look
    cinematic: {
      filterType: 'brightness',
      params: { brightness: -0.1, contrast: 1.2, saturation: 0.8 }
    },
    // Vintage look
    vintage: {
      filterType: 'saturation',
      params: { saturation: 0.7, contrast: 1.1 }
    },
    // High contrast
    dramatic: {
      filterType: 'contrast',
      params: { contrast: 1.5, brightness: 0.1 }
    },
    // Soft focus
    dreamy: {
      filterType: 'blur',
      params: { sigma: 1.5 }
    },
    // Sharp and vivid
    vivid: {
      filterType: 'sharpen',
      params: { amount: 1.5, saturation: 1.3 }
    }
  };

  const preset = presets[presetName];
  if (!preset) {
    UIHelpers.showAlert('존재하지 않는 프리셋입니다.');
    return null;
  }

  UIHelpers.showProgress();
  UIHelpers.updateProgress(0, `${presetName} 프리셋 적용 중...`);

  try {
    const result = await window.electronAPI.applyFilter({
      inputPath: currentVideo,
      outputPath: null,
      filterName: preset.filterType,
      filterParams: preset.params
    });

    UIHelpers.hideProgress();
    UIHelpers.showToast(`${presetName} 프리셋 적용 완료!`, 'success');
    await loadVideo(result.outputPath);

    return result;
  } catch (error) {
    UIHelpers.hideProgress();
    UIHelpers.handleError('프리셋 적용', error, '프리셋 적용에 실패했습니다.');
    return null;
  }
}

// ============================================================================
// Filter Validation
// ============================================================================

/**
 * Validate filter parameters
 * @param {string} filterType - Filter type
 * @param {object} params - Filter parameters
 * @returns {{valid: boolean, error: string}}
 */
export function validateFilterParams(filterType, params) {
  const config = FILTER_CONFIGS[filterType];
  if (!config) {
    return { valid: false, error: '알 수 없는 필터 타입입니다.' };
  }

  const paramName = config.paramName || filterType;
  const value = params[paramName];

  if (value === undefined || value === null) {
    return { valid: false, error: '필터 값이 설정되지 않았습니다.' };
  }

  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: '필터 값은 숫자여야 합니다.' };
  }

  if (value < config.min || value > config.max) {
    return {
      valid: false,
      error: `필터 값은 ${config.min}에서 ${config.max} 사이여야 합니다.`
    };
  }

  return { valid: true, error: '' };
}

// ============================================================================
// Window Exports (for backwards compatibility)
// ============================================================================

if (typeof window !== 'undefined') {
  window.updateFilterValue = updateFilterValue;
}
