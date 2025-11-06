/**
 * Google VEO Video Generation Module
 * Handles image generation with Imagen and image-to-video generation using Google VEO API
 */

// Import Imagen module for image generation
import * as ImagenModule from './imagen.js';

// Global state for VEO reference images (for image generation)
let veoReferenceImages = [null, null, null];
let veoRefImageSourceMode = 'local';  // 'local' or 's3' - tracks which source button is active

// Global state for generated VEO image
let generatedVeoImage = null;  // {imageData: base64, preview: dataUrl}

// Global state for VEO video image
let veoVideoImage = null;  // {source: 'local'|'s3', filePath: string, preview: string}

// Global state for generated VEO video
let generatedVeoVideo = null;  // {url: string, taskId: string}

/**
 * Select reference image for VEO image generation
 * @param {number} index - Reference image slot index (0-4)
 * @param {string} source - 'local' or 's3'
 */
export async function selectVeoRefImage(index, source) {
  console.log(`[VEO Image] Selecting ${source} reference image for slot ${index}`);

  if (source === 'local') {
    // Select from local PC
    try {
      const filePath = await window.electronAPI.selectMedia('image');

      if (!filePath) {
        console.log('[VEO Image] No file selected');
        return;
      }

      console.log(`[VEO Image] Selected local file for slot ${index}:`, filePath);

      // Store in global state
      veoReferenceImages[index] = {
        source: 'local',
        filePath: filePath,
        preview: `file://${filePath}`
      };

      // Update preview
      updateVeoRefImagePreview(index);

    } catch (error) {
      console.error('[VEO Image] Error selecting local image:', error);
      alert('이미지 선택 중 오류가 발생했습니다.');
    }
  } else if (source === 's3') {
    // Select from S3
    try {
      // Open S3 image selector modal
      await openVeoRefImageS3Selector(index);

    } catch (error) {
      console.error('[VEO Image] Error opening S3 selector:', error);
      alert('S3 이미지 선택 중 오류가 발생했습니다.');
    }
  }
}

/**
 * Select source mode for VEO reference images (local or s3)
 * @param {string} source - 'local' or 's3'
 */
export function selectVeoRefImageSource(source) {
  console.log('[VEO Image] Setting reference image source to:', source);
  veoRefImageSourceMode = source;

  // Update button styles
  const localBtn = document.getElementById('veo-ref-img-source-local');
  const s3Btn = document.getElementById('veo-ref-img-source-s3');

  if (localBtn && s3Btn) {
    if (source === 'local') {
      localBtn.style.background = '#667eea';
      s3Btn.style.background = '#444';
    } else {
      localBtn.style.background = '#444';
      s3Btn.style.background = '#667eea';
    }
  }

  // Make slots clickable
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`veo-ref-img-slot-${i}`);
    if (slot) {
      slot.onclick = () => selectVeoRefImageSlot(i);
      slot.style.cursor = 'pointer';
    }
  }
}

/**
 * Select image for specific slot
 * @param {number} index - Slot index (0-4)
 */
async function selectVeoRefImageSlot(index) {
  console.log(`[VEO Image] Selecting ${veoRefImageSourceMode} image for slot ${index}`);
  await selectVeoRefImage(index, veoRefImageSourceMode);
}

/**
 * Update reference image preview
 * @param {number} index - Reference image slot index
 */
export function updateVeoRefImagePreview(index) {
  const imageData = veoReferenceImages[index];
  const slotDiv = document.getElementById(`veo-ref-img-slot-${index}`);

  if (!slotDiv) {
    console.error(`[VEO Image] Slot not found: veo-ref-img-slot-${index}`);
    return;
  }

  if (imageData && imageData.preview) {
    slotDiv.style.border = '2px solid #667eea';
    slotDiv.innerHTML = `
      <img src="${imageData.preview}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;" />
      <button
        onclick="window.clearVeoRefImage(${index}); event.stopPropagation();"
        style="position: absolute; top: 2px; right: 2px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; padding: 0; z-index: 10;"
      >✕</button>
      <div style="position: absolute; bottom: 2px; left: 2px; background: rgba(0, 0, 0, 0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
        ${imageData.source === 's3' ? '서버' : 'PC'}
      </div>
    `;

    // Show in center preview
    showVeoRefImagesInCenterPreview();
  } else {
    slotDiv.style.border = '2px dashed #444';
    slotDiv.innerHTML = `<span style="font-size: 24px;">🖼️</span>`;

    // Update center preview
    showVeoRefImagesInCenterPreview();
  }
}

/**
 * Show VEO reference images in center preview
 */
function showVeoRefImagesInCenterPreview() {
  const centerImagePreview = document.getElementById('generated-image-preview');
  const centerVideoPreview = document.getElementById('preview-video');
  const centerPlaceholder = document.getElementById('preview-placeholder');

  if (!centerImagePreview || !centerVideoPreview || !centerPlaceholder) {
    console.error('[VEO Image] Center preview elements not found');
    return;
  }

  // Get selected images
  const selectedImages = veoReferenceImages.filter(img => img !== null);

  if (selectedImages.length === 0) {
    // No images selected, show placeholder
    centerVideoPreview.style.display = 'none';
    centerImagePreview.style.display = 'none';
    centerPlaceholder.style.display = 'flex';
    return;
  }

  // Hide other elements
  centerVideoPreview.style.display = 'none';
  centerPlaceholder.style.display = 'none';

  // Show first selected image in center
  centerImagePreview.src = selectedImages[0].preview;
  centerImagePreview.style.display = 'block';

  console.log(`[VEO Image] Showing ${selectedImages.length} reference images in center preview`);
}

/**
 * Clear reference image
 * @param {number} index - Reference image slot index
 */
export function clearVeoRefImage(index) {
  veoReferenceImages[index] = null;
  updateVeoRefImagePreview(index);
  console.log(`[VEO Image] Cleared reference image ${index}`);
}

/**
 * Open S3 image selector modal for reference images
 * @param {number} index - Reference image slot index
 */
async function openVeoRefImageS3Selector(index) {
  console.log(`[VEO Image] Opening S3 image selector for slot ${index}`);

  try {
    // Fetch images from backend using common function
    if (!window.fetchMediaFromS3) {
      throw new Error('fetchMediaFromS3 함수를 사용할 수 없습니다.');
    }

    const images = await window.fetchMediaFromS3('image');
    console.log(`[VEO Image] Loaded ${images.length} images from S3`);

    if (images.length === 0) {
      alert('S3에 저장된 이미지가 없습니다.');
      return;
    }

    // Sort by upload date (newest first)
    images.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || a.createdAt || 0);
      const dateB = new Date(b.uploadedAt || b.createdAt || 0);
      return dateB - dateA;
    });

    // Get auth token from auth module
    const token = window.getAuthToken ? window.getAuthToken() : null;
    const baseUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:8080';

    // Get presigned URLs for images
    for (const img of images) {
      if (!img.presignedUrl) {
        try {
          const response = await fetch(`${baseUrl}/api/videos/${img.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const data = await response.json();
            img.presignedUrl = data.s3Url;
          }
        } catch (error) {
          console.error('[VEO Image] Failed to get presigned URL:', error);
        }
      }
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'veo-ref-s3-modal';
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

    modal.innerHTML = `
      <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1200px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">🖼️ S3에서 참조 이미지 선택 (슬롯 ${index + 1})</h2>
          <button onclick="this.closest('#veo-ref-s3-modal').remove()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="color: #aaa; font-size: 13px;">
            총 ${images.length}개의 이미지 파일
          </div>
        </div>

        <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
              <tr style="border-bottom: 2px solid #555;">
                <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">미리보기</th>
                <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
                <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 40%;">설명</th>
                <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
                <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
                <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
              </tr>
            </thead>
            <tbody>
              ${images.map((img, i) => {
                const sizeInMB = img.fileSize ? (img.fileSize / (1024 * 1024)).toFixed(2) : '?';
                let uploadDate = '날짜 없음';
                const dateField = img.uploadedAt || img.createdAt;
                if (dateField) {
                  const date = new Date(dateField);
                  if (!isNaN(date.getTime())) {
                    uploadDate = date.toLocaleDateString('ko-KR');
                  }
                }
                const folder = img.s3Key ? (img.s3Key.includes('images/ai/') ? 'AI' : img.s3Key.includes('images/uploads/') ? '업로드' : '기타') : '?';
                const rowBg = i % 2 === 0 ? '#2d2d2d' : '#333';
                const imageUrl = img.presignedUrl || img.s3Url || '';

                return `
                  <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s; cursor: pointer;"
                      onmouseover="this.style.background='#3a3a5a'"
                      onmouseout="this.style.background='${rowBg}'"
                      onclick="window.selectVeoRefImageFromList(${index}, '${imageUrl.replace(/'/g, "\\'")}')">
                    <td style="padding: 8px; text-align: center;">
                      <img src="${imageUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #555;"/>
                    </td>
                    <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <div style="font-weight: 600;">${img.title || img.filename}</div>
                    </td>
                    <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${img.description || '설명 없음'}
                    </td>
                    <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px;">
                      <span style="background: ${folder === 'AI' ? '#4a5568' : '#2d5a4a'}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                        ${folder}
                      </span>
                    </td>
                    <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px;">
                      ${sizeInMB} MB
                    </td>
                    <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px;">
                      ${uploadDate}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 15px; text-align: right;">
          <button onclick="this.closest('#veo-ref-s3-modal').remove()" class="property-btn" style="padding: 10px 20px; background: #555;">
            닫기
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

  } catch (error) {
    console.error('[VEO Image] Failed to open S3 image selector:', error);
    alert('서버 이미지 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * Select VEO reference image from list (called from modal)
 */
window.selectVeoRefImageFromList = function(index, imageUrl) {
  veoReferenceImages[index] = {
    source: 's3',
    filePath: imageUrl,
    preview: imageUrl
  };
  updateVeoRefImagePreview(index);

  const modal = document.getElementById('veo-ref-s3-modal');
  if (modal) {
    modal.remove();
  }

  console.log(`[VEO Image] Selected S3 image for slot ${index}:`, imageUrl);

  // Show selected images in center preview
  showVeoRefImagesInCenterPreview();
};

/**
 * Generate image for VEO using Imagen API
 */
export async function executeGenerateImageVeo() {
  const prompt = document.getElementById('image-prompt-veo')?.value;
  const aspect = document.getElementById('image-aspect-veo')?.value;

  if (!prompt) {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  // Check for at least 1 reference image
  const selectedImages = veoReferenceImages.filter(img => img !== null);
  if (selectedImages.length === 0) {
    alert('참조 이미지를 최소 1개 이상 선택해주세요.');
    return;
  }

  console.log(`[VEO Image] Starting image generation with ${selectedImages.length} reference images`);
  console.log('[VEO Image] Prompt:', prompt);
  console.log('[VEO Image] Aspect:', aspect);

  try {
    // Show progress
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(10, 'Imagen API 호출 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('Imagen API 호출 중...');
    }

    // Note: Imagen API doesn't natively support reference images like Runway
    // We'll mention reference images in the prompt for context
    const refImageInfo = `참조 이미지 ${selectedImages.length}개 사용. `;
    const fullPrompt = refImageInfo + prompt;

    // Call Imagen API (using the existing Imagen module)
    const result = await window.electronAPI.generateImagenImage({
      prompt: fullPrompt,
      aspectRatio: aspect,
      numberOfImages: 1
    });

    console.log('[VEO Image] Imagen API result:', result);

    if (!result.success || !result.images || result.images.length === 0) {
      throw new Error('이미지 생성에 실패했습니다.');
    }

    // Store generated image (Imagen returns base64)
    const imageData = result.images[0];
    const imageBase64 = imageData.imageBase64;
    const mimeType = imageData.mimeType || 'image/png';
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

    generatedVeoImage = {
      imageData: imageBase64,
      preview: imageDataUrl
    };

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, '이미지 생성 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('이미지 생성 완료!');
    }

    // Display preview
    displayGeneratedVeoImagePreview();

    console.log('[VEO Image] Image generated successfully');

  } catch (error) {
    console.error('[VEO Image] Generation failed:', error);
    alert('이미지 생성 중 오류가 발생했습니다: ' + error.message);
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, '');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('');
    }
  }
}

/**
 * Display generated VEO image preview
 */
function displayGeneratedVeoImagePreview() {
  if (!generatedVeoImage) return;

  // Show in center preview
  const centerImagePreview = document.getElementById('generated-image-preview');
  const centerVideoPreview = document.getElementById('preview-video');
  const centerPlaceholder = document.getElementById('preview-placeholder');

  if (centerImagePreview && centerVideoPreview && centerPlaceholder) {
    centerVideoPreview.style.display = 'none';
    centerPlaceholder.style.display = 'none';
    centerImagePreview.src = generatedVeoImage.preview;
    centerImagePreview.style.display = 'block';
    console.log('[VEO Image] Displaying generated image in center preview');
  }

  // Show S3 save section
  const saveSection = document.getElementById('veo-image-save-section');
  if (saveSection) {
    saveSection.style.display = 'block';
  }

  const previewDiv = document.getElementById('veo-generated-image-preview');
  if (previewDiv) {
    previewDiv.innerHTML = `
      <img src="${generatedVeoImage.preview}" style="width: 100%; height: 100%; object-fit: contain;" />
    `;
  }

  console.log('[VEO Image] Generated image displayed');
}

/**
 * Download generated VEO image
 */
export async function downloadGeneratedVeoImage() {
  if (!generatedVeoImage) {
    alert('다운로드할 이미지가 없습니다.');
    return;
  }

  try {
    // Convert base64 to blob
    const byteCharacters = atob(generatedVeoImage.imageData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veo-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[VEO Image] Image downloaded successfully');
    alert('이미지가 다운로드되었습니다.');

  } catch (error) {
    console.error('[VEO Image] Download failed:', error);
    alert('이미지 다운로드 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * Use generated image for video generation
 */
export function useGeneratedImageForVideo() {
  if (!generatedVeoImage) {
    alert('생성된 이미지가 없습니다.');
    return;
  }

  // Set generated image as video image
  veoVideoImage = {
    source: 'generated',
    filePath: null,  // Not from file
    preview: generatedVeoImage.preview,
    imageData: generatedVeoImage.imageData
  };

  // Update preview
  updateVeoVideoImagePreview();

  console.log('[VEO Video] Using generated image for video generation');
  alert('생성된 이미지가 영상 생성용으로 설정되었습니다.');

  // Scroll to video generation section if available
  const videoSection = document.getElementById('veo-video-generation-section');
  if (videoSection) {
    videoSection.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Save generated VEO image to S3
 */
export async function saveGeneratedVeoImageToS3() {
  if (!generatedVeoImage) {
    alert('저장할 이미지가 없습니다.');
    return;
  }

  const title = document.getElementById('ai-image-title-veo')?.value?.trim();
  const description = document.getElementById('ai-image-description-veo')?.value?.trim();

  if (!title) {
    alert('제목을 입력해주세요.');
    return;
  }

  // Get auth token from auth module
  const token = window.getAuthToken ? window.getAuthToken() : null;
  const baseUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:8080';

  if (!token) {
    alert('로그인이 필요합니다.');
    return;
  }

  try {
    console.log('[VEO Image] Saving to S3...');
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(10, 'S3 저장 준비 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 중...');
    }

    // Convert base64 to blob
    const byteCharacters = atob(generatedVeoImage.imageData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: 'image/png' });

    console.log('[VEO Image] Image blob created, size:', imageBlob.size);

    // Upload to S3 via backend
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(50, 'S3 업로드 중...');
    }

    const formData = new FormData();
    formData.append('file', imageBlob, `veo_image_${Date.now()}.png`);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('mediaType', 'IMAGE');  // Explicitly set media type

    const uploadResponse = await fetch(`${baseUrl}/api/ai/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[VEO Image] Upload result:', uploadResult);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'S3 저장 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 완료!');
    }

    alert('이미지가 S3에 저장되었습니다!\n\n' +
          `제목: ${title}\n` +
          `설명: ${description}\n\n` +
          '백엔드 API와 연동하여 S3에 자동 업로드되었습니다.');

    console.log('[VEO Image] Saved to S3 successfully');

    // Clear form
    document.getElementById('ai-image-title-veo').value = '';
    document.getElementById('ai-image-description-veo').value = '';

  } catch (error) {
    console.error('[VEO Image] S3 upload failed:', error);
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
 * Select image source for VEO video generation
 * @param {string} source - 'local' or 's3'
 */
export async function selectVeoVideoImageSource(source) {
  console.log(`[VEO Video] Selecting ${source} image`);

  if (source === 'local') {
    // Select from local PC
    try {
      const filePath = await window.electronAPI.selectMedia('image');

      if (!filePath) {
        console.log('[VEO Video] No file selected');
        return;
      }

      console.log('[VEO Video] Selected local file:', filePath);

      // Store in global state
      veoVideoImage = {
        source: 'local',
        filePath: filePath,
        preview: `file://${filePath}`
      };

      // Update preview
      updateVeoVideoImagePreview();

      // Update button states
      updateVeoVideoSourceButtons('local');
    } catch (error) {
      console.error('[VEO Video] Error selecting local image:', error);
      alert('이미지 선택 중 오류가 발생했습니다.');
    }
  } else if (source === 's3') {
    // Select from S3
    try {
      // Open S3 image selector modal
      await openVeoVideoS3ImageSelector();

      // Update button states
      updateVeoVideoSourceButtons('s3');
    } catch (error) {
      console.error('[VEO Video] Error opening S3 selector:', error);
      alert('S3 이미지 선택 중 오류가 발생했습니다.');
    }
  }
}

/**
 * Update source button states for video image
 * @param {string} activeSource - 'local' or 's3'
 */
export function updateVeoVideoSourceButtons(activeSource) {
  const localBtn = document.getElementById('veo-video-img-source-local');
  const s3Btn = document.getElementById('veo-video-img-source-s3');

  if (localBtn && s3Btn) {
    if (activeSource === 'local') {
      localBtn.style.background = '#667eea';
      s3Btn.style.background = '#444';
    } else if (activeSource === 's3') {
      localBtn.style.background = '#444';
      s3Btn.style.background = '#667eea';
    }
  }
}

/**
 * Update VEO video image preview
 */
export function updateVeoVideoImagePreview() {
  console.log('[VEO Video] updateVeoVideoImagePreview called');
  const previewDiv = document.getElementById('veo-video-img-preview');
  const centerImagePreview = document.getElementById('generated-image-preview');
  const centerVideoPreview = document.getElementById('preview-video');
  const centerPlaceholder = document.getElementById('preview-placeholder');

  console.log('[VEO Video] previewDiv found:', !!previewDiv);
  console.log('[VEO Video] veoVideoImage:', veoVideoImage);

  if (!previewDiv) {
    console.error('[VEO Video] Preview div not found! ID: veo-video-img-preview');
    return;
  }

  if (veoVideoImage && veoVideoImage.preview) {
    console.log('[VEO Video] Setting preview image:', veoVideoImage.preview);
    const sourceLabel = veoVideoImage.source === 's3' ? '서버' : 'PC';
    previewDiv.innerHTML = `
      <img src="${veoVideoImage.preview}" style="width: 100%; height: 100%; object-fit: contain;" />
      <button
        onclick="window.clearVeoVideoImage()"
        style="position: absolute; top: 5px; right: 5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; padding: 0;"
      >✕</button>
      <div style="position: absolute; bottom: 5px; left: 5px; background: rgba(0, 0, 0, 0.7); color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">
        ${sourceLabel}
      </div>
    `;

    // Show in center preview
    if (centerImagePreview && centerVideoPreview && centerPlaceholder) {
      centerVideoPreview.style.display = 'none';
      centerPlaceholder.style.display = 'none';
      centerImagePreview.src = veoVideoImage.preview;
      centerImagePreview.style.display = 'block';
      console.log('[VEO Video] Image displayed in center preview');
    }
  } else {
    previewDiv.innerHTML = `<span style="color: #888; font-size: 13px;">이미지를 선택하세요</span>`;

    // Hide center preview
    if (centerImagePreview) {
      centerImagePreview.style.display = 'none';
    }
  }
}

/**
 * Clear selected VEO video image
 */
export function clearVeoVideoImage() {
  veoVideoImage = null;
  updateVeoVideoImagePreview();
  console.log('[VEO Video] Cleared video image');
}

/**
 * Open S3 image selector modal for VEO video
 */
async function openVeoVideoS3ImageSelector() {
  console.log('[VEO Video] Opening S3 image selector');

  try {
    // Fetch images from backend using common function
    if (!window.fetchMediaFromS3) {
      throw new Error('fetchMediaFromS3 함수를 사용할 수 없습니다.');
    }

    const images = await window.fetchMediaFromS3('image');
    console.log(`[VEO Video] Loaded ${images.length} images from S3`);

    if (images.length === 0) {
      alert('S3에 저장된 이미지가 없습니다.');
      return;
    }

    // Sort by upload date (newest first)
    images.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || a.createdAt || 0);
      const dateB = new Date(b.uploadedAt || b.createdAt || 0);
      return dateB - dateA;
    });

    // Get auth token from auth module
    const token = window.getAuthToken ? window.getAuthToken() : null;
    const baseUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:8080';

    // Get presigned URLs for images
    for (const img of images) {
      if (!img.presignedUrl) {
        try {
          const response = await fetch(`${baseUrl}/api/videos/${img.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const data = await response.json();
            img.presignedUrl = data.s3Url;
          }
        } catch (error) {
          console.error('[VEO Video] Failed to get presigned URL:', error);
        }
      }
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'veo-video-s3-modal';
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

    modal.innerHTML = `
      <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; width: 90vw; max-width: 1200px; height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #e0e0e0; font-size: 20px;">🖼️ S3에서 시작 이미지 선택</h2>
          <button onclick="this.closest('#veo-video-s3-modal').remove()" style="background: none; border: none; color: #aaa; font-size: 28px; cursor: pointer; padding: 0; width: 35px; height: 35px; line-height: 1;">&times;</button>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="color: #aaa; font-size: 13px;">
            총 ${images.length}개의 이미지 파일
          </div>
        </div>

        <div style="flex: 1; overflow-x: hidden; overflow-y: auto; border: 1px solid #444; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead style="position: sticky; top: 0; background: #333; z-index: 1;">
              <tr style="border-bottom: 2px solid #555;">
                <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">미리보기</th>
                <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 25%;">제목</th>
                <th style="padding: 12px 8px; text-align: left; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 40%;">설명</th>
                <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 70px;">분류</th>
                <th style="padding: 12px 8px; text-align: right; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 80px;">크기</th>
                <th style="padding: 12px 8px; text-align: center; color: #e0e0e0; font-size: 13px; font-weight: 600; width: 100px;">업로드일</th>
              </tr>
            </thead>
            <tbody>
              ${images.map((img, i) => {
                const sizeInMB = img.fileSize ? (img.fileSize / (1024 * 1024)).toFixed(2) : '?';
                let uploadDate = '날짜 없음';
                const dateField = img.uploadedAt || img.createdAt;
                if (dateField) {
                  const date = new Date(dateField);
                  if (!isNaN(date.getTime())) {
                    uploadDate = date.toLocaleDateString('ko-KR');
                  }
                }
                const folder = img.s3Key ? (img.s3Key.includes('images/ai/') ? 'AI' : img.s3Key.includes('images/uploads/') ? '업로드' : '기타') : '?';
                const rowBg = i % 2 === 0 ? '#2d2d2d' : '#333';
                const imageUrl = img.presignedUrl || img.s3Url || '';

                return `
                  <tr style="border-bottom: 1px solid #444; background: ${rowBg}; transition: background 0.2s; cursor: pointer;"
                      onmouseover="this.style.background='#3a3a5a'"
                      onmouseout="this.style.background='${rowBg}'"
                      onclick="window.selectVeoVideoS3Image('${imageUrl.replace(/'/g, "\\'")}')">
                    <td style="padding: 8px; text-align: center;">
                      <img src="${imageUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #555;"/>
                    </td>
                    <td style="padding: 12px 8px; color: #e0e0e0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <div style="font-weight: 600;">${img.title || img.filename}</div>
                    </td>
                    <td style="padding: 12px 8px; color: #aaa; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${img.description || '설명 없음'}
                    </td>
                    <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px;">
                      <span style="background: ${folder === 'AI' ? '#4a5568' : '#2d5a4a'}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                        ${folder}
                      </span>
                    </td>
                    <td style="padding: 12px 8px; text-align: right; color: #aaa; font-size: 12px;">
                      ${sizeInMB} MB
                    </td>
                    <td style="padding: 12px 8px; text-align: center; color: #aaa; font-size: 12px;">
                      ${uploadDate}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 15px; text-align: right;">
          <button onclick="this.closest('#veo-video-s3-modal').remove()" class="property-btn" style="padding: 10px 20px; background: #555;">
            닫기
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

  } catch (error) {
    console.error('[VEO Video] Failed to open S3 image selector:', error);
    alert('서버 이미지 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * Select S3 image for VEO video (called from modal)
 * @param {string} imageUrl - The presigned URL of the selected image
 */
export function selectVeoVideoS3Image(imageUrl) {
  veoVideoImage = {
    source: 's3',
    filePath: imageUrl,
    preview: imageUrl
  };
  updateVeoVideoImagePreview();

  // Close the modal
  const modal = document.getElementById('veo-video-s3-modal');
  if (modal) {
    modal.remove();
  }

  console.log('[VEO Video] Selected S3 image:', imageUrl);
}

/**
 * Generate video with VEO (Image to Video)
 */
export async function executeGenerateVideoVeo() {
  const prompt = document.getElementById('video-prompt-veo')?.value?.trim();
  const duration = document.getElementById('video-duration-veo')?.value || '4';
  const resolution = document.getElementById('video-resolution-veo')?.value || '720p';
  const aspectRatio = document.getElementById('video-aspect-veo')?.value || '16:9';

  // Validate inputs
  if (!prompt) {
    alert('프롬프트를 입력해주세요.');
    return;
  }

  if (!veoVideoImage) {
    alert('시작 이미지를 선택해주세요.');
    return;
  }

  try {
    console.log('[VEO Video] Starting video generation...');
    console.log('[VEO Video] Prompt:', prompt);
    console.log('[VEO Video] Duration:', duration);
    console.log('[VEO Video] Resolution:', resolution);
    console.log('[VEO Video] Aspect Ratio:', aspectRatio);
    console.log('[VEO Video] Image source:', veoVideoImage.source);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(10, '영상 생성 준비 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('영상 생성 준비 중...');
    }


    // Convert image to base64 for API call
    let imageBase64;
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(15, '이미지 로드 중...');
    }

    let imageMimeType = 'image/png'; // Default

    if (veoVideoImage.source === 'local') {
      const imageResponse = await fetch(`file://${veoVideoImage.filePath}`);
      const imageBlob = await imageResponse.blob();
      imageMimeType = imageBlob.type || 'image/png'; // Use original mime type
      console.log(`[VEO Video] Image size: ${imageBlob.size} bytes, type: ${imageMimeType}`);

      // Use FileReader to convert blob to base64 (without compression)
      imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });
    } else if (veoVideoImage.source === 's3') {
      const imageResponse = await fetch(veoVideoImage.filePath);
      const imageBlob = await imageResponse.blob();
      imageMimeType = imageBlob.type || 'image/png'; // Use original mime type
      console.log(`[VEO Video] Image size: ${imageBlob.size} bytes, type: ${imageMimeType}`);

      // Use FileReader to convert blob to base64 (without compression)
      imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });
    }

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(30, 'Google VEO API 요청 중...');
    }

    // Call Google VEO API via Electron main process
    // Note: durationSeconds must be a STRING: "4", "6", or "8"
    const result = await window.electronAPI.generateVeoVideo({
      prompt: prompt,
      imageBase64: imageBase64,
      durationSeconds: duration, // Keep as string
      resolution: resolution,
      aspectRatio: aspectRatio,
      mimeType: imageMimeType // Use original image type
    });

    console.log('[VEO Video] Generation result:', result);

    if (!result.success || !result.videoUrl) {
      throw new Error('Video generation failed or video URL not found');
    }

    // Download video to temp file
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(90, '영상 다운로드 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('영상 다운로드 중...');
    }

    console.log('[VEO Video] Starting download from URL:', result.videoUrl);
    const downloadResult = await window.electronAPI.downloadFile(result.videoUrl, `veo_video_${result.taskId}.mp4`);
    console.log('[VEO Video] Download result:', downloadResult);

    if (!downloadResult || !downloadResult.success) {
      const errorMsg = downloadResult?.error || '알 수 없는 오류';
      console.error('[VEO Video] Download failed:', errorMsg);
      throw new Error(`영상 다운로드에 실패했습니다: ${errorMsg}`);
    }

    if (!downloadResult.filePath) {
      throw new Error('영상 다운로드에 실패했습니다: 파일 경로를 받지 못했습니다.');
    }

    console.log('[VEO Video] Video downloaded to:', downloadResult.filePath);

    // Store generated video info with local path
    generatedVeoVideo = {
      url: result.videoUrl,
      taskId: result.taskId,
      localPath: downloadResult.filePath
    };

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, '영상 생성 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('영상 생성 완료!');
    }

    // Show success message
    alert(`영상이 생성되었습니다!\n\nTask ID: ${result.taskId}\n\n영상을 재생하거나 S3에 저장할 수 있습니다.`);

    // Show preview section
    const previewSection = document.getElementById('veo-video-preview-section');
    if (previewSection) {
      previewSection.style.display = 'block';
    }

    // Load video using existing video loader (with audio check and waveform)
    if (typeof window.loadVideoWithAudioCheck === 'function') {
      await window.loadVideoWithAudioCheck(downloadResult.filePath);
    } else if (typeof window.loadVideo === 'function') {
      await window.loadVideo(downloadResult.filePath);
    }

    console.log('[VEO Video] Video generated and loaded successfully');

  } catch (error) {
    console.error('[VEO Video] Generation failed:', error);
    alert('영상 생성 중 오류가 발생했습니다: ' + error.message);
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(0, '');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('');
    }
  }
}

/**
 * Save generated VEO video to S3
 */
export async function saveVeoVideoToS3() {
  if (!generatedVeoVideo || !generatedVeoVideo.url) {
    alert('저장할 영상이 없습니다. 먼저 영상을 생성해주세요.');
    return;
  }

  const title = document.getElementById('ai-video-title-veo')?.value?.trim();
  const description = document.getElementById('ai-video-description-veo')?.value?.trim();

  if (!title) {
    alert('제목을 입력해주세요.');
    return;
  }

  // Get auth token from auth module
  const token = window.getAuthToken ? window.getAuthToken() : null;
  const baseUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:8080';

  if (!token) {
    alert('로그인이 필요합니다.');
    return;
  }

  try {
    console.log('[VEO Video] Saving to S3...');
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(10, 'S3 저장 준비 중...');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 중...');
    }

    // Use local downloaded file
    if (!generatedVeoVideo.localPath) {
      throw new Error('로컬 파일 경로가 없습니다. 영상을 다시 생성해주세요.');
    }

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(20, '로컬 파일 읽는 중...');
    }

    // Read local file and convert to blob
    const videoResponse = await fetch(`file://${generatedVeoVideo.localPath}`);
    if (!videoResponse.ok) {
      throw new Error('Failed to read local video file');
    }

    const videoBlob = await videoResponse.blob();
    console.log('[VEO Video] Local file read, size:', videoBlob.size);

    // Upload to S3 via backend
    if (typeof window.updateProgress === 'function') {
      window.updateProgress(50, 'S3 업로드 중...');
    }
    const formData = new FormData();
    formData.append('file', videoBlob, `veo_${Date.now()}.mp4`);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('mediaType', 'VIDEO');  // Explicitly set media type

    const uploadResponse = await fetch(`${baseUrl}/api/ai/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('[VEO Video] Upload result:', uploadResult);

    if (typeof window.updateProgress === 'function') {
      window.updateProgress(100, 'S3 저장 완료!');
    }
    if (typeof window.updateStatus === 'function') {
      window.updateStatus('S3 저장 완료!');
    }

    alert('영상이 S3에 저장되었습니다!\n\n' +
          `제목: ${title}\n` +
          `설명: ${description}\n\n` +
          '백엔드 API와 연동하여 S3에 자동 업로드되었습니다.');

    console.log('[VEO Video] Saved to S3 successfully');

    // Clear form
    document.getElementById('ai-video-title-veo').value = '';
    document.getElementById('ai-video-description-veo').value = '';

  } catch (error) {
    console.error('[VEO Video] S3 upload failed:', error);
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
 * Get current VEO video
 * @returns {object|null} - Generated video object
 */
export function getGeneratedVeoVideo() {
  return generatedVeoVideo;
}

/**
 * Get generated VEO image
 * @returns {object|null} - Generated image object
 */
export function getGeneratedVeoImage() {
  return generatedVeoImage;
}

/**
 * Get VEO reference images
 * @returns {array} - Array of reference images
 */
export function getVeoReferenceImages() {
  return veoReferenceImages;
}

/**
 * Get VEO video image
 * @returns {object|null} - Video image object
 */
export function getVeoVideoImage() {
  return veoVideoImage;
}
