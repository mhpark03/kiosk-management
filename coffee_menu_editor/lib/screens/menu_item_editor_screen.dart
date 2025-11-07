import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../models/menu_config.dart';
import '../services/menu_service.dart';

class MenuItemEditorScreen extends StatefulWidget {
  final int? itemIndex;

  const MenuItemEditorScreen({super.key, this.itemIndex});

  @override
  State<MenuItemEditorScreen> createState() => _MenuItemEditorScreenState();
}

class _MenuItemEditorScreenState extends State<MenuItemEditorScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _nameEnController;
  late TextEditingController _priceController;
  late TextEditingController _descriptionController;
  late TextEditingController _imageUrlController;

  String? _selectedCategory;
  bool _available = true;
  bool _sizeEnabled = true;
  bool _temperatureEnabled = true;
  bool _extrasEnabled = true;

  @override
  void initState() {
    super.initState();

    final menuService = Provider.of<MenuService>(context, listen: false);

    if (widget.itemIndex != null) {
      // Edit mode
      final item = menuService.config.menuItems[widget.itemIndex!];
      _nameController = TextEditingController(text: item.name);
      _nameEnController = TextEditingController(text: item.nameEn);
      _priceController = TextEditingController(text: item.price.toString());
      _descriptionController = TextEditingController(text: item.description);
      _imageUrlController = TextEditingController(text: item.thumbnailUrl ?? '');
      _selectedCategory = item.category;
      _available = item.available;
      _sizeEnabled = item.sizeEnabled;
      _temperatureEnabled = item.temperatureEnabled;
      _extrasEnabled = item.extrasEnabled;
    } else {
      // Create mode
      _nameController = TextEditingController();
      _nameEnController = TextEditingController();
      _priceController = TextEditingController();
      _descriptionController = TextEditingController();
      _imageUrlController = TextEditingController();
      _selectedCategory = menuService.config.categories.isNotEmpty
          ? menuService.config.categories.first.id
          : null;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _nameEnController.dispose();
    _priceController.dispose();
    _descriptionController.dispose();
    _imageUrlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final menuService = Provider.of<MenuService>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.itemIndex != null ? 'Edit Menu Item' : 'Add Menu Item'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.check),
            onPressed: _saveItem,
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Category selection
            DropdownButtonFormField<String>(
              value: _selectedCategory,
              decoration: const InputDecoration(
                labelText: 'Category *',
                border: OutlineInputBorder(),
              ),
              items: menuService.config.categories.map((category) {
                return DropdownMenuItem(
                  value: category.id,
                  child: Text('${category.name} (${category.nameEn})'),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _selectedCategory = value;
                });
              },
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please select a category';
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
                hintText: '아메리카노',
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
                hintText: 'Americano',
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter an English name';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Price
            TextFormField(
              controller: _priceController,
              decoration: const InputDecoration(
                labelText: 'Price (₩) *',
                border: OutlineInputBorder(),
                hintText: '4000',
                prefixText: '₩ ',
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a price';
                }
                final price = int.tryParse(value);
                if (price == null || price < 0) {
                  return 'Please enter a valid price';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description *',
                border: OutlineInputBorder(),
                hintText: '진한 에스프레소에 물을 더한 커피',
              ),
              maxLines: 3,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a description';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Image URL
            TextFormField(
              controller: _imageUrlController,
              decoration: const InputDecoration(
                labelText: 'Image URL',
                border: OutlineInputBorder(),
                hintText: 'https://example.com/image.jpg',
              ),
            ),
            const SizedBox(height: 24),

            // Options section
            const Text(
              'Options',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),

            SwitchListTile(
              title: const Text('Available'),
              subtitle: const Text('Show this item in the menu'),
              value: _available,
              onChanged: (value) {
                setState(() {
                  _available = value;
                });
              },
            ),

            SwitchListTile(
              title: const Text('Size Selection'),
              subtitle: const Text('Allow customers to choose size'),
              value: _sizeEnabled,
              onChanged: (value) {
                setState(() {
                  _sizeEnabled = value;
                });
              },
            ),

            SwitchListTile(
              title: const Text('Temperature Selection'),
              subtitle: const Text('Allow customers to choose hot/iced'),
              value: _temperatureEnabled,
              onChanged: (value) {
                setState(() {
                  _temperatureEnabled = value;
                });
              },
            ),

            SwitchListTile(
              title: const Text('Extra Options'),
              subtitle: const Text('Allow customers to add extras'),
              value: _extrasEnabled,
              onChanged: (value) {
                setState(() {
                  _extrasEnabled = value;
                });
              },
            ),

            const SizedBox(height: 24),

            // Save button
            ElevatedButton.icon(
              icon: const Icon(Icons.save),
              label: Text(widget.itemIndex != null ? 'Update Item' : 'Add Item'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                textStyle: const TextStyle(fontSize: 16),
              ),
              onPressed: _saveItem,
            ),
          ],
        ),
      ),
    );
  }

  void _saveItem() {
    if (_formKey.currentState!.validate()) {
      final menuService = Provider.of<MenuService>(context, listen: false);

      final item = MenuItem(
        id: widget.itemIndex != null
            ? menuService.config.menuItems[widget.itemIndex!].id
            : menuService.generateId(_selectedCategory!),
        category: _selectedCategory!,
        name: _nameController.text,
        nameEn: _nameEnController.text,
        price: int.parse(_priceController.text),
        description: _descriptionController.text,
        thumbnailUrl: _imageUrlController.text.isNotEmpty
            ? _imageUrlController.text
            : null,
        available: _available,
        order: widget.itemIndex != null
            ? menuService.config.menuItems[widget.itemIndex!].order
            : menuService.getNextOrderForCategory(_selectedCategory!),
        sizeEnabled: _sizeEnabled,
        temperatureEnabled: _temperatureEnabled,
        extrasEnabled: _extrasEnabled,
      );

      if (widget.itemIndex != null) {
        menuService.updateMenuItem(widget.itemIndex!, item);
      } else {
        menuService.addMenuItem(item);
      }

      Navigator.pop(context);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.itemIndex != null
                ? 'Item updated successfully'
                : 'Item added successfully',
          ),
        ),
      );
    }
  }
}
