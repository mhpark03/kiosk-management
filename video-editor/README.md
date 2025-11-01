# Kiosk Video Editor

키오스크 관리 시스템을 위한 고급 영상/음성 편집 데스크톱 애플리케이션입니다.

## 주요 기능

### 기본 편집 기능
- **영상 가져오기**: MP4, AVI, MOV, MKV, WebM 형식 지원
- **영상 자르기**: 특정 구간 추출
- **영상 병합**: 여러 영상을 하나로 합치기 (트랜지션 효과 포함)

### 오디오 편집 기능
- **배경음악 추가**: 영상에 오디오 트랙 추가 및 볼륨 조절
- **오디오 추출**: 영상에서 오디오만 분리
- **볼륨 조절**: 영상 내 오디오 볼륨 증폭/감소

### 고급 효과
- **필터 적용**:
  - 밝기 조정
  - 대비 조정
  - 채도 조정
  - 블러 효과
  - 샤픈 효과
- **텍스트/자막 추가**: 위치, 크기, 색상, 시간 설정 가능
- **속도 조절**: 슬로우모션(0.25x) ~ 배속(4x)

### TTS (음성 생성) 기능 ⭐ NEW
- **Google Cloud TTS 직접 연동**: 백엔드 서버 없이 독립 실행
- **다국어 지원**: 한국어, 영어, 일본어 등
- **음성 커스터마이징**:
  - 다양한 음성 선택 (남성/여성)
  - 속도 조절 (0.25x ~ 4.0x)
  - 피치 조절 (-20 ~ +20)
- **최대 5000자**: 긴 텍스트도 한 번에 변환
- **로컬 저장**: 생성된 MP3 파일을 임시 폴더에 저장

### 트랜지션 효과
- **없음 (이어붙이기)**: 단순 연결
- **크로스페이드**: 부드러운 화면 전환

## 시스템 요구사항

### 필수 요구사항
- **운영체제**: Windows 10 이상
- **메모리**: 최소 4GB RAM (8GB 권장)
- **저장공간**: 500MB 이상
- **FFmpeg**: 필수 설치 필요

### FFmpeg 설치

1. **FFmpeg 다운로드**
   - [FFmpeg 공식 웹사이트](https://ffmpeg.org/download.html) 방문
   - Windows용 빌드 다운로드 (예: gyan.dev 또는 BtbN 빌드)

2. **설치 방법 1: 시스템 PATH 등록**
   ```bash
   # FFmpeg을 다운로드하여 압축 해제
   # 예: C:\ffmpeg\bin\ffmpeg.exe

   # 시스템 환경 변수에 추가
   # 제어판 > 시스템 > 고급 시스템 설정 > 환경 변수
   # Path 변수에 C:\ffmpeg\bin 추가
   ```

3. **설치 방법 2: 앱 내부에 포함**
   ```bash
   # video-editor 폴더에 ffmpeg 폴더 생성
   mkdir video-editor/ffmpeg

   # ffmpeg.exe와 ffprobe.exe를 해당 폴더에 복사
   # video-editor/ffmpeg/ffmpeg.exe
   # video-editor/ffmpeg/ffprobe.exe
   ```

4. **설치 확인**
   ```bash
   ffmpeg -version
   ```

## 설치 방법

### 1. 소스코드에서 실행

```bash
# 의존성 설치
cd video-editor
npm install

# 개발 모드 실행
npm start
```

### 2. 환경 변수 설정 (.env 파일)

Runway ML 이미지 생성 기능을 사용하려면 환경 변수 설정이 필요합니다.

#### 방법 1: S3에서 환경 변수 파일 다운로드 (권장)

팀에서 공유하는 환경 변수 파일을 S3에서 다운로드하여 사용할 수 있습니다.

```bash
# video-editor 폴더로 이동
cd video-editor

# S3에서 .env 파일 다운로드
aws s3 cp s3://kiosk-video-bucket/credentials/video-editor.env ./.env --region ap-northeast-2

# 다운로드 확인
cat .env
```

#### 방법 2: 수동으로 .env 파일 생성

```bash
# video-editor 폴더에 .env 파일 생성
cd video-editor
```

`.env` 파일 내용:
```env
# Runway ML API Configuration
RUNWAY_API_KEY=your-runway-api-key-here
RUNWAY_API_URL=https://api.dev.runwayml.com

# Database Configuration
DB_PASSWORD=aioztesting
```

**주의**: `.env` 파일은 Git에 커밋되지 않으며, 각 개발자가 로컬에서 직접 설정해야 합니다.

### TTS 기능 설정 (선택사항)

TTS (음성 생성) 기능을 사용하려면 Google Cloud TTS API 키가 필요합니다.

1. **API 키 발급**
   - [Google Cloud Console](https://console.cloud.google.com/) 접속
   - 프로젝트 생성 또는 선택
   - "API 및 서비스" > "라이브러리"에서 "Cloud Text-to-Speech API" 활성화
   - "사용자 인증 정보" 메뉴에서 API 키 생성

2. **환경 변수 설정**

   **Windows (명령 프롬프트):**
   ```cmd
   set GOOGLE_TTS_API_KEY=your-api-key-here
   npm start
   ```

   **Windows (PowerShell):**
   ```powershell
   $env:GOOGLE_TTS_API_KEY="your-api-key-here"
   npm start
   ```

   **또는 시스템 환경 변수로 영구 설정:**
   - 제어판 > 시스템 > 고급 시스템 설정 > 환경 변수
   - 사용자 변수에 `GOOGLE_TTS_API_KEY` 추가
   - 값: 발급받은 API 키

3. **대체 환경 변수**
   - `GOOGLE_TTS_API_KEY` 또는 `GOOGLE_AI_API_KEY` 중 하나만 설정하면 됩니다

4. **다른 PC에서 개발 시 (S3에서 인증 파일 다운로드)**

   팀의 다른 개발자가 새로운 PC에서 작업할 경우, S3에 백업된 인증 파일을 다운로드할 수 있습니다.

   **방법 1: AWS CLI 사용 (권장)**
   ```bash
   # 백엔드 루트 폴더로 이동
   cd C:\your-path\kiosk-management\backend

   # S3에서 인증 파일 다운로드
   aws s3 cp s3://kiosk-video-bucket/credentials/google-tts-service-account.json ./google-tts-service-account.json --region ap-northeast-2

   # 다운로드 확인
   dir google-tts-service-account.json
   ```

   **방법 2: 유틸리티 스크립트 사용**

   백엔드에 포함된 `DownloadCredentials` 유틸리티를 사용:
   ```bash
   cd backend

   # 환경변수 설정 (AWS 인증)
   set AWS_ACCESS_KEY_ID=your-access-key
   set AWS_SECRET_ACCESS_KEY=your-secret-key
   set AWS_S3_BUCKET_NAME=kiosk-video-bucket

   # 유틸리티 실행
   java -cp build/libs/backend-0.0.1-SNAPSHOT.jar com.kiosk.backend.util.DownloadCredentials
   ```

   **다운로드 후 확인:**
   ```bash
   # 파일 존재 확인
   ls backend/google-tts-service-account.json

   # 파일 크기 확인 (약 2.3KB)
   # Windows: dir backend\google-tts-service-account.json
   ```

   **중요:**
   - 다운로드한 인증 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다
   - 인증 파일은 민감한 정보이므로 안전하게 보관해야 합니다
   - S3 접근 권한이 필요합니다 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)

### 2. Windows 설치 파일 빌드

```bash
# Windows 설치 파일 생성
npm run build:win

# 생성된 파일 위치
# video-editor/dist/Kiosk Video Editor Setup 1.0.0.exe
```

### 3. 설치 프로그램 실행
- 생성된 `.exe` 파일을 실행하여 설치
- 설치 위치 선택
- 바탕화면 바로가기 생성 옵션 선택

## 사용 방법

### 기본 작업 흐름

1. **영상 가져오기**
   - 좌측 사이드바에서 "영상 가져오기" 클릭
   - 편집할 영상 파일 선택
   - 미리보기 화면에 영상이 로드됨

2. **편집 도구 선택**
   - 좌측 사이드바에서 원하는 도구 클릭
   - 우측 속성 패널에서 옵션 설정

3. **편집 실행**
   - 속성 패널에서 매개변수 조정
   - "적용" 또는 "실행" 버튼 클릭
   - 저장 위치 선택
   - 처리 완료 대기

4. **결과 확인**
   - 편집된 영상이 자동으로 로드됨
   - 미리보기에서 결과 확인
   - 추가 편집 또는 저장

### 예시: 영상 자르기

```
1. 영상 가져오기
2. "영상 자르기" 도구 선택
3. 시작 시간: 5초
4. 지속 시간: 30초
5. "영상 자르기" 버튼 클릭
6. 저장 위치 선택: trimmed_video.mp4
7. 처리 완료 후 결과 확인
```

### 예시: 배경음악 추가

```
1. 영상 가져오기
2. "배경음악 추가" 도구 선택
3. "오디오 선택" 버튼으로 음악 파일 선택
4. 볼륨 슬라이더 조정 (0~2)
5. "오디오 추가" 버튼 클릭
6. 저장 위치 선택
7. 처리 완료 후 결과 확인
```

### 예시: 여러 영상 병합

```
1. "영상 병합" 도구 선택
2. "+ 영상 추가" 버튼으로 영상들 추가 (2개 이상)
3. 트랜지션 선택: 크로스페이드
4. 트랜지션 지속시간: 1초
5. "영상 병합" 버튼 클릭
6. 저장 위치 선택
7. 처리 완료 후 결과 확인
```

### 예시: TTS 음성 생성 (NEW)

```
⚠️ 사전 요구사항: GOOGLE_TTS_API_KEY 환경 변수 설정 필요

1. 좌측 사이드바에서 "TTS 음성 생성" 선택
2. 텍스트 입력 (최대 5000자)
   예: "안녕하세요. 키오스크 관리 시스템입니다."
3. 제목 입력: "환영 메시지"
4. 언어 선택: 한국어 (ko-KR)
5. 음성 선택: ko-KR-Standard-A (여성)
6. 속도 조절: 1.0x (기본값)
7. 피치 조절: 0 (기본값)
8. "🎵 음성 생성" 버튼 클릭
9. 생성 완료 후 저장 위치 확인
   - 예: C:\Users\Username\AppData\Local\Temp\tts_환영_메시지_1730345678901.mp3
10. 생성된 MP3 파일을 영상에 배경음악으로 추가하거나 별도로 사용
```

**TTS 팁:**
- 짧은 문장으로 나눠서 생성하면 더 자연스러운 결과
- 속도는 0.75x~1.25x 범위가 가장 자연스러움
- 피치는 -5~+5 범위에서 조정 권장
- 생성된 파일은 임시 폴더에 저장되므로 필요시 복사 보관

## Backend 연동

이 앱은 Kiosk Management System의 백엔드 API와 연동할 수 있습니다.

### API 설정

`renderer/api.js` 파일에서 API 주소 설정:

```javascript
const API_BASE_URL = 'http://localhost:8080/api';
```

### 지원 기능

- 백엔드에서 영상 목록 조회
- 영상 다운로드 (S3 presigned URL 사용)
- 편집된 영상 업로드
- 영상 메타데이터 업데이트
- 키오스크에 영상 할당

### 사용 예시

```javascript
// 모든 영상 조회
const videos = await window.videoAPI.getAllVideos();

// 영상 다운로드
await window.videoAPI.downloadVideo(videoId, savePath);

// 편집된 영상 업로드
const result = await window.videoAPI.uploadVideo(filePath, {
  title: '편집된 영상',
  description: '밝기 및 대비 조정'
});
```

## 기술 스택

- **Electron**: 데스크톱 애플리케이션 프레임워크
- **FFmpeg**: 영상/오디오 처리 엔진
- **HTML/CSS/JavaScript**: UI 구현
- **Node.js**: 백엔드 API 통신

## 프로젝트 구조

```
video-editor/
├── main.js                  # Electron 메인 프로세스
├── preload.js              # Preload 스크립트 (API 노출)
├── package.json            # 프로젝트 설정
├── README.md               # 이 파일
├── renderer/               # 렌더러 프로세스 (UI)
│   ├── index.html         # 메인 HTML
│   ├── styles.css         # 스타일시트
│   ├── app.js             # 메인 앱 로직
│   └── api.js             # Backend API 클라이언트
├── ffmpeg/                # FFmpeg 실행 파일 (선택사항)
│   ├── ffmpeg.exe
│   └── ffprobe.exe
└── assets/                # 아이콘 등 리소스
    └── icon.png
```

## FFmpeg 명령어 참고

앱 내부에서 사용하는 주요 FFmpeg 명령어:

### 영상 자르기
```bash
ffmpeg -i input.mp4 -ss 5 -t 30 -c copy output.mp4
```

### 배경음악 추가
```bash
ffmpeg -i video.mp4 -i audio.mp3 -filter_complex "[1:a]volume=1.0[a1];[0:a][a1]amix=inputs=2:duration=first" -c:v copy -c:a aac output.mp4
```

### 영상 병합 (크로스페이드)
```bash
ffmpeg -i video1.mp4 -i video2.mp4 -filter_complex "[0:v][1:v]xfade=transition=fade:duration=1:offset=5[outv]" -map "[outv]" output.mp4
```

### 밝기 조정
```bash
ffmpeg -i input.mp4 -vf "eq=brightness=0.2" -c:a copy output.mp4
```

### 텍스트 추가
```bash
ffmpeg -i input.mp4 -vf "drawtext=text='Hello':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -c:a copy output.mp4
```

### 속도 조절 (2배속)
```bash
ffmpeg -i input.mp4 -vf "setpts=0.5*PTS" output.mp4
```

## 문제 해결

### FFmpeg를 찾을 수 없음
```
Error: FFmpeg not found
```
**해결 방법**:
- FFmpeg이 시스템 PATH에 등록되어 있는지 확인
- 또는 `video-editor/ffmpeg/` 폴더에 실행 파일 복사

### 메모리 부족 오류
```
Error: Cannot allocate memory
```
**해결 방법**:
- 4K 영상 등 대용량 파일은 처리 시간이 오래 걸림
- 해상도를 낮추거나 더 작은 구간으로 나눠서 처리
- 다른 프로그램을 종료하여 메모리 확보

### 오디오 없음
```
Output has no audio
```
**해결 방법**:
- 원본 영상에 오디오 트랙이 있는지 확인
- 일부 편집 작업은 비디오만 처리 (오디오는 복사)

### 코덱 오류
```
Error: Unknown encoder
```
**해결 방법**:
- FFmpeg이 최신 버전인지 확인
- 전체 기능 빌드 버전 사용 (essentials가 아닌 full 버전)

### TTS API 키 오류
```
Error: Google TTS API key not configured
```
**해결 방법**:
- 환경 변수 `GOOGLE_TTS_API_KEY` 또는 `GOOGLE_AI_API_KEY` 설정 확인
- 명령 프롬프트/PowerShell에서 직접 설정 후 앱 실행:
  ```cmd
  set GOOGLE_TTS_API_KEY=your-key
  npm start
  ```
- API 키가 유효한지 Google Cloud Console에서 확인

### TTS API 호출 실패
```
Error: Google TTS API Error (403)
```
**해결 방법**:
- Google Cloud Console에서 "Cloud Text-to-Speech API"가 활성화되어 있는지 확인
- API 키의 권한 확인 (Text-to-Speech API 사용 권한 필요)
- 무료 할당량 초과 여부 확인 (매월 100만 문자 무료)

### TTS 네트워크 오류
```
Error: Network error
```
**해결 방법**:
- 인터넷 연결 확인
- 방화벽에서 앱의 아웃바운드 연결 허용 확인
- 프록시 사용 시 설정 확인

## 성능 최적화 팁

1. **하드웨어 가속**: GPU 지원 FFmpeg 빌드 사용
2. **프리셋 조정**: 빠른 처리를 위해 `ultrafast` 프리셋 사용
3. **코덱 복사**: 가능한 경우 `-c copy` 옵션 사용하여 재인코딩 방지
4. **해상도 조정**: 1080p 이하로 작업하여 처리 속도 향상

## 라이선스

ISC License

## 기여

버그 리포트 및 기능 제안은 GitHub Issues를 통해 제출해주세요.

## 지원

문제가 발생하면 다음을 포함하여 문의해주세요:
- 운영체제 버전
- FFmpeg 버전 (`ffmpeg -version`)
- 에러 메시지
- 처리하려던 영상의 정보 (해상도, 포맷 등)

## 향후 계획

- [ ] 실시간 미리보기 기능
- [ ] 다중 레이어 타임라인
- [ ] 더 많은 트랜지션 효과
- [ ] 키프레임 애니메이션
- [ ] 프로젝트 저장/불러오기
- [ ] 일괄 처리 기능
- [ ] GPU 가속 지원
- [ ] 더 많은 오디오 이펙트
