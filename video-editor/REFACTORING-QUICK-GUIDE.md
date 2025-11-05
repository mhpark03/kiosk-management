# Video Editor 리팩토링 빠른 가이드

## 🎯 한눈에 보기

### 현재 상태
```
app.js: 11,921줄 (330KB) 😱
└── 215개 함수가 하나의 파일에!
```

### 목표 상태
```
app.js: 2,000줄 (55KB) ✨
├── core/ (7개 모듈)
├── utilities/ (7개 모듈)
└── ai/ (6개 모듈 ✅ 이미 완료)
```

**감소율: 83% ↓**

---

## 📦 분리할 모듈 (12개)

| # | 모듈명 | 크기 | 함수 수 | 우선순위 |
|---|--------|------|---------|----------|
| 1 | VideoOperations.js | ~2,500줄 | 52개 | 🔥 High |
| 2 | AudioOperations.js | ~2,000줄 | 60개 | 🔥 High |
| 3 | TrimOperations.js | ~1,500줄 | 20개 | 🔥 High |
| 4 | MergeOperations.js | ~1,000줄 | 20개 | 🔥 High |
| 5 | TextOperations.js | ~1,200줄 | 18개 | 🔥 High |
| 6 | WaveformManager.js | ~800줄 | 7개 | 📦 Med |
| 7 | FilterOperations.js | ~600줄 | 5개 | 📦 Med |
| 8 | SpeedOperations.js | ~400줄 | 3개 | 📦 Med |
| 9 | UploadOperations.js | ~800줄 | 20개 | 📦 Med |
| 10 | UIHelpers.js | ~600줄 | 10개 | 📦 Med |
| 11 | TimelineHelpers.js | ~400줄 | 5개 | 🔧 Low |
| 12 | PreviewHelpers.js | ~300줄 | 5개 | 🔧 Low |

**Total: ~12,100줄 이동 → app.js 남은 줄: ~1,800줄**

---

## 🚀 3단계 실행 계획

### Phase 1: 핵심 기능 (3-4시간)
```bash
# 5개 대형 모듈 생성
✅ VideoOperations.js     # 비디오 가져오기, 로드, 정보 표시
✅ AudioOperations.js     # 오디오 가져오기, 웨이브폼, 추출
✅ TrimOperations.js      # 비디오/오디오 트림, 범위 선택
✅ MergeOperations.js     # 비디오/오디오 병합, 트랜지션
✅ TextOperations.js      # 텍스트 오버레이, 색상, 폰트
```

**목표**: app.js 7,000줄 이하

---

### Phase 2: 유틸리티 (2-3시간)
```bash
# 5개 중형 모듈 생성
✅ WaveformManager.js     # 웨이브폼 생성, 줌
✅ FilterOperations.js    # 밝기, 대비, 블러 등 필터
✅ SpeedOperations.js     # 속도 조절
✅ UploadOperations.js    # S3 업로드, 중복 체크
✅ UIHelpers.js           # 다이얼로그, 진행 상태, 상태 업데이트
```

**목표**: app.js 4,000줄 이하

---

### Phase 3: 헬퍼 (1-2시간)
```bash
# 2개 소형 모듈 생성
✅ TimelineHelpers.js     # 타임라인 오버레이, 시간 포맷
✅ PreviewHelpers.js      # 미리보기 컨트롤
```

**목표**: app.js 2,000줄 이하 ✨

---

## 📋 체크리스트

### Phase 1
- [ ] VideoOperations.js 생성
  - [ ] importVideo 함수군 이동 (52개)
  - [ ] 테스트: 비디오 가져오기
  - [ ] 테스트: 비디오 재생
- [ ] AudioOperations.js 생성
  - [ ] importAudioFile 함수군 이동 (60개)
  - [ ] 테스트: 오디오 가져오기
  - [ ] 테스트: 오디오 추출
- [ ] TrimOperations.js 생성
  - [ ] executeTrim 함수군 이동 (20개)
  - [ ] 테스트: 비디오 트림
  - [ ] 테스트: 오디오 트림
- [ ] MergeOperations.js 생성
  - [ ] executeMerge 함수군 이동 (20개)
  - [ ] 테스트: 비디오 병합
  - [ ] 테스트: 트랜지션 효과
- [ ] TextOperations.js 생성
  - [ ] executeAddText 함수군 이동 (18개)
  - [ ] 테스트: 텍스트 추가
  - [ ] 테스트: 색상 변경

### Phase 2
- [ ] WaveformManager.js 생성
- [ ] FilterOperations.js 생성
- [ ] SpeedOperations.js 생성
- [ ] UploadOperations.js 생성
- [ ] UIHelpers.js 생성

### Phase 3
- [ ] TimelineHelpers.js 생성
- [ ] PreviewHelpers.js 생성

### Phase 4
- [ ] Module loader 업데이트
- [ ] 전체 기능 테스트
- [ ] 성능 테스트
- [ ] 문서 업데이트

---

## 🔍 각 모듈의 주요 함수

### 1. VideoOperations.js
```javascript
// Import & Load
- importVideo()
- loadVideo(path)
- loadVideoWithAudioCheck(videoPath)
- displayVideoInfo(info)

// Timeline
- setupPlayheadInteraction()
- updatePlayheadPosition(currentTime, duration)
- displayTimelineTracks(info)
```

### 2. AudioOperations.js
```javascript
// Import & Load
- importAudioFile()
- loadAudioFile(path)
- getAudioDuration(path)

// Waveform
- generateAndDisplayWaveform(audioPath)
- setupAudioTrackInteraction()

// Extract & Upload
- executeExtractAudio()
- executeExtractAudioToS3()
```

### 3. TrimOperations.js
```javascript
// General Trim
- executeTrim()
- updateTrimRangeOverlay()
- previewTrimRange()

// Video-Only
- executeTrimVideoOnly()
- updateTrimVideoDurationDisplay()

// Audio-Only
- executeTrimAudioOnly()
- updateTrimAudioDurationDisplay()
```

### 4. MergeOperations.js
```javascript
// File Management
- addVideoToMerge()
- updateMergeFileList()
- removeMergeVideo()

// Execution
- executeMerge()
- previewMerge()

// Transition
- updateTransitionDescription()
```

### 5. TextOperations.js
```javascript
// Text Operations
- executeAddText()
- updateTextOverlay(currentTime)

// Styling
- updateTextColorPreview()
- updateTextAlignPreview()
- updateTextFontPreview()

// Color History
- loadColorHistory()
- saveColorToHistory()
```

---

## 🎨 모듈 구조 예시

### VideoOperations.js 구조
```javascript
// ============================================================================
// State
// ============================================================================
let currentVideo = null;
let videoInfo = null;

// ============================================================================
// Initialization
// ============================================================================
export function init(state) {
  currentVideo = state.currentVideo;
  videoInfo = state.videoInfo;
}

// ============================================================================
// Import Functions
// ============================================================================
export async function importVideo() {
  // Implementation
}

export async function loadVideo(path) {
  // Implementation
}

// ============================================================================
// Display Functions
// ============================================================================
export function displayVideoInfo(info) {
  // Implementation
}

// ============================================================================
// Helper Functions (private)
// ============================================================================
function updateVideoPreview() {
  // Implementation
}
```

---

## 💡 모듈화 팁

### 1. 함수 찾기
```bash
# 특정 키워드로 함수 찾기
grep -n "function.*Video" app.js

# 라인 범위로 함수 추출
sed -n '1885,2000p' app.js > temp.txt
```

### 2. 의존성 확인
```bash
# 특정 함수가 호출하는 다른 함수 찾기
grep "functionName" app.js
```

### 3. 테스트 우선
- 모듈 분리 전에 해당 기능 테스트
- 분리 후 같은 테스트로 검증

### 4. 작은 단위로 커밋
```bash
git add modules/core/VideoOperations.js
git commit -m "Refactor: Extract VideoOperations module"
```

---

## ⚠️ 주의사항

### 1. 전역 변수 처리
```javascript
// ❌ Bad: 모듈에서 직접 접근
function importVideo() {
  if (!currentVideo) { ... }
}

// ✅ Good: State 객체로 전달
export function importVideo(state) {
  if (!state.currentVideo) { ... }
}
```

### 2. window 객체 노출 유지
```javascript
// app.js에서 유지
window.importVideo = VideoOperations.importVideo;
window.executeTrim = TrimOperations.executeTrim;
```

### 3. 순환 참조 방지
```javascript
// ❌ Bad
// VideoOps imports AudioOps
// AudioOps imports VideoOps

// ✅ Good
// 공통 기능은 UIHelpers로 분리
```

---

## 📊 진행 상황 추적

### 줄 수 카운트
```bash
# app.js 현재 줄 수 확인
wc -l app.js

# 모듈 줄 수 합계
wc -l modules/core/*.js | tail -1
wc -l modules/utilities/*.js | tail -1
```

### 목표 달성률
```bash
# 현재 줄 수
current=$(wc -l < app.js)

# 감소율 계산
original=11921
echo "감소율: $(( 100 - (current * 100 / original) ))%"
```

---

## 🎯 최종 목표

```
Before:
app.js (11,921줄)
└── 모든 기능이 하나의 파일에 😱

After:
app.js (2,000줄) ✨
├── modules/core/ (7개)
│   ├── VideoOperations.js
│   ├── AudioOperations.js
│   ├── TrimOperations.js
│   ├── MergeOperations.js
│   ├── TextOperations.js
│   ├── PreviewManager.js ✅
│   └── ... (기타)
│
├── modules/utilities/ (7개)
│   ├── WaveformManager.js
│   ├── FilterOperations.js
│   └── ... (기타)
│
└── modules/ai/ (6개 ✅)
    ├── auth.js
    ├── tts.js
    ├── imagen.js
    ├── runway.js
    ├── veo.js
    └── module-loader.js
```

**결과**: 유지보수 가능, 테스트 가능, 확장 가능한 코드베이스! 🚀

---

**다음 단계**: [REFACTORING-PLAN.md](./REFACTORING-PLAN.md)를 읽고 Phase 1부터 시작하세요!
