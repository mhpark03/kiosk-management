import api from './api';

export const menuService = {
  // Get all menu files from S3 (MENU purpose only)
  async getMenusFromS3() {
    try {
      const response = await api.get('/videos', {
        params: {
          imagePurpose: 'MENU'
        }
      });
      console.log('API Response from /videos?imagePurpose=MENU:', response.data);
      console.log('Number of menus returned:', response.data?.length || 0);
      return response.data;
    } catch (error) {
      console.error('Get menus from S3 error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch menus from S3');
    }
  },

  // Upload menu XML file to S3
  async uploadMenuXML(xmlContent, title, description) {
    try {
      // Create a Blob from XML string with timestamp to ensure uniqueness
      const timestamp = Date.now();
      const blob = new Blob([xmlContent], { type: 'text/xml' });
      const file = new File([blob], `${title.replace(/\s+/g, '_')}_${timestamp}.xml`, { type: 'text/xml' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('imagePurpose', 'MENU'); // Set purpose as MENU

      console.log('Uploading menu with imagePurpose=MENU:', { title, description });

      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Menu XML upload error:', error);
      throw new Error(error.response?.data?.error || 'Failed to upload menu XML to S3');
    }
  },

  // Delete menu from S3
  async deleteMenu(menuId) {
    try {
      const response = await api.delete(`/videos/${menuId}`);
      return response.data;
    } catch (error) {
      console.error('Delete menu error:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete menu');
    }
  },

  // Get single menu by ID (content included for XML files)
  async getMenuById(menuId) {
    try {
      const response = await api.get(`/videos/${menuId}`);
      return response.data;
    } catch (error) {
      console.error('Get menu by ID error:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch menu');
    }
  },

  // Update menu (delete and re-upload)
  async updateMenu(menuId, xmlContent, title, description) {
    try {
      // Delete existing menu
      await this.deleteMenu(menuId);

      // Upload new version with timestamp to ensure uniqueness
      const timestamp = Date.now();
      const blob = new Blob([xmlContent], { type: 'text/xml' });
      const file = new File([blob], `${title.replace(/\s+/g, '_')}_${timestamp}.xml`, { type: 'text/xml' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('imagePurpose', 'MENU');

      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Update menu error:', error);
      throw new Error(error.response?.data?.error || 'Failed to update menu');
    }
  },
};

export default menuService;
