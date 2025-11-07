import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'services/menu_service.dart';

void main() {
  runApp(const CoffeeMenuEditorApp());
}

class CoffeeMenuEditorApp extends StatelessWidget {
  const CoffeeMenuEditorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => MenuService(),
      child: MaterialApp(
        title: 'Coffee Menu Editor',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF5D4037), // Brown color
            brightness: Brightness.light,
          ),
          useMaterial3: true,
        ),
        home: const HomeScreen(),
      ),
    );
  }
}
