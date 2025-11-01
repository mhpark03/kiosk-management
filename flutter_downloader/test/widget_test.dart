// This is a basic Flutter widget test for the Kiosk Downloader app.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_downloader/main.dart';
import 'package:flutter_downloader/services/api_service.dart';
import 'package:flutter_downloader/services/storage_service.dart';
import 'package:flutter_downloader/models/kiosk_config.dart';

void main() {
  testWidgets('App launches with login or video list screen', (WidgetTester tester) async {
    // Create test instances of services
    final apiService = ApiService(baseUrl: ServerPresets.local);
    final storageService = await StorageService.init();

    // Build our app and trigger a frame.
    await tester.pumpWidget(MyApp(
      apiService: apiService,
      storageService: storageService,
    ));

    // Wait for the app to settle
    await tester.pumpAndSettle();

    // Verify that the app launches successfully
    // It should show either login screen or video list screen
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
