import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import '../services/menu_service.dart';
import '../widgets/menu_tree_view.dart';
import '../widgets/detail_panel.dart';

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
            onPressed: () => _createNewMenu(context),
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
      body: Row(
        children: [
          // Left: Tree View
          Container(
            width: 300,
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              border: Border(
                right: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            child: const MenuTreeView(),
          ),

          // Right: Detail Panel
          const Expanded(
            child: DetailPanel(),
          ),
        ],
      ),
    );
  }

  void _createNewMenu(BuildContext context) {
    final menuService = Provider.of<MenuService>(context, listen: false);
    menuService.createNewMenu();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('New menu created')),
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
}
