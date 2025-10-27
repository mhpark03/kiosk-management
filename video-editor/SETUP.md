# 설치 및 실행 가이드

## 빠른 시작

### 1. FFmpeg 설치 (필수)

Windows에서 FFmpeg 설치 방법:

#### 방법 A: Chocolatey 사용 (권장)

```bash
# Chocolatey가 설치되어 있다면
choco install ffmpeg

# 설치 확인
ffmpeg -version
```

#### 방법 B: 수동 설치

1. https://github.com/BtbN/FFmpeg-Builds/releases 방문
2. `ffmpeg-master-latest-win64-gpl.zip` 다운로드
3. 압축 해제 후 `bin` 폴더 내 파일을 확인:
   - `ffmpeg.exe`
   - `ffprobe.exe`

4. 시스템 PATH에 추가:
   ```
   제어판 → 시스템 → 고급 시스템 설정 → 환경 변수
   → Path 변수 편집 → C:\ffmpeg\bin 추가
   ```

5. 또는 프로젝트 폴더에 직접 복사:
   ```bash
   # video-editor/ffmpeg/ 폴더 생성
   mkdir C:\claudtest\video-editor\ffmpeg

   # ffmpeg.exe와 ffprobe.exe를 해당 폴더에 복사
   ```

### 2. Node.js 의존성 설치

```bash
cd C:\claudtest\video-editor
npm install
```

### 3. 개발 모드 실행

```bash
npm start
```

### 4. Windows 설치 파일 빌드 (배포용)

```bash
npm run build:win
```

빌드된 설치 파일 위치: `video-editor/dist/Kiosk Video Editor Setup 1.0.0.exe`

## 프로젝트 의존성

### 런타임 의존성
- `axios`: HTTP 클라이언트 (백엔드 API 통신)

### 개발 의존성
- `electron`: 데스크톱 앱 프레임워크
- `electron-builder`: Windows 설치 파일 생성

### 외부 의존성
- **FFmpeg**: 영상/오디오 처리 엔진 (별도 설치 필요)

## 디렉토리 구조 설명

```
video-editor/
├── main.js                 # Electron 메인 프로세스
│                           # - 창 생성 및 관리
│                           # - FFmpeg 명령어 실행
│                           # - IPC 핸들러
│
├── preload.js             # Preload 스크립트
│                           # - Context Bridge API 노출
│                           # - 보안 격리
│
├── renderer/              # 렌더러 프로세스 (UI)
│   ├── index.html        # 메인 UI 구조
│   ├── styles.css        # 스타일시트
│   ├── app.js            # UI 로직 및 이벤트 핸들링
│   └── api.js            # Backend API 클라이언트
│
├── ffmpeg/               # FFmpeg 실행 파일 (사용자가 추가)
│   ├── ffmpeg.exe
│   └── ffprobe.exe
│
├── assets/               # 아이콘 및 리소스
│   └── icon.png
│
├── package.json          # NPM 설정
├── README.md             # 사용자 문서
├── SETUP.md              # 이 파일
└── .gitignore           # Git 제외 목록
```

## 백엔드 연동 설정

### 1. Backend API URL 설정

`renderer/api.js` 파일 수정:

```javascript
// 로컬 개발
const API_BASE_URL = 'http://localhost:8080/api';

// 프로덕션 (AWS Elastic Beanstalk)
const API_BASE_URL = 'http://your-backend-url.elasticbeanstalk.com/api';
```

### 2. CORS 설정 확인

백엔드 `CorsConfig.java`에서 Electron 앱 허용:

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                    "http://localhost:*",  // Electron 개발 모드
                    "file://*"             // Electron 프로덕션 모드
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowCredentials(true);
    }
}
```

### 3. Content Security Policy

`renderer/index.html`의 CSP 메타태그에서 백엔드 URL 허용:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: file:;
               media-src 'self' file:;
               connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.amazonaws.com">
```

## 빌드 설정 커스터마이징

### 아이콘 변경

1. `assets/icon.ico` 파일 생성 (256x256 픽셀)
2. `package.json`에서 아이콘 경로 확인:

```json
{
  "build": {
    "win": {
      "icon": "assets/icon.ico"
    }
  }
}
```

### 앱 이름 및 ID 변경

`package.json`:

```json
{
  "name": "kiosk-video-editor",
  "productName": "Kiosk Video Editor",
  "build": {
    "appId": "com.kiosk.video-editor"
  }
}
```

### FFmpeg 번들링

프로덕션 빌드에 FFmpeg 포함:

1. `ffmpeg/` 폴더에 실행 파일 복사
2. `package.json`의 `extraResources` 설정 확인:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "ffmpeg",
        "to": "ffmpeg",
        "filter": ["**/*"]
      }
    ]
  }
}
```

## 개발 팁

### 1. DevTools 자동 열기

`main.js`:

```javascript
// 개발 모드에서 DevTools 자동 열기
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

실행 시:
```bash
set NODE_ENV=development && npm start
```

### 2. 핫 리로드

UI만 수정하는 경우:
- `Ctrl+R` 또는 `F5`로 페이지 새로고침

메인 프로세스 수정 시:
- 앱 재시작 필요

### 3. 로그 확인

콘솔 로그는 DevTools의 Console 탭에서 확인:
- `console.log()`: 일반 로그
- `console.error()`: 에러 로그
- `console.warn()`: 경고 로그

FFmpeg 출력은 메인 프로세스 콘솔에서 확인 (터미널 창)

## 테스트 샘플 준비

테스트용 샘플 영상:

1. **짧은 테스트 영상 생성** (FFmpeg 사용):
```bash
# 5초 컬러바 영상
ffmpeg -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 test_video.mp4

# 오디오 포함 영상
ffmpeg -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 -f lavfi -i sine=frequency=1000:duration=5 test_av.mp4
```

2. **무료 샘플 영상 다운로드**:
   - https://sample-videos.com/
   - https://pixabay.com/videos/

## 문제 해결

### Q: "FFmpeg not found" 에러
**A**: FFmpeg이 PATH에 있는지 확인하거나 `video-editor/ffmpeg/` 폴더에 실행 파일 복사

### Q: "Module not found" 에러
**A**: `npm install` 재실행

### Q: 빌드가 너무 느림
**A**: 백신 프로그램의 실시간 검사에서 `video-editor/dist` 폴더 제외

### Q: FFmpeg 명령어가 실행되지 않음
**A**: Windows Defender에서 차단되는지 확인

### Q: CORS 에러
**A**: 백엔드 CORS 설정에 `http://localhost:*` 추가

## 추가 리소스

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [FFmpeg 공식 문서](https://ffmpeg.org/documentation.html)
- [Electron Builder 문서](https://www.electron.build/)
- [FFmpeg 필터 가이드](https://ffmpeg.org/ffmpeg-filters.html)

## 다음 단계

1. 샘플 영상으로 모든 기능 테스트
2. 백엔드 API 연동 테스트
3. Windows 설치 파일 빌드 및 배포
4. 사용자 피드백 수집 및 기능 개선
