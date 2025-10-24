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
    console.log('Sending image generation request to backend...');
    console.log('Number of reference images:', images.filter(img => img !== null).length);
    console.log('Prompt:', prompt);
    console.log('Style:', style);
    console.log('Aspect Ratio:', aspectRatio);

    // Create FormData to send files
    const formData = new FormData();

    // Add images (filter out null values)
    // Note: Backend expects parameter name "images" for all images
    images.filter(img => img !== null).forEach((image) => {
      formData.append('images', image);
    });

    // Add style to prompt if not already mentioned
    let enhancedPrompt = prompt;
    if (style && style !== 'realistic') {
      enhancedPrompt = `${prompt} (${style} style)`;
    }

    formData.append('prompt', enhancedPrompt);
    formData.append('aspectRatio', aspectRatio);

    // Call backend API
    const response = await axios.post(
      `${API_BASE_URL}/runway/generate-image`,
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
      throw new Error(response.data.message || '이미지 생성 작업 시작에 실패했습니다.');
    }

    const taskId = response.data.taskId;

    if (!taskId) {
      throw new Error('작업 ID를 받지 못했습니다.');
    }

    // Poll for image generation completion
    console.log('Waiting for image generation to complete...');
    const imageUrl = await pollTaskStatus(taskId);

    return {
      success: true,
      imageUrl,
      taskId,
      metadata: {
        prompt: enhancedPrompt,
        style,
        aspectRatio,
        imageCount: images.filter(img => img !== null).length
      }
    };

  } catch (error) {
    console.error('Image generation error:', error);

    if (error.response) {
      // API error response
      const status = error.response.status;
      const errorMessage = error.response.data?.message || error.response.statusText;

      if (status === 401) {
        throw new Error(
          'API 인증 실패\n\n' +
          'Runway API 키가 올바르지 않거나 만료되었습니다.\n\n' +
          '백엔드 서버 설정을 확인하세요.'
        );
      }

      if (status === 402) {
        throw new Error(
          '크레딧 부족\n\n' +
          'Runway 계정의 크레딧이 부족합니다.\n\n' +
          'https://runwayml.com 에서 크레딧을 충전하거나 플랜을 업그레이드하세요.'
        );
      }

      if (status === 429) {
        throw new Error(
          'API 요청 한도 초과\n\n' +
          '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.'
        );
      }

      throw new Error(`API 오류 (${status}): ${errorMessage}`);

    } else if (error.request) {
      // Network error
      throw new Error(
        'API 서버 연결 오류\n\n' +
        '백엔드 서버에 연결할 수 없습니다.\n' +
        '서버가 실행 중인지 확인하고 다시 시도해주세요.'
      );
    } else {
      // Other errors
      throw error;
    }
  }
}

/**
 * Poll for task completion
 * @param {string} taskId - Task ID to poll
 * @returns {Promise<string>} - Image URL when ready
 */
async function pollTaskStatus(taskId, maxAttempts = 60, interval = 3000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/runway/task-status/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
          }
        }
      );

      const status = response.data.status;
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts}: Status = ${status}`);

      if (status === 'SUCCEEDED') {
        // The output is an array with the image URL as the first element
        const imageUrl = response.data.output?.[0] || response.data.output?.url || response.data.artifacts?.[0]?.url;

        if (!imageUrl) {
          console.error('Response data:', response.data);
          throw new Error('이미지 URL을 찾을 수 없습니다.');
        }

        console.log('Image generation completed:', imageUrl);
        return imageUrl;
      }

      if (status === 'FAILED') {
        const errorMessage = response.data.failure || response.data.failureCode || '알 수 없는 오류';
        throw new Error(`이미지 생성 실패: ${errorMessage}`);
      }

      if (status === 'CANCELLED') {
        throw new Error('이미지 생성이 취소되었습니다.');
      }

      // Status is PENDING or RUNNING, wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));

    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('작업을 찾을 수 없습니다. 작업이 만료되었을 수 있습니다.');
      }
      throw error;
    }
  }

  throw new Error(
    '이미지 생성 시간이 초과되었습니다.\n\n' +
    '생성이 오래 걸리고 있습니다. 잠시 후 다시 확인하거나\n' +
    'Runway 대시보드에서 작업 상태를 확인하세요.'
  );
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
export async function saveGeneratedImageToBackend(imageUrl, title, description, taskId, resolution, prompt, style) {
  try {
    console.log('Saving generated image to backend...');

    const response = await axios.post(
      `${API_BASE_URL}/videos/save-runway-image`,
      {
        imageUrl,
        title,
        description,
        runwayTaskId: taskId,
        runwayResolution: resolution,
        runwayPrompt: prompt,
        imageStyle: style
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
