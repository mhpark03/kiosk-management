# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Multi-component kiosk management system with Spring Boot backend, React admin dashboard, Flutter kiosk app, and Electron video editor.

**Components:**
1. `backend/` - Spring Boot REST API (Java 17, Gradle)
2. `firstapp/` - React admin dashboard (Vite + React 19)
3. `flutter_downloader/` - Flutter kiosk app (Windows/Android)
4. `video-editor/` - Electron video editor with AI integrations

## Build & Run Commands

### Backend (Spring Boot)
```bash
cd backend

# Local development (localhost MySQL)
SPRING_PROFILES_ACTIVE=local JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun

# AWS development (RDS)
SPRING_PROFILES_ACTIVE=dev JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun

# Build JAR (skip tests for faster builds)
./gradlew.bat clean build -x test

# Run tests
./gradlew.bat test
```

### Frontend (React + Vite)
```bash
cd firstapp

# Development server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

### Video Editor (Electron)
```bash
cd video-editor
npm install
npm start  # Run in development
```

## Critical Architecture Patterns

### AI Content Upload Flow (video-editor → backend)

**IMPORTANT**: The video-editor uploads AI-generated content via `/api/ai/upload`:

```
video-editor → POST /api/ai/upload → AIContentController.uploadAIContent()
                                    → VideoService.uploadAIContent()
                                    → S3Service.uploadFile()
                                    → Video entity (AI_GENERATED, mediaType: IMAGE|VIDEO|AUDIO)
```

**Files that MUST NOT be deleted:**
- `AIContentController.java` - Editor uploads depend on this
- `VideoService.uploadAIContent()` method - Editor uploads depend on this

**Files deleted for memory optimization (editor calls APIs directly):**
- `RunwayController.java` - Editor has own Runway API integration
- `RunwayService.java` - Heavy image processing (460 lines), not needed
- Frontend: `VideoGenerator.jsx`, `veoService.js`, `runwayService.js`

### Video Entity Type System

```java
// Video.java
public enum VideoType {
    UPLOAD,          // Regular user uploads
    AI_GENERATED     // AI-generated content from editor (TTS, Imagen, Veo, Runway)
}

public enum MediaType {
    VIDEO,           // Video files
    IMAGE,           // Image files
    AUDIO            // Audio files (TTS, user uploads)
}
```

**S3 Folder Structure:**
```
videos/uploads/      # User uploaded videos
videos/ai/           # AI-generated videos
images/uploads/      # User uploaded images
images/ai/           # AI-generated images
audios/uploads/      # User uploaded audio
audios/ai/           # AI-generated audio (TTS from editor)
thumbnails/uploads/  # Thumbnails for uploads
thumbnails/ai/       # Thumbnails for AI content
```

### Three-Tier Kiosk Identification

1. **Store** (POS ID: 8 digits, e.g., "00000001")
   - Auto-generated via `MAX(posid) + 1`
   - **NOT thread-safe** under concurrency

2. **Kiosk** (Kiosk ID: 12 digits, e.g., "000000000001")
   - Auto-generated globally via `MAX(kioskid) + 1`
   - Kiosk Number: Per-store sequential (1, 2, 3...)
   - **NOT thread-safe** under concurrency

3. **Video** (assigned to kiosks)
   - Supports VIDEO, IMAGE, AUDIO media types
   - Two source types: UPLOAD, AI_GENERATED

## Environment Configuration

### Required Environment Variables
```bash
# Database
DB_PASSWORD=your_password

# Java
JAVA_HOME=C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot

# Profile
SPRING_PROFILES_ACTIVE=local  # or dev, prod
```

### Optional for Full Features
```bash
# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=kiosk-video-bucket
AWS_REGION=ap-northeast-2

# Google AI (for editor)
GOOGLE_AI_API_KEY=...

# Runway ML (for editor)
RUNWAY_API_KEY=...
```

## Deployment

### GitHub Actions Auto-Deploy

Push to `main` branch with changes in `backend/**` or `firstapp/**` triggers deployment:

**Backend → AWS Elastic Beanstalk:**
- Workflow: `.github/workflows/deploy-backend.yml`
- Platform: Java 17 Corretto on Amazon Linux 2023
- Instance: t3.micro (1GB RAM, AWS free tier)
- Environment: `kiosk-backend-prod-v2`
- Application: `kiosk-backend-v2`

**Frontend → AWS S3 Static Website:**
- Workflow: `.github/workflows/deploy-frontend.yml`

### AWS Elastic Beanstalk Configuration

**Memory Constraints (t3.micro = 1GB RAM):**
- JVM heap: `-Xmx512m -Xms256m` (set via JAVA_TOOL_OPTIONS)
- Deleted RunwayService (460 lines, memory intensive)
- Deleted frontend AI generators (1,640+ lines)
- Kept only AIContentController for editor uploads

**Environment Variables (set via EB console or eb-env-vars.json):**
```json
{
  "DB_PASSWORD": "...",
  "AWS_ACCESS_KEY_ID": "...",
  "AWS_SECRET_ACCESS_KEY": "...",
  "AWS_S3_BUCKET_NAME": "kiosk-video-bucket",
  "GOOGLE_AI_API_KEY": "...",
  "RUNWAY_API_KEY": "...",
  "JWT_SECRET": "...",
  "SPRING_PROFILES_ACTIVE": "dev"
}
```

**Note:** `eb-env-vars.json` is in `.gitignore` - DO NOT commit to git.

## Database Schema

### Soft Delete Pattern
All entities use soft delete:
```java
@Column(nullable = false)
private Boolean deleted = false;

@Column
private LocalDateTime deletedAt;
```

### History Tracking
All entity changes recorded via `@RecordActivity` annotation:
```java
@PostMapping
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_UPLOAD,
    description = "영상 업로드"
)
```

### Cleaning Up Old Video Types

Database may contain old enum values (RUNWAY_GENERATED, VEO_GENERATED) from before unification to AI_GENERATED.

**Cleanup script:**
```bash
cd backend
python delete_ai_videos.py  # Deletes RUNWAY_GENERATED, VEO_GENERATED videos
```

**SQL queries:**
```sql
-- Check for old types
SELECT COUNT(*), video_type FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
GROUP BY video_type;

-- Delete old types
DELETE FROM videos WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED');
```

## Key API Endpoints

### Authentication
Two authentication methods:

1. **User JWT** (Admin Dashboard):
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Kiosk Header** (Flutter App):
   ```
   X-Kiosk-Id: 000000000001
   ```

### Video/Media Upload

**Regular Upload (from dashboard):**
```bash
POST /api/videos/upload
Content-Type: multipart/form-data
- file: video/image/audio file
- title: string
- description: string
```

**AI Content Upload (from editor):**
```bash
POST /api/ai/upload
Content-Type: multipart/form-data
- file: AI-generated content
- title: string
- description: string
- mediaType: VIDEO|IMAGE|AUDIO
```

### Presigned URLs
```bash
GET /api/videos/{id}/presigned-url   # 60-minute expiry
GET /api/videos/{id}/download-url    # Download with filename
```

## Frontend Architecture

### React Components

**Media Management (separate pages):**
- `VideoManagement.jsx` - Videos only (filters out audio by contentType)
- `ImageManagement.jsx` - Images only
- `AudioManagement.jsx` - Audio only

**Navigation:**
```javascript
// Navbar.jsx
<Link to="/videos">영상 관리</Link>
<Link to="/audios">음성 관리</Link>  // Between videos and images
<Link to="/images">이미지 관리</Link>
```

### API Services

```javascript
// videoService.js
getAllVideos()     // Gets all media, filter by contentType in components
getAllAudios()     // Filters contentType.startsWith('audio/')
uploadVideo(...)   // POST /api/videos/upload
uploadAudio(...)   // POST /api/videos/upload (same endpoint)
```

## Video Editor Integration

### Editor Calls Backend APIs

**TTS Audio Upload:**
```javascript
// video-editor/renderer/modules/tts.js
const response = await fetch(`${backendBaseUrl}/api/ai/upload`, {
  method: 'POST',
  body: formData  // file, title, description, mediaType=AUDIO
});
```

**Imagen Image Upload:**
```javascript
// video-editor/renderer/modules/imagen.js
const response = await fetch(`${backendBaseUrl}/api/ai/upload`, {
  method: 'POST',
  body: formData  // file, title, description, mediaType=IMAGE
});
```

**Veo/Runway Video Upload:**
```javascript
// video-editor/renderer/modules/veo.js
// video-editor/renderer/modules/runway.js
const response = await fetch(`${baseUrl}/api/ai/upload`, {
  method: 'POST',
  body: formData  // file, title, description, mediaType=VIDEO
});
```

## Common Issues

### Memory Issues on t3.micro

**Symptoms:**
- Environment health shows "Warning: 95% memory in use"
- Application becomes unresponsive
- Deployment fails with timeout

**Solutions:**
1. Check instance health:
   ```bash
   aws elasticbeanstalk describe-instances-health \
     --environment-name kiosk-backend-prod-v2 \
     --region ap-northeast-2 \
     --attribute-names All
   ```

2. Restart application:
   ```bash
   aws elasticbeanstalk restart-app-server \
     --environment-name kiosk-backend-prod-v2 \
     --region ap-northeast-2
   ```

3. If persistent, consider:
   - Upgrading to t3.small (2GB RAM)
   - Removing FFmpeg thumbnail generation
   - Profiling for memory leaks

### Build Fails on GitHub Actions

**Common causes:**
- Compilation errors (missing dependencies)
- Incomplete/unclosed Java comments
- Missing closing braces

**Local verification:**
```bash
cd backend
./gradlew.bat clean build -x test
```

### Database Enum Errors

**Symptom:**
```
No enum constant com.kiosk.backend.entity.Video.VideoType.RUNWAY_GENERATED
```

**Cause:** Database contains old video_type values not in current enum.

**Fix:**
```bash
cd backend
python delete_ai_videos.py
```

## Security Notes

- Database credentials NOT in git (`.env`, `eb-env-vars.json` in `.gitignore`)
- AWS credentials in GitHub Secrets only
- JWT secret in environment variables
- API keys for Google/Runway in editor `.env` (not committed)
- CORS configured for localhost:5173, AWS S3 frontend, Elastic Beanstalk backend

## FFmpeg Integration

**Backend generates thumbnails:**
```java
ProcessBuilder pb = new ProcessBuilder(
    "ffmpeg",
    "-i", videoPath,
    "-ss", "00:00:01.000",
    "-vframes", "1",
    "-vf", "scale=320:-1",
    thumbnailPath
);
```

**Audio files skip thumbnail generation** (validated by contentType check in VideoService.java:736)

**Images use original as thumbnail** (copied byte-for-byte)

## AWS Resource Names

- **Backend Application**: kiosk-backend-v2
- **Backend Environment**: kiosk-backend-prod-v2
- **Backend URL**: http://kiosk-backend-prod-v2.eba-tm9pvuph.ap-northeast-2.elasticbeanstalk.com
- **Database**: kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com:3306/kioskdb
- **S3 Bucket**: kiosk-video-bucket
- **Region**: ap-northeast-2 (Seoul)

## Testing

Backend has minimal test coverage:
```bash
cd backend
./gradlew.bat test
```

Frontend has ESLint:
```bash
cd firstapp
npm run lint
```

## Related Documentation

- `backend/README.md` - Detailed backend API documentation
- `README.md` - Project overview and setup
- `AWS_DEPLOYMENT_CHECKLIST.md` - AWS deployment guide
- `flutter_downloader/CLAUDE.md` - Flutter app development guide
