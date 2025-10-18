# GitHub Actions 자동 배포 설정 가이드

## 📋 목차
1. [개요](#개요)
2. [GitHub Secrets 설정](#github-secrets-설정)
3. [워크플로우 파일 설명](#워크플로우-파일-설명)
4. [배포 방식 선택](#배포-방식-선택)
5. [설정 단계](#설정-단계)

---

## 개요

이 프로젝트는 GitHub Actions를 사용하여 자동 배포를 수행합니다:
- **Backend**: AWS Elastic Beanstalk 또는 EC2
- **Frontend**: AWS S3

### 트리거 조건
- `main` 브랜치에 push할 때
- 각 디렉토리(`backend/`, `firstapp/`)의 파일이 변경될 때만 해당 워크플로우 실행

---

## GitHub Secrets 설정

GitHub 저장소 설정에서 다음 Secrets를 추가해야 합니다.

### 1. GitHub 저장소 → Settings → Secrets and variables → Actions

### 2. 공통 Secrets

| Secret 이름 | 설명 | 예시 |
|-------------|------|------|
| `AWS_ACCESS_KEY_ID` | AWS IAM 액세스 키 ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM 시크릿 액세스 키 | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

### 3. Backend Secrets (Elastic Beanstalk)

| Secret 이름 | 설명 | 현재 값 추정 |
|-------------|------|-------------|
| `EB_APPLICATION_NAME` | Elastic Beanstalk 애플리케이션 이름 | `Kiosk-backend` |
| `EB_ENVIRONMENT_NAME` | Elastic Beanstalk 환경 이름 | `Kiosk-backend-env` |
| `EB_S3_BUCKET` | EB 배포 파일을 저장할 S3 버킷 | `elasticbeanstalk-ap-northeast-2-XXXX` |
| `EB_ENVIRONMENT_URL` | EB 환경 URL | `Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com` |

### 4. Frontend Secrets (S3)

| Secret 이름 | 설명 | 현재 값 |
|-------------|------|---------|
| `S3_BUCKET_NAME` | 프론트엔드 S3 버킷 이름 | `kiosk-frontend-20251018` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront 배포 ID (선택) | (설정 시 입력) |

### 5. Backend Secrets (EC2 - 선택사항)

EC2로 직접 배포하는 경우에만 필요:

| Secret 이름 | 설명 |
|-------------|------|
| `DEPLOYMENT_BUCKET` | 배포 파일을 임시 저장할 S3 버킷 |
| `EC2_TAG_NAME` | EC2 인스턴스의 Name 태그 값 |

---

## 워크플로우 파일 설명

### 1. `deploy-backend.yml` (Elastic Beanstalk)

**트리거**: `backend/` 디렉토리 변경 시

**동작 과정**:
1. 코드 체크아웃
2. JDK 17 설정
3. Gradle 빌드 (테스트 제외)
4. JAR 파일 및 설정 파일 패키징
5. S3에 업로드
6. Elastic Beanstalk 새 버전 생성
7. 환경 업데이트
8. 배포 완료 대기

**필요한 Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `EB_APPLICATION_NAME`
- `EB_ENVIRONMENT_NAME`
- `EB_S3_BUCKET`
- `EB_ENVIRONMENT_URL`

---

### 2. `deploy-frontend.yml` (S3)

**트리거**: `firstapp/` 디렉토리 변경 시

**동작 과정**:
1. 코드 체크아웃
2. Node.js 18 설정
3. npm 의존성 설치
4. 프로덕션 빌드 (`npm run build`)
5. S3 버킷에 동기화
6. CloudFront 캐시 무효화 (선택)

**필요한 Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID` (선택)

---

### 3. `deploy-ec2.yml` (EC2 직접 배포 - 선택)

**트리거**: 수동 실행만 (`workflow_dispatch`)

**동작 과정**:
1. Gradle 빌드
2. JAR 파일 S3 업로드
3. SSM을 통해 EC2에서 배포 스크립트 실행
4. 서비스 재시작

**필요한 Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DEPLOYMENT_BUCKET`
- `EC2_TAG_NAME`

---

## 배포 방식 선택

### 옵션 1: Elastic Beanstalk (권장 - 현재 설정)

**장점**:
- 자동 스케일링
- 로드 밸런싱
- 롤링 배포
- 간단한 관리

**현재 환경**:
- URL: `http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com`
- 워크플로우: `deploy-backend.yml` 사용

---

### 옵션 2: EC2 직접 배포

**장점**:
- 완전한 제어
- 비용 절감 (소규모 앱)

**단점**:
- 수동 설정 필요
- 확장성 낮음

**워크플로우**: `deploy-ec2.yml` 사용

---

## 설정 단계

### 1️⃣ AWS IAM 사용자 생성

1. AWS Console → IAM → Users → Add User
2. 사용자 이름: `github-actions-deploy`
3. 액세스 유형: **Programmatic access**
4. 권한 설정:
   - Elastic Beanstalk 사용: `AdministratorAccess-AWSElasticBeanstalk`
   - S3 사용: `AmazonS3FullAccess`
   - EC2 사용: `AmazonEC2FullAccess`, `AmazonSSMFullAccess`
5. 액세스 키 ID와 시크릿 키 저장

### 2️⃣ GitHub Secrets 설정

1. GitHub 저장소 → **Settings** 탭
2. **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. 위 표의 모든 Secret 추가

### 3️⃣ Elastic Beanstalk 설정 확인

```bash
# EB CLI로 현재 설정 확인
cd backend
eb status

# 출력 예시:
# Environment details for: Kiosk-backend-env
# Application name: Kiosk-backend
# ...
```

**현재 추정 값**:
- Application: `Kiosk-backend`
- Environment: `Kiosk-backend-env`
- S3 Bucket: AWS 콘솔에서 확인 필요

### 4️⃣ S3 버킷 확인

현재 S3 버킷: `kiosk-frontend-20251018`

**확인 사항**:
- 정적 웹사이트 호스팅 활성화됨
- 퍼블릭 읽기 권한 설정됨
- 인덱스 문서: `index.html`
- 오류 문서: `index.html`

### 5️⃣ 배포 테스트

1. 코드 변경 후 커밋:
```bash
# 백엔드 변경
git add backend/
git commit -m "test: backend deployment"
git push origin main

# 프론트엔드 변경
git add firstapp/
git commit -m "test: frontend deployment"
git push origin main
```

2. GitHub Actions 탭에서 워크플로우 실행 확인

3. 배포 로그 확인

---

## 🔧 트러블슈팅

### 1. AWS 자격 증명 오류
```
Error: Credentials could not be loaded
```

**해결**: GitHub Secrets에 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 확인

---

### 2. Elastic Beanstalk 배포 실패
```
Error: Application version does not exist
```

**해결**:
1. EB 애플리케이션 이름 확인
2. S3 버킷 접근 권한 확인
3. IAM 역할 권한 확인

---

### 3. S3 업로드 실패
```
Error: Access Denied
```

**해결**:
1. S3 버킷 이름 확인
2. IAM 사용자에 S3 권한 추가
3. 버킷 정책 확인

---

### 4. 빌드 실패
```
Error: Gradle build failed
```

**해결**:
1. 로컬에서 빌드 테스트: `./gradlew clean build`
2. 의존성 문제 확인
3. Java 버전 확인 (JDK 17)

---

## 📊 배포 플로우 다이어그램

```
┌─────────────────┐
│  Git Push       │
│  to main        │
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
    backend/       firstapp/      기타 파일
    변경됨?         변경됨?         (무시)
         │              │
         ▼              ▼
   ┌──────────┐   ┌──────────┐
   │ Backend  │   │ Frontend │
   │ Deploy   │   │ Deploy   │
   └─────┬────┘   └─────┬────┘
         │              │
         ▼              ▼
   ┌──────────┐   ┌──────────┐
   │   EB     │   │    S3    │
   │ Update   │   │  Sync    │
   └──────────┘   └──────────┘
```

---

## 🎯 다음 단계

1. ✅ GitHub Secrets 모두 설정
2. ✅ 테스트 커밋으로 배포 확인
3. ✅ 배포 성공 시 문서 업데이트
4. ⭐ (선택) CloudFront 설정
5. ⭐ (선택) 도메인 연결
6. ⭐ (선택) 슬랙/이메일 알림 추가

---

## 📞 도움말

- GitHub Actions 문서: https://docs.github.com/en/actions
- AWS Elastic Beanstalk: https://docs.aws.amazon.com/elasticbeanstalk/
- AWS S3 정적 웹사이트: https://docs.aws.amazon.com/s3/
