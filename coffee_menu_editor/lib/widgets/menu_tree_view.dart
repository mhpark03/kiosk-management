import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/menu_service.dart';
import '../models/menu_config.dart';

class MenuTreeView extends StatelessWidget {
  const MenuTreeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<MenuService>(
      builder: (context, menuService, child) {
        return ListView(
          padding: const EdgeInsets.all(8),
          children: [
            // Menus header
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Row(
                children: [
                  const Icon(Icons.menu_book, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Menus',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.add, size: 20),
                    tooltip: 'Add Menu',
                    onPressed: () => menuService.createNewMenu(),
                  ),
                ],
              ),
            ),
            const Divider(),

            // Menu list
            ...menuService.menus.asMap().entries.map((entry) {
              final index = entry.key;
              final menu = entry.value;
              return _buildMenuNode(context, menuService, index, menu);
            }),
          ],
        );
      },
    );
  }

  Widget _buildMenuNode(
    BuildContext context,
    MenuService menuService,
    int menuIndex,
    MenuConfig menu,
  ) {
    final isActive = menuService.activeMenuIndex == menuIndex;
    final isSelected = menuService.selectedNodeType == 'menu' &&
        menuService.selectedNodeId == 'menu:$menuIndex';

    return Card(
      color: isSelected ? Colors.brown.shade50 : null,
      child: ExpansionTile(
        leading: Icon(
          Icons.restaurant_menu,
          color: isActive ? Colors.brown.shade700 : Colors.grey.shade600,
        ),
        title: Text(
          menu.metadata.name,
          style: TextStyle(
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        subtitle: Text('${menu.menuItems.length} items'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.add, size: 18),
              tooltip: 'Add Category',
              onPressed: () {
                menuService.setActiveMenu(menuIndex);
                _showAddCategoryDialog(context, menuService);
              },
            ),
            if (menuService.menus.length > 1)
              IconButton(
                icon: const Icon(Icons.delete, size: 18, color: Colors.red),
                tooltip: 'Delete Menu',
                onPressed: () => _confirmDeleteMenu(context, menuService, menuIndex),
              ),
          ],
        ),
        onExpansionChanged: (expanded) {
          if (expanded) {
            menuService.setActiveMenu(menuIndex);
          }
        },
        initiallyExpanded: isActive,
        children: [
          // Categories
          ...menu.categories.map((category) {
            return _buildCategoryNode(context, menuService, category);
          }),
        ],
      ),
    );
  }

  Widget _buildCategoryNode(
    BuildContext context,
    MenuService menuService,
    MenuCategory category,
  ) {
    final isSelected = menuService.selectedNodeType == 'category' &&
        menuService.selectedNodeId == 'category:${category.id}';

    final items = menuService.getMenuItemsByCategory(category.id);

    return Padding(
      padding: const EdgeInsets.only(left: 16.0),
      child: Card(
        color: isSelected ? Colors.brown.shade50 : null,
        child: ExpansionTile(
          leading: Icon(
            _getIconData(category.icon),
            color: Colors.brown.shade700,
            size: 20,
          ),
          title: Text(category.name),
          subtitle: Text('${items.length} items'),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.add, size: 16),
                tooltip: 'Add Item',
                onPressed: () {
                  menuService.selectCategory(category.id);
                  _showAddItemDialog(context, menuService, category.id);
                },
              ),
              IconButton(
                icon: const Icon(Icons.edit, size: 16),
                tooltip: 'Edit Category',
                onPressed: () {
                  menuService.selectCategory(category.id);
                },
              ),
            ],
          ),
          onExpansionChanged: (expanded) {
            if (expanded) {
              menuService.selectCategory(category.id);
            }
          },
          children: [
            // Menu items
            ...items.map((item) {
              return _buildItemNode(context, menuService, item);
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildItemNode(
    BuildContext context,
    MenuService menuService,
    MenuItem item,
  ) {
    final isSelected = menuService.selectedNodeType == 'item' &&
        menuService.selectedNodeId == 'item:${item.id}';

    return Padding(
      padding: const EdgeInsets.only(left: 32.0),
      child: ListTile(
        dense: true,
        selected: isSelected,
        selectedTileColor: Colors.brown.shade50,
        leading: const Icon(Icons.local_cafe, size: 16),
        title: Text(item.name, style: const TextStyle(fontSize: 14)),
        subtitle: Text(
          '₩${item.price.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
          style: const TextStyle(fontSize: 12),
        ),
        onTap: () {
          menuService.selectItem(item.id);
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
      case 'restaurant_menu':
        return Icons.restaurant_menu;
      case 'icecream':
        return Icons.icecream;
      case 'lunch_dining':
        return Icons.lunch_dining;
      case 'local_cafe':
        return Icons.local_cafe;
      default:
        return Icons.restaurant_menu;
    }
  }

  void _showAddCategoryDialog(BuildContext context, MenuService menuService) {
    // TODO: Show category editor dialog
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Use detail panel to add category')),
    );
  }

  void _showAddItemDialog(
    BuildContext context,
    MenuService menuService,
    String categoryId,
  ) {
    // TODO: Show item editor dialog
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Use detail panel to add item')),
    );
  }

  void _confirmDeleteMenu(
    BuildContext context,
    MenuService menuService,
    int index,
  ) {
    final menu = menuService.menus[index];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Menu'),
        content: Text('Delete "${menu.metadata.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              menuService.deleteMenu(index);
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
