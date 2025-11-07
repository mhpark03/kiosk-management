import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/menu_config.dart';
import 'xml_generator.dart';
import 'xml_menu_parser.dart';

class MenuService extends ChangeNotifier {
  MenuConfig _config = MenuConfig.empty();
  final Uuid _uuid = const Uuid();

  MenuConfig get config => _config;

  // Load menu from XML string
  void loadFromXml(String xmlContent) {
    try {
      _config = XmlMenuParser.parseXml(xmlContent);
      notifyListeners();
    } catch (e) {
      print('Error loading XML: $e');
      rethrow;
    }
  }

  // Generate XML from current config
  String generateXml() {
    return XmlGenerator.generateXml(_config);
  }

  // Create new empty menu
  void createNewMenu() {
    _config = MenuConfig.empty();
    notifyListeners();
  }

  // Update metadata
  void updateMetadata(String name, String version) {
    _config.metadata.name = name;
    _config.metadata.version = version;
    _config.metadata.lastModified = DateTime.now().toIso8601String();
    notifyListeners();
  }

  // Category operations
  void addCategory(MenuCategory category) {
    _config.categories.add(category);
    notifyListeners();
  }

  void updateCategory(int index, MenuCategory category) {
    if (index >= 0 && index < _config.categories.length) {
      _config.categories[index] = category;
      notifyListeners();
    }
  }

  void deleteCategory(int index) {
    if (index >= 0 && index < _config.categories.length) {
      final categoryId = _config.categories[index].id;
      _config.categories.removeAt(index);
      // Also remove menu items in this category
      _config.menuItems.removeWhere((item) => item.category == categoryId);
      notifyListeners();
    }
  }

  // Menu item operations
  void addMenuItem(MenuItem item) {
    _config.menuItems.add(item);
    notifyListeners();
  }

  void updateMenuItem(int index, MenuItem item) {
    if (index >= 0 && index < _config.menuItems.length) {
      _config.menuItems[index] = item;
      notifyListeners();
    }
  }

  void deleteMenuItem(int index) {
    if (index >= 0 && index < _config.menuItems.length) {
      _config.menuItems.removeAt(index);
      notifyListeners();
    }
  }

  void reorderMenuItems(int oldIndex, int newIndex) {
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
    final item = _config.menuItems.removeAt(oldIndex);
    _config.menuItems.insert(newIndex, item);

    // Update order values
    for (int i = 0; i < _config.menuItems.length; i++) {
      _config.menuItems[i].order = i + 1;
    }
    notifyListeners();
  }

  // Get menu items by category
  List<MenuItem> getMenuItemsByCategory(String categoryId) {
    return _config.menuItems
        .where((item) => item.category == categoryId)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  // Generate unique ID
  String generateId(String prefix) {
    return '${prefix}_${_uuid.v4().substring(0, 8)}';
  }

  // Get next order number for category
  int getNextOrderForCategory(String categoryId) {
    final items = getMenuItemsByCategory(categoryId);
    if (items.isEmpty) return 1;
    return items.map((e) => e.order).reduce((a, b) => a > b ? a : b) + 1;
  }
}
