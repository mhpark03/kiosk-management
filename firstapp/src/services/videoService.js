import api from './api';

export const videoService = {
  // Upload a video file
  async uploadVideo(file, title = '', description = '') {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) {
        formData.append('title', title);
      }
      if (description) {
        formData.append('description', description);
      }

      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Video upload error:', error);
      throw new Error(error.response?.data?.error || 'Failed to upload video');
    }
  },

  // Get all videos (admin only)
  // Only returns manually uploaded videos (type=UPLOAD)
  // Excludes AI-generated videos (type=RUNWAY_GENERATED) and images (mediaType=IMAGE)
  async getAllVideos() {
    try {
      const response = await api.get('/videos', {
        params: {
          type: 'UPLOAD',
          mediaType: 'VIDEO'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get videos error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch videos');
    }
  },

  // Get videos uploaded by current user
  async getMyVideos() {
    try {
      const response = await api.get('/videos/my-videos');
      return response.data;
    } catch (error) {
      console.error('Get my videos error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch your videos');
    }
  },

  // Get all images (mediaType=IMAGE)
  async getAllImages() {
    try {
      const response = await api.get('/videos', {
        params: {
          mediaType: 'IMAGE'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get images error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch images');
    }
  },

  // Get all AI-generated videos (RUNWAY_GENERATED and VEO_GENERATED)
  async getAIVideos(aiModelFilter = null) {
    try {
      const response = await api.get('/videos', {
        params: {
          mediaType: 'VIDEO'
        }
      });
      // Filter for AI-generated videos only
      let aiVideos = response.data.filter(v =>
        v.videoType === 'RUNWAY_GENERATED' || v.videoType === 'VEO_GENERATED'
      );

      // Apply additional AI model filter if specified
      if (aiModelFilter && aiModelFilter !== 'ALL') {
        aiVideos = aiVideos.filter(v => v.videoType === aiModelFilter);
      }

      return aiVideos;
    } catch (error) {
      console.error('Get AI videos error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch AI videos');
    }
  },

  // Get a specific video by ID
  async getVideoById(id) {
    try {
      const response = await api.get(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get video error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch video');
    }
  },

  // Generate presigned URL for video playback/download
  async getPresignedUrl(id, durationMinutes = 60) {
    try {
      const response = await api.get(`/videos/${id}/presigned-url`, {
        params: { duration: durationMinutes },
      });
      return response.data;
    } catch (error) {
      console.error('Get presigned URL error:', error);
      throw new Error(error.response?.data?.error || 'Failed to generate video URL');
    }
  },

  // Update video title and/or description
  async updateVideo(id, title, description) {
    try {
      const data = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;

      const response = await api.patch(`/videos/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Update video error:', error);
      throw new Error(error.response?.data?.error || 'Failed to update video');
    }
  },

  // Update video description (backward compatibility)
  async updateDescription(id, description) {
    return this.updateVideo(id, undefined, description);
  },

  // Delete a video
  async deleteVideo(id) {
    try {
      const response = await api.delete(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete video error:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete video');
    }
  },

  // Regenerate thumbnail for a video
  async regenerateThumbnail(id) {
    try {
      const response = await api.post(`/videos/${id}/regenerate-thumbnail`);
      return response.data;
    } catch (error) {
      console.error('Regenerate thumbnail error:', error);
      throw new Error(error.response?.data?.error || 'Failed to regenerate thumbnail');
    }
  },

  // Validate file before upload
  validateFile(file) {
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    const ALLOWED_TYPES = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/webm',
    ];

    if (!file) {
      throw new Error('파일을 선택해주세요.');
    }

    if (file.size > MAX_SIZE) {
      throw new Error('파일 크기는 100MB를 초과할 수 없습니다.');
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(
        '지원되지 않는 파일 형식입니다. MP4, MPEG, MOV, AVI, WMV, WEBM 형식만 업로드 가능합니다.'
      );
    }

    return true;
  },

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
};

export default videoService;
