# PR 승인 후 수동 배포 가이드

## 📋 개요

**새로운 배포 프로세스 (GitHub Free 호환):**
```
개발 브랜치 → PR 생성 → 코드 리뷰 → PR 승인 → main 병합 → 수동 배포 실행
```

---

## 🎯 1단계: Branch Protection 설정 (필수)

main 브랜치에 직접 push를 막고 PR만 허용:

### 설정 방법

1. GitHub 저장소로 이동:
   ```
   https://github.com/mhpark03/kiosk-management/settings/branches
   ```

2. **Add branch protection rule** 클릭

3. **Branch name pattern**: `main` 입력

4. 다음 옵션 체크:

   ✅ **Require a pull request before merging**
   - Require approvals: `1` (또는 원하는 숫자)
   - Dismiss stale pull request approvals when new commits are pushed (권장)

   ✅ **Require status checks to pass before merging** (선택사항)
   - Status checks 선택

   ✅ **Require conversation resolution before merging** (권장)

   ✅ **Do not allow bypassing the above settings** (권장)

5. **Create** 버튼 클릭

---

## 🚀 2단계: 개발 및 배포 프로세스

### Step 1: 새 브랜치에서 작업

```bash
# main 브랜치 최신화
git checkout main
git pull origin main

# 새 브랜치 생성
git checkout -b feature/my-new-feature

# 작업...
# 파일 수정

# 커밋
git add .
git commit -m "feat: Add my new feature"

# Push
git push origin feature/my-new-feature
```

### Step 2: Pull Request 생성

1. GitHub 저장소 페이지에서 **Compare & pull request** 버튼 클릭

2. PR 제목과 설명 작성:
   ```
   제목: feat: Add my new feature

   설명:
   ## 변경 사항
   - 새 기능 추가

   ## 테스트
   - 로컬 테스트 완료
   - 빌드 성공 확인
   ```

3. **Create pull request** 클릭

### Step 3: 코드 리뷰 및 승인

**혼자 작업하는 경우:**
- 본인이 코드를 다시 검토
- 문제가 없으면 **Approve** (본인 계정으로)

**팀 작업하는 경우:**
- 팀원에게 리뷰 요청
- 팀원이 코드 리뷰 후 **Approve** 클릭
- 수정사항이 있으면 반영 후 다시 리뷰

### Step 4: PR 병합

1. 승인이 완료되면 **Merge pull request** 버튼 활성화

2. **Merge pull request** 클릭

3. **Confirm merge** 클릭

4. 브랜치 삭제 (선택):
   - **Delete branch** 버튼 클릭

### Step 5: 수동 배포 실행

PR이 main에 병합되었으면 배포 준비 완료!

#### Backend 배포

1. **Actions** 탭으로 이동:
   ```
   https://github.com/mhpark03/kiosk-management/actions
   ```

2. 왼쪽 메뉴에서 **Deploy Backend to AWS** 선택

3. 오른쪽 **Run workflow** 버튼 클릭

4. 드롭다운 메뉴가 나타남:
   ```
   Branch: main (선택됨)
   Deployment reason: [선택사항]
   ```

5. 배포 사유 입력 (선택사항):
   - 예: "Deploy batch timezone fix"
   - 예: "Deploy new feature v1.2"

6. **Run workflow** 버튼 클릭 (초록색)

7. 배포 진행 상황 모니터링 (약 3-5분)

#### Frontend 배포

1. **Actions** 탭에서 **Deploy Frontend to S3** 선택

2. **Run workflow** 클릭

3. 배포 사유 입력 (선택사항)

4. **Run workflow** 클릭

5. 배포 완료 대기 (약 2-3분)

---

## 📊 배포 확인

### Backend 확인

```bash
curl http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
```

예상 응답:
```json
{"status":"UP"}
```

### Frontend 확인

브라우저에서 접속:
```
http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
```

---

## 🎯 전체 워크플로우 예시

### 시나리오: 배치 시간대 수정 배포

```bash
# 1. 브랜치 생성
git checkout main
git pull origin main
git checkout -b fix/batch-timezone

# 2. 코드 수정
# backend/src/main/java/.../EntityHistoryCleanupScheduler.java 수정

# 3. 커밋 및 푸시
git add backend/
git commit -m "fix: Set Asia/Seoul timezone for batch scheduler"
git push origin fix/batch-timezone

# 4. GitHub에서 PR 생성
#    - 제목: "fix: Set Asia/Seoul timezone for batch scheduler"
#    - 설명: 배치가 새벽 2시(KST)에 실행되도록 시간대 수정

# 5. 코드 리뷰
#    - 변경사항 확인
#    - "Approve" 클릭

# 6. PR 병합
#    - "Merge pull request" 클릭
#    - "Confirm merge" 클릭

# 7. 배포
#    - Actions → Deploy Backend to AWS
#    - Run workflow 클릭
#    - Deployment reason: "Deploy batch timezone fix"
#    - Run workflow 실행

# 8. 확인
curl http://Kiosk-backend-env.../actuator/health
# {"status":"UP"} 확인
```

---

## 💡 팁과 모범 사례

### 1. 커밋 메시지 컨벤션

```bash
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 포맷팅 (기능 변경 없음)
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

### 2. 브랜치 네이밍

```bash
feature/기능명       # 새 기능
fix/버그명          # 버그 수정
hotfix/긴급수정     # 프로덕션 긴급 수정
refactor/리팩토링명  # 리팩토링
docs/문서명         # 문서 작업
```

### 3. PR 설명 템플릿

```markdown
## 변경 사항
-

## 테스트 방법
-

## 체크리스트
- [ ] 로컬 테스트 완료
- [ ] 빌드 성공
- [ ] 문서 업데이트 (필요시)
- [ ] 기존 테스트 통과
```

### 4. 배포 타이밍

**권장 배포 시간:**
- 업무 시간 중 (문제 발생 시 즉시 대응 가능)
- 사용자가 적은 시간대 (가능한 경우)

**피해야 할 시간:**
- 금요일 저녁 (주말 대응 어려움)
- 중요한 이벤트/세일 직전

---

## 🚨 문제 해결

### Q1: main에 직접 push가 되는데요?

**A:** Branch protection이 설정되지 않았습니다.
- Settings → Branches → Add branch protection rule 설정 필요

### Q2: PR 승인 없이 병합이 되네요?

**A:** Branch protection에서 "Require approvals" 설정 확인
- 최소 1명 이상의 승인 필요로 설정

### Q3: 배포 버튼이 안 보여요

**A:**
1. Actions 탭 확인
2. 왼쪽 메뉴에서 워크플로우 선택
3. 오른쪽 "Run workflow" 버튼이 보여야 함

### Q4: 긴급 배포가 필요한데 PR 프로세스가 너무 느려요

**방법 1: 빠른 PR 프로세스**
```bash
# 브랜치 생성, 수정, 커밋, 푸시
git checkout -b hotfix/urgent-fix
# 수정...
git add . && git commit -m "hotfix: Urgent fix" && git push origin hotfix/urgent-fix

# GitHub에서 PR 생성 → 본인이 즉시 승인 → 병합 → 배포
# 총 소요 시간: 약 5분
```

**방법 2: 수동 배포 (Branch protection 임시 해제)**
- Settings → Branches → 규칙 삭제
- main에 직접 push
- 수동 배포 실행
- 규칙 다시 설정

---

## ✅ 설정 완료 체크리스트

- [ ] Branch protection rules 설정 완료
- [ ] "Require a pull request before merging" 활성화
- [ ] "Require approvals" 최소 1명 설정
- [ ] 테스트 PR 생성 및 승인해보기
- [ ] 테스트 배포 실행해보기
- [ ] 배포 성공 확인
- [ ] 팀원들에게 새 프로세스 공유

---

## 🎊 장점 요약

1. **코드 품질 보장**: 모든 변경사항이 리뷰됨
2. **배포 안전성**: 배포 전 한 번 더 확인
3. **GitHub Free 호환**: 추가 비용 없음
4. **완전한 제어**: 배포 시점을 직접 결정
5. **명확한 이력**: PR과 배포 기록이 명확히 남음

---

**마지막 업데이트**: 2025-10-18
**버전**: v2.1 (Manual Deployment Trigger)
