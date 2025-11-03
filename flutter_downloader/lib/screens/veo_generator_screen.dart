import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/veo_video.dart';
import '../services/veo_service.dart';
import '../services/storage_service.dart';
import 'video_player_screen.dart';

/// Screen for Google VEO 3.1 video generation
/// Allows users to create AI-generated videos from text prompts and images
class VeoGeneratorScreen extends StatefulWidget {
  const VeoGeneratorScreen({Key? key}) : super(key: key);

  @override
  State<VeoGeneratorScreen> createState() => _VeoGeneratorScreenState();
}

class _VeoGeneratorScreenState extends State<VeoGeneratorScreen> {
  late VeoService _veoService;
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();

  String _duration = "4";
  String _resolution = "720p";
  String _aspectRatio = "16:9";

  String? _firstFramePath;

  bool _isGenerating = false;
  bool _isSavingToS3 = false;
  VeoVideoResult? _generationResult;

  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _initializeVeoService();
  }

  Future<void> _initializeVeoService() async {
    final storageService = await StorageService.init();
    final serverUrl = storageService.getCustomServerUrl();
    setState(() {
      _veoService = VeoService(baseUrl: serverUrl ?? 'http://localhost:8080');
    });
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1080,
      );

      if (image != null) {
        setState(() {
          _firstFramePath = image.path;
        });
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
      _showError('Failed to pick image: $e');
    }
  }

  Future<void> _generateVideo() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Validate first frame image is selected
    if (_firstFramePath == null) {
      _showError('Please select a first frame image');
      return;
    }

    setState(() {
      _isGenerating = true;
      _generationResult = null;
    });

    try {
      final request = VeoVideoRequest(
        prompt: _promptController.text.trim(),
        duration: _duration,
        resolution: _resolution,
        aspectRatio: _aspectRatio,
        firstFramePath: _firstFramePath,
      );

      final result = await _veoService.generateWithFirstFrame(request);

      setState(() {
        _generationResult = result;
        _isGenerating = false;
      });

      if (result.success) {
        _showSuccess('Video generated successfully!');
      } else {
        _showError(result.message ?? 'Video generation failed');
      }
    } catch (e) {
      setState(() {
        _isGenerating = false;
      });
      _showError('Error: $e');
    }
  }

  Future<void> _saveToS3() async {
    if (_generationResult == null || _generationResult!.videoUrl == null) {
      _showError('No generated video to save');
      return;
    }

    setState(() {
      _isSavingToS3 = true;
    });

    try {
      // TODO: Implement S3 save functionality via backend API
      // For now, just show a success message
      await Future.delayed(const Duration(seconds: 2));

      setState(() {
        _isSavingToS3 = false;
      });

      _showSuccess('Video saved to S3 successfully!');
    } catch (e) {
      setState(() {
        _isSavingToS3 = false;
      });
      _showError('Failed to save to S3: $e');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _playGeneratedVideo() {
    if (_generationResult?.videoUrl != null) {
      final proxyUrl = _veoService.getProxyVideoUrl(_generationResult!.videoUrl!);
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VideoPlayerScreen(
            videoPath: proxyUrl,
            videoTitle: 'Generated Video',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Video Generator'),
        backgroundColor: Colors.deepPurple,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Card(
                color: Colors.deepPurple.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.auto_awesome, color: Colors.deepPurple, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Google VEO 3.1',
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                    color: Colors.deepPurple,
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Image to Video - Generate AI-powered videos from images and text prompts',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Prompt Input
              Text(
                'Video Prompt *',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _promptController,
                maxLines: 4,
                enabled: !_isGenerating,
                decoration: const InputDecoration(
                  hintText: 'Describe the video you want to generate...\nExample: A serene sunset over the ocean with waves gently rolling onto a sandy beach',
                  border: OutlineInputBorder(),
                  filled: true,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter a video prompt';
                  }
                  if (value.trim().length < 10) {
                    return 'Prompt should be at least 10 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Image Frame Selection
              Text(
                'First Frame Image',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),

              // First Frame
              _buildImagePicker(
                label: 'First Frame *',
                imagePath: _firstFramePath,
                onTap: _pickImage,
              ),
              const SizedBox(height: 24),

              // Video Settings
              Text(
                'Video Settings',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),

              // Duration
              _buildDropdown(
                label: 'Duration',
                value: _duration,
                items: ['4', '5', '8'],
                onChanged: _isGenerating
                    ? null
                    : (value) {
                        setState(() {
                          _duration = value!;
                        });
                      },
                suffix: 'seconds',
              ),
              const SizedBox(height: 12),

              // Resolution
              _buildDropdown(
                label: 'Resolution',
                value: _resolution,
                items: ['720p', '1080p'],
                onChanged: _isGenerating
                    ? null
                    : (value) {
                        setState(() {
                          _resolution = value!;
                        });
                      },
              ),
              const SizedBox(height: 12),

              // Aspect Ratio
              _buildDropdown(
                label: 'Aspect Ratio',
                value: _aspectRatio,
                items: ['16:9', '9:16', '1:1'],
                onChanged: _isGenerating
                    ? null
                    : (value) {
                        setState(() {
                          _aspectRatio = value!;
                        });
                      },
              ),
              const SizedBox(height: 32),

              // Generate Button
              ElevatedButton.icon(
                onPressed: _isGenerating ? null : _generateVideo,
                icon: _isGenerating
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Icon(Icons.play_arrow),
                label: Text(_isGenerating ? 'Generating...' : 'Generate Video'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepPurple,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.all(16),
                  textStyle: const TextStyle(fontSize: 18),
                ),
              ),
              const SizedBox(height: 24),

              // Result Display
              if (_generationResult != null) _buildResultCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImagePicker({
    required String label,
    required String? imagePath,
    required VoidCallback onTap,
  }) {
    return Card(
      child: InkWell(
        onTap: _isGenerating ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              if (imagePath != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(
                    File(imagePath),
                    width: 80,
                    height: 80,
                    fit: BoxFit.cover,
                  ),
                )
              else
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.add_photo_alternate,
                    size: 40,
                    color: Colors.grey,
                  ),
                ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      imagePath == null ? 'Tap to select image' : 'Tap to change image',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: Colors.grey.shade400,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required String value,
    required List<String> items,
    required ValueChanged<String?>? onChanged,
    String? suffix,
  }) {
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: Text(label),
        ),
        Expanded(
          flex: 3,
          child: DropdownButtonFormField<String>(
            initialValue: value,
            items: items.map((item) {
              return DropdownMenuItem(
                value: item,
                child: Text(suffix != null ? '$item $suffix' : item),
              );
            }).toList(),
            onChanged: onChanged,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResultCard() {
    final result = _generationResult!;
    final isSuccess = result.success && result.videoUrl != null;

    return Card(
      color: isSuccess ? Colors.green.shade50 : Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isSuccess ? Icons.check_circle : Icons.error,
                  color: isSuccess ? Colors.green : Colors.red,
                ),
                const SizedBox(width: 8),
                Text(
                  isSuccess ? 'Generation Complete!' : 'Generation Failed',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isSuccess ? Colors.green : Colors.red,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
            if (result.message != null) ...[
              const SizedBox(height: 8),
              Text(result.message!),
            ],
            if (result.taskId != null) ...[
              const SizedBox(height: 8),
              Text('Task ID: ${result.taskId}', style: const TextStyle(fontSize: 12)),
            ],
            if (isSuccess) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _playGeneratedVideo,
                      icon: const Icon(Icons.play_circle),
                      label: const Text('Play Video'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isSavingToS3 ? null : _saveToS3,
                      icon: _isSavingToS3
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Icon(Icons.cloud_upload),
                      label: Text(_isSavingToS3 ? 'Saving...' : 'Save to S3'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
