# AWS Elastic Beanstalk 메모리 최적화 가이드

## 현재 상황

**인스턴스**: t3.micro (1GB RAM)
**JVM 설정**: `-Xmx512m -Xms256m`
**문제**: 메모리 부족으로 인한 애플리케이션 불안정

---

## 🔍 메모리 사용 분석

### 현재 설정
```yaml
# .ebextensions/01_environment.config
JAVA_OPTS: '-Xmx512m -Xms256m'

# application.yml
datasource:
  hikari:
    maximum-pool-size: 5  # 이미 최적화됨
    minimum-idle: 2
```

### 메모리 사용 항목
1. **JVM Heap**: 512MB (최대)
2. **Metaspace**: ~100-150MB
3. **Thread Stack**: ~10-20MB per thread
4. **DB Connection Pool**: 5 connections
5. **Swagger/OpenAPI**: ~30-50MB
6. **Spring Boot Framework**: ~100-150MB
7. **AWS SDK**: ~50-80MB

**예상 총 메모리 사용량**: 800-950MB / 1024MB

---

## ⚠️ 발견된 문제점

### 1. Swagger/OpenAPI가 프로덕션에서 활성화됨
**메모리 영향**: ~30-50MB
**현재 상태**: 모든 프로파일에서 활성화
**해결방안**: 프로덕션에서 비활성화

### 2. 백업 파일이 소스에 포함됨
**파일**: `backend/src/main/java/com/kiosk/backend/service/UserService_new_signup.txt`
**해결방안**: 삭제

### 3. Actuator 엔드포인트 과다 노출
**메모리 영향**: ~10-20MB
**해결방안**: 필요한 엔드포인트만 활성화

### 4. JPA 2차 캐시 미사용
**해결방안**: Ehcache 추가 고려 (주의: 메모리 증가 가능)

---

## ✅ 즉시 적용 가능한 최적화

### 1. Swagger 프로덕션 비활성화 (우선순위: 높음)

**application-prod.yml 또는 application-dev.yml에 추가**:
```yaml
springdoc:
  api-docs:
    enabled: false  # OpenAPI JSON 생성 비활성화
  swagger-ui:
    enabled: false  # Swagger UI 비활성화
```

**예상 메모리 절감**: 30-50MB

### 2. Actuator 엔드포인트 제한 (우선순위: 중간)

**application-prod.yml에 추가**:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info  # 필요한 것만 노출
  endpoint:
    health:
      show-details: never  # 상세 정보 숨김
```

**예상 메모리 절감**: 10-20MB

### 3. 백업 파일 제거 (우선순위: 낮음)

```bash
rm backend/src/main/java/com/kiosk/backend/service/UserService_new_signup.txt
```

**예상 메모리 절감**: 무시 가능

### 4. JVM 메모리 튜닝 (우선순위: 중간)

**.ebextensions/01_environment.config 수정**:
```yaml
JAVA_OPTS: '-Xmx480m -Xms256m -XX:MaxMetaspaceSize=128m -XX:+UseG1GC'
```

**설명**:
- `-Xmx480m`: Heap 최대 크기를 512MB에서 480MB로 감소 (여유 공간 확보)
- `-XX:MaxMetaspaceSize=128m`: Metaspace 제한 (기본값은 무제한)
- `-XX:+UseG1GC`: G1 가비지 컬렉터 (저지연, 메모리 효율)

**예상 효과**: OOM 에러 감소

### 5. 로깅 레벨 최적화 (우선순위: 낮음)

**application-prod.yml에 이미 적용됨**:
```yaml
logging:
  level:
    com.kiosk.backend: WARN
    org.springframework.security: WARN
```

---

## 🚀 선택적 최적화 (추가 검토 필요)

### 옵션 1: Swagger 완전 제거 (프로덕션)

**build.gradle에서 조건부 의존성**:
```gradle
dependencies {
    // Swagger (dev/local only)
    if (project.hasProperty('profile') && profile != 'prod') {
        implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.3.0'
    }
}
```

**장점**: 메모리 50MB 절감
**단점**: 빌드 복잡도 증가

### 옵션 2: WebSocket 비활성화 (사용하지 않는 경우)

WebSocket이 **실제로 사용 중**이므로 비활성화 권장하지 않음.

### 옵션 3: 인스턴스 업그레이드

**t3.micro (1GB) → t3.small (2GB)**

**비용**: 월 $8.50 → $17.00 (약 2배)
**장점**: 메모리 문제 완전 해결
**단점**: 비용 증가

---

## 📋 적용 체크리스트

### 즉시 적용 (안전)
- [ ] Swagger 프로덕션 비활성화 (application-dev.yml)
- [ ] Actuator 엔드포인트 제한
- [ ] 백업 파일 제거
- [ ] Git에 커밋 및 배포

### 신중히 검토 후 적용
- [ ] JVM 메모리 설정 조정 (테스트 필요)
- [ ] Metaspace 제한 추가
- [ ] G1GC 활성화

### 장기 계획
- [ ] t3.small 인스턴스로 업그레이드 검토
- [ ] Redis 캐싱 도입 (읽기 부하 감소)
- [ ] CloudWatch 메모리 모니터링 알람 설정

---

## 🔧 적용 방법

### 1단계: 설정 파일 수정

```bash
# application-dev.yml 수정 (dev 프로파일용)
cat >> backend/src/main/resources/application-dev.yml <<EOF

# Swagger 비활성화 (메모리 절감)
springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false

# Actuator 제한
management:
  endpoints:
    web:
      exposure:
        include: health,info
EOF
```

### 2단계: 백업 파일 제거

```bash
git rm backend/src/main/java/com/kiosk/backend/service/UserService_new_signup.txt
```

### 3단계: 배포

```bash
git add .
git commit -m "Optimize memory usage for AWS EB"
git push origin main
```

### 4단계: EB 환경 변수 업데이트 (선택사항)

AWS EB Console에서:
```
JAVA_OPTS = -Xmx480m -Xms256m -XX:MaxMetaspaceSize=128m -XX:+UseG1GC
```

---

## 📊 예상 결과

### Before
```
Total Memory: 1024MB
JVM Heap:      512MB
Metaspace:     150MB
Swagger:        50MB
Other:         200MB
Free:          112MB (11%)  ← 부족!
```

### After
```
Total Memory: 1024MB
JVM Heap:      480MB
Metaspace:     128MB (제한됨)
Swagger:         0MB (비활성화)
Other:         200MB
Free:          216MB (21%)  ← 여유!
```

**예상 메모리 절감**: 약 100MB (10%)

---

## 🔍 모니터링

### CloudWatch 메트릭 확인

```bash
# AWS CLI로 메모리 사용률 확인
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElasticBeanstalk \
  --metric-name EnvironmentHealth \
  --dimensions Name=EnvironmentName,Value=kiosk-backend-prod-v2 \
  --start-time 2024-11-05T00:00:00Z \
  --end-time 2024-11-06T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### 로그 확인

```bash
# EB 로그 다운로드
eb logs --all
```

OutOfMemoryError 발생 시:
```
java.lang.OutOfMemoryError: Java heap space
```

---

## 🆘 긴급 대응

메모리 부족으로 애플리케이션이 다운된 경우:

### 1. 즉시 재시작
```bash
aws elasticbeanstalk restart-app-server \
  --environment-name kiosk-backend-prod-v2 \
  --region ap-northeast-2
```

### 2. 임시 메모리 증가
EB Console에서 JAVA_OPTS 수정:
```
JAVA_OPTS = -Xmx400m -Xms256m
```

### 3. 인스턴스 업그레이드 (최후의 수단)
```bash
eb scale 1 --instance-type t3.small
```

---

## 📚 참고 자료

- [Spring Boot Memory Tuning](https://spring.io/blog/2015/12/10/spring-boot-memory-performance)
- [AWS EB Java Configuration](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/java-se-platform.html)
- [JVM Memory Parameters](https://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html)
- [Springdoc Configuration](https://springdoc.org/#properties)

---

**마지막 업데이트**: 2024-11-05
**작성자**: Claude Code Assistant
