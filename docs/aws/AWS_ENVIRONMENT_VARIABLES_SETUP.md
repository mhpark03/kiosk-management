# AWS Elastic Beanstalk 환경 변수 설정 가이드

## 📋 개요

DB 비밀번호와 같은 민감한 정보를 코드에서 제거하고 AWS Elastic Beanstalk의 환경 변수로 관리합니다.

**변경 사항:**
- ✅ `application-dev.yml`, `application-prod.yml`에서 하드코딩된 비밀번호 제거
- ✅ 환경 변수 `${DB_PASSWORD}` 사용
- ✅ 로컬 개발: `.env` 파일 사용
- ✅ AWS 배포: Elastic Beanstalk 환경 변수 사용

---

## 🔐 필요한 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DB_URL` | 데이터베이스 URL | `jdbc:mysql://your-rds-endpoint.rds.amazonaws.com:3306/kioskdb` |
| `DB_USERNAME` | 데이터베이스 사용자명 | `admin` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | `your-db-password` |

---

## 🚀 AWS Elastic Beanstalk 설정 방법

### 방법 1: AWS Console 사용 (권장)

#### 1단계: EB 콘솔 접속

1. AWS Console 로그인
2. Elastic Beanstalk 서비스로 이동
3. 애플리케이션 `Kiosk-backend` 선택
4. 환경 `Kiosk-backend-env` 클릭

#### 2단계: 환경 변수 설정

1. 왼쪽 메뉴에서 **Configuration** 클릭
2. **Software** 카테고리에서 **Edit** 클릭
3. **Environment properties** 섹션으로 스크롤

#### 3단계: 변수 추가

다음 환경 변수를 추가:

```
DB_URL = jdbc:mysql://your-rds-endpoint.rds.amazonaws.com:3306/kioskdb
DB_USERNAME = admin
DB_PASSWORD = your-db-password
```

**주의사항:**
- 값에 공백이 들어가지 않도록 주의
- 따옴표 없이 입력
- 대소문자 정확히 일치

#### 4단계: 적용

1. 맨 아래로 스크롤
2. **Apply** 버튼 클릭
3. 환경이 업데이트될 때까지 대기 (약 2-3분)
4. 상태가 **Ok**(초록색)으로 변경되면 완료

---

### 방법 2: EB CLI 사용

```bash
cd backend

# 환경 변수 설정
eb setenv DB_URL="jdbc:mysql://your-rds-endpoint.rds.amazonaws.com:3306/kioskdb" \
          DB_USERNAME="admin" \
          DB_PASSWORD="your-db-password"

# 설정 확인
eb printenv
```

---

### 방법 3: .ebextensions 사용 (비권장)

`.ebextensions/01_environment.config`에 환경 변수 추가 가능하지만, 민감한 정보는 코드에 포함되므로 **권장하지 않습니다**.

---

## 💻 로컬 개발 환경 설정

### .env 파일 생성

```bash
cd backend

# .env 파일 생성 (이미 생성됨)
# backend/.env 파일에 다음 내용 추가:
```

`backend/.env` 내용:
```properties
# Database Configuration
DB_URL=jdbc:mysql://your-rds-endpoint.rds.amazonaws.com:3306/kioskdb
DB_USERNAME=admin
DB_PASSWORD=your-db-password

# JWT Configuration (optional)
# JWT_SECRET=your-secret-key
# JWT_EXPIRATION=86400000
```

### 로컬 실행

```bash
cd backend

# Spring Boot가 .env 파일을 자동으로 로드
SPRING_PROFILES_ACTIVE=dev ./gradlew.bat bootRun
```

---

## ✅ 설정 확인

### 1. AWS 환경 변수 확인

EB CLI 사용:
```bash
cd backend
eb printenv
```

예상 출력:
```
Environment Variables:
  DB_PASSWORD = your-db-password
  DB_URL = jdbc:mysql://your-rds-endpoint...
  DB_USERNAME = admin
  SPRING_PROFILES_ACTIVE = dev
```

AWS Console 사용:
1. Elastic Beanstalk → 환경 선택
2. Configuration → Software
3. Environment properties 섹션 확인

### 2. 애플리케이션 테스트

배포 후 Health Check:
```bash
curl http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/actuator/health
```

예상 응답:
```json
{"status":"UP"}
```

---

## 🔄 환경 변수 업데이트

### AWS 환경 변수 변경

1. AWS Console → Elastic Beanstalk → Configuration → Software → Edit
2. 변경할 환경 변수 수정
3. **Apply** 클릭
4. 환경이 자동으로 재시작됨

### 로컬 환경 변수 변경

`backend/.env` 파일을 직접 수정:
```properties
DB_PASSWORD=new-password
```

변경 후 애플리케이션 재시작 필요.

---

## 🚨 보안 주의사항

### Git 커밋 전 확인

```bash
# .env 파일이 Git에서 무시되는지 확인
git status

# .env 파일이 표시되면 안 됨!
# 만약 표시된다면:
git rm --cached backend/.env
```

### .gitignore 확인

`backend/.gitignore`에 다음이 포함되어 있어야 함:
```
.env
.env.local
.env.*.local
```

### GitHub Secrets 확인

AWS 자격 증명은 GitHub Secrets에 보관:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**절대로 코드에 포함하지 말 것!**

---

## 📊 환경별 설정 요약

| 환경 | DB 비밀번호 저장 위치 | 파일 |
|------|---------------------|------|
| **로컬 (local)** | `.env` 파일 | `application-local.yml` (H2 DB 사용) |
| **개발 (dev)** | EB 환경 변수 | `application-dev.yml` |
| **운영 (prod)** | EB 환경 변수 | `application-prod.yml` |

---

## 💡 팁

### 1. 환경 변수 우선순위

Spring Boot는 다음 순서로 환경 변수를 읽습니다:
1. 시스템 환경 변수 (AWS EB에서 설정한 값)
2. `.env` 파일 (로컬 개발)
3. `application.yml`의 기본값

### 2. 디버깅

환경 변수가 제대로 로드되지 않으면:
```bash
# 로그에서 확인
cd backend
./gradlew.bat bootRun

# 출력에서 "DB_URL" 검색
# 또는 애플리케이션 시작 시 로그 확인
```

### 3. 다른 환경 변수 추가

필요한 경우 다음 환경 변수도 추가 가능:
- `JWT_SECRET`: JWT 토큰 서명 키
- `JWT_EXPIRATION`: JWT 만료 시간
- `CORS_ALLOWED_ORIGINS`: CORS 허용 도메인

---

## 🔧 문제 해결

### Q1: 애플리케이션이 시작되지 않아요

**A:** 환경 변수가 제대로 설정되었는지 확인:
```bash
eb printenv
```

모든 필수 변수(`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`)가 있어야 합니다.

### Q2: 로컬에서 .env 파일이 로드되지 않아요

**A:** Spring Boot 2.4+ 버전에서는 자동으로 로드됩니다.
수동으로 로드하려면:
```bash
export $(cat backend/.env | xargs)
./gradlew.bat bootRun
```

### Q3: AWS에서 DB 연결이 안 돼요

**A:**
1. RDS 보안 그룹 확인
2. EB 환경 변수 확인
3. VPC 설정 확인

---

## 📝 체크리스트

배포 전 확인:

- [ ] `application-dev.yml`에 `${DB_PASSWORD}` 사용
- [ ] `application-prod.yml`에 `${DB_PASSWORD}` 사용
- [ ] `backend/.env` 파일 생성
- [ ] `.gitignore`에 `.env` 포함 확인
- [ ] AWS EB 환경 변수 설정 완료
- [ ] 로컬 테스트 성공
- [ ] AWS 배포 및 Health Check 성공

---

**마지막 업데이트**: 2025-10-18
**보안 강화**: DB 비밀번호 환경 변수로 이전 완료
