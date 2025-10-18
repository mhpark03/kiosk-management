# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a kiosk management system with a Spring Boot backend and React frontend. The system manages stores, kiosks, and users with comprehensive audit logging.

**Repository Structure:**
- `/backend` - Spring Boot REST API (Java 17, Gradle)
- `/firstapp` - React frontend (Vite, React Router, Axios)

## Development Commands

### Backend (Spring Boot)

**Run the backend server:**
```bash
cd backend
DB_PASSWORD=aioztesting JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun
```

**Clean build and run:**
```bash
cd backend
DB_PASSWORD=aioztesting JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat clean bootRun
```

**Run tests:**
```bash
cd backend
./gradlew.bat test
```

**Build without running:**
```bash
cd backend
./gradlew.bat build
```

### Frontend (React + Vite)

**Run development server:**
```bash
cd firstapp
npm run dev
```

**Build for production:**
```bash
cd firstapp
npm run build
```

**Lint:**
```bash
cd firstapp
npm run lint
```

### Server Management

**Find process on port 8080:**
```bash
netstat -ano | findstr :8080
```

**Kill process by PID:**
```bash
taskkill //F //PID <pid>
```

## Architecture

### Backend Architecture

**Core Domain Entities:**
- `Store` - Store/POS locations with auto-generated 8-digit `posid`
- `Kiosk` - Kiosk devices with auto-generated 12-digit `kioskid`, linked to stores via `posid`
- `User` - Users with Firebase authentication integration
- `EntityHistory` - **Unified audit log** for all entity changes

**Unified History System:**
All entity changes (stores, kiosks, users) are logged to a single `entity_history` table with:
- `EntityType` enum (KIOSK, STORE, USER) to distinguish entity types
- `ActionType` enum (CREATE, UPDATE, DELETE, RESTORE, STATE_CHANGE, LOGIN, LOGOUT, etc.)
- Tracks: timestamp, user, field changes (old/new values), descriptions

**Service Layer Patterns:**
- Services automatically log to `entity_history` via private `logHistory()` methods
- ID generation handled by services (`generatePosId()`, `generateKioskId()`)
- State management with cascading updates (e.g., store state change → kiosk state updates)
- Soft deletes: entities marked as DELETED with `deldate` timestamp

**Security:**
- JWT-based authentication with Firebase integration
- User roles: USER, ADMIN
- Security headers passed via: `X-User-Email`, `X-User-Name`
- CORS configured for `http://localhost:5173`

**Data Relationships:**
```
Store (posid) ←─ 1:N ─→ Kiosk (posid + kioskno)
   ↓                        ↓
EntityHistory          EntityHistory
```

### Frontend Architecture

**Key Components:**
- `StoreManagement`, `KioskManagement`, `UserManagement` - CRUD interfaces with pagination
- `History`, `StoreHistory`, `UserHistory` - Entity-specific history views
- `Dashboard` - Statistics and overview
- `Navbar` - Navigation with role-based menu items
- `ProtectedRoute` - Route guards checking authentication and roles

**Service Layer:**
- `authService.js` - Authentication, token management
- `storeService.js` - Store CRUD operations
- `kioskService.js` - Kiosk CRUD operations
- `userService.js` - User management (admin operations)
- `historyService.js` - Unified entity history fetching

**Pagination Pattern:**
All list views use client-side pagination with:
- State: `currentPage`, `itemsPerPage` (10)
- Logic: slice array based on current page
- UI: Previous/Next buttons + numbered page buttons
- Auto-reset to page 1 when data changes

**Authentication Flow:**
1. Firebase authentication via `authService`
2. Backend validates Firebase token
3. JWT issued for subsequent requests
4. Token stored in localStorage
5. Axios interceptor adds token to all requests

## Database Configuration

**Connection:**
- Database: MySQL on `localhost:3306`
- Database name: `kioskdb` (auto-created)
- Username: `root`
- Password: Set via `DB_PASSWORD` environment variable (default: `aioztesting`)
- Timezone: `Asia/Seoul`

**JPA:**
- DDL mode: `update` (auto-create/update tables)
- SQL logging enabled with formatting

## Critical Business Rules

### Kiosk and Store State Management

**Kiosk States:**
- `PREPARING` - Initial state, kiosk registered but not yet active
- `ACTIVE` - Kiosk is operational
- `INACTIVE` - Kiosk has been decommissioned/ended
- `MAINTENANCE` - Kiosk is under maintenance
- `DELETED` - Soft deleted (excluded from most queries)

**Store States:**
- `ACTIVE` - Store is operational
- `INACTIVE` - Store is closed/inactive
- `DELETED` - Soft deleted

**Date Fields and Their Meanings:**
- Kiosk `regdate` - Registration date (when kiosk was created)
- Kiosk `setdate` - Start/activation date (when kiosk became active)
- Kiosk `deldate` - End/termination date (when kiosk ended or entered maintenance)
- Store `regdate` - Store registration date
- Store `deldate` - Store closure/soft delete date

### Date Validation Rules

**ALL date comparisons use `.toLocalDate()` to ignore time components.**

Chronological order must be maintained:
1. Store `regdate`
2. Kiosk `regdate` (must be ≥ store regdate)
3. Kiosk `setdate` (must be ≥ kiosk regdate)
4. Kiosk `deldate` (must be ≥ kiosk setdate)
5. Store `deldate` (must be ≥ store regdate)

These validations are enforced in `KioskService` and `StoreService`.

### Automatic State Transitions (Frontend)

When editing kiosks in `KioskManagement.jsx`:

**Changing to ACTIVE:**
- If `setdate` is empty, auto-set to today

**Changing to INACTIVE or MAINTENANCE:**
- If `deldate` is empty, auto-set to today

**Setting `setdate`:**
- If current state is PREPARING, auto-change to ACTIVE

**Setting `deldate`:**
- If current state is ACTIVE, auto-change to PREPARING (this appears to be legacy behavior)

### Date Field Persistence Rules

When saving kiosk updates (`handleEditKiosk`):
- If state is PREPARING: `setdate` and `deldate` are cleared (set to null)
- If state is ACTIVE: `deldate` is cleared (set to null)
- If state is INACTIVE or MAINTENANCE: `deldate` is preserved
- These rules ensure data consistency with state meanings

### Dashboard Chart Calculations

**Monthly Installation Count:**
- Counts kiosks by `regdate` (registration date)
- **Excludes** kiosks with state INACTIVE or DELETED
- Shows last 6 months with total in title
- Bars are clickable to filter kiosks by installation month

**Weekly Status Trend:**
- Uses **different date fields per state**:
  - PREPARING: counted by `regdate` (when registered)
  - ACTIVE: counted by `setdate` (when activated)
  - MAINTENANCE: counted by `deldate` (when maintenance started)
- Displays 6 months of data, weeks start on Sunday
- Line chart with `dot={false}` for clean visualization

**Regional Statistics Table:**
- Groups by Korean administrative regions (시/도 level)
- Shows store count and kiosk counts by state (Preparing, Active, Maintenance)
- Excludes DELETED kiosks from counts
- Clickable cells filter to respective management pages

### Korean Regional Categorization

Addresses are parsed to extract 17 standard Korean regions:
- Metropolitan cities: Seoul, Busan, Daegu, Incheon, Gwangju, Daejeon, Ulsan
- Special/autonomous cities: Sejong, Gangwon, Jeonbuk, Jeju
- Provinces: Gyeonggi, Chungbuk, Chungnam, Jeonnam, Gyeongbuk, Gyeongnam

Normalization handles variations (e.g., "서울시" → "서울특별시").

See `extractRegion()` function in `Dashboard.jsx` for implementation.

### Composite Unique Constraint

Kiosks have a unique constraint on `(posid, kioskno)`:
- Each store can have kiosks numbered 1, 2, 3, etc.
- `kioskno` is auto-generated per store by finding MAX(kioskno) for that posid
- Includes deleted kiosks in MAX calculation to prevent number reuse
- Duplicate validation checked both frontend and backend

### Cascading Store-to-Kiosk Updates

When a Store's state changes to INACTIVE:
- All ACTIVE kiosks for that store are automatically updated to INACTIVE
- Implemented in `StoreService.updateStore()` calling `KioskService.updateKioskStateByPosid()`
- This ensures kiosks can't be active in an inactive store

## Important Patterns

### When Adding Entity History Logging

All service methods that modify entities must call the private `logHistory()` method:

```java
private void logHistory(String entityId, String posid, String action,
                       String userEmail, String username, String fieldName,
                       String oldValue, String newValue, String description) {
    EntityHistory entityHistory = EntityHistory.builder()
        .entityType(EntityHistory.EntityType.KIOSK) // or STORE, USER
        .entityId(entityId)
        .posid(posid)
        .userid(userEmail)
        .username(username)
        .action(EntityHistory.ActionType.valueOf(action))
        .timestamp(LocalDateTime.now())
        .fieldName(fieldName)
        .oldValue(oldValue)
        .newValue(newValue)
        .description(description)
        .build();
    entityHistoryRepository.save(entityHistory);
}
```

### ID Generation Patterns

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

### Cascading State Updates

When a store's state changes to INACTIVE, all ACTIVE kiosks for that store are automatically updated to INACTIVE (see `StoreService.updateStore()` → `KioskService.updateKioskStateByPosid()`).

### Frontend Date Formatting

History dates are displayed in `MM/dd HH:mm` format (Korean timezone).

## UI Localization

The frontend UI is in Korean:
- Button labels, form fields, error messages all in Korean
- Date/time formatting uses Korean timezone (Asia/Seoul)
- Maintain Korean text when modifying UI components
