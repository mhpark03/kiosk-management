# 사용자를 ADMIN으로 업그레이드하는 방법

## 상황
첫 번째로 가입한 사용자가 USER 역할을 받아서 관리 페이지에 접근할 수 없습니다.

## 방법 1: H2 Console에서 직접 변경 (빠름!)

### 1. H2 Console 접속

백엔드가 실행 중일 때 브라우저에서:
```
http://Kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/h2-console
```

또는 로컬에서 백엔드 실행 중이면:
```
http://localhost:8080/h2-console
```

### 2. 로그인 정보 입력

- **JDBC URL**: `jdbc:h2:mem:kioskdb`
- **User Name**: `sa`
- **Password**: (비워두기)

### 3. SQL 실행

먼저 사용자 목록 확인:
```sql
SELECT * FROM users;
```

본인 이메일을 확인한 후, role을 ADMIN으로 변경:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = '본인이메일@example.com';
```

예:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'test@test.com';
```

### 4. 확인
```sql
SELECT email, display_name, role FROM users;
```

### 5. 프론트엔드에서 재로그인

브라우저를 완전히 닫고 다시 로그인하면 ADMIN 권한으로 접속됩니다!

---

## 방법 2: 백엔드 재시작 후 재가입

### 1. 데이터베이스 초기화

H2 인메모리 DB를 사용중이므로, 백엔드를 재시작하면 모든 데이터가 삭제됩니다.

### 2. 백엔드 재시작

AWS Elastic Beanstalk에서:
```bash
eb deploy
```

또는 로컬에서:
```bash
# Ctrl+C로 중지 후 재시작
cd C:\claudtest\backend
./gradlew bootRun
```

### 3. 새로 회원가입

첫 번째로 가입하는 사용자는 자동으로 ADMIN이 됩니다!

---

## ⚠️ 참고사항

### H2 인메모리 DB의 특성
- 백엔드 재시작 시 모든 데이터 삭제
- 키오스크, 스토어, 히스토리 등 모든 데이터가 사라짐

### 프로덕션 환경 권장사항
나중에 RDS (MySQL/PostgreSQL)로 마이그레이션하면:
- 데이터가 영구 보존됨
- 백엔드 재시작해도 데이터 유지됨

---

## 빠른 SQL 복사

### 모든 사용자를 ADMIN으로 변경
```sql
UPDATE users SET role = 'ADMIN';
```

### 특정 이메일만 ADMIN으로 변경
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'YOUR_EMAIL@example.com';
```

### 첫 번째 사용자를 ADMIN으로 변경
```sql
UPDATE users SET role = 'ADMIN' WHERE id = (SELECT MIN(id) FROM users);
```
