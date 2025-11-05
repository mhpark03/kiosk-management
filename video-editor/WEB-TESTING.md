# 웹 환경에서 비디오 에디터 테스트하기

이 가이드는 **웹 기반 Claude Code** 또는 **Linux 서버 환경**에서 비디오 에디터의 AI 기능을 테스트하는 방법을 설명합니다.

## 🔍 제약 사항

### ❌ 웹 환경에서 불가능한 것
- **Electron GUI 실행**: X11/디스플레이 서버 필요
- **FFmpeg 비디오 편집**: FFmpeg 설치 및 GUI 필요
- **전체 앱 테스트**: Windows 데스크톱 환경 필요

### ✅ 웹 환경에서 가능한 것
- **AI 모듈 독립 실행**: TTS, Imagen, Veo, Runway
- **백엔드 API 테스트**: HTTP 요청 및 응답 확인
- **코드 검증**: 구문 오류, 로직 테스트
- **환경 변수 확인**: API 키 설정 검증

---

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd video-editor
npm install
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```bash
# video-editor/.env
GOOGLE_TTS_API_KEY=your_tts_api_key
GOOGLE_AI_API_KEY=your_google_ai_key
RUNWAY_API_KEY=your_runway_key
BACKEND_URL=http://localhost:8080
```

**S3에서 다운로드 (권장):**
```bash
aws s3 cp s3://kiosk-video-bucket/credentials/video-editor.env ./.env \
  --region ap-northeast-2
```

### 3. 테스트 실행

#### 전체 테스트 실행
```bash
node test-standalone.js
```

#### 개별 테스트 실행
```bash
# TTS 테스트
node test-standalone.js tts

# Imagen 테스트
node test-standalone.js imagen

# Veo 테스트
node test-standalone.js veo

# Runway 테스트
node test-standalone.js runway

# 백엔드 API 테스트
node test-standalone.js backend
```

---

## 📋 테스트 항목 상세

### 1️⃣ TTS (음성 생성) 테스트

**테스트 내용:**
- Google Cloud TTS API 호출
- 한국어 음성 생성
- MP3 파일 저장

**실행:**
```bash
node test-standalone.js tts
```

**기대 결과:**
```
✅ TTS 성공! 파일: test-tts-output.mp3
   크기: 12345 bytes
```

**생성된 파일:**
- `test-tts-output.mp3` (약 1-2초 음성)

---

### 2️⃣ Imagen (이미지 생성) 테스트

**테스트 내용:**
- Google Imagen 3 API 호출
- 프롬프트로 이미지 생성

**실행:**
```bash
node test-standalone.js imagen
```

**기대 결과:**
```
✅ Imagen 성공!
   생성된 이미지: 1개
```

---

### 3️⃣ Veo (비디오 생성) 테스트

**테스트 내용:**
- Google Veo 3.1 API 호출
- 비디오 생성 요청 확인

**실행:**
```bash
node test-standalone.js veo
```

**기대 결과:**
```
✅ Veo 요청 성공!
   응답: {...}
```

**주의:**
- 실제 비디오 생성은 1~5분 소요
- 이 테스트는 API 호출만 확인

---

### 4️⃣ Runway (이미지 생성) 테스트

**테스트 내용:**
- Runway ML API 호출
- 이미지 생성 확인

**실행:**
```bash
node test-standalone.js runway
```

**기대 결과:**
```
✅ Runway 성공!
   응답: {...}
```

---

### 5️⃣ 백엔드 API 연동 테스트

**사전 요구사항:**
- 백엔드 서버 실행 필요

**백엔드 실행:**
```bash
# 터미널 1 (백엔드)
cd backend
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
```

**테스트 실행:**
```bash
# 터미널 2 (테스트)
node test-standalone.js backend
```

**기대 결과:**
```
✅ 백엔드 연결 성공!
   비디오 수: 10개
```

---

## 📊 전체 테스트 실행 예시

```bash
$ node test-standalone.js

🧪 비디오 에디터 AI 모듈 독립 테스트 시작

이 스크립트는 Electron GUI 없이 AI 기능만 테스트합니다.

=== 환경 변수 확인 ===
✅ GOOGLE_TTS_API_KEY: 설정됨
✅ GOOGLE_AI_API_KEY: 설정됨
⚠️  RUNWAY_API_KEY: 없음

=== TTS (음성 생성) 테스트 ===
🎵 음성 생성 중...
✅ TTS 성공! 파일: test-tts-output.mp3
   크기: 12345 bytes

=== Imagen (이미지 생성) 테스트 ===
🎨 이미지 생성 중...
✅ Imagen 성공!
   생성된 이미지: 1개

=== Veo (비디오 생성) 테스트 ===
🎬 비디오 생성 요청 중...
✅ Veo 요청 성공!
   응답: {...}

=== Runway (이미지 생성) 테스트 ===
⚠️  RUNWAY_API_KEY가 설정되지 않았습니다 (선택 사항).

=== 백엔드 API 연동 테스트 ===
📡 백엔드 연결 확인: http://localhost:8080
✅ 백엔드 연결 성공!
   비디오 수: 5개

=== 테스트 결과 요약 ===
✅ 통과: 4
❌ 실패: 0
⏭️  건너뜀: 1

개별 결과:
  ✅ TTS
  ✅ IMAGEN
  ✅ VEO
  ⏭️  RUNWAY
  ✅ BACKEND

💡 Electron GUI 전체 테스트는 Windows 환경에서 실행하세요:
   cd video-editor
   npm start
```

---

## 🔧 트러블슈팅

### ❌ "Cannot find module '@google-cloud/text-to-speech'"

**해결:**
```bash
cd video-editor
npm install
```

### ❌ "API key not valid"

**해결:**
1. `.env` 파일 확인
2. API 키 유효성 확인 (Google Cloud Console)
3. API 활성화 확인

### ❌ "ECONNREFUSED" (백엔드 테스트)

**해결:**
```bash
# 백엔드 서버 실행
cd backend
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
```

### ⚠️  "FFmpeg not found"

**설명:**
- 웹 환경에서는 FFmpeg 비디오 편집 불가
- AI 기능만 테스트 가능
- 전체 앱은 Windows에서 실행 필요

---

## 🎯 다음 단계

### 웹 환경에서 한 후:
1. ✅ AI 모듈 독립 테스트 (`test-standalone.js`)
2. ✅ 백엔드 API 연동 확인

### Windows 로컬 환경에서:
3. ⬜ Electron 앱 전체 실행 (`npm start`)
4. ⬜ FFmpeg 비디오 편집 테스트
5. ⬜ GUI 통합 테스트

**전체 테스트 가이드:**
- [TESTING.md](./TESTING.md) - 완전한 테스트 시나리오
- [TEST-CHECKLIST.md](./TEST-CHECKLIST.md) - 빠른 체크리스트

---

## 📚 관련 문서

- [README.md](./README.md) - 앱 사용 가이드
- [SETUP.md](./SETUP.md) - 설치 가이드
- [TESTING.md](./TESTING.md) - 전체 테스트 가이드 (Windows)
- [TEST-CHECKLIST.md](./TEST-CHECKLIST.md) - 빠른 체크리스트

---

## 💡 요약

| 테스트 항목 | 웹 환경 | Windows |
|----------|--------|---------|
| AI 모듈 (TTS, Imagen, Veo, Runway) | ✅ 가능 | ✅ 가능 |
| 백엔드 API 연동 | ✅ 가능 | ✅ 가능 |
| FFmpeg 비디오 편집 | ❌ 불가 | ✅ 가능 |
| Electron GUI | ❌ 불가 | ✅ 가능 |
| 전체 통합 테스트 | ❌ 불가 | ✅ 가능 |

**결론:**
- 웹 환경: **AI 기능만** 테스트 가능 (`test-standalone.js`)
- 로컬 환경: **전체 기능** 테스트 가능 (`npm start`)
