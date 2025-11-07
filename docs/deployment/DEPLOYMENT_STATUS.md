# 배포 상태 및 다음 단계

**마지막 업데이트**: 2025-10-18
**현재 상태**: GitHub Secrets 인식 문제 진단 중

---

## 📊 현재 상황

### ✅ 완료된 작업

1. **환경 설정 시스템**
   - ✅ Spring Boot 프로파일 생성 (local, dev, prod)
   - ✅ 환경별 데이터베이스 설정 분리
   - ✅ 문서화 완료

2. **GitHub Actions 워크플로우**
   - ✅ Backend 자동 배포 워크플로우 (.github/workflows/deploy-backend.yml)
   - ✅ Frontend 자동 배포 워크플로우 (.github/workflows/deploy-frontend.yml)
   - ✅ EC2 직접 배포 워크플로우 (선택사항)

3. **빌드 문제 해결**
   - ✅ Gradle wrapper 생성 (Linux 지원)
   - ✅ JAR 파일 선택 로직 수정
   - ✅ Procfile 추가 (Elastic Beanstalk 포트 설정)

4. **진단 도구 및 문서**
   - ✅ GitHub Secrets 테스트 워크플로우
   - ✅ 수동 배포 가이드
   - ✅ GitHub Secrets 문제 해결 가이드

### ⚠️ 해결 필요

**GitHub Secrets 인식 문제**
- 증상: AWS 자격 증명이 null로 표시됨
- 상태: 진단 워크플로우 실행 대기 중
- 영향: 자동 배포가 작동하지 않음

---

## 🎯 다음 단계 (우선순위순)

### 1단계: 진단 워크플로우 확인 ⭐⭐⭐

**GitHub Actions에서 진단 결과 확인:**

1. GitHub 저장소로 이동:
   ```
   https://github.com/mhpark03/kiosk-management/actions
   ```

2. **"Test GitHub Secrets"** 워크플로우 찾기

3. 최신 실행 결과 확인:
   - ✅ **성공 (초록색)**: Secrets가 올바르게 설정됨 → **2단계로 이동**
   - ❌ **실패 (빨간색)**: Secrets가 인식되지 않음 → **3단계로 이동**

---

### 2단계: Secrets가 작동하는 경우

**축하합니다! 이제 자동 배포가 가능합니다.**

#### A. 추가 GitHub Secrets 설정

아직 설정하지 않은 Secrets 추가:

| Secret 이름 | 값 | 확인 방법 |
|------------|-----|----------|
| `EB_APPLICATION_NAME` | `Kiosk-backend` | AWS EB Console |
| `EB_ENVIRONMENT_NAME` | `Kiosk-backend-env` | AWS EB Console |
| `EB_S3_BUCKET` | `elasticbeanstalk-ap-northeast-2-XXXX` | AWS S3 Console |
| `EB_ENVIRONMENT_URL` | `Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com` | 현재 URL |
| `S3_BUCKET_NAME` | `kiosk-frontend-20251018` | 현재 S3 버킷 |

#### B. 배포 테스트

```bash
# Backend 변경 후 배포 테스트
cd backend
echo "Test deployment" >> DEPLOYMENT_TEST.md
git add DEPLOYMENT_TEST.md
git commit -m "test: Verify automatic deployment"
git push origin main
```

#### C. Elastic Beanstalk 환경 변수 설정

1. AWS Elastic Beanstalk Console 접속
2. `Kiosk-backend-env` 환경 선택
3. Configuration → Software → Edit
4. Environment properties 추가:
   ```
   SPRING_PROFILES_ACTIVE = dev
   ```
5. Apply

#### D. 배포 완료 확인

```bash
# Health check
curl http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
```

예상 응답:
```json
{"status":"UP"}
```

---

### 3단계: Secrets가 작동하지 않는 경우

**진단 워크플로우가 실패했다면:**

#### 옵션 A: GitHub Secrets 재설정 (권장)

**상세 가이드**: `.github/GITHUB_SECRETS_TROUBLESHOOTING.md` 참고

**빠른 재설정 단계:**

1. **기존 Secrets 삭제**
   - GitHub 저장소 → Settings → Secrets and variables → Actions
   - Repository secrets 섹션에서 기존 secrets 삭제

2. **새로 생성** (정확히 입력)
   ```
   Name: AWS_ACCESS_KEY_ID
   Secret: (AWS Access Key - 공백 없이)

   Name: AWS_SECRET_ACCESS_KEY
   Secret: (AWS Secret Key - 공백 없이)
   ```

3. **테스트 워크플로우 다시 실행**
   - Actions 탭 → Test GitHub Secrets → Run workflow

#### 옵션 B: 수동 배포 사용 (빠른 대안)

**상세 가이드**: `MANUAL_DEPLOYMENT_GUIDE.md` 참고

**빠른 수동 배포:**

```bash
# Backend 배포
cd backend
eb deploy

# Frontend 배포
cd firstapp
npm run build
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete
```

#### 옵션 C: 새 AWS IAM 키 발급

기존 키가 유효하지 않을 수 있으므로:

1. AWS Console → IAM → Users → github-actions-deploy
2. Security credentials → Create access key
3. 새 키를 GitHub Secrets에 추가

---

## 📁 참고 문서

| 문서 | 용도 | 위치 |
|------|------|------|
| **GitHub Secrets 문제 해결** | Secrets 인식 문제 해결 | `.github/GITHUB_SECRETS_TROUBLESHOOTING.md` |
| **수동 배포 가이드** | GitHub Actions 없이 배포 | `MANUAL_DEPLOYMENT_GUIDE.md` |
| **GitHub Actions 설정** | 자동 배포 설정 방법 | `.github/GITHUB_ACTIONS_SETUP.md` |
| **환경 설정 가이드** | 로컬/개발/운영 환경 관리 | `backend/ENVIRONMENT_SETUP.md` |
| **AWS 배포 체크리스트** | 배포 시 확인 사항 | `AWS_DEPLOYMENT_CHECKLIST.md` |
| **배포 빠른 참조** | 핵심 배포 정보 요약 | `DEPLOYMENT_QUICK_REFERENCE.md` |

---

## 🔍 문제 해결

### GitHub Actions 로그 확인

```
https://github.com/mhpark03/kiosk-management/actions
```

### AWS Elastic Beanstalk 로그 확인

```bash
eb logs
# 또는 AWS Console → Elastic Beanstalk → Logs
```

### 로컬 테스트

```bash
# Backend 로컬 실행
cd backend
set SPRING_PROFILES_ACTIVE=local
gradlew.bat bootRun

# Frontend 로컬 실행
cd firstapp
npm run dev
```

---

## 💬 질문 및 피드백

### 일반적인 질문

**Q: GitHub Actions가 꼭 필요한가요?**
A: 아니요. 수동 배포(`MANUAL_DEPLOYMENT_GUIDE.md`)도 가능합니다.

**Q: 배포가 성공했는지 어떻게 확인하나요?**
A:
```bash
curl http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
```

**Q: 환경을 변경하려면?**
A:
```bash
# 로컬
set SPRING_PROFILES_ACTIVE=local

# AWS (Elastic Beanstalk Console에서)
SPRING_PROFILES_ACTIVE=dev
```

**Q: 프론트엔드 URL은?**
A: http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com

---

## ✅ 체크리스트

배포 전 확인:

- [ ] 로컬에서 애플리케이션이 정상 작동
- [ ] GitHub Secrets 설정 완료 (또는 수동 배포 준비)
- [ ] AWS RDS 데이터베이스 접근 가능
- [ ] Elastic Beanstalk 환경이 Running 상태
- [ ] S3 버킷 정적 웹사이트 호스팅 활성화

배포 후 확인:

- [ ] Backend Health Check 성공
- [ ] Frontend 페이지 로드 성공
- [ ] API 호출 정상 작동
- [ ] 데이터베이스 연결 확인

---

## 📌 현재 접속 URL

**Backend API**:
```
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com
```

**Frontend**:
```
http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
```

**Health Check**:
```
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
```

---

**다음 업데이트**: 진단 워크플로우 결과 확인 후
