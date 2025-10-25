# 키오스크 영상 다운로더

키오스크용 영상 파일을 자동으로 동기화하고 다운로드하는 Windows 데스크톱 애플리케이션입니다.

## 주요 기능

- **실시간 동기화 (MQTT)**: 웹 관리자가 설정을 변경하면 즉시 키오스크 앱에 푸시 알림
- **자동 동기화**: 설정된 간격(기본 12시간)마다 서버와 자동으로 영상 목록을 동기화
- **무인 운영 모드**: 모든 동작이 백그라운드에서 조용히 실행되며 콘솔 로그로만 기록
- **일괄 다운로드**: 모든 대기 중인 영상을 한 번에 다운로드
- **진행률 표시**: 실시간 다운로드 진행률 모니터링
- **오프라인 모드**: 네트워크 연결 없이도 기존 영상 관리 가능
- **자동 정렬**: 표시 순서에 따라 파일명 자동 생성 (001_영상제목.mp4)
- **상태 관리**: 다운로드 완료, 대기 중, 다운로드 중 상태 추적
- **필터링**: 상태별로 영상 목록 필터링

## 기술 스택

- **Electron**: 크로스 플랫폼 데스크톱 앱 프레임워크
- **JavaScript**: 애플리케이션 로직
- **HTML/CSS**: 사용자 인터페이스
- **Axios**: HTTP 클라이언트 (영상 다운로드)
- **Node.js**: 파일 시스템 작업
- **MQTT**: 실시간 메시지 브로커 (설정 푸시 알림)
- **Mosquitto**: MQTT 브로커

## 시스템 요구사항

- Windows 10 이상
- Node.js 18 이상 (개발 시에만 필요)
- 인터넷 연결 (영상 다운로드 시)
- Mosquitto MQTT 브로커 (실시간 동기화 사용 시)

## 설치 방법

### 개발 환경

1. 저장소 클론
```bash
git clone <repository-url>
cd kiosk-downloader
```

2. 의존성 설치
```bash
npm install
```

3. 개발 서버 실행
```bash
npm start
```

### Windows 설치 파일 빌드

```bash
npm run build:win
```

빌드가 완료되면 `dist/` 폴더에 설치 파일이 생성됩니다.

### MQTT 브로커 설치 (실시간 동기화용)

실시간 푸시 알림을 사용하려면 Mosquitto MQTT 브로커가 필요합니다.

#### Chocolatey로 설치 (권장)

```powershell
# PowerShell 관리자 권한으로 실행
choco install mosquitto
```

#### 수동 설치

1. [Mosquitto 다운로드](https://mosquitto.org/download/)에서 Windows 64비트 설치 파일 다운로드
2. 설치 완료 후 `C:\Program Files\mosquitto\` 폴더에 `mosquitto.conf` 생성:

```conf
listener 1883
allow_anonymous true
```

3. Mosquitto 서비스 시작:

```cmd
# 관리자 권한 명령 프롬프트
cd "C:\Program Files\mosquitto"
mosquitto install
net start mosquitto
```

4. Windows 방화벽에서 포트 1883 허용:

```powershell
netsh advfirewall firewall add rule name="Mosquitto MQTT" dir=in action=allow protocol=TCP localport=1883
```

더 자세한 설치 가이드는 루트 디렉토리의 `MQTT_SETUP.md` 파일을 참조하세요.

## 사용 방법

### 초기 설정

1. **서버 선택**:
   - 로컬 서버: `http://localhost:8080/api`
   - AWS 개발 서버
   - 커스텀 URL 입력

2. **매장 ID 입력**: 8자리 POS ID (예: 00000001)

3. **키오스크 ID 입력**: 12자리 키오스크 ID (예: 000000000001)
   - 키오스크 관리 시스템에서 확인 가능

4. **다운로드 경로 선택**: 영상을 저장할 폴더 선택
   - 기본값: `C:\Users\<사용자>\Downloads\KioskVideos`

5. **자동 동기화 설정**:
   - 자동 동기화 활성화
   - 동기화 간격 설정 (시간 단위, 기본 12시간)

6. **설정 저장**: "설정 저장" 버튼 클릭

### 실시간 동기화 (MQTT)

앱이 자동으로 MQTT 브로커에 연결됩니다. 웹 관리자가 설정을 변경하면:

1. **설정 변경 시**: 키오스크 앱이 자동으로 새 설정을 다운로드
2. **영상 할당 변경 시**: 키오스크 앱이 자동으로 영상 목록을 동기화
3. **무인 모드**: 모든 동작이 조용히 백그라운드에서 실행됨

개발자 도구(F12)에서 콘솔 로그를 확인할 수 있습니다:
```
[MQTT] Connected to broker (from main process)
[MQTT] Config update notification received: ...
[CONFIG SYNC] Configuration synchronized from server
[VIDEO SYNC] Automatic video synchronization completed
```

### 영상 다운로드

1. **영상 목록 동기화**: "영상 목록 동기화" 버튼 클릭
   - 서버에서 할당된 영상 목록을 가져옵니다
   - 이미 다운로드된 영상은 자동으로 감지됩니다

2. **전체 다운로드**: "전체 다운로드" 버튼으로 모든 대기 중인 영상 다운로드

3. **개별 다운로드**: 각 영상의 다운로드 버튼(⬇️)을 클릭

4. **자동 다운로드**: 동기화 시 대기 중인 영상을 자동으로 백그라운드에서 다운로드

### 영상 관리

- **필터링**: 전체, 대기 중, 다운로드 중, 완료로 필터링
- **삭제**: 다운로드된 영상의 삭제 버튼(🗑️)으로 파일 제거
- **재생**: 재생 버튼(▶️)으로 영상 미리보기
- **자동 정렬**: 영상은 표시 순서에 따라 `001_제목.mp4` 형식으로 저장

## 파일 구조

```
kiosk-downloader/
├── main.js              # Electron 메인 프로세스 (MQTT 클라이언트 포함)
├── preload.js           # IPC 보안 브리지
├── package.json         # 프로젝트 설정
├── config.json          # 사용자 설정 (자동 생성)
├── renderer/
│   ├── index.html      # 메인 UI
│   ├── app.js          # 애플리케이션 로직
│   └── styles.css      # 스타일시트
├── dist/               # 빌드 출력 (생성됨)
├── README.md
└── MQTT_SETUP.md       # MQTT 브로커 설치 가이드
```

## 주요 기능 설명

### 실시간 동기화 (MQTT Push)

- **즉시 반영**: 웹 관리자의 설정 변경이 키오스크에 즉시 반영
- **자동 연결**: 앱 시작 시 MQTT 브로커에 자동 연결
- **재연결**: 네트워크 끊김 시 자동으로 재연결 시도
- **무인 모드**: 사용자 알림 없이 조용히 백그라운드에서 동작
- **토픽 구독**:
  - `kiosk/{kioskid}/config/update`: 설정 변경 알림
  - `kiosk/{kioskid}/video/update`: 영상 할당 변경 알림

### 자동 동기화

- 설정된 간격(기본 12시간)마다 서버와 자동으로 동기화
- 새로운 영상이 할당되면 자동으로 목록에 추가
- 백그라운드에서 실행되어 사용자 작업 방해 없음
- 대기 중인 영상 자동 다운로드

### 오프라인 모드

- 네트워크 연결이 끊어져도 애플리케이션 계속 사용 가능
- 이미 다운로드된 영상은 오프라인에서도 확인 가능
- 연결 복구 시 자동으로 동기화 재개

### 무인 키오스크 모드

- **조용한 동작**: 모든 자동 작업이 화면 알림 없이 실행
- **로그 기록**: 개발자 도구(F12) 콘솔에서 모든 동작 확인 가능
- **이벤트 추적**: 모든 주요 이벤트가 서버에 기록됨
- **자동 복구**: 오류 발생 시 자동으로 재시도

### 파일명 규칙

다운로드된 영상은 다음 형식으로 저장됩니다:
```
001_환영영상.mp4
002_메뉴소개.mp4
003_프로모션.mp4
```

- 앞 3자리: 표시 순서 (000~999)
- 영상 제목: 특수문자는 언더스코어(_)로 치환
- 확장자: 원본 파일 확장자 유지

## 환경 변수

`config.json` 파일에 다음 설정이 저장됩니다:

```json
{
  "apiUrl": "http://localhost:8080/api",
  "posId": "00000001",
  "kioskId": "000000000001",
  "kioskNo": 1,
  "downloadPath": "C:\\Users\\Username\\Downloads\\KioskVideos",
  "autoSync": true,
  "syncInterval": 12,
  "lastSync": "2025-10-25T08:30:00.000Z"
}
```

## 문제 해결

### 연결 실패

- API URL이 올바른지 확인
- 네트워크 연결 상태 확인
- 방화벽 설정 확인
- "연결 테스트" 버튼으로 연결 확인

### 다운로드 실패

- 다운로드 경로에 쓰기 권한이 있는지 확인
- 디스크 공간이 충분한지 확인
- 영상 URL이 유효한지 확인

### MQTT 연결 실패

- Mosquitto 서비스가 실행 중인지 확인:
  ```cmd
  net start mosquitto
  ```
- 포트 1883이 열려 있는지 확인:
  ```cmd
  netstat -ano | findstr :1883
  ```
- 방화벽 설정 확인
- 개발자 도구(F12) 콘솔에서 MQTT 로그 확인

### 자동 동기화가 작동하지 않음

- 자동 동기화가 체크되어 있는지 확인
- API URL과 키오스크 ID가 올바르게 설정되었는지 확인
- 설정 저장 후 애플리케이션 재시작
- MQTT 브로커가 실행 중인지 확인

## 보안

- **Context Isolation**: 렌더러 프로세스는 격리된 환경에서 실행
- **Preload Script**: IPC 통신은 안전한 브리지를 통해서만 가능
- **No Node Integration**: 렌더러에서 직접 Node.js API 접근 불가
- **CSP**: Content Security Policy로 XSS 공격 방지
- **MQTT Security**: 로컬 네트워크에서만 접근 가능하도록 설정

## 개발

### 디버깅

개발 모드에서 실행하면 자동으로 DevTools가 열립니다:

```bash
NODE_ENV=development npm start
```

F12를 눌러 개발자 도구를 열면 콘솔 로그 확인 가능:
- `[CONFIG]`: 설정 관련 로그
- `[MQTT]`: MQTT 연결 및 메시지 로그
- `[VIDEO SYNC]`: 영상 동기화 로그
- `[DOWNLOAD]`: 다운로드 진행 상황 로그

### 빌드 설정

`package.json`의 `build` 섹션에서 빌드 옵션 수정 가능:

- **appId**: 애플리케이션 ID
- **productName**: 제품명
- **win.target**: Windows 인스톨러 형식 (nsis, portable 등)
- **nsis**: NSIS 인스톨러 옵션

## 라이선스

ISC

## 지원

문제가 발생하거나 기능 요청이 있으시면 이슈를 등록해주세요.

## 버전 히스토리

### 1.1.0 (2025-10-25)
- **MQTT 실시간 동기화 추가**: Mosquitto MQTT 브로커를 통한 실시간 푸시 알림
- **무인 키오스크 모드**: 모든 자동 작업이 조용히 백그라운드에서 실행
- **MQTT 통합**: 메인 프로세스에서 MQTT 클라이언트 관리
- **향상된 로깅**: 모든 동작을 콘솔 로그로 추적
- **자동 재연결**: MQTT 연결 끊김 시 자동 재연결
- **403 인증 오류 수정**: API 요청에 키오스크 인증 헤더 추가

### 1.0.0 (2025-10-20)
- 초기 릴리스
- 기본 다운로드 기능
- 자동 동기화
- 오프라인 모드
- 진행률 표시
