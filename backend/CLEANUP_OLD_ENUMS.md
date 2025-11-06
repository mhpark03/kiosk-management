# 데이터베이스 구 Enum 값 정리 가이드

## 개요

이전 버전에서 사용하던 `RUNWAY_GENERATED`와 `VEO_GENERATED` enum 값을 정리하는 가이드입니다.
현재 시스템에서는 이들이 `AI_GENERATED`로 통합되었습니다.

**⚠️ 주의**: `AI_GENERATED`는 현재 사용 중인 타입이므로 삭제하지 않습니다!

## 방법 1: SQL 스크립트 실행 (권장)

### 1단계: 데이터베이스 연결

```bash
# AWS RDS에 연결 (개발/프로덕션 환경)
mysql -h kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com \
      -u admin \
      -p \
      kioskdb

# 또는 로컬 환경
mysql -u root -p kioskdb
```

### 2단계: 현재 상태 확인

```sql
-- 현재 video_type 분포 확인
SELECT video_type, COUNT(*) as count
FROM videos
GROUP BY video_type;

-- 삭제 대상 확인
SELECT id, title, video_type, original_filename
FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED');
```

### 3단계: 백업 (선택사항 - 안전을 위해 권장)

```bash
# 전체 데이터베이스 백업
mysqldump -h kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com \
          -u admin \
          -p \
          kioskdb > backup_before_cleanup_$(date +%Y%m%d).sql
```

### 4단계: 삭제 실행

```sql
-- RUNWAY_GENERATED 삭제
DELETE FROM videos WHERE video_type = 'RUNWAY_GENERATED';

-- VEO_GENERATED 삭제
DELETE FROM videos WHERE video_type = 'VEO_GENERATED';
```

### 5단계: 결과 확인

```sql
-- 삭제 후 상태 확인
SELECT video_type, COUNT(*) as count
FROM videos
GROUP BY video_type;

-- 구 enum 값이 남아있는지 확인 (0이어야 함)
SELECT COUNT(*) as remaining_old_enums
FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED');
```

## 방법 2: 준비된 SQL 스크립트 실행

```bash
cd backend

# 스크립트 검토 (실행 전 반드시 확인!)
cat cleanup_old_video_types.sql

# 실행
mysql -h kiosk-db.cj0k46yy6vv6.ap-northeast-2.rds.amazonaws.com \
      -u admin \
      -p \
      kioskdb < cleanup_old_video_types.sql
```

**참고**: 기본 스크립트는 안전을 위해 조회만 수행합니다.
실제 삭제를 위해서는 파일 내 DELETE 문의 주석을 해제해야 합니다.

## 방법 3: Python 스크립트 실행

```bash
cd backend

# 의존성 설치
pip3 install pymysql

# 실행 (환경 변수로 비밀번호 전달)
DB_PASSWORD=your_password python3 cleanup_old_enum_values.py
```

스크립트는 대화형으로 실행되며, 삭제 전 확인을 요청합니다.

## 예상 결과

### 정리 전
```
video_type          | count
--------------------|------
UPLOAD              | 15
AI_GENERATED        | 8
RUNWAY_GENERATED    | 3   ← 삭제 대상
VEO_GENERATED       | 2   ← 삭제 대상
```

### 정리 후
```
video_type          | count
--------------------|------
UPLOAD              | 15
AI_GENERATED        | 8   ← 유지됨 (현재 사용 중)
```

## 문제 해결

### "Access denied" 오류
- DB_PASSWORD 환경 변수가 올바른지 확인
- AWS RDS 보안 그룹에서 현재 IP가 허용되었는지 확인

### "Table doesn't exist" 오류
- 데이터베이스 이름이 `kioskdb`인지 확인
- 연결된 데이터베이스를 `USE kioskdb;`로 명시

### 구 enum 값이 없는 경우
```
✓ No old enum values found. Database is clean!
```

이 메시지가 표시되면 정리가 필요하지 않습니다.

## 보안 참고사항

- 데이터베이스 비밀번호는 절대 코드에 커밋하지 마세요
- 환경 변수 또는 AWS Secrets Manager를 사용하세요
- 프로덕션 데이터베이스 작업 전 반드시 백업하세요

## 참고 문서

- [CLAUDE.md](../CLAUDE.md) - 프로젝트 전체 가이드
- [Video.java](src/main/java/com/kiosk/backend/entity/Video.java) - 현재 enum 정의
