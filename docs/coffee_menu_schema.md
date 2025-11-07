# Coffee Kiosk Menu XML Schema

## Overview
XML 기반 커피 키오스크 메뉴 설정 시스템. 카테고리, 메뉴, 가격, 이미지, 영상을 통합 관리합니다.

## Schema Structure

### 1. Metadata
메뉴 파일의 메타 정보
- `name`: 메뉴 이름
- `version`: 버전 번호
- `lastModified`: 마지막 수정 시간

### 2. Categories
카테고리 정의
- `id`: 고유 ID (예: "coffee", "beverage", "dessert")
- `name`: 한글 이름
- `nameEn`: 영문 이름
- `icon`: Material Icon 이름
- `order`: 표시 순서

### 3. Menu Items
개별 메뉴 아이템
- `id`: 고유 ID
- `category`: 카테고리 ID 참조
- `name`: 한글 메뉴명
- `nameEn`: 영문 메뉴명
- `price`: 기본 가격 (원)
- `description`: 설명
- `available`: 판매 가능 여부
- `order`: 표시 순서

#### Images
다양한 용도의 이미지 지원:
- `thumbnailUrl`: 메뉴 그리드에 표시될 썸네일 (권장: 300x300px)
- `detailUrl`: 상세 화면 이미지 (권장: 800x600px)
- `imageId`: 백엔드 Image ID (S3에서 관리)

#### Videos
메뉴 선택 시 재생할 영상:
- `videoId`: 백엔드 Video ID
- `videoUrl`: 직접 영상 URL
- `autoPlay`: 자동 재생 여부

#### Options
메뉴별 옵션 활성화 설정:
- `sizeEnabled`: 사이즈 선택 가능
- `temperatureEnabled`: 온도 선택 가능
- `extrasEnabled`: 추가 옵션 선택 가능

### 4. Options
전역 옵션 정의

#### Sizes
- `id`: 고유 ID
- `name`: 영문 이름
- `nameKo`: 한글 이름
- `additionalPrice`: 추가 금액

#### Temperatures
- `id`: 고유 ID
- `name`: 영문 이름
- `nameKo`: 한글 이름

#### Extras
- `id`: 고유 ID
- `name`: 한글 이름
- `nameEn`: 영문 이름
- `additionalPrice`: 추가 금액

### 5. Video Settings
영상 재생 관련 전역 설정
- `defaultIdleVideoId`: 대기 화면 영상 ID
- `menuVideoAutoPlay`: 메뉴 선택 시 자동 재생
- `videoVolume`: 기본 볼륨 (0-100)
- `videoLoopEnabled`: 영상 반복 재생

### 6. UI Settings
키오스크 UI 커스터마이징
- `themeColor`: 메인 색상 (hex)
- `fontFamily`: 폰트 패밀리
- `showPrices`: 가격 표시 여부
- `gridColumns`: 그리드 컬럼 수 (2-4)

## Data Flow

1. **편집기 앱** → XML 파일 생성/편집
2. **XML 파일** → S3 또는 로컬 저장
3. **키오스크 앱** → XML 파싱 → 메뉴 표시
4. **이미지/영상** → 백엔드 API로 관리

## Integration with Backend

### Image Management
- Backend의 `MediaType.IMAGE` 사용
- `/api/ai/upload` 또는 `/api/videos/upload`로 이미지 업로드
- S3 경로: `images/uploads/` 또는 `images/ai/`
- Presigned URL로 안전한 이미지 접근

### Video Management
- Backend의 `MediaType.VIDEO` 사용
- S3 경로: `videos/uploads/` 또는 `videos/ai/`
- Presigned URL로 스트리밍

## File Naming Convention

```
coffee_menu_{store_id}_{kiosk_id}.xml
coffee_menu_00000001_000000000001.xml

또는 공통 메뉴:
coffee_menu_default.xml
```

## Validation Rules

1. 모든 ID는 고유해야 함
2. 카테고리 참조는 정의된 카테고리여야 함
3. 가격은 0 이상의 정수
4. URL은 유효한 형식
5. imageId/videoId는 백엔드에 존재하는 ID
6. 색상 코드는 hex 형식 (#RRGGBB)
