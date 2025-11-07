import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/menu_config.dart';
import 'xml_generator.dart';
import 'xml_menu_parser.dart';

class MenuService extends ChangeNotifier {
  List<MenuConfig> _menus = [MenuConfig.empty()];
  int _activeMenuIndex = 0;
  final Uuid _uuid = const Uuid();

  // Selection state
  String? _selectedNodeId; // 'menu:0', 'category:coffee', 'item:coffee_abc123'
  String? _selectedNodeType; // 'menu', 'category', 'item'

  // Getters
  List<MenuConfig> get menus => _menus;
  MenuConfig get activeMenu => _menus[_activeMenuIndex];
  int get activeMenuIndex => _activeMenuIndex;
  String? get selectedNodeId => _selectedNodeId;
  String? get selectedNodeType => _selectedNodeType;

  // For backward compatibility
  MenuConfig get config => activeMenu;

  // Selection operations
  void selectMenu(int index) {
    _selectedNodeType = 'menu';
    _selectedNodeId = 'menu:$index';
    _activeMenuIndex = index;
    notifyListeners();
  }

  void selectCategory(String categoryId) {
    _selectedNodeType = 'category';
    _selectedNodeId = 'category:$categoryId';
    notifyListeners();
  }

  void selectItem(String itemId) {
    _selectedNodeType = 'item';
    _selectedNodeId = 'item:$itemId';
    notifyListeners();
  }

  void clearSelection() {
    _selectedNodeType = null;
    _selectedNodeId = null;
    notifyListeners();
  }

  // Menu operations
  void addMenu(MenuConfig menu) {
    _menus.add(menu);
    _activeMenuIndex = _menus.length - 1;
    notifyListeners();
  }

  void deleteMenu(int index) {
    if (index >= 0 && index < _menus.length && _menus.length > 1) {
      _menus.removeAt(index);
      if (_activeMenuIndex >= _menus.length) {
        _activeMenuIndex = _menus.length - 1;
      }
      clearSelection();
      notifyListeners();
    }
  }

  void setActiveMenu(int index) {
    if (index >= 0 && index < _menus.length) {
      _activeMenuIndex = index;
      clearSelection();
      notifyListeners();
    }
  }

  // Load menu from XML string (replaces active menu)
  void loadFromXml(String xmlContent) {
    try {
      final loadedMenu = XmlMenuParser.parseXml(xmlContent);
      _menus[_activeMenuIndex] = loadedMenu;
      clearSelection();
      notifyListeners();
    } catch (e) {
      print('Error loading XML: $e');
      rethrow;
    }
  }

  // Generate XML from active menu
  String generateXml() {
    return XmlGenerator.generateXml(activeMenu);
  }

  // Create new empty menu
  void createNewMenu() {
    final newMenu = MenuConfig.empty();
    newMenu.metadata.name = '새 메뉴 ${_menus.length + 1}';
    _menus.add(newMenu);
    _activeMenuIndex = _menus.length - 1;
    selectMenu(_activeMenuIndex);
    notifyListeners();
  }

  // Update metadata
  void updateMetadata(String name, String version) {
    activeMenu.metadata.name = name;
    activeMenu.metadata.version = version;
    activeMenu.metadata.lastModified = DateTime.now().toIso8601String();
    notifyListeners();
  }

  // Category operations
  void addCategory(MenuCategory category) {
    activeMenu.categories.add(category);
    notifyListeners();
  }

  void updateCategory(int index, MenuCategory category) {
    if (index >= 0 && index < activeMenu.categories.length) {
      activeMenu.categories[index] = category;
      notifyListeners();
    }
  }

  void deleteCategory(int index) {
    if (index >= 0 && index < activeMenu.categories.length) {
      final categoryId = activeMenu.categories[index].id;
      activeMenu.categories.removeAt(index);
      // Also remove menu items in this category
      activeMenu.menuItems.removeWhere((item) => item.category == categoryId);
      notifyListeners();
    }
  }

  // Menu item operations
  void addMenuItem(MenuItem item) {
    activeMenu.menuItems.add(item);
    notifyListeners();
  }

  void updateMenuItem(int index, MenuItem item) {
    if (index >= 0 && index < activeMenu.menuItems.length) {
      activeMenu.menuItems[index] = item;
      notifyListeners();
    }
  }

  void deleteMenuItem(int index) {
    if (index >= 0 && index < activeMenu.menuItems.length) {
      activeMenu.menuItems.removeAt(index);
      notifyListeners();
    }
  }

  void reorderMenuItems(int oldIndex, int newIndex) {
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
    final item = activeMenu.menuItems.removeAt(oldIndex);
    activeMenu.menuItems.insert(newIndex, item);

    // Update order values
    for (int i = 0; i < activeMenu.menuItems.length; i++) {
      activeMenu.menuItems[i].order = i + 1;
    }
    notifyListeners();
  }

  // Get menu items by category
  List<MenuItem> getMenuItemsByCategory(String categoryId) {
    return activeMenu.menuItems
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
