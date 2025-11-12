# Kiosk Management System - Backend API

Spring Boot REST API for managing kiosks, stores, videos, events, and AI content generation using Runway ML.

## Overview

This backend provides a comprehensive REST API for:
- **Kiosk & Store Management** - Three-tier kiosk identification system
- **Video & Media Management** - AWS S3 storage with presigned URLs
- **AI Content Generation** - Runway ML integration for image/video generation
- **User Authentication** - JWT-based authentication with role management
- **Event Tracking** - Comprehensive activity logging with client IP tracking
- **Admin Dashboard** - User and content management APIs

## Tech Stack

- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Build Tool**: Gradle 8.5
- **Database**: MySQL 8.0+
- **ORM**: Spring Data JPA (Hibernate)
- **Security**: Spring Security with JWT
- **Cloud Storage**: AWS S3 (SDK v2)
- **AI Integration**: Runway ML API
- **Validation**: Jakarta Validation

## Architecture

```
React Admin Dashboard (Port 5173)
Electron Kiosk App
         ↓
Spring Boot WAS (Port 8080)
         ↓
    MySQL Database (Port 3306)

AWS S3 (Media Storage)
Runway ML API (AI Generation)
```

## Prerequisites

- Java 17 or higher
- MySQL 8.0 or higher
- Gradle (included via wrapper)
- AWS account with S3 bucket (for media storage)
- Runway ML API key (for AI features)

## Environment Variables

### Required

```bash
# Database
DB_PASSWORD=your_mysql_password

# Java Runtime
JAVA_HOME=C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot
```

### Optional (for full features)

```bash
# AWS S3 (for video/image storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_REGION=ap-northeast-2

# Runway ML (for AI generation)
RUNWAY_API_KEY=your_runway_api_key

# Spring Profile
SPRING_PROFILES_ACTIVE=local  # local, dev, prod
```

## Google TTS Credentials Setup (Optional)

If you want to enable TTS (Text-to-Speech) functionality in the backend, you need to download the Google TTS service account credentials from S3.

### Download from S3 (Recommended for team development)

**Prerequisites:**
- AWS CLI installed and configured
- AWS credentials with S3 read access

**Method 1: AWS CLI (Quickest)**
```bash
# Navigate to backend directory
cd backend

# Download credentials from S3
aws s3 cp s3://kiosk-video-bucket/credentials/google-tts-service-account.json ./google-tts-service-account.json --region ap-northeast-2

# Verify download (file size should be ~2.3KB)
ls -lh google-tts-service-account.json  # Linux/Mac
dir google-tts-service-account.json     # Windows
```

**Method 2: Using DownloadCredentials Utility**
```bash
cd backend

# Set environment variables
set AWS_ACCESS_KEY_ID=your-access-key
set AWS_SECRET_ACCESS_KEY=your-secret-key
set AWS_S3_BUCKET_NAME=kiosk-video-bucket
set AWS_REGION=ap-northeast-2

# Build the project first (if not already built)
gradlew.bat build -x test

# Run the utility
java -cp build/libs/backend-0.0.1-SNAPSHOT.jar com.kiosk.backend.util.DownloadCredentials
```

**Expected Output:**
```
Downloading from S3: s3://kiosk-video-bucket/credentials/google-tts-service-account.json
Downloaded 2353 bytes
Saved to: C:\your-path\backend\google-tts-service-account.json

To use this file, set the environment variable:
GOOGLE_APPLICATION_CREDENTIALS=C:\your-path\backend\google-tts-service-account.json
```

**File Location:**
- The file will be saved to: `backend/google-tts-service-account.json`
- This file is already in `.gitignore` and will NOT be committed to Git
- Keep this file secure - it contains service account credentials

**Enable TTS in Backend:**

After downloading the credentials, add this to your environment:
```bash
# Enable TTS service (required)
set GOOGLE_TTS_ENABLED=true

# Or add to application-local.yml:
google:
  tts:
    enabled: true
    credentials:
      file: C:/claudtest/backend/google-tts-service-account.json
```

**Note:** TTS functionality is currently disabled by default to reduce backend memory usage. The video-editor app has its own direct Google TTS API integration that works independently of the backend.

## Database Setup

### 1. Install MySQL

**Option 1: MySQL Community Server**
- Download from https://dev.mysql.com/downloads/mysql/
- Set root password during installation

**Option 2: XAMPP (Recommended for Windows)**
- Download from https://www.apachefriends.org/download.html
- Includes MySQL, easy to use

### 2. Configure Database

The database `kioskdb` will be created automatically if it doesn't exist.

**Default Configuration (application-local.yml):**
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/kioskdb?createDatabaseIfNotExist=true
    username: root
    password: ${DB_PASSWORD}
```

### 3. Set Environment Variables

**Windows (Command Prompt):**
```cmd
set DB_PASSWORD=aioztesting
set JAVA_HOME=C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot
```

**Windows (PowerShell):**
```powershell
$env:DB_PASSWORD="aioztesting"
$env:JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot"
```

**Linux/Mac:**
```bash
export DB_PASSWORD=aioztesting
export JAVA_HOME=/path/to/jdk-17
```

## Running the Application

### Development (Local MySQL)

```bash
cd backend

# Windows (Command Prompt)
set DB_PASSWORD=aioztesting
set JAVA_HOME=C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot
gradlew.bat bootRun

# Linux/Mac
export DB_PASSWORD=aioztesting
./gradlew bootRun
```

### Build JAR

```bash
# Build
gradlew.bat build

# Run JAR
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

### Run Tests

```bash
gradlew.bat test
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login (returns JWT) |
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/forgot-password` | Password reset request |

**Example Login:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com",
  "role": "USER"
}
```

### Store Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | Get all stores |
| GET | `/api/stores/{id}` | Get store by ID |
| GET | `/api/stores/posid/{posid}` | Get store by POS ID (8 digits) |
| POST | `/api/stores` | Create new store |
| PUT | `/api/stores/{id}` | Update store |
| DELETE | `/api/stores/{id}` | Soft delete store |
| POST | `/api/stores/{id}/restore` | Restore deleted store |
| DELETE | `/api/stores/{id}/permanent` | Permanently delete store |

**POS ID Format:** 8-digit sequential (e.g., "00000001", "00000002")

### Kiosk Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kiosks` | Get all kiosks (supports filtering) |
| GET | `/api/kiosks/{id}` | Get kiosk by ID |
| GET | `/api/kiosks/kioskid/{kioskid}` | Get kiosk by Kiosk ID (12 digits) |
| GET | `/api/kiosks/next-number?posid=xxx` | Get next available kiosk number |
| GET | `/api/kiosks/{kioskid}/history` | Get kiosk change history |
| POST | `/api/kiosks` | Create new kiosk |
| PUT | `/api/kiosks/{id}` | Update kiosk |
| PATCH | `/api/kiosks/{id}/state` | Update kiosk state only |
| DELETE | `/api/kiosks/{id}` | Soft delete kiosk |
| POST | `/api/kiosks/{id}/restore` | Restore deleted kiosk |
| DELETE | `/api/kiosks/{id}/permanent` | Permanently delete kiosk |

**Kiosk ID Format:** 12-digit sequential (e.g., "000000000001", "000000000002")

**Filter Examples:**
```bash
# Get all kiosks including deleted
curl "http://localhost:8080/api/kiosks?includeDeleted=true"

# Filter by store (POS ID)
curl "http://localhost:8080/api/kiosks?posid=00000001"

# Filter by maker
curl "http://localhost:8080/api/kiosks?maker=Samsung"

# Combined filters
curl "http://localhost:8080/api/kiosks?posid=00000001&maker=Samsung"
```

### Video & Media Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | Get all videos/images (supports mediaType filter) |
| GET | `/api/videos/{id}` | Get video/image details |
| POST | `/api/videos/upload` | Upload video/image to S3 |
| PATCH | `/api/videos/{id}` | Update video/image metadata |
| DELETE | `/api/videos/{id}` | Delete video/image |
| GET | `/api/videos/{id}/presigned-url` | Get presigned S3 URL for playback |
| GET | `/api/videos/{id}/download-url` | Get presigned S3 URL for download |

**MediaType Filter:**
```bash
# Get only images
curl "http://localhost:8080/api/videos?mediaType=IMAGE"

# Get only videos
curl "http://localhost:8080/api/videos?mediaType=VIDEO"

# Get AI-generated images
curl "http://localhost:8080/api/videos?mediaType=AI_IMAGE"

# Get AI-generated videos
curl "http://localhost:8080/api/videos?mediaType=AI_VIDEO"
```

**Upload Example:**
```bash
curl -X POST http://localhost:8080/api/videos/upload \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@video.mp4" \
  -F "title=My Video" \
  -F "description=Video description" \
  -F "mediaType=VIDEO"
```

**Supported Formats:**
- **Video**: MP4, MPEG, MOV, AVI, WMV, WEBM
- **Image**: JPG, JPEG, PNG, GIF, BMP

### Runway ML AI Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/runway/generate-image` | Generate AI image (gen4_image model) |
| POST | `/api/runway/generate-video` | Generate AI video (veo3.1, gen4_turbo, etc.) |
| GET | `/api/runway/task-status/{taskId}` | Poll generation task status |
| POST | `/api/videos/save-runway-image` | Save generated image to S3/DB |
| POST | `/api/videos/save-runway-video` | Save generated video to S3/DB |

**Image Generation Example:**
```bash
curl -X POST http://localhost:8080/api/runway/generate-image \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "images=@ref1.jpg" \
  -F "images=@ref2.jpg" \
  -F "imageUrls=https://s3.amazonaws.com/bucket/image.jpg" \
  -F "prompt=A beautiful sunset landscape" \
  -F "aspectRatio=1920:1080"
```

**Key Features:**
- **Dual image sources**: Accepts both uploaded files (`images`) and S3 URLs (`imageUrls`)
- **Auto aspect ratio adjustment**: Automatically adds padding to images outside 0.5-2.0 ratio
  - Too tall (<0.5): Adds left/right black padding → 0.7 ratio
  - Too wide (>2.0): Adds top/bottom black padding → 1.5 ratio
- **Supported models**:
  - Image: `gen4_image`
  - Video: `veo3.1_fast`, `veo3.1`, `veo3`, `gen4_turbo`, `gen3a_turbo`

**Video Generation Example:**
```bash
curl -X POST http://localhost:8080/api/runway/generate-video \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "images=@ref1.jpg" \
  -F "images=@ref2.jpg" \
  -F "prompt=Smooth camera pan across landscape" \
  -F "model=veo3.1_fast" \
  -F "duration=8" \
  -F "resolution=720p"
```

### Admin Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users |
| PUT | `/api/admin/users/{id}/role` | Update user role |
| PUT | `/api/admin/users/{id}/active` | Activate/deactivate user |
| POST | `/api/admin/users/{userId}/videos/{videoId}` | Assign video to user |

**Update User Role:**
```bash
curl -X PUT http://localhost:8080/api/admin/users/1/role \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

### Event Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kiosk-events` | Get all kiosk events |
| POST | `/api/kiosk-events` | Create new event |

**Event Types:**
- `APP_START` - Kiosk app started
- `APP_CLOSE` - Kiosk app closed
- `SYNC_STARTED` - Sync operation started
- `SYNC_COMPLETED` - Sync completed successfully
- `SYNC_FAILED` - Sync failed
- `DOWNLOAD_STARTED` - Video download started
- `DOWNLOAD_PROGRESS` - Download progress update
- `DOWNLOAD_COMPLETED` - Download completed
- `DOWNLOAD_FAILED` - Download failed
- `CONFIG_SAVED` - Configuration saved
- `CONFIG_DELETED` - Configuration deleted
- `ERROR_OCCURRED` - General error

**All events automatically track:**
- Client IP address (from X-Forwarded-For, X-Real-IP, or remote address)
- Timestamp
- Kiosk ID
- Event details

## Database Schema

### Core Entities

#### User
- `id` (PK): Long
- `email`: String (unique)
- `password`: String (BCrypt hashed)
- `username`: String
- `role`: Enum (USER, ADMIN)
- `active`: Boolean
- `createdAt`, `updatedAt`: Timestamp

#### Store
- `id` (PK): Long
- `posid`: String (8 digits, auto-generated, unique)
- `posname`: String
- `postcode`: String
- `address`: String
- `addressDetail`: String
- `state`: Enum (ACTIVE, INACTIVE)
- `deleted`: Boolean (soft delete)
- `deletedAt`: Timestamp

#### Kiosk
- `id` (PK): Long
- `kioskid`: String (12 digits, auto-generated, unique)
- `posid`: String (FK to Store)
- `kioskno`: Integer (per-store sequential: 1, 2, 3...)
- `maker`: String
- `serialno`: String
- `state`: Enum (ACTIVE, INACTIVE, MAINTENANCE)
- `deleted`: Boolean
- `deletedAt`: Timestamp

#### Video
- `id` (PK): Long
- `title`: String
- `description`: String
- `s3Key`: String (S3 object key)
- `s3Url`: String (S3 URL)
- `thumbnailUrl`: String
- `mediaType`: Enum (VIDEO, IMAGE, AI_IMAGE, AI_VIDEO)
- `fileSize`: Long
- `duration`: Integer (for videos)
- `uploadedAt`: Timestamp

#### KioskEvent
- `id` (PK): Long
- `kioskId`: String (12 digits)
- `eventType`: Enum
- `eventDetails`: String (JSON)
- `clientIp`: String (auto-captured)
- `createdAt`: Timestamp

#### KioskHistory
- `id` (PK): Long
- `kioskid`: String
- `changedBy`: String (user email from X-User-Email header)
- `changeType`: String
- `oldValue`: String (JSON)
- `newValue`: String (JSON)
- `changedAt`: Timestamp

### Auto-Generated IDs

- **POS ID**: 8-digit sequential via `MAX(posid) + 1` query
- **Kiosk ID**: 12-digit sequential via `MAX(kioskid) + 1` query
- **Kiosk Number**: Per-store sequential via `MAX(kioskno) + 1` for each `posid`

**Note:** Sequential generation is not thread-safe under high concurrency. Consider database sequences for production.

## Features

### Core Features
- ✅ Store and Kiosk CRUD with three-tier identification
- ✅ Soft delete with restore functionality
- ✅ Sequential ID auto-generation
- ✅ Kiosk change history with user tracking
- ✅ JWT-based user authentication
- ✅ Role-based access control (USER, ADMIN)

### Media Management
- ✅ Video/image upload to AWS S3
- ✅ Presigned URL generation for secure downloads
- ✅ MediaType filtering (VIDEO, IMAGE, AI_IMAGE, AI_VIDEO)
- ✅ Thumbnail support
- ✅ Multiple format support

### AI Integration
- ✅ Runway ML image generation (gen4_image)
- ✅ Runway ML video generation (veo3.1, gen4_turbo, etc.)
- ✅ Dual image source support (upload + S3)
- ✅ Auto aspect ratio adjustment with padding
- ✅ Task status polling
- ✅ Generated content saving to S3

### Event & Monitoring
- ✅ Comprehensive event tracking
- ✅ Client IP auto-capture
- ✅ Kiosk activity logging
- ✅ Download progress tracking

### Security
- ✅ JWT authentication
- ✅ Kiosk device authentication (X-Kiosk-Id header)
- ✅ User email tracking (X-User-Email header)
- ✅ CORS configuration
- ✅ Password encryption (BCrypt)

## Security Architecture

### Authentication Flow

1. **User Authentication** (Admin Dashboard)
   - Login via `/api/auth/login` with email/password
   - Returns JWT token
   - Token includes: email, role, expiration
   - Frontend sends token in `Authorization: Bearer <token>` header

2. **Kiosk Authentication** (Kiosk App)
   - Sends Kiosk ID in `X-Kiosk-Id` header
   - Validated by `KioskAuthenticationFilter`
   - No JWT required for kiosk operations

### Security Filters

Two authentication filters run in sequence:

1. **KioskAuthenticationFilter**
   - Checks `X-Kiosk-Id` header
   - Creates `KioskAuthentication` principal
   - Allows kiosk device API access

2. **JwtAuthenticationFilter**
   - Validates JWT token from `Authorization` header
   - Extracts user email and role
   - Creates `UsernamePasswordAuthenticationToken`

### Audit Trail

All kiosk updates are tracked via `KioskAuditListener`:
- Captures old state before update
- Records user email from `X-User-Email` header
- Saves to `kiosk_history` table
- Timestamp of change

## Configuration

### Application Profiles

- **local** (default): MySQL database
- **dev**: AWS development environment
- **prod**: Production environment

**Switch profiles:**
```bash
# Command line
gradlew.bat bootRun --args='--spring.profiles.active=dev'

# Environment variable
set SPRING_PROFILES_ACTIVE=dev
```

### CORS Configuration

**Allowed Origins (CorsConfig.java):**
- `https://localhost:5173` (React dev server)
- `http://localhost:*` (Electron app, all ports)
- Additional AWS/production URLs as needed

**Allowed Methods:** GET, POST, PUT, PATCH, DELETE, OPTIONS

**Allowed Headers:** Authorization, Content-Type, X-Kiosk-Id, X-User-Email, etc.

### S3 Configuration

**Region:** `ap-northeast-2` (Seoul)

**Presigned URL Expiration:**
- Playback URLs: 60 minutes
- Download URLs: 60 minutes

**Service:** `S3Service` handles all S3 operations

### Runway ML Configuration

**API Endpoint:** `https://api.runwayml.com/v1`

**Models:**
- **Image**: gen4_image
- **Video**: veo3.1_fast (default), veo3.1, veo3, gen4_turbo, gen3a_turbo

**Aspect Ratio Handling:**
- API requires: 0.5 to 2.0 ratio
- Auto-adjustment: Adds black padding if outside range
- Processing: Java BufferedImage with Graphics2D

## Project Structure

```
backend/
├── src/main/java/com/kiosk/backend/
│   ├── config/
│   │   ├── CorsConfig.java           # CORS configuration
│   │   ├── S3Config.java             # AWS S3 configuration
│   │   └── SecurityConfig.java       # Spring Security configuration
│   ├── controller/
│   │   ├── AuthController.java       # Authentication endpoints
│   │   ├── StoreController.java      # Store CRUD
│   │   ├── KioskController.java      # Kiosk CRUD
│   │   ├── VideoController.java      # Video/image management
│   │   ├── RunwayController.java     # Runway ML AI generation
│   │   ├── AdminController.java      # Admin operations
│   │   └── KioskEventController.java # Event tracking
│   ├── dto/
│   │   ├── LoginRequest.java
│   │   ├── LoginResponse.java
│   │   ├── RunwayVideoResponse.java
│   │   └── ...
│   ├── entity/
│   │   ├── User.java                 # User entity
│   │   ├── Store.java                # Store entity
│   │   ├── Kiosk.java                # Kiosk entity
│   │   ├── Video.java                # Video/image entity
│   │   ├── KioskEvent.java           # Event entity
│   │   └── KioskHistory.java         # History entity
│   ├── repository/
│   │   ├── UserRepository.java
│   │   ├── StoreRepository.java
│   │   ├── KioskRepository.java
│   │   ├── VideoRepository.java
│   │   ├── KioskEventRepository.java
│   │   └── KioskHistoryRepository.java
│   ├── service/
│   │   ├── AuthService.java          # Authentication logic
│   │   ├── UserService.java          # User management
│   │   ├── StoreService.java         # Store operations
│   │   ├── KioskService.java         # Kiosk operations
│   │   ├── VideoService.java         # Video/image operations
│   │   ├── S3Service.java            # AWS S3 operations
│   │   ├── RunwayService.java        # Runway ML integration
│   │   └── KioskEventService.java    # Event tracking
│   ├── security/
│   │   ├── JwtUtil.java              # JWT token utilities
│   │   ├── JwtAuthenticationFilter.java
│   │   ├── KioskAuthenticationFilter.java
│   │   └── KioskAuditListener.java   # Kiosk change listener
│   ├── exception/
│   │   └── GlobalExceptionHandler.java
│   └── BackendApplication.java
├── src/main/resources/
│   ├── application.yml               # Main configuration
│   ├── application-local.yml         # Local MySQL config
│   ├── application-dev.yml           # AWS dev config
│   └── application-prod.yml          # Production config
├── build.gradle                      # Dependencies
└── gradlew.bat                       # Gradle wrapper
```

## Deployment

### AWS Elastic Beanstalk

**Platform:** Java 17 Corretto

**Required Environment Variables:**
```
DB_PASSWORD=your_db_password
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_REGION=ap-northeast-2
RUNWAY_API_KEY=your_runway_key
SPRING_PROFILES_ACTIVE=prod
```

**Health Check:** `/actuator/health`

**JAR Name:** `backend-0.0.1-SNAPSHOT.jar` (fixed in build.gradle)

**Build for deployment:**
```bash
gradlew.bat clean build
```

Upload `build/libs/backend-0.0.1-SNAPSHOT.jar` to Elastic Beanstalk.

## Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :8080
kill -9 <PID>
```

### Database Connection Failed

**Check MySQL is running:**
- XAMPP: Start MySQL service
- Windows Service: Check "MySQL80" service is running

**Verify credentials:**
```bash
mysql -u root -p
# Enter password from DB_PASSWORD
```

**Check port 3306:**
```bash
netstat -an | findstr :3306
```

### Build Failed

```bash
# Clean build with dependency refresh
gradlew.bat clean build --refresh-dependencies

# Skip tests if needed
gradlew.bat build -x test
```

### AWS S3 Upload Failed

**Check AWS credentials:**
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Check IAM permissions for S3 PutObject

**Check bucket configuration:**
- Bucket must exist
- Bucket must be in correct region (ap-northeast-2)
- CORS must allow your origin

### Runway ML API Errors

**Check API key:**
- Verify `RUNWAY_API_KEY` is valid
- Check account has credits at https://runwayml.com

**Aspect ratio errors:**
- Backend auto-adjusts images with padding
- If still failing, check image file is not corrupted

**Task timeout:**
- Some generations take 1-3 minutes
- Increase polling timeout if needed

## Performance Notes

### Sequential ID Generation

**Current implementation:**
```java
String nextId = repository.findMaxKioskid()
    .map(maxId -> String.format("%012d", Long.parseLong(maxId) + 1))
    .orElse("000000000001");
```

**Warning:** This is NOT thread-safe under high concurrency. Multiple simultaneous requests may generate duplicate IDs.

**Recommended for production:**
- Use database sequences
- Implement distributed lock (Redis)
- Use UUID for IDs

### Event Recording

**Transaction Propagation:**
```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
```

Events are always recorded even if parent transaction fails. This ensures complete audit trail.

## Testing

**Run all tests:**
```bash
gradlew.bat test
```

**Run specific test class:**
```bash
gradlew.bat test --tests StoreServiceTest
```

**Test with coverage:**
```bash
gradlew.bat test jacocoTestReport
```

**Note:** Test coverage is minimal. Integration tests recommended for repository and service layers.

## Health Monitoring

After running the application, health check endpoints are available at:

- Health Check: `http://localhost:8080/actuator/health`
- Actuator Info: `http://localhost:8080/actuator/info`

## License

MIT

## Author

mhpark03

## Related Repositories

- **Frontend Dashboard**: [firstapp](../firstapp) - React admin dashboard
- **Kiosk App**: [kiosk-downloader](../kiosk-downloader) - Electron kiosk application

