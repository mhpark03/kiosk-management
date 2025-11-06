# 프론트엔드 환경 변수 설정 가이드

## ⚠️ 중요 변경 사항

**2024-11-05**: Firebase API 키와 환경 변수가 Git에서 제거되었습니다.
이제 각 개발자가 로컬에서 `.env.development`와 `.env.production` 파일을 직접 생성해야 합니다.

## 설정 방법

### 1단계: .env 파일 복사

프로젝트 루트의 `.env.example` 파일을 복사하여 환경별 파일을 생성합니다:

```bash
cd firstapp

# 개발 환경 설정
cp .env.example .env.development

# 프로덕션 환경 설정
cp .env.example .env.production
```

### 2단계: Firebase 설정 입력

Firebase Console에서 설정 값을 가져와 `.env.development`와 `.env.production`에 입력합니다.

#### Firebase 설정 가져오기
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택: `firstapp-95284`
3. 프로젝트 설정 > 일반 > 내 앱 > SDK 설정 및 구성
4. 구성 값 복사

#### .env.development 파일 예시

```env
# Backend API URL (Local Development)
VITE_API_URL=http://localhost:8080/api

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=firstapp-95284.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=firstapp-95284
VITE_FIREBASE_STORAGE_BUCKET=firstapp-95284.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=357639648849
VITE_FIREBASE_APP_ID=1:357639648849:web:...
```

#### .env.production 파일 예시

```env
# Backend API URL (Elastic Beanstalk)
VITE_API_URL=http://kiosk-backend-prod-v2.eba-tm9pvuph.ap-northeast-2.elasticbeanstalk.com/api

# Firebase Configuration (same as development)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=firstapp-95284.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=firstapp-95284
VITE_FIREBASE_STORAGE_BUCKET=firstapp-95284.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=357639648849
VITE_FIREBASE_APP_ID=1:357639648849:web:...
```

### 3단계: 개발 서버 실행

환경 변수가 설정되면 개발 서버를 실행합니다:

```bash
npm install
npm run dev
```

## 보안 주의사항

### ❌ 절대 하지 말아야 할 것
- `.env.development` 또는 `.env.production`을 Git에 커밋하지 마세요
- API 키를 공개 채널(Slack, 이메일 등)에 공유하지 마세요
- 스크린샷에 API 키가 보이지 않도록 주의하세요

### ✅ 권장 사항
- 팀원에게 설정 값이 필요한 경우 안전한 채널(비밀번호 관리 도구) 사용
- 프로덕션과 개발 환경에 동일한 Firebase 프로젝트 사용 가능
- `.env.example` 파일은 안전하게 커밋 가능 (실제 값 없음)

## 문제 해결

### Firebase 초기화 오류
```
FirebaseError: Firebase: Error (auth/invalid-api-key)
```

**해결방법**:
1. `.env.development` 파일이 `firstapp/` 디렉토리에 있는지 확인
2. `VITE_FIREBASE_API_KEY` 값이 올바른지 확인
3. 개발 서버 재시작 (`npm run dev`)

### 환경 변수가 undefined
```
console.log(import.meta.env.VITE_FIREBASE_API_KEY) // undefined
```

**해결방법**:
1. 환경 변수 이름이 `VITE_`로 시작하는지 확인 (Vite 요구사항)
2. `.env.development` 파일이 올바른 위치에 있는지 확인
3. 개발 서버 재시작

### API 연결 오류
```
Error: Network Error / CORS Error
```

**해결방법**:
1. 백엔드가 실행 중인지 확인 (`http://localhost:8080`)
2. `VITE_API_URL` 값이 올바른지 확인
3. 백엔드 CORS 설정 확인

## 기존 프로젝트 마이그레이션

이미 프로젝트를 clone한 상태라면:

```bash
cd firstapp

# 최신 코드 가져오기
git pull

# .env 파일이 없다면 생성
cp .env.example .env.development
cp .env.example .env.production

# Firebase 설정을 .env 파일에 입력
# (위의 2단계 참조)

# 의존성 재설치 (선택사항)
rm -rf node_modules
npm install

# 개발 서버 실행
npm run dev
```

## 관련 문서

- [Firebase Console](https://console.firebase.google.com/)
- [Vite 환경 변수 문서](https://vitejs.dev/guide/env-and-mode.html)
- [프로젝트 README](../README.md)
- [백엔드 환경 설정](../backend/ENVIRONMENT_SETUP.md)

## 팀원 온보딩 체크리스트

새로운 팀원이 합류했을 때:

- [ ] Firebase Console 접근 권한 부여
- [ ] `.env.example` 파일을 복사하여 `.env.development` 생성
- [ ] Firebase 설정 값 입력
- [ ] `npm install` 실행
- [ ] `npm run dev`로 개발 서버 실행 확인
- [ ] 로그인 테스트 (Firebase 인증 작동 확인)

---

**문의사항이 있으면 팀 리더에게 연락하세요.**
