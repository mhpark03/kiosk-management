# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

This is a **Kiosk Management System** consisting of three applications:

1. **backend/** - Spring Boot REST API for managing kiosks, stores, videos/images, and events
2. **firstapp/** - React web dashboard for administrators (Vite + React 19)
3. **kiosk-downloader/** - Electron desktop app for kiosk devices to download/manage videos

### Architecture Flow

```
Kiosk Downloader (Electron)  ←→  Spring Boot Backend (Port 8080)  ←→  MySQL Database
                                           ↑
React Admin Dashboard (Port 5173) ────────┘

                                  AWS S3 (Media Storage)
                                           ↑
                                  Runway ML API (AI Generation)
```

## Running the Applications

### Backend (Spring Boot)

The backend requires MySQL and environment variables for database access.

```bash
# Development (local MySQL)
cd backend
DB_PASSWORD=aioztesting JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun

# Build
./gradlew.bat build

# Run tests
./gradlew.bat test
```

**Critical Environment Variables:**
- `DB_PASSWORD` - Required for MySQL (local profile)
- `JAVA_HOME` - Java 17 installation path
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - For S3 media storage
- `SPRING_PROFILES_ACTIVE` - Profile selection (local/dev/prod)
- `runway.api.key` - Runway ML API key for AI generation (optional)

### React Admin Dashboard

```bash
cd firstapp
npm install
npm run dev          # Development server on https://localhost:5173
npm run build        # Production build
npm run lint         # Run ESLint
```

### Kiosk Downloader (Electron)

```bash
cd kiosk-downloader
npm install
npm start                    # Run in development
npm run build:win            # Build Windows installer
```

## Key Architecture Patterns

### Backend Data Model Hierarchy

The system has a **three-tier kiosk identification** system:

1. **Store** (POS ID: 8 digits, e.g., "00000001")
   - Auto-generated sequential
   - Managed via `/api/stores`

2. **Kiosk** (Kiosk ID: 12 digits, e.g., "000000000001")
   - Auto-generated sequential globally
   - Kiosk Number: Sequential per-store (1, 2, 3...)
   - Belongs to exactly one Store (posid foreign key)
   - Managed via `/api/kiosks`

3. **Video** (assigned to Kiosks, also stores images)
   - Supports both VIDEO and IMAGE media types
   - Two source types: UPLOAD (user uploaded) and RUNWAY_GENERATED (AI generated)
   - Stored in AWS S3 with organized folder structure
   - Metadata in MySQL
   - Managed via `/api/videos`

### Media Management with AI Generation

The Video entity handles both videos and images with dual classification:

**VideoType enum:**
- `UPLOAD` - Regular uploaded video/image
- `RUNWAY_GENERATED` - AI-generated content from Runway ML

**MediaType enum:**
- `VIDEO` - Video file
- `IMAGE` - Image file

**S3 Folder Structure:**
```
videos/
  ├── uploads/        # User uploaded videos
  ├── runway/         # Runway ML generated videos
  └── veo/            # Google Veo generated videos
images/
  ├── uploads/        # User uploaded images
  └── runway/         # Runway ML generated images
thumbnails/
  ├── uploads/        # Thumbnails for uploaded content
  ├── runway/         # Thumbnails for Runway ML content
  └── veo/            # Thumbnails for Google Veo content
```

**Runway ML Integration:**
- Video generation: Models include gen3a_turbo, gen4_turbo, veo3, veo3.1, veo3.1_fast
- Image generation: gen4_image model with up to 5 reference images
- API base URL: `https://api.dev.runwayml.com` (dev) or `https://api.runwayml.com` (prod)
- Task-based async generation with polling (`/v1/tasks/{taskId}`)
- Metadata stored: taskId, model, resolution, prompt, duration (videos), style (images)

**Key Endpoints:**
- `/api/runway/generate-video` - Start video generation task
- `/api/runway/generate-image` - Start image generation task (POST `/v1/text_to_image`)
- `/api/runway/task-status/{taskId}` - Poll generation status
- `/api/videos/save-runway-video` - Save generated video to S3 and DB
- `/api/videos/save-runway-image` - Save generated image to S3 and DB

**Google Veo Integration:**
- Video generation using Google Generative Language API
- Model: `veo-3.1-generate-preview`
- API base: `https://generativelanguage.googleapis.com/v1beta`
- Requires `GOOGLE_AI_API_KEY` environment variable
- Task-based async generation similar to Runway ML
- Default settings: 720p resolution, 16:9 aspect ratio, 8 second duration
- S3 folder structure: `videos/veo/` and `thumbnails/veo/`
- VideoType enum includes `VEO_GENERATED` alongside `UPLOAD` and `RUNWAY_GENERATED`

**Veo Endpoints:**
- `/api/veo/generate-video` - Start Veo video generation
- `/api/veo/task-status/{taskId}` - Poll Veo generation status
- `/api/videos/save-veo-video` - Save generated video to S3 and DB

### Event Tracking System

All kiosk activities are tracked via `KioskEvent` entity with **client IP recording**:

- Event types: APP_START, SYNC_STARTED, DOWNLOAD_COMPLETED, CONFIG_SAVED, etc.
- Automatically captures client IP from HTTP request headers (X-Forwarded-For, X-Real-IP, or remote address)
- API: `/api/kiosk-events`
- Service uses `@Transactional(propagation = Propagation.REQUIRES_NEW)` to ensure events are always recorded

### Security Architecture

- **JWT-based authentication** (infrastructure ready, not fully enforced)
- Two authentication filters run in sequence:
  1. `KioskAuthenticationFilter` - For kiosk device authentication using X-Kiosk-Id header
  2. `JwtAuthenticationFilter` - For user JWT token authentication
- User email tracking via `X-User-Email` header for audit trails
- Spring Security configured but permissive for development
- Admin-only endpoints protected with `@PreAuthorize("hasRole('ADMIN')")`

### Soft Delete Pattern

Entities support soft delete with restore functionality:
- `deleted` boolean field
- `deletedAt` timestamp
- Repository methods with `@Where(clause = "deleted = false")` for default queries
- Explicit `includeDeleted` parameter for controllers to override

## Database Migrations

The backend uses **Hibernate auto-DDL** (`spring.jpa.hibernate.ddl-auto=update`). For manual migrations:

- Migration scripts stored in backend root (e.g., `add_client_ip_column.sql`)
- Apply manually when using `ddl-auto=none` or `validate` profiles
- When adding new fields like `mediaType` or `imageStyle`, the schema updates automatically on restart

## Frontend-Backend Integration

### CORS Configuration

Backend allows:
- React dev server: `https://localhost:5173`
- Electron app: All localhost ports via `http://localhost:*`

### Electron CSP (Content Security Policy)

Located in `kiosk-downloader/renderer/index.html`:
```
connect-src 'self' http://localhost:* http://127.0.0.1:*
            https://*.ap-northeast-2.amazonaws.com
            http://*.elasticbeanstalk.com
```

Add new backend URLs here if deployment changes.

### API Server Selection (Electron App)

The kiosk downloader supports three server modes:
- **Local server**: `http://localhost:8080/api`
- **AWS dev server**: Elastic Beanstalk URL
- **Custom**: User-provided URL

Configured in `kiosk-downloader/renderer/app.js` server selector radio buttons.

### AI Generation Workflow (React Dashboard)

**Video Generation** (`/videos/generate`):
1. User uploads 2 images, enters prompt, selects model/duration/resolution
2. Frontend calls `/api/runway/generate-video`
3. Backend converts images to base64, calls Runway ML `/v1/image_to_video`
4. Frontend polls `/api/runway/task-status/{taskId}` every 5 seconds
5. On completion, user can save video via `/api/videos/save-runway-video`

**Image Generation** (`/images/generate`):
1. User uploads 1-5 reference images, enters prompt, selects style/aspect ratio
2. Frontend calls `/api/runway/generate-image`
3. Backend formats as array of `{uri, tag}` objects, calls `/v1/text_to_image`
4. Frontend polls task status every 3 seconds
5. On completion, user can save image via `/api/videos/save-runway-image`

## AWS Deployment

### GitHub Actions CI/CD (Recommended)

The project uses **GitHub Actions for automated deployment** to avoid Windows ZIP path separator issues:

**Trigger Conditions:**
- Automatic: Push to `main` branch with changes in `backend/` folder
- Manual: Via GitHub Actions UI (workflow_dispatch)

**Deployment Process:**
1. Ubuntu runner builds JAR with Gradle
2. Python script (`create_deployment_package.py`) creates Linux-compatible ZIP with forward slashes
3. Uploads to S3 bucket: `elasticbeanstalk-ap-northeast-2-638596943554`
4. Creates Elastic Beanstalk application version
5. Deploys to environment: `Kiosk-backend-env`
6. Waits for deployment completion and verifies health

**Required GitHub Secrets:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `EB_S3_BUCKET`, `EB_APPLICATION_NAME`, `EB_ENVIRONMENT_NAME`, `EB_ENVIRONMENT_URL`

**Important:** Never create deployment ZIPs on Windows with PowerShell `Compress-Archive` - it uses backslashes which causes EB deployment failures. Always use the GitHub Actions workflow or the `create_deployment_package.py` script.

### Elastic Beanstalk (Backend)

- Platform: Java 17 Corretto (Amazon Linux 2023)
- Environment: `Kiosk-backend-env`
- Application: `Kiosk-backend`
- Environment variables must include: `DB_PASSWORD`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `runway.api.key`
- Health check endpoint: `/actuator/health`
- JAR name fixed: `backend-0.0.1-SNAPSHOT.jar` (see `build.gradle`)
- Port: 5000 (set in Procfile, overriding application.yml's 8080)

### S3 Media Storage

- SDK: AWS SDK for Java v2
- Service: `S3Service` handles presigned URLs for download
- Region: `ap-northeast-2` (Seoul)
- Separate folders for different media types and sources

## Important Implementation Details

### Sequential ID Generation

Both POS ID and Kiosk ID use **database-level MAX() queries** for sequential generation:

```java
// Example from KioskService
String nextId = kioskRepository.findMaxKioskid()
    .map(maxId -> String.format("%012d", Long.parseLong(maxId) + 1))
    .orElse("000000000001");
```

This is **not thread-safe** under high concurrency. Consider using database sequences for production.

### Kiosk History Tracking

All kiosk updates are automatically recorded in `kiosk_history` table via `@EntityListeners(KioskAuditListener.class)` on the Kiosk entity. The listener captures:
- Old state before update
- User who made the change (from X-User-Email header)
- Timestamp

### Video Download Flow (Electron App)

1. App calls `/api/kiosks/kioskid/{id}` to get assigned videos
2. For each video, calls `/api/videos/{id}/download-url` to get presigned S3 URL
3. Downloads file from S3 using presigned URL
4. Records events: DOWNLOAD_STARTED, DOWNLOAD_PROGRESS, DOWNLOAD_COMPLETED/FAILED

### Kiosk Unattended Operation

**IMPORTANT:** Kiosks operate unattended without human supervision. UI behavior must follow these rules:

**Popup Display Rules:**
- ✅ **Show popups ONLY for manual user actions** (button clicks when a person is present)
- ❌ **NEVER show popups for automated events** (WebSocket commands, background sync, scheduled tasks)

**Automated Events (Console Log Only):**
- WebSocket SYNC_COMMAND from admin web
- Automatic video synchronization
- Background downloads
- Config updates pushed from backend
- Heartbeat and connection status updates

**Manual Events (Allow Popups):**
- User clicks "동기화" button manually
- User triggers downloads via UI
- User changes settings
- Errors that require user intervention

**Implementation Pattern:**
```javascript
// Good: Automated sync (no popup)
case 'SYNC_COMMAND':
  console.log('[SYNC_COMMAND] Starting automated sync...');
  if (window.syncVideos) {
    window.syncVideos(true); // isAutoSync = true, no popups
  }
  break;

// Good: Manual sync (with popup)
function onManualSyncClick() {
  window.syncVideos(false); // isAutoSync = false, show popups
}
```

This ensures kiosks can operate 24/7 without user interaction or popup accumulation blocking the screen.

### FFmpeg Thumbnail Generation

For uploaded videos, thumbnails are generated using FFmpeg:
```java
ProcessBuilder processBuilder = new ProcessBuilder(
    "ffmpeg",
    "-i", videoPath,
    "-ss", "00:00:01.000",
    "-vframes", "1",
    "-vf", "scale=320:-1",
    "-y",
    thumbnailPath
);
```

For images (both uploaded and AI-generated), the original image is copied as the thumbnail.

### Runway ML API Version Header

All Runway ML API requests must include:
```
X-Runway-Version: 2024-11-06
```

Task polling typically requires 60-120 attempts with 3-5 second intervals depending on generation complexity.

### String Truncation for Database Saves

VideoService automatically truncates VARCHAR fields to prevent database errors:

```java
// Database column length limits enforced
private static final int MAX_TITLE_LENGTH = 255;
private static final int MAX_FILENAME_LENGTH = 255;
private static final int MAX_RUNWAY_TASK_ID_LENGTH = 100;
private static final int MAX_RUNWAY_MODEL_LENGTH = 50;
private static final int MAX_RUNWAY_RESOLUTION_LENGTH = 50;
private static final int MAX_IMAGE_STYLE_LENGTH = 50;

// Truncate utility logs warnings when truncation occurs
private String truncate(String value, int maxLength) { ... }
```

Applied to all save/update methods:
- `uploadVideo()` - User uploads
- `saveRunwayGeneratedVideo()` - Runway ML videos
- `saveRunwayGeneratedImage()` - Runway ML images
- `saveVeoGeneratedVideo()` - Google Veo videos
- `updateVideo()` - Title/description updates

TEXT columns (description, runwayPrompt) have no length limits.

## Configuration Files

- `backend/src/main/resources/application.yml` - Main Spring Boot config
- `backend/src/main/resources/application-local.yml` - Local MySQL configuration
- `backend/src/main/resources/application-dev.yml` - AWS development environment configuration
- `backend/Procfile` - Elastic Beanstalk process definition (sets port 5000)
- `backend/create_deployment_package.py` - Creates Linux-compatible deployment ZIPs
- `kiosk-downloader/config.json` - Electron app persistent config (API URL, credentials, download path)
- `firstapp/src/firebase-config.js` - Firebase configuration for admin dashboard
- `firstapp/.env.production` - Production API URL for React app
- `.github/workflows/deploy-backend.yml` - Backend CI/CD pipeline
- `.github/workflows/deploy-frontend.yml` - Frontend CI/CD pipeline

## Testing

Backend has minimal test coverage. When writing tests:
- Use `@SpringBootTest` for integration tests
- Use `@DataJpaTest` for repository tests
- Mock `HttpServletRequest` for controllers that extract headers
- For Runway ML integration, mock `RestTemplate` responses

## Troubleshooting

### Common Deployment Issues

**1. ZIP File Path Separator Errors**
```
Error: warning: /opt/elasticbeanstalk/deployment/app_source_bundle appears to use backslashes as path separators
```
**Solution:** Never use Windows PowerShell's `Compress-Archive`. Use GitHub Actions or `jar` command:
```bash
cd backend
jar cvf ../deploy.zip Procfile -C . build/libs/backend-0.0.1-SNAPSHOT.jar
```

**2. Application Not Starting (502 Bad Gateway)**
- Check EB environment health: Should be Green/Ok
- Verify environment variables are set (especially `DB_PASSWORD`)
- Check application logs in CloudWatch
- Try restarting the app server: `aws elasticbeanstalk restart-app-server`

**3. Database Connection Errors**
- Verify `DB_PASSWORD` environment variable matches RDS password
- Check RDS security group allows inbound from EB environment
- Ensure `SPRING_PROFILES_ACTIVE` is set to correct profile (local/dev/prod)

**4. Video Upload/Download Failures**
- Verify AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- Check S3 bucket permissions
- Ensure bucket name matches `AWS_S3_BUCKET_NAME` env var
- Check CORS configuration allows the origin domain

**5. Kiosk Event Recording Failures**
If you see transaction rollback errors:
- Check `entity_history` table schema
- Ensure `action` column is VARCHAR(50), not ENUM
- Ensure `entity_type` column is VARCHAR(50), not ENUM
- Ensure `userid` column allows NULL

### Manual Rollback

If deployment fails, rollback to previous version:
```bash
aws elasticbeanstalk update-environment \
  --environment-name Kiosk-backend-env \
  --version-label backend-YYYYMMDD-HHMMSS \
  --region ap-northeast-2
```

Find available versions:
```bash
aws elasticbeanstalk describe-application-versions \
  --application-name Kiosk-backend \
  --region ap-northeast-2 \
  --query "ApplicationVersions[*].VersionLabel"
```
