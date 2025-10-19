# GitHub Actions 배포 승인 설정 가이드

이 문서는 GitHub Actions를 통한 AWS 배포 시 승인 단계를 설정하는 방법을 설명합니다.

## 개요

현재 프로젝트는 `main` 브랜치에 코드를 푸시하면 자동으로 AWS에 배포됩니다. 승인 단계를 추가하여 배포 전 검토를 거치도록 설정할 수 있습니다.

## 워크플로우 설정 (완료됨)

다음 워크플로우 파일에 `environment: production` 설정이 추가되었습니다:

- `.github/workflows/deploy-backend.yml` - Backend 배포
- `.github/workflows/deploy-frontend.yml` - Frontend 배포

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: <배포 URL>
```

## GitHub 웹사이트에서 Environment 설정하기

### 1. GitHub 레포지토리 페이지 접속

프로젝트의 GitHub 레포지토리로 이동합니다.

### 2. Settings 메뉴 이동

레포지토리 상단 메뉴에서 **Settings** 클릭

### 3. Environments 메뉴 선택

왼쪽 사이드바에서 **Environments** 클릭

### 4. Production Environment 생성

- **"New environment"** 버튼 클릭
- Environment name: `production` 입력
- **"Configure environment"** 클릭

### 5. Environment Protection Rules 설정

#### Required reviewers (필수)

1. **"Required reviewers"** 체크박스 선택
2. 승인자의 GitHub 사용자명 입력 (최대 6명)
3. 본인 또는 팀원의 계정 추가

**이 설정만으로 승인 단계가 작동합니다!**

#### Deployment branches and tags (선택사항)

> **참고**: 이 옵션은 GitHub 플랜에 따라 표시되지 않을 수 있습니다. 표시되지 않아도 승인 기능은 정상 작동합니다.

만약 "Deployment branches and tags" 옵션이 보인다면:

1. 드롭다운 클릭
2. **"Selected branches and tags"** 선택
3. **"Add deployment branch or tag rule"** 클릭
4. Branch name pattern: `main` 입력
5. **"Add rule"** 클릭

이렇게 하면 `main` 브랜치에서만 production 환경으로 배포할 수 있습니다.

#### Wait timer (선택사항)

- 승인 전 의무 대기 시간 설정 (예: 5분)
- 급한 배포를 방지하고 검토 시간 확보
- 이 옵션도 플랜에 따라 표시되지 않을 수 있음

### 6. 설정 저장

- **"Save protection rules"** 버튼 클릭

## 배포 승인 워크플로우

### 배포가 시작되면

1. 개발자가 `main` 브랜치에 코드 푸시
2. GitHub Actions 워크플로우 자동 시작
3. 빌드 및 패키징 완료 후 **배포 전 일시 중지**
4. 워크플로우 상태: **"Waiting for approval"**

### 승인자에게 알림

- 지정된 검토자에게 GitHub 알림 전송
- 이메일 알림 (설정에 따라)

### 승인 또는 거부

1. GitHub 레포지토리 > **Actions** 탭 이동
2. 대기 중인 워크플로우 클릭
3. 노란색 **"Review deployments"** 버튼 클릭
4. 배포 정보 확인 (커밋 메시지, 변경 내역 등)
5. 선택:
   - **"Approve and deploy"** - 배포 승인 및 진행
   - **"Reject"** - 배포 거부 및 워크플로우 취소
6. 선택 사항: 승인/거부 사유 작성
7. **"Approve deployments"** 또는 **"Reject deployments"** 클릭

### 승인 후

- 승인 시: 배포가 계속 진행되어 AWS에 배포 완료
- 거부 시: 워크플로우가 즉시 취소되고 배포되지 않음

## 승인 확인 방법

### Actions 페이지에서

- **Actions** 탭 > 워크플로우 클릭
- **"Deployment"** 섹션에서 승인 기록 확인
- 누가, 언제 승인/거부했는지 표시

### Environments 페이지에서

- **Environments** 메뉴 > **production** 클릭
- 배포 히스토리 및 승인 기록 확인

## 주의사항

### workflow_dispatch (수동 실행)

워크플로우를 수동으로 실행할 때도 동일하게 승인이 필요합니다:

1. **Actions** 탭 이동
2. 워크플로우 선택 (Deploy Backend 또는 Deploy Frontend)
3. **"Run workflow"** 버튼 클릭
4. 브랜치 선택 및 배포 사유 입력
5. **"Run workflow"** 클릭
6. 승인 대기 후 승인 필요

### 긴급 배포

긴급하게 배포해야 하는 경우:

1. 승인자가 즉시 **Actions** 페이지에서 승인
2. Wait timer가 설정되어 있다면 대기 시간 경과 후 승인 가능
3. 긴급 상황을 대비해 복수의 승인자 설정 권장

### 롤백

잘못된 배포가 승인된 경우:

1. 이전 버전의 커밋으로 되돌리기 (git revert 또는 git reset)
2. `main` 브랜치에 푸시
3. 새로운 배포 워크플로우 시작
4. 승인 후 이전 버전으로 롤백 완료

## 보안 고려사항

- **승인자는 신뢰할 수 있는 팀원으로만 지정**
- 본인이 작성한 코드를 본인이 승인하는 것을 피하려면 최소 2명 이상의 승인자 설정
- Production 환경의 Secrets 접근은 승인된 배포에만 허용

## 참고

- GitHub Docs: [Using environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- GitHub Docs: [Reviewing deployments](https://docs.github.com/en/actions/managing-workflow-runs/reviewing-deployments)
