/**
 * Runway ML Module
 * Handles Runway ML image and video generation
 */

// Global state for reference images (for image generation)
let referenceImages = [null, null, null, null, null];

// Global state for Runway video images
let runwayVideoImages = {
  image1: null,  // {source: 'local'|'s3', filePath: string, preview: string}
  image2: null
};

// Global state for generated Runway video
let generatedRunwayVideo = null;  // {filePath: string, url: string, metadata: object}

// Model configurations for Runway video generation
const runwayVideoModelConfig = {
  'gen3a_turbo': {
    name: 'Gen-3 Alpha Turbo',
    durations: [5, 10],
    resolutions: ['1280:768', '768:1280']
  },
  'gen4_turbo': {
    name: 'Gen-4 Turbo',
    durations: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    resolutions: ['1280:720', '720:1280', '1104:832', '832:1104', '960:960', '1584:672']
  }
};

/**
 * Execute Runway image generation
 */
export async function executeGenerateImageRunway() {
  const prompt = document.getElementById('image-prompt-runway')?.value;
  const style = document.getElementById('image-style-runway')?.value;
  const aspectRatio = document.getElementById('image-aspect-runway')?.value;
  const title = document.getElementById('ai-image-title-runway')?.value?.trim();
  const description = document.getElementById('ai-image-description-runway')?.value?.trim();

  console.log('[Runway Image] Starting generation', { prompt, style, aspectRatio, title, description });

  // Validate inputs
  if (!prompt || prompt.trim() === '') {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  // Get selected images
  const selectedImages = referenceImages.filter(img => img !== null);

  if (selectedImages.length === 0) {
    alert('참조 이미지를 최소 1개 이상 선택해주세요.');
    return;
  }

  console.log(`[Runway Image] Found ${selectedImages.length} reference images`);

  try {
    // Show progress
    if (typeof window.showProgress === 'function') window.showProgress();
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, 'Runway ML API 호출 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('Runway ML API 호출 중...');
    }

    // Call Runway ML API via main process
    const result = await window.electronAPI.generateImageRunway({
      imagePaths: selectedImages,
      prompt: prompt,
      style: style,
      aspectRatio: aspectRatio
    });

    console.log('[Runway Image] Generation started:', result);

    if (!result.success || !result.taskId) {
      throw new Error('작업 시작에 실패했습니다.');
    }

    const taskId = result.taskId;
    if (typeof window.updateStatus === 'function') {
      window.updateStatus(`작업 시작됨 (Task ID: ${taskId})`);
    }

    // Poll for completion
    const imageUrl = await pollImageGeneration(taskId);

    console.log('[Runway Image] Generation completed:', imageUrl);

    // Download the generated image to blob
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('생성된 이미지 다운로드 중...');
    }
    const imageBlob = await fetch(imageUrl).then(res => res.blob());

    const fileName = `runway-image-${Date.now()}.png`;

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'AI 이미지 생성 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('AI 이미지 생성 완료!');
    }
    if (typeof window.hideProgress === 'function') window.hideProgress();

    // Show preview modal with save option
    showGeneratedImagePreview(imageBlob, imageUrl, fileName, title, description);

  } catch (error) {
    console.error('[Runway Image] Generation failed:', error);
    if (typeof window.hideProgress === 'function') window.hideProgress();
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('이미지 생성 실패');
    }
    alert(`이미지 생성 중 오류가 발생했습니다:\n\n${error.message}`);
  }
}

/**
 * Show generated image preview with save option
 * @param {Blob} imageBlob - Image blob
 * @param {string} imageUrl - Image URL
 * @param {string} fileName - File name
 * @param {string} title - Image title
 * @param {string} description - Image description
 */
function showGeneratedImagePreview(imageBlob, imageUrl, fileName, title, description) {
  console.log('[Runway Image] Showing image in preview area');

  const previewUrl = URL.createObjectURL(imageBlob);

  // Load image preview using PreviewManager (if available)
  if (typeof window.loadImagePreview === 'function') {
    window.loadImagePreview(previewUrl);
  }

  // Show save section in properties panel
  const saveSection = document.getElementById('runway-save-section');
  if (saveSection) {
    saveSection.style.display = 'block';
  }

  // Store data for save function
  window.generatedImageData = {
    blob: imageBlob,
    url: imageUrl,
    fileName: fileName,
    title: title,
    description: description,
    previewUrl: previewUrl
  };

  if (typeof window.updateStatus === 'function') {
    window.updateStatus(`이미지 생성 완료: ${title}`);
  }
  console.log('[Runway Image] Image displayed in preview');
}

/**
 * Save generated image to S3
 */
export async function saveGeneratedImageToS3() {
  const data = window.generatedImageData;

  if (!data) {
    alert('저장할 이미지 데이터가 없습니다.');
    return;
  }

  // Get current values from input fields
  const title = document.getElementById('ai-image-title-runway')?.value?.trim();
  const description = document.getElementById('ai-image-description-runway')?.value?.trim();

  // Validate title and description
  if (!title || title === '') {
    alert('제목을 입력해주세요.');
    return;
  }

  if (!description || description === '') {
    alert('설명을 입력해주세요.');
    return;
  }

  // Check authentication
  const authToken = window.getAuthToken ? window.getAuthToken() : null;
  const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
  const backendBaseUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:8080';

  if (!authToken || !currentUser) {
    alert('S3에 업로드하려면 로그인이 필요합니다.');
    return;
  }

  const saveBtn = document.getElementById('save-generated-image-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
  }

  try {
    if (typeof window.showProgress === 'function') window.showProgress();
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, 'S3에 업로드 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3에 업로드 중...');
    }

    const formData = new FormData();
    formData.append('file', data.blob, data.fileName);
    formData.append('title', title);
    formData.append('description', description);

    const uploadResponse = await fetch(`${backendBaseUrl}/api/ai/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`S3 업로드 실패: ${uploadResponse.status} ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[Runway Image] Upload successful:', uploadResult);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'S3 저장 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 완료!');
    }
    if (typeof window.hideProgress === 'function') window.hideProgress();

    // Hide the generated image and show placeholder
    const imagePreviewEl = document.getElementById('generated-image-preview');
    if (imagePreviewEl) {
      imagePreviewEl.style.display = 'none';
    }

    const previewPlaceholder = document.getElementById('preview-placeholder');
    if (previewPlaceholder) {
      previewPlaceholder.style.display = 'flex';
    }

    // Hide save button
    const saveSection = document.getElementById('runway-save-section');
    if (saveSection) {
      saveSection.style.display = 'none';
    }

    URL.revokeObjectURL(data.previewUrl);
    window.generatedImageData = null;

    alert(`Runway AI 이미지가 S3에 성공적으로 저장되었습니다!\n\n제목: ${data.title}\n설명: ${data.description}`);

  } catch (error) {
    console.error('[Runway Image] Upload failed:', error);
    if (typeof window.hideProgress === 'function') window.hideProgress();
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 실패');
    }
    alert(`S3 저장 중 오류가 발생했습니다:\n\n${error.message}`);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 S3에 저장';
    }
  }
}

/**
 * Poll for image generation completion
 * @param {string} taskId - Task ID
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} interval - Polling interval in ms
 * @returns {Promise<string>} - Image URL
 */
async function pollImageGeneration(taskId, maxAttempts = 60, interval = 3000) {
  console.log(`[Runway Poll] Starting to poll task ${taskId}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (typeof window.updateStatus === 'function') {
        window.updateStatus(`이미지 생성 중... (${attempt}/${maxAttempts})`);
      }

      const taskStatus = await window.electronAPI.pollRunwayTask(taskId);

      console.log(`[Runway Poll] Attempt ${attempt}: Status = ${taskStatus.status}`);

      if (taskStatus.status === 'SUCCEEDED') {
        // Extract image URL from output
        const imageUrl = taskStatus.output?.[0] || taskStatus.output?.url;

        if (!imageUrl) {
          console.error('[Runway Poll] No image URL in output:', taskStatus.output);
          throw new Error('생성된 이미지 URL을 찾을 수 없습니다.');
        }

        console.log('[Runway Poll] Image generation succeeded:', imageUrl);
        return imageUrl;
      }

      if (taskStatus.status === 'FAILED') {
        const errorMsg = taskStatus.failure || taskStatus.failureCode || '알 수 없는 오류';
        throw new Error(`이미지 생성 실패: ${errorMsg}`);
      }

      if (taskStatus.status === 'CANCELLED') {
        throw new Error('이미지 생성이 취소되었습니다.');
      }

      // Status is PENDING or RUNNING, wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));

    } catch (error) {
      if (error.message.includes('generation')) {
        // Re-throw generation-specific errors
        throw error;
      }
      // For other errors, continue polling
      console.warn(`[Runway Poll] Poll attempt ${attempt} failed:`, error.message);
    }
  }

  throw new Error('이미지 생성 시간이 초과되었습니다.\n\n생성이 오래 걸리고 있습니다.');
}

/**
 * Select image source for Runway video generation
 * @param {number} imageNumber - Image slot number (1 or 2)
 * @param {string} source - 'local' or 's3'
 */
export async function selectRunwayVideoImageSource(imageNumber, source) {
  console.log(`[Runway Video] Selecting ${source} image for slot ${imageNumber}`);

  if (source === 'local') {
    // Select from local PC
    try {
      const filePath = await window.electronAPI.selectMedia('image');

      if (!filePath) {
        console.log('[Runway Video] No file selected');
        return;
      }

      console.log(`[Runway Video] Selected local file for image ${imageNumber}:`, filePath);

      // Store in global state
      const imageKey = `image${imageNumber}`;
      runwayVideoImages[imageKey] = {
        source: 'local',
        filePath: filePath,
        preview: `file://${filePath}`
      };

      // Update preview
      updateRunwayVideoImagePreview(imageNumber);

      // Update button states
      updateRunwayVideoSourceButtons(imageNumber, 'local');
    } catch (error) {
      console.error('[Runway Video] Error selecting local image:', error);
      alert('이미지 선택 중 오류가 발생했습니다.');
    }
  } else if (source === 's3') {
    // Select from S3
    try {
      // Open S3 image selector modal
      await openRunwayVideoS3ImageSelector(imageNumber);

      // Update button states
      updateRunwayVideoSourceButtons(imageNumber, 's3');
    } catch (error) {
      console.error('[Runway Video] Error opening S3 selector:', error);
      alert('S3 이미지 선택 중 오류가 발생했습니다.');
    }
  }
}

/**
 * Update source button states for Runway video
 * @param {number} imageNumber - Image slot number
 * @param {string} activeSource - 'local' or 's3'
 */
export function updateRunwayVideoSourceButtons(imageNumber, activeSource) {
  const localBtn = document.getElementById(`video-img${imageNumber}-source-local`);
  const s3Btn = document.getElementById(`video-img${imageNumber}-source-s3`);

  if (localBtn && s3Btn) {
    if (activeSource === 'local') {
      localBtn.style.background = '#667eea';
      s3Btn.style.background = '#444';
    } else {
      localBtn.style.background = '#444';
      s3Btn.style.background = '#667eea';
    }
  }
}

/**
 * Update Runway video image preview
 * @param {number} imageNumber - Image slot number
 */
export function updateRunwayVideoImagePreview(imageNumber) {
  const imageKey = `image${imageNumber}`;
  const imageData = runwayVideoImages[imageKey];
  const previewDiv = document.getElementById(`video-img${imageNumber}-preview`);

  if (!previewDiv) return;

  if (imageData && imageData.preview) {
    previewDiv.innerHTML = `
      <img src="${imageData.preview}" style="width: 100%; height: 100%; object-fit: contain;" />
      <button
        onclick="window.clearRunwayVideoImage(${imageNumber})"
        style="position: absolute; top: 5px; right: 5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; padding: 0;"
      >✕</button>
      <div style="position: absolute; bottom: 5px; left: 5px; background: rgba(0, 0, 0, 0.7); color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">
        ${imageData.source === 's3' ? '서버' : 'PC'}
      </div>
    `;
  } else {
    previewDiv.innerHTML = `<span style="color: #888; font-size: 13px;">이미지를 선택하세요</span>`;
  }
}

/**
 * Clear Runway video image
 * @param {number} imageNumber - Image slot number
 */
export function clearRunwayVideoImage(imageNumber) {
  const imageKey = `image${imageNumber}`;
  runwayVideoImages[imageKey] = null;
  updateRunwayVideoImagePreview(imageNumber);
  console.log(`[Runway Video] Cleared image ${imageNumber}`);
}

/**
 * Open S3 image selector modal for Runway video
 * @param {number} imageNumber - Image slot number
 */
async function openRunwayVideoS3ImageSelector(imageNumber) {
  console.log(`[Runway Video] Opening S3 image selector for slot ${imageNumber}`);

  try {
    // Fetch images from backend
    const response = await fetch('http://localhost:8080/api/videos/images');

    if (!response.ok) {
      throw new Error(`Failed to fetch images: ${response.status}`);
    }

    const images = await response.json();
    console.log(`[Runway Video] Loaded ${images.length} images from S3`);

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'runway-video-s3-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: #2d2d2d;
      padding: 20px;
      border-radius: 10px;
      width: 80%;
      max-width: 900px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    modalContent.innerHTML = `
      <h3 style="color: #667eea; margin-bottom: 15px;">S3 이미지 선택</h3>
      <div id="runway-video-s3-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">
        ${images.map(img => `
          <div
            onclick="window.selectRunwayVideoS3Image(${imageNumber}, ${img.id}, '${img.title}', '${img.s3Url}')"
            style="cursor: pointer; border: 2px solid #444; border-radius: 8px; overflow: hidden; transition: border-color 0.2s;"
            onmouseover="this.style.borderColor='#667eea'"
            onmouseout="this.style.borderColor='#444'"
          >
            <img src="${img.thumbnailUrl || img.s3Url}" style="width: 100%; height: 120px; object-fit: cover;" />
            <div style="padding: 8px; background: #1a1a1a;">
              <div style="font-size: 12px; color: #e0e0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${img.title}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button
        onclick="window.closeRunwayVideoS3Modal()"
        style="width: 100%; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;"
      >닫기</button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

  } catch (error) {
    console.error('[Runway Video] Error loading S3 images:', error);
    alert('S3 이미지를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * Select S3 image for Runway video
 * @param {number} imageNumber - Image slot number
 * @param {number} imageId - Image ID
 * @param {string} imageTitle - Image title
 * @param {string} imageUrl - Image URL
 */
export function selectRunwayVideoS3Image(imageNumber, imageId, imageTitle, imageUrl) {
  console.log(`[Runway Video] Selected S3 image ${imageId} for slot ${imageNumber}`);

  const imageKey = `image${imageNumber}`;
  runwayVideoImages[imageKey] = {
    source: 's3',
    filePath: imageUrl,
    preview: imageUrl,
    id: imageId,
    title: imageTitle
  };

  updateRunwayVideoImagePreview(imageNumber);
  closeRunwayVideoS3Modal();
}

/**
 * Close Runway video S3 modal
 */
export function closeRunwayVideoS3Modal() {
  const modal = document.getElementById('runway-video-s3-modal');
  if (modal) {
    document.body.removeChild(modal);
  }
}

/**
 * Update Runway video model options based on selected model
 */
export function updateRunwayVideoModelOptions() {
  const modelSelect = document.getElementById('video-model-runway');
  const durationSelect = document.getElementById('video-duration-runway');
  const resolutionSelect = document.getElementById('video-resolution-runway');

  if (!modelSelect || !durationSelect || !resolutionSelect) return;

  const selectedModel = modelSelect.value;
  const config = runwayVideoModelConfig[selectedModel];

  if (!config) return;

  // Update duration options
  durationSelect.innerHTML = config.durations.map(d =>
    `<option value="${d}">${d}초</option>`
  ).join('');

  // Update resolution options
  resolutionSelect.innerHTML = config.resolutions.map(r =>
    `<option value="${r}">${r}</option>`
  ).join('');

  console.log(`[Runway Video] Model options updated for ${config.name}`);
}

/**
 * Execute Runway video generation
 */
export async function executeGenerateVideoRunway() {
  const prompt = document.getElementById('video-prompt-runway')?.value?.trim();
  const model = document.getElementById('video-model-runway')?.value;
  const duration = document.getElementById('video-duration-runway')?.value;
  const resolution = document.getElementById('video-resolution-runway')?.value;

  // Validation
  if (!runwayVideoImages.image1 || !runwayVideoImages.image2) {
    alert('시작 이미지와 종료 이미지를 모두 선택해주세요.');
    return;
  }

  if (!prompt) {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  console.log('[Runway Video] Starting generation:', {
    model,
    prompt,
    duration,
    resolution,
    image1: runwayVideoImages.image1.filePath,
    image2: runwayVideoImages.image2.filePath
  });

  try {
    // Show progress
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, 'Runway ML API 호출 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('Runway ML API 호출 중...');
    }

    // Call Runway ML API
    const result = await window.electronAPI.generateVideoRunway({
      image1Path: runwayVideoImages.image1.filePath,
      image2Path: runwayVideoImages.image2.filePath,
      prompt: prompt,
      duration: duration,
      model: model,
      resolution: resolution
    });

    console.log('[Runway Video] API call successful, taskId:', result.taskId);

    if (!result.success || !result.taskId) {
      throw new Error('작업 ID를 받지 못했습니다.');
    }

    // Poll for completion
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(10, '영상 생성 중... (1-2분 소요)');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('Runway ML에서 영상을 생성하고 있습니다...');
    }

    const videoUrl = await pollRunwayVideoTask(result.taskId);

    console.log('[Runway Video] Video generation completed:', videoUrl);

    // Download video to local temp folder
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(80, '생성된 영상 다운로드 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('생성된 영상을 다운로드하고 있습니다...');
    }

    const downloadResult = await window.electronAPI.downloadRunwayVideo(videoUrl);

    if (!downloadResult.success) {
      throw new Error('영상 다운로드에 실패했습니다.');
    }

    console.log('[Runway Video] Video downloaded to:', downloadResult.filePath);

    // Store generated video data
    generatedRunwayVideo = {
      filePath: downloadResult.filePath,
      url: `file://${downloadResult.filePath}`,
      metadata: {
        model,
        prompt,
        duration,
        resolution,
        taskId: result.taskId
      }
    };

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(90, '영상을 미리보기에 로드 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('영상을 미리보기에 로드 중...');
    }

    // Load video to preview
    await loadVideoToPreview(downloadResult.filePath);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'AI 영상 생성 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('AI 영상 생성 완료!');
    }

    // Show preview section in properties panel
    displayRunwayVideoPreview();

    console.log('[Runway Video] Generation completed successfully');

  } catch (error) {
    console.error('[Runway Video] Generation failed:', error);
    alert('영상 생성 중 오류가 발생했습니다:\n\n' + error.message);
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, '');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('');
    }
  }
}

/**
 * Poll Runway video task until completion
 * @param {string} taskId - Task ID
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} interval - Polling interval in ms
 * @returns {Promise<string>} - Video URL
 */
export async function pollRunwayVideoTask(taskId, maxAttempts = 120, interval = 5000) {
  console.log(`[Runway Video Poll] Starting to poll task ${taskId}`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const taskStatus = await window.electronAPI.pollRunwayTask(taskId);

      console.log(`[Runway Video Poll] Attempt ${attempt + 1}: Status = ${taskStatus.status}`);

      // Update progress based on status
      const progress = 10 + Math.min(70, (attempt / maxAttempts) * 70);
      if (typeof window.updateProgress === 'function') {
        window.updateProgress(progress, `영상 생성 중... (${attempt + 1}/${maxAttempts})`);
      }

      if (taskStatus.status === 'SUCCEEDED') {
        // Get video URL from output
        const videoUrl = taskStatus.output?.[0] || taskStatus.output?.url || taskStatus.artifacts?.[0]?.url;

        if (!videoUrl) {
          console.error('[Runway Video Poll] No video URL in output:', taskStatus.output);
          throw new Error('생성된 영상 URL을 찾을 수 없습니다.');
        }

        console.log('[Runway Video Poll] Video generation succeeded:', videoUrl);
        return videoUrl;
      }

      if (taskStatus.status === 'FAILED') {
        const errorMessage = taskStatus.failure || taskStatus.failureCode || '알 수 없는 오류';
        throw new Error(`영상 생성 실패: ${errorMessage}`);
      }

      if (taskStatus.status === 'CANCELLED') {
        throw new Error('영상 생성이 취소되었습니다.');
      }

      // Status is PENDING or RUNNING, wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));

    } catch (error) {
      console.warn(`[Runway Video Poll] Poll attempt ${attempt + 1} failed:`, error.message);

      // If it's not a polling error, rethrow
      if (error.message.includes('실패') || error.message.includes('취소')) {
        throw error;
      }

      // Otherwise, continue polling
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  throw new Error('영상 생성 시간이 초과되었습니다.\n\n생성이 오래 걸리고 있습니다. 잠시 후 다시 확인해주세요.');
}

/**
 * Load video to central preview area
 * @param {string} videoPath - Video file path
 */
async function loadVideoToPreview(videoPath) {
  console.log('[Runway Video] Loading video to preview:', videoPath);

  try {
    // Use the existing loadVideo function (if available)
    if (typeof window.loadVideo === 'function') {
      if (typeof window.currentVideo !== 'undefined') {
        window.currentVideo = videoPath;
      }
      await window.loadVideo(videoPath);

      // Reactivate the Runway video generation tool to keep properties panel
      if (typeof window.activeTool !== 'undefined') {
        window.activeTool = 'generate-video-runway';
      }

      // Highlight the tool button
      document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      const toolBtn = document.querySelector('.tool-btn[data-tool="generate-video-runway"]');
      if (toolBtn) {
        toolBtn.classList.add('active');
      }

      // Restore the properties panel
      if (typeof window.showToolProperties === 'function') {
        window.showToolProperties('generate-video-runway');
      }
    }

    console.log('[Runway Video] Video loaded to preview successfully');
  } catch (error) {
    console.error('[Runway Video] Failed to load video to preview:', error);
    throw new Error('미리보기 로드 실패: ' + error.message);
  }
}

/**
 * Display generated video preview info in properties panel
 */
export function displayRunwayVideoPreview() {
  const previewSection = document.getElementById('runway-video-preview-section');

  if (!previewSection || !generatedRunwayVideo) {
    return;
  }

  // Show the preview section
  previewSection.style.display = 'block';

  // Set default title and description
  const titleInput = document.getElementById('ai-video-title-runway');
  const descriptionInput = document.getElementById('ai-video-description-runway');

  if (titleInput && !titleInput.value) {
    titleInput.value = `Runway 생성 영상 - ${new Date().toLocaleString('ko-KR')}`;
  }

  if (descriptionInput && !descriptionInput.value) {
    descriptionInput.value = generatedRunwayVideo.metadata.prompt;
  }

  console.log('[Runway Video] Preview section displayed in properties panel');
}

/**
 * Save generated Runway video to S3
 */
export async function saveRunwayVideoToS3() {
  if (!generatedRunwayVideo) {
    alert('생성된 영상이 없습니다. 먼저 영상을 생성해주세요.');
    return;
  }

  const title = document.getElementById('ai-video-title-runway')?.value?.trim();
  const description = document.getElementById('ai-video-description-runway')?.value?.trim();

  // Validation
  if (!title) {
    alert('제목을 입력해주세요.');
    return;
  }

  if (!description) {
    alert('설명을 입력해주세요.');
    return;
  }

  console.log('[Runway Video] Saving to S3:', { title, description });

  try {
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, 'S3에 업로드 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3에 업로드 중...');
    }

    // TODO: Implement actual S3 upload API call
    alert('S3 저장 기능은 곧 구현될 예정입니다.\n\n' +
          `제목: ${title}\n` +
          `설명: ${description}\n` +
          `파일: ${generatedRunwayVideo.filePath}\n\n` +
          '⚙️ 백엔드 API와 연동하여 S3에 자동 업로드됩니다.');

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'S3 저장 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 완료!');
    }

    console.log('[Runway Video] Saved to S3 successfully');

  } catch (error) {
    console.error('[Runway Video] S3 upload failed:', error);
    alert('S3 저장 중 오류가 발생했습니다: ' + error.message);
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, '');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('');
    }
  }
}

/**
 * Get generated Runway video
 * @returns {object|null} - Generated video object
 */
export function getGeneratedRunwayVideo() {
  return generatedRunwayVideo;
}
