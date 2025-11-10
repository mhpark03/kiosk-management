import 'package:flutter/material.dart';
import '../services/person_detection_service.dart';

/// Camera status overlay widget displayed on top of camera preview
/// Shows detection confidence, detection count, and camera status
class CameraStatusOverlay extends StatelessWidget {
  final DetectionStatus status;

  const CameraStatusOverlay({
    super.key,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.black.withOpacity(0.7),
              Colors.black.withOpacity(0.3),
              Colors.transparent,
            ],
          ),
        ),
        padding: const EdgeInsets.all(16),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Camera status indicator
              Row(
                children: [
                  // Status indicator dot
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: status.isDetecting ? Colors.green : Colors.grey,
                      boxShadow: status.isDetecting
                          ? [
                              BoxShadow(
                                color: Colors.green.withOpacity(0.5),
                                blurRadius: 8,
                                spreadRadius: 2,
                              ),
                            ]
                          : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Status text
                  Text(
                    status.isDetecting ? '카메라 감지 중' : '카메라 대기',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(),
                  // Person detected indicator
                  if (status.personPresent)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.green,
                          width: 1,
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.person,
                            color: Colors.green,
                            size: 16,
                          ),
                          SizedBox(width: 4),
                          Text(
                            '사람 감지됨',
                            style: TextStyle(
                              color: Colors.green,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              // Detection metrics
              Row(
                children: [
                  // Confidence meter
                  Expanded(
                    flex: 2,
                    child: _buildMetricCard(
                      label: '신뢰도',
                      value: '${(status.latestConfidence * 100).toStringAsFixed(1)}%',
                      color: _getConfidenceColor(status.latestConfidence),
                      icon: Icons.analytics,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Detection count
                  Expanded(
                    child: _buildMetricCard(
                      label: '감지',
                      value: '${status.successfulDetections}',
                      color: Colors.blue,
                      icon: Icons.check_circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Total attempts
                  Expanded(
                    child: _buildMetricCard(
                      label: '시도',
                      value: '${status.totalDetections}',
                      color: Colors.grey,
                      icon: Icons.camera,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Success rate
                  Expanded(
                    child: _buildMetricCard(
                      label: '성공률',
                      value: '${(status.successRate * 100).toStringAsFixed(0)}%',
                      color: Colors.orange,
                      icon: Icons.trending_up,
                    ),
                  ),
                ],
              ),
              // Confidence progress bar
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: status.latestConfidence,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _getConfidenceColor(status.latestConfidence),
                  ),
                  minHeight: 4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: color.withOpacity(0.5),
          width: 1,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: color,
            size: 16,
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }

  Color _getConfidenceColor(double confidence) {
    if (confidence >= 0.7) {
      return Colors.green;
    } else if (confidence >= 0.5) {
      return Colors.orange;
    } else if (confidence >= 0.3) {
      return Colors.yellow;
    } else {
      return Colors.red;
    }
  }
}
