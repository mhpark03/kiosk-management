# AWS 서버 배포 체크리스트

## 📋 목차
1. [백엔드 배포 설정](#백엔드-배포-설정)
2. [프론트엔드 배포 설정](#프론트엔드-배포-설정)
3. [데이터베이스 설정](#데이터베이스-설정)
4. [보안 설정](#보안-설정)
5. [배포 명령어](#배포-명령어)

---

## 백엔드 배포 설정

### 1. Spring 프로파일 변경
**로컬**: `SPRING_PROFILES_ACTIVE=local`
**AWS 개발**: `SPRING_PROFILES_ACTIVE=dev`
**AWS 상용**: `SPRING_PROFILES_ACTIVE=prod`

### 2. EC2 환경 변수 설정

EC2 서버에서 다음 환경 변수를 설정해야 합니다:

```bash
# /etc/environment 파일에 추가 또는
# ~/.bashrc 또는 ~/.bash_profile에 추가

export SPRING_PROFILES_ACTIVE=dev  # 또는 prod
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64  # EC2의 Java 경로
```

### 3. Systemd 서비스 파일 설정

`/etc/systemd/system/kiosk-backend.service` 파일 생성:

```ini
[Unit]
Description=Kiosk Backend Service
After=network.target

[Service]
Type=simple
User=ubuntu  # 또는 ec2-user
WorkingDirectory=/home/ubuntu/kiosk-backend
Environment="SPRING_PROFILES_ACTIVE=dev"
Environment="JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64"
ExecStart=/home/ubuntu/kiosk-backend/gradlew bootRun
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 4. application.yml 확인사항

#### ✅ 이미 설정됨
- ✅ `application-dev.yml`: AWS RDS 정보 설정 완료
- ✅ `application-local.yml`: localhost MySQL 정보 설정 완료
- ✅ HTTP 포트 8080 설정 완료

#### ⚠️ 확인 필요
**`src/main/resources/application.yml`**:
```yaml
server:
  port: 8080  # ✅ 설정됨

jwt:
  secret: your-256-bit-secret-key-here-make-it-very-long-and-secure-at-least-32-characters
  # ⚠️ 상용 서버에서는 환경 변수로 관리 권장
```

### 5. CORS 설정

**`src/main/java/com/kiosk/backend/config/CorsConfig.java`**

현재 설정:
```java
configuration.setAllowedOrigins(Arrays.asList(
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:5174",
    "https://localhost:5174",
    "http://localhost:5175",
    "https://localhost:5175",
    "http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com"  // ✅ 이미 추가됨
));
```

**변경 필요사항**:
- ⚠️ EC2 서버의 퍼블릭 IP 또는 도메인 추가 필요
- ⚠️ CloudFront 배포 시 CloudFront 도메인 추가 필요

예시:
```java
configuration.setAllowedOrigins(Arrays.asList(
    // 로컬 개발
    "http://localhost:5173",
    "https://localhost:5173",
    // S3 정적 웹사이트
    "http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com",
    // EC2 퍼블릭 IP (필요시)
    "http://your-ec2-public-ip:8080",
    // CloudFront (필요시)
    "https://your-cloudfront-domain.cloudfront.net",
    // 커스텀 도메인 (필요시)
    "https://yourdomain.com"
));
```

---

## 프론트엔드 배포 설정

### 1. 환경 변수 파일

현재 파일: `.env.development`
```env
VITE_API_URL=http://localhost:8080/api
```

**새로 생성 필요**: `.env.production`
```env
# AWS EC2 백엔드 서버 주소로 변경
VITE_API_URL=http://your-ec2-public-ip:8080/api

# 또는 EC2에 도메인을 연결한 경우
# VITE_API_URL=https://api.yourdomain.com/api
```

### 2. vite.config.js

#### 현재 설정 (개발용 - HTTP):
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
```

#### 빌드 설정 (이미 적절함):
- Vite는 프로덕션 빌드 시 자동으로 최적화됨
- 추가 변경 불필요

### 3. S3 버킷 설정

#### 빌드 및 배포:
```bash
# 1. 프로덕션 빌드
cd /c/claudtest/firstapp
npm run build

# 2. S3에 업로드 (AWS CLI 사용)
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete

# 3. CloudFront 캐시 무효화 (CloudFront 사용 시)
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

#### S3 정적 웹사이트 호스팅 설정:
- ✅ 이미 설정됨: `http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com`
- ⚠️ 인덱스 문서: `index.html`
- ⚠️ 오류 문서: `index.html` (React Router를 위해 필요)

---

## 데이터베이스 설정

### AWS RDS MySQL

#### Dev 환경 (이미 설정됨):
```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:mysql://your-rds-endpoint.ap-northeast-2.rds.amazonaws.com:3306/kioskdb
    username: admin
    password: your-db-password
```

#### Prod 환경 (설정 필요):
**`application-prod.yml`** 수정:
```yaml
spring:
  datasource:
    url: jdbc:mysql://your-prod-rds-endpoint.rds.amazonaws.com:3306/kioskdb
    username: ${DB_USERNAME:admin}  # 환경 변수 사용 권장
    password: ${DB_PASSWORD}        # 환경 변수 사용 필수
```

#### RDS 보안 그룹 설정:
- ⚠️ EC2 인스턴스의 보안 그룹에서만 3306 포트 접근 허용
- ⚠️ 퍼블릭 접근 비활성화 (프로덕션)

---

## 보안 설정

### 1. JWT Secret Key
**현재** (application.yml):
```yaml
jwt:
  secret: your-256-bit-secret-key-here-make-it-very-long-and-secure-at-least-32-characters
```

**프로덕션 권장**:
```yaml
jwt:
  secret: ${JWT_SECRET}
```

EC2 환경 변수:
```bash
export JWT_SECRET="your-very-secure-random-256-bit-secret-key-for-production"
```

### 2. 데이터베이스 비밀번호
**프로덕션 권장**:
```bash
export DB_PASSWORD="your-secure-db-password"
```

### 3. Spring Security 기본 계정
**현재** (application.yml):
```yaml
spring:
  security:
    user:
      name: admin
      password: admin
```

**프로덕션 권장**:
- ⚠️ 기본 계정 비활성화 또는 강력한 비밀번호 사용
- JWT 인증만 사용하는 경우 제거 고려

---

## AWS EC2 보안 그룹 설정

### 인바운드 규칙:

| 유형 | 프로토콜 | 포트 범위 | 소스 | 설명 |
|------|---------|----------|------|------|
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP 접근 (선택) |
| Custom TCP | TCP | 8080 | 0.0.0.0/0 | Spring Boot API |
| SSH | TCP | 22 | My IP | SSH 접근 |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS (SSL 설정 시) |

⚠️ **프로덕션에서는** 8080 포트를 Nginx 리버스 프록시 뒤에 두고, 80/443 포트만 공개하는 것을 권장합니다.

---

## 배포 명령어

### 백엔드 배포 (EC2)

#### 1. 코드 업로드
```bash
# 로컬에서 Git push
cd /c/claudtest/backend
git add .
git commit -m "Deploy to AWS"
git push origin main

# EC2 서버에서
cd ~/kiosk-backend
git pull origin main
```

#### 2. 빌드 및 실행
```bash
# JAR 파일 빌드
./gradlew clean build

# Dev 프로파일로 실행
SPRING_PROFILES_ACTIVE=dev java -jar build/libs/kiosk-backend-*.jar

# 또는 systemd 서비스로 실행
sudo systemctl start kiosk-backend
sudo systemctl enable kiosk-backend  # 부팅 시 자동 시작
sudo systemctl status kiosk-backend  # 상태 확인
```

#### 3. 로그 확인
```bash
# systemd 로그
sudo journalctl -u kiosk-backend -f

# 또는 애플리케이션 로그
tail -f ~/kiosk-backend/logs/spring.log
```

### 프론트엔드 배포 (S3)

#### 1. .env.production 파일 생성
```bash
cd /c/claudtest/firstapp
# .env.production 파일 생성 (위 내용 참조)
```

#### 2. 빌드
```bash
npm run build
# dist/ 폴더가 생성됨
```

#### 3. S3 업로드
```bash
# AWS CLI로 업로드
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete

# 또는 AWS Console에서 수동 업로드
```

#### 4. 확인
```
http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
```

---

## 배포 후 확인사항

### ✅ 체크리스트

- [ ] 백엔드 서버가 정상적으로 실행되는가?
  ```bash
  curl http://your-ec2-ip:8080/actuator/health
  ```

- [ ] 데이터베이스 연결이 정상인가?
  - 서버 로그에서 MySQL 연결 확인

- [ ] 프론트엔드에서 API 호출이 되는가?
  - 브라우저 개발자 도구 Network 탭 확인

- [ ] CORS 에러가 없는가?
  - 브라우저 콘솔에서 CORS 에러 확인

- [ ] JWT 인증이 정상 작동하는가?
  - 로그인/회원가입 테스트

- [ ] 환경 프로파일이 올바른가?
  - 서버 로그에서 `The following 1 profile is active: "dev"` 확인

---

## 트러블슈팅

### 1. CORS 에러 발생 시
**증상**: 브라우저 콘솔에 "blocked by CORS policy" 에러

**해결**:
1. `CorsConfig.java`에 S3 URL 또는 EC2 IP 추가
2. 백엔드 재시작
3. 브라우저 캐시 삭제 후 재시도

### 2. 데이터베이스 연결 실패
**증상**: `CommunicationsException: Communications link failure`

**해결**:
1. RDS 보안 그룹에서 EC2 보안 그룹 인바운드 허용 확인
2. RDS 엔드포인트 주소 확인
3. 데이터베이스 사용자 권한 확인

### 3. 404 에러 (프론트엔드)
**증상**: 새로고침 시 404 에러

**해결**:
- S3 버킷 속성 > 정적 웹사이트 호스팅 > 오류 문서를 `index.html`로 설정

### 4. 환경 변수가 적용되지 않음
**증상**: 프로덕션 빌드에서 로컬 API URL 사용

**해결**:
1. `.env.production` 파일 생성 확인
2. `npm run build` 재실행
3. `dist/assets/*.js` 파일에서 올바른 API URL 확인

---

## 추가 권장사항

### 1. Nginx 리버스 프록시 설정 (선택)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. SSL/TLS 인증서 설정 (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. CloudWatch 로그 설정
- EC2에서 CloudWatch Agent 설치
- 애플리케이션 로그를 CloudWatch Logs로 전송

### 4. 자동 배포 (CI/CD)
- GitHub Actions 또는 AWS CodePipeline 설정
- Git push 시 자동으로 빌드 및 배포
