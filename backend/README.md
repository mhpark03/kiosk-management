# Kiosk Management Backend

Spring Boot REST API for Kiosk Management System

## Architecture

```
React Frontend (Port 5173)
         ↓
Spring Boot WAS (Port 8080)
         ↓
MySQL Database (Port 3306)
```

## Tech Stack

- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Build Tool**: Gradle
- **Database**: MySQL 8.0+
- **ORM**: Spring Data JPA (Hibernate)
- **Security**: Spring Security (JWT ready)
- **Validation**: Jakarta Validation

## Prerequisites

- Java 17 or higher
- MySQL 8.0 or higher
- Gradle (included via wrapper)

## Database Setup

### 1. Install MySQL

**Option 1: MySQL Community Server**
- Download from https://dev.mysql.com/downloads/mysql/
- Set root password during installation

**Option 2: XAMPP (Recommended for Windows)**
- Download from https://www.apachefriends.org/download.html
- Includes MySQL, easy to use

### 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Copy example file
cp .env.example .env

# Edit with your MySQL credentials
DB_URL=jdbc:mysql://localhost:3306/kioskdb?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
```

**Note:** The database `kioskdb` will be created automatically if it doesn't exist.

### 3. Set Environment Variables

**Windows (PowerShell):**
```powershell
$env:DB_USERNAME="root"
$env:DB_PASSWORD="your-db-password"
```

**Windows (Command Prompt):**
```cmd
set DB_USERNAME=root
set DB_PASSWORD=your-db-password
```

**Linux/Mac:**
```bash
export DB_USERNAME=root
export DB_PASSWORD=your-db-password
```

## Running the Application

### 1. Using Gradle Wrapper with MySQL (Recommended)

```bash
# Windows (PowerShell)
cd C:\claudtest\backend
$env:DB_PASSWORD="your-db-password"
.\gradlew.bat bootRun

# Windows (Command Prompt)
cd C:\claudtest\backend
set DB_PASSWORD=your-db-password
gradlew.bat bootRun

# Linux/Mac
export DB_PASSWORD=your-db-password
./gradlew bootRun
```

### 2. Using H2 for Development (No MySQL required)

```bash
# Windows
gradlew.bat bootRun --args='--spring.profiles.active=dev'

# Linux/Mac
./gradlew bootRun --args='--spring.profiles.active=dev'
```

### 3. Using IDE

- Open project in IntelliJ IDEA or Eclipse
- Set environment variables in Run Configuration:
  - `DB_PASSWORD=your-db-password`
- Run `BackendApplication.java`

### 4. Build JAR

```bash
# Build
gradlew.bat build

# Run JAR
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

## API Endpoints

### Store Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | Get all stores |
| GET | `/api/stores/{id}` | Get store by ID |
| GET | `/api/stores/posid/{posid}` | Get store by POS ID |
| POST | `/api/stores` | Create new store |
| PUT | `/api/stores/{id}` | Update store |
| DELETE | `/api/stores/{id}` | Soft delete store |
| POST | `/api/stores/{id}/restore` | Restore deleted store |
| DELETE | `/api/stores/{id}/permanent` | Permanently delete store |

### Kiosk Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kiosks` | Get all kiosks (supports filtering) |
| GET | `/api/kiosks/{id}` | Get kiosk by ID |
| GET | `/api/kiosks/kioskid/{kioskid}` | Get kiosk by Kiosk ID |
| GET | `/api/kiosks/next-number?posid=xxx` | Get next available kiosk number |
| GET | `/api/kiosks/{kioskid}/history` | Get kiosk history |
| POST | `/api/kiosks` | Create new kiosk |
| PUT | `/api/kiosks/{id}` | Update kiosk |
| PATCH | `/api/kiosks/{id}/state` | Update kiosk state |
| DELETE | `/api/kiosks/{id}` | Soft delete kiosk |
| POST | `/api/kiosks/{id}/restore` | Restore deleted kiosk |
| DELETE | `/api/kiosks/{id}/permanent` | Permanently delete kiosk |

## API Examples

### Create Store

```bash
curl -X POST http://localhost:8080/api/stores \
  -H "Content-Type: application/json" \
  -d '{
    "posname": "Test Store",
    "postcode": "12345",
    "address": "123 Main St",
    "addressDetail": "Suite 100",
    "state": "ACTIVE"
  }'
```

### Create Kiosk

```bash
curl -X POST http://localhost:8080/api/kiosks \
  -H "Content-Type: application/json" \
  -H "X-User-Email: user@example.com" \
  -d '{
    "posid": "00000001",
    "kioskno": 1,
    "maker": "Samsung",
    "serialno": "SN12345",
    "state": "ACTIVE"
  }'
```

### Filter Kiosks

```bash
# Get all kiosks including deleted
curl "http://localhost:8080/api/kiosks?includeDeleted=true"

# Filter by store
curl "http://localhost:8080/api/kiosks?posid=00000001"

# Filter by maker
curl "http://localhost:8080/api/kiosks?maker=Samsung"

# Combined filters
curl "http://localhost:8080/api/kiosks?posid=00000001&maker=Samsung&includeDeleted=false"
```

## Database Schema

### Entities

- **User**: User authentication and info
- **Store**: Store/POS information
- **Kiosk**: Kiosk device information
- **KioskHistory**: Kiosk change history

### Auto-Generated IDs

- **POS ID**: 8-digit sequential (00000001, 00000002, ...)
- **Kiosk ID**: 12-digit sequential (000000000001, 000000000002, ...)
- **Kiosk Number**: Per-store sequential (1, 2, 3, ...)

## Features

- ✅ CRUD operations for Stores and Kiosks
- ✅ Soft delete with restore functionality
- ✅ Sequential ID generation
- ✅ Kiosk history tracking
- ✅ Filtering and searching
- ✅ CORS enabled for React frontend
- ✅ Input validation
- ✅ Global exception handling
- ✅ MySQL integration with environment variables
- ✅ H2 development profile
- 🔲 JWT authentication (ready to implement)
- 🔲 Role-based access control

## Development

### Project Structure

```
backend/
├── src/main/java/com/kiosk/backend/
│   ├── config/          # Configuration (CORS, Security)
│   ├── controller/      # REST Controllers
│   ├── dto/             # Data Transfer Objects
│   ├── entity/          # JPA Entities
│   ├── repository/      # JPA Repositories
│   ├── service/         # Business Logic
│   ├── security/        # Security (JWT, filters)
│   ├── exception/       # Exception handlers
│   └── BackendApplication.java
├── src/main/resources/
│   └── application.yml  # Configuration
└── build.gradle         # Dependencies
```

## Next Steps

1. **Install MySQL** (or use H2 with dev profile)
2. **Set environment variables** (DB_PASSWORD)
3. **Run** the application
4. **Test** APIs using curl or Postman
5. **Update** React frontend to call these APIs
6. **Implement** JWT authentication (optional)

## Troubleshooting

### Port already in use

```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :8080
kill -9 <PID>
```

### Database connection failed

**MySQL:**
- Check MySQL is running (XAMPP or MySQL service)
- Verify environment variables are set correctly
- Check MySQL root password matches DB_PASSWORD
- Verify port 3306 is open

**H2 (Development):**
- Use `--spring.profiles.active=dev` to use H2 instead
- Access H2 Console at http://localhost:8080/h2-console

### Build failed

```bash
# Clean build
gradlew.bat clean build --refresh-dependencies
```

## License

MIT
