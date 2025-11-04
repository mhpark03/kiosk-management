/**
 * Google Imagen Image Generation Helper
 * Using Vertex AI Imagen 3.0 REST API with Service Account authentication
 */

const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

// Imagen configuration
const PROJECT_ID = 'kioskaudio';
const LOCATION = 'us-central1'; // Imagen is available in us-central1
const MODEL_NAME = 'imagen-3.0-generate-001';

// Service account key file path
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'google-tts-service-account.json');

// Imagen REST API endpoint
const IMAGEN_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}:predict`;

/**
 * Generate image with Google Vertex AI Imagen 3.0
 */
async function generateImagenImage(params, logInfo, logError) {
  logInfo('IMAGEN_GENERATE', 'Starting Vertex AI Imagen generation', {
    promptLength: params.prompt?.length || 0,
    model: MODEL_NAME,
    projectId: PROJECT_ID
  });

  try {
    // Initialize Google Auth with service account
    const auth = new GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    // Get access token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to obtain access token');
    }

    logInfo('IMAGEN_GENERATE', 'Calling Vertex AI Imagen REST API', {
      model: MODEL_NAME,
      aspectRatio: params.aspectRatio,
      numberOfImages: params.numberOfImages || 1,
      endpoint: IMAGEN_ENDPOINT
    });

    // Build REST API request body
    const requestBody = {
      instances: [
        {
          prompt: params.prompt
        }
      ],
      parameters: {
        sampleCount: params.numberOfImages || 1,
        aspectRatio: params.aspectRatio || '1:1',
        negativePrompt: params.negativePrompt || '',
        safetySetting: params.safetyFilterLevel || 'block_medium_and_above',
        personGeneration: params.personGeneration || 'allow_adult',
        addWatermark: false
      }
    };

    // Call Imagen REST API
    const response = await axios.post(IMAGEN_ENDPOINT, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      }
    });

    logInfo('IMAGEN_GENERATE', 'Imagen API response received', {
      hasPredictions: !!(response.data && response.data.predictions),
      statusCode: response.status,
      responseKeys: response.data ? Object.keys(response.data) : [],
      fullResponse: JSON.stringify(response.data)
    });

    // Parse response
    return parseImagenResponse(response.data, logInfo, logError);

  } catch (error) {
    logError('IMAGEN_GENERATE_ERROR', 'Failed to generate image', {
      error: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    throw error;
  }
}

/**
 * Parse Vertex AI Imagen REST API response
 */
function parseImagenResponse(response, logInfo, logError) {
  const result = {
    success: false,
    message: 'Unknown error',
    images: []
  };

  // Check if predictions exist (REST API format)
  if (!response || !response.predictions || response.predictions.length === 0) {
    result.message = 'No predictions in response';
    logError('IMAGEN_PARSE_ERROR', 'No predictions found', {
      hasResponse: !!response,
      hasPredictions: !!(response && response.predictions)
    });
    return result;
  }

  // Extract image data from REST API predictions
  for (const prediction of response.predictions) {
    // Imagen REST API returns bytesBase64Encoded field
    const base64Data = prediction.bytesBase64Encoded;
    const mimeType = prediction.mimeType || 'image/png';

    if (base64Data) {
      result.images.push({
        imageBase64: base64Data,
        mimeType: mimeType
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
    logError('IMAGEN_PARSE_ERROR', 'Image data not found', {
      predictionCount: response.predictions.length,
      firstPredictionKeys: response.predictions[0] ? Object.keys(response.predictions[0]) : []
    });
  }

  return result;
}

module.exports = {
  generateImagenImage
};
