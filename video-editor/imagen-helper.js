/**
 * Google Imagen Image Generation Helper
 * Using Gemini API with API Key authentication
 */

const axios = require('axios');

// Imagen configuration
const IMAGEN_MODEL = 'imagen-3.0-generate-002'; // or 'imagen-4.0-generate-preview-06-06'

/**
 * Generate image with Google Imagen via Gemini API
 */
async function generateImagenImage(params, logInfo, logError) {
  logInfo('IMAGEN_GENERATE', 'Starting Imagen image generation', {
    promptLength: params.prompt?.length || 0,
    model: IMAGEN_MODEL
  });

  try {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }

    //Build Gemini API endpoint for Imagen
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateImages`;

    // Build request body
    const requestBody = {
      prompt: params.prompt,
      numberOfImages: params.numberOfImages || 1,
      aspectRatio: params.aspectRatio || '1:1', // 1:1, 3:4, 4:3, 9:16, 16:9
      negativePrompt: params.negativePrompt || '',
      safetyFilterLevel: params.safetyFilterLevel || 'BLOCK_ONLY_HIGH',
      personGeneration: params.personGeneration || 'ALLOW_ADULT'
    };

    logInfo('IMAGEN_GENERATE', 'Calling Gemini Imagen API', {
      endpoint,
      model: IMAGEN_MODEL,
      hasApiKey: !!apiKey
    });

    // Submit image generation request
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      timeout: 60000 // 1 minute timeout
    });

    const result = response.data;

    logInfo('IMAGEN_GENERATE', 'Imagen API response received', {
      hasImages: !!result.generatedImages,
      imagesCount: result.generatedImages?.length || 0
    });

    // Parse response
    return parseImagenResponse(result, logInfo, logError);

  } catch (error) {
    logError('IMAGEN_GENERATE_ERROR', 'Failed to generate Imagen image', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
}

/**
 * Parse Imagen image generation response
 */
function parseImagenResponse(response, logInfo, logError) {
  const result = {
    success: false,
    message: 'Unknown error',
    images: []
  };

  // Check if generated images exist
  if (!response.generatedImages || response.generatedImages.length === 0) {
    result.message = 'No generated images in response';
    logError('IMAGEN_PARSE_ERROR', 'No generated images found', { response });
    return result;
  }

  // Extract image data (base64 encoded)
  for (const img of response.generatedImages) {
    if (img.image && img.image.imageBytes) {
      result.images.push({
        imageBase64: img.image.imageBytes,
        mimeType: img.image.mimeType || 'image/png'
      });
    }
  }

  if (result.images.length > 0) {
    result.success = true;
    result.message = `Generated ${result.images.length} image(s) successfully`;
    logInfo('IMAGEN_PARSE', 'Images extracted successfully', {
      count: result.images.length
    });
  } else {
    result.message = 'Image data not found in response';
    logError('IMAGEN_PARSE_ERROR', 'Image data not found', { response });
  }

  return result;
}

module.exports = {
  generateImagenImage
};
