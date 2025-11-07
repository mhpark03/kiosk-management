# Coffee Menu Editor

Flutter 데스크톱 애플리케이션으로, 커피 키오스크 메뉴를 XML 형식으로 생성하고 편집할 수 있습니다.

## 기능

### 메뉴 관리
- ✅ 메뉴 아이템 추가/수정/삭제
- ✅ 드래그로 메뉴 순서 변경
- ✅ 카테고리별 메뉴 구성
- ✅ 제품 이미지 URL 설정
- ✅ 가격, 설명, 옵션 설정

### 카테고리 관리
- ✅ 카테고리 추가/수정/삭제
- ✅ 아이콘 선택 (8가지 제공)
- ✅ 표시 순서 설정
- ✅ 한글/영문 이름 지정

### 파일 작업
- ✅ XML 파일 불러오기
- ✅ XML 파일 저장하기
- ✅ 새 메뉴 생성

### 옵션 설정
- ✅ 사이즈 선택 가능 여부
- ✅ 온도 선택 가능 여부 (HOT/ICED)
- ✅ 추가 옵션 가능 여부 (샷, 시럽, 휘핑크림)
- ✅ 메뉴 판매 가능 여부

## 실행 방법

### 사전 요구사항
- Flutter SDK 3.9.2 이상
- Windows, macOS, 또는 Linux

### 패키지 설치
```bash
cd coffee_menu_editor
flutter pub get
```

### 실행
```bash
# Windows
flutter run -d windows

# macOS
flutter run -d macos

# Linux
flutter run -d linux
```

### 빌드 (실행 파일 생성)
```bash
# Windows
flutter build windows

# macOS
flutter build macos

# Linux
flutter build linux
```

## 사용 방법

### 1. 새 메뉴 생성
1. 상단 툴바에서 **+ 아이콘** 클릭
2. "Create New Menu" 확인

### 2. 카테고리 추가
1. 왼쪽 사이드바 "Categories" 섹션에서 **+ 버튼** 클릭
2. 카테고리 정보 입력:
   - ID: 고유 식별자 (영문 소문자, 숫자, 언더스코어만)
   - 한글 이름
   - 영문 이름
   - 아이콘 선택
   - 표시 순서
3. **Add Category** 클릭

### 3. 메뉴 아이템 추가
1. 메인 화면에서 **Add Item** 버튼 클릭
2. 메뉴 정보 입력:
   - 카테고리 선택
   - 한글 메뉴명
   - 영문 메뉴명
   - 가격 (원)
   - 설명
   - 이미지 URL (선택)
3. 옵션 설정:
   - Available: 판매 가능 여부
   - Size Selection: 사이즈 선택 가능
   - Temperature Selection: 온도 선택 가능
   - Extra Options: 추가 옵션 가능
4. **Add Item** 클릭

### 4. 메뉴 순서 변경
- 메인 화면에서 메뉴 아이템을 드래그하여 순서 변경

### 5. XML 파일 저장
1. 상단 툴바에서 **💾 아이콘** 클릭
2. 저장 위치 선택
3. 파일명 입력 (예: `coffee_menu.xml`)
4. 저장

### 6. XML 파일 불러오기
1. 상단 툴바에서 **📁 아이콘** 클릭
2. XML 파일 선택
3. 메뉴 자동 로드

## XML 파일 구조

생성된 XML 파일은 다음과 같은 구조를 가집니다:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kioskMenu>
  <metadata>
    <name>커피숍 메뉴</name>
    <version>1.0.0</version>
    <lastModified>2025-11-07T12:00:00</lastModified>
  </metadata>

  <categories>
    <category id="coffee" name="커피" nameEn="Coffee" icon="coffee" order="1" />
    ...
  </categories>

  <menuItems>
    <item id="coffee_americano" category="coffee" order="1">
      <name>아메리카노</name>
      <nameEn>Americano</nameEn>
      <price>4000</price>
      <description>진한 에스프레소에 물을 더한 커피</description>
      <thumbnailUrl>https://example.com/image.jpg</thumbnailUrl>
      <available>true</available>
      <sizeEnabled>true</sizeEnabled>
      <temperatureEnabled>true</temperatureEnabled>
      <extrasEnabled>true</extrasEnabled>
    </item>
    ...
  </menuItems>

  <options>
    <sizes>...</sizes>
    <temperatures>...</temperatures>
    <extras>...</extras>
  </options>
</kioskMenu>
```

## 키오스크 앱과 연동

생성된 XML 파일을 Flutter 키오스크 앱의 `assets/` 폴더에 복사하면 자동으로 로드됩니다:

```bash
cp coffee_menu.xml ../flutter_downloader/assets/coffee_menu.xml
```

## 의존성 패키지

- `xml: ^6.5.0` - XML 파싱 및 생성
- `file_picker: ^10.3.3` - 파일 선택
- `provider: ^6.1.1` - 상태 관리
- `dio: ^5.4.0` - HTTP 클라이언트 (향후 백엔드 연동용)
- `cached_network_image: ^3.3.1` - 이미지 캐싱 (향후 이미지 프리뷰용)
- `uuid: ^4.3.3` - 고유 ID 생성

## 프로젝트 구조

```
coffee_menu_editor/
├── lib/
│   ├── main.dart                          # 앱 진입점
│   ├── models/
│   │   └── menu_config.dart               # 메뉴 데이터 모델
│   ├── services/
│   │   ├── menu_service.dart              # 상태 관리 (Provider)
│   │   ├── xml_generator.dart             # XML 생성
│   │   └── xml_menu_parser.dart           # XML 파싱
│   └── screens/
│       ├── home_screen.dart               # 메인 화면
│       ├── menu_item_editor_screen.dart   # 메뉴 아이템 편집
│       └── category_editor_screen.dart    # 카테고리 편집
├── pubspec.yaml
└── README.md
```

## 향후 개발 계획

- [ ] 이미지 업로드 및 백엔드 연동
- [ ] 이미지 프리뷰 기능
- [ ] 영상 연결 기능
- [ ] 다국어 지원 확대
- [ ] 템플릿 메뉴 제공
- [ ] 메뉴 미리보기
- [ ] 백엔드 API로 직접 업로드

## 라이선스

MIT License
