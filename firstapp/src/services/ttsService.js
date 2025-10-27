import api from './api';

export const ttsService = {
  // Upload audio file
  async uploadAudio(file, title, description) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      if (description) {
        formData.append('description', description);
      }

      const response = await api.post('/tts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Audio upload error:', error);
      throw new Error(error.response?.data?.error || 'Failed to upload audio');
    }
  },

  // Generate audio from text using Google Cloud TTS
  async generateAudio(text, title, description, languageCode, voiceName, gender, speakingRate, pitch) {
    try {
      const requestBody = {
        text,
        title,
        description,
        languageCode,
        voiceName,
        gender,
        speakingRate,
        pitch
      };

      const response = await api.post('/tts/generate', requestBody);
      return response.data;
    } catch (error) {
      console.error('TTS generation error:', error);
      throw new Error(error.response?.data?.error || 'Failed to generate audio');
    }
  },

  // Get all audios
  async getAllAudios() {
    try {
      const response = await api.get('/tts');
      return response.data;
    } catch (error) {
      console.error('Get audios error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch audios');
    }
  },

  // Get a specific audio by ID
  async getAudioById(id) {
    try {
      const response = await api.get(`/tts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get audio error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch audio');
    }
  },

  // Get audios by user ID
  async getAudiosByUser(userId) {
    try {
      const response = await api.get(`/tts/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Get user audios error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch user audios');
    }
  },

  // Update audio metadata
  async updateAudio(id, title, description) {
    try {
      const requestBody = {
        title,
        description
      };

      const response = await api.put(`/tts/${id}`, requestBody);
      return response.data;
    } catch (error) {
      console.error('Update audio error:', error);
      throw new Error(error.response?.data?.error || 'Failed to update audio');
    }
  },

  // Delete an audio
  async deleteAudio(id) {
    try {
      const response = await api.delete(`/tts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete audio error:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete audio');
    }
  },

  // Add audio to video
  async addAudioToVideo(videoId, audioId, title, description, replaceAudio = true) {
    try {
      const requestBody = {
        videoId,
        audioId,
        title,
        description,
        replaceAudio
      };

      const response = await api.post('/videos/add-audio', requestBody);
      return response.data;
    } catch (error) {
      console.error('Add audio to video error:', error);
      throw new Error(error.response?.data?.error || 'Failed to add audio to video');
    }
  },

  // Validate text before TTS generation
  validateText(text) {
    const MAX_LENGTH = 5000;

    if (!text || text.trim().length === 0) {
      throw new Error('텍스트를 입력해주세요.');
    }

    if (text.length > MAX_LENGTH) {
      throw new Error(`텍스트는 ${MAX_LENGTH}자를 초과할 수 없습니다.`);
    }

    return true;
  },

  // Available voice options
  getVoiceOptions() {
    return [
      // Standard voices (무료: 월 1백만 자)
      { value: 'ko-KR-Standard-A', label: 'Korean Female A (Standard - 무료)', gender: 'FEMALE', languageCode: 'ko-KR' },
      { value: 'ko-KR-Standard-B', label: 'Korean Female B (Standard - 무료)', gender: 'FEMALE', languageCode: 'ko-KR' },
      { value: 'ko-KR-Standard-C', label: 'Korean Male C (Standard - 무료)', gender: 'MALE', languageCode: 'ko-KR' },
      { value: 'ko-KR-Standard-D', label: 'Korean Male D (Standard - 무료)', gender: 'MALE', languageCode: 'ko-KR' },
      { value: 'en-US-Standard-A', label: 'English Female A (Standard - 무료)', gender: 'FEMALE', languageCode: 'en-US' },
      { value: 'en-US-Standard-B', label: 'English Male B (Standard - 무료)', gender: 'MALE', languageCode: 'en-US' },
      { value: 'en-US-Standard-C', label: 'English Female C (Standard - 무료)', gender: 'FEMALE', languageCode: 'en-US' },
      { value: 'en-US-Standard-D', label: 'English Male D (Standard - 무료)', gender: 'MALE', languageCode: 'en-US' },
      { value: 'ja-JP-Standard-A', label: 'Japanese Female A (Standard - 무료)', gender: 'FEMALE', languageCode: 'ja-JP' },
      { value: 'ja-JP-Standard-B', label: 'Japanese Female B (Standard - 무료)', gender: 'FEMALE', languageCode: 'ja-JP' },
      { value: 'ja-JP-Standard-C', label: 'Japanese Male C (Standard - 무료)', gender: 'MALE', languageCode: 'ja-JP' },
      { value: 'ja-JP-Standard-D', label: 'Japanese Male D (Standard - 무료)', gender: 'MALE', languageCode: 'ja-JP' },
      { value: 'zh-CN-Standard-A', label: 'Chinese Female A (Standard - 무료)', gender: 'FEMALE', languageCode: 'zh-CN' },
      { value: 'zh-CN-Standard-B', label: 'Chinese Male B (Standard - 무료)', gender: 'MALE', languageCode: 'zh-CN' },
      { value: 'zh-CN-Standard-C', label: 'Chinese Male C (Standard - 무료)', gender: 'MALE', languageCode: 'zh-CN' },
      { value: 'zh-CN-Standard-D', label: 'Chinese Female D (Standard - 무료)', gender: 'FEMALE', languageCode: 'zh-CN' },
      // Neural2 voices (고품질, 무료: 월 4백만 자)
      { value: 'ko-KR-Neural2-A', label: 'Korean Female A (Neural2 - 고품질)', gender: 'FEMALE', languageCode: 'ko-KR' },
      { value: 'ko-KR-Neural2-B', label: 'Korean Female B (Neural2 - 고품질)', gender: 'FEMALE', languageCode: 'ko-KR' },
      { value: 'ko-KR-Neural2-C', label: 'Korean Male C (Neural2 - 고품질)', gender: 'MALE', languageCode: 'ko-KR' },
      { value: 'en-US-Neural2-A', label: 'English Female A (Neural2 - 고품질)', gender: 'FEMALE', languageCode: 'en-US' },
      { value: 'en-US-Neural2-C', label: 'English Female C (Neural2 - 고품질)', gender: 'FEMALE', languageCode: 'en-US' },
      { value: 'en-US-Neural2-D', label: 'English Male D (Neural2 - 고품질)', gender: 'MALE', languageCode: 'en-US' },
      { value: 'en-US-Neural2-J', label: 'English Male J (Neural2 - 고품질)', gender: 'MALE', languageCode: 'en-US' },
      { value: 'ja-JP-Neural2-B', label: 'Japanese Female B (Neural2 - 고품질)', gender: 'FEMALE', languageCode: 'ja-JP' },
      { value: 'ja-JP-Neural2-C', label: 'Japanese Male C (Neural2 - 고품질)', gender: 'MALE', languageCode: 'ja-JP' },
      { value: 'zh-CN-Neural2-A', label: 'Chinese Female A (Neural2 - 고품질)', gender: 'FEMALE', languageCode: 'zh-CN' },
      { value: 'zh-CN-Neural2-B', label: 'Chinese Male B (Neural2 - 고품질)', gender: 'MALE', languageCode: 'zh-CN' },
    ];
  },

  // Get voices by language code
  getVoicesByLanguage(languageCode) {
    const allVoices = this.getVoiceOptions();
    return allVoices.filter(voice => voice.languageCode === languageCode);
  },

  // Format date for display
  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  // Format duration from file size (rough estimate)
  estimateDuration(fileSize) {
    // MP3 at 128kbps: ~16KB per second
    const estimatedSeconds = Math.round(fileSize / 16000);
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = estimatedSeconds % 60;

    if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    }
    return `${seconds}초`;
  }
};

export default ttsService;
