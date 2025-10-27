# Google Cloud Text-to-Speech Setup Guide

This guide explains how to set up Google Cloud TTS (Text-to-Speech) API for the kiosk backend.

## Prerequisites

- Google Cloud account with billing enabled
- Google Cloud TTS API requires billing, but has a generous free tier:
  - **1 million characters/month free** for Standard voices
  - **4 million characters/month free** for WaveNet/Neural2 voices

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing project
3. Note your Project ID

## Step 2: Enable Text-to-Speech API

1. Go to **APIs & Services > Library**
2. Search for "**Cloud Text-to-Speech API**"
3. Click **Enable**

## Step 3: Enable Billing

1. Go to **Billing** in the Google Cloud Console
2. Link a billing account to your project
3. Note: The free tier is very generous, and you won't be charged unless you exceed it

## Step 4: Create Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **+ CREATE SERVICE ACCOUNT**
3. Enter details:
   - **Service account name**: `tts-service-account` (or any name you prefer)
   - **Service account ID**: Will be auto-generated
   - **Description**: "Service account for Text-to-Speech API"
4. Click **CREATE AND CONTINUE**

## Step 5: Grant Permissions

1. On the "Grant this service account access to project" page:
   - Select role: **Cloud Text-to-Speech User**
   - Click **CONTINUE**
2. Click **DONE**

## Step 6: Create and Download JSON Key

1. In the Service Accounts list, find your newly created service account
2. Click the **⋮** (three dots) menu > **Manage keys**
3. Click **ADD KEY > Create new key**
4. Select **JSON** format
5. Click **CREATE**
6. The JSON key file will be downloaded to your computer
   - **Keep this file secure! It contains authentication credentials**

## Step 7: Configure Backend

### Option 1: File Path Configuration (Recommended)

1. Place the JSON key file somewhere secure on your system, for example:
   ```
   C:\secure\google-tts-service-account.json
   ```

2. Update `backend/src/main/resources/application-local.yml`:
   ```yaml
   google:
     tts:
       credentials:
         file: C:/secure/google-tts-service-account.json
   ```

3. Restart the backend server

### Option 2: Environment Variable (Alternative)

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable:

**Windows (Command Prompt):**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\secure\google-tts-service-account.json
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\google-tts-service-account.json"
```

**Linux/Mac:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-tts-service-account.json
```

Then run the backend as usual.

## Step 8: Verify Setup

1. Start the backend server
2. Check the logs for:
   ```
   Google Cloud TTS credentials loaded successfully
   ```

3. Go to the frontend at `http://localhost:5173/#/audio/generate`
4. Enter text and generate audio
5. If successful, you should see an audio player with the generated speech

## Troubleshooting

### Error: "Your default credentials were not found"

**Cause**: Credentials file not found or not configured correctly

**Solution**:
- Verify the file path in `application-local.yml` is correct
- Use forward slashes (`/`) even on Windows: `C:/path/to/file.json`
- Or set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Error: "Permission denied" or "Forbidden"

**Cause**: Service account doesn't have proper permissions

**Solution**:
- Go to IAM & Admin > IAM in Google Cloud Console
- Find your service account
- Add the **Cloud Text-to-Speech User** role

### Error: "API is not enabled"

**Cause**: Text-to-Speech API not enabled for the project

**Solution**:
- Go to APIs & Services > Library
- Search for "Cloud Text-to-Speech API"
- Click Enable

### Error: "Billing is not enabled"

**Cause**: Project doesn't have billing enabled

**Solution**:
- Go to Billing in Google Cloud Console
- Link a billing account to your project
- Note: You won't be charged within the free tier limits

## Security Best Practices

1. **Never commit credentials to Git**:
   - The `.gitignore` file is already configured to exclude `*-service-account.json` files
   - Double-check before committing

2. **Restrict service account permissions**:
   - Only grant the minimum required role: **Cloud Text-to-Speech User**
   - Don't use the Project Owner or Editor role

3. **Rotate keys periodically**:
   - Delete old keys in Google Cloud Console
   - Generate new keys every 3-6 months

4. **Store credentials securely**:
   - Keep the JSON file in a secure location
   - Don't share it via email or chat
   - Use environment-specific credentials for dev/staging/production

## Available Voices

The system supports multiple languages and voices:

### Korean
- `ko-KR-Neural2-A` - Female
- `ko-KR-Neural2-B` - Female
- `ko-KR-Neural2-C` - Male

### English (US)
- `en-US-Neural2-A` - Female
- `en-US-Neural2-C` - Female
- `en-US-Neural2-D` - Male
- `en-US-Neural2-J` - Male

### Japanese
- `ja-JP-Neural2-B` - Female
- `ja-JP-Neural2-C` - Male

### Chinese (Simplified)
- `zh-CN-Neural2-A` - Female
- `zh-CN-Neural2-B` - Male

For a complete list of voices, see the [Google Cloud TTS documentation](https://cloud.google.com/text-to-speech/docs/voices).

## API Usage and Pricing

### Free Tier (Monthly)
- Standard voices: 0-1 million characters free
- WaveNet/Neural2 voices: 0-4 million characters free

### Paid Tier (per million characters)
- Standard voices: $4.00
- WaveNet/Neural2 voices: $16.00

### Example Usage
- Average sentence: ~50 characters
- 1,000 sentences = 50,000 characters
- **Within free tier**: ~80,000 sentences/month with Neural2 voices

## Support

For issues with this setup:
1. Check backend logs: `backend/logs/application.log`
2. Check Google Cloud Console for API quota/errors
3. Verify service account permissions in IAM

For Google Cloud TTS API documentation:
- [Getting Started](https://cloud.google.com/text-to-speech/docs/quickstart-client-libraries)
- [Available Voices](https://cloud.google.com/text-to-speech/docs/voices)
- [Pricing](https://cloud.google.com/text-to-speech/pricing)
