# 수동 배포 가이드 (Manual Deployment Guide)

GitHub Actions가 작동하지 않을 때 수동으로 배포하는 방법입니다.

## 📋 목차
1. [백엔드 수동 배포 (EB CLI 사용)](#백엔드-수동-배포)
2. [프론트엔드 수동 배포 (AWS CLI 사용)](#프론트엔드-수동-배포)
3. [배포 확인](#배포-확인)

---

## 백엔드 수동 배포

### 전제 조건

1. **EB CLI 설치 확인**
```bash
eb --version
```

설치되지 않았다면:
```bash
pip install awsebcli
```

2. **AWS 자격 증명 설정**
```bash
aws configure
```

입력 내용:
- AWS Access Key ID: (AWS IAM에서 발급받은 키)
- AWS Secret Access Key: (AWS IAM에서 발급받은 시크릿)
- Default region: `ap-northeast-2`
- Default output format: `json`

### 배포 단계

#### 1단계: 빌드

```bash
cd backend

# Windows
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot
gradlew.bat clean build -x test

# Linux/Mac
export JAVA_HOME=/path/to/jdk-17
./gradlew clean build -x test
```

#### 2단계: 배포 패키지 생성

```bash
# backend 디렉토리에서 실행
mkdir -p deploy
cd deploy

# JAR 파일 복사 (Spring Boot executable JAR만)
# Windows PowerShell
Copy-Item ..\build\libs\backend-*.jar -Exclude *-plain.jar -Destination application.jar

# Linux/Mac
cp ../build/libs/backend-*.jar application.jar 2>/dev/null || true
rm -f *-plain.jar

# Procfile 복사
cp ../Procfile . 2>/dev/null || echo "web: java -Dserver.port=5000 -Dspring.profiles.active=dev -jar application.jar" > Procfile

# .ebextensions 복사 (있는 경우)
cp -r ../.ebextensions . 2>/dev/null || true

# ZIP 생성
zip -r ../deploy-manual.zip .
cd ..
```

#### 3단계: Elastic Beanstalk 배포

```bash
# backend 디렉토리에서 실행

# EB 환경 확인
eb status

# 배포 실행
eb deploy

# 또는 특정 환경에 배포
eb deploy Kiosk-backend-env
```

#### 4단계: 배포 모니터링

```bash
# 로그 확인
eb logs

# 환경 상태 확인
eb status

# 환경 열기 (브라우저)
eb open
```

### 환경 변수 설정 (최초 1회)

```bash
# SPRING_PROFILES_ACTIVE를 dev로 설정
eb setenv SPRING_PROFILES_ACTIVE=dev

# 또는 AWS 콘솔에서:
# 1. Elastic Beanstalk 콘솔 열기
# 2. 환경 선택
# 3. Configuration → Software → Edit
# 4. Environment properties에 추가:
#    Name: SPRING_PROFILES_ACTIVE
#    Value: dev
```

---

## 프론트엔드 수동 배포

### 전제 조건

1. **Node.js 18+ 설치 확인**
```bash
node --version
npm --version
```

2. **AWS CLI 설치 및 설정**
```bash
aws --version
aws configure
```

### 배포 단계

#### 1단계: 빌드

```bash
cd firstapp

# 의존성 설치
npm ci

# 프로덕션 빌드
npm run build
```

#### 2단계: S3에 업로드

```bash
# firstapp 디렉토리에서 실행

# S3 동기화 (기존 파일 삭제하고 새 파일 업로드)
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete

# 성공 메시지 확인
echo "Frontend deployed to: http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com"
```

#### 3단계: CloudFront 캐시 무효화 (선택)

CloudFront를 사용 중인 경우:

```bash
# Distribution ID 확인
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='kiosk-frontend'].{ID:Id,Domain:DomainName}" --output table

# 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

## 배포 확인

### 백엔드 테스트

```bash
# Health check
curl http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health

# 또는 브라우저에서
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
```

예상 응답:
```json
{
  "status": "UP"
}
```

### 프론트엔드 테스트

브라우저에서 접속:
```
http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
```

---

## 💡 빠른 배포 스크립트

### Windows (deploy-backend.bat)

```batch
@echo off
echo ========================================
echo Backend Manual Deployment Script
echo ========================================

set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot
cd backend

echo [1/4] Building...
call gradlew.bat clean build -x test
if %errorlevel% neq 0 exit /b %errorlevel%

echo [2/4] Creating deployment package...
if exist deploy rmdir /s /q deploy
mkdir deploy
copy build\libs\backend-*.jar deploy\application.jar
copy Procfile deploy\
cd deploy
tar -a -c -f ..\deploy-manual.zip *
cd ..

echo [3/4] Deploying to Elastic Beanstalk...
call eb deploy

echo [4/4] Checking status...
call eb status

echo ========================================
echo Deployment completed!
echo ========================================
```

### Linux/Mac (deploy-backend.sh)

```bash
#!/bin/bash

echo "========================================"
echo "Backend Manual Deployment Script"
echo "========================================"

export JAVA_HOME=/path/to/jdk-17  # 실제 경로로 변경
cd backend

echo "[1/4] Building..."
./gradlew clean build -x test
if [ $? -ne 0 ]; then exit 1; fi

echo "[2/4] Creating deployment package..."
rm -rf deploy
mkdir -p deploy
find build/libs -name "*.jar" ! -name "*-plain.jar" -exec cp {} deploy/application.jar \;
cp Procfile deploy/
cd deploy
zip -r ../deploy-manual.zip .
cd ..

echo "[3/4] Deploying to Elastic Beanstalk..."
eb deploy

echo "[4/4] Checking status..."
eb status

echo "========================================"
echo "Deployment completed!"
echo "========================================"
```

---

## 🔧 트러블슈팅

### EB CLI 명령이 작동하지 않을 때

```bash
# EB 초기화 (최초 1회)
cd backend
eb init

# 입력 사항:
# - Region: 10 (ap-northeast-2)
# - Application name: Kiosk-backend
# - Platform: Java (Corretto 17)
# - SSH 설정: y (선택)
```

### AWS 자격 증명 오류

```bash
# 현재 자격 증명 확인
aws sts get-caller-identity

# 새로 설정
aws configure
```

### 빌드 실패

```bash
# Gradle 캐시 삭제
cd backend
rm -rf .gradle build

# 다시 빌드
./gradlew clean build -x test
```

---

## 📞 참고 자료

- EB CLI 문서: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html
- AWS CLI 문서: https://docs.aws.amazon.com/cli/latest/userguide/
- Elastic Beanstalk Java: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/java-se-platform.html
