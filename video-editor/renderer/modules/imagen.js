/**
 * Google Imagen Image Generation Module
 * Handles text-to-image generation using Google Imagen API via Gemini
 */

// Import necessary functions from other modules
import { getAuthToken, getBackendUrl } from './auth.js';

/**
 * Generate image using Google Imagen API
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - Text prompt for image generation
 * @param {string} params.aspectRatio - Aspect ratio (e.g., '1:1', '16:9', '9:16', '4:3', '3:4')
 * @param {number} params.numberOfImages - Number of images to generate (default: 1)
 * @param {string} params.negativePrompt - Negative prompt (optional)
 * @param {string} params.safetyFilterLevel - Safety filter level (default: 'BLOCK_ONLY_HIGH')
 * @param {string} params.personGeneration - Person generation policy (default: 'ALLOW_ADULT')
 * @returns {Promise<Object>} Generation result
 */
export async function generateImagenImage(params) {
  console.log('[Imagen] Starting image generation:', params);

  try {
    // Show progress
    if (window.showProgress) {
      window.showProgress('Imagen 이미지 생성 중...');
    }
    if (window.updateProgress) {
      window.updateProgress(10, 'Imagen API 호출 중...');
    }

    // Call Imagen API via Electron IPC
    const result = await window.electronAPI.generateImagenImage({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio || '1:1',
      numberOfImages: params.numberOfImages || 1,
      negativePrompt: params.negativePrompt || '',
      safetyFilterLevel: params.safetyFilterLevel || 'BLOCK_ONLY_HIGH',
      personGeneration: params.personGeneration || 'ALLOW_ADULT'
    });

    if (window.updateProgress) {
      window.updateProgress(50, '이미지 생성 완료, 처리 중...');
    }

    console.log('[Imagen] Generation result:', result);

    if (!result.success) {
      throw new Error(result.message || '이미지 생성에 실패했습니다.');
    }

    if (!result.images || result.images.length === 0) {
      throw new Error('생성된 이미지가 없습니다.');
    }

    if (window.updateProgress) {
      window.updateProgress(100, '이미지 생성 완료!');
    }

    if (window.hideProgress) {
      setTimeout(() => window.hideProgress(), 500);
    }

    return result;

  } catch (error) {
    console.error('[Imagen] Generation error:', error);

    if (window.hideProgress) {
      window.hideProgress();
    }

    if (window.handleError) {
      window.handleError('Imagen 이미지 생성 실패', error, '이미지 생성 중 오류가 발생했습니다.');
    } else {
      alert(`이미지 생성 실패: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Upload generated Imagen image to S3
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} title - Image title
 * @param {string} description - Image description
 * @param {string} prompt - Original prompt used for generation
 * @returns {Promise<Object>} Upload result with S3 URL
 */
export async function uploadImagenImageToS3(imageBase64, title, description, prompt) {
  console.log('[Imagen] Uploading image to S3');

  try {
    const authToken = getAuthToken();
    const backendUrl = getBackendUrl();

    if (!authToken) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }

    if (window.updateStatus) {
      window.updateStatus('S3에 이미지 업로드 중...');
    }

    // Upload to S3 via backend API
    const response = await fetch(`${backendUrl}/api/ai/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type: 'IMAGE',
        imageData: imageBase64,
        title: title || '생성된 이미지',
        description: description || '',
        prompt: prompt,
        source: 'IMAGEN',
        imagePurpose: 'REFERENCE'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `S3 업로드 실패 (${response.status})`);
    }

    const result = await response.json();
    console.log('[Imagen] S3 upload successful:', result);

    if (window.updateStatus) {
      window.updateStatus('S3 업로드 완료!');
    }

    return result;

  } catch (error) {
    console.error('[Imagen] S3 upload error:', error);

    if (window.updateStatus) {
      window.updateStatus('S3 업로드 실패');
    }

    throw error;
  }
}

/**
 * Convert base64 image to data URL
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} mimeType - MIME type (default: 'image/png')
 * @returns {string} Data URL
 */
export function base64ToDataUrl(base64Data, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Download image from data URL
 * @param {string} dataUrl - Data URL of image
 * @param {string} filename - Filename for download
 */
export function downloadImageFromDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename || `imagen-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
