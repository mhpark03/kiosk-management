# VEO Implementation Comparison

## Backend VeoService vs veo-helper.js

### Matching Implementation Details

| Feature | Backend VeoService.java | veo-helper.js | Status |
|---------|------------------------|---------------|---------|
| **API URL** | `https://generativelanguage.googleapis.com/v1beta` | `https://generativelanguage.googleapis.com/v1beta` | MATCH |
| **Model** | `veo-3.1-generate-preview` | `veo-3.1-generate-preview` | MATCH |
| **Endpoint** | `/models/veo-3.1-generate-preview:predictLongRunning` | `/models/veo-3.1-generate-preview:predictLongRunning` | MATCH |
| **Request Method** | POST | POST | MATCH |
| **Header** | `x-goog-api-key` | `x-goog-api-key` | MATCH |
| **API Key Source** | `process.env.GOOGLE_AI_API_KEY` | `process.env.GOOGLE_AI_API_KEY` | MATCH |
| **Poll Interval** | 5000ms (5 seconds) | 5000ms (5 seconds) | MATCH |
| **Max Poll Attempts** | 60 | 60 | MATCH |
| **Total Timeout** | ~5 minutes | ~5 minutes | MATCH |

### Request Body Structure

Both implementations use identical structure:

```json
{
  "instances": [{
    "prompt": "text prompt",
    "image": {  // optional
      "bytesBase64Encoded": "base64...",
      "mimeType": "image/png"
    }
  }],
  "parameters": {
    "aspectRatio": "16:9",
    "durationSeconds": 5,
    "resolution": "720p"
  }
}
```

### Response Parsing Path

Both implementations extract video URL from identical path:
```
response.response.generateVideoResponse.generatedSamples[0].video.uri
```

### Function Mapping

| Backend Function | Frontend Function | Purpose |
|-----------------|-------------------|---------|
| `generateVideoFromPrompt()` | `generateVeoVideo()` | Main entry point |
| `generateVideoWithFirstFrame()` | `generateVeoVideo()` | With image parameter |
| `submitVideoGenerationRequest()` | `submitVideoGenerationRequest()` | Submit request |
| `pollForVideoResult()` | `pollForVideoResult()` | Poll for completion |
| `parseVideoResponse()` | `parseVideoResponse()` | Parse final response |

### Key Implementation Details

1. **Submission Phase:**
   - POST to `:predictLongRunning` endpoint
   - Receives operation name from `response.name`
   - 30-second timeout for submission

2. **Polling Phase:**
   - GET to `/{operationName}`
   - Polls every 5 seconds
   - Max 60 attempts (5 minutes total)
   - Checks `response.done === true`

3. **Response Parsing:**
   - Checks for `response.error` first
   - Navigates: `response → generateVideoResponse → generatedSamples[0] → video → uri`
   - Returns structured result with `success`, `videoUrl`, `taskId`, `message`

### Exported Functions

```javascript
module.exports = {
  generateVeoVideo,
  submitVideoGenerationRequest,
  pollForVideoResult,
  parseVideoResponse
};
```

All functions match backend implementation patterns and logic flow.
