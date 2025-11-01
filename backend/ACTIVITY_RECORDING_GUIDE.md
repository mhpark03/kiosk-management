# 자동 이벤트 기록 가이드 (Activity Recording Guide)

## 개요

Spring AOP를 사용하여 API 호출 시 자동으로 `entity_history` 테이블에 이벤트를 기록합니다.
`@RecordActivity` 어노테이션을 컨트롤러 메서드에 추가하면 별도의 코드 없이 자동으로 이벤트가 기록됩니다.

## 장점

1. **이벤트 누락 방지** - 개발자가 실수로 이벤트 기록을 빼먹을 위험이 없습니다
2. **코드 중복 제거** - 모든 컨트롤러에서 반복적으로 `entityHistoryService.recordXXX()` 호출할 필요가 없습니다
3. **선언적 방식** - 어노테이션만 추가하면 되므로 코드가 깔끔해집니다
4. **트랜잭션 독립성** - `REQUIRES_NEW`로 별도 트랜잭션에서 실행되어 메인 로직이 롤백되어도 이벤트는 기록됩니다
5. **에러 안전성** - 이벤트 기록이 실패해도 API 호출은 정상 작동합니다

## 사용법

### 1. 기본 사용

```java
@PostMapping("/upload")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_UPLOAD,
    description = "비디오 업로드"
)
public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file, ...) {
    // 비디오 업로드 로직
    return ResponseEntity.ok(Map.of("id", video.getId(), "title", video.getTitle()));
}
```

이렇게만 하면 자동으로:
- 현재 로그인한 사용자 정보 추출
- 응답에서 entity ID 자동 추출 (id, videoId, kioskId 등)
- 응답에서 title, name 등 자동 추출
- entity_history 테이블에 저장

### 2. 파라미터에서 entity ID 추출

```java
@DeleteMapping("/{id}")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_DELETE,
    description = "비디오 삭제",
    entityIdParam = "id"  // 파라미터 이름 지정
)
public ResponseEntity<?> deleteVideo(@PathVariable Long id) {
    videoService.deleteVideo(id);
    return ResponseEntity.ok(Map.of("message", "Deleted"));
}
```

### 3. 에러 발생 시에도 기록

```java
@PatchMapping("/{id}")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.UPDATE,
    description = "비디오 정보 수정",
    entityIdParam = "id",
    recordOnError = true  // 에러 발생 시에도 기록 (실패 기록 남김)
)
public ResponseEntity<?> updateVideo(@PathVariable Long id, ...) {
    // 업데이트 로직
}
```

### 4. 다양한 Entity Type 예시

```java
// 키오스크 생성
@PostMapping("/kiosks")
@RecordActivity(
    entityType = EntityHistory.EntityType.KIOSK,
    action = EntityHistory.ActionType.CREATE,
    description = "키오스크 생성"
)
public ResponseEntity<?> createKiosk(...) { ... }

// 스토어 수정
@PatchMapping("/stores/{id}")
@RecordActivity(
    entityType = EntityHistory.EntityType.STORE,
    action = EntityHistory.ActionType.UPDATE,
    description = "스토어 정보 수정",
    entityIdParam = "id"
)
public ResponseEntity<?> updateStore(@PathVariable Long id, ...) { ... }

// 사용자 비밀번호 변경
@PostMapping("/users/change-password")
@RecordActivity(
    entityType = EntityHistory.EntityType.USER,
    action = EntityHistory.ActionType.PASSWORD_CHANGE,
    description = "비밀번호 변경"
)
public ResponseEntity<?> changePassword(...) { ... }
```

## 자동 추출 동작

### Entity ID 자동 추출 우선순위

1. `entityIdParam`으로 지정된 파라미터 값
2. 응답 Map에서 `id` 필드
3. 응답 Map에서 `videoId`, `kioskId`, `storeId`, `userId` 필드
4. 응답 Map의 중첩 객체 (예: `video.id`)

### newValue 자동 추출

응답 Map에서 다음 필드를 자동으로 추출합니다:
- `title`
- `name`
- `filename`
- `originalFilename`
- 중첩 객체의 `title` (예: `video.title`)

## 기존 코드와의 비교

### Before (기존 방식)
```java
@PostMapping("/upload")
public ResponseEntity<?> uploadVideo(...) {
    Video video = videoService.uploadVideo(...);

    // 수동으로 이벤트 기록 (누락 위험)
    entityHistoryService.recordVideoActivity(
        video.getId(),
        video.getTitle(),
        user,
        EntityHistory.ActionType.VIDEO_UPLOAD,
        "비디오 업로드: " + video.getTitle()
    );

    return ResponseEntity.ok(Map.of("video", video));
}
```

### After (자동 기록 방식)
```java
@PostMapping("/upload")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_UPLOAD,
    description = "비디오 업로드"
)
public ResponseEntity<?> uploadVideo(...) {
    Video video = videoService.uploadVideo(...);
    return ResponseEntity.ok(Map.of("video", video));
    // 이벤트 자동 기록됨!
}
```

## 주의사항

1. **인증 필요**: 인증되지 않은 요청은 이벤트를 기록하지 않습니다
2. **ResponseEntity 권장**: 응답을 `ResponseEntity<?>` 형태로 반환해야 자동 추출이 잘 작동합니다
3. **Map body 권장**: 응답 body를 `Map<String, Object>` 형태로 반환하면 ID와 값을 자동 추출할 수 있습니다
4. **트랜잭션 독립**: 메인 로직이 롤백되어도 이벤트는 별도 트랜잭션(`REQUIRES_NEW`)에서 기록됩니다

## 로그 확인

이벤트 기록 성공 시 DEBUG 레벨 로그가 출력됩니다:
```
Activity recorded: VIDEO_UPLOAD - 비디오 업로드 by user@example.com (entityId: 123)
```

이벤트 기록 실패 시 ERROR 로그가 출력되지만, API 호출은 정상 작동합니다:
```
Failed to record activity for method: uploadVideo
```

## 어디에 적용해야 할까?

다음과 같은 API 메서드에 적용을 권장합니다:

✅ **반드시 적용**:
- 생성 (Create) - VIDEO_UPLOAD, CREATE
- 수정 (Update) - UPDATE, STATE_CHANGE
- 삭제 (Delete) - DELETE, VIDEO_DELETE
- 중요 작업 - PASSWORD_CHANGE, SUSPEND, ACTIVATE

❌ **적용하지 않음**:
- 조회 (Read) - getAllVideos, getVideoById 등
- Health check - /actuator/health
- 내부 API - WebSocket 이벤트 수신 등

## 문제 해결

### Q: 이벤트가 기록되지 않아요
A: 다음을 확인하세요:
1. 사용자가 인증되었는지 (로그인 상태)
2. ResponseEntity를 반환하는지
3. 응답 body에 ID나 title 정보가 포함되어 있는지
4. DEBUG 로그를 확인하여 어디서 실패했는지 확인

### Q: 커스텀 필드를 추출하고 싶어요
A: `ActivityRecordingAspect.java`의 `extractEntityId()` 또는 `extractNewValue()` 메서드를 수정하여 추가 필드를 지원할 수 있습니다.

### Q: 이벤트 기록이 실패하면 API도 실패하나요?
A: 아니오. 이벤트 기록 실패는 API 호출에 영향을 주지 않습니다. 에러 로그만 남기고 계속 진행됩니다.
