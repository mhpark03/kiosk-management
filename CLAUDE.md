# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kiosk Management System - A full-stack application for managing retail kiosks, stores, users, and video content with comprehensive audit logging.

**Tech Stack:**
- Backend: Spring Boot 3.2.0 (Java 17), MySQL, AWS S3
- Frontend: React 19, Vite, React Router
- Infrastructure: AWS Elastic Beanstalk, RDS, S3

**Repository Structure:**
- `/backend` - Spring Boot REST API (Java 17, Gradle)
- `/firstapp` - React frontend (Vite, React Router, Axios)
- `/kiosk-downloader` - Electron desktop app for kiosk video management

## Development Commands

### Backend (Spring Boot)

**Run development server (local MySQL):**
```bash
cd backend
DB_PASSWORD=aioztesting JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun
```

**Run with dev profile (AWS RDS):**
```bash
cd backend
SPRING_PROFILES_ACTIVE=dev DB_PASSWORD=<password> ./gradlew.bat bootRun
```

**Build production JAR:**
```bash
cd backend
./gradlew.bat clean build -x test
# Output: build/libs/backend-0.0.1-SNAPSHOT.jar
```

**Run tests:**
```bash
cd backend
./gradlew.bat test
```

**API Documentation:**
- Swagger UI: http://localhost:8080/swagger-ui.html
- Health check: http://localhost:8080/actuator/health

### Frontend (React + Vite)

**Install dependencies:**
```bash
cd firstapp
npm install
```

**Run development server:**
```bash
cd firstapp
npm run dev
# Runs on http://localhost:5173
```

**Build for production:**
```bash
cd firstapp
npm run build
# Output: dist/
```

**Lint code:**
```bash
cd firstapp
npm run lint
```

### Kiosk Downloader (Electron Desktop App)

**Install dependencies:**
```bash
cd kiosk-downloader
npm install
```

**Run development mode:**
```bash
cd kiosk-downloader
npm start
# Opens Electron window
```

**Build for production:**
```bash
cd kiosk-downloader
npm run build
# Creates platform-specific installers in dist/
```

**Key features:**
- Auto-connects to backend API
- Downloads and manages kiosk videos locally
- Displays video title, description, thumbnail, file size, duration
- Download/delete functionality with progress tracking
- Video filtering (all/downloaded/pending)
- Responsive layout (vertical on narrow screens, horizontal on wide screens ≥1024px)
- Offline mode support

### Server Management

**Find process on port 8080:**
```bash
netstat -ano | findstr :8080
```

**Kill process by PID:**
```bash
taskkill //F //PID <pid>
```

## Architecture Overview

### Backend Architecture

**Core Domain Entities:**
- `Store` - Store/POS locations with auto-generated 8-digit `posid`
- `Kiosk` - Kiosk devices with auto-generated 12-digit `kioskid` and per-store `kioskno`
- `User` - User accounts with JWT authentication, role-based access
- `Video` - Video files stored in S3 with metadata and thumbnails
- `EntityHistory` - **Unified audit log** for all entity changes

**Entity Relationships:**
```
Store (1) ----< (N) Kiosk
  |                   |
  v                   v
EntityHistory <-- EntityHistory

User (1) ----< (N) Video
  |                   |
  v                   v
EntityHistory <-- EntityHistory
```

**Key Business Rules:**
- Store has unique 8-digit `posid` (auto-generated sequential)
- Kiosk has unique 12-digit `kioskid` (auto-generated sequential)
- Kiosk has `kioskno` within store (1, 2, 3...) - **composite unique with `posid`**
- `kioskno` is **never reused** even after deletion
- When store state → INACTIVE, all its ACTIVE kiosks → INACTIVE
- All state changes are logged to `entity_history`

**Service Layer Pattern:**
- Services handle business logic, ID generation, and validation
- Automatic history logging via `EntityHistoryService`
- Transaction management with `@Transactional`
- Soft deletes: entities marked as DELETED with `deldate` timestamp

**Security:**
- JWT-based stateless authentication
- Roles: USER (read-only), ADMIN (full access)
- Custom headers: `X-User-Email`, `X-User-Name` (Base64 encoded)
- CORS enabled for React frontend

### Frontend Architecture

**Key Components:**
- `Dashboard` - Analytics with Recharts (monthly installations, status trends, regional stats)
- `KioskManagement`, `StoreManagement`, `UserManagement` - CRUD with pagination
- `VideoManagement`, `VideoUpload` - Video library with S3 integration
- `KioskVideoManagement` - Per-kiosk video assignment interface
- `History`, `StoreHistory`, `UserHistory` - Entity-specific audit views
- `Navbar` - Role-based navigation
- `ProtectedRoute` - Authentication guard

**State Management:**
- **AuthContext**: Global auth state (user, token, login/logout)
- **Local state**: Component-level with useState/useEffect
- **No Redux**: Uses React Context + local state pattern

**Routing (HashRouter):**
- Uses `/#/path` format for S3 static hosting compatibility
- Protected routes wrap with `<ProtectedRoute>`
- All routes resolve to `index.html` for client-side routing

**API Service Layer:**
- Centralized axios instance in `services/api.js`
- Request interceptor adds JWT token and custom headers
- Service modules: `authService`, `kioskService`, `storeService`, `videoService`, etc.
- Converts Timestamp objects to ISO strings for API compatibility

### Kiosk Downloader Architecture

**Desktop Application:**
- Built with Electron 28.0
- Main process: `main.js` - Window management, IPC handlers, file system operations
- Renderer process: `renderer/` - UI and video management logic

**Key Files:**
- `main.js` - Electron main process, handles file downloads, video storage
- `renderer/app.js` - Frontend logic, API calls, video list rendering
- `renderer/styles.css` - Responsive UI styling with media queries
- `renderer/index.html` - Main window template

**Storage:**
- Videos saved to: `<userData>/videos/`
- Settings stored in: `<userData>/config.json`
- Auto-creates directories on first run

**API Integration:**
- Fetches kiosk-assigned videos via `/api/kiosks/{kioskId}/videos`
- Downloads videos using pre-signed S3 URLs (7-day validity)
- Tracks download progress with progress bar
- Offline mode: displays cached video list when backend unavailable

**UI Features:**
- Video display: Order number, title, description, thumbnail, file size, duration
- Status badges: Downloaded (green), Pending (yellow)
- Filter tabs: All videos, Downloaded only, Pending only
- Responsive layout: Vertical (< 1024px), Horizontal (≥ 1024px)
- Truncates long descriptions with ellipsis on wide screens

## Critical Business Rules

### Kiosk and Store State Management

**Kiosk States:**
- `PREPARING` - Initial state, not yet active
- `ACTIVE` - Operational
- `INACTIVE` - Decommissioned/ended
- `MAINTENANCE` - Under maintenance
- `DELETED` - Soft deleted

**Store States:**
- `ACTIVE` - Operational
- `INACTIVE` - Closed/inactive
- `DELETED` - Soft deleted

**Date Fields:**
- Kiosk `regdate` - Registration date (when created)
- Kiosk `setdate` - Start/activation date (when became active)
- Kiosk `deldate` - End/termination date (when ended or maintenance)
- Store `regdate` - Store registration date
- Store `deldate` - Store closure date

### Date Validation Rules

**ALL date comparisons use `.toLocalDate()` to ignore time components.**

Chronological order must be maintained:
1. Store `regdate`
2. Kiosk `regdate` (must be ≥ store regdate)
3. Kiosk `setdate` (must be ≥ kiosk regdate)
4. Kiosk `deldate` (must be ≥ kiosk setdate)
5. Store `deldate` (must be ≥ store regdate)

Enforced in `KioskService` and `StoreService`.

### Automatic State Transitions

**When changing to ACTIVE:**
- If `setdate` is empty, auto-set to today

**When changing to INACTIVE/MAINTENANCE:**
- If `deldate` is empty, auto-set to today

**Date field persistence by state:**
- PREPARING: `setdate` and `deldate` are null
- ACTIVE: `deldate` is null
- INACTIVE/MAINTENANCE: `deldate` is preserved

### Composite Unique Constraint

Kiosks have unique `(posid, kioskno)`:
- Each store has kiosks numbered 1, 2, 3, etc.
- `kioskno` auto-generated by finding MAX(kioskno) for that posid
- **Includes deleted kiosks** in MAX calculation to prevent number reuse
- Duplicate validation in both frontend and backend

### Cascading Updates

When Store state → INACTIVE:
- All ACTIVE kiosks for that store → INACTIVE
- Implemented in `StoreService.updateStore()` → `KioskService.updateKioskStateByPosid()`

## Unified Entity History System

**All entity changes logged to `entity_history` table:**
- `EntityType`: KIOSK, STORE, USER, VIDEO
- `ActionType`: CREATE, UPDATE, DELETE, RESTORE, STATE_CHANGE, LOGIN, LOGOUT, PASSWORD_CHANGE, VIDEO_UPLOAD, VIDEO_PLAY, VIDEO_DELETE, etc.
- Tracks: timestamp, user (email + display name), entity ID, field changes (old/new values), description

**Logging Pattern:**
```java
// After successful operation in service layer
entityHistoryService.recordVideoActivity(
    video.getId(),
    video.getTitle(),
    user,
    EntityHistory.ActionType.VIDEO_UPLOAD,
    "영상 업로드: " + video.getTitle()
);
```

**Transaction Propagation:**
- Use `@Transactional(propagation = Propagation.REQUIRES_NEW)` for history logging
- Ensures history commits independently even if main transaction fails

## Video Management with S3

**Upload Flow:**
1. Validate file (≤ 100MB, video/* MIME types)
2. Generate thumbnail using FFmpeg (frame at 1 second, 320px width)
3. Upload video to S3 `videos/` folder
4. Upload thumbnail to S3 `thumbnails/` folder
5. Store metadata in Video entity
6. Record VIDEO_UPLOAD in entity_history

**S3 Configuration:**
- Bucket: `${AWS_S3_BUCKET_NAME}` from environment
- Region: ap-northeast-2 (Seoul)
- Pre-signed URLs: 7-day expiration

**FFmpeg Dependency:**
- Installed via `.ebextensions/03_ffmpeg.config` on AWS EB
- Required for thumbnail generation on video upload

**Video Entity:**
- Links to User via `uploadedById`
- Stores S3 keys, URLs, thumbnails, title, description
- Activity tracked: UPLOAD, PLAY, DELETE

**Video Permissions:**
- **ADMIN users**: Can edit/delete any video regardless of uploader
- **Regular users**: Can only edit/delete their own videos
- Permission checks in `VideoService.updateVideo()` and `VideoService.deleteVideo()`
- Uses `UserRepository` to fetch user role information

## Dashboard Analytics

**Monthly Installations Chart:**
- Groups kiosks by `regdate` month
- **Excludes** INACTIVE and DELETED states
- Last 6 months rolling window
- Clickable bars filter to KioskManagement

**Weekly Status Trend:**
- Uses **different date fields per state**:
  - PREPARING: `regdate`
  - ACTIVE: `setdate`
  - INACTIVE/MAINTENANCE: `deldate`
- Last 6 months, weeks start Sunday
- Line chart with `dot={false}`

**Regional Statistics:**
- Groups by 17 Korean administrative regions
- Shows store count + kiosk counts by state
- Excludes DELETED kiosks
- Clickable cells filter management pages

**Region Extraction:**
- Parses store addresses for: Seoul, Busan, Daegu, Incheon, Gwangju, Daejeon, Ulsan, Sejong, Gyeonggi, Gangwon, Chungbuk, Chungnam, Jeonbuk, Jeonnam, Gyeongbuk, Gyeongnam, Jeju
- Normalizes variations (e.g., "서울시" → "서울특별시")

## Environment Configuration

### Backend Profiles

**Local (default):**
```bash
SPRING_PROFILES_ACTIVE=local ./gradlew.bat bootRun
```
- Database: localhost:3306/kioskdb
- Username: root
- Password: from `DB_PASSWORD` env var

**Dev (AWS RDS):**
```bash
SPRING_PROFILES_ACTIVE=dev DB_PASSWORD=<pass> ./gradlew.bat bootRun
```
- Database: AWS RDS endpoint from `DB_URL`
- Credentials from environment variables

**Prod (AWS RDS):**
```bash
SPRING_PROFILES_ACTIVE=prod ./gradlew.bat bootRun
```
- Production RDS instance
- All credentials from environment

**Required Environment Variables:**
- `SPRING_PROFILES_ACTIVE` (local/dev/prod)
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET` (format: `<secret>:<expiration-hours>`, default 24h)
- `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Frontend Environment

**.env.production:**
```
VITE_API_URL=http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
```

**Local development:**
- Automatically uses `http://localhost:8080/api`

## Database Configuration

**Local MySQL Setup:**
```sql
CREATE DATABASE kioskdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**JPA Configuration:**
```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: update  # Auto-create/update schema
    show-sql: true
```

**Timezone:** Asia/Seoul (server and database)

**Tables:**
- `stores` - Store/POS locations
- `kiosks` - Kiosk devices
- `users` - User accounts
- `videos` - Video metadata
- `entity_history` - Unified audit log

## Common Development Patterns

### ID Generation

**Store POS ID (8 digits):**
```java
String maxPosid = storeRepository.findMaxPosid();
long nextId = (maxPosid == null) ? 1 : Long.parseLong(maxPosid) + 1;
return String.format("%08d", nextId);
```

**Kiosk ID (12 digits):**
```java
String maxKioskid = kioskRepository.findMaxKioskid();
long nextId = (maxKioskid == null) ? 1 : Long.parseLong(maxKioskid) + 1;
return String.format("%012d", nextId);
```

**Kiosk Number (per store):**
```java
Integer maxKioskno = kioskRepository.findMaxKiosknoByPosid(posid);
return (maxKioskno == null) ? 1 : maxKioskno + 1;
```

### Soft Delete Pattern

**Mark as deleted:**
- Set `state` to DELETED
- Set `deldate` to current timestamp
- **Do not physically delete** from database

**Restore:**
- Set `state` back to INACTIVE (or previous state)
- Clear `deldate`

**Queries:**
- Default: exclude DELETED items
- Optional parameter to include deleted

### Adding New Entity with History

1. **Create entity** with JPA annotations
2. **Add to EntityHistory.EntityType** enum
3. **Create repository** extending JpaRepository
4. **Create service** with `@Transactional` methods
5. **Inject EntityHistoryService** and log changes
6. **Create controller** with `@PreAuthorize` for security
7. **Add frontend service** in `services/`
8. **Create React component** for CRUD
9. **Add route** in App.jsx
10. **Update Navbar** with new menu item

### Scheduled Tasks (Batch Jobs)

**Example:** `EntityHistoryCleanupScheduler.java`
- Uses `@Scheduled` annotation
- Runs in separate transaction (`REQUIRES_NEW`)
- Records batch execution to entity_history
- Cron: `@Scheduled(cron = "0 0 2 * * ?")` = 2 AM daily

**Manual trigger:**
```bash
POST /api/batch/cleanup-entity-history
Authorization: Bearer <admin-token>
```

## UI Localization

**Korean UI:**
- All user-facing text in Korean
- Code and comments in English
- Date/time formatting: Korea timezone (Asia/Seoul)
- Display format: `MM/dd HH:mm`

**Maintain Korean text when modifying UI components.**

## Deployment

### AWS Infrastructure

**Backend (Elastic Beanstalk):**
- Platform: Java 17 Corretto on Amazon Linux 2
- Port: 5000 (EB standard)
- Health check: `/actuator/health`
- Deployment: GitHub Actions on push to `main`
- Workflow: `.github/workflows/deploy-backend.yml`

**Procfile:**
```
web: java -Dserver.port=5000 -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-local} -jar application.jar
```

**Frontend (S3 Static Hosting):**
- Bucket: `kiosk-frontend-20251018`
- Region: ap-northeast-2
- Deployment: GitHub Actions on push to `main`
- Workflow: `.github/workflows/deploy-frontend.yml`
- Website URL: `http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com`

**Database (AWS RDS):**
- Engine: MySQL 8.0
- Instance: db.t3.micro (dev)
- Automated backups enabled
- Endpoint: `kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com:3306`

**S3 Video Storage:**
- Bucket: From `AWS_S3_BUCKET_NAME` env var
- Folders: `videos/`, `thumbnails/`
- Pre-signed URLs for playback

### GitHub Secrets Required

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `EB_S3_BUCKET` - EB deployment artifacts
- `EB_APPLICATION_NAME`
- `EB_ENVIRONMENT_NAME`
- `EB_ENVIRONMENT_URL`
- `S3_BUCKET_NAME` - Frontend hosting

### Manual Deployment

**Backend:**
```bash
cd backend
./gradlew.bat clean build -x test
# Upload build/libs/backend-0.0.1-SNAPSHOT.jar to EB via AWS Console
```

**Frontend:**
```bash
cd firstapp
npm run build
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete
```

## Security Notes

**Sensitive Files (Never Commit):**
- `backend/src/main/resources/application-dev.yml`
- `backend/src/main/resources/application-prod.yml`
- `firstapp/.env` (if contains production URLs)
- Any files with database credentials or API keys

**Authentication Flow:**
1. User logs in with email/password
2. Backend validates credentials
3. JWT issued with 24h expiration
4. Token stored in localStorage
5. Axios interceptor adds token to all requests
6. SecurityContext populated via JwtAuthenticationFilter

**Password Security:**
- BCrypt hashing with default strength (10 rounds)
- Never log or expose passwords
- Password change requires current password verification

## Mobile Responsiveness

**Orientation Change Handling:**
- App.jsx monitors `resize` and `orientationchange` events
- Updates dimensions state on rotation
- Triggers React re-render for layout adaptation

**CSS Media Queries:**
- Mobile breakpoint: 768px
- Landscape/portrait orientations handled separately
- Prevents iOS zoom on input focus (font-size: 16px minimum)

**Viewport:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
```

## Troubleshooting

### Backend won't start
- Check Java version: `java -version` (must be 17)
- Check MySQL: Can you connect to localhost:3306?
- Check `DB_PASSWORD` environment variable
- Check port 8080: `netstat -ano | findstr :8080`

### Frontend build fails
- Check Node version: `node -v` (must be 18+)
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for linting errors: `npm run lint`

### CORS errors
- Verify `CorsConfig.java` allowed origins
- Check frontend URL matches allowed origin
- Look for exact error in browser console

### JWT expires too quickly
- Default: 24 hours
- Configure via `JWT_SECRET`: `<secret>:<hours>`
- Example: `mysecret:168` for 7 days

### Video upload fails
- Check file size: Must be ≤ 100MB
- Check FFmpeg: `ffmpeg -version`
- Check S3 credentials in environment
- Check S3 bucket permissions

### Entity history not recording
- Check transaction propagation: Use `REQUIRES_NEW`
- Verify EntityHistoryService is injected
- Check if exception thrown before history call
- Look for errors: "Failed to record ... to entity_history"

### Dashboard charts empty
- Check date filters and state exclusions
- Verify kiosks have proper `regdate`, `setdate`, `deldate`
- Check browser console for data processing errors
- Ensure stores have valid addresses for regional stats

### Kiosk Downloader issues
- **App won't start**: Check Electron is installed (`npm install`)
- **Can't connect to backend**: Verify API URL in config, check backend is running
- **Downloads fail**: Check S3 pre-signed URL hasn't expired (7 days), verify internet connection
- **Videos not showing**: Check kiosk has assigned videos in KioskVideoManagement
- **Description not displaying**: Verify video has description field populated in backend
- **Layout issues**: Check screen width breakpoint (1024px), test responsive CSS with browser dev tools
