import 'package:flutter/material.dart';
import '../services/person_detection_service.dart';

/// Loading screen displayed during kiosk initialization
/// Shows progress indicator and current initialization step
class KioskLoadingScreen extends StatelessWidget {
  final InitializationProgress progress;

  const KioskLoadingScreen({
    super.key,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // App icon or logo
            const Icon(
              Icons.coffee,
              size: 80,
              color: Colors.brown,
            ),
            const SizedBox(height: 40),

            // Progress indicator
            SizedBox(
              width: 200,
              height: 200,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Circular progress indicator
                  SizedBox(
                    width: 150,
                    height: 150,
                    child: CircularProgressIndicator(
                      value: progress.progress,
                      strokeWidth: 8,
                      backgroundColor: Colors.grey[800],
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.brown),
                    ),
                  ),
                  // Percentage text
                  Text(
                    '${(progress.progress * 100).toInt()}%',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 40),

            // Status message
            Text(
              progress.message,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 18,
              ),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 20),

            // Loading animation (optional)
            const SizedBox(
              width: 30,
              height: 30,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white30),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
