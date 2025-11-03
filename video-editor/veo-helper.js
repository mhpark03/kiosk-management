/**
 * Google VEO Video Generation Helper
 * Matches backend VeoService.java implementation using Gemini API
 */

const axios = require('axios');

/**
 * Generate video with Google VEO API using Gemini API (matching backend implementation)
 */
async function generateVeoVideo(params, logInfo, logError) {
  logInfo('VEO_GENERATE', 'Starting VEO video generation', {
    hasImage: !!params.imageBase64,
    promptLength: params.prompt?.length || 0
  });

  try {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }

    // Gemini API configuration (matching backend VeoService.java)
    const apiUrl = process.env.GOOGLE_AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    const veoModel = process.env.GOOGLE_VEO_MODEL || 'veo-3.1-generate-preview';

    // Build endpoint according to Gemini API spec
    const endpoint = `${apiUrl}/models/${veoModel}:predictLongRunning`;

    // Build request body with instances array
    const instance = {
      prompt: params.prompt
    };

    // Add image if provided
    if (params.imageBase64) {
      instance.image = {
        bytesBase64Encoded: params.imageBase64,
        mimeType: 'image/jpeg'
      };
    }

    const requestBody = {
      instances: [instance],
      parameters: {
        aspectRatio: params.aspectRatio || '16:9',
        durationSeconds: parseInt(params.duration || 8),
        resolution: params.resolution || '720p'
      }
    };

    logInfo('VEO_GENERATE', 'Calling Gemini VEO API', {
      endpoint,
      model: veoModel,
      hasApiKey: !!apiKey
    });

    // Submit video generation request
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      timeout: 300000 // 5 minutes timeout
    });

    const result = response.data;

    // Extract operation name from response
    if (!result.name) {
      throw new Error('Operation name not found in response');
    }

    const operationName = result.name;
    logInfo('VEO_GENERATE', 'Video generation operation submitted', { operationName });

    // Poll for result
    const pollIntervalMs = parseInt(process.env.GOOGLE_VEO_POLL_INTERVAL || '5000');
    const maxPollAttempts = parseInt(process.env.GOOGLE_VEO_MAX_POLL_ATTEMPTS || '60');

    const videoResult = await pollForVideoResult(apiUrl, operationName, apiKey, pollIntervalMs, maxPollAttempts, logInfo, logError);

    return videoResult;

  } catch (error) {
    logError('VEO_GENERATE_ERROR', 'Failed to generate VEO video', {
      error: error.message,
      response: error.response?.data
    });
    throw error;
  }
}

/**
 * Poll for video generation result
 */
async function pollForVideoResult(apiUrl, operationName, apiKey, pollIntervalMs, maxPollAttempts, logInfo, logError) {
  // Build poll endpoint - operation name already includes the full path
  const pollEndpoint = `${apiUrl}/${operationName}`;

  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    try {
      logInfo('VEO_POLL', `Polling for result (attempt ${attempt + 1}/${maxPollAttempts})`, { operationName });

      const response = await axios.get(pollEndpoint, {
        headers: {
          'x-goog-api-key': apiKey
        }
      });

      const body = response.data;

      // Check if operation is done
      if (body.done === true) {
        logInfo('VEO_POLL', 'Video generation completed', { operationName });
        return parseVideoResponse(body, operationName, logInfo, logError);
      }

      logInfo('VEO_POLL', 'Video generation in progress...', {
        attempt: attempt + 1,
        maxAttempts: maxPollAttempts
      });

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

    } catch (error) {
      logError('VEO_POLL_ERROR', 'Error polling for video result', {
        error: error.message,
        attempt: attempt + 1
      });
    }
  }

  // Timeout
  return {
    success: false,
    message: `Video generation timed out after ${maxPollAttempts} attempts`,
    taskId: operationName
  };
}

/**
 * Parse video generation response
 */
function parseVideoResponse(response, operationName, logInfo, logError) {
  logInfo('VEO_PARSE', 'Parsing video response', {
    hasResponse: !!response,
    responseKeys: Object.keys(response)
  });

  const result = {
    taskId: operationName,
    success: false,
    message: 'Unknown error'
  };

  // Check for errors first
  if (response.error) {
    result.message = response.error.message || 'Unknown error';
    logError('VEO_PARSE_ERROR', 'Video generation failed', { error: response.error });
    return result;
  }

  // Extract video URL from response according to Gemini API spec
  // Response structure: response.generateVideoResponse.generatedSamples[0].video.uri
  if (response.response) {
    const responseData = response.response;

    if (responseData.generateVideoResponse) {
      const generateVideoResponse = responseData.generateVideoResponse;

      if (generateVideoResponse.generatedSamples &&
          generateVideoResponse.generatedSamples.length > 0) {
        const firstSample = generateVideoResponse.generatedSamples[0];

        if (firstSample.video && firstSample.video.uri) {
          result.videoUrl = firstSample.video.uri;
          result.success = true;
          result.message = 'Video generated successfully';
          logInfo('VEO_PARSE', 'Video URL extracted successfully', { videoUrl: result.videoUrl });
          return result;
        }
      }
    }
  }

  // If we reach here, video URL was not found
  result.message = 'Video URL not found in response';
  logError('VEO_PARSE_ERROR', 'Video URL not found in response', { response });
  return result;
}

module.exports = {
  generateVeoVideo
};
