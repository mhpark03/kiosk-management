const axios = require('axios');

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-3.1-generate-preview';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

async function generateVeoVideo(params, logInfo, logError) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('API key not set');

  // Ensure durationSeconds is a valid NUMBER: 4, 6, or 8
  let durationSeconds = params.durationSeconds || 4;
  if (typeof durationSeconds === 'string') {
    durationSeconds = parseInt(durationSeconds);
  }
  // Validate and normalize to allowed values
  if (![4, 6, 8].includes(durationSeconds)) {
    durationSeconds = 4; // Default to 4 if invalid
  }

  // Validate aspectRatio
  const aspectRatio = params.aspectRatio || "16:9";
  if (!["16:9", "9:16"].includes(aspectRatio)) {
    aspectRatio = "16:9";
  }

  // Validate resolution
  const resolution = params.resolution || "720p";
  if (!["720p", "1080p"].includes(resolution)) {
    resolution = "720p";
  }

  if (logInfo) {
    logInfo('VEO', 'Parameters: duration=' + durationSeconds + ' (type: ' + typeof durationSeconds + '), aspect=' + aspectRatio + ', res=' + resolution);
  }

  const instance = { prompt: params.prompt };
  if (params.imageBase64) {
    instance.image = {
      bytesBase64Encoded: params.imageBase64,
      mimeType: params.mimeType || 'image/jpeg'
    };
  }
  const parameters = {
    aspectRatio: aspectRatio,
    durationSeconds: durationSeconds,
    resolution: resolution
  };
  const operationName = await submitVideoGenerationRequest(instance, parameters, apiKey, logInfo, logError);
  return await pollForVideoResult(operationName, apiKey, logInfo, logError);
}

async function submitVideoGenerationRequest(instance, parameters, apiKey, logInfo, logError) {
  const endpoint = API_BASE_URL + '/models/' + VEO_MODEL + ':predictLongRunning';
  const requestBody = { instances: [instance], parameters };

  if (logInfo) {
    logInfo('VEO', 'Request endpoint: ' + endpoint);
    logInfo('VEO', 'Request body: ' + JSON.stringify(requestBody).substring(0, 500));
  }

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      timeout: 30000
    });
    if (response.data && response.data.name) return response.data.name;
    throw new Error('No operation name in response');
  } catch (error) {
    if (logError) {
      logError('VEO', 'API request failed: ' + error.message);
      if (error.response && error.response.data) {
        logError('VEO', 'Error response: ' + JSON.stringify(error.response.data));
      }
    }
    throw error;
  }
}

async function pollForVideoResult(operationName, apiKey, logInfo, logError) {
  const pollEndpoint = API_BASE_URL + '/' + operationName;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(pollEndpoint, {
        headers: { 'x-goog-api-key': apiKey },
        timeout: 10000
      });
      if (response.data && response.data.done === true) {
        return parseVideoResponse(response.data, operationName, logInfo, logError);
      }
      await sleep(POLL_INTERVAL_MS);
    } catch (error) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  return { success: false, message: 'Timeout after ' + MAX_POLL_ATTEMPTS + ' attempts', taskId: operationName };
}

function parseVideoResponse(response, operationName, logInfo, logError) {
  const result = { taskId: operationName, success: false, message: 'Unknown error' };
  if (response.error) {
    result.message = 'Video generation failed: ' + (response.error.message || 'Unknown error');
    return result;
  }
  if (response.response && response.response.generateVideoResponse &&
      response.response.generateVideoResponse.generatedSamples &&
      response.response.generateVideoResponse.generatedSamples.length > 0) {
    const sample = response.response.generateVideoResponse.generatedSamples[0];
    if (sample.video && sample.video.uri) {
      result.videoUrl = sample.video.uri;
      result.success = true;
      result.message = 'Video generated successfully';
      return result;
    }
  }
  result.message = 'Video URL not found in response';
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateVeoVideo,
  submitVideoGenerationRequest,
  pollForVideoResult,
  parseVideoResponse
};
