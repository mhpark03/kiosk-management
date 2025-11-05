# 리팩토링 단계별 실행 가이드

## ✅ 완료된 작업

### 1. UIHelpers.js ✅
**위치**: `renderer/modules/utilities/UIHelpers.js`

**포함 함수** (20개):
- `handleError()` - 에러 처리
- `showCustomDialog()` - 커스텀 다이얼로그
- `closeCustomDialog()` - 다이얼로그 닫기
- `showProgress()` - 진행 상태 표시
- `hideProgress()` - 진행 상태 숨기기
- `updateProgress()` - 진행률 업데이트
- `updateStatus()` - 상태바 업데이트
- `openSaveDialog()` - 파일 저장 다이얼로그
- `confirmAction()` - 확인 다이얼로그
- `showAlert()` - 알림
- `clearToolProperties()` - 도구 속성 패널 초기화
- `setToolPropertiesHTML()` - 도구 속성 HTML 설정
- `showLoading()` - 로딩 표시
- `hideLoading()` - 로딩 숨기기
- `showToast()` - 토스트 알림 (신기능!)
- `showModal()` - 모달 표시
- `hideModal()` - 모달 숨기기

### 2. TimelineHelpers.js ✅
**위치**: `renderer/modules/utilities/TimelineHelpers.js`

**포함 함수** (19개):
- `updateZoomRangeOverlay()` - 줌 범위 오버레이
- `updateTrimDurationDisplay()` - 트림 길이 표시
- `updateTrimRangeOverlay()` - 트림 범위 오버레이
- `updateTextRangeOverlay()` - 텍스트 범위 오버레이
- `updateTextRangeDisplay()` - 텍스트 범위 표시
- `updateAudioRangeOverlay()` - 오디오 범위 오버레이
- `formatTime()` - 시간 포맷팅 (MM:SS, HH:MM:SS)
- `parseTimeString()` - 시간 문자열 파싱
- `validateTimeRange()` - 시간 범위 검증
- `updateTimelineCursor()` - 타임라인 커서 업데이트
- `hideAllOverlays()` - 모든 오버레이 숨기기
- `showOverlay()` - 특정 오버레이 표시
- `addTimelineMarker()` - 타임라인 마커 추가
- `clearTimelineMarkers()` - 타임라인 마커 제거

---

## 🚀 app.js에 통합하는 방법

### Step 1: HTML에 type="module" 추가

**파일**: `renderer/index.html`

```html
<!-- Before -->
<script src="app.js"></script>

<!-- After -->
<script type="module" src="app.js"></script>
```

### Step 2: app.js 상단에 import 추가

**파일**: `renderer/app.js` (첫 줄에 추가)

```javascript
// ============================================================================
// Module Imports
// ============================================================================

// Utilities
import * as UIHelpers from './modules/utilities/UIHelpers.js';
import * as TimelineHelpers from './modules/utilities/TimelineHelpers.js';

// 기존 코드는 그대로 유지...
```

### Step 3: 기존 함수 호출을 모듈 호출로 변경

#### 예시 1: 에러 처리

```javascript
// Before
function someFunction() {
  try {
    // ...
  } catch (error) {
    handleError('작업', error, '실패했습니다');
  }
}

// After
function someFunction() {
  try {
    // ...
  } catch (error) {
    UIHelpers.handleError('작업', error, '실패했습니다');
  }
}
```

#### 예시 2: 진행 상태 표시

```javascript
// Before
async function processVideo() {
  showProgress();
  updateProgress(50, '처리 중...');
  hideProgress();
}

// After
async function processVideo() {
  UIHelpers.showProgress();
  UIHelpers.updateProgress(50, '처리 중...');
  UIHelpers.hideProgress();
}
```

#### 예시 3: 타임라인 오버레이

```javascript
// Before
function updateTrimUI() {
  updateTrimDurationDisplay();
  updateTrimRangeOverlay(startTime, endTime, maxDuration);
}

// After
function updateTrimUI() {
  const result = TimelineHelpers.updateTrimDurationDisplay(videoInfo);
  if (result.valid) {
    TimelineHelpers.updateTrimRangeOverlay(
      result.startTime,
      result.endTime,
      result.maxDuration,
      activeTool
    );
  }
}
```

### Step 4: 기존 함수 정의 제거

모듈로 이동한 함수들을 app.js에서 삭제:

```javascript
// ❌ 삭제할 함수들 (UIHelpers.js로 이동됨)
function handleError(operation, error, userMessage) { ... }
function showCustomDialog(message) { ... }
function closeCustomDialog() { ... }
function showProgress() { ... }
function hideProgress() { ... }
function updateProgress(percent, message) { ... }
function updateStatus(message) { ... }

// ❌ 삭제할 함수들 (TimelineHelpers.js로 이동됨)
function updateZoomRangeOverlay() { ... }
function updateTrimDurationDisplay() { ... }
function updateTrimRangeOverlay(startTime, endTime, maxDuration) { ... }
function updateTextRangeOverlay(startTime, endTime, maxDuration) { ... }
function updateTextRangeDisplay() { ... }
```

---

## 📝 변경 사항 찾기 (검색 및 교체)

### 1. UIHelpers 함수들

#### VS Code 검색 & 교체

**Find:**
```
(^|\s)(handleError|showCustomDialog|showProgress|hideProgress|updateProgress|updateStatus|showAlert|confirmAction)\(
```

**Replace:**
```
$1UIHelpers.$2(
```

**단, 제외해야 할 것:**
- 함수 정의 (function handleError...)
- Export 문 (export function...)

### 2. TimelineHelpers 함수들

**Find:**
```
(^|\s)(updateZoomRangeOverlay|updateTrimDurationDisplay|updateTrimRangeOverlay|updateTextRangeOverlay|updateTextRangeDisplay|updateAudioRangeOverlay|formatTime|validateTimeRange)\(
```

**Replace:**
```
$1TimelineHelpers.$2(
```

---

## 🧪 테스트 체크리스트

### UIHelpers 테스트

```javascript
// 테스트 함수를 app.js에 임시로 추가
window.testUIHelpers = function() {
  // 1. 에러 처리
  try {
    throw new Error('Test error');
  } catch (error) {
    UIHelpers.handleError('테스트', error, '에러 테스트입니다');
  }

  // 2. 진행 상태
  UIHelpers.showProgress();
  setTimeout(() => {
    UIHelpers.updateProgress(50, '50% 완료');
    setTimeout(() => {
      UIHelpers.updateProgress(100, '완료');
      UIHelpers.hideProgress();
    }, 1000);
  }, 1000);

  // 3. 토스트 (신기능!)
  UIHelpers.showToast('성공!', 'success');
  setTimeout(() => UIHelpers.showToast('오류 발생', 'error'), 1500);
  setTimeout(() => UIHelpers.showToast('경고', 'warning'), 3000);

  // 4. 상태 업데이트
  UIHelpers.updateStatus('테스트 완료');
};

// 개발자 콘솔에서 실행:
// testUIHelpers()
```

### TimelineHelpers 테스트

```javascript
window.testTimelineHelpers = function() {
  // 비디오가 로드되어 있어야 함
  if (!videoInfo) {
    UIHelpers.showAlert('먼저 비디오를 로드하세요');
    return;
  }

  // 1. 타임 포맷팅
  console.log('10초:', TimelineHelpers.formatTime(10)); // "00:10"
  console.log('65초:', TimelineHelpers.formatTime(65)); // "01:05"
  console.log('3665초:', TimelineHelpers.formatTime(3665)); // "01:01:05"

  // 2. 범위 검증
  const result = TimelineHelpers.validateTimeRange(0, 10, 100);
  console.log('유효성 검증:', result); // { valid: true, error: '' }

  // 3. 오버레이 테스트
  TimelineHelpers.updateTrimRangeOverlay(5, 15, 100, 'trim');
  UIHelpers.showToast('트림 범위 표시됨', 'info');
};

// 개발자 콘솔에서 실행:
// testTimelineHelpers()
```

---

## 📊 예상 결과

### Before
```
app.js: 11,921줄
```

### After (2개 모듈만 분리한 경우)
```
app.js: ~11,400줄 (약 520줄 감소)
└── modules/utilities/
    ├── UIHelpers.js: 270줄
    └── TimelineHelpers.js: 250줄
```

### After (전체 리팩토링 완료 시)
```
app.js: ~2,000줄 (83% 감소!)
└── modules/
    ├── core/ (7개 모듈)
    └── utilities/ (7개 모듈)
```

---

## 🔍 트러블슈팅

### 문제 1: "Cannot use import statement outside a module"

**원인**: HTML에서 `<script type="module">` 누락

**해결**:
```html
<script type="module" src="app.js"></script>
```

### 문제 2: "module not found"

**원인**: 경로가 잘못됨

**해결**: 상대 경로 확인
```javascript
// ✅ Correct
import * as UIHelpers from './modules/utilities/UIHelpers.js';

// ❌ Wrong
import * as UIHelpers from 'modules/utilities/UIHelpers.js'; // ./ 누락
import * as UIHelpers from './modules/utilities/UIHelpers'; // .js 누락
```

### 문제 3: "함수가 undefined"

**원인**: Export를 빠뜨림

**해결**: 모듈에서 export 확인
```javascript
// 모듈 파일에서
export function myFunction() { ... }

// app.js에서
import * as MyModule from './modules/MyModule.js';
MyModule.myFunction(); // ✅
```

### 문제 4: "window is not defined"

**원인**: 모듈 스코프에서 window 접근 시도

**해결**: typeof 체크 추가
```javascript
if (typeof window !== 'undefined') {
  window.myFunction = myFunction;
}
```

---

## 🎯 다음 단계

### 1. 추가 모듈 생성 (우선순위 순)

다음으로 만들 모듈:
- [ ] WaveformManager.js (~800줄)
- [ ] FilterOperations.js (~600줄)
- [ ] SpeedOperations.js (~400줄)
- [ ] UploadOperations.js (~800줄)
- [ ] PreviewHelpers.js (~300줄)

### 2. 대형 모듈 분리 (Phase 1)

- [ ] VideoOperations.js (~2,500줄)
- [ ] AudioOperations.js (~2,000줄)
- [ ] TrimOperations.js (~1,500줄)
- [ ] MergeOperations.js (~1,000줄)
- [ ] TextOperations.js (~1,200줄)

### 3. 최종 테스트 및 문서화

- [ ] 전체 기능 테스트
- [ ] 성능 테스트
- [ ] 문서 업데이트
- [ ] 코드 리뷰

---

## 💡 유용한 명령어

### 파일 크기 확인
```bash
wc -l renderer/app.js
wc -l renderer/modules/utilities/*.js
```

### 함수 사용처 찾기
```bash
grep -n "handleError" renderer/app.js
grep -n "updateProgress" renderer/app.js
```

### 모듈로 이동한 함수 확인
```bash
grep -n "export function" renderer/modules/utilities/UIHelpers.js
```

### Git 커밋 (모듈별로)
```bash
git add renderer/modules/utilities/UIHelpers.js
git commit -m "Refactor: Extract UIHelpers module (20 functions, 270 lines)"

git add renderer/modules/utilities/TimelineHelpers.js
git commit -m "Refactor: Extract TimelineHelpers module (19 functions, 250 lines)"
```

---

## 📚 참고 자료

- [REFACTORING-PLAN.md](./REFACTORING-PLAN.md) - 전체 계획
- [REFACTORING-QUICK-GUIDE.md](./REFACTORING-QUICK-GUIDE.md) - 빠른 가이드
- [APP-JS-REFACTORED-EXAMPLE.js](./APP-JS-REFACTORED-EXAMPLE.js) - 예제 코드

---

**작성일**: 2025-11-05
**상태**: 진행 중 (2/12 모듈 완료)
**다음 작업**: WaveformManager.js 생성
