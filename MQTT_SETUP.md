# Mosquitto MQTT 브로커 설치 가이드

## Windows에 Mosquitto 설치

### 1. Mosquitto 다운로드 및 설치

1. Mosquitto 공식 사이트 방문: https://mosquitto.org/download/
2. Windows 64-bit 설치 파일 다운로드
3. 설치 실행 (기본 설치 경로: `C:\Program Files\mosquitto`)

또는 Chocolatey로 설치:
```bash
choco install mosquitto
```

### 2. Mosquitto 설정 파일 생성

설치 폴더에 `mosquitto.conf` 파일을 생성하거나 수정:

**C:\Program Files\mosquitto\mosquitto.conf**
```
# 기본 리스너 설정
listener 1883
protocol mqtt

# 익명 접속 허용 (개발용)
allow_anonymous true

# 로그 설정
log_dest file C:/Program Files/mosquitto/mosquitto.log
log_type all

# 연결 유지
max_keepalive 3600
```

### 3. Mosquitto 서비스 시작

**관리자 권한 CMD에서 실행:**

```cmd
# 서비스 설치
"C:\Program Files\mosquitto\mosquitto.exe" install

# 서비스 시작
net start mosquitto

# 서비스 상태 확인
sc query mosquitto
```

**또는 직접 실행 (테스트용):**
```cmd
cd "C:\Program Files\mosquitto"
mosquitto.exe -c mosquitto.conf -v
```

### 4. 방화벽 설정

Windows 방화벽에서 포트 1883 허용:
```cmd
netsh advfirewall firewall add rule name="Mosquitto MQTT" dir=in action=allow protocol=TCP localport=1883
```

### 5. 테스트

**터미널 1 (구독자):**
```cmd
cd "C:\Program Files\mosquitto"
mosquitto_sub -h localhost -t test/topic -v
```

**터미널 2 (발행자):**
```cmd
cd "C:\Program Files\mosquitto"
mosquitto_pub -h localhost -t test/topic -m "Hello MQTT"
```

터미널 1에서 메시지가 보이면 성공!

## 트러블슈팅

### 서비스가 시작되지 않는 경우
1. `mosquitto.log` 파일 확인
2. 설정 파일 경로가 올바른지 확인
3. 포트 1883이 다른 프로그램에서 사용 중인지 확인

### 포트 확인
```cmd
netstat -ano | findstr :1883
```

## 프로덕션 환경 설정 (선택사항)

프로덕션에서는 인증 추가 권장:

```
# mosquitto.conf
allow_anonymous false
password_file C:/Program Files/mosquitto/passwd
```

비밀번호 파일 생성:
```cmd
mosquitto_passwd -c "C:\Program Files\mosquitto\passwd" kioskuser
```
