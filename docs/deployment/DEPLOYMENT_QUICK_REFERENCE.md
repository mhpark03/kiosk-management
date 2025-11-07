# AWS 배포 빠른 참조 가이드

## 🚀 핵심 변경사항 요약

### 1. 백엔드 (Backend)

#### ✅ 이미 완료된 설정
- HTTP 포트 8080 설정 완료
- 환경별 프로파일 파일 생성 완료 (local, dev, prod)
- AWS RDS 연결 정보 설정 완료

#### 🔄 배포 시 변경 필요
```bash
# 환경 변수 설정 (EC2 서버에서)
export SPRING_PROFILES_ACTIVE=dev  # local → dev로 변경
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

#### 📁 설정 파일 위치
- `application.yml` - 공통 설정
- `application-local.yml` - 로컬 MySQL (localhost)
- `application-dev.yml` - AWS RDS (개발 서버)
- `application-prod.yml` - AWS RDS (상용 서버) - TODO

---

### 2. 프론트엔드 (Frontend)

#### ✅ 이미 완료된 설정
- HTTP 설정 완료 (vite.config.js)
- 프로덕션 환경 변수 파일 설정 완료

#### 🔄 배포 시 확인사항

**현재 설정** (`.env.production`):
```env
VITE_API_URL=http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api
```

**필요 시 변경**:
- Elastic Beanstalk 사용: 현재 설정 유지
- EC2 직접 사용: EC2 퍼블릭 IP로 변경
- 도메인 사용: 도메인 URL로 변경

#### 배포 명령어
```bash
cd /c/claudtest/firstapp
npm run build
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete
```

---

### 3. CORS 설정

#### 현재 설정 (`CorsConfig.java`)
```java
"http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com"
```

#### ✅ 추가 필요 없음
S3 정적 웹사이트 URL이 이미 설정되어 있습니다.

#### 🔄 추가 배포 방식 사용 시
- CloudFront: CloudFront 도메인 추가 필요
- 커스텀 도메인: 도메인 URL 추가 필요

---

## 📊 환경별 설정 비교

| 항목 | Local | Dev (AWS) | Prod (AWS) |
|------|-------|-----------|------------|
| **Spring 프로파일** | `local` | `dev` | `prod` |
| **백엔드 포트** | 8080 | 8080 | 8080 |
| **프로토콜** | HTTP | HTTP | HTTP |
| **데이터베이스** | localhost MySQL | AWS RDS | AWS RDS (TODO) |
| **DB 호스트** | localhost:3306 | your-rds-endpoint... | TODO |
| **DB 사용자** | root | admin | admin |
| **DB 비밀번호** | your-db-password | your-db-password | TODO (환경변수) |
| **로그 레벨** | DEBUG | INFO | WARN |
| **프론트엔드 URL** | localhost:5173 | S3 Static Website | S3 / CloudFront |
| **백엔드 URL** | localhost:8080 | Elastic Beanstalk | EC2 / ELB |

---

## 🎯 배포 시나리오별 가이드

### 시나리오 1: Elastic Beanstalk + S3
**현재 설정 그대로 사용 가능**

1. 백엔드: Elastic Beanstalk 환경 변수 설정
   ```
   SPRING_PROFILES_ACTIVE=dev
   ```

2. 프론트엔드: 빌드 후 S3 업로드
   ```bash
   npm run build
   aws s3 sync dist/ s3://kiosk-frontend-20251018/
   ```

3. 접속 URL
   - Frontend: `http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com`
   - Backend: `http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com`

---

### 시나리오 2: EC2 + S3
**변경 필요: 프론트엔드 환경 변수**

1. `.env.production` 수정
   ```env
   VITE_API_URL=http://your-ec2-public-ip:8080/api
   ```

2. `CorsConfig.java` 수정 (EC2 IP 추가)
   ```java
   "http://your-ec2-public-ip:8080"
   ```

3. EC2에서 백엔드 실행
   ```bash
   SPRING_PROFILES_ACTIVE=dev ./gradlew bootRun
   # 또는
   SPRING_PROFILES_ACTIVE=dev java -jar build/libs/*.jar
   ```

---

## ⚠️ 주의사항

### 보안
1. ❌ **절대 커밋하지 말것**
   - 프로덕션 DB 비밀번호
   - JWT Secret Key
   - AWS 액세스 키

2. ✅ **환경 변수 사용 권장**
   ```bash
   export DB_PASSWORD="secure-password"
   export JWT_SECRET="very-long-random-secret-key"
   ```

### 성능
1. 프로덕션 빌드 최적화
   ```bash
   # 백엔드
   ./gradlew clean build -Pprod

   # 프론트엔드
   npm run build  # 자동으로 최적화됨
   ```

2. CloudFront 사용 권장
   - S3 직접 접근보다 빠름
   - HTTPS 무료 제공
   - 글로벌 CDN

---

## 📝 배포 체크리스트

### 백엔드 배포 전
- [ ] `SPRING_PROFILES_ACTIVE` 환경 변수 확인
- [ ] 데이터베이스 접속 정보 확인
- [ ] RDS 보안 그룹 설정 확인 (EC2에서만 접근 가능)
- [ ] JWT Secret 환경 변수 설정 (프로덕션)
- [ ] 로그 레벨 확인 (프로덕션은 WARN)

### 프론트엔드 배포 전
- [ ] `.env.production` 파일 확인
- [ ] 백엔드 API URL 정확한지 확인
- [ ] CORS 설정에 프론트엔드 URL 포함 확인
- [ ] 프로덕션 빌드 테스트 (`npm run build`)
- [ ] S3 버킷 퍼블릭 읽기 권한 확인

### 배포 후
- [ ] 백엔드 Health Check 확인
- [ ] 데이터베이스 연결 확인
- [ ] 프론트엔드 접속 확인
- [ ] API 호출 테스트
- [ ] 로그인/회원가입 테스트
- [ ] CORS 에러 없는지 확인

---

## 📚 참고 문서

- 상세 가이드: `AWS_DEPLOYMENT_CHECKLIST.md`
- 환경 설정 가이드: `ENVIRONMENT_SETUP.md`
- 백엔드 프로파일 설정: `backend/src/main/resources/application-*.yml`
- 프론트엔드 환경 변수: `firstapp/.env.*`
