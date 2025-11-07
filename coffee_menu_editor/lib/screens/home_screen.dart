import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import '../services/menu_service.dart';
import '../models/menu_config.dart';
import 'menu_item_editor_screen.dart';
import 'category_editor_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Coffee Menu Editor'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          // New menu
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            tooltip: 'New Menu',
            onPressed: () => _showNewMenuDialog(context),
          ),
          // Open XML
          IconButton(
            icon: const Icon(Icons.folder_open),
            tooltip: 'Open XML',
            onPressed: () => _openXmlFile(context),
          ),
          // Save XML
          IconButton(
            icon: const Icon(Icons.save),
            tooltip: 'Save XML',
            onPressed: () => _saveXmlFile(context),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Consumer<MenuService>(
        builder: (context, menuService, child) {
          final config = menuService.config;

          return Row(
            children: [
              // Left sidebar - Categories
              Container(
                width: 250,
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  border: Border(
                    right: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
                child: Column(
                  children: [
                    // Categories header
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.brown.shade700,
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.category, color: Colors.white),
                          const SizedBox(width: 8),
                          const Text(
                            'Categories',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Spacer(),
                          IconButton(
                            icon: const Icon(Icons.add, color: Colors.white),
                            onPressed: () => _showCategoryEditor(context, null),
                          ),
                        ],
                      ),
                    ),

                    // Categories list
                    Expanded(
                      child: ListView.builder(
                        itemCount: config.categories.length,
                        itemBuilder: (context, index) {
                          final category = config.categories[index];
                          final itemCount =
                              menuService.getMenuItemsByCategory(category.id).length;

                          return ListTile(
                            leading: Icon(
                              _getIconData(category.icon),
                              color: Colors.brown.shade700,
                            ),
                            title: Text(category.name),
                            subtitle: Text('${category.nameEn} ($itemCount items)'),
                            trailing: IconButton(
                              icon: const Icon(Icons.edit, size: 20),
                              onPressed: () => _showCategoryEditor(context, index),
                            ),
                          );
                        },
                      ),
                    ),

                    // Menu metadata
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        border: Border(
                          top: BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            config.metadata.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Version: ${config.metadata.version}',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            'Items: ${config.menuItems.length}',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Main content - Menu items
              Expanded(
                child: Column(
                  children: [
                    // Header
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border(
                          bottom: BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.restaurant_menu),
                          const SizedBox(width: 8),
                          const Text(
                            'Menu Items',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Spacer(),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.add),
                            label: const Text('Add Item'),
                            onPressed: () => _showMenuItemEditor(context, null),
                          ),
                        ],
                      ),
                    ),

                    // Menu items list
                    Expanded(
                      child: config.menuItems.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.restaurant_menu,
                                    size: 64,
                                    color: Colors.grey.shade400,
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    'No menu items yet',
                                    style: TextStyle(
                                      color: Colors.grey.shade600,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  ElevatedButton.icon(
                                    icon: const Icon(Icons.add),
                                    label: const Text('Add First Item'),
                                    onPressed: () => _showMenuItemEditor(context, null),
                                  ),
                                ],
                              ),
                            )
                          : ReorderableListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: config.menuItems.length,
                              onReorder: (oldIndex, newIndex) {
                                menuService.reorderMenuItems(oldIndex, newIndex);
                              },
                              itemBuilder: (context, index) {
                                final item = config.menuItems[index];
                                final category = config.categories.firstWhere(
                                  (cat) => cat.id == item.category,
                                  orElse: () => MenuCategory(
                                    id: '',
                                    name: 'Unknown',
                                    nameEn: 'Unknown',
                                    icon: 'help',
                                    order: 0,
                                  ),
                                );

                                return Card(
                                  key: ValueKey(item.id),
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: ListTile(
                                    leading: CircleAvatar(
                                      backgroundColor: Colors.brown.shade100,
                                      child: Icon(
                                        _getIconData(category.icon),
                                        color: Colors.brown.shade700,
                                      ),
                                    ),
                                    title: Text(
                                      item.name,
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                    subtitle: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(item.nameEn),
                                        Text(
                                          '₩${item.price.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                                          style: TextStyle(
                                            color: Colors.brown.shade700,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        // Category badge
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 4,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.brown.shade100,
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            category.name,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.brown.shade700,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          icon: const Icon(Icons.edit),
                                          onPressed: () =>
                                              _showMenuItemEditor(context, index),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete, color: Colors.red),
                                          onPressed: () => _confirmDelete(context, index),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  IconData _getIconData(String iconName) {
    switch (iconName) {
      case 'coffee':
        return Icons.coffee;
      case 'local_drink':
        return Icons.local_drink;
      case 'cake':
        return Icons.cake;
      case 'fastfood':
        return Icons.fastfood;
      default:
        return Icons.restaurant_menu;
    }
  }

  void _showNewMenuDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create New Menu'),
        content: const Text(
          'This will discard the current menu. Are you sure?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Provider.of<MenuService>(context, listen: false).createNewMenu();
              Navigator.pop(context);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  Future<void> _openXmlFile(BuildContext context) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xml'],
      );

      if (result != null && result.files.single.path != null) {
        final file = File(result.files.single.path!);
        final xmlContent = await file.readAsString();

        if (context.mounted) {
          Provider.of<MenuService>(context, listen: false).loadFromXml(xmlContent);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Menu loaded successfully')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading file: $e')),
        );
      }
    }
  }

  Future<void> _saveXmlFile(BuildContext context) async {
    try {
      final menuService = Provider.of<MenuService>(context, listen: false);
      final xmlContent = menuService.generateXml();

      final result = await FilePicker.platform.saveFile(
        dialogTitle: 'Save Menu XML',
        fileName: 'coffee_menu.xml',
        type: FileType.custom,
        allowedExtensions: ['xml'],
      );

      if (result != null) {
        final file = File(result);
        await file.writeAsString(xmlContent);

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Menu saved successfully')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving file: $e')),
        );
      }
    }
  }

  void _showCategoryEditor(BuildContext context, int? index) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CategoryEditorScreen(categoryIndex: index),
      ),
    );
  }

  void _showMenuItemEditor(BuildContext context, int? index) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => MenuItemEditorScreen(itemIndex: index),
      ),
    );
  }

  void _confirmDelete(BuildContext context, int index) {
    final menuService = Provider.of<MenuService>(context, listen: false);
    final item = menuService.config.menuItems[index];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Item'),
        content: Text('Delete "${item.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              menuService.deleteMenuItem(index);
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
