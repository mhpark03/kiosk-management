# 빠른 배포 가이드

AWS Elastic Beanstalk 배포를 위한 간단한 단계별 가이드입니다.

## 사전 준비

1. **AWS 계정** 생성 및 로그인
2. **AWS CLI** 설치 (선택사항, S3 업로드용)
   ```bash
   # Windows
   winget install Amazon.AWSCLI

   # 설정
   aws configure
   ```

---

## 단계 1: RDS 데이터베이스 생성 (5분)

1. AWS Console → RDS → "데이터베이스 생성"
2. 간단한 설정:
   - MySQL 8.0
   - 프리 티어 템플릿
   - DB 인스턴스 식별자: `kiosk-db`
   - 마스터 사용자: `admin`
   - 비밀번호: 안전한 비밀번호 설정 (기록!)
   - 퍼블릭 액세스: **예**
   - 초기 데이터베이스 이름: `kioskdb`

3. 생성 후 **엔드포인트** 기록
   - 예: `kiosk-db.xxxx.ap-northeast-2.rds.amazonaws.com`

---

## 단계 2: Backend 빌드 및 배포 (10분)

### 2.1 로컬에서 빌드

빌드 스크립트 실행:
```bash
C:\claudtest\deploy-scripts\build-backend.bat
```

또는 수동으로:
```bash
cd C:\claudtest\backend
gradlew.bat clean build
```

빌드된 JAR 파일 위치:
```
C:\claudtest\backend\build\libs\backend-0.0.1-SNAPSHOT.jar
```

### 2.2 Elastic Beanstalk 생성

1. AWS Console → Elastic Beanstalk → "애플리케이션 생성"

2. 기본 정보:
   - 애플리케이션 이름: `kiosk-backend`
   - 플랫폼: **Java**
   - 플랫폼 브랜치: **Corretto 17**
   - 애플리케이션 코드: **로컬 파일 업로드**
     * 위에서 빌드한 JAR 파일 선택

3. "추가 옵션 구성" 클릭

4. **소프트웨어** 섹션 편집:

   환경 속성 추가 (중요!):
   ```
   DB_HOST = kiosk-db.xxxx.ap-northeast-2.rds.amazonaws.com
   DB_PORT = 3306
   DB_NAME = kioskdb
   DB_USERNAME = admin
   DB_PASSWORD = [RDS 비밀번호]
   JWT_SECRET = [32자 이상 랜덤 문자열]
   ```

   JWT_SECRET 생성 예시:
   ```
   abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx
   ```

5. **인스턴스** 섹션:
   - EC2 인스턴스 유형: `t3.small` (프리 티어는 t2.micro)

6. **용량** 섹션:
   - 환경 유형: **단일 인스턴스** (비용 절감)

7. "생성" 클릭 (5-10분 소요)

### 2.3 보안 그룹 설정

1. EC2 → 보안 그룹 → Elastic Beanstalk 보안 그룹 찾기
   - 이름: `sg-xxxx (elasticbeanstalk-...)`
   - 보안 그룹 ID 복사

2. RDS 보안 그룹 편집:
   - EC2 → 보안 그룹 → RDS 보안 그룹 찾기
   - 인바운드 규칙 편집
   - 규칙 추가:
     * 유형: MySQL/Aurora
     * 포트: 3306
     * 소스: 위에서 복사한 EB 보안 그룹 ID

3. "규칙 저장"

### 2.4 배포 확인

- Elastic Beanstalk 환경 URL 확인
  * 예: `kiosk-backend-env.xxxxxxxxxx.ap-northeast-2.elasticbeanstalk.com`

- 헬스체크 확인:
  ```
  https://[EB-URL]/actuator/health
  ```

  정상 응답:
  ```json
  {"status":"UP"}
  ```

---

## 단계 3: Frontend 빌드 및 배포 (10분)

### 3.1 API URL 설정

`C:\claudtest\firstapp\.env.production` 파일 편집:
```env
VITE_API_URL=https://kiosk-backend-env.xxxxxxxxxx.ap-northeast-2.elasticbeanstalk.com
```

### 3.2 Frontend 빌드

빌드 스크립트 실행:
```bash
C:\claudtest\deploy-scripts\build-frontend.bat
```

또는 수동으로:
```bash
cd C:\claudtest\firstapp
npm run build
```

### 3.3 S3 버킷 생성

1. AWS Console → S3 → "버킷 만들기"

2. 설정:
   - 버킷 이름: `kiosk-frontend-[고유한이름]`
     * 예: `kiosk-frontend-mycompany`
   - 리전: ap-northeast-2 (서울)
   - **퍼블릭 액세스 차단 설정: 모두 해제**
   - "버킷 만들기"

3. 버킷 → 속성 → "정적 웹 사이트 호스팅" 편집:
   - 활성화
   - 인덱스 문서: `index.html`
   - 오류 문서: `index.html`
   - "변경 사항 저장"

4. 버킷 → 권한 → "버킷 정책" 편집:

   아래 JSON 붙여넣기 (버킷 이름 수정!):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::kiosk-frontend-mycompany/*"
       }
     ]
   }
   ```

### 3.4 파일 업로드

**방법 1: AWS Console 사용**
1. S3 버킷 → "업로드"
2. `C:\claudtest\firstapp\dist\` 폴더의 **모든 파일** 선택
3. "업로드"

**방법 2: AWS CLI 사용 (빠름)**
```bash
C:\claudtest\deploy-scripts\upload-to-s3.bat
```

### 3.5 웹사이트 URL 확인

- S3 버킷 → 속성 → "정적 웹 사이트 호스팅"
- 버킷 웹사이트 엔드포인트:
  ```
  http://kiosk-frontend-mycompany.s3-website.ap-northeast-2.amazonaws.com
  ```

---

## 단계 4: CORS 설정 (중요!)

Backend의 CORS 설정에 Frontend URL 추가:

`backend/src/main/java/com/kiosk/backend/config/CorsConfig.java`:
```java
configuration.setAllowedOrigins(Arrays.asList(
    "http://localhost:5173",  // 로컬 개발
    "https://localhost:5173",
    "http://kiosk-frontend-mycompany.s3-website.ap-northeast-2.amazonaws.com"  // S3 URL 추가
));
```

Backend 재빌드 및 재배포:
```bash
cd C:\claudtest\backend
gradlew.bat clean build
# Elastic Beanstalk Console에서 새 버전 업로드
```

---

## 단계 5: 테스트

1. **Frontend 접속**:
   - S3 웹사이트 URL 접속

2. **회원가입 테스트**:
   - 새 계정 생성
   - 로그인 확인

3. **기능 테스트**:
   - 매장 관리
   - 키오스크 관리
   - History 확인

4. **브라우저 콘솔 확인**:
   - F12 → Console
   - CORS 오류 없는지 확인
   - Network 탭에서 API 호출 확인

---

## 선택사항: CloudFront 설정 (HTTPS, CDN)

### 더 빠르고 안전한 배포를 위해 CloudFront 추가

1. AWS Console → CloudFront → "배포 생성"

2. 설정:
   - 원본 도메인: S3 버킷 웹사이트 엔드포인트 선택
     * 주의: S3 REST API 엔드포인트 아님!
   - 뷰어 프로토콜 정책: **Redirect HTTP to HTTPS**
   - 기본 루트 객체: `index.html`

3. 사용자 지정 오류 응답 설정 (React Router 지원):
   - "사용자 지정 오류 응답 생성"
   - HTTP 오류 코드: **403**
   - 응답 페이지 경로: `/index.html`
   - HTTP 응답 코드: **200**
   - 동일하게 **404** 오류도 추가

4. "배포 생성" (10-15분 소요)

5. CloudFront URL 확인:
   ```
   https://d1234abcd5678.cloudfront.net
   ```

6. **Backend CORS 업데이트**:
   ```java
   configuration.setAllowedOrigins(Arrays.asList(
       "http://localhost:5173",
       "https://localhost:5173",
       "https://d1234abcd5678.cloudfront.net"  // CloudFront URL 추가
   ));
   ```

---

## 예상 월 비용

### 프리 티어 사용 시 (첫 12개월):
- **거의 무료!** (데이터 전송료만 소액)

### 프리 티어 이후:
- RDS db.t3.micro: $15-20
- EC2 t3.small: $15-17
- S3 + CloudFront: $1-5
- **총: $31-42/월**

---

## 문제 해결

### Backend가 시작되지 않을 때

1. **CloudWatch Logs 확인**:
   - Elastic Beanstalk → 로그 → "마지막 100줄 요청"

2. **일반적인 문제**:
   - 환경 변수 오타 확인
   - RDS 엔드포인트 정확한지 확인
   - RDS 보안 그룹 설정 확인

### Frontend에서 API 호출 실패

1. **CORS 오류**:
   - Backend CORS 설정 확인
   - Frontend URL이 정확히 추가되었는지 확인

2. **404 오류**:
   - API URL 환경 변수 확인 (.env.production)
   - Network 탭에서 실제 요청 URL 확인

### 비용이 예상보다 높을 때

1. **CloudWatch Logs 보존 기간 확인**:
   - CloudWatch → 로그 그룹
   - 보존 기간: 7일로 설정

2. **사용하지 않는 리소스 정리**:
   - Elastic Beanstalk 환경 종료
   - RDS 스냅샷 확인 (자동 백업 삭제되지 않음)

---

## 다음 단계

배포 후:
1. ✅ 사용자 도메인 연결 (Route 53)
2. ✅ SSL 인증서 설정 (ACM + CloudFront)
3. ✅ 모니터링 설정 (CloudWatch 알람)
4. ✅ 백업 자동화 (RDS 스냅샷)
5. ✅ CI/CD 파이프라인 (GitHub Actions)

---

## 지원 및 문의

문제가 발생하면:
1. CloudWatch Logs 확인
2. 보안 그룹 설정 재확인
3. 환경 변수 확인
4. GitHub Issues에 문의

배포 성공을 기원합니다! 🚀
