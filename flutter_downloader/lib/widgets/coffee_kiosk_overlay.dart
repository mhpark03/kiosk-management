import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/coffee_menu_item.dart';
import '../models/coffee_order.dart';
import '../services/coffee_menu_service.dart';
import '../services/websocket_service.dart';

class CoffeeKioskOverlay extends StatefulWidget {
  final VoidCallback onClose;
  final Function(CoffeeOrder) onOrderComplete;
  final Function(String videoPath)? onPlayMenuVideo; // Callback to play menu video on left screen
  final bool showCloseButton;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;

  const CoffeeKioskOverlay({
    super.key,
    required this.onClose,
    required this.onOrderComplete,
    this.onPlayMenuVideo,
    this.showCloseButton = false,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
  });

  @override
  State<CoffeeKioskOverlay> createState() => _CoffeeKioskOverlayState();
}

class _CoffeeKioskOverlayState extends State<CoffeeKioskOverlay> {
  final CoffeeMenuService _menuService = CoffeeMenuService();
  final WebSocketService _webSocketService = WebSocketService();
  String _selectedCategory = 'coffee';
  List<OrderItem> _cartItems = [];
  CoffeeMenuItem? _selectedMenuItem;

  // Options for selected item
  String _selectedSize = 'medium';
  String _selectedTemperature = 'hot';
  List<String> _selectedExtras = [];

  // Store original callbacks to restore them later
  Function()? _originalSyncCallback;
  Function()? _originalConfigCallback;

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
  }

  @override
  void dispose() {
    // Restore original callbacks
    _webSocketService.onSyncCommand = _originalSyncCallback;
    _webSocketService.onConfigUpdate = _originalConfigCallback;
    super.dispose();
  }

  void _setupWebSocketCallbacks() {
    _webSocketService.onSyncCommand = () {
      print('[COFFEE KIOSK OVERLAY] Sync command received, reloading menu...');
      _reloadMenu();
      _originalSyncCallback?.call();
    };

    _webSocketService.onConfigUpdate = () {
      print('[COFFEE KIOSK OVERLAY] Config update received, reloading menu...');
      _reloadMenu();
      _originalConfigCallback?.call();
    };
  }

  Future<void> _reloadMenu() async {
    print('[COFFEE KIOSK OVERLAY] Reloading menu after sync/config update');
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

    return Container(
      padding: const EdgeInsets.all(8),
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
              onTap: () => setState(() => _selectedCategory = category),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 4),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.brown.shade700 : Colors.white,
                  borderRadius: BorderRadius.circular(8),
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
                    fontSize: 16,
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

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.8,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _buildMenuItem(item);
      },
    );
  }

  Widget _buildMenuItem(CoffeeMenuItem item) {
    return GestureDetector(
      onTap: () => _handleMenuItemTap(item),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300, width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Product Image or Icon
            if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
              // Show local file or network image
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: _buildMenuItemImage(item),
              )
            else
              // Fallback: Show icon
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.brown.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  _getCategoryIcon(item.category),
                  size: 40,
                  color: Colors.brown.shade700,
                ),
              ),
            const SizedBox(height: 12),

            // Name
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0),
              child: Text(
                item.name,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 4),

            // Name (English)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0),
              child: Text(
                item.nameEn,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 8),

            // Price
            Text(
              '₩${item.price.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
              style: TextStyle(
                fontSize: 14,
                color: Colors.brown.shade700,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItemImage(CoffeeMenuItem item) {
    final imageUrl = item.imageUrl;
    if (imageUrl == null || imageUrl.isEmpty) {
      return _buildFallbackIcon(item.category);
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
        width: 100,
        height: 100,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          print('[MENU IMAGE] Error loading local file: $filePath - $error');
          return _buildFallbackIcon(item.category);
        },
      );
    } else {
      // Network image with CachedNetworkImage
      return CachedNetworkImage(
        imageUrl: imageUrl,
        width: 100,
        height: 100,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          width: 100,
          height: 100,
          color: Colors.brown.shade100,
          child: const Center(
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        errorWidget: (context, url, error) {
          print('[MENU IMAGE] Error loading network image: $url - $error');
          return _buildFallbackIcon(item.category);
        },
      );
    }
  }

  Widget _buildFallbackIcon(String category) {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        color: Colors.brown.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        _getCategoryIcon(category),
        size: 40,
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
    setState(() {
      _cartItems.add(OrderItem(
        menuItem: item,
        size: item.category != 'dessert' ? _selectedSize : 'medium',
        temperature: item.category != 'dessert' ? _selectedTemperature : 'hot',
        extras: item.category != 'dessert' ? List.from(_selectedExtras) : [],
        quantity: 1,
      ));
    });

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
            },
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }
}
