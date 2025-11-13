# 성별 감지 기능 설정 가이드

## 개요

Flutter 다운로드 앱에 성별 감지 기능이 추가되었습니다. 건물에 들어오는 사람을 자동으로 감지하여 성별을 파악하고, 맞춤형 콘텐츠를 제공할 수 있습니다.

## 작동 방식

```
[사람 들어옴] → [사람 감지 (YOLO)] → [얼굴 영역 추출] → [성별 분류 (ONNX)] → [맞춤형 콘텐츠]
```

### 자동 감지 환경

- ✅ 무인 자동 감지 (사용자 액션 불필요)
- ✅ 1-3m 거리에서 자동 감지
- ✅ 얼굴 크기 40x40 픽셀 이상에서 시도
- ✅ 신뢰도 40% 이상이면 성별 정보 사용

### 신뢰도 기반 처리

```dart
if (status.isGenderHighlyConfident) {
  // 신뢰도 70% 이상: 확실한 성별
  showMaleOrFemaleContent();
} else if (status.isGenderReliable) {
  // 신뢰도 40-70%: 일부 맞춤형 콘텐츠
  showMixedContent();
} else {
  // 신뢰도 40% 미만: 일반 콘텐츠
  showGenericContent();
}
```

## 필수 요구사항

### 1. 성별 분류 ONNX 모델

다음 중 하나를 선택하여 ONNX 모델을 준비하세요:

#### 옵션 A: FairFace 모델 (권장)
```bash
# FairFace GitHub에서 pre-trained 모델 다운로드
# https://github.com/dchen236/FairFace

# PyTorch 모델을 ONNX로 변환
python convert_to_onnx.py
```

#### 옵션 B: AgeGender 모델
```bash
# https://github.com/yu4u/age-gender-estimation
# ONNX 버전 다운로드 또는 변환
```

#### 옵션 C: 커스텀 모델
직접 학습한 성별 분류 모델을 ONNX로 변환

### 2. 모델 입력 요구사항

성별 모델은 다음 입력 형식을 지원해야 합니다:

- **입력 shape**: `[1, 112, 112, 3]` (NHWC) 또는 `[1, 224, 224, 3]`
- **데이터 타입**: `float32`
- **값 범위**: `0.0 - 1.0` (정규화됨)
- **색상 순서**: RGB

### 3. 모델 출력 요구사항

다음 중 하나의 출력 형식:

#### 이진 분류 (권장)
```
output shape: [1, 2]
values: [male_probability, female_probability]
```

#### 단일 Sigmoid
```
output shape: [1, 1]
value: 0.0 (male) ~ 1.0 (female)
```

## 설치 방법

### 1. 모델 파일 배치

ONNX 모델을 다음 위치에 저장:

```
flutter_downloader/
└── assets/
    ├── detect.onnx              # 기존 사람 감지 모델
    └── gender_classifier.onnx   # 새로운 성별 분류 모델
```

### 2. pubspec.yaml 확인

`assets/gender_classifier.onnx`가 포함되어 있는지 확인:

```yaml
flutter:
  assets:
    - assets/detect.onnx
    - assets/gender_classifier.onnx  # 추가
    - assets/coffee_menu.xml
```

### 3. 모델 입력 크기 조정 (필요 시)

모델의 입력 크기가 112x112가 아닌 경우, 코드 수정:

`lib/services/person_detection_service.dart`:

```dart
// Line 833: 모델 입력 크기 변경
const int inputSize = 224;  // 또는 모델에 맞는 크기
```

### 4. 모델 입력/출력 이름 확인

ONNX 모델의 입력/출력 이름 확인:

```bash
# Netron으로 모델 열기
# https://netron.app/

# 또는 Python으로 확인
import onnx
model = onnx.load('gender_classifier.onnx')
print('Input name:', model.graph.input[0].name)
print('Output name:', model.graph.output[0].name)
```

필요시 코드 수정 (`line 857`):

```dart
final inputs = {'input_name_here': inputOrt};  // 모델에 맞게 수정
```

## 사용 방법

### DetectionStatus 구독

```dart
PersonDetectionService().detectionStatusStream.listen((status) {
  if (status.personPresent) {
    print('사람 감지됨');

    if (status.gender != null) {
      print('성별: ${status.gender}');
      print('신뢰도: ${(status.genderConfidence! * 100).toStringAsFixed(1)}%');

      // 맞춤형 콘텐츠 표시
      if (status.isGenderHighlyConfident) {
        if (status.gender == 'male') {
          showMaleContent();
        } else if (status.gender == 'female') {
          showFemaleContent();
        }
      }
    }
  }
});
```

### 신뢰도 체크

```dart
// 신뢰도 70% 이상 (높은 신뢰도)
if (status.isGenderHighlyConfident) {
  // 확실한 성별 기반 콘텐츠
}

// 신뢰도 40% 이상 (사용 가능)
if (status.isGenderReliable) {
  // 일부 맞춤형 콘텐츠
}
```

## 테스트 및 디버깅

### 1. 로그 확인

앱 실행 시 다음 로그 확인:

```
[GENDER DETECTION] Loading gender classification model...
[GENDER DETECTION] Gender model loaded: 123456 bytes
[GENDER DETECTION] Gender classification session created successfully
```

모델이 없는 경우:
```
[GENDER DETECTION] Gender model not found or failed to load
[GENDER DETECTION] Continuing without gender detection...
```

### 2. 감지 로그

사람 감지 시:
```
[PERSON DETECTION] ✓ Person detected with confidence: 85.3%
[GENDER DETECTION] ✓ Gender detected: male (72.5%)
```

얼굴이 너무 작은 경우:
```
[GENDER DETECTION] Face too small: 35x35 (min: 40)
```

## 성능 최적화

### 감지 빈도 조절

`person_detection_service.dart`:

```dart
static const Duration _detectionInterval = Duration(milliseconds: 500);  // 기본값
// → Duration(milliseconds: 1000)으로 변경 시 성능 향상
```

### 최소 얼굴 크기 조절

```dart
static const int _minFaceSizeForGender = 40;  // 기본값
// → 60으로 증가 시 정확도 향상, 감지 범위 감소
// → 30으로 감소 시 감지 범위 확대, 정확도 감소
```

### 신뢰도 임계값 조절

```dart
static const double _genderConfidenceThreshold = 0.4;  // 기본값 40%
// → 0.6으로 증가 시 정확도 중시
// → 0.3으로 감소 시 감지율 중시
```

## 문제 해결

### Q1: 모델 로딩 실패

```
Error: Unable to load asset: assets/gender_classifier.onnx
```

**해결**:
1. `pubspec.yaml`에 assets 추가 확인
2. `flutter clean && flutter pub get` 실행
3. 모델 파일 위치 확인

### Q2: 성별이 항상 unknown

**원인**:
- 신뢰도가 40% 미만
- 얼굴이 너무 작음 (40px 미만)
- 모델 입력/출력 형식 불일치

**해결**:
1. 로그에서 confidence 값 확인
2. 얼굴 크기 확인 (`facePixelSize`)
3. 모델 입력 크기 조정
4. 신뢰도 임계값 낮추기

### Q3: 성능 저하

**해결**:
1. 감지 간격 늘리기 (500ms → 1000ms)
2. 최소 얼굴 크기 늘리기 (40px → 60px)
3. Windows에서는 카메라 해상도 낮추기

## 추천 성별 모델

### 1. FairFace (Best)
- **정확도**: 매우 높음
- **속도**: 빠름
- **입력**: 224x224
- **다운로드**: https://github.com/dchen236/FairFace

### 2. UTKFace
- **정확도**: 높음
- **속도**: 매우 빠름
- **입력**: 112x112
- **다운로드**: 직접 학습 필요

### 3. VGGFace2
- **정확도**: 매우 높음
- **속도**: 중간
- **입력**: 224x224
- **다운로드**: https://github.com/ox-vgg/vgg_face2

## 참고 자료

- ONNX Runtime Flutter: https://pub.dev/packages/onnxruntime
- 모델 변환: https://github.com/onnx/tutorials
- FairFace 논문: https://arxiv.org/abs/1908.04913
