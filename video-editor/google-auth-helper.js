/**
 * Google OAuth2 Authentication Helper
 * For Vertex AI API access using Service Account
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Service Account file path
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'google-service-account.json');

/**
 * Get OAuth2 access token using Service Account
 */
async function getAccessToken() {
  try {
    // Read service account key file
    const serviceAccountKey = JSON.parse(
      fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8')
    );

    // Create JWT client
    const jwtClient = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/cloud-platform'], // Vertex AI scope
      null
    );

    // Get access token
    const tokens = await jwtClient.authorize();
    return tokens.access_token;
  } catch (error) {
    console.error('[Google Auth] Failed to get access token:', error);
    throw new Error(`Failed to get Google OAuth2 token: ${error.message}`);
  }
}

/**
 * Get project ID from Service Account
 */
function getProjectId() {
  try {
    const serviceAccountKey = JSON.parse(
      fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8')
    );
    return serviceAccountKey.project_id;
  } catch (error) {
    console.error('[Google Auth] Failed to read project ID:', error);
    throw new Error(`Failed to read project ID: ${error.message}`);
  }
}

module.exports = {
  getAccessToken,
  getProjectId
};
