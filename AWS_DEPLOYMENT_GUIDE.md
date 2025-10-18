# AWS 배포 가이드 (Elastic Beanstalk)

## 아키텍처 개요

```
Frontend (React)
  └─> S3 + CloudFront (정적 호스팅)
       └─> API 요청 ─> Application Load Balancer
                         └─> Elastic Beanstalk (Spring Boot)
                              └─> RDS MySQL
```

## 예상 비용
- RDS MySQL (db.t3.micro): $15-20/월
- EC2 (t3.small via EB): $15-17/월
- S3 + CloudFront: $1-5/월
- Application Load Balancer (선택): $16-18/월
- **총: $31-60/월** (로드밸런서 포함 여부에 따라)

---

## 1단계: RDS MySQL 데이터베이스 생성

### 1.1 AWS Console에서 RDS 생성

1. AWS Console → RDS → "데이터베이스 생성" 클릭
2. 다음 설정 사용:
   - 엔진 옵션: MySQL 8.0
   - 템플릿: **프리 티어** (또는 개발/테스트)
   - DB 인스턴스 식별자: `kiosk-db`
   - 마스터 사용자 이름: `admin`
   - 마스터 암호: `[안전한 비밀번호 설정]` (기록해두기!)
   - DB 인스턴스 클래스: db.t3.micro
   - 스토리지: 20GB (General Purpose SSD)
   - VPC: 기본 VPC
   - 퍼블릭 액세스: **예** (개발용, 프로덕션은 아니오)
   - VPC 보안 그룹: 새로 생성 → `kiosk-db-sg`
   - 초기 데이터베이스 이름: `kioskdb`

3. "데이터베이스 생성" 클릭 (생성까지 5-10분 소요)

### 1.2 보안 그룹 설정

1. RDS 생성 후, 보안 그룹(`kiosk-db-sg`) 편집
2. 인바운드 규칙 추가:
   - 유형: MySQL/Aurora (3306)
   - 소스: Elastic Beanstalk 보안 그룹 (나중에 추가)
   - 또는 임시로 내 IP 추가 (테스트용)

### 1.3 RDS 엔드포인트 확인

- RDS 대시보드에서 엔드포인트 확인
- 형식: `kiosk-db.xxxxxxxxxx.ap-northeast-2.rds.amazonaws.com`
- 이 값을 나중에 사용합니다

---

## 2단계: Backend (Spring Boot) - Elastic Beanstalk 배포

### 2.1 환경 변수 설정

Elastic Beanstalk 환경 변수로 다음을 설정합니다:

```properties
# RDS 연결 정보
DB_HOST=kiosk-db.xxxxxxxxxx.ap-northeast-2.rds.amazonaws.com
DB_PORT=3306
DB_NAME=kioskdb
DB_USERNAME=admin
DB_PASSWORD=[RDS 비밀번호]

# JWT 설정
JWT_SECRET=[안전한 랜덤 문자열, 최소 32자]

# SSL 설정 (프로덕션에서는 ACM 인증서 사용)
SERVER_SSL_ENABLED=false
```

### 2.2 빌드 및 배포 준비

1. 로컬에서 JAR 파일 빌드:

```bash
cd C:\claudtest\backend
./gradlew.bat clean build
```

2. 빌드된 JAR 파일 위치:
```
backend/build/libs/backend-0.0.1-SNAPSHOT.jar
```

### 2.3 Elastic Beanstalk CLI 설치 (선택사항)

CLI를 사용하면 배포가 편리합니다:

```bash
pip install awsebcli
```

### 2.4 Elastic Beanstalk 애플리케이션 생성 (AWS Console)

1. AWS Console → Elastic Beanstalk → "애플리케이션 생성"
2. 설정:
   - 애플리케이션 이름: `kiosk-backend`
   - 플랫폼: Java
   - 플랫폼 브랜치: Corretto 17
   - 애플리케이션 코드: JAR 파일 업로드
   - 버전 레이블: `v1`

3. 추가 옵션 구성:
   - 소프트웨어:
     * 환경 변수: 위의 2.1 환경 변수 모두 입력
     * 포트: 8443 (또는 프로덕션에서는 8080)

   - 인스턴스:
     * EC2 인스턴스 유형: t3.small
     * 루트 볼륨 크기: 10GB

   - 용량:
     * 환경 유형: 단일 인스턴스 (비용 절감) 또는 로드 밸런싱 (확장성)

   - 로드 밸런서 (로드 밸런싱 선택 시):
     * 유형: Application Load Balancer
     * 리스너: HTTPS:443 (ACM 인증서 사용)

   - 네트워크:
     * VPC: 기본 VPC
     * 퍼블릭 IP: 활성화
     * 보안 그룹: 새로 생성 → `kiosk-backend-sg`

4. "생성" 클릭 (배포까지 5-10분 소요)

### 2.5 보안 그룹 업데이트

1. RDS 보안 그룹(`kiosk-db-sg`)에 인바운드 규칙 추가:
   - 소스: Elastic Beanstalk 보안 그룹(`kiosk-backend-sg`)
   - 포트: 3306

2. Backend 보안 그룹(`kiosk-backend-sg`)에 인바운드 규칙 확인:
   - HTTP: 80 (로드 밸런서에서)
   - HTTPS: 443 (로드 밸런서에서)

### 2.6 배포 확인

- Elastic Beanstalk 환경 URL 확인
- 형식: `kiosk-backend.ap-northeast-2.elasticbeanstalk.com`
- 헬스체크: `http://[EB-URL]/actuator/health` (Spring Actuator 추가 필요)

---

## 3단계: Frontend (React) - S3 + CloudFront 배포

### 3.1 프로덕션 빌드

1. API URL 환경 변수 설정

`firstapp/.env.production` 파일 생성:

```env
VITE_API_URL=https://kiosk-backend.ap-northeast-2.elasticbeanstalk.com
```

2. 빌드 실행:

```bash
cd C:\claudtest\firstapp
npm run build
```

빌드된 파일: `firstapp/dist/` 디렉토리

### 3.2 S3 버킷 생성

1. AWS Console → S3 → "버킷 만들기"
2. 설정:
   - 버킷 이름: `kiosk-frontend` (전역적으로 고유해야 함)
   - 리전: ap-northeast-2 (서울)
   - 퍼블릭 액세스 차단 설정: **모두 차단 해제**
   - 버전 관리: 활성화 (선택사항)
   - 암호화: 기본 암호화 활성화

3. "버킷 만들기" 클릭

### 3.3 정적 웹 호스팅 활성화

1. 생성한 버킷 → 속성 → "정적 웹 사이트 호스팅" 편집
2. 설정:
   - 정적 웹 사이트 호스팅: 활성화
   - 호스팅 유형: 정적 웹 사이트 호스팅
   - 인덱스 문서: `index.html`
   - 오류 문서: `index.html` (React Router 지원)

### 3.4 버킷 정책 설정

버킷 → 권한 → 버킷 정책 편집:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::kiosk-frontend/*"
    }
  ]
}
```

### 3.5 파일 업로드

1. S3 버킷 → 업로드
2. `firstapp/dist/` 폴더의 모든 파일 업로드
3. 업로드 후 S3 웹사이트 엔드포인트 확인:
   - `http://kiosk-frontend.s3-website.ap-northeast-2.amazonaws.com`

### 3.6 CloudFront 배포 생성 (CDN, 선택사항 - 권장)

1. AWS Console → CloudFront → "배포 생성"
2. 설정:
   - 원본 도메인: S3 버킷 선택 (웹사이트 엔드포인트 사용)
   - 원본 경로: 비워둠
   - 뷰어 프로토콜 정책: Redirect HTTP to HTTPS
   - 허용된 HTTP 메서드: GET, HEAD
   - 캐시 정책: CachingOptimized
   - 대체 도메인 이름: (사용자 도메인 있으면 입력)
   - SSL 인증서: 기본 CloudFront 인증서
   - 기본 루트 객체: `index.html`
   - 오류 페이지:
     * HTTP 오류 코드: 403, 404
     * 응답 페이지 경로: `/index.html`
     * HTTP 응답 코드: 200

3. "배포 생성" (배포까지 10-15분 소요)

4. CloudFront 배포 URL 확인:
   - 형식: `https://d111111abcdef8.cloudfront.net`

---

## 4단계: CORS 및 도메인 설정

### 4.1 Backend CORS 설정 업데이트

`backend/src/main/java/com/kiosk/backend/config/CorsConfig.java` 수정:

```java
configuration.setAllowedOrigins(Arrays.asList(
    "http://localhost:5173",  // 로컬 개발
    "https://localhost:5173",
    "https://d111111abcdef8.cloudfront.net",  // CloudFront
    "https://yourdomain.com"  // 사용자 도메인
));
```

재배포 필요:
```bash
./gradlew.bat clean build
# Elastic Beanstalk에 새 JAR 업로드
```

### 4.2 사용자 도메인 연결 (선택사항)

**Route 53 사용:**

1. Route 53에서 호스팅 영역 생성
2. A 레코드 생성:
   - 이름: `www` 또는 `app`
   - 레코드 유형: A
   - 별칭: 예
   - 트래픽 라우팅 대상: CloudFront 배포

3. Backend 도메인:
   - CNAME 레코드 생성 → Elastic Beanstalk 환경 URL

**SSL 인증서 (ACM):**

1. AWS Certificate Manager → 인증서 요청
2. 도메인 이름 입력: `yourdomain.com`, `*.yourdomain.com`
3. DNS 검증 선택
4. Route 53에 CNAME 레코드 자동 추가
5. CloudFront 배포에 인증서 연결

---

## 5단계: 데이터베이스 초기화

### 5.1 로컬에서 RDS 연결 테스트

```bash
mysql -h kiosk-db.xxxxxxxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p
```

### 5.2 초기 데이터 입력

Spring Boot가 자동으로 스키마를 생성하지만, 수동으로 관리하려면:

```sql
USE kioskdb;

-- 테이블은 Hibernate가 자동 생성
-- 초기 관리자 계정만 수동 생성 가능
```

또는 Elastic Beanstalk 환경 변수에 추가:
```
SPRING_JPA_HIBERNATE_DDL_AUTO=update
```

---

## 6단계: 모니터링 및 로깅

### 6.1 CloudWatch 로그 설정

Elastic Beanstalk 자동으로 CloudWatch Logs에 로그 전송:
- 위치: CloudWatch → 로그 그룹 → `/aws/elasticbeanstalk/kiosk-backend/`

### 6.2 알람 설정

CloudWatch 알람 생성:
- CPU 사용률 > 80%
- 메모리 사용률 > 80%
- RDS 연결 실패
- HTTP 5xx 오류

---

## 7단계: 백업 및 복구

### 7.1 RDS 자동 백업

RDS 대시보드에서 설정:
- 백업 보존 기간: 7일 (프리 티어는 1일)
- 백업 시간: 새벽 시간 설정

### 7.2 스냅샷 생성

주기적으로 수동 스냅샷 생성:
- RDS 대시보드 → 스냅샷 → "스냅샷 생성"

---

## 배포 체크리스트

### 배포 전
- [ ] RDS MySQL 인스턴스 생성 및 보안 그룹 설정
- [ ] 환경 변수 확인 (DB 연결, JWT 시크릿)
- [ ] Backend JAR 빌드 성공 확인
- [ ] Frontend 빌드 성공 확인 (API URL 확인)

### 배포 후
- [ ] Elastic Beanstalk 헬스체크 통과 확인
- [ ] RDS 연결 테스트
- [ ] S3/CloudFront에서 Frontend 접근 확인
- [ ] CORS 설정 확인 (브라우저 콘솔 오류 확인)
- [ ] 로그인/회원가입 테스트
- [ ] API 호출 테스트

### 보안
- [ ] RDS 퍼블릭 액세스 비활성화 (프로덕션)
- [ ] SSL/TLS 인증서 설정 (ACM)
- [ ] 보안 그룹 규칙 최소화
- [ ] 환경 변수 암호화 (AWS Secrets Manager 사용 권장)
- [ ] JWT 시크릿 강력한 랜덤 문자열로 설정

---

## 비용 최적화 팁

1. **프리 티어 활용** (첫 12개월)
   - RDS db.t2.micro (750시간/월 무료)
   - EC2 t2.micro (750시간/월 무료)
   - CloudFront 50GB 무료

2. **예약 인스턴스** (1년 약정)
   - EC2/RDS 비용 최대 40% 절감

3. **로드 밸런서 제거** (트래픽 적을 때)
   - 단일 인스턴스 모드 사용
   - 월 $16-18 절감

4. **CloudWatch 로그 보존 기간 단축**
   - 기본 무제한 → 7일로 설정

5. **S3 Intelligent-Tiering**
   - 자주 액세스하지 않는 파일 자동으로 저렴한 스토리지로 이동

---

## 문제 해결

### Backend가 시작되지 않을 때
1. CloudWatch Logs 확인
2. 환경 변수 확인 (특히 DB 연결 정보)
3. 보안 그룹 규칙 확인 (RDS 포트 3306 열림?)

### Frontend에서 API 호출 실패
1. CORS 오류: Backend CORS 설정 확인
2. SSL 오류: Mixed Content (HTTP/HTTPS) 확인
3. 네트워크 탭에서 실제 요청 URL 확인

### RDS 연결 실패
1. 보안 그룹에 EB 보안 그룹 추가했는지 확인
2. RDS 엔드포인트 정확한지 확인
3. 비밀번호 정확한지 확인

---

## 다음 단계

배포 후 고려사항:
1. **CI/CD 파이프라인** 구축 (CodePipeline, GitHub Actions)
2. **모니터링 강화** (CloudWatch Dashboards, X-Ray)
3. **오토 스케일링** 설정
4. **다중 AZ 배포** (고가용성)
5. **WAF 설정** (보안 강화)

---

## 참고 자료

- [AWS Elastic Beanstalk 문서](https://docs.aws.amazon.com/elasticbeanstalk/)
- [AWS RDS 문서](https://docs.aws.amazon.com/rds/)
- [AWS S3 정적 웹 호스팅](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [AWS CloudFront 문서](https://docs.aws.amazon.com/cloudfront/)
