import axios from 'axios';

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Generate video using Runway ML API via backend proxy
 * @param {File} image1 - Starting image
 * @param {File} image2 - Ending image
 * @param {string} prompt - Text description for video generation
 * @param {number} duration - Video duration in seconds
 * @param {string} model - Model to use (gen3a_turbo, gen4_turbo, veo3, veo3.1, veo3.1_fast)
 * @param {string} resolution - Resolution/ratio string (e.g., "1280:720")
 * @returns {Promise<object>} - Generated video information
 */
export async function generateVideo(image1, image2, prompt, duration = 5, model = 'gen3a_turbo', resolution = '1280:768') {
  try {
    console.log('Sending video generation request to backend...');

    // Create FormData to send files
    const formData = new FormData();

    // Handle image1 - can be File object or URL string
    if (image1 instanceof File) {
      formData.append('image1', image1);
    } else if (typeof image1 === 'string') {
      formData.append('image1Url', image1);
    }

    // Handle image2 - can be File object or URL string
    if (image2 instanceof File) {
      formData.append('image2', image2);
    } else if (typeof image2 === 'string') {
      formData.append('image2Url', image2);
    }

    formData.append('prompt', prompt);
    formData.append('duration', duration);
    formData.append('model', model);
    formData.append('resolution', resolution);

    // Send request to backend proxy
    const response = await axios.post(
      `${API_BASE_URL}/runway/generate-video`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        timeout: 60000 // 60 seconds timeout
      }
    );

    console.log('Backend response:', response.data);

    if (!response.data.success) {
      throw new Error(response.data.message || '비디오 생성 작업 시작에 실패했습니다.');
    }

    const taskId = response.data.taskId;

    if (!taskId) {
      throw new Error('작업 ID를 받지 못했습니다.');
    }

    // Poll for video generation completion
    console.log('Waiting for video generation to complete...');
    const videoUrl = await pollTaskStatus(taskId);

    return {
      success: true,
      videoUrl,
      taskId,
      metadata: response.data
    };

  } catch (error) {
    console.error('Video generation error:', error);

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
 * @returns {Promise<string>} - Video URL when ready
 */
async function pollTaskStatus(taskId, maxAttempts = 120, interval = 5000) {
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
        // The output is an array with the video URL as the first element
        const videoUrl = response.data.output?.[0] || response.data.output?.url || response.data.artifacts?.[0]?.url;

        if (!videoUrl) {
          console.error('Response data:', response.data);
          throw new Error('비디오 URL을 찾을 수 없습니다.');
        }

        console.log('Video generation completed:', videoUrl);
        return videoUrl;
      }

      if (status === 'FAILED') {
        const errorMessage = response.data.failure || response.data.failureCode || '알 수 없는 오류';
        throw new Error(`비디오 생성 실패: ${errorMessage}`);
      }

      if (status === 'CANCELLED') {
        throw new Error('비디오 생성이 취소되었습니다.');
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
    '비디오 생성 시간이 초과되었습니다.\n\n' +
    '생성이 오래 걸리고 있습니다. 잠시 후 다시 확인하거나\n' +
    'Runway 대시보드에서 작업 상태를 확인하세요.'
  );
}

/**
 * Download video from URL
 * @param {string} videoUrl - Video URL
 * @param {string} filename - Desired filename
 */
export async function downloadVideo(videoUrl, filename = 'runway-generated-video.mp4') {
  try {
    const response = await axios.get(videoUrl, {
      responseType: 'blob'
    });

    const blob = new Blob([response.data], { type: 'video/mp4' });
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
    throw new Error('비디오 다운로드 중 오류가 발생했습니다.');
  }
}

/**
 * Save generated video to backend (S3 and database)
 * @param {string} videoUrl - Generated video URL from Runway ML
 * @param {string} title - Video title
 * @param {string} description - Video description
 * @param {string} taskId - Runway task ID
 * @param {string} model - Model used
 * @param {string} resolution - Resolution used
 * @param {string} prompt - Prompt used
 * @returns {Promise<object>} - Saved video information
 */
export async function saveGeneratedVideoToBackend(videoUrl, title, description, taskId, model, resolution, prompt) {
  try {
    console.log('Saving generated Runway video to backend...');

    const response = await axios.post(
      `${API_BASE_URL}/videos/save-runway-video`,
      {
        videoUrl,
        title,
        description,
        runwayTaskId: taskId,
        runwayModel: model,
        runwayResolution: resolution,
        runwayPrompt: prompt
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        timeout: 600000 // 10 minutes timeout for large video download + S3 upload
      }
    );

    console.log('Video saved to backend:', response.data);
    return response.data;

  } catch (error) {
    console.error('Save video error:', error);

    if (error.response) {
      const status = error.response.status;
      const errorMessage = error.response.data?.error || error.response.data?.message || error.response.statusText;

      console.log('Save error status:', status);
      console.log('Save error message:', errorMessage);

      // 429 - Rate Limit / Quota Exceeded
      if (status === 429 ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('resource_exhausted')) {
        throw new Error(
          '⚠️ Runway ML API 할당량 초과\n\n' +
          '사용 가능한 크레딧을 모두 사용했습니다.\n\n' +
          '✅ 해결 방법:\n' +
          '1. Runway ML 계정에서 크레딧 확인\n' +
          '2. 크레딧 구매 또는 플랜 업그레이드\n\n' +
          '📊 크레딧 확인: https://app.runwayml.com/account'
        );
      }

      // 500 - Internal Server Error (various causes)
      if (status === 500) {
        // Check for transaction/database errors
        if (errorMessage.includes('transaction') ||
            errorMessage.includes('rolled back') ||
            errorMessage.includes('database')) {
          throw new Error(
            '💾 데이터베이스 저장 오류\n\n' +
            '비디오 파일은 다운로드했으나 데이터베이스에 저장할 수 없습니다.\n\n' +
            '잠시 후 다시 시도해주세요.'
          );
        }

        // Check for S3 upload errors
        if (errorMessage.includes('S3') || errorMessage.includes('upload')) {
          throw new Error(
            '☁️ 파일 업로드 오류\n\n' +
            'AWS S3에 비디오를 업로드할 수 없습니다.\n\n' +
            '네트워크 연결을 확인하고 잠시 후 다시 시도해주세요.'
          );
        }

        // Check for Runway download errors
        if (errorMessage.includes('download') ||
            errorMessage.includes('Failed to save Runway') ||
            errorMessage.includes('IOException')) {
          throw new Error(
            '📥 비디오 다운로드 오류\n\n' +
            'Runway ML에서 비디오를 다운로드할 수 없습니다.\n\n' +
            '가능한 원인:\n' +
            '• 비디오 URL 만료\n' +
            '• 네트워크 연결 문제\n' +
            '• Runway ML 서버 오류\n\n' +
            '잠시 후 다시 시도해주세요.'
          );
        }

        // Generic 500 error
        throw new Error(
          '🔧 서버 오류\n\n' +
          '서버에서 비디오 저장 중 오류가 발생했습니다.\n\n' +
          '잠시 후 다시 시도해주세요.\n\n' +
          '상세 오류: ' + (errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage)
        );
      }

      // 504 - Gateway Timeout
      if (status === 504) {
        throw new Error(
          '⏱️ 시간 초과\n\n' +
          '비디오 저장 작업이 너무 오래 걸립니다.\n\n' +
          '가능한 원인:\n' +
          '• 비디오 파일이 너무 큼\n' +
          '• 네트워크 속도가 느림\n\n' +
          '잠시 후 다시 시도해주세요.'
        );
      }

      // 401/403 - Authentication/Authorization errors
      if (status === 401 || status === 403) {
        throw new Error(
          '🔒 권한 오류\n\n' +
          '비디오를 저장할 권한이 없습니다.\n\n' +
          '로그인 상태를 확인하고 다시 시도해주세요.'
        );
      }

      // 400 - Bad Request
      if (status === 400) {
        throw new Error(
          '❌ 잘못된 요청\n\n' +
          '제목, 설명, 비디오 URL이 모두 입력되었는지 확인해주세요.\n\n' +
          '상세 오류: ' + errorMessage
        );
      }

      // Other HTTP errors
      throw new Error(
        `⚠️ 비디오 저장 실패 (오류 ${status})\n\n` +
        '요청을 처리할 수 없습니다.\n\n' +
        (errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage)
      );

    } else if (error.request) {
      throw new Error(
        '🌐 서버 연결 오류\n\n' +
        '백엔드 서버에 연결할 수 없습니다.\n\n' +
        '서버가 실행 중인지 확인하고\n' +
        '잠시 후 다시 시도해주세요.'
      );
    } else {
      throw new Error(
        '❌ 비디오 저장 오류\n\n' +
        '비디오 저장 중 알 수 없는 오류가 발생했습니다.\n\n' +
        '잠시 후 다시 시도해주세요.'
      );
    }
  }
}

export default {
  generateVideo,
  downloadVideo,
  saveGeneratedVideoToBackend
};
