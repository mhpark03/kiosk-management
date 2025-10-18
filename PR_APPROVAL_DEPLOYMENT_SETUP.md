# PR 승인 후 배포 설정 가이드

## 📋 개요

이 문서는 GitHub에서 Pull Request(PR) 승인 후 자동 배포되도록 설정하는 방법을 설명합니다.

**새로운 배포 프로세스:**
```
개발 브랜치 작업 → PR 생성 → 리뷰어 승인 → main 병합 → 승인 → 자동 배포
```

---

## ✅ 이미 완료된 작업

워크플로우 파일에 `environment: production` 설정 추가:
- `.github/workflows/deploy-backend.yml` ✅
- `.github/workflows/deploy-frontend.yml` ✅

이제 배포 전에 승인이 필요합니다.

---

## 🔧 1단계: GitHub Environment 설정

### 1-1. Production Environment 생성

1. GitHub 저장소로 이동:
   ```
   https://github.com/mhpark03/kiosk-management
   ```

2. **Settings** 탭 클릭

3. 왼쪽 메뉴에서 **Environments** 클릭

4. **New environment** 버튼 클릭

5. Environment name 입력: `production`

6. **Configure environment** 클릭

### 1-2. Required Reviewers 설정

**Environment protection rules** 섹션에서:

1. ✅ **Required reviewers** 체크박스 선택

2. **Add reviewer** 클릭하여 승인자 추가:
   - 본인 계정 추가 가능
   - 팀원이 있다면 팀원 추가
   - **최소 1명 이상** 필요

3. **승인 필요 인원**: 기본값 1명 (필요시 변경 가능)

4. **Wait timer** (선택사항):
   - 승인 후 대기 시간 설정 (예: 0분)
   - 즉시 배포를 원하면 0으로 설정

5. **Save protection rules** 클릭

---

## 🛡️ 2단계: Branch Protection Rules 설정 (권장)

main 브랜치에 직접 push를 막고, PR만 허용하도록 설정:

### 2-1. Branch Protection 생성

1. **Settings** → **Branches** (왼쪽 메뉴)

2. **Add branch protection rule** 클릭

3. **Branch name pattern**: `main` 입력

### 2-2. 보호 규칙 설정

다음 옵션들을 체크:

#### ✅ Require a pull request before merging
- PR 없이 main에 직접 push 불가
- **Require approvals** 체크
- **Required number of approvals**: `1` (또는 원하는 숫자)

#### ✅ Require status checks to pass before merging (선택)
- 테스트/빌드가 성공해야 병합 가능
- Status checks to require: (테스트 워크플로우가 있다면 선택)

#### ✅ Require conversation resolution before merging (선택)
- 모든 코멘트가 해결되어야 병합 가능

#### ✅ Do not allow bypassing the above settings
- 관리자도 규칙을 따르도록 강제

4. **Create** 버튼 클릭

---

## 🚀 3단계: 새로운 배포 워크플로우

### 기존 방식 (변경 전)
```bash
# main 브랜치에 직접 push
git add .
git commit -m "변경사항"
git push origin main
# → 즉시 자동 배포 ❌
```

### 새로운 방식 (변경 후)

#### Step 1: 개발 브랜치에서 작업
```bash
# 새 브랜치 생성
git checkout -b feature/new-feature

# 작업 후 커밋
git add .
git commit -m "feat: Add new feature"

# 브랜치 push
git push origin feature/new-feature
```

#### Step 2: GitHub에서 PR 생성
1. GitHub 저장소 페이지에서 **Compare & pull request** 버튼 클릭
2. PR 제목과 설명 작성
3. **Create pull request** 클릭

#### Step 3: 리뷰 및 승인
1. 리뷰어가 코드 리뷰 진행
2. 필요 시 수정사항 반영
3. 리뷰어가 **Approve** 클릭
4. **Merge pull request** 클릭
5. **Confirm merge** 클릭

#### Step 4: 배포 승인
main에 병합되면 GitHub Actions 워크플로우 자동 시작:

1. Actions 탭에서 워크플로우 확인
2. **Review deployments** 버튼 표시됨
3. 승인자가 **Approve and deploy** 클릭
4. 자동 배포 시작! 🚀

---

## 📊 배포 승인 화면 예시

### Actions 탭에서 볼 수 있는 화면:

```
Deploy Backend to AWS
├─ deploy
   ├─ Waiting for approval
   │  Review required
   │  [Review deployments] 버튼
   └─ ...
```

**Review deployments** 버튼 클릭 시:
```
┌────────────────────────────────────┐
│ Review pending deployments         │
├────────────────────────────────────┤
│ ☑ production                       │
│   Environment: production          │
│   URL: http://...                  │
├────────────────────────────────────┤
│ Comment (optional):                │
│ [                                ] │
│                                    │
│ [Reject]  [Approve and deploy]     │
└────────────────────────────────────┘
```

---

## 🎯 배포 예시 시나리오

### 시나리오 1: 백엔드 수정
```bash
# 1. 브랜치 생성 및 작업
git checkout -b fix/batch-timezone
# 코드 수정...
git add backend/
git commit -m "fix: Set Asia/Seoul timezone for batch"
git push origin fix/batch-timezone

# 2. GitHub에서 PR 생성
# 3. 팀원이 코드 리뷰 및 승인
# 4. main 병합
# 5. Actions에서 "Review deployments" 클릭
# 6. "Approve and deploy" 클릭
# 7. 배포 완료! ✅
```

### 시나리오 2: 프론트엔드 수정
```bash
# 1. 브랜치 생성
git checkout -b feature/new-ui

# 2. 프론트엔드 작업
cd firstapp
# 코드 수정...

# 3. 커밋 및 푸시
git add firstapp/
git commit -m "feat: Add new dashboard UI"
git push origin feature/new-ui

# 4-7: 위와 동일한 PR 프로세스
```

---

## 🔐 권한 설정

### Required Reviewers 권장 구성

**1인 팀:**
- 본인 계정을 reviewer로 추가
- 배포 전 한 번 더 확인 가능

**2-3인 팀:**
- 팀원 전체를 potential reviewers로 추가
- 최소 1명 승인 필요

**4인 이상 팀:**
- 팀 리더/시니어 개발자만 reviewer로 지정
- 또는 2명 이상 승인 필요로 설정

---

## 💡 팁과 모범 사례

### 1. PR 템플릿 사용
`.github/PULL_REQUEST_TEMPLATE.md` 파일 생성:
```markdown
## 변경 사항
-

## 테스트 방법
-

## 체크리스트
- [ ] 로컬에서 테스트 완료
- [ ] 빌드 성공 확인
- [ ] 문서 업데이트 (필요시)
```

### 2. 커밋 메시지 컨벤션
```bash
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 리팩토링
test: 테스트 추가
chore: 빌드/설정 변경
```

### 3. 브랜치 네이밍
```
feature/기능명
fix/버그명
hotfix/긴급수정
docs/문서명
```

### 4. 긴급 배포 시
Branch protection에서 **Allow specified actors to bypass** 설정으로 긴급 상황 대응 가능

---

## 🚨 문제 해결

### Q1: "Review deployments" 버튼이 안 보여요
**A:** Environment 설정에서 Required reviewers가 제대로 설정되었는지 확인

### Q2: 승인했는데 배포가 안 돼요
**A:** GitHub Actions 탭에서 워크플로우 로그 확인. Secrets 설정 확인 필요

### Q3: main에 직접 push가 되는데요?
**A:** Branch protection rules가 활성화되지 않았을 수 있음. Settings → Branches 확인

### Q4: PR 없이 긴급 배포해야 해요
**A:**
- 방법 1: Branch protection 임시 해제
- 방법 2: 수동 배포 사용 (MANUAL_DEPLOYMENT_GUIDE.md 참고)

---

## 📚 참고 자료

- [GitHub Environments 공식 문서](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Pull Request Best Practices](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)

---

## ✅ 설정 완료 체크리스트

배포 전 확인:

- [ ] GitHub Environment `production` 생성
- [ ] Required reviewers 최소 1명 추가
- [ ] Branch protection rules 설정 (권장)
- [ ] Require pull request before merging 활성화
- [ ] Require approvals 설정
- [ ] 팀원들에게 새로운 워크플로우 공유
- [ ] 테스트 PR 생성 및 승인 프로세스 확인

---

**마지막 업데이트**: 2025-10-18
**적용 버전**: v2.0 (PR Approval Required)
