// Menu configuration models for XML-based kiosk menu system
// Enhanced version with mutable properties for editing

class MenuConfig {
  MenuMetadata metadata;
  List<MenuCategory> categories;
  List<MenuItem> menuItems;
  MenuOptions options;

  MenuConfig({
    required this.metadata,
    required this.categories,
    required this.menuItems,
    required this.options,
  });

  // Create default empty menu
  factory MenuConfig.empty() {
    return MenuConfig(
      metadata: MenuMetadata(
        name: '새 메뉴',
        version: '1.0.0',
        lastModified: DateTime.now().toIso8601String(),
      ),
      categories: [
        MenuCategory(
          id: 'coffee',
          name: '커피',
          nameEn: 'Coffee',
          icon: 'coffee',
          order: 1,
        ),
        MenuCategory(
          id: 'beverage',
          name: '음료',
          nameEn: 'Beverage',
          icon: 'local_drink',
          order: 2,
        ),
        MenuCategory(
          id: 'dessert',
          name: '디저트',
          nameEn: 'Dessert',
          icon: 'cake',
          order: 3,
        ),
      ],
      menuItems: [],
      options: MenuOptions(
        sizes: [
          SizeOption(id: 'small', name: 'Small', nameKo: '스몰', additionalPrice: 0),
          SizeOption(id: 'medium', name: 'Medium (R)', nameKo: '미디움', additionalPrice: 500),
          SizeOption(id: 'large', name: 'Large', nameKo: '라지', additionalPrice: 1000),
        ],
        temperatures: [
          TemperatureOption(id: 'hot', name: 'Hot', nameKo: '따뜻하게'),
          TemperatureOption(id: 'iced', name: 'Iced', nameKo: '차갑게'),
        ],
        extras: [
          ExtraOption(id: 'shot', name: '샷 추가', nameEn: 'Extra Shot', additionalPrice: 500),
          ExtraOption(id: 'syrup', name: '시럽 추가', nameEn: 'Syrup', additionalPrice: 500),
          ExtraOption(id: 'whipped', name: '휘핑크림', nameEn: 'Whipped Cream', additionalPrice: 500),
        ],
      ),
    );
  }
}

class MenuMetadata {
  String name;
  String version;
  String lastModified;
  String description;
  String filename;

  MenuMetadata({
    required this.name,
    required this.version,
    required this.lastModified,
    this.description = '',
    this.filename = 'coffee_menu.xml',
  });
}

class MenuCategory {
  String id;
  String name;
  String nameEn;
  String icon;
  int order;

  MenuCategory({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.icon,
    required this.order,
  });

  MenuCategory copyWith({
    String? id,
    String? name,
    String? nameEn,
    String? icon,
    int? order,
  }) {
    return MenuCategory(
      id: id ?? this.id,
      name: name ?? this.name,
      nameEn: nameEn ?? this.nameEn,
      icon: icon ?? this.icon,
      order: order ?? this.order,
    );
  }
}

class MenuItem {
  String id;
  String category;
  String name;
  String nameEn;
  int price;
  String description;
  String? thumbnailUrl;
  bool available;
  int order;

  // Option flags
  bool sizeEnabled;
  bool temperatureEnabled;
  bool extrasEnabled;

  MenuItem({
    required this.id,
    required this.category,
    required this.name,
    required this.nameEn,
    required this.price,
    required this.description,
    this.thumbnailUrl,
    this.available = true,
    required this.order,
    this.sizeEnabled = true,
    this.temperatureEnabled = true,
    this.extrasEnabled = true,
  });

  MenuItem copyWith({
    String? id,
    String? category,
    String? name,
    String? nameEn,
    int? price,
    String? description,
    String? thumbnailUrl,
    bool? available,
    int? order,
    bool? sizeEnabled,
    bool? temperatureEnabled,
    bool? extrasEnabled,
  }) {
    return MenuItem(
      id: id ?? this.id,
      category: category ?? this.category,
      name: name ?? this.name,
      nameEn: nameEn ?? this.nameEn,
      price: price ?? this.price,
      description: description ?? this.description,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      available: available ?? this.available,
      order: order ?? this.order,
      sizeEnabled: sizeEnabled ?? this.sizeEnabled,
      temperatureEnabled: temperatureEnabled ?? this.temperatureEnabled,
      extrasEnabled: extrasEnabled ?? this.extrasEnabled,
    );
  }
}

class MenuOptions {
  List<SizeOption> sizes;
  List<TemperatureOption> temperatures;
  List<ExtraOption> extras;

  MenuOptions({
    required this.sizes,
    required this.temperatures,
    required this.extras,
  });
}

class SizeOption {
  String id;
  String name;
  String nameKo;
  int additionalPrice;

  SizeOption({
    required this.id,
    required this.name,
    required this.nameKo,
    this.additionalPrice = 0,
  });
}

class TemperatureOption {
  String id;
  String name;
  String nameKo;

  TemperatureOption({
    required this.id,
    required this.name,
    required this.nameKo,
  });
}

class ExtraOption {
  String id;
  String name;
  String nameEn;
  int additionalPrice;

  ExtraOption({
    required this.id,
    required this.name,
    required this.nameEn,
    this.additionalPrice = 0,
  });
}
