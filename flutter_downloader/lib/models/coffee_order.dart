import 'coffee_menu_item.dart';

class OrderItem {
  final CoffeeMenuItem menuItem;
  final String size; // 'small', 'medium', 'large'
  final String temperature; // 'hot', 'iced'
  final List<String> extras; // ['shot', 'syrup', 'whipped']
  int quantity;
  final String? specialInstructions;

  OrderItem({
    required this.menuItem,
    this.size = 'medium',
    this.temperature = 'hot',
    this.extras = const [],
    this.quantity = 1,
    this.specialInstructions,
  });

  int get totalPrice {
    int basePrice = menuItem.price;

    // Add size price
    final sizeOption = CoffeeOptions.sizes.firstWhere(
      (s) => s.id == size,
      orElse: () => CoffeeOptions.sizes[1], // default medium
    );
    basePrice += sizeOption.additionalPrice;

    // Add extras price
    for (final extraId in extras) {
      final extra = CoffeeOptions.extras.firstWhere(
        (e) => e.id == extraId,
        orElse: () => CoffeeOption(id: '', name: '', additionalPrice: 0),
      );
      basePrice += extra.additionalPrice;
    }

    return basePrice * quantity;
  }

  Map<String, dynamic> toJson() {
    return {
      'menuItem': menuItem.toJson(),
      'size': size,
      'temperature': temperature,
      'extras': extras,
      'quantity': quantity,
      'specialInstructions': specialInstructions,
      'totalPrice': totalPrice,
    };
  }

  // Create a copy with modified properties
  OrderItem copyWith({
    CoffeeMenuItem? menuItem,
    String? size,
    String? temperature,
    List<String>? extras,
    int? quantity,
    String? specialInstructions,
  }) {
    return OrderItem(
      menuItem: menuItem ?? this.menuItem,
      size: size ?? this.size,
      temperature: temperature ?? this.temperature,
      extras: extras ?? this.extras,
      quantity: quantity ?? this.quantity,
      specialInstructions: specialInstructions ?? this.specialInstructions,
    );
  }
}

class CoffeeOrder {
  final String id;
  final List<OrderItem> items;
  final DateTime createdAt;
  String status; // 'pending', 'confirmed', 'preparing', 'completed', 'cancelled'

  CoffeeOrder({
    required this.id,
    required this.items,
    required this.createdAt,
    this.status = 'pending',
  });

  int get totalPrice {
    return items.fold(0, (sum, item) => sum + item.totalPrice);
  }

  int get totalQuantity {
    return items.fold(0, (sum, item) => sum + item.quantity);
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'items': items.map((item) => item.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'status': status,
      'totalPrice': totalPrice,
      'totalQuantity': totalQuantity,
    };
  }

  factory CoffeeOrder.fromJson(Map<String, dynamic> json) {
    return CoffeeOrder(
      id: json['id'] as String,
      items: (json['items'] as List)
          .map((item) => OrderItem(
                menuItem: CoffeeMenuItem.fromJson(item['menuItem']),
                size: item['size'] as String,
                temperature: item['temperature'] as String,
                extras: List<String>.from(item['extras']),
                quantity: item['quantity'] as int,
                specialInstructions: item['specialInstructions'] as String?,
              ))
          .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      status: json['status'] as String,
    );
  }
}
