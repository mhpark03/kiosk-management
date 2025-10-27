// Backend API integration for Kiosk Management System
const API_BASE_URL = 'http://localhost:8080/api';

class VideoAPI {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Get all videos from backend
  async getAllVideos() {
    try {
      const response = await fetch(`${this.baseUrl}/videos`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      return await response.json();
    } catch (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }
  }

  // Get video by ID
  async getVideoById(videoId) {
    try {
      const response = await fetch(`${this.baseUrl}/videos/${videoId}`);
      if (!response.ok) throw new Error('Video not found');
      return await response.json();
    } catch (error) {
      console.error('Error fetching video:', error);
      throw error;
    }
  }

  // Download video from backend
  async downloadVideo(videoId, savePath) {
    try {
      // Get presigned URL
      const response = await fetch(`${this.baseUrl}/videos/${videoId}/download-url`);
      if (!response.ok) throw new Error('Failed to get download URL');

      const data = await response.json();
      const downloadUrl = data.url || data.downloadUrl;

      // Download file
      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) throw new Error('Failed to download video');

      const blob = await fileResponse.blob();
      const buffer = await blob.arrayBuffer();

      // Save file using Node.js fs
      const fs = require('fs');
      fs.writeFileSync(savePath, Buffer.from(buffer));

      return savePath;
    } catch (error) {
      console.error('Error downloading video:', error);
      throw error;
    }
  }

  // Upload edited video back to backend
  async uploadVideo(filePath, metadata) {
    try {
      const fs = require('fs');
      const path = require('path');

      const formData = new FormData();
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer]);
      const fileName = path.basename(filePath);

      formData.append('file', blob, fileName);
      formData.append('title', metadata.title || fileName);
      formData.append('description', metadata.description || 'Edited video');

      const response = await fetch(`${this.baseUrl}/videos/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to upload video');
      return await response.json();
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  }

  // Update video metadata
  async updateVideoMetadata(videoId, metadata) {
    try {
      const response = await fetch(`${this.baseUrl}/videos/${videoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) throw new Error('Failed to update video');
      return await response.json();
    } catch (error) {
      console.error('Error updating video:', error);
      throw error;
    }
  }

  // Get videos by kiosk
  async getVideosByKiosk(kioskId) {
    try {
      const response = await fetch(`${this.baseUrl}/kiosks/kioskid/${kioskId}`);
      if (!response.ok) throw new Error('Kiosk not found');

      const kiosk = await response.json();
      return kiosk.videos || [];
    } catch (error) {
      console.error('Error fetching kiosk videos:', error);
      throw error;
    }
  }

  // Assign video to kiosk
  async assignVideoToKiosk(kioskId, videoId) {
    try {
      const response = await fetch(`${this.baseUrl}/kiosks/${kioskId}/videos/${videoId}`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to assign video');
      return await response.json();
    } catch (error) {
      console.error('Error assigning video:', error);
      throw error;
    }
  }
}

// Export API instance
const videoAPI = new VideoAPI();

// Make it available globally
if (typeof window !== 'undefined') {
  window.videoAPI = videoAPI;
}

// For Node.js module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoAPI;
}
