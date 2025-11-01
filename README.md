# Kiosk Management System

[![Deploy Status](https://img.shields.io/badge/deploy-active-success)](https://github.com/mhpark03/kiosk-management)
[![Security](https://img.shields.io/badge/security-secured-blue)](https://github.com/mhpark03/kiosk-management)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

키오스크 관리 시스템 - Spring Boot 백엔드, React 웹 프론트엔드, Flutter 모바일/데스크톱 앱으로 구성된 풀스택 솔루션

## 📋 프로젝트 개요

키오스크 장비의 등록, 관리, 모니터링을 위한 통합 관리 시스템입니다. 매장(Store)과 키오스크(Kiosk) 정보를 효율적으로 관리하고, 영상 콘텐츠를 배포하며, 변경 이력을 추적할 수 있습니다.

## 🏗️ 아키텍처

```
React Admin Web               Spring Boot Backend          AWS RDS MySQL          AWS S3
Port 5173/80                  Port 8080                    Port 3306             (Video Storage)
     │                             │                             │                     │
     │──── API 요청 ───────────────│                             │                     │
     │                             │                             │                     │
     │                             │──── DB 쿼리 ────────────────│                     │
     │                             │                             │                     │
     │◄─── JSON 응답 ──────────────│                             │                     │
     │                             │                             │                     │
     │                             │◄─── 파일 업로드/다운로드 ───────────────────────────│
     │                             │                             │                     │
Flutter Kiosk App             │                             │                     │
(Windows/Android)             │                             │                     │
     │                             │                             │                     │
     │──── 영상 목록 조회 ──────────│                             │                     │
     │                             │                             │                     │
     │◄─── Presigned URL ──────────│                             │                     │
     │                             │                             │                     │
     └──── 영상 다운로드 ─────────────────────────────────────────────────────────────│
```

## 🚀 기술 스택

### Backend
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Build Tool**: Gradle
- **Database**: MySQL 8.0+ / AWS RDS
- **ORM**: Spring Data JPA (Hibernate)
- **Security**: Spring Security + JWT
- **Validation**: Jakarta Validation
- **File Storage**: AWS S3
- **Video Processing**: FFmpeg

### Web Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **UI Components**: Custom Components
- **Charts**: Recharts
- **Icons**: React Icons

### Mobile/Desktop Application
- **Framework**: Flutter 3.9+
- **Language**: Dart
- **Platforms**: Windows, Android
- **State Management**: Provider
- **Storage**: SharedPreferences + Secure Storage
- **Real-time Sync**: WebSocket/STOMP
- **Video Player**: video_player package
- **Background Tasks**: WorkManager

### DevOps & Cloud
- **CI/CD**: GitHub Actions
- **Backend Hosting**: AWS Elastic Beanstalk
- **Frontend Hosting**: AWS S3 Static Website
- **Database**: AWS RDS MySQL
- **File Storage**: AWS S3
- **Version Control**: Git + GitHub

## ✨ 주요 기능

### 매장 관리 (Store Management)
- ✅ 매장 등록/수정/삭제 (소프트 삭제)
- ✅ 자동 생성 8자리 POS ID
- ✅ 매장 상태 관리 (ACTIVE, INACTIVE, DELETED)
- ✅ 매장별 키오스크 현황 조회

### 키오스크 관리 (Kiosk Management)
- ✅ 키오스크 등록/수정/삭제
- ✅ 자동 생성 12자리 Kiosk ID
- ✅ 매장별 키오스크 번호 자동 부여
- ✅ 상태 관리 (PREPARING, ACTIVE, INACTIVE, MAINTENANCE)
- ✅ 제조사, 시리얼 번호 관리

### 사용자 관리 (User Management)
- ✅ Firebase 인증 연동
- ✅ JWT 기반 토큰 인증
- ✅ 역할 기반 접근 제어 (USER, ADMIN)
- ✅ 사용자 활동 이력 추적

### 이력 관리 (History Tracking)
- ✅ 통합 Entity History 시스템
- ✅ 모든 생성/수정/삭제/상태변경 이력 자동 기록
- ✅ 변경 전/후 값 추적
- ✅ 사용자별 작업 이력 조회

### 영상 관리 (Video Management)
- ✅ 영상 파일 업로드 (S3 저장)
- ✅ 자동 썸네일 생성 (FFmpeg)
- ✅ 영상 제목/설명 편집
- ✅ 영상 재생/삭제
- ✅ 역할 기반 권한 (ADMIN: 모든 영상 편집, USER: 본인 영상만)
- ✅ Presigned URL로 보안 다운로드 (7일 유효)

### 키오스크 영상 배포 (Kiosk Video Assignment)
- ✅ 키오스크별 영상 할당
- ✅ 재생 순서 관리
- ✅ 영상 통계 (할당된 키오스크 수)
- ✅ Electron 앱으로 자동 다운로드

### 키오스크 다운로더 앱 (Flutter App)
- ✅ Flutter 기반 크로스 플랫폼 지원 (Windows, Android)
- ✅ 이중 인증: 사용자 로그인 + 키오스크 헤더
- ✅ 할당된 영상 목록 자동 조회
- ✅ 영상 로컬 다운로드 및 관리
- ✅ 다운로드 진행률 표시
- ✅ WebSocket/STOMP 실시간 동기화
- ✅ 백그라운드 자동 동기화 (WorkManager)
- ✅ 내장 비디오 플레이어
- ✅ 반응형 Material Design UI

### 대시보드 (Dashboard)
- ✅ 월별 키오스크 설치 현황 차트
- ✅ 주간 상태별 추이 그래프
- ✅ 지역별 통계 테이블
- ✅ 실시간 현황 모니터링

## 📦 설치 및 실행

### 사전 요구사항

- Java 17 이상
- Node.js 16 이상
- MySQL 8.0 이상 (또는 AWS RDS)
- Git

### 1. 저장소 클론

```bash
git clone https://github.com/mhpark03/kiosk-management.git
cd kiosk-management
```

### 2. 백엔드 설정 및 실행

```bash
cd backend

# 환경 변수 파일 생성
cp .env.example .env
# .env 파일에서 DB 접속 정보 수정

# 로컬 환경으로 실행 (localhost MySQL)
SPRING_PROFILES_ACTIVE=local JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun

# 또는 개발 환경으로 실행 (AWS RDS)
SPRING_PROFILES_ACTIVE=dev JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun
```

서버가 `http://localhost:8080` 에서 실행됩니다.

### 3. 프론트엔드 설정 및 실행

```bash
cd firstapp

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

프론트엔드가 `http://localhost:5173` 에서 실행됩니다.

### 4. 키오스크 다운로더 앱 설정 및 실행

#### GitHub 릴리스에서 다운로드 (권장)

최신 릴리스에서 플랫폼별 앱을 다운로드할 수 있습니다:

https://github.com/mhpark03/kiosk-management/releases/latest

- **Windows**: `flutter_downloader_v2.0.0_windows.zip` 다운로드 및 압축 해제
- **Android**: `flutter_downloader_v2.0.0.apk` 다운로드 및 설치

#### 소스코드로 빌드

```bash
cd flutter_downloader

# 의존성 설치
flutter pub get

# Windows에서 실행
flutter run -d windows

# Android 에뮬레이터에서 실행
flutter run -d <device-id>

# Windows 릴리스 빌드
flutter build windows --release

# Android APK 빌드
flutter build apk --release
```

자세한 내용은 [flutter_downloader/CLAUDE.md](flutter_downloader/CLAUDE.md)를 참조하세요.

## 🌐 배포

### 환경별 설정

| 환경 | 프로파일 | 데이터베이스 | 백엔드 | 프론트엔드 |
|------|----------|--------------|--------|------------|
| **Local** | `local` | localhost MySQL | localhost:8080 | localhost:5173 |
| **Dev** | `dev` | AWS RDS | Elastic Beanstalk | S3 Static Website |
| **Prod** | `prod` | AWS RDS | Elastic Beanstalk | S3 + CloudFront |

### 자동 배포 (GitHub Actions)

`main` 브랜치에 푸시하면 자동으로 배포됩니다:

1. **백엔드**: AWS Elastic Beanstalk으로 배포
2. **프론트엔드**: AWS S3로 배포

자세한 내용은 [배포 가이드](AWS_DEPLOYMENT_CHECKLIST.md)를 참조하세요.

## 📚 문서

- [백엔드 상세 가이드](backend/README.md)
- [환경 설정 가이드](backend/ENVIRONMENT_SETUP.md)
- [AWS 배포 체크리스트](AWS_DEPLOYMENT_CHECKLIST.md)
- [배포 빠른 참조](DEPLOYMENT_QUICK_REFERENCE.md)
- [Claude Code 가이드](CLAUDE.md)

## 🔐 보안

- ✅ 데이터베이스 자격증명은 환경변수로 관리
- ✅ JWT Secret은 환경변수로 관리
- ✅ AWS 자격증명은 GitHub Secrets로 관리
- ✅ `.env` 파일은 `.gitignore`로 제외
- ✅ CORS 설정으로 허용된 도메인만 접근 가능

**Last Security Update**: 2025-10-19 - Database credentials rotated and EB environment updated

## 🛠️ 개발

### 프로젝트 구조

```
kiosk-management/
├── backend/                 # Spring Boot 백엔드
│   ├── src/main/java/
│   │   └── com/kiosk/backend/
│   │       ├── config/      # 설정 (CORS, Security)
│   │       ├── controller/  # REST API 컨트롤러
│   │       ├── dto/         # 데이터 전송 객체
│   │       ├── entity/      # JPA 엔티티
│   │       ├── repository/  # 데이터 접근 계층
│   │       ├── service/     # 비즈니스 로직
│   │       └── security/    # 인증/인가
│   └── src/main/resources/
│       ├── application.yml
│       ├── application-local.yml
│       ├── application-dev.yml
│       └── application-prod.yml
│
├── firstapp/               # React 웹 프론트엔드
│   ├── src/
│   │   ├── components/    # React 컴포넌트
│   │   ├── services/      # API 서비스
│   │   └── App.jsx
│   └── .env.production
│
├── flutter_downloader/    # Flutter 모바일/데스크톱 앱
│   ├── lib/
│   │   ├── main.dart       # 앱 진입점
│   │   ├── models/         # 데이터 모델
│   │   ├── services/       # API 및 스토리지 서비스
│   │   ├── screens/        # UI 화면
│   │   └── widgets/        # 재사용 가능한 위젯
│   ├── android/            # Android 빌드 설정
│   ├── windows/            # Windows 빌드 설정
│   ├── pubspec.yaml        # Flutter 의존성
│   └── CLAUDE.md           # 개발 가이드
│
└── .github/
    └── workflows/         # GitHub Actions CI/CD
```

### API 엔드포인트

주요 API 엔드포인트:

**매장 관리**
```
GET    /api/stores              # 매장 목록 조회
POST   /api/stores              # 매장 등록
GET    /api/stores/{id}         # 매장 상세 조회
PUT    /api/stores/{id}         # 매장 수정
DELETE /api/stores/{id}         # 매장 삭제 (소프트)
```

**키오스크 관리**
```
GET    /api/kiosks              # 키오스크 목록 조회
POST   /api/kiosks              # 키오스크 등록
GET    /api/kiosks/{id}         # 키오스크 상세 조회
PUT    /api/kiosks/{id}         # 키오스크 수정
PATCH  /api/kiosks/{id}/state   # 키오스크 상태 변경
```

**영상 관리**
```
GET    /api/videos                      # 영상 목록 조회 (ADMIN)
POST   /api/videos/upload               # 영상 업로드 (ADMIN)
GET    /api/videos/{id}                 # 영상 상세 조회
GET    /api/videos/{id}/presigned-url   # 재생용 Presigned URL 생성
PATCH  /api/videos/{id}                 # 영상 정보 수정 (ADMIN)
DELETE /api/videos/{id}                 # 영상 삭제 (ADMIN)
GET    /api/videos/my-videos            # 내가 업로드한 영상 조회
```

**키오스크 영상 배포**
```
GET    /api/kiosks/{id}/videos          # 키오스크에 할당된 영상 목록
POST   /api/kiosks/{id}/videos          # 키오스크에 영상 할당 (ADMIN)
DELETE /api/kiosks/{id}/videos/{videoId} # 영상 할당 해제 (ADMIN)
PUT    /api/kiosks/{id}/videos/order    # 영상 재생 순서 변경 (ADMIN)
```

**이력 관리**
```
GET    /api/history/kiosk/{kioskid}  # 키오스크 이력
GET    /api/history/store/{posid}    # 매장 이력
GET    /api/history/user/{email}     # 사용자 이력
```

## 🧪 테스트

```bash
# 백엔드 테스트
cd backend
./gradlew.bat test

# 프론트엔드 lint
cd firstapp
npm run lint
```

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**mhpark03**

- GitHub: [@mhpark03](https://github.com/mhpark03)

## 🙏 Acknowledgments

- Spring Boot Documentation
- React Documentation
- AWS Documentation
- All contributors who helped with this project
