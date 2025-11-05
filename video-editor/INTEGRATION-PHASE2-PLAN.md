# Phase 2 통합 전략

## 발견 사항

### 모듈 상태 분석

| 모듈 | 구현 완성도 | app.js와의 호환성 | 통합 방법 |
|------|------------|------------------|----------|
| UIHelpers | ✅ 완성 | ✅ 호환 | ✅ 완료 (직접 사용) |
| TimelineHelpers | ✅ 완성 | ✅ 호환 | ✅ 완료 (직접 사용) |
| **FilterOperations** | ✅ 완성 | ⚠️ 시그니처 다름 | 🔧 Wrapper로 통합 가능 |
| **WaveformManager** | ✅ 완성 | ❌ 전역 상태 의존 | ⏸️ 보류 (큰 리팩토링 필요) |
| **SpeedOperations** | ✅ 완성 | ⚠️ 확인 필요 | 🔧 Wrapper로 통합 시도 |
| **PreviewHelpers** | ✅ 완성 | ⚠️ 확인 필요 | 🔧 Wrapper로 통합 시도 |

## Phase 2 통합 계획

### 1. FilterOperations 통합

**문제**: 함수 시그니처 불일치
```javascript
// ❌ app.js (파라미터 없음)
function updateFilterControls() {
  const filterType = document.getElementById('filter-type').value;
  // ... 100줄의 switch 문
}

// ✅ 모듈 (파라미터 받음)
export function updateFilterControls(filterType) {
  // ... 깔끔한 구현
}
```

**해결책**: Wrapper 함수
```javascript
// app.js에 wrapper 추가
function updateFilterControls() {
  const filterType = document.getElementById('filter-type').value;
  FilterOperations.updateFilterControls(filterType);
}
```

**예상 감소**: ~80줄

### 2. SpeedOperations 통합

**상태**: 확인 필요
**예상 감소**: ~60줄 (wrapper 방식)

### 3. PreviewHelpers 통합

**상태**: 확인 필요
**예상 감소**: ~50줄 (wrapper 방식)

### 4. WaveformManager

**보류 사유**:
- 전역 상태(zoomStart, zoomEnd, currentVideo) 강하게 의존
- 많은 함수들이 전역 변수를 직접 참조
- 통합하려면 app.js 전체 리팩토링 필요

**예상 작업량**: 큰 리팩토링 필요 (수백 줄)
**우선순위**: 낮음

## Phase 2 예상 결과

```
현재: 11,965 줄

통합 후:
- FilterOperations: -80줄
- SpeedOperations: -60줄
- PreviewHelpers: -50줄
─────────────────────────
예상: ~11,775 줄 (약 190줄 감소)
```

## 실행 단계

1. ✅ FilterOperations wrapper 추가 및 중복 제거
2. ✅ SpeedOperations 분석 및 통합
3. ✅ PreviewHelpers 분석 및 통합
4. ⏸️ WaveformManager 보류 (Phase 3에서 고려)
5. ✅ 테스트 및 커밋

## 주의사항

- Wrapper 함수는 window에 export하여 onclick 호환성 유지
- 각 통합 단계마다 신중하게 테스트
- 동작이 확실하지 않으면 보수적으로 진행
