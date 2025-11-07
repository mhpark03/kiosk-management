import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../models/menu_config.dart';
import '../services/menu_service.dart';

class CategoryEditorScreen extends StatefulWidget {
  final int? categoryIndex;

  const CategoryEditorScreen({super.key, this.categoryIndex});

  @override
  State<CategoryEditorScreen> createState() => _CategoryEditorScreenState();
}

class _CategoryEditorScreenState extends State<CategoryEditorScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _idController;
  late TextEditingController _nameController;
  late TextEditingController _nameEnController;
  late TextEditingController _orderController;

  String _selectedIcon = 'coffee';

  final List<Map<String, dynamic>> _availableIcons = [
    {'name': 'coffee', 'icon': Icons.coffee},
    {'name': 'local_drink', 'icon': Icons.local_drink},
    {'name': 'cake', 'icon': Icons.cake},
    {'name': 'fastfood', 'icon': Icons.fastfood},
    {'name': 'restaurant_menu', 'icon': Icons.restaurant_menu},
    {'name': 'icecream', 'icon': Icons.icecream},
    {'name': 'lunch_dining', 'icon': Icons.lunch_dining},
    {'name': 'local_cafe', 'icon': Icons.local_cafe},
  ];

  @override
  void initState() {
    super.initState();

    final menuService = Provider.of<MenuService>(context, listen: false);

    if (widget.categoryIndex != null) {
      // Edit mode
      final category = menuService.config.categories[widget.categoryIndex!];
      _idController = TextEditingController(text: category.id);
      _nameController = TextEditingController(text: category.name);
      _nameEnController = TextEditingController(text: category.nameEn);
      _orderController = TextEditingController(text: category.order.toString());
      _selectedIcon = category.icon;
    } else {
      // Create mode
      _idController = TextEditingController();
      _nameController = TextEditingController();
      _nameEnController = TextEditingController();
      _orderController = TextEditingController(
        text: (menuService.config.categories.length + 1).toString(),
      );
    }
  }

  @override
  void dispose() {
    _idController.dispose();
    _nameController.dispose();
    _nameEnController.dispose();
    _orderController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.categoryIndex != null ? 'Edit Category' : 'Add Category',
        ),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          if (widget.categoryIndex != null)
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              onPressed: _deleteCategory,
            ),
          IconButton(
            icon: const Icon(Icons.check),
            onPressed: _saveCategory,
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ID
            TextFormField(
              controller: _idController,
              decoration: const InputDecoration(
                labelText: 'ID *',
                border: OutlineInputBorder(),
                hintText: 'coffee',
                helperText: 'Lowercase letters, numbers, and underscores only',
              ),
              enabled: widget.categoryIndex == null, // Only editable in create mode
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter an ID';
                }
                if (!RegExp(r'^[a-z0-9_]+$').hasMatch(value)) {
                  return 'Only lowercase letters, numbers, and underscores';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Name (Korean)
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Name (Korean) *',
                border: OutlineInputBorder(),
                hintText: '커피',
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a name';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Name (English)
            TextFormField(
              controller: _nameEnController,
              decoration: const InputDecoration(
                labelText: 'Name (English) *',
                border: OutlineInputBorder(),
                hintText: 'Coffee',
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter an English name';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Order
            TextFormField(
              controller: _orderController,
              decoration: const InputDecoration(
                labelText: 'Display Order *',
                border: OutlineInputBorder(),
                hintText: '1',
                helperText: 'Lower numbers appear first',
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter an order';
                }
                final order = int.tryParse(value);
                if (order == null || order < 1) {
                  return 'Please enter a valid order (1 or higher)';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),

            // Icon selection
            const Text(
              'Icon',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _availableIcons.map((iconData) {
                final isSelected = _selectedIcon == iconData['name'];
                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedIcon = iconData['name'];
                    });
                  },
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Colors.brown.shade700
                          : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected
                            ? Colors.brown.shade900
                            : Colors.grey.shade300,
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      iconData['icon'],
                      color: isSelected ? Colors.white : Colors.brown.shade700,
                      size: 32,
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Save button
            ElevatedButton.icon(
              icon: const Icon(Icons.save),
              label: Text(
                widget.categoryIndex != null ? 'Update Category' : 'Add Category',
              ),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                textStyle: const TextStyle(fontSize: 16),
              ),
              onPressed: _saveCategory,
            ),
          ],
        ),
      ),
    );
  }

  void _saveCategory() {
    if (_formKey.currentState!.validate()) {
      final menuService = Provider.of<MenuService>(context, listen: false);

      final category = MenuCategory(
        id: _idController.text.toLowerCase(),
        name: _nameController.text,
        nameEn: _nameEnController.text,
        icon: _selectedIcon,
        order: int.parse(_orderController.text),
      );

      if (widget.categoryIndex != null) {
        menuService.updateCategory(widget.categoryIndex!, category);
      } else {
        menuService.addCategory(category);
      }

      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.categoryIndex != null
                ? 'Category updated successfully'
                : 'Category added successfully',
          ),
        ),
      );
    }
  }

  void _deleteCategory() {
    final menuService = Provider.of<MenuService>(context, listen: false);
    final category = menuService.config.categories[widget.categoryIndex!];
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
              menuService.deleteCategory(widget.categoryIndex!);
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Close editor
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
}
