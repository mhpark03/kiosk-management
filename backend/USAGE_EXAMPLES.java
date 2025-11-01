// ===================================================
// 자동 이벤트 기록 사용 예시 (Usage Examples)
// ===================================================

// 1. 기본 사용 - Video Upload
// ==============================
// VideoController.java에 다음과 같이 적용:

@PostMapping("/upload")
@PreAuthorize("hasRole('ADMIN')")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_UPLOAD,
    description = "영상 업로드"
)
public ResponseEntity<?> uploadVideo(
        @RequestParam("file") MultipartFile file,
        @RequestParam("title") String title,
        @RequestParam("description") String description,
        Authentication authentication) {

    Video video = videoService.uploadVideo(file, userId, title, description);

    // 이벤트 기록은 자동으로 처리됨!
    // 기존의 entityHistoryService.recordVideoActivity(...) 호출 불필요

    // 응답에 id와 title을 포함하면 자동으로 추출됨
    return ResponseEntity.ok(Map.of(
        "id", video.getId(),
        "title", video.getTitle(),
        "video", video
    ));
}

// 2. 삭제 - Entity ID를 파라미터에서 추출
// =========================================

@DeleteMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_DELETE,
    description = "영상 삭제",
    entityIdParam = "id"  // 파라미터 이름 지정
)
public ResponseEntity<?> deleteVideo(@PathVariable Long id) {
    videoService.deleteVideo(id);
    return ResponseEntity.ok(Map.of("message", "Video deleted"));
}

// 3. 수정 - 에러 발생 시에도 기록
// ================================

@PatchMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.UPDATE,
    description = "영상 정보 수정",
    entityIdParam = "id",
    recordOnError = true  // 실패해도 기록
)
public ResponseEntity<?> updateVideo(
        @PathVariable Long id,
        @RequestParam("title") String title,
        @RequestParam("description") String description) {

    Video video = videoService.updateVideo(id, title, description);

    return ResponseEntity.ok(Map.of(
        "id", video.getId(),
        "title", video.getTitle()
    ));
}

// 4. Kiosk 생성
// =============

@PostMapping("/kiosks")
@PreAuthorize("hasRole('ADMIN')")
@RecordActivity(
    entityType = EntityHistory.EntityType.KIOSK,
    action = EntityHistory.ActionType.CREATE,
    description = "키오스크 생성"
)
public ResponseEntity<?> createKiosk(@RequestBody KioskRequest request) {
    Kiosk kiosk = kioskService.createKiosk(request);

    return ResponseEntity.ok(Map.of(
        "id", kiosk.getId(),
        "kioskid", kiosk.getKioskid()
    ));
}

// 5. Store 수정
// =============

@PatchMapping("/stores/{id}")
@PreAuthorize("hasRole('ADMIN')")
@RecordActivity(
    entityType = EntityHistory.EntityType.STORE,
    action = EntityHistory.ActionType.UPDATE,
    description = "스토어 정보 수정",
    entityIdParam = "id"
)
public ResponseEntity<?> updateStore(
        @PathVariable Long id,
        @RequestBody StoreRequest request) {

    Store store = storeService.updateStore(id, request);

    return ResponseEntity.ok(Map.of(
        "id", store.getId(),
        "name", store.getPosname()
    ));
}

// 6. User 비밀번호 변경
// ====================

@PostMapping("/users/change-password")
@RecordActivity(
    entityType = EntityHistory.EntityType.USER,
    action = EntityHistory.ActionType.PASSWORD_CHANGE,
    description = "비밀번호 변경"
)
public ResponseEntity<?> changePassword(
        @RequestBody ChangePasswordRequest request,
        Authentication authentication) {

    User user = userService.changePassword(authentication.getName(), request);

    return ResponseEntity.ok(Map.of(
        "id", user.getId(),
        "message", "Password changed successfully"
    ));
}

// 7. AI Content Upload
// ====================

@PostMapping("/ai/upload")
@PreAuthorize("hasRole('ADMIN')")
@RecordActivity(
    entityType = EntityHistory.EntityType.VIDEO,
    action = EntityHistory.ActionType.VIDEO_UPLOAD,
    description = "AI 콘텐츠 업로드"
)
public ResponseEntity<?> uploadAIContent(
        @RequestParam("file") MultipartFile file,
        @RequestParam("title") String title,
        @RequestParam("description") String description) {

    Video video = videoService.uploadAIContent(file, userId, title, description);

    return ResponseEntity.ok(Map.of(
        "id", video.getId(),
        "title", video.getTitle()
    ));
}

// ===================================================
// 중요 사항
// ===================================================

/**
 * 1. ResponseEntity 사용 필수
 *    - Map<String, Object> 형태의 body를 반환해야 자동 추출이 작동합니다
 *
 * 2. ID 추출 우선순위:
 *    - entityIdParam 지정 > 응답의 "id" 필드 > "videoId", "kioskId" 등
 *
 * 3. 값 추출:
 *    - title, name, filename, originalFilename 등이 자동 추출됩니다
 *
 * 4. 인증 필요:
 *    - Authentication이 없으면 이벤트가 기록되지 않습니다
 *
 * 5. 트랜잭션 독립:
 *    - REQUIRES_NEW로 별도 트랜잭션에서 실행됩니다
 *    - 메인 로직이 롤백되어도 이벤트는 기록됩니다
 *
 * 6. 에러 안전:
 *    - 이벤트 기록 실패 시 로그만 남기고 API는 정상 진행됩니다
 */

// ===================================================
// 기존 코드 마이그레이션 가이드
// ===================================================

/**
 * Before (기존 코드):
 * ------------------
 * @PostMapping("/upload")
 * public ResponseEntity<?> uploadVideo(...) {
 *     Video video = videoService.uploadVideo(...);
 *
 *     // 수동으로 이벤트 기록 (누락 위험!)
 *     entityHistoryService.recordVideoActivity(
 *         video.getId(),
 *         video.getTitle(),
 *         user,
 *         EntityHistory.ActionType.VIDEO_UPLOAD,
 *         "영상 업로드"
 *     );
 *
 *     return ResponseEntity.ok(Map.of("video", video));
 * }
 *
 *
 * After (자동 기록):
 * -----------------
 * @PostMapping("/upload")
 * @RecordActivity(
 *     entityType = EntityHistory.EntityType.VIDEO,
 *     action = EntityHistory.ActionType.VIDEO_UPLOAD,
 *     description = "영상 업로드"
 * )
 * public ResponseEntity<?> uploadVideo(...) {
 *     Video video = videoService.uploadVideo(...);
 *
 *     // entityHistoryService 호출 제거!
 *
 *     // 응답에 id, title 포함하면 자동 추출
 *     return ResponseEntity.ok(Map.of(
 *         "id", video.getId(),
 *         "title", video.getTitle(),
 *         "video", video
 *     ));
 * }
 */
