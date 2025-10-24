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
  └── runway/         # AI-generated videos
images/
  ├── uploads/        # User uploaded images
  └── runway/         # AI-generated images
thumbnails/
  ├── uploads/        # Thumbnails for uploaded content
  └── runway/         # Thumbnails for AI-generated content
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

### Elastic Beanstalk (Backend)

- Platform: Java 17 Corretto
- Environment variables must include: `DB_PASSWORD`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `runway.api.key`
- Health check endpoint: `/actuator/health`
- JAR name fixed: `backend-0.0.1-SNAPSHOT.jar` (see `build.gradle`)

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

## Configuration Files

- `backend/src/main/resources/application.yml` - Main Spring Boot config
- `backend/src/main/resources/application-local.yml` - Local MySQL configuration
- `backend/src/main/resources/application-dev.yml` - AWS development environment configuration
- `kiosk-downloader/config.json` - Electron app persistent config (API URL, credentials, download path)
- `firstapp/src/firebase-config.js` - Firebase configuration for admin dashboard
- `firstapp/.env.production` - Production API URL for React app

## Testing

Backend has minimal test coverage. When writing tests:
- Use `@SpringBootTest` for integration tests
- Use `@DataJpaTest` for repository tests
- Mock `HttpServletRequest` for controllers that extract headers
- For Runway ML integration, mock `RestTemplate` responses
