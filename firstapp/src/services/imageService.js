import axios from 'axios';

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Generate image using AI from multiple reference images
 * @param {File[]} images - Array of reference images (1-5 images)
 * @param {string} prompt - Text description for image generation
 * @param {string} style - Style of the generated image
 * @param {string} aspectRatio - Aspect ratio of the generated image
 * @returns {Promise<object>} - Generated image information
 */
export async function generateImage(images, prompt, style = 'realistic', aspectRatio = '1:1') {
  try {
    console.log('Sending image generation request...');
    console.log('Number of reference images:', images.filter(img => img !== null).length);
    console.log('Prompt:', prompt);
    console.log('Style:', style);
    console.log('Aspect Ratio:', aspectRatio);

    // Create FormData to send files
    const formData = new FormData();

    // Add images (filter out null values)
    images.filter(img => img !== null).forEach((image, index) => {
      formData.append(`image${index + 1}`, image);
    });

    formData.append('prompt', prompt);
    formData.append('style', style);
    formData.append('aspectRatio', aspectRatio);

    // TODO: Replace with actual image generation API endpoint
    // For now, return mock response after delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock response
    return {
      success: true,
      imageUrl: 'https://via.placeholder.com/512x512?text=AI+Generated+Image',
      metadata: {
        prompt,
        style,
        aspectRatio,
        imageCount: images.filter(img => img !== null).length
      }
    };

    /*
    // Actual API call (commented out for now)
    const response = await axios.post(
      `${API_BASE_URL}/images/generate`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        timeout: 120000 // 2 minutes timeout
      }
    );

    console.log('Backend response:', response.data);

    if (!response.data.success) {
      throw new Error(response.data.message || '이미지 생성에 실패했습니다.');
    }

    return response.data;
    */

  } catch (error) {
    console.error('Image generation error:', error);

    if (error.response) {
      // API error response
      const status = error.response.status;
      const errorMessage = error.response.data?.message || error.response.statusText;

      if (status === 401) {
        throw new Error('API 인증 실패');
      }

      if (status === 402) {
        throw new Error('크레딧 부족');
      }

      if (status === 429) {
        throw new Error('API 요청 한도 초과');
      }

      throw new Error(`API 오류 (${status}): ${errorMessage}`);

    } else if (error.request) {
      // Network error
      throw new Error('API 서버 연결 오류');
    } else {
      // Other errors
      throw error;
    }
  }
}

/**
 * Download image from URL
 * @param {string} imageUrl - Image URL
 * @param {string} filename - Desired filename
 */
export async function downloadImage(imageUrl, filename = 'generated-image.png') {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'blob'
    });

    const blob = new Blob([response.data], { type: 'image/png' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Download error:', error);
    throw new Error('이미지 다운로드 중 오류가 발생했습니다.');
  }
}

/**
 * Save generated image to backend (S3 and database)
 * @param {string} imageUrl - Generated image URL
 * @param {string} title - Image title
 * @param {string} description - Image description
 * @param {object} metadata - Generation metadata
 * @returns {Promise<object>} - Saved image information
 */
export async function saveGeneratedImageToBackend(imageUrl, title, description, metadata) {
  try {
    console.log('Saving generated image to backend...');

    const response = await axios.post(
      `${API_BASE_URL}/images/save-generated`,
      {
        imageUrl,
        title,
        description,
        metadata
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      }
    );

    console.log('Image saved to backend:', response.data);
    return response.data;

  } catch (error) {
    console.error('Save image error:', error);

    if (error.response) {
      const errorMessage = error.response.data?.error || error.response.data?.message || error.response.statusText;
      throw new Error(`이미지 저장 실패: ${errorMessage}`);
    } else if (error.request) {
      throw new Error('서버 연결 오류: 이미지를 저장할 수 없습니다.');
    } else {
      throw new Error('이미지 저장 중 오류가 발생했습니다.');
    }
  }
}

export default {
  generateImage,
  downloadImage,
  saveGeneratedImageToBackend
};
