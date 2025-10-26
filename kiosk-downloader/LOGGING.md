# Kiosk Downloader - Logging System

## 개요

키오스크 다운로더 앱은 주요 이벤트를 콘솔과 파일에 동시에 기록하는 로깅 시스템을 갖추고 있습니다.

## 로그 파일 위치

로그 파일은 애플리케이션 루트의 `logs/` 디렉토리에 저장됩니다:
```
kiosk-downloader/
├── logs/
│   ├── kiosk-events-2025-10-26-001.log  (첫 번째 실행)
│   ├── kiosk-events-2025-10-26-002.log  (두 번째 실행)
│   ├── kiosk-events-2025-10-27-001.log
│   └── ...
```

**중요**: 앱을 시작할 때마다 새로운 로그 파일이 생성되어 기존 로그를 덮어쓰지 않습니다.

## 로그 파일 형식

각 로그 항목은 다음 형식을 따릅니다:
```
[2025/10/26-23:30:45] [INFO] [SYNC_COMPLETED] 수동 영상 동기화 완료 - {"kioskId":"000000000001","videoCount":5}
```

구성 요소:
- **타임스탬프**: YYYY/MM/DD-HH:mm:ss 형식 (한국 표준시 KST, UTC+09:00)
- **로그 레벨**: INFO, WARN, ERROR
- **이벤트 타입**: 이벤트의 종류를 나타내는 상수
- **메시지**: 이벤트에 대한 설명
- **데이터**: JSON 형식의 추가 정보 (선택사항)

## 로그 레벨

### INFO
일반적인 작업 및 성공적인 이벤트
- 앱 시작/초기화
- 설정 저장
- 동기화 완료
- 다운로드 완료
- WebSocket 연결

### WARN
경고 또는 비정상적인 상황
- WebSocket 연결 끊김
- 재시도 가능한 오류

### ERROR
오류 및 실패
- 다운로드 실패
- WebSocket 오류
- 파일 시스템 오류

## 주요 이벤트 타입

### 애플리케이션 생명주기
- `APP_START`: 메인 프로세스 시작
- `APP_INIT`: 렌더러 프로세스 초기화
- `APP_EXIT`: 애플리케이션 종료

### 설정 관리
- `CONFIG_SAVED`: 설정 저장/수정
- `CONFIG_DELETED`: 설정 삭제
- `CONFIG_UPDATED`: 서버에서 설정 업데이트 알림
- `CONFIG_READ`: 설정 읽기

### 영상 동기화
- `SYNC_STARTED`: 수동 동기화 시작
- `AUTO_SYNC_STARTED`: 자동 동기화 시작
- `SYNC_COMPLETED`: 동기화 완료
- `SYNC_FAILED`: 동기화 실패

### 영상 다운로드
- `DOWNLOAD_STARTED`: 다운로드 시작
- `DOWNLOAD_COMPLETED`: 다운로드 완료
- `DOWNLOAD_FAILED`: 다운로드 실패
- `DOWNLOAD_PROGRESS`: 다운로드 진행 상황

### WebSocket 통신
- `WEBSOCKET_CONNECTED`: WebSocket 연결됨
- `WEBSOCKET_DISCONNECTED`: WebSocket 연결 끊김
- `WEBSOCKET_ERROR`: WebSocket 오류
- `WEBSOCKET_MESSAGE`: WebSocket 메시지 수신
- `SYNC_COMMAND_RECEIVED`: 관리자의 동기화 명령 수신

### 사용자 인증
- `USER_LOGIN_SUCCESS`: 로그인 성공
- `USER_LOGIN_FAILED`: 로그인 실패 (승인 대기, 계정 정지, 인증 오류 포함)
- `USER_LOGOUT`: 로그아웃

### 일반 오류
- `ERROR_GENERAL`: 일반적인 오류
- `ERROR_NETWORK`: 네트워크 오류
- `ERROR_FILE_SYSTEM`: 파일 시스템 오류

## 로그 파일 명명 규칙

- **기본 형식**: `kiosk-events-YYYY-MM-DD-NNN.log`
  - `YYYY-MM-DD`: 한국 표준시 기준 날짜
  - `NNN`: 해당 날짜의 순번 (001부터 시작)
- **새 파일 생성 조건**:
  1. 앱을 시작할 때마다 새로운 순번의 파일 생성
  2. 자정이 지나 날짜가 바뀌면 자동으로 새 파일 생성 (앱 재시작 불필요)
- **예시**:
  - 10월 26일 첫 실행: `kiosk-events-2025-10-26-001.log`
  - 10월 26일 두 번째 실행: `kiosk-events-2025-10-26-002.log`
  - 10월 26일 23:50에 시작 → 자정 지나면: `kiosk-events-2025-10-27-001.log` (자동 생성)

## 로그 로테이션

- **최대 파일 크기**: 10MB
- **로테이션 방식**: 파일이 10MB를 초과하면 순번이 추가된 이름으로 자동 백업
  - 예: `kiosk-events-2025-10-26-001-rotated-001.log`
- **로테이션 후**: 새로운 로그 파일이 자동으로 생성됩니다
- **시간대**: 모든 로그는 한국 표준시(KST, UTC+09:00)로 기록됩니다

## 사용 예시

### 코드에서 로깅하기

```javascript
// INFO 레벨 로그
await Logger.info(Logger.Events.SYNC_COMPLETED, '동기화 완료', {
  kioskId: '000000000001',
  videoCount: 5
});

await Logger.info(Logger.Events.USER_LOGIN_SUCCESS, '로그인 성공', {
  email: 'user@example.com',
  name: '홍길동',
  apiUrl: 'http://localhost:8080/api'
});

// WARN 레벨 로그
await Logger.warn(Logger.Events.WEBSOCKET_DISCONNECTED, 'WebSocket 연결 끊김', {
  reason: 'Network timeout'
});

await Logger.warn(Logger.Events.USER_LOGIN_FAILED, '로그인 실패: 승인 대기', {
  email: 'user@example.com',
  reason: 'PENDING_APPROVAL'
});

// ERROR 레벨 로그
await Logger.error(Logger.Events.DOWNLOAD_FAILED, '다운로드 실패', {
  videoId: 123,
  error: 'Network error'
});

await Logger.error(Logger.Events.USER_LOGIN_FAILED, '로그인 실패', {
  email: 'user@example.com',
  error: '이메일 또는 비밀번호가 올바르지 않습니다'
});
```

## 로그 파일 관리

### 수동 정리
오래된 로그 파일은 수동으로 삭제할 수 있습니다:
```bash
# 30일 이상 된 로그 파일 삭제 (Windows PowerShell)
Get-ChildItem -Path "logs" -Filter "*.log" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

### 로그 보기
```bash
# 오늘의 최신 로그 보기 (가장 큰 순번)
cat logs/kiosk-events-2025-10-26-003.log

# 오늘의 모든 로그 파일 보기
cat logs/kiosk-events-2025-10-26-*.log

# 특정 이벤트 검색 (오늘의 모든 로그)
grep "DOWNLOAD_FAILED" logs/kiosk-events-2025-10-26-*.log

# 실시간 로그 모니터링 (PowerShell, 최신 파일)
Get-Content logs/kiosk-events-2025-10-26-003.log -Wait -Tail 20

# 오늘의 로그 파일 목록 확인
dir logs/kiosk-events-2025-10-26-*.log
```

## 주의사항

1. **개인정보 보호**: 로그에 민감한 정보(비밀번호, 토큰 등)를 기록하지 마세요.
2. **디스크 공간**: 로그 파일이 디스크 공간을 차지하므로 주기적으로 정리하세요.
3. **성능**: 과도한 로깅은 성능에 영향을 줄 수 있습니다.

## 트러블슈팅

### 로그 파일이 생성되지 않는 경우
1. `logs/` 디렉토리 권한 확인
2. 디스크 공간 확인
3. 개발자 도구 콘솔에서 오류 메시지 확인

### 로그 파일이 너무 큰 경우
- 로테이션 설정이 정상 작동하는지 확인
- 불필요한 로깅을 줄이거나 로그 레벨 조정 고려
