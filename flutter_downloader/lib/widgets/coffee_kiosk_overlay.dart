import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/coffee_menu_item.dart';
import '../models/coffee_order.dart';
import '../services/coffee_menu_service.dart';
import '../services/websocket_service.dart';
import '../services/storage_service.dart';

class CoffeeKioskOverlay extends StatefulWidget {
  final VoidCallback onClose;
  final Function(CoffeeOrder) onOrderComplete;
  final Function(String videoPath, [String? actionType, String? categoryId])? onPlayMenuVideo; // Callback to play menu video on left screen
  final VoidCallback? onCheckoutComplete; // Callback when checkout is completed and dialog is closed
  final bool showCloseButton;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;
  final bool showOnlyMenu; // Show only menu section (for landscape split layout)
  final bool showOnlyCart; // Show only cart section (for landscape split layout)
  final bool useLandscapeLayout; // Use special landscape layout with menu on top and cart on bottom
  final GlobalKey<CoffeeKioskOverlayState>? cartStateKey; // Key to access cart state from menu

  const CoffeeKioskOverlay({
    super.key,
    required this.onClose,
    required this.onOrderComplete,
    this.onPlayMenuVideo,
    this.onCheckoutComplete,
    this.showCloseButton = false,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
    this.showOnlyMenu = false,
    this.showOnlyCart = false,
    this.useLandscapeLayout = false,
    this.cartStateKey,
  });

  @override
  State<CoffeeKioskOverlay> createState() => CoffeeKioskOverlayState();
}

class CoffeeKioskOverlayState extends State<CoffeeKioskOverlay> {
  final CoffeeMenuService _menuService = CoffeeMenuService();
  final WebSocketService _webSocketService = WebSocketService();
  String _selectedCategory = 'coffee';
  List<OrderItem> _cartItems = [];
  CoffeeMenuItem? _selectedMenuItem;

  // Public getter for cart items (accessed by AutoKioskScreen)
  List<OrderItem> get cartItems => _cartItems;

  // Options for selected item
  String _selectedSize = 'medium';
  String _selectedTemperature = 'hot';
  List<String> _selectedExtras = [];

  // Store original callbacks to restore them later
  Function()? _originalSyncCallback;
  Function()? _originalConfigCallback;

  // Periodic menu check and safe reload
  Timer? _menuCheckTimer;
  DateTime? _lastMenuFileModified;
  bool _pendingMenuReload = false;
  bool _isPaymentInProgress = false;

  @override
  void initState() {
    super.initState();
    print('[COFFEE KIOSK OVERLAY] initState called');
    print('[COFFEE KIOSK OVERLAY] downloadPath: ${widget.downloadPath}');
    print('[COFFEE KIOSK OVERLAY] kioskId: ${widget.kioskId}');
    print('[COFFEE KIOSK OVERLAY] menuFilename: ${widget.menuFilename}');

    // Store original callbacks
    _originalSyncCallback = _webSocketService.onSyncCommand;
    _originalConfigCallback = _webSocketService.onConfigUpdate;

    // Setup WebSocket callbacks for menu updates
    _setupWebSocketCallbacks();

    // Load menu from XML
    _loadMenu();

    // Start periodic menu check (every 30 seconds)
    _startPeriodicMenuCheck();

    // Play initial category video only for menu overlay (not cart overlay)
    // Disabled for now to prevent rapid video switching on startup
    // if (!widget.showOnlyCart) {
    //   Future.delayed(const Duration(milliseconds: 500), () {
    //     _playCategoryVideo(_selectedCategory);
    //   });
    // }
  }

  @override
  void dispose() {
    // Cancel timer
    _menuCheckTimer?.cancel();

    // Restore original callbacks
    _webSocketService.onSyncCommand = _originalSyncCallback;
    _webSocketService.onConfigUpdate = _originalConfigCallback;
    super.dispose();
  }

  void _startPeriodicMenuCheck() async {
    // Get sync interval from config
    final storageService = await StorageService.init();
    final config = storageService.getConfig();

    if (config == null) {
      print('[MENU CHECK] No config found, using default 1 minute interval');
      _startTimer(Duration(minutes: 1));
      return;
    }

    // Use syncIntervalHours from config as-is
    // Menu changes don't happen frequently, so checking at sync interval is sufficient
    final intervalHours = config.syncIntervalHours;
    final checkIntervalSeconds = (intervalHours * 3600).clamp(60, double.infinity).toInt();

    print('[MENU CHECK] Starting periodic menu check every $checkIntervalSeconds seconds (${intervalHours}h from config)');
    _startTimer(Duration(seconds: checkIntervalSeconds));

    // Record initial menu file modification time
    await _recordMenuFileModTime();
  }

  void _startTimer(Duration interval) {
    _menuCheckTimer = Timer.periodic(interval, (timer) async {
      await _checkMenuFileChanged();
      await _reloadMenuIfSafe();
    });
  }

  Future<void> _recordMenuFileModTime() async {
    if (widget.downloadPath == null || widget.kioskId == null) return;

    try {
      final menuDirPath = '${widget.downloadPath}/${widget.kioskId}/menu';
      final menuDir = Directory(menuDirPath);

      if (await menuDir.exists()) {
        final xmlFiles = <File>[];
        await for (final file in menuDir.list()) {
          if (file is File && file.path.endsWith('.xml')) {
            xmlFiles.add(file);
          }
        }

        if (xmlFiles.isNotEmpty) {
          xmlFiles.sort((a, b) {
            final aStat = a.statSync();
            final bStat = b.statSync();
            return bStat.modified.compareTo(aStat.modified);
          });

          _lastMenuFileModified = xmlFiles.first.statSync().modified;
          print('[MENU CHECK] Recorded initial menu file time: $_lastMenuFileModified');
        }
      }
    } catch (e) {
      print('[MENU CHECK] Error recording menu file mod time: $e');
    }
  }

  Future<void> _checkMenuFileChanged() async {
    if (widget.downloadPath == null || widget.kioskId == null) return;

    try {
      final menuDirPath = '${widget.downloadPath}/${widget.kioskId}/menu';
      final menuDir = Directory(menuDirPath);

      if (await menuDir.exists()) {
        final xmlFiles = <File>[];
        await for (final file in menuDir.list()) {
          if (file is File && file.path.endsWith('.xml')) {
            xmlFiles.add(file);
          }
        }

        if (xmlFiles.isNotEmpty) {
          xmlFiles.sort((a, b) {
            final aStat = a.statSync();
            final bStat = b.statSync();
            return bStat.modified.compareTo(aStat.modified);
          });

          final currentModTime = xmlFiles.first.statSync().modified;

          if (_lastMenuFileModified != null && currentModTime.isAfter(_lastMenuFileModified!)) {
            print('[MENU CHECK] Menu file changed detected! Old: $_lastMenuFileModified, New: $currentModTime');
            _pendingMenuReload = true;
            _lastMenuFileModified = currentModTime;
          }
        }
      }
    } catch (e) {
      print('[MENU CHECK] Error checking menu file: $e');
    }
  }

  bool _isUserInteracting() {
    // User is interacting if:
    // 1. Option dialog is open (_selectedMenuItem is not null)
    // 2. Cart has items
    // 3. Payment is in progress
    return _selectedMenuItem != null || _cartItems.isNotEmpty || _isPaymentInProgress;
  }

  Future<void> _reloadMenuIfSafe() async {
    if (!_pendingMenuReload) return;

    if (_isUserInteracting()) {
      print('[MENU CHECK] Menu reload pending, but user is interacting. Waiting...');
      return;
    }

    print('[MENU CHECK] Safe to reload menu, proceeding...');
    _pendingMenuReload = false;
    await _reloadMenu();
  }

  void _setupWebSocketCallbacks() {
    _webSocketService.onSyncCommand = () {
      print('[COFFEE KIOSK OVERLAY] Sync command received, marking for reload...');
      _pendingMenuReload = true;
      _originalSyncCallback?.call();
    };

    _webSocketService.onConfigUpdate = () {
      print('[COFFEE KIOSK OVERLAY] Config update received, marking for reload...');
      _pendingMenuReload = true;
      _originalConfigCallback?.call();
    };
  }

  Future<void> _reloadMenu() async {
    print('[COFFEE KIOSK OVERLAY] Reloading menu...');
    // Invalidate cache first
    _menuService.invalidateCache();
    // Then reload
    await _loadMenu();
  }

  Future<void> _loadMenu() async {
    print('[COFFEE KIOSK OVERLAY] _loadMenu called');
    await _menuService.loadMenuFromXml(
      downloadPath: widget.downloadPath,
      kioskId: widget.kioskId,
      filename: widget.menuFilename,
    );
    print('[COFFEE KIOSK OVERLAY] Menu loaded, rebuilding UI');
    setState(() {}); // Rebuild UI with loaded menu
  }

  @override
  Widget build(BuildContext context) {
    print('[COFFEE KIOSK OVERLAY] build called');

    // If showing only menu or only cart (for landscape split layout)
    if (widget.showOnlyMenu) {
      return Container(
        color: Colors.white,
        child: SafeArea(
          child: _buildMenuSection(),
        ),
      );
    }

    if (widget.showOnlyCart) {
      return Container(
        color: Colors.white,
        child: SafeArea(
          child: _buildCartSection(),
        ),
      );
    }

    // Landscape layout: menu on top, cart on bottom (for split screen landscape mode)
    if (widget.useLandscapeLayout) {
      return Container(
        color: Colors.white,
        child: SafeArea(
          child: Column(
            children: [
              // Menu section (top)
              Expanded(
                flex: 1,
                child: _buildMenuSection(),
              ),

              // Cart section (bottom)
              Expanded(
                flex: 1,
                child: _buildCartSection(),
              ),
            ],
          ),
        ),
      );
    }

    // Default layout: menu and cart side by side
    return Container(
      color: Colors.white, // White background for kiosk menu
      child: SafeArea(
        child: Row(
          children: [
            // Menu section (left side)
            Expanded(
              flex: 3,
              child: _buildMenuSection(),
            ),

            // Cart section (right side)
            Expanded(
              flex: 2,
              child: _buildCartSection(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.brown.shade700,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.coffee, color: Colors.white, size: 32),
          const SizedBox(width: 12),
          const Text(
            'Coffee Kiosk',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white, size: 28),
            onPressed: widget.onClose,
          ),
        ],
      ),
    );
  }

  Widget _buildMenuSection() {
    return Container(
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          // Category tabs
          _buildCategoryTabs(),

          // Menu items grid
          Expanded(
            child: _buildMenuGrid(),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    final categories = _menuService.getCategories();
    final orientation = MediaQuery.of(context).orientation;
    final isPortrait = orientation == Orientation.portrait;

    return Container(
      padding: EdgeInsets.all(isPortrait ? 6 : 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          topRight: Radius.circular(12),
        ),
      ),
      child: Row(
        children: categories.map((category) {
          final isSelected = _selectedCategory == category;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() => _selectedCategory = category);
                // Play category video when category is selected
                _playCategoryVideo(category);
              },
              child: Container(
                margin: EdgeInsets.symmetric(horizontal: isPortrait ? 2 : 3),
                padding: EdgeInsets.symmetric(vertical: isPortrait ? 6 : 8),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.brown.shade700 : Colors.white,
                  borderRadius: BorderRadius.circular(isPortrait ? 6 : 6),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: Colors.brown.withOpacity(0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  _menuService.getCategoryDisplayName(category),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isSelected ? Colors.white : Colors.black87,
                    fontSize: isPortrait ? 12 : 13,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildMenuGrid() {
    final items = _menuService.getMenuByCategory(_selectedCategory);
    final orientation = MediaQuery.of(context).orientation;
    final isPortrait = orientation == Orientation.portrait;

    return GridView.builder(
      padding: EdgeInsets.all(isPortrait ? 6 : 8),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: isPortrait ? 2 : 3,
        childAspectRatio: isPortrait ? 1.1 : 1.0, // Wider ratio to reduce height
        crossAxisSpacing: isPortrait ? 6 : 8,
        mainAxisSpacing: isPortrait ? 6 : 8,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _buildMenuItem(item);
      },
    );
  }

  Widget _buildMenuItem(CoffeeMenuItem item) {
    final orientation = MediaQuery.of(context).orientation;
    final isPortrait = orientation == Orientation.portrait;
    final imageSize = isPortrait ? 60.0 : 70.0;

    return GestureDetector(
      onTap: () => _handleMenuItemTap(item),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(isPortrait ? 8 : 12),
          border: Border.all(color: Colors.grey.shade300, width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Padding(
          padding: EdgeInsets.all(isPortrait ? 6 : 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Product Image or Icon
              if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
                // Show local file or network image
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: _buildMenuItemImage(item, imageSize),
                )
              else
                // Fallback: Show icon
                Container(
                  width: imageSize,
                  height: imageSize,
                  decoration: BoxDecoration(
                    color: Colors.brown.shade100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(
                    _getCategoryIcon(item.category),
                    size: imageSize * 0.4,
                    color: Colors.brown.shade700,
                  ),
                ),
              SizedBox(height: isPortrait ? 6 : 12),

              // Name
              Padding(
                padding: EdgeInsets.symmetric(horizontal: isPortrait ? 4.0 : 6.0),
                child: Text(
                  item.name,
                  style: TextStyle(
                    fontSize: isPortrait ? 12 : 13,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              SizedBox(height: isPortrait ? 2 : 2),

              // Name (English)
              Padding(
                padding: EdgeInsets.symmetric(horizontal: isPortrait ? 4.0 : 6.0),
                child: Text(
                  item.nameEn,
                  style: TextStyle(
                    fontSize: isPortrait ? 9 : 10,
                    color: Colors.grey.shade600,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              SizedBox(height: isPortrait ? 3 : 4),

              // Price
              Text(
                '₩${item.price.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                style: TextStyle(
                  fontSize: isPortrait ? 11 : 12,
                  color: Colors.brown.shade700,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMenuItemImage(CoffeeMenuItem item, double size) {
    final imageUrl = item.imageUrl;
    if (imageUrl == null || imageUrl.isEmpty) {
      return _buildFallbackIcon(item.category, size);
    }

    // Check if it's a local file path (starts with '/' or drive letter on Windows)
    final isLocalFile = imageUrl.startsWith('/') ||
        (imageUrl.length > 2 && imageUrl[1] == ':') ||
        imageUrl.startsWith('file://');

    if (isLocalFile) {
      // Remove 'file://' prefix if present
      final filePath = imageUrl.startsWith('file://') ? imageUrl.substring(7) : imageUrl;

      return Image.file(
        File(filePath),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          print('[MENU IMAGE] Error loading local file: $filePath - $error');
          return _buildFallbackIcon(item.category, size);
        },
      );
    } else {
      // Network image with CachedNetworkImage
      return CachedNetworkImage(
        imageUrl: imageUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          width: size,
          height: size,
          color: Colors.brown.shade100,
          child: const Center(
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        errorWidget: (context, url, error) {
          print('[MENU IMAGE] Error loading network image: $url - $error');
          return _buildFallbackIcon(item.category, size);
        },
      );
    }
  }

  Widget _buildFallbackIcon(String category, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.brown.shade100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Icon(
        _getCategoryIcon(category),
        size: size * 0.4,
        color: Colors.brown.shade700,
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'coffee':
        return Icons.coffee;
      case 'beverage':
        return Icons.local_drink;
      case 'dessert':
        return Icons.cake;
      default:
        return Icons.fastfood;
    }
  }

  void _handleMenuItemTap(CoffeeMenuItem item) {
    // Always show options dialog
    _showItemOptionsDialog(item);

    // If item has video, play it on the left screen
    if (item.videoFilename != null && item.videoFilename!.isNotEmpty) {
      print('[MENU VIDEO] Playing video for item: ${item.name}, filename: ${item.videoFilename}');
      _playMenuItemVideo(item);
    }
  }

  void _playMenuItemVideo(CoffeeMenuItem item) {
    if (widget.downloadPath == null || widget.kioskId == null) {
      print('[MENU VIDEO] Cannot play video: downloadPath or kioskId is null');
      return;
    }

    if (widget.onPlayMenuVideo == null) {
      print('[MENU VIDEO] onPlayMenuVideo callback is null');
      return;
    }

    // Build video path in menu folder
    final videoPath = '${widget.downloadPath}/${widget.kioskId}/menu/${item.videoFilename}';
    print('[MENU VIDEO] Video path: $videoPath');

    // Check if file exists
    final videoFile = File(videoPath);
    if (!videoFile.existsSync()) {
      print('[MENU VIDEO] Video file does not exist: $videoPath');
      return;
    }

    // Call callback to play video on left screen
    widget.onPlayMenuVideo!(videoPath);
  }

  void _playCategoryVideo(String category) {
    final videoFilename = _menuService.getCategoryVideoFilename(category);
    if (videoFilename == null || videoFilename.isEmpty) {
      print('[CATEGORY VIDEO] No video for category: $category');
      return;
    }

    if (widget.downloadPath == null || widget.kioskId == null) {
      print('[CATEGORY VIDEO] Cannot play video: downloadPath or kioskId is null');
      return;
    }

    if (widget.onPlayMenuVideo == null) {
      print('[CATEGORY VIDEO] onPlayMenuVideo callback is null');
      return;
    }

    // Build video path in menu folder or kiosk folder
    // Try menu folder first
    String videoPath = '${widget.downloadPath}/${widget.kioskId}/menu/$videoFilename';
    File videoFile = File(videoPath);

    // If not found in menu folder, try kiosk folder
    if (!videoFile.existsSync()) {
      videoPath = '${widget.downloadPath}/${widget.kioskId}/$videoFilename';
      videoFile = File(videoPath);
    }

    if (!videoFile.existsSync()) {
      print('[CATEGORY VIDEO] Video file does not exist: $videoPath');
      return;
    }

    print('[CATEGORY VIDEO] Playing category video for $category: $videoPath');
    // Call callback to play video on left screen with category ID
    widget.onPlayMenuVideo!(videoPath, 'category', category);
  }

  /// Play action video (addToCart, checkout, increaseQuantity, decreaseQuantity, cancelItem)
  void _playActionVideo(String actionType) {
    String? videoFilename;

    if (actionType == 'addToCart') {
      videoFilename = _menuService.getAddToCartVideoFilename();
    } else if (actionType == 'checkout') {
      videoFilename = _menuService.getCheckoutVideoFilename();
    } else if (actionType == 'increaseQuantity') {
      videoFilename = _menuService.getIncreaseQuantityVideoFilename();
    } else if (actionType == 'decreaseQuantity') {
      videoFilename = _menuService.getDecreaseQuantityVideoFilename();
    } else if (actionType == 'cancelItem') {
      videoFilename = _menuService.getCancelItemVideoFilename();
    }

    if (videoFilename == null || videoFilename.isEmpty) {
      print('[ACTION VIDEO] No video for action: $actionType');
      return;
    }

    if (widget.downloadPath == null || widget.kioskId == null) {
      print('[ACTION VIDEO] Cannot play video: downloadPath or kioskId is null');
      return;
    }

    if (widget.onPlayMenuVideo == null) {
      print('[ACTION VIDEO] onPlayMenuVideo callback is null');
      return;
    }

    // Build video path in menu folder or kiosk folder
    // Try menu folder first
    String videoPath = '${widget.downloadPath}/${widget.kioskId}/menu/$videoFilename';
    File videoFile = File(videoPath);

    // If not found in menu folder, try kiosk folder
    if (!videoFile.existsSync()) {
      videoPath = '${widget.downloadPath}/${widget.kioskId}/$videoFilename';
      videoFile = File(videoPath);
    }

    if (!videoFile.existsSync()) {
      print('[ACTION VIDEO] Video file does not exist: $videoPath');
      return;
    }

    print('[ACTION VIDEO] Playing $actionType video: $videoPath');
    // Call callback to play video on left screen with action type and current category
    widget.onPlayMenuVideo!(videoPath, actionType, _selectedCategory);
  }

  void _showItemOptionsDialog(CoffeeMenuItem item) {
    // Reset options
    _selectedSize = 'medium';
    _selectedTemperature = 'hot';
    _selectedExtras = [];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Text(item.name),
            content: SizedBox(
              width: 400,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.description),
                    const SizedBox(height: 20),

                    // Size selection (only for coffee/beverage)
                    if (item.category != 'dessert') ...[
                      const Text('사이즈', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...CoffeeOptions.sizes.map((size) {
                        return RadioListTile<String>(
                          title: Text('${size.name} ${size.additionalPrice > 0 ? '(+₩${size.additionalPrice})' : ''}'),
                          value: size.id,
                          groupValue: _selectedSize,
                          onChanged: (value) {
                            setDialogState(() => _selectedSize = value!);
                          },
                        );
                      }),
                      const SizedBox(height: 12),

                      // Temperature
                      const Text('온도', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...CoffeeOptions.temperatures.map((temp) {
                        return RadioListTile<String>(
                          title: Text(temp.name),
                          value: temp.id,
                          groupValue: _selectedTemperature,
                          onChanged: (value) {
                            setDialogState(() => _selectedTemperature = value!);
                          },
                        );
                      }),
                      const SizedBox(height: 12),

                      // Extras
                      const Text('추가 옵션', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...CoffeeOptions.extras.map((extra) {
                        return CheckboxListTile(
                          title: Text('${extra.name} (+₩${extra.additionalPrice})'),
                          value: _selectedExtras.contains(extra.id),
                          onChanged: (checked) {
                            setDialogState(() {
                              if (checked == true) {
                                _selectedExtras.add(extra.id);
                              } else {
                                _selectedExtras.remove(extra.id);
                              }
                            });
                          },
                        );
                      }),
                    ],
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('취소'),
              ),
              ElevatedButton(
                onPressed: () {
                  _addToCart(item);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.brown.shade700,
                  foregroundColor: Colors.white,
                ),
                child: const Text('장바구니에 담기'),
              ),
            ],
          );
        },
      ),
    );
  }

  void _addToCart(CoffeeMenuItem item) {
    final orderItem = OrderItem(
      menuItem: item,
      size: item.category != 'dessert' ? _selectedSize : 'medium',
      temperature: item.category != 'dessert' ? _selectedTemperature : 'hot',
      extras: item.category != 'dessert' ? List.from(_selectedExtras) : [],
      quantity: 1,
    );

    // If cartStateKey is provided (for split layout), update the cart widget
    if (widget.cartStateKey != null && widget.cartStateKey!.currentState != null) {
      widget.cartStateKey!.currentState!._cartItems.add(orderItem);
      widget.cartStateKey!.currentState!.setState(() {});
    } else {
      // Otherwise, update own cart
      setState(() {
        _cartItems.add(orderItem);
      });
    }

    // Play add to cart action video if available
    _playActionVideo('addToCart');

    // Show snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${item.name}이(가) 장바구니에 추가되었습니다'),
        duration: const Duration(seconds: 1),
        backgroundColor: Colors.brown.shade700,
      ),
    );
  }

  Widget _buildCartSection() {
    return Container(
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          // Cart header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.brown.shade700,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.shopping_cart, color: Colors.white),
                const SizedBox(width: 8),
                const Text(
                  '장바구니',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                if (_cartItems.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${_cartItems.length}',
                      style: TextStyle(
                        color: Colors.brown.shade700,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                if (widget.showCloseButton) ...[
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 24),
                    onPressed: widget.onClose,
                    tooltip: '닫기',
                  ),
                ],
              ],
            ),
          ),

          // Cart items
          Expanded(
            child: _cartItems.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_cart_outlined,
                            size: 64, color: Colors.grey.shade300),
                        const SizedBox(height: 16),
                        Text(
                          '장바구니가 비어있습니다',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _cartItems.length,
                    itemBuilder: (context, index) {
                      return _buildCartItem(_cartItems[index], index);
                    },
                  ),
          ),

          // Total and order button
          if (_cartItems.isNotEmpty) _buildOrderSummary(),
        ],
      ),
    );
  }

  Widget _buildCartItem(OrderItem item, int index) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Use single-line layout for landscape mode (wider screens)
        final bool isLandscape = constraints.maxWidth > 400;

        if (isLandscape) {
          // Compact single-line layout for landscape mode
          return Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                // Item name (compact)
                Expanded(
                  flex: 2,
                  child: Text(
                    item.menuItem.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 4),
                // Options (compact)
                if (item.menuItem.category != 'dessert')
                  Expanded(
                    flex: 2,
                    child: Text(
                      '${CoffeeOptions.sizes.firstWhere((s) => s.id == item.size).name.substring(0, 1)}/${CoffeeOptions.temperatures.firstWhere((t) => t.id == item.temperature).name.substring(0, 1)}${item.extras.isNotEmpty ? ' +${item.extras.length}' : ''}',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                const SizedBox(width: 4),
                // Quantity controls (compact)
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      InkWell(
                        onTap: () {
                          setState(() {
                            if (item.quantity > 1) {
                              item.quantity--;
                            }
                          });
                          _playActionVideo('decreaseQuantity');
                        },
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          child: const Icon(Icons.remove, size: 14),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          '${item.quantity}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          setState(() {
                            item.quantity++;
                          });
                          _playActionVideo('increaseQuantity');
                        },
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          child: const Icon(Icons.add, size: 14),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Price
                Text(
                  '₩${item.totalPrice.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Colors.brown.shade700,
                  ),
                ),
                const SizedBox(width: 4),
                // Delete button (compact)
                InkWell(
                  onTap: () {
                    setState(() => _cartItems.removeAt(index));
                    _playActionVideo('cancelItem');
                  },
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    child: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                  ),
                ),
              ],
            ),
          );
        }

        // Original multi-line layout for portrait mode
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.menuItem.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (item.menuItem.category != 'dessert')
                          Text(
                            '${CoffeeOptions.sizes.firstWhere((s) => s.id == item.size).name} / ${CoffeeOptions.temperatures.firstWhere((t) => t.id == item.temperature).name}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        if (item.extras.isNotEmpty)
                          Text(
                            '옵션: ${item.extras.map((e) => CoffeeOptions.extras.firstWhere((ex) => ex.id == e).name).join(', ')}',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade600,
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: () {
                      setState(() => _cartItems.removeAt(index));
                      _playActionVideo('cancelItem');
                    },
                    color: Colors.red,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  // Quantity controls
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 16),
                          onPressed: () {
                            setState(() {
                              if (item.quantity > 1) {
                                item.quantity--;
                              }
                            });
                            _playActionVideo('decreaseQuantity');
                          },
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            '${item.quantity}',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 16),
                          onPressed: () {
                            setState(() {
                              item.quantity++;
                            });
                            _playActionVideo('increaseQuantity');
                          },
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '₩${item.totalPrice.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.brown.shade700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOrderSummary() {
    final totalPrice = _cartItems.fold(0, (sum, item) => sum + item.totalPrice);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(12),
          bottomRight: Radius.circular(12),
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '총 금액',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '₩${totalPrice.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.brown.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    setState(() => _cartItems.clear());
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.grey.shade400,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('전체 삭제'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _completeOrder,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.brown.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text(
                    '주문하기',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _completeOrder() {
    // Play checkout action video if available
    _playActionVideo('checkout');

    final order = CoffeeOrder(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      items: List.from(_cartItems),
      createdAt: DateTime.now(),
      status: 'pending',
    );

    // Show confirmation dialog
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('주문 완료'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('주문이 접수되었습니다!'),
            const SizedBox(height: 16),
            Text('총 ${order.totalQuantity}개 상품'),
            Text(
              '결제 금액: ₩${order.totalPrice.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Text(
              '※ 현재는 프론트엔드만 구현되어 있으며,\n서버 전송 기능은 추후 추가 예정입니다.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              setState(() => _cartItems.clear()); // Clear cart and stay in kiosk

              // Show success message
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('주문이 완료되었습니다. 준비되면 호출하겠습니다.'),
                  duration: const Duration(seconds: 2),
                  backgroundColor: Colors.green.shade700,
                ),
              );

              // Call checkout complete callback to return to main video
              if (widget.onCheckoutComplete != null) {
                print('[CHECKOUT] Calling onCheckoutComplete callback');
                widget.onCheckoutComplete!();
              }
            },
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }
}
