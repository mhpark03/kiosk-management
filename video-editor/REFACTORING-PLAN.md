# Video Editor app.js 리팩토링 계획

## 📊 현재 상태 분석

### 파일 크기
- **app.js**: 11,921줄 (약 330KB)
- **총 함수 수**: 215개

### 기존 모듈화 현황 ✅
이미 분리된 모듈들 (in `renderer/modules/`):
- `PreviewManager.js` (11KB) - 비디오 미리보기 관리
- `auth.js` (8KB) - 인증 및 로그인
- `imagen.js` (5KB) - Imagen AI 이미지 생성
- `runway.js` (32KB) - Runway AI 이미지 생성
- `tts.js` (17KB) - TTS 음성 생성
- `veo.js` (41KB) - Veo AI 비디오 생성
- `module-loader.js` (4KB) - 모듈 로더

**Total**: 약 120KB가 이미 모듈로 분리됨

---

## 🎯 분리 가능한 모듈 (우선순위별)

### 우선순위 1: 🔥 크고 독립적인 기능

#### 1. **VideoOperations.js** (약 2,500줄 예상)
**포함 기능:**
- Video import (52개 함수)
- Video info display
- Video loading
- Timeline management
- Playhead control

**주요 함수:**
- `importVideo()` - 비디오 가져오기
- `loadVideo()` - 비디오 로드
- `loadVideoWithAudioCheck()` - 오디오 체크하며 로드
- `displayVideoInfo()` - 비디오 정보 표시
- `setupPlayheadInteraction()` - 재생 헤드 인터랙션

**라인 범위:** 약 1885-4000

---

#### 2. **AudioOperations.js** (약 2,000줄 예상)
**포함 기능:**
- Audio import (60개 함수)
- Audio file handling
- Audio waveform generation
- Audio track interaction
- Audio preview

**주요 함수:**
- `importAudioFile()` - 오디오 파일 가져오기
- `generateAndDisplayWaveform()` - 웨이브폼 생성
- `setupAudioTrackInteraction()` - 오디오 트랙 인터랙션
- `executeExtractAudio()` - 오디오 추출
- `executeExtractAudioToS3()` - 오디오 S3 업로드

**라인 범위:** 약 4700-6500

---

#### 3. **TrimOperations.js** (약 1,500줄 예상)
**포함 기능:**
- Video trim (20개 함수)
- Audio trim
- Range selection
- Preview trim range
- Delete range

**주요 함수:**
- `executeTrim()` - 트림 실행
- `executeTrimVideoOnly()` - 비디오만 트림
- `executeTrimAudioOnly()` - 오디오만 트림
- `executeDeleteRange()` - 범위 삭제
- `updateTrimRangeOverlay()` - 트림 범위 오버레이 업데이트

**섹션:**
- General trim: 3544-3762
- Video-only trim: 3762-4023
- Audio-only trim: 4023-4319

---

#### 4. **MergeOperations.js** (약 1,000줄 예상)
**포함 기능:**
- Video merge (20개 함수)
- Audio merge
- File list management
- Transition effects
- Preview merge

**주요 함수:**
- `addVideoToMerge()` - 병합 리스트에 비디오 추가
- `executeMerge()` - 병합 실행
- `previewMerge()` - 병합 미리보기
- `updateMergeFileList()` - 파일 리스트 업데이트
- `updateTransitionDescription()` - 트랜지션 설명

**라인 범위:** 약 4319-4733

---

#### 5. **TextOperations.js** (약 1,200줄 예상)
**포함 기능:**
- Text overlay (18개 함수)
- Font management
- Color picker
- Text positioning
- Text preview

**주요 함수:**
- `executeAddText()` - 텍스트 추가
- `updateTextOverlay()` - 텍스트 오버레이 업데이트
- `updateTextColorPreview()` - 색상 미리보기
- `loadColorHistory()` - 색상 히스토리
- `updateTextAlignPreview()` - 정렬 미리보기

**라인 범위:** 약 2824-3400, 5396-5469

---

### 우선순위 2: 📦 중간 크기 유틸리티

#### 6. **WaveformManager.js** (약 800줄 예상)
**포함 기능:**
- Waveform generation (7개 함수)
- Waveform zoom
- Waveform rendering
- Zoom debouncing

**주요 함수:**
- `generateAndDisplayWaveform()` - 웨이브폼 생성
- `applyWaveformZoom()` - 줌 적용
- `applyWaveformZoomDebounced()` - 디바운스된 줌
- `updateZoomRangeOverlay()` - 줌 범위 오버레이

**라인 범위:** 약 2090-2700

---

#### 7. **FilterOperations.js** (약 600줄 예상)
**포함 기능:**
- Video filters (brightness, contrast, saturation, blur, sharpen)
- Filter preview
- Filter execution

**주요 함수:**
- `executeFilter()` - 필터 적용
- `previewVideoVolume()` - 볼륨 미리보기

**라인 범위:** 약 5282-5396

---

#### 8. **SpeedOperations.js** (약 400줄 예상)
**포함 기능:**
- Video speed adjustment
- Audio speed adjustment
- Speed preview

**주요 함수:**
- `executeSpeedAdjust()` - 속도 조정
- `previewSpeedChange()` - 속도 미리보기
- `executeAudioSpeedAdjust()` - 오디오 속도 조정

**라인 범위:** 약 5469-5619

---

#### 9. **UploadOperations.js** (약 800줄 예상)
**포함 기능:**
- S3 upload (20개 함수)
- Audio file upload
- Duplicate check
- Progress tracking

**주요 함수:**
- `uploadAudioToS3()` - 오디오 S3 업로드
- `selectAudioFileForUpload()` - 업로드할 파일 선택
- `executeUploadToS3()` - S3 업로드 실행

**라인 범위:** 약 11632-12000

---

#### 10. **UIHelpers.js** (약 600줄 예상)
**포함 기능:**
- Dialog management
- Progress display
- Status updates
- Tool properties display
- Mode switching

**주요 함수:**
- `showCustomDialog()` - 커스텀 다이얼로그
- `showProgress()` - 진행 상태 표시
- `updateStatus()` - 상태 업데이트
- `showToolProperties()` - 도구 속성 패널

**라인 범위:** 분산됨 (58-200, 5624-5652)

---

### 우선순위 3: 🔧 소규모 유틸리티

#### 11. **TimelineHelpers.js** (약 400줄)
- Range overlay updates
- Duration display
- Time formatting

#### 12. **PreviewHelpers.js** (약 300줄)
- Preview functions
- Preview control (start, end, range)

---

## 📐 리팩토링 구조

### 최종 디렉토리 구조
```
video-editor/renderer/
├── app.js (2,000줄 목표 - 83% 감소)
│   ├── State management
│   ├── Initialization
│   ├── Setup functions
│   └── Tool selection
│
├── modules/
│   ├── core/ (핵심 기능)
│   │   ├── VideoOperations.js      (2,500줄)
│   │   ├── AudioOperations.js      (2,000줄)
│   │   ├── TrimOperations.js       (1,500줄)
│   │   ├── MergeOperations.js      (1,000줄)
│   │   ├── TextOperations.js       (1,200줄)
│   │   └── PreviewManager.js       (✅ 이미 존재)
│   │
│   ├── utilities/ (유틸리티)
│   │   ├── WaveformManager.js      (800줄)
│   │   ├── FilterOperations.js     (600줄)
│   │   ├── SpeedOperations.js      (400줄)
│   │   ├── UploadOperations.js     (800줄)
│   │   ├── UIHelpers.js            (600줄)
│   │   ├── TimelineHelpers.js      (400줄)
│   │   └── PreviewHelpers.js       (300줄)
│   │
│   └── ai/ (AI 기능 - ✅ 이미 분리됨)
│       ├── auth.js                 (✅ 8KB)
│       ├── tts.js                  (✅ 17KB)
│       ├── imagen.js               (✅ 5KB)
│       ├── runway.js               (✅ 32KB)
│       ├── veo.js                  (✅ 41KB)
│       └── module-loader.js        (✅ 4KB)
│
└── styles.css
```

---

## 🚀 실행 계획

### Phase 1: 핵심 기능 분리 (3-4시간)
1. **VideoOperations.js** 생성 및 이동
2. **AudioOperations.js** 생성 및 이동
3. **TrimOperations.js** 생성 및 이동
4. **MergeOperations.js** 생성 및 이동
5. **TextOperations.js** 생성 및 이동

### Phase 2: 유틸리티 분리 (2-3시간)
6. **WaveformManager.js** 생성 및 이동
7. **FilterOperations.js** 생성 및 이동
8. **SpeedOperations.js** 생성 및 이동
9. **UploadOperations.js** 생성 및 이동
10. **UIHelpers.js** 생성 및 이동

### Phase 3: 헬퍼 분리 (1-2시간)
11. **TimelineHelpers.js** 생성 및 이동
12. **PreviewHelpers.js** 생성 및 이동

### Phase 4: 통합 및 테스트 (2-3시간)
13. Module loader 업데이트
14. Import 문 정리
15. 전체 기능 테스트
16. 디버깅 및 수정

---

## 📋 모듈화 원칙

### 1. 단일 책임 원칙
- 각 모듈은 하나의 주요 기능만 담당
- 예: VideoOperations는 비디오 관련 작업만

### 2. 의존성 최소화
- 모듈 간 의존성 최소화
- 공유 상태는 app.js에서 관리

### 3. 명확한 인터페이스
- 각 모듈은 명확한 export/import 구조
- 함수명은 직관적이고 일관성 있게

### 4. 에러 처리
- 각 모듈에서 에러 처리
- 상위로 에러 전파

### 5. 문서화
- 각 모듈 상단에 JSDoc 주석
- 주요 함수에 사용법 설명

---

## 🔄 모듈 템플릿

```javascript
/**
 * VideoOperations.js
 * 비디오 관련 모든 작업을 처리하는 모듈
 *
 * @module VideoOperations
 * @requires electron
 */

// ============================================================================
// State (app.js에서 전달받음)
// ============================================================================
let currentVideo = null;
let videoInfo = null;

// ============================================================================
// Initialization
// ============================================================================
function init(state) {
  currentVideo = state.currentVideo;
  videoInfo = state.videoInfo;
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Import video file
 * @returns {Promise<string>} Video file path
 */
async function importVideo() {
  // ... implementation
}

/**
 * Load video into preview
 * @param {string} path - Video file path
 */
async function loadVideo(path) {
  // ... implementation
}

// ============================================================================
// Exports
// ============================================================================
export {
  init,
  importVideo,
  loadVideo,
  // ... other exports
};
```

---

## 📊 예상 효과

### 전후 비교
| 항목 | 현재 | 목표 | 개선율 |
|-----|------|------|--------|
| app.js 크기 | 11,921줄 | 2,000줄 | **83% 감소** |
| 총 모듈 수 | 7개 | 19개 | 171% 증가 |
| 평균 모듈 크기 | - | 800줄 | 관리 가능 |
| 함수 밀집도 | 215/11,921 | 30/2,000 | 분산 |

### 장점
1. **가독성 향상**: 각 파일이 작아져서 이해하기 쉬움
2. **유지보수성**: 버그 수정 및 기능 추가가 용이
3. **재사용성**: 모듈을 다른 프로젝트에서도 사용 가능
4. **테스트 용이성**: 각 모듈을 독립적으로 테스트 가능
5. **협업 개선**: 여러 개발자가 동시 작업 가능
6. **성능**: 필요한 모듈만 로드 가능 (lazy loading)

### 단점
1. **초기 작업량**: 리팩토링에 8-12시간 소요
2. **테스트 필요**: 전체 기능 재테스트 필요
3. **러닝 커브**: 새로운 구조 이해 필요

---

## ⚠️ 주의사항

### 1. 하위 호환성 유지
- 기존 API는 그대로 유지
- window 객체에 노출된 함수들도 유지

### 2. 점진적 마이그레이션
- 한 번에 모든 것을 바꾸지 않음
- Phase별로 단계적 진행

### 3. 충분한 테스트
- 각 Phase 완료 후 전체 테스트
- 회귀 테스트 필수

### 4. Git 커밋 전략
- 각 모듈 분리 후 개별 커밋
- 롤백 가능하도록 작은 단위로 커밋

---

## 🎯 성공 기준

### Phase 1 완료 조건
- [ ] 5개 핵심 모듈 생성
- [ ] app.js가 7,000줄 이하로 감소
- [ ] 모든 기존 기능 정상 작동

### Phase 2 완료 조건
- [ ] 5개 유틸리티 모듈 생성
- [ ] app.js가 4,000줄 이하로 감소
- [ ] 에러 없이 빌드 성공

### Phase 3 완료 조건
- [ ] 2개 헬퍼 모듈 생성
- [ ] app.js가 2,000줄 이하로 감소
- [ ] 코드 커버리지 유지

### Phase 4 완료 조건
- [ ] 전체 기능 테스트 통과
- [ ] 성능 저하 없음
- [ ] 문서 업데이트 완료

---

## 📚 참고 문서

- [Electron 모듈화 베스트 프랙티스](https://www.electronjs.org/docs/latest/tutorial/application-architecture)
- [JavaScript 모듈 시스템](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [리팩토링 패턴](https://refactoring.guru/refactoring/techniques)

---

## 🔗 관련 이슈

- app.js가 너무 커서 유지보수 어려움
- 새로운 기능 추가 시 파일 찾기 어려움
- 코드 리뷰 시간이 너무 오래 걸림

---

**작성일**: 2025-11-05
**작성자**: Claude Code
**버전**: 1.0
**상태**: 제안 단계
