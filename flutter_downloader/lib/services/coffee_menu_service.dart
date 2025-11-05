import '../models/coffee_menu_item.dart';

class CoffeeMenuService {
  // Singleton pattern
  static final CoffeeMenuService _instance = CoffeeMenuService._internal();
  factory CoffeeMenuService() => _instance;
  CoffeeMenuService._internal();

  // Sample menu data (will be replaced with backend API later)
  List<CoffeeMenuItem> getSampleMenu() {
    return [
      // Coffee
      CoffeeMenuItem(
        id: 'coffee_americano',
        name: '아메리카노',
        nameEn: 'Americano',
        price: 4000,
        category: 'coffee',
        description: '진한 에스프레소에 물을 더한 커피',
      ),
      CoffeeMenuItem(
        id: 'coffee_latte',
        name: '카페 라떼',
        nameEn: 'Cafe Latte',
        price: 4500,
        category: 'coffee',
        description: '부드러운 우유와 에스프레소의 조화',
      ),
      CoffeeMenuItem(
        id: 'coffee_cappuccino',
        name: '카푸치노',
        nameEn: 'Cappuccino',
        price: 4500,
        category: 'coffee',
        description: '풍부한 우유 거품이 특징인 커피',
      ),
      CoffeeMenuItem(
        id: 'coffee_caramel',
        name: '카라멜 마끼아또',
        nameEn: 'Caramel Macchiato',
        price: 5000,
        category: 'coffee',
        description: '달콤한 카라멜과 에스프레소의 만남',
      ),
      CoffeeMenuItem(
        id: 'coffee_vanilla',
        name: '바닐라 라떼',
        nameEn: 'Vanilla Latte',
        price: 5000,
        category: 'coffee',
        description: '부드러운 바닐라 향이 가득한 라떼',
      ),

      // Beverage
      CoffeeMenuItem(
        id: 'bev_greentea',
        name: '녹차 라떼',
        nameEn: 'Green Tea Latte',
        price: 5000,
        category: 'beverage',
        description: '진한 녹차와 우유의 조화',
      ),
      CoffeeMenuItem(
        id: 'bev_choco',
        name: '초코 라떼',
        nameEn: 'Chocolate Latte',
        price: 5000,
        category: 'beverage',
        description: '달콤한 초콜릿 음료',
      ),
      CoffeeMenuItem(
        id: 'bev_strawberry',
        name: '딸기 스무디',
        nameEn: 'Strawberry Smoothie',
        price: 5500,
        category: 'beverage',
        description: '신선한 딸기로 만든 시원한 스무디',
      ),

      // Dessert
      CoffeeMenuItem(
        id: 'dessert_cookie',
        name: '초콜릿 쿠키',
        nameEn: 'Chocolate Cookie',
        price: 3000,
        category: 'dessert',
        description: '바삭한 초콜릿 쿠키',
      ),
      CoffeeMenuItem(
        id: 'dessert_cake',
        name: '치즈 케이크',
        nameEn: 'Cheese Cake',
        price: 6000,
        category: 'dessert',
        description: '부드러운 뉴욕 스타일 치즈케이크',
      ),
      CoffeeMenuItem(
        id: 'dessert_muffin',
        name: '블루베리 머핀',
        nameEn: 'Blueberry Muffin',
        price: 3500,
        category: 'dessert',
        description: '촉촉한 블루베리 머핀',
      ),
    ];
  }

  List<CoffeeMenuItem> getMenuByCategory(String category) {
    return getSampleMenu().where((item) => item.category == category).toList();
  }

  CoffeeMenuItem? getMenuItemById(String id) {
    try {
      return getSampleMenu().firstWhere((item) => item.id == id);
    } catch (e) {
      return null;
    }
  }

  List<String> getCategories() {
    return ['coffee', 'beverage', 'dessert'];
  }

  String getCategoryDisplayName(String category) {
    switch (category) {
      case 'coffee':
        return '커피';
      case 'beverage':
        return '음료';
      case 'dessert':
        return '디저트';
      default:
        return category;
    }
  }
}
