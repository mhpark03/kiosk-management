import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/menu_service.dart';
import '../models/menu_config.dart';

class DetailPanel extends StatefulWidget {
  const DetailPanel({super.key});

  @override
  State<DetailPanel> createState() => _DetailPanelState();
}

class _DetailPanelState extends State<DetailPanel> {
  @override
  Widget build(BuildContext context) {
    return Consumer<MenuService>(
      builder: (context, menuService, child) {
        final selectedType = menuService.selectedNodeType;
        final selectedId = menuService.selectedNodeId;

        if (selectedType == null || selectedId == null) {
          return _buildEmptyState();
        }

        switch (selectedType) {
          case 'menu':
            return _buildMenuEditor(menuService);
          case 'category':
            final categoryId = selectedId.split(':')[1];
            final category = menuService.activeMenu.categories.firstWhere(
              (c) => c.id == categoryId,
              orElse: () => MenuCategory(
                id: '',
                name: '',
                nameEn: '',
                icon: 'coffee',
                order: 0,
              ),
            );
            return _buildCategoryEditor(menuService, category);
          case 'item':
            final itemId = selectedId.split(':')[1];
            final item = menuService.activeMenu.menuItems.firstWhere(
              (i) => i.id == itemId,
              orElse: () => MenuItem(
                id: '',
                category: '',
                name: '',
                nameEn: '',
                price: 0,
                description: '',
                order: 0,
              ),
            );
            return _buildItemEditor(menuService, item);
          default:
            return _buildEmptyState();
        }
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.touch_app, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(
            'Select an item from the tree',
            style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuEditor(MenuService menuService) {
    final menu = menuService.activeMenu;
    final nameController = TextEditingController(text: menu.metadata.name);
    final versionController = TextEditingController(text: menu.metadata.version);

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.restaurant_menu, size: 28),
              const SizedBox(width: 12),
              const Text(
                'Menu Settings',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 24),

          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Menu Name',
              border: OutlineInputBorder(),
            ),
            onChanged: (value) {
              menu.metadata.name = value;
            },
          ),
          const SizedBox(height: 16),

          TextField(
            controller: versionController,
            decoration: const InputDecoration(
              labelText: 'Version',
              border: OutlineInputBorder(),
            ),
            onChanged: (value) {
              menu.metadata.version = value;
            },
          ),
          const SizedBox(height: 24),

          const Text(
            'Statistics',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          _buildInfoCard('Categories', menu.categories.length.toString()),
          _buildInfoCard('Menu Items', menu.menuItems.length.toString()),
          _buildInfoCard(
            'Last Modified',
            menu.metadata.lastModified.substring(0, 19).replaceAll('T', ' '),
          ),

          const Spacer(),

          ElevatedButton.icon(
            icon: const Icon(Icons.save),
            label: const Text('Save Changes'),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 48),
            ),
            onPressed: () {
              menuService.updateMetadata(
                nameController.text,
                versionController.text,
              );
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Menu updated')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryEditor(MenuService menuService, MenuCategory category) {
    if (category.id.isEmpty) return _buildEmptyState();

    final nameController = TextEditingController(text: category.name);
    final nameEnController = TextEditingController(text: category.nameEn);

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_getIconData(category.icon), size: 28),
              const SizedBox(width: 12),
              const Text(
                'Category Settings',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 24),

          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Category Name (Korean)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          TextField(
            controller: nameEnController,
            decoration: const InputDecoration(
              labelText: 'Category Name (English)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),

          const Text(
            'Icon',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          Text('Current: ${category.icon}'),

          const Spacer(),

          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.save),
                  label: const Text('Save'),
                  onPressed: () {
                    final index = menuService.activeMenu.categories
                        .indexWhere((c) => c.id == category.id);
                    if (index >= 0) {
                      final updated = category.copyWith(
                        name: nameController.text,
                        nameEn: nameEnController.text,
                      );
                      menuService.updateCategory(index, updated);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Category updated')),
                      );
                    }
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label: const Text('Delete'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade50,
                  ),
                  onPressed: () {
                    final index = menuService.activeMenu.categories
                        .indexWhere((c) => c.id == category.id);
                    if (index >= 0) {
                      _confirmDeleteCategory(context, menuService, index, category);
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildItemEditor(MenuService menuService, MenuItem item) {
    if (item.id.isEmpty) return _buildEmptyState();

    final nameController = TextEditingController(text: item.name);
    final nameEnController = TextEditingController(text: item.nameEn);
    final priceController = TextEditingController(text: item.price.toString());
    final descriptionController = TextEditingController(text: item.description);
    final imageUrlController = TextEditingController(text: item.thumbnailUrl ?? '');

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: ListView(
        children: [
          Row(
            children: [
              const Icon(Icons.local_cafe, size: 28),
              const SizedBox(width: 12),
              const Text(
                'Menu Item Settings',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 24),

          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Name (Korean)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          TextField(
            controller: nameEnController,
            decoration: const InputDecoration(
              labelText: 'Name (English)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          TextField(
            controller: priceController,
            decoration: const InputDecoration(
              labelText: 'Price (₩)',
              border: OutlineInputBorder(),
              prefixText: '₩ ',
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: 16),

          TextField(
            controller: descriptionController,
            decoration: const InputDecoration(
              labelText: 'Description',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),

          TextField(
            controller: imageUrlController,
            decoration: const InputDecoration(
              labelText: 'Image URL',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),

          const Text(
            'Options',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SwitchListTile(
            title: const Text('Available'),
            value: item.available,
            onChanged: (value) {
              setState(() {
                item.available = value;
              });
            },
          ),
          SwitchListTile(
            title: const Text('Size Selection'),
            value: item.sizeEnabled,
            onChanged: (value) {
              setState(() {
                item.sizeEnabled = value;
              });
            },
          ),
          SwitchListTile(
            title: const Text('Temperature Selection'),
            value: item.temperatureEnabled,
            onChanged: (value) {
              setState(() {
                item.temperatureEnabled = value;
              });
            },
          ),
          SwitchListTile(
            title: const Text('Extra Options'),
            value: item.extrasEnabled,
            onChanged: (value) {
              setState(() {
                item.extrasEnabled = value;
              });
            },
          ),
          const SizedBox(height: 24),

          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.save),
                  label: const Text('Save'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                  ),
                  onPressed: () {
                    final index = menuService.activeMenu.menuItems
                        .indexWhere((i) => i.id == item.id);
                    if (index >= 0) {
                      final updated = item.copyWith(
                        name: nameController.text,
                        nameEn: nameEnController.text,
                        price: int.tryParse(priceController.text) ?? item.price,
                        description: descriptionController.text,
                        thumbnailUrl: imageUrlController.text.isNotEmpty
                            ? imageUrlController.text
                            : null,
                      );
                      menuService.updateMenuItem(index, updated);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Item updated')),
                      );
                    }
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label: const Text('Delete'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                    backgroundColor: Colors.red.shade50,
                  ),
                  onPressed: () {
                    final index = menuService.activeMenu.menuItems
                        .indexWhere((i) => i.id == item.id);
                    if (index >= 0) {
                      _confirmDeleteItem(context, menuService, index, item);
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(String label, String value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
            Text(value, style: const TextStyle(color: Colors.grey)),
          ],
        ),
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
      default:
        return Icons.restaurant_menu;
    }
  }

  void _confirmDeleteCategory(
    BuildContext context,
    MenuService menuService,
    int index,
    MenuCategory category,
  ) {
    final itemCount = menuService.getMenuItemsByCategory(category.id).length;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Category'),
        content: Text(
          'Delete "${category.name}"?\n\n'
          '${itemCount > 0 ? 'Warning: $itemCount menu items will also be deleted.' : ''}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              menuService.deleteCategory(index);
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Category deleted')),
              );
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

  void _confirmDeleteItem(
    BuildContext context,
    MenuService menuService,
    int index,
    MenuItem item,
  ) {
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
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Item deleted')),
              );
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
