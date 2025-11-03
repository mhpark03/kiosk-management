/**
 * Module Loader
 * Imports and initializes all application modules
 */

import * as Auth from './auth.js';
import * as TTS from './tts.js';
import * as VEO from './veo.js';
import * as Runway from './runway.js';
import * as Imagen from './imagen.js';

/**
 * Initialize all modules
 * This function should be called when the application starts
 */
export function initializeModules() {
  console.log('[Module Loader] Initializing modules...');

  // Initialize authentication
  Auth.initializeAuth();

  // Expose auth functions to window for global access
  window.getAuthToken = Auth.getAuthToken;
  window.getCurrentUser = Auth.getCurrentUser;
  window.getBackendUrl = Auth.getBackendUrl;
  window.isAuthenticated = Auth.isAuthenticated;
  window.selectServer = Auth.selectServer;
  window.handleLogin = Auth.handleLogin;
  window.logout = Auth.logout;

  // Expose TTS functions to window for global access
  window.updateTtsCharCount = TTS.updateTtsCharCount;
  window.updateTtsVoiceOptions = TTS.updateTtsVoiceOptions;
  window.updateTtsSpeedDisplay = TTS.updateTtsSpeedDisplay;
  window.updateTtsPitchDisplay = TTS.updateTtsPitchDisplay;
  window.executeGenerateTTS = TTS.executeGenerateTTS;
  window.executeGenerateTTSAndUpload = TTS.executeGenerateTTSAndUpload;
  window.previewTTS = TTS.previewTTS;

  // Expose VEO functions to window for global access
  // VEO Image Generation (with reference images)
  window.selectVeoRefImageSource = VEO.selectVeoRefImageSource;
  window.selectVeoRefImage = VEO.selectVeoRefImage;
  window.updateVeoRefImagePreview = VEO.updateVeoRefImagePreview;
  window.clearVeoRefImage = VEO.clearVeoRefImage;
  window.executeGenerateImageVeo = VEO.executeGenerateImageVeo;
  window.downloadGeneratedVeoImage = VEO.downloadGeneratedVeoImage;
  window.saveGeneratedVeoImageToS3 = VEO.saveGeneratedVeoImageToS3;
  // VEO Video Generation (with single image - independent from image generation)
  window.selectVeoVideoImageSource = VEO.selectVeoVideoImageSource;
  window.updateVeoVideoSourceButtons = VEO.updateVeoVideoSourceButtons;
  window.updateVeoVideoImagePreview = VEO.updateVeoVideoImagePreview;
  window.clearVeoVideoImage = VEO.clearVeoVideoImage;
  window.executeGenerateVideoVeo = VEO.executeGenerateVideoVeo;
  window.saveVeoVideoToS3 = VEO.saveVeoVideoToS3;
  window.getGeneratedVeoVideo = VEO.getGeneratedVeoVideo;
  window.getGeneratedVeoImage = VEO.getGeneratedVeoImage;
  window.getVeoReferenceImages = VEO.getVeoReferenceImages;
  window.getVeoVideoImage = VEO.getVeoVideoImage;

  // Backward compatibility for old VEO function names
  window.selectVeoImageSource = VEO.selectVeoVideoImageSource;
  window.updateVeoImagePreview = VEO.updateVeoVideoImagePreview;
  window.clearVeoImage = VEO.clearVeoVideoImage;
  window.updateVeoSourceButtons = VEO.updateVeoVideoSourceButtons;
  window.executeGenerateVideo = VEO.executeGenerateVideoVeo;
  window.saveVideoToS3 = VEO.saveVeoVideoToS3;

  // Expose Imagen functions to window for global access
  window.generateImagenImage = Imagen.generateImagenImage;
  window.uploadImagenImageToS3 = Imagen.uploadImagenImageToS3;
  window.base64ToDataUrl = Imagen.base64ToDataUrl;
  window.downloadImageFromDataUrl = Imagen.downloadImageFromDataUrl;

  // Expose Runway functions to window for global access
  window.executeGenerateImageRunway = Runway.executeGenerateImageRunway;
  window.saveGeneratedImageToS3 = Runway.saveGeneratedImageToS3;
  window.selectRunwayVideoImageSource = Runway.selectRunwayVideoImageSource;
  window.updateRunwayVideoSourceButtons = Runway.updateRunwayVideoSourceButtons;
  window.updateRunwayVideoImagePreview = Runway.updateRunwayVideoImagePreview;
  window.clearRunwayVideoImage = Runway.clearRunwayVideoImage;
  window.selectRunwayVideoS3Image = Runway.selectRunwayVideoS3Image;
  window.closeRunwayVideoS3Modal = Runway.closeRunwayVideoS3Modal;
  window.updateRunwayVideoModelOptions = Runway.updateRunwayVideoModelOptions;
  window.executeGenerateVideoRunway = Runway.executeGenerateVideoRunway;
  window.pollRunwayVideoTask = Runway.pollRunwayVideoTask;
  window.displayRunwayVideoPreview = Runway.displayRunwayVideoPreview;
  window.saveRunwayVideoToS3 = Runway.saveRunwayVideoToS3;
  window.getGeneratedRunwayVideo = Runway.getGeneratedRunwayVideo;

  console.log('[Module Loader] All modules initialized successfully');
}

// Export individual modules for direct access if needed
export { Auth, TTS, VEO, Runway, Imagen };
