import 'package:flutter/material.dart';
import '../services/person_detection_service.dart';

/// Overlay widget that displays real-time person and gender detection status
/// Positioned in top-right corner, semi-transparent to not obstruct content
class DetectionStatusOverlay extends StatefulWidget {
  const DetectionStatusOverlay({super.key});

  @override
  State<DetectionStatusOverlay> createState() => _DetectionStatusOverlayState();
}

class _DetectionStatusOverlayState extends State<DetectionStatusOverlay> {
  DetectionStatus? _status;

  @override
  void initState() {
    super.initState();

    // Listen to detection status stream
    PersonDetectionService().detectionStatusStream.listen((status) {
      if (mounted) {
        setState(() {
          _status = status;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_status == null || !_status!.isInitialized) {
      return const SizedBox.shrink();
    }

    return Positioned(
      top: 16,
      right: 16,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.7),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: _status!.personPresent ? Colors.green : Colors.grey,
            width: 2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Title
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.person_search,
                  color: _status!.personPresent ? Colors.green : Colors.grey,
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Detection Status',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Divider(color: Colors.white30, height: 1),
            const SizedBox(height: 8),

            // Person detection status
            _buildStatusRow(
              'Person',
              _status!.personPresent ? 'Detected' : 'Not Detected',
              _status!.personPresent ? Colors.green : Colors.grey,
            ),

            // Detection confidence
            if (_status!.personPresent) ...[
              const SizedBox(height: 4),
              _buildStatusRow(
                'Confidence',
                '${(_status!.latestConfidence * 100).toStringAsFixed(1)}%',
                _getConfidenceColor(_status!.latestConfidence),
              ),
            ],

            // Gender detection
            if (_status!.gender != null) ...[
              const SizedBox(height: 8),
              const Divider(color: Colors.white30, height: 1),
              const SizedBox(height: 8),
              _buildStatusRow(
                'Gender',
                _status!.gender!.toUpperCase(),
                _getGenderColor(_status!.gender!),
              ),

              // Gender confidence
              if (_status!.genderConfidence != null) ...[
                const SizedBox(height: 4),
                _buildStatusRow(
                  'G-Confidence',
                  '${(_status!.genderConfidence! * 100).toStringAsFixed(1)}%',
                  _getConfidenceColor(_status!.genderConfidence!),
                ),
              ],

              // Reliability indicator
              const SizedBox(height: 4),
              _buildStatusRow(
                'Reliability',
                _status!.isGenderHighlyConfident
                    ? 'High'
                    : _status!.isGenderReliable
                        ? 'Medium'
                        : 'Low',
                _status!.isGenderHighlyConfident
                    ? Colors.green
                    : _status!.isGenderReliable
                        ? Colors.orange
                        : Colors.red,
              ),
            ],

            // Face size (for debugging)
            if (_status!.facePixelSize != null) ...[
              const SizedBox(height: 4),
              _buildStatusRow(
                'Face Size',
                '${_status!.facePixelSize}px',
                _status!.facePixelSize! >= 40 ? Colors.green : Colors.orange,
              ),
            ],

            // Statistics
            const SizedBox(height: 8),
            const Divider(color: Colors.white30, height: 1),
            const SizedBox(height: 8),
            _buildStatusRow(
              'Success Rate',
              '${(_status!.successRate * 100).toStringAsFixed(1)}%',
              _getConfidenceColor(_status!.successRate),
            ),
            const SizedBox(height: 4),
            _buildStatusRow(
              'Total Detections',
              '${_status!.successfulDetections}/${_status!.totalDetections}',
              Colors.white70,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 100,
          child: Text(
            '$label:',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Color _getConfidenceColor(double confidence) {
    if (confidence >= 0.7) {
      return Colors.green;
    } else if (confidence >= 0.4) {
      return Colors.orange;
    } else {
      return Colors.red;
    }
  }

  Color _getGenderColor(String gender) {
    switch (gender.toLowerCase()) {
      case 'male':
        return Colors.blue;
      case 'female':
        return Colors.pink;
      default:
        return Colors.grey;
    }
  }
}
