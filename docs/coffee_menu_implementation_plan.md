# Coffee Kiosk XML Menu System Implementation Plan

## 프로젝트 개요

커피 키오스크 메뉴를 XML로 설정 가능하게 만들고, 편집을 위한 Flutter 앱을 개발합니다.

### 주요 기능
- ✅ XML 기반 메뉴 설정 (카테고리, 메뉴, 가격, 옵션)
- ✅ 상품 이미지 표시 (썸네일, 상세 이미지)
- ✅ 메뉴별 영상 재생
- ✅ Flutter 편집기 앱으로 쉬운 메뉴 관리
- ✅ 백엔드 API 연동 (이미지/영상 관리)

---

## Phase 1: Flutter 키오스크 앱 XML 파싱 추가

### 1.1 패키지 추가
**파일**: `flutter_downloader/pubspec.yaml`

```yaml
dependencies:
  xml: ^6.5.0  # XML 파싱
  cached_network_image: ^3.3.1  # 이미지 캐싱
  http: ^1.2.0  # 이미 있음 (파일 다운로드용)
```

### 1.2 XML 파서 클래스 생성
**파일**: `flutter_downloader/lib/models/kiosk_menu_config.dart` (NEW)

```dart
class KioskMenuConfig {
  final MenuMetadata metadata;
  final List<MenuCategory> categories;
  final List<MenuItem> menuItems;
  final MenuOptions options;
  final VideoSettings videoSettings;
  final UISettings uiSettings;
}

class MenuItem {
  final String id;
  final String category;
  final String name;
  final String nameEn;
  final int price;
  final String description;
  final MenuItemImages? images;  // 이미지 정보
  final MenuItemVideo? video;    // 영상 정보
  final bool available;
  final MenuItemOptions options;
  final int order;
}

class MenuItemImages {
  final String? thumbnailUrl;
  final String? detailUrl;
  final int? imageId;
}

class MenuItemVideo {
  final int? videoId;
  final String? videoUrl;
  final bool autoPlay;
}
```

### 1.3 XML 파서 서비스
**파일**: `flutter_downloader/lib/services/xml_menu_parser.dart` (NEW)

```dart
class XmlMenuParser {
  static KioskMenuConfig parseXml(String xmlContent) {
    final document = XmlDocument.parse(xmlContent);
    // Parse logic...
  }

  static MenuItem parseMenuItem(XmlElement element) {
    // Parse menu item with images and videos
  }
}
```

### 1.4 CoffeeMenuService 업데이트
**파일**: `flutter_downloader/lib/services/coffee_menu_service.dart`

```dart
class CoffeeMenuService {
  KioskMenuConfig? _menuConfig;

  // XML 파일에서 메뉴 로드
  Future<void> loadMenuFromXml(String xmlPath) async {
    final xmlContent = await loadXmlFile(xmlPath);
    _menuConfig = XmlMenuParser.parseXml(xmlContent);
  }

  // 백엔드 API에서 XML 다운로드
  Future<void> loadMenuFromServer(String kioskId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/kiosk/$kioskId/menu.xml')
    );
    _menuConfig = XmlMenuParser.parseXml(response.body);
  }

  List<MenuItem> getMenuByCategory(String category) {
    return _menuConfig?.menuItems
        .where((item) => item.category == category)
        .toList() ?? [];
  }
}
```

### 1.5 UI 업데이트 - 이미지 표시
**파일**: `flutter_downloader/lib/widgets/coffee_kiosk_overlay.dart`

```dart
Widget _buildMenuItem(MenuItem item) {
  return GestureDetector(
    onTap: () => _showItemOptionsDialog(item),
    child: Container(
      decoration: BoxDecoration(/* ... */),
      child: Column(
        children: [
          // 상품 이미지 표시 (썸네일)
          if (item.images?.thumbnailUrl != null)
            CachedNetworkImage(
              imageUrl: item.images!.thumbnailUrl!,
              width: 100,
              height: 100,
              fit: BoxFit.cover,
              placeholder: (context, url) => CircularProgressIndicator(),
              errorWidget: (context, url, error) => Icon(
                _getCategoryIcon(item.category),
                size: 60,
              ),
            )
          else
            // Fallback: 아이콘 표시
            Icon(_getCategoryIcon(item.category), size: 60),

          SizedBox(height: 8),
          Text(item.name, style: TextStyle(fontWeight: FontWeight.bold)),
          Text(item.nameEn, style: TextStyle(color: Colors.grey)),
          Text('₩${item.price}', style: TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    ),
  );
}
```

### 1.6 옵션 선택 다이얼로그 - 상세 이미지
**파일**: `flutter_downloader/lib/widgets/coffee_kiosk_overlay.dart`

```dart
void _showItemOptionsDialog(MenuItem item) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Row(
        children: [
          // 상세 이미지 표시
          if (item.images?.detailUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: item.images!.detailUrl!,
                width: 120,
                height: 120,
                fit: BoxFit.cover,
              ),
            ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name),
                Text(item.nameEn, style: TextStyle(fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
      content: /* ... options ... */,
    ),
  );
}
```

### 1.7 영상 재생 연동
**파일**: `flutter_downloader/lib/widgets/coffee_kiosk_overlay.dart`

```dart
class _CoffeeKioskOverlayState extends State<CoffeeKioskOverlay> {
  MenuItem? _selectedMenuItem;

  void _onMenuItemSelected(MenuItem item) {
    setState(() => _selectedMenuItem = item);

    // 메뉴 선택 시 영상 재생
    if (item.video?.autoPlay == true && item.video?.videoId != null) {
      _playMenuVideo(item.video!.videoId!);
    }
  }

  void _playMenuVideo(int videoId) {
    // 백엔드에서 영상 정보 가져오기
    // VideoPlayerScreen으로 전환 또는 오버레이에서 재생
  }
}
```

---

## Phase 2: Flutter XML 편집기 앱 생성

### 2.1 프로젝트 생성
```bash
cd /home/user/kiosk-management
flutter create coffee_menu_editor
cd coffee_menu_editor
```

### 2.2 폴더 구조
```
coffee_menu_editor/
├── lib/
│   ├── main.dart
│   ├── models/
│   │   ├── menu_config.dart      # Phase 1과 동일한 모델 재사용
│   │   └── backend_image.dart    # 백엔드 이미지 모델
│   ├── services/
│   │   ├── xml_generator.dart    # XML 생성
│   │   ├── backend_service.dart  # 백엔드 API 호출
│   │   └── image_picker_service.dart
│   ├── screens/
│   │   ├── home_screen.dart      # 메뉴 목록
│   │   ├── category_editor.dart  # 카테고리 편집
│   │   ├── menu_item_editor.dart # 메뉴 아이템 편집
│   │   ├── options_editor.dart   # 옵션 편집
│   │   └── image_selector.dart   # 이미지 선택/업로드
│   └── widgets/
│       ├── menu_item_card.dart
│       └── image_preview.dart
└── pubspec.yaml
```

### 2.3 주요 기능

#### 2.3.1 메인 화면
- XML 파일 열기/저장
- 새 메뉴 생성
- 카테고리 관리
- 메뉴 아이템 목록 (드래그로 순서 변경)

#### 2.3.2 메뉴 아이템 편집기
- 기본 정보 (이름, 가격, 설명)
- 이미지 선택:
  - 백엔드에서 선택 (이미지 API 조회)
  - 로컬에서 업로드 → 백엔드로 전송
  - URL 직접 입력
- 영상 선택:
  - 백엔드에서 선택 (영상 API 조회)
  - URL 직접 입력
- 옵션 활성화 설정

#### 2.3.3 이미지 선택/업로드 화면
```dart
class ImageSelectorScreen extends StatefulWidget {
  @override
  State<ImageSelectorScreen> createState() => _ImageSelectorScreenState();
}

class _ImageSelectorScreenState extends State<ImageSelectorScreen> {
  List<BackendImage> _backendImages = [];

  @override
  void initState() {
    super.initState();
    _loadBackendImages();
  }

  Future<void> _loadBackendImages() async {
    // GET /api/videos?mediaType=IMAGE
    final response = await http.get(
      Uri.parse('$baseUrl/api/videos?mediaType=IMAGE'),
      headers: {'X-Kiosk-Id': kioskId},
    );

    final List<dynamic> data = jsonDecode(response.body);
    setState(() {
      _backendImages = data.map((e) => BackendImage.fromJson(e)).toList();
    });
  }

  Future<void> _uploadImage(File imageFile) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/videos/upload'),
    );

    request.files.add(
      await http.MultipartFile.fromPath('file', imageFile.path),
    );
    request.fields['title'] = 'Menu Image';
    request.fields['description'] = 'Uploaded from menu editor';

    final response = await request.send();
    // Handle response...
  }

  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('이미지 선택'),
        actions: [
          IconButton(
            icon: Icon(Icons.upload),
            onPressed: _pickAndUploadImage,
          ),
        ],
      ),
      body: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: _backendImages.length,
        itemBuilder: (context, index) {
          final image = _backendImages[index];
          return GestureDetector(
            onTap: () => Navigator.pop(context, image),
            child: Card(
              child: Column(
                children: [
                  Expanded(
                    child: Image.network(
                      image.thumbnailUrl,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Text(image.title, maxLines: 1),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
```

#### 2.3.4 XML 생성기
**파일**: `coffee_menu_editor/lib/services/xml_generator.dart`

```dart
class XmlGenerator {
  static String generateXml(KioskMenuConfig config) {
    final builder = XmlBuilder();

    builder.processing('xml', 'version="1.0" encoding="UTF-8"');
    builder.element('kioskMenu', nest: () {
      // Metadata
      builder.element('metadata', nest: () {
        builder.element('name', nest: config.metadata.name);
        builder.element('version', nest: config.metadata.version);
        builder.element('lastModified', nest: DateTime.now().toIso8601String());
      });

      // Categories
      builder.element('categories', nest: () {
        for (final category in config.categories) {
          builder.element('category', nest: () {
            builder.attribute('id', category.id);
            builder.attribute('name', category.name);
            builder.attribute('nameEn', category.nameEn);
            builder.attribute('icon', category.icon);
          });
        }
      });

      // Menu Items
      builder.element('menuItems', nest: () {
        for (final item in config.menuItems) {
          _buildMenuItem(builder, item);
        }
      });

      // Options, VideoSettings, UISettings...
    });

    return builder.buildDocument().toXmlString(pretty: true);
  }

  static void _buildMenuItem(XmlBuilder builder, MenuItem item) {
    builder.element('item', nest: () {
      builder.attribute('id', item.id);
      builder.attribute('category', item.category);

      builder.element('name', nest: item.name);
      builder.element('nameEn', nest: item.nameEn);
      builder.element('price', nest: item.price.toString());
      builder.element('description', nest: item.description);

      // Images
      if (item.images != null) {
        builder.element('images', nest: () {
          if (item.images!.thumbnailUrl != null) {
            builder.element('thumbnailUrl', nest: item.images!.thumbnailUrl);
          }
          if (item.images!.detailUrl != null) {
            builder.element('detailUrl', nest: item.images!.detailUrl);
          }
          if (item.images!.imageId != null) {
            builder.element('imageId', nest: item.images!.imageId.toString());
          }
        });
      }

      // Video
      if (item.video != null) {
        builder.element('video', nest: () {
          if (item.video!.videoId != null) {
            builder.element('videoId', nest: item.video!.videoId.toString());
          }
          if (item.video!.videoUrl != null) {
            builder.element('videoUrl', nest: item.video!.videoUrl);
          }
          builder.element('autoPlay', nest: item.video!.autoPlay.toString());
        });
      }

      builder.element('available', nest: item.available.toString());

      // Options...
    });
  }
}
```

#### 2.3.5 파일 저장/불러오기
- Windows: `file_picker` 패키지 사용
- XML 내보내기 (로컬 파일로 저장)
- XML 가져오기 (파일에서 로드)
- 백엔드 업로드 (선택사항)

---

## Phase 3: 백엔드 연동

### 3.1 키오스크 메뉴 XML 관리 API

#### 3.1.1 Entity 추가
**파일**: `backend/src/main/java/com/kiosk/backend/entity/KioskMenuConfig.java` (NEW)

```java
@Entity
@Table(name = "kiosk_menu_configs")
public class KioskMenuConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 12)
    private String kioskId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String version;

    @Column(columnDefinition = "TEXT")
    private String xmlContent;

    @Column
    private String s3Url;  // S3에 저장된 XML 파일 URL

    @Column(nullable = false)
    private Boolean active = true;

    @Column(nullable = false)
    private Boolean deleted = false;

    @Column
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;
}
```

#### 3.1.2 Controller 추가
**파일**: `backend/src/main/java/com/kiosk/backend/controller/KioskMenuController.java` (NEW)

```java
@RestController
@RequestMapping("/api/kiosk-menu")
public class KioskMenuController {

    // XML 업로드
    @PostMapping("/upload")
    public ResponseEntity<?> uploadMenuXml(
        @RequestParam("file") MultipartFile file,
        @RequestParam("kioskId") String kioskId,
        @RequestParam("name") String name,
        @RequestParam("version") String version
    ) {
        // Validate XML
        // Save to S3
        // Save metadata to database
    }

    // 키오스크의 활성 메뉴 가져오기
    @GetMapping("/{kioskId}")
    public ResponseEntity<String> getActiveMenu(@PathVariable String kioskId) {
        // Return XML content
    }

    // 메뉴 목록 조회
    @GetMapping("/{kioskId}/list")
    public ResponseEntity<List<KioskMenuConfig>> getMenuList(@PathVariable String kioskId) {
        // Return menu history
    }

    // 메뉴 활성화
    @PutMapping("/{id}/activate")
    public ResponseEntity<?> activateMenu(@PathVariable Long id) {
        // Set active = true, deactivate others
    }
}
```

### 3.2 이미지 API 개선
현재 백엔드는 이미 이미지 업로드를 지원합니다:
- `/api/videos/upload` - mediaType을 확인해 IMAGE 처리
- `/api/videos?mediaType=IMAGE` - 이미지 목록 조회 (구현 필요)

**파일**: `backend/src/main/java/com/kiosk/backend/controller/VideoController.java`

```java
// 미디어 타입별 조회 추가
@GetMapping
public ResponseEntity<List<VideoDTO>> getVideosByMediaType(
    @RequestParam(required = false) String mediaType
) {
    if (mediaType != null) {
        MediaType type = MediaType.valueOf(mediaType);
        return ResponseEntity.ok(videoService.getVideosByMediaType(type));
    }
    return ResponseEntity.ok(videoService.getAllVideos());
}
```

---

## Phase 4: 테스트 및 배포

### 4.1 테스트 시나리오

1. **XML 생성 테스트**
   - 편집기 앱에서 메뉴 생성
   - XML 파일 내보내기
   - XML 유효성 검사

2. **키오스크 앱 로딩 테스트**
   - XML 파일 로컬 로드
   - 메뉴 표시 확인
   - 이미지 로딩 확인

3. **이미지 업로드 테스트**
   - 편집기에서 이미지 업로드
   - S3 저장 확인
   - 키오스크에서 이미지 표시 확인

4. **영상 재생 테스트**
   - 메뉴 선택 시 영상 재생
   - 자동 재생 설정 확인

5. **백엔드 API 테스트**
   - XML 업로드/다운로드
   - 버전 관리
   - 메뉴 활성화

### 4.2 배포

1. **편집기 앱**
   - Windows 실행 파일 빌드
   - 관리자용 배포

2. **키오스크 앱**
   - XML 로더 기능 추가
   - 기존 Flutter 앱 업데이트

3. **백엔드**
   - KioskMenuController 배포
   - S3 버킷 권한 설정

---

## 예상 개발 시간

- **Phase 1** (키오스크 XML 파싱): 4-6시간
- **Phase 2** (편집기 앱): 12-16시간
- **Phase 3** (백엔드 API): 4-6시간
- **Phase 4** (테스트): 3-4시간

**총 예상 시간**: 23-32시간

---

## 다음 단계

원하시는 방향을 선택해주세요:

1. **Phase 1부터 순차 구현** - 키오스크 앱에 XML 파싱 기능 추가
2. **편집기 앱 먼저 개발** - XML 생성 도구부터 만들기
3. **프로토타입 먼저** - 간단한 버전으로 개념 검증

어떤 방향으로 진행할까요?
