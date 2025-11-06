class CoffeeMenuItem {
  final String id;
  final String name;
  final String nameEn;
  final int price;
  final String category; // 'coffee', 'beverage', 'dessert'
  final String? imageUrl;
  final String description;
  final bool isAvailable;

  CoffeeMenuItem({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.price,
    required this.category,
    this.imageUrl,
    required this.description,
    this.isAvailable = true,
  });

  factory CoffeeMenuItem.fromJson(Map<String, dynamic> json) {
    return CoffeeMenuItem(
      id: json['id'] as String,
      name: json['name'] as String,
      nameEn: json['nameEn'] as String,
      price: json['price'] as int,
      category: json['category'] as String,
      imageUrl: json['imageUrl'] as String?,
      description: json['description'] as String,
      isAvailable: json['isAvailable'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'nameEn': nameEn,
      'price': price,
      'category': category,
      'imageUrl': imageUrl,
      'description': description,
      'isAvailable': isAvailable,
    };
  }
}

// Coffee options (size, temperature, etc.)
class CoffeeOption {
  final String id;
  final String name;
  final int additionalPrice;

  CoffeeOption({
    required this.id,
    required this.name,
    this.additionalPrice = 0,
  });
}

// Predefined options
class CoffeeOptions {
  static final List<CoffeeOption> sizes = [
    CoffeeOption(id: 'small', name: 'Small', additionalPrice: 0),
    CoffeeOption(id: 'medium', name: 'Medium (R)', additionalPrice: 500),
    CoffeeOption(id: 'large', name: 'Large', additionalPrice: 1000),
  ];

  static final List<CoffeeOption> temperatures = [
    CoffeeOption(id: 'hot', name: 'Hot'),
    CoffeeOption(id: 'iced', name: 'Iced'),
  ];

  static final List<CoffeeOption> extras = [
    CoffeeOption(id: 'shot', name: '샷 추가', additionalPrice: 500),
    CoffeeOption(id: 'syrup', name: '시럽 추가', additionalPrice: 500),
    CoffeeOption(id: 'whipped', name: '휘핑크림', additionalPrice: 500),
  ];
}
