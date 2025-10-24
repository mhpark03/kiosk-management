# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

This is a **Kiosk Management System** consisting of three applications:

1. **backend/** - Spring Boot REST API for managing kiosks, stores, videos, and events
2. **firstapp/** - React web dashboard for administrators (Vite + React 19)
3. **kiosk-downloader/** - Electron desktop app for kiosk devices to download/manage videos

### Architecture Flow

```
Kiosk Downloader (Electron)  ←→  Spring Boot Backend (Port 8080)  ←→  MySQL Database
                                           ↑
React Admin Dashboard (Port 5173) ────────┘

                                  AWS S3 (Video Storage)
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
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - For S3 video storage
- `SPRING_PROFILES_ACTIVE` - Profile selection (local/dev/prod)

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

3. **Video** (assigned to Kiosks)
   - Stored in AWS S3
   - Metadata in MySQL
   - Managed via `/api/videos`

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

## AWS Deployment

### Elastic Beanstalk (Backend)

- Platform: Java 17 Corretto
- Environment variables must include: `DB_PASSWORD`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`
- Health check endpoint: `/actuator/health`
- JAR name fixed: `backend-0.0.1-SNAPSHOT.jar` (see `build.gradle`)

### S3 Video Storage

- SDK: AWS SDK for Java v2
- Service: `S3Service` handles presigned URLs for download
- Region: `ap-northeast-2` (Seoul)

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

## Configuration Files

- `backend/src/main/resources/application.yml` - Main Spring Boot config
- `backend/src/main/resources/application-local.yml` - Local MySQL configuration
- `backend/src/main/resources/application-dev.yml` - AWS development environment configuration
- `kiosk-downloader/config.json` - Electron app persistent config (API URL, credentials, download path)
- `firstapp/src/firebase-config.js` - Firebase configuration for admin dashboard

## Testing

Backend has minimal test coverage. When writing tests:
- Use `@SpringBootTest` for integration tests
- Use `@DataJpaTest` for repository tests
- Mock `HttpServletRequest` for controllers that extract headers
