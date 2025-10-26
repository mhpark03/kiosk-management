import axios from 'axios';

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Generate video from text prompt only using Google Veo 3.1
 * @param {string} prompt - Text description for video generation
 * @param {string} duration - Video duration in seconds (4, 5 or 8)
 * @param {string} resolution - Video resolution (720p or 1080p)
 * @param {string} aspectRatio - Video aspect ratio (16:9, 9:16, 1:1)
 * @returns {Promise<object>} - Generated video information
 */
export async function generateVideoFromPrompt(prompt, duration = '4', resolution = '720p', aspectRatio = '16:9') {
  try {
    console.log('Sending Veo text-to-video generation request to backend...');

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('duration', duration);
    formData.append('resolution', resolution);
    formData.append('aspectRatio', aspectRatio);

    const response = await axios.post(
      `${API_BASE_URL}/veo/generate-from-prompt`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        timeout: 600000 // 10 minutes timeout for video generation
      }
    );

    console.log('Backend response:', response.data);

    if (!response.data.success) {
      const errorMessage = response.data.message || '비디오 생성에 실패했습니다.';

      // Check if it's a quota error (429)
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('resource_exhausted')) {
        throw new Error(
          '⚠️ Google Veo API 할당량 초과\n\n' +
          '사용 가능한 무료 할당량을 모두 사용했습니다.\n\n' +
          '해결 방법:\n' +
          '1. 할당량 리셋 대기 (일일/월별)\n' +
          '2. Google AI Studio에서 사용량 확인\n' +
          '3. 유료 플랜 업그레이드 고려\n\n' +
          '📊 사용량 확인: https://ai.dev/usage'
        );
      }

      // Check if it's a video URL not found error
      if (errorMessage.toLowerCase().includes('video url not found')) {
        throw new Error(
          '❌ 비디오 생성 응답 오류\n\n' +
          'Google Veo API가 작업을 완료했지만\n' +
          '비디오 URL을 응답에서 찾을 수 없습니다.\n\n' +
          '다시 시도해주세요.\n' +
          '문제가 계속되면 관리자에게 문의하세요.'
        );
      }

      throw new Error('❌ 비디오 생성 실패\n\n' + parseErrorMessage(errorMessage));
    }

    return {
      success: true,
      videoUrl: response.data.videoUrl,
      taskId: response.data.taskId,
      message: response.data.message,
      metadata: response.data
    };

  } catch (error) {
    console.error('Video generation error:', error);
    handleApiError(error);
  }
}

/**
 * Generate video with first frame image using Google Veo 3.1
 * @param {string} prompt - Text description for video generation
 * @param {File} firstFrame - First frame image (File object)
 * @param {string} duration - Video duration in seconds (4, 5 or 8)
 * @param {string} resolution - Video resolution (720p or 1080p)
 * @param {string} aspectRatio - Video aspect ratio (16:9, 9:16, 1:1)
 * @returns {Promise<object>} - Generated video information
 */
export async function generateVideoWithFirstFrame(prompt, firstFrame, duration = '4', resolution = '720p', aspectRatio = '16:9') {
  try {
    console.log('Sending Veo video generation with first frame request to backend...');

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('firstFrame', firstFrame);
    formData.append('duration', duration);
    formData.append('resolution', resolution);
    formData.append('aspectRatio', aspectRatio);

    const response = await axios.post(
      `${API_BASE_URL}/veo/generate-with-first-frame`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        timeout: 600000 // 10 minutes timeout
      }
    );

    console.log('Backend response:', response.data);

    if (!response.data.success) {
      const errorMessage = response.data.message || '비디오 생성에 실패했습니다.';

      // Check if it's a quota error (429)
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('resource_exhausted')) {
        throw new Error(
          '⚠️ Google Veo API 할당량 초과\n\n' +
          '사용 가능한 무료 할당량을 모두 사용했습니다.\n\n' +
          '해결 방법:\n' +
          '1. 할당량 리셋 대기 (일일/월별)\n' +
          '2. Google AI Studio에서 사용량 확인\n' +
          '3. 유료 플랜 업그레이드 고려\n\n' +
          '📊 사용량 확인: https://ai.dev/usage'
        );
      }

      // Check if it's a video URL not found error
      if (errorMessage.toLowerCase().includes('video url not found')) {
        throw new Error(
          '❌ 비디오 생성 응답 오류\n\n' +
          'Google Veo API가 작업을 완료했지만\n' +
          '비디오 URL을 응답에서 찾을 수 없습니다.\n\n' +
          '다시 시도해주세요.\n' +
          '문제가 계속되면 관리자에게 문의하세요.'
        );
      }

      throw new Error('❌ 비디오 생성 실패\n\n' + parseErrorMessage(errorMessage));
    }

    return {
      success: true,
      videoUrl: response.data.videoUrl,
      taskId: response.data.taskId,
      message: response.data.message,
      metadata: response.data
    };

  } catch (error) {
    console.error('Video generation error:', error);
    handleApiError(error);
  }
}

/**
 * Generate video with interpolation (first and last frames) using Google Veo 3.1
 * @param {string} prompt - Text description for video generation
 * @param {File} firstFrame - First frame image (File object)
 * @param {File} lastFrame - Last frame image (File object)
 * @param {string} duration - Video duration in seconds (4, 6 or 8)
 * @param {string} resolution - Video resolution (720p or 1080p)
 * @param {string} aspectRatio - Video aspect ratio (16:9, 9:16, 1:1)
 * @returns {Promise<object>} - Generated video information
 */
export async function generateVideoWithInterpolation(prompt, firstFrame, lastFrame, duration = '4', resolution = '720p', aspectRatio = '16:9') {
  try {
    console.log('Sending Veo video generation with interpolation request to backend...');

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('firstFrame', firstFrame);
    formData.append('lastFrame', lastFrame);
    formData.append('duration', duration);
    formData.append('resolution', resolution);
    formData.append('aspectRatio', aspectRatio);

    const response = await axios.post(
      `${API_BASE_URL}/veo/generate-with-interpolation`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        timeout: 600000 // 10 minutes timeout
      }
    );

    console.log('Backend response:', response.data);

    if (!response.data.success) {
      const errorMessage = response.data.message || '비디오 생성에 실패했습니다.';

      // Check if it's a quota error (429)
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('resource_exhausted')) {
        throw new Error(
          '⚠️ Google Veo API 할당량 초과\n\n' +
          '사용 가능한 무료 할당량을 모두 사용했습니다.\n\n' +
          '해결 방법:\n' +
          '1. 할당량 리셋 대기 (일일/월별)\n' +
          '2. Google AI Studio에서 사용량 확인\n' +
          '3. 유료 플랜 업그레이드 고려\n\n' +
          '📊 사용량 확인: https://ai.dev/usage'
        );
      }

      // Check if it's a video URL not found error
      if (errorMessage.toLowerCase().includes('video url not found')) {
        throw new Error(
          '❌ 비디오 생성 응답 오류\n\n' +
          'Google Veo API가 작업을 완료했지만\n' +
          '비디오 URL을 응답에서 찾을 수 없습니다.\n\n' +
          '다시 시도해주세요.\n' +
          '문제가 계속되면 관리자에게 문의하세요.'
        );
      }

      throw new Error('❌ 비디오 생성 실패\n\n' + parseErrorMessage(errorMessage));
    }

    return {
      success: true,
      videoUrl: response.data.videoUrl,
      taskId: response.data.taskId,
      message: response.data.message,
      metadata: response.data
    };

  } catch (error) {
    console.error('Video generation error:', error);
    handleApiError(error);
  }
}

/**
 * Parse error message from backend to user-friendly Korean message
 * @param {string} errorMessage - Raw error message from backend
 * @returns {string} - Clean, user-friendly Korean error message
 */
function parseErrorMessage(errorMessage) {
  if (!errorMessage) return '알 수 없는 오류가 발생했습니다.';

  // Remove long JSON error details and extract only essential info
  // Pattern: "Failed to... : 403 Forbidden: "{...JSON...}""
  const match = errorMessage.match(/Failed to ([^:]+):/);
  if (match) {
    const action = match[1];

    // Check for SERVICE_DISABLED in the error
    if (errorMessage.includes('SERVICE_DISABLED') ||
        errorMessage.includes('API has not been used') ||
        errorMessage.includes('it is disabled')) {
      return 'Google Veo API가 활성화되지 않았습니다.\nGoogle Cloud Console에서 "Generative Language API"를 활성화해주세요.';
    }

    // Check for PERMISSION_DENIED
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return 'API 권한이 없습니다.\nAPI 키 설정을 확인하세요.';
    }

    // Generic failure message
    return `${action} 작업이 실패했습니다.\n잠시 후 다시 시도해주세요.`;
  }

  // Return original message if it's short and clean
  if (errorMessage.length < 100 && !errorMessage.includes('{') && !errorMessage.includes('<EOL>')) {
    return errorMessage;
  }

  // Default message for complex errors
  return '비디오 생성 요청을 처리할 수 없습니다.\n잠시 후 다시 시도해주세요.';
}

/**
 * Extract clean error message from server response
 * @param {object} responseData - Server response data
 * @returns {string} - Clean error message
 */
function extractErrorMessage(responseData) {
  if (!responseData) return null;

  // Try to extract message from various possible structures
  if (typeof responseData === 'string') {
    return responseData;
  }

  if (responseData.message) {
    return responseData.message;
  }

  if (responseData.error) {
    if (typeof responseData.error === 'string') {
      return responseData.error;
    }
    if (responseData.error.message) {
      return responseData.error.message;
    }
  }

  return null;
}

/**
 * Handle API errors consistently
 * @param {Error} error - Error object
 */
function handleApiError(error) {
  // Check if error message already contains our formatted message (starts with emoji)
  if (error.message && /^[⚠️❌🔑🚫🔧🌐]/.test(error.message)) {
    throw error; // Already formatted, just re-throw
  }

  if (error.response) {
    // API error response
    const status = error.response.status;
    const serverMessage = extractErrorMessage(error.response.data);

    if (status === 400) {
      throw new Error(
        '❌ 잘못된 요청\n\n' +
        '입력한 내용을 확인해주세요.\n' +
        '프롬프트와 이미지가 올바르게 설정되었는지 확인하세요.'
      );
    }

    if (status === 401) {
      throw new Error(
        '🔑 API 인증 실패\n\n' +
        'Google AI API 키가 올바르지 않거나 만료되었습니다.\n\n' +
        '관리자에게 문의하세요.'
      );
    }

    if (status === 403) {
      // Check for SERVICE_DISABLED specifically
      if (serverMessage && (serverMessage.includes('SERVICE_DISABLED') ||
          serverMessage.includes('API has not been used') ||
          serverMessage.includes('it is disabled'))) {
        throw new Error(
          '🔒 Google Veo API 미활성화\n\n' +
          'Google Cloud 프로젝트에서 API가 비활성화되어 있습니다.\n\n' +
          '✅ 해결 방법:\n' +
          '1. Google Cloud Console 접속\n' +
          '2. "Generative Language API" 활성화\n' +
          '3. 약 5분 대기 후 재시도\n\n' +
          '💡 관리자에게 API 활성화를 요청하세요.'
        );
      }

      // Generic 403 error
      throw new Error(
        '🚫 API 액세스 거부\n\n' +
        'Google Veo 3.1 API에 대한 액세스 권한이 없습니다.\n\n' +
        'API 키 권한을 확인하세요.'
      );
    }

    if (status === 429) {
      throw new Error(
        '⚠️ Google Veo API 할당량 초과\n\n' +
        '사용 가능한 무료 할당량을 모두 사용했습니다.\n\n' +
        '해결 방법:\n' +
        '1. 할당량 리셋 대기 (일일/월별)\n' +
        '2. Google AI Studio에서 사용량 확인\n' +
        '3. 유료 플랜 업그레이드 고려\n\n' +
        '📊 사용량 확인: https://ai.dev/usage'
      );
    }

    if (status === 500) {
      throw new Error(
        '🔧 서버 오류\n\n' +
        '서버에서 요청을 처리하는 중 오류가 발생했습니다.\n\n' +
        '잠시 후 다시 시도해주세요.'
      );
    }

    // Other HTTP errors - show simplified message
    throw new Error(
      `⚠️ 오류 발생 (${status})\n\n` +
      '요청을 처리할 수 없습니다.\n' +
      '잠시 후 다시 시도해주세요.'
    );

  } else if (error.request) {
    // Network error
    throw new Error(
      '🌐 서버 연결 오류\n\n' +
      '백엔드 서버에 연결할 수 없습니다.\n\n' +
      '서버가 실행 중인지 확인하고\n' +
      '잠시 후 다시 시도해주세요.'
    );
  } else {
    // Other errors - check error message for quota issues
    const errorMsg = error.message || '';

    if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('resource_exhausted')) {
      throw new Error(
        '⚠️ Google Veo API 할당량 초과\n\n' +
        '사용 가능한 무료 할당량을 모두 사용했습니다.\n\n' +
        '해결 방법:\n' +
        '1. 할당량 리셋 대기 (일일/월별)\n' +
        '2. Google AI Studio에서 사용량 확인\n' +
        '3. 유료 플랜 업그레이드 고려\n\n' +
        '📊 사용량 확인: https://ai.dev/usage'
      );
    }

    throw new Error(
      '⚠️ 오류 발생\n\n' +
      '알 수 없는 오류가 발생했습니다.\n' +
      '잠시 후 다시 시도해주세요.'
    );
  }
}

/**
 * Fetch video from Google Veo URL and create a blob URL for playback
 * This is needed because Google Veo URLs require authentication and can't be played directly
 * @param {string} videoUrl - Google Veo video URL
 * @returns {Promise<string>} - Blob URL that can be used in video element
 */
export async function fetchVideoAsBlob(videoUrl) {
  try {
    console.log('Fetching video from Google Veo URL...');

    const response = await axios.get(videoUrl, {
      responseType: 'blob',
      timeout: 60000 // 60 seconds timeout for download
    });

    const blob = new Blob([response.data], { type: 'video/mp4' });
    const blobUrl = window.URL.createObjectURL(blob);

    console.log('Video blob URL created successfully');
    return blobUrl;

  } catch (error) {
    console.error('Fetch video error:', error);
    throw new Error('비디오를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * Download video from URL
 * @param {string} videoUrl - Video URL
 * @param {string} filename - Desired filename
 */
export async function downloadVideo(videoUrl, filename = 'veo-generated-video.mp4') {
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
 * @param {string} videoUrl - Generated video URL from Google Veo
 * @param {string} title - Video title
 * @param {string} description - Video description
 * @param {string} taskId - Veo task ID
 * @param {string} prompt - Prompt used
 * @returns {Promise<object>} - Saved video information
 */
export async function saveGeneratedVideoToBackend(videoUrl, title, description, taskId, prompt) {
  try {
    console.log('Saving generated Veo video to backend...');

    const response = await axios.post(
      `${API_BASE_URL}/videos/save-veo-video`,
      {
        videoUrl,
        title,
        description,
        veoTaskId: taskId,
        veoPrompt: prompt
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
          errorMessage.toLowerCase().includes('resource_exhausted') ||
          errorMessage.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          '⚠️ Google Veo API 할당량 초과\n\n' +
          '오늘 사용 가능한 무료 할당량을 모두 사용했습니다.\n\n' +
          '✅ 해결 방법:\n' +
          '1. 내일 할당량 리셋 후 재시도 (한국시간 오후 5시경)\n' +
          '2. Google AI Studio에서 사용량 확인\n' +
          '3. 유료 플랜 업그레이드 고려\n\n' +
          '📊 사용량 확인: https://aistudio.google.com/app/prompts/quota'
        );
      }

      // 500 - Internal Server Error (various causes)
      if (status === 500) {
        // Check for VeoService not available
        if (errorMessage.includes('VeoService') || errorMessage.includes('not available')) {
          throw new Error(
            '🔧 서버 설정 오류\n\n' +
            'Google Veo 서비스가 초기화되지 않았습니다.\n\n' +
            '관리자에게 문의하세요.\n' +
            '(VeoService 설정 필요)'
          );
        }

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

        // Check for Google API download errors
        if (errorMessage.includes('download') ||
            errorMessage.includes('Failed to save Google Veo') ||
            errorMessage.includes('IOException')) {
          throw new Error(
            '📥 비디오 다운로드 오류\n\n' +
            'Google에서 비디오를 다운로드할 수 없습니다.\n\n' +
            '가능한 원인:\n' +
            '• Google Veo API 할당량 초과\n' +
            '• 비디오 URL 만료\n' +
            '• 네트워크 연결 문제\n\n' +
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
  generateVideoFromPrompt,
  generateVideoWithFirstFrame,
  generateVideoWithInterpolation,
  fetchVideoAsBlob,
  downloadVideo,
  saveGeneratedVideoToBackend
};
