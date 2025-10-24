# Windows 앱 빌드 및 GitHub 릴리스 가이드

이 문서는 Kiosk Video Downloader의 새 버전을 빌드하고 GitHub에 릴리스하는 방법을 설명합니다.

## 목차
- [사전 준비](#사전-준비)
- [버전 업데이트](#버전-업데이트)
- [Windows 앱 빌드](#windows-앱-빌드)
- [GitHub 릴리스 생성](#github-릴리스-생성)
- [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 필수 도구 확인
1. **Node.js** (v18 이상)
   ```bash
   node --version
   ```

2. **npm** (v9 이상)
   ```bash
   npm --version
   ```

3. **Git**
   ```bash
   git --version
   ```

### 의존성 설치
```bash
cd kiosk-management/kiosk-downloader
npm install
```

---

## 버전 업데이트

### 1. package.json 버전 수정
`package.json` 파일의 `version` 필드를 업데이트합니다.

```json
{
  "name": "kiosk-downloader",
  "version": "1.1.0",  // 이전: "1.0.0"
  ...
}
```

**버전 번호 규칙 (Semantic Versioning):**
- **Major (X.0.0)**: 호환되지 않는 API 변경
- **Minor (1.X.0)**: 하위 호환되는 기능 추가
- **Patch (1.0.X)**: 하위 호환되는 버그 수정

### 2. 변경사항 커밋
```bash
git add package.json
git commit -m "Bump version to 1.1.0"
git push origin main
```

---

## Windows 앱 빌드

### 1. 빌드 실행
```bash
cd kiosk-management/kiosk-downloader
npm run build:win
```

빌드가 완료되면 다음 경로에 설치 프로그램이 생성됩니다:
```
kiosk-downloader/dist/Kiosk Video Downloader Setup X.X.X.exe
```

### 2. 빌드 결과 확인
```bash
ls -lh dist/*.exe
```

예상 출력:
```
-rwxr-xr-x 1 User 197121 73M 날짜 시간 dist/Kiosk Video Downloader Setup 1.1.0.exe
```

### 3. 로컬 테스트 (선택사항)
빌드된 설치 프로그램을 실행하여 정상 동작하는지 확인합니다:
1. `dist/Kiosk Video Downloader Setup X.X.X.exe` 실행
2. 설치 진행
3. 앱 실행 및 기능 테스트
4. 테스트 완료 후 제어판에서 제거

---

## GitHub 릴리스 생성

### 방법 1: GitHub CLI 사용 (권장)

#### 1. GitHub CLI 설치
- Windows: https://cli.github.com/ 에서 다운로드
- 설치 확인: `gh --version`

#### 2. GitHub 인증
```bash
gh auth login
```

#### 3. 릴리스 생성
```bash
cd kiosk-management

gh release create v1.1.0 \
  --title "Kiosk Video Downloader v1.1.0" \
  --notes-file kiosk-downloader/RELEASE_NOTES.md \
  kiosk-downloader/dist/"Kiosk Video Downloader Setup 1.1.0.exe"
```

### 방법 2: 웹 인터페이스 사용

#### 1. Git 태그 생성 및 푸시
```bash
cd kiosk-management
git tag -a v1.1.0 -m "Kiosk Video Downloader v1.1.0"
git push origin v1.1.0
```

#### 2. GitHub 릴리스 페이지 접속
브라우저에서 다음 URL 열기:
```
https://github.com/mhpark03/kiosk-management/releases/new?tag=v1.1.0
```

#### 3. 릴리스 정보 입력

**Release title:**
```
Kiosk Video Downloader v1.1.0
```

**Description 템플릿:**
```markdown
# Kiosk Video Downloader v1.1.0 🎬

## 새로운 기능
- [기능 1 설명]
- [기능 2 설명]

## 개선사항
- [개선사항 1]
- [개선사항 2]

## 버그 수정
- [수정된 버그 1]
- [수정된 버그 2]

## 설치 방법
1. 아래 **Assets**에서 `Kiosk Video Downloader Setup 1.1.0.exe` 다운로드
2. 다운로드한 파일 실행
3. 설치 위치 선택 (기본값 권장)
4. 바탕화면 바로가기를 통해 앱 실행

## 시스템 요구사항
- Windows 10 이상
- 최소 200MB의 여유 디스크 공간

---
📁 **파일 크기**: [파일 크기]
📅 **릴리스 날짜**: [날짜]
```

#### 4. 설치 프로그램 업로드
페이지 하단 "Attach binaries..." 영역에 파일 드래그 앤 드롭:
```
kiosk-downloader/dist/Kiosk Video Downloader Setup 1.1.0.exe
```

#### 5. 릴리스 게시
- **"Set as the latest release"** 체크 (최신 버전인 경우)
- **"Publish release"** 클릭

---

## 릴리스 노트 작성 가이드

릴리스 노트를 별도 파일로 관리하려면 `RELEASE_NOTES.md` 생성:

```markdown
# v1.1.0 릴리스 노트

## 🎉 주요 변경사항
- 새로운 기능 A 추가
- 성능 개선 B

## ✨ 새로운 기능
- **비디오 플레이어 개선**: 중앙 재생 버튼 추가
- **자동 동기화**: 앱 시작 시 자동으로 영상 목록 동기화

## 🐛 버그 수정
- 다운로드 진행률 표시 오류 수정
- 설정 저장 후 UI 업데이트 문제 해결

## 🔧 개선사항
- UI/UX 개선
- 에러 메시지 명확화

## 📦 전체 변경 로그
커밋 이력: https://github.com/mhpark03/kiosk-management/compare/v1.0.0...v1.1.0
```

---

## 빌드 설정 (package.json)

현재 빌드 설정은 다음과 같습니다:

```json
{
  "build": {
    "appId": "com.kiosk.downloader",
    "productName": "Kiosk Video Downloader",
    "win": {
      "target": "nsis",
      "icon": "android-chrome-512x512.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*",
      "config.json",
      "package.json"
    ],
    "directories": {
      "output": "dist"
    }
  }
}
```

---

## 트러블슈팅

### 문제: 아이콘 크기 오류
```
⨯ image icon.ico must be at least 256x256
```

**해결책:**
- 512x512 PNG 파일 사용 (권장)
- package.json에서 `"icon": "android-chrome-512x512.png"` 설정

### 문제: NSIS 캐시 오류
```
⨯ ENOENT: no such file or directory, copyfile ...nsis/elevate.exe
```

**해결책:**
```bash
# 잠시 대기 후 재시도
sleep 3
npm run build:win
```

또는 캐시 삭제:
```bash
# Windows
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache"

# Git Bash
rm -rf "$LOCALAPPDATA/electron-builder/Cache"
```

### 문제: 빌드 파일이 너무 큼
**해결책:**
- `files` 배열에서 불필요한 파일 제외
- `node_modules`는 자동으로 제외됨
- 개발용 파일은 빌드에 포함하지 않음

### 문제: 설치 프로그램 실행 시 바이러스 경고
**해결책:**
- 코드 서명 인증서 구매 및 적용 필요
- 무료 대안: 사용자에게 "추가 정보" → "실행" 안내

---

## 체크리스트

릴리스 전 확인사항:

- [ ] package.json 버전 업데이트
- [ ] 변경사항 커밋 및 푸시
- [ ] 빌드 성공 확인
- [ ] 로컬 테스트 완료
- [ ] 릴리스 노트 작성
- [ ] Git 태그 생성 및 푸시
- [ ] GitHub 릴리스 생성
- [ ] .exe 파일 업로드
- [ ] 릴리스 게시
- [ ] 다운로드 테스트

---

## 참고 자료

- [Electron Builder 문서](https://www.electron.build/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases 가이드](https://docs.github.com/en/repositories/releasing-projects-on-github)

---

## 문의

문제가 발생하면 GitHub Issues에 등록하거나 팀에 문의하세요.
