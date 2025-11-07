# GitHub Secrets 설정 - 단계별 상세 가이드

**현재 상황**: 진단 결과 GitHub Secrets가 감지되지 않음

---

## 🎯 정확한 설정 방법 (따라하기)

### 1단계: 올바른 페이지로 이동

다음 링크를 **클릭하거나 복사하여** 브라우저에서 열기:
```
https://github.com/mhpark03/kiosk-management/settings/secrets/actions
```

또는:
1. `https://github.com/mhpark03/kiosk-management` 접속
2. **Settings** 탭 클릭 (저장소 상단 메뉴)
3. 왼쪽 사이드바에서 **Secrets and variables** 찾기
4. **Secrets and variables** 펼치기 (▶ 아이콘 클릭)
5. **Actions** 클릭

---

### 2단계: Repository secrets 섹션 찾기

페이지에서 **아래로 스크롤**하면 2개의 섹션이 나옵니다:

```
┌─────────────────────────────────────┐
│ Environment secrets                  │  ← ❌ 이게 아닙니다!
│ (Environments: production, staging)  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Repository secrets                   │  ← ✅ 여기가 맞습니다!
│ (Available to all environments)      │
│                                      │
│ [New repository secret]              │  ← 이 버튼 클릭
└─────────────────────────────────────┘
```

**중요**: "Repository secrets" 섹션의 **"New repository secret"** 버튼을 클릭하세요!

---

### 3단계: 첫 번째 Secret 추가 - AWS_ACCESS_KEY_ID

1. **"New repository secret"** 버튼 클릭

2. 입력 폼이 나타남:
   ```
   Name *
   [                                    ]

   Secret *
   [                                    ]
   [                                    ]
   [                                    ]
   ```

3. **Name 필드에 정확히 입력** (복사-붙여넣기 권장):
   ```
   AWS_ACCESS_KEY_ID
   ```

   **체크리스트**:
   - [ ] 모두 대문자
   - [ ] 언더스코어 2개 (AWS_ACCESS_KEY_ID)
   - [ ] 하이픈 없음
   - [ ] 앞뒤 공백 없음

4. **Secret 필드에 AWS Access Key 입력**:
   - AWS Console → IAM → Users → 본인 사용자 선택
   - Security credentials → Access keys
   - Access key ID를 복사하여 붙여넣기
   - **주의**: 앞뒤 공백이 포함되지 않도록!

5. **Add secret** 버튼 클릭

6. 추가되면 목록에 나타남:
   ```
   Repository secrets

   AWS_ACCESS_KEY_ID          Updated now by you          [Update] [Remove]
   ```

---

### 4단계: 두 번째 Secret 추가 - AWS_SECRET_ACCESS_KEY

1. 다시 **"New repository secret"** 버튼 클릭

2. **Name 필드에 정확히 입력**:
   ```
   AWS_SECRET_ACCESS_KEY
   ```

   **체크리스트**:
   - [ ] 모두 대문자
   - [ ] 언더스코어 3개 (AWS_SECRET_ACCESS_KEY)
   - [ ] 하이픈 없음
   - [ ] 앞뒤 공백 없음

3. **Secret 필드에 AWS Secret Access Key 입력**:
   - AWS Console에서 Secret access key를 복사
   - 붙여넣기
   - **주의**: 키가 매우 길고 특수문자 포함 (정상)

4. **Add secret** 버튼 클릭

---

### 5단계: 최종 확인

**Repository secrets 섹션에 정확히 2개가 있어야 합니다**:

```
Repository secrets

AWS_ACCESS_KEY_ID          Updated now by you          [Update] [Remove]
AWS_SECRET_ACCESS_KEY      Updated now by you          [Update] [Remove]
```

**확인 사항**:
- [ ] **2개**의 secrets가 보임
- [ ] 이름이 정확히 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] "Repository secrets" 섹션에 있음 (Environment secrets 아님!)

---

### 6단계: 테스트 워크플로우 다시 실행

1. GitHub Actions 페이지로 이동:
   ```
   https://github.com/mhpark03/kiosk-management/actions
   ```

2. 왼쪽에서 **"Test GitHub Secrets"** 클릭

3. 오른쪽 **"Run workflow"** 버튼 클릭

4. 드롭다운에서 **"Run workflow"** 버튼 한 번 더 클릭

5. 페이지가 새로고침되고 워크플로우 실행 시작

6. **1-2분 대기** 후 결과 확인:
   - ✅ **초록색**: 성공! Secrets가 올바르게 설정됨
   - ❌ **빨간색**: 여전히 실패 → 아래 "문제 해결" 참고

---

## 🔧 문제 해결

### 문제 1: "New repository secret" 버튼이 없음

**원인**: Admin 권한 부족

**해결**:
- Settings 탭이 보이는지 확인
- 저장소 소유자에게 Admin 권한 요청
- 또는 본인 계정으로 fork하여 진행

---

### 문제 2: Environment secrets에만 추가됨

**해결**:
1. Environment secrets에서 삭제:
   - Environment secrets 섹션에서 각 secret 옆 [Remove] 클릭

2. Repository secrets에 다시 추가:
   - 위 단계 3-4 반복

---

### 문제 3: 여전히 감지되지 않음

다음 정보를 확인해주세요:

1. **현재 저장소 URL**:
   ```
   https://github.com/mhpark03/kiosk-management
   ```
   맞나요?

2. **Repository secrets 섹션 스크린샷**:
   - Settings → Secrets and variables → Actions 페이지
   - Repository secrets 섹션의 스크린샷
   - (Secret 값은 보이지 않으므로 안전함)

3. **AWS Key 유효성 테스트** (로컬):
   ```bash
   aws configure set aws_access_key_id YOUR_ACCESS_KEY
   aws configure set aws_secret_access_key YOUR_SECRET_KEY
   aws configure set region ap-northeast-2

   aws sts get-caller-identity
   ```

   성공하면 키가 유효함

---

## 🚀 성공 후 다음 단계

테스트 워크플로우가 **초록색 (성공)**이 되면:

### 1. 추가 Secrets 설정

아직 설정하지 않은 secrets:

| Secret 이름 | 값 |
|------------|-----|
| `EB_APPLICATION_NAME` | `Kiosk-backend` |
| `EB_ENVIRONMENT_NAME` | `Kiosk-backend-env` |
| `EB_S3_BUCKET` | AWS Console에서 확인 필요 |
| `EB_ENVIRONMENT_URL` | `Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com` |
| `S3_BUCKET_NAME` | `kiosk-frontend-20251018` |

### 2. 배포 테스트

```bash
cd /c/claudtest
echo "Test auto deployment" >> backend/DEPLOYMENT_TEST.md
git add backend/DEPLOYMENT_TEST.md
git commit -m "test: Verify auto deployment with fixed secrets"
git push origin main
```

### 3. GitHub Actions에서 배포 확인

```
https://github.com/mhpark03/kiosk-management/actions
```

"Deploy Backend to AWS" 워크플로우가 자동 실행되고 성공해야 합니다.

---

## 💡 대안: 수동 배포

GitHub Secrets 설정이 계속 어려우시다면:

**수동 배포 방법** (`MANUAL_DEPLOYMENT_GUIDE.md` 참고):

```bash
# Backend 수동 배포
cd backend
eb deploy

# Frontend 수동 배포
cd firstapp
npm run build
aws s3 sync dist/ s3://kiosk-frontend-20251018/ --delete
```

수동 배포는 즉시 사용 가능하며 GitHub Secrets 설정이 필요 없습니다.

---

## 📞 추가 도움이 필요한 경우

위 단계를 모두 따라했는데도 작동하지 않는다면:

1. **Repository secrets 섹션 스크린샷** 제공
2. **Settings 탭 접근 가능 여부** 확인
3. **저장소 소유자 확인** (본인 계정인지)
4. **수동 배포** 사용 고려

---

**마지막 업데이트**: 2025-10-18
**테스트 결과**: Secrets 미감지 확인됨
**다음 액션**: 위 단계 1-6 정확히 따라하기
