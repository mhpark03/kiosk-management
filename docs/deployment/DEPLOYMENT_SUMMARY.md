# 🚀 Kiosk 관리 시스템 AWS 배포 완료

## ✅ 현재 배포 상태

### Frontend (React SPA)
- **호스팅**: AWS S3 Static Website Hosting
- **URL**: http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
- **라우팅**: HashRouter (URL에 `#` 사용)
- **상태**: ✅ 정상 작동
- **프로토콜**: HTTP

### Backend (Spring Boot API)
- **호스팅**: AWS Elastic Beanstalk
- **URL**: http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
- **상태**: ✅ 정상 작동
- **Health Check**: http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api/actuator/health
- **프로토콜**: HTTP

### 데이터베이스
- **타입**: H2 (인메모리)
- **위치**: Elastic Beanstalk 인스턴스 내
- **경고**: 인스턴스 재시작 시 데이터 손실됨

---

## 📁 주요 파일 위치

### Frontend 소스코드
```
C:\claudtest\firstapp\
```

### Backend 소스코드
```
C:\claudtest\backend\
```

### 배포 스크립트
```
C:\claudtest\deploy-scripts\
```

---

## 🔧 업데이트 방법

### Frontend 업데이트

1. **코드 수정**
   ```bash
   cd C:\claudtest\firstapp
   # 파일 수정...
   ```

2. **빌드**
   ```bash
   npm run build
   ```

3. **S3 업로드**
   ```bash
   aws s3 sync dist/ s3://kiosk-frontend-20251018/ --region ap-northeast-2 --delete --cache-control "no-cache, no-store, must-revalidate"
   ```

   또는 배치 파일 사용:
   ```bash
   C:\claudtest\deploy-scripts\upload-hashrouter.bat
   ```

### Backend 업데이트

1. **코드 수정**
   ```bash
   cd C:\claudtest\backend
   # 파일 수정...
   ```

2. **빌드**
   ```bash
   ./gradlew clean build
   ```

3. **배포**
   ```bash
   eb deploy
   ```

   또는
   ```bash
   aws elasticbeanstalk update-environment --environment-name Kiosk-backend-env --version-label [version]
   ```

---

## 🔐 HTTPS 적용 (나중에 필요 시)

현재는 HTTP로 운영 중입니다. HTTPS가 필요하면:

### 방법 1: CloudFront 사용 (권장)

**전제조건**: AWS 계정 CloudFront 검증 필요

1. **AWS Support 요청**
   - 가이드: `C:\claudtest\AWS_SUPPORT_REQUEST.md`
   - URL: https://console.aws.amazon.com/support/home

2. **검증 완료 후 CloudFront 설정**
   - Frontend CloudFront 생성
   - Backend CloudFront 생성
   - 가이드: `C:\claudtest\CLOUDFRONT_SETUP_GUIDE.md`

3. **Frontend 코드 업데이트**
   - CloudFront HTTPS URL로 변경
   - 재빌드 및 재배포

**결과**:
- ✅ 완전한 HTTPS
- ✅ 브라우저 경고 없음
- ✅ BrowserRouter로 변경 가능 (깔끔한 URL)

### 방법 2: Backend만 HTTPS (임시)

1. **Elastic Beanstalk에 SSL 인증서 추가**
   - 가이드: `C:\claudtest\BACKEND_HTTPS_GUIDE.md`
   - 자체 서명 인증서 사용

2. **Frontend 코드에서 Backend URL을 HTTPS로 변경**

**결과**:
- ⚠️ Backend만 HTTPS
- ⚠️ Frontend는 HTTP
- ⚠️ 브라우저 인증서 경고

---

## 📊 현재 아키텍처

```
사용자
  │
  ├─> http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
  │   (S3 Static Website - React SPA)
  │
  └─> API 요청
      │
      └─> http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
          (Elastic Beanstalk - Spring Boot)
          │
          └─> H2 Database (인메모리)
```

---

## 🎯 향후 개선 사항

### 1. HTTPS 적용 (보안)
- CloudFront 계정 검증 후 적용
- 예상 기간: 1-2일

### 2. 영구 데이터베이스 (데이터 보존)
- H2 → RDS (MySQL/PostgreSQL) 마이그레이션
- 인스턴스 재시작 시 데이터 보존
- 백업 및 복구 가능

### 3. 커스텀 도메인 (선택사항)
- Route 53에서 도메인 등록
- 예: https://kiosk.yourdomain.com

### 4. CI/CD 파이프라인 (자동화)
- GitHub Actions 또는 AWS CodePipeline
- 코드 푸시 → 자동 빌드 → 자동 배포

### 5. 모니터링 및 로깅
- CloudWatch 알림 설정
- 에러 모니터링
- 성능 추적

---

## 💰 현재 AWS 비용 예상

### 예상 월 비용 (서울 리전)

**S3 (Frontend)**
- 저장 용량: ~5MB
- 트래픽: 소규모
- 예상: $0.01 ~ $1

**Elastic Beanstalk (Backend)**
- t2.micro 인스턴스 (프리티어 가능)
- 예상: $0 (프리티어) ~ $10

**총 예상 비용**: $0 ~ $11/월 (프리티어 활용 시 거의 무료)

---

## 📞 문제 해결

### Frontend가 로드되지 않음
1. S3 URL 확인
2. 브라우저 캐시 클리어
3. S3 파일 업로드 확인

### Backend API 연결 안됨
1. Elastic Beanstalk Health 확인
2. Backend 로그 확인: `eb logs`
3. CORS 설정 확인

### 데이터가 사라짐
- H2 인메모리 DB 특성상 정상
- RDS 마이그레이션 필요

---

## 📚 참고 문서

- `C:\claudtest\CLOUDFRONT_SETUP_GUIDE.md` - CloudFront HTTPS 설정
- `C:\claudtest\AWS_SUPPORT_REQUEST.md` - AWS Support 요청 방법
- `C:\claudtest\BACKEND_HTTPS_GUIDE.md` - Backend HTTPS 설정
- `C:\claudtest\HASHROUTER_FIX.md` - HashRouter 적용 내역

---

## ✨ 축하합니다!

Kiosk 관리 시스템이 AWS에 성공적으로 배포되었습니다!

- ✅ 인터넷에서 접근 가능
- ✅ Frontend ↔ Backend 정상 통신
- ✅ 회원가입, 로그인 작동
- ✅ 모든 기능 정상 작동

**애플리케이션 접속**:
http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com

질문이나 추가 지원이 필요하시면 언제든지 말씀해주세요! 🚀
