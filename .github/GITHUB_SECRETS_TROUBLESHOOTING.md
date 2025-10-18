# GitHub Secrets 문제 해결 가이드

GitHub Actions에서 AWS Secrets가 인식되지 않을 때 확인할 사항들입니다.

## ✅ 체크리스트

### 1단계: Secrets 위치 확인

**올바른 위치:**
1. GitHub 저장소 페이지 이동: `https://github.com/mhpark03/kiosk-management`
2. **Settings** 탭 클릭 (상단 메뉴)
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions** 클릭
4. **Repository secrets** 섹션 확인 ⭐

**잘못된 위치:**
- ❌ **Environment secrets** (이것이 아닙니다!)
- ❌ **Organization secrets**
- ❌ **Dependabot secrets**

### 2단계: Secret 이름 정확히 확인

다음 이름으로 **정확히** 입력되어 있어야 합니다:

| Secret 이름 | 대소문자 구분 | 언더스코어 위치 |
|------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | ✅ 모두 대문자 | ✅ ACCESS와 KEY 사이, KEY와 ID 사이 |
| `AWS_SECRET_ACCESS_KEY` | ✅ 모두 대문자 | ✅ SECRET와 ACCESS 사이, ACCESS와 KEY 사이 |

**흔한 오타:**
- ❌ `aws_access_key_id` (소문자)
- ❌ `AWS-ACCESS-KEY-ID` (하이픈 사용)
- ❌ `AWS_ACCESS_KEY` (ID 누락)
- ❌ `AWS_ACCESSKEY_ID` (언더스코어 누락)

### 3단계: Secret 값 확인

1. **앞뒤 공백 없음**: 복사-붙여넣기 시 공백이 포함되지 않았는지 확인
2. **줄바꿈 없음**: 키 값에 줄바꿈이 포함되지 않았는지 확인
3. **전체 키 복사**: 키의 일부만 복사하지 않았는지 확인

**테스트 방법:**
```bash
# 로컬에서 키가 유효한지 테스트
aws configure set aws_access_key_id YOUR_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_SECRET_KEY
aws configure set region ap-northeast-2

# 테스트
aws sts get-caller-identity
```

성공 시 출력:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/github-actions-deploy"
}
```

### 4단계: 저장소 권한 확인

**본인 저장소인가요?**
- ✅ 본인 계정: `mhpark03/kiosk-management`
- ❌ Fork된 저장소: Secrets 접근 제한이 있을 수 있음

**Settings 탭이 보이나요?**
- ✅ 보임: Admin 권한 있음
- ❌ 안 보임: Admin 권한 필요 (저장소 소유자에게 요청)

### 5단계: Workflow 파일 확인

워크플로우 파일이 올바른지 확인:

`.github/workflows/deploy-backend.yml`:
```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ap-northeast-2
```

**확인 사항:**
- ✅ `secrets.AWS_ACCESS_KEY_ID` (정확한 이름)
- ✅ `${{ }}` 문법 사용
- ✅ 따옴표 없음 (있으면 안됨)

### 6단계: 테스트 워크플로우 실행

진단 워크플로우 실행:

1. GitHub Actions 탭으로 이동
2. 왼쪽 메뉴에서 **Test GitHub Secrets** 선택
3. **Run workflow** 버튼 클릭
4. 결과 확인:
   - ✅ 초록색: Secrets가 올바르게 설정됨
   - ❌ 빨간색: Secrets가 인식되지 않음

---

## 🔍 상세 진단

### 진단 워크플로우 로그 읽는 방법

**Secrets가 제대로 설정된 경우:**
```
✅ AWS_ACCESS_KEY_ID is SET (length: 20)
✅ AWS_SECRET_ACCESS_KEY is SET (length: 40)
Testing AWS CLI access...
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/github-actions-deploy"
}
```

**Secrets가 설정되지 않은 경우:**
```
❌ AWS_ACCESS_KEY_ID is EMPTY or NOT SET
❌ AWS_SECRET_ACCESS_KEY is EMPTY or NOT SET
=========================================
GitHub Secrets가 감지되지 않았습니다!
=========================================
```

---

## 🛠️ 해결 방법

### 방법 1: Secrets 다시 생성

1. 기존 Secrets 삭제:
   - Settings → Secrets and variables → Actions
   - AWS_ACCESS_KEY_ID 옆 **Remove** 클릭
   - AWS_SECRET_ACCESS_KEY 옆 **Remove** 클릭

2. 새로 생성:
   - **New repository secret** 클릭
   - Name: `AWS_ACCESS_KEY_ID` (정확히 입력)
   - Secret: AWS Access Key 붙여넣기 (공백 없이)
   - **Add secret** 클릭
   - 반복 (AWS_SECRET_ACCESS_KEY)

3. 테스트:
   - Actions 탭 → Test GitHub Secrets → Run workflow

### 방법 2: 새 AWS IAM 키 발급

기존 키가 유효하지 않을 수 있으므로 새로 발급:

1. AWS Console → IAM → Users
2. `github-actions-deploy` 사용자 선택
3. **Security credentials** 탭
4. **Access keys** 섹션
5. **Create access key** 클릭
6. Use case: **Third-party service**
7. 생성된 키를 GitHub Secrets에 추가

### 방법 3: 워크플로우 권한 확인

`.github/workflows/deploy-backend.yml` 상단에 권한 추가:

```yaml
name: Deploy Backend to AWS

on:
  push:
    branches:
      - main
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

permissions:
  contents: read
  id-token: write  # AWS credentials에 필요

jobs:
  deploy:
    runs-on: ubuntu-latest
    # ... 나머지 설정
```

### 방법 4: Environment 사용 (고급)

Repository secrets 대신 Environment secrets 사용:

1. Settings → Environments → **New environment**
2. 이름: `production`
3. Environment secrets 추가
4. 워크플로우 수정:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # 추가
    steps:
      # ... 나머지
```

---

## 📋 최종 체크리스트

실행하기 전에 다시 확인:

- [ ] Repository secrets 섹션에 2개의 secret이 있음
- [ ] Secret 이름이 정확함: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] 로컬에서 AWS CLI로 키가 작동함 (`aws sts get-caller-identity`)
- [ ] Settings 탭이 보임 (Admin 권한)
- [ ] Fork된 저장소가 아님 (또는 fork인 경우 추가 설정 완료)
- [ ] 워크플로우 파일에서 올바른 secret 이름 사용
- [ ] Test GitHub Secrets 워크플로우가 성공함

---

## 🚨 여전히 작동하지 않는 경우

### 대안 1: 수동 배포 사용

`MANUAL_DEPLOYMENT_GUIDE.md` 파일 참고:

```bash
# EB CLI 사용
cd backend
eb deploy
```

### 대안 2: GitHub Support 문의

다음 정보와 함께 문의:
- 저장소 URL: `https://github.com/mhpark03/kiosk-management`
- 문제: "Repository secrets not accessible in workflows"
- 워크플로우 로그 URL 첨부

### 대안 3: 다른 CI/CD 도구 사용

- GitLab CI/CD
- AWS CodePipeline
- CircleCI
- Travis CI

---

## 📞 추가 참고 자료

- GitHub Secrets 공식 문서: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- AWS Credentials 설정: https://github.com/aws-actions/configure-aws-credentials
- GitHub Actions 트러블슈팅: https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows

---

## 💡 성공 사례

Secrets가 제대로 설정되면:

1. **deploy-backend.yml** 워크플로우가 성공:
   ```
   ✓ Configure AWS credentials
   ✓ Deploy to Elastic Beanstalk
   ✓ Wait for deployment
   ✓ Verify deployment
   ```

2. **test-secrets.yml** 워크플로우가 성공:
   ```
   ✓ Check if secrets exist
   ✓ Test AWS credentials
   ✓ Verify AWS connection
   ```

3. 배포된 애플리케이션이 정상 작동:
   ```
   http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
   {"status":"UP"}
   ```

문제가 해결되면 이 문서를 참고하여 다른 팀원들을 도와주세요!
