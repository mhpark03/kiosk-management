# 환경별 설정 가이드

이 프로젝트는 Spring Boot 프로파일을 사용하여 세 가지 환경을 지원합니다.

## 환경 종류

### 1. Local (로컬 개발 환경)
- **파일**: `application-local.yml`
- **데이터베이스**: localhost MySQL
- **접속 정보**:
  - URL: `jdbc:mysql://localhost:3306/kioskdb`
  - Username: `root`
  - Password: `aioztesting`
- **로그 레벨**: DEBUG

### 2. Dev (AWS 개발 서버)
- **파일**: `application-dev.yml`
- **데이터베이스**: AWS RDS MySQL
- **접속 정보**:
  - URL: `jdbc:mysql://kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com:3306/kioskdb`
  - Username: `admin`
  - Password: `aioztesting`
- **로그 레벨**: INFO

### 3. Prod (AWS 상용 서버)
- **파일**: `application-prod.yml`
- **데이터베이스**: AWS RDS MySQL (상용)
- **접속 정보**: 나중에 설정 예정
- **로그 레벨**: WARN
- **특징**:
  - `ddl-auto: validate` (데이터베이스 스키마 자동 변경 방지)
  - SQL 로깅 비활성화

## 사용 방법

### 방법 1: 환경 변수 사용 (권장)

#### Windows (PowerShell)
```powershell
# Local 환경
$env:SPRING_PROFILES_ACTIVE="local"
.\gradlew.bat bootRun

# Dev 환경
$env:SPRING_PROFILES_ACTIVE="dev"
.\gradlew.bat bootRun

# Prod 환경
$env:SPRING_PROFILES_ACTIVE="prod"
.\gradlew.bat bootRun
```

#### Windows (CMD)
```cmd
# Local 환경
set SPRING_PROFILES_ACTIVE=local
gradlew.bat bootRun

# Dev 환경
set SPRING_PROFILES_ACTIVE=dev
gradlew.bat bootRun
```

#### Git Bash
```bash
# Local 환경
export SPRING_PROFILES_ACTIVE=local
./gradlew.bat bootRun

# Dev 환경
export SPRING_PROFILES_ACTIVE=dev
./gradlew.bat bootRun
```

### 방법 2: 명령줄 인자 사용

```bash
# Local 환경
./gradlew.bat bootRun --args='--spring.profiles.active=local'

# Dev 환경
./gradlew.bat bootRun --args='--spring.profiles.active=dev'

# Prod 환경
./gradlew.bat bootRun --args='--spring.profiles.active=prod'
```

### 방법 3: 한 줄 명령어 (Git Bash - 권장)

```bash
# Local 환경
cd /c/claudtest/backend && SPRING_PROFILES_ACTIVE=local JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun

# Dev 환경
cd /c/claudtest/backend && SPRING_PROFILES_ACTIVE=dev JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun

# Prod 환경
cd /c/claudtest/backend && SPRING_PROFILES_ACTIVE=prod JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew.bat bootRun
```

## 기본 프로파일

설정하지 않으면 **local** 프로파일이 기본으로 활성화됩니다.
(`application.yml`의 `spring.profiles.active: ${SPRING_PROFILES_ACTIVE:local}` 참조)

## AWS EC2에서 실행 시

### Dev 환경으로 실행
```bash
# 환경 변수 설정 후 실행
export SPRING_PROFILES_ACTIVE=dev
./gradlew bootRun

# 또는 systemd 서비스로 실행 시 환境 파일에 추가
# /etc/systemd/system/kiosk-backend.service
[Service]
Environment="SPRING_PROFILES_ACTIVE=dev"
```

### Prod 환경으로 실행
```bash
export SPRING_PROFILES_ACTIVE=prod
./gradlew bootRun
```

## JAR 파일로 실행 시

```bash
# 빌드
./gradlew build

# Local 환경으로 실행
java -jar -Dspring.profiles.active=local build/libs/kiosk-backend-*.jar

# Dev 환경으로 실행
java -jar -Dspring.profiles.active=dev build/libs/kiosk-backend-*.jar

# Prod 환경으로 실행
java -jar -Dspring.profiles.active=prod build/libs/kiosk-backend-*.jar
```

## 확인 방법

애플리케이션 시작 시 로그에서 활성화된 프로파일을 확인할 수 있습니다:

```
The following 1 profile is active: "local"
```

또는

```
The following 1 profile is active: "dev"
```

## 주의사항

1. **Prod 환경**: 상용 서버 정보는 나중에 설정해야 합니다.
   - `application-prod.yml` 파일의 데이터베이스 접속 정보 업데이트 필요

2. **보안**: 실제 운영 환경에서는 비밀번호를 환경 변수로 관리하는 것을 권장합니다.
   ```yaml
   password: ${DB_PASSWORD:default-password}
   ```

3. **Git 저장소**: 민감한 정보가 포함된 설정 파일은 `.gitignore`에 추가하거나,
   환경 변수로 대체하는 것을 권장합니다.
