// Menu configuration models for XML-based kiosk menu system

class MenuConfig {
  final MenuMetadata metadata;
  final List<MenuCategory> categories;
  final List<MenuItem> menuItems;
  final MenuOptions options;
  final MenuActions? actions;  // Optional action videos

  MenuConfig({
    required this.metadata,
    required this.categories,
    required this.menuItems,
    required this.options,
    this.actions,
  });
}

class MenuMetadata {
  final String name;
  final String version;
  final String lastModified;

  MenuMetadata({
    required this.name,
    required this.version,
    required this.lastModified,
  });
}

class MenuCategory {
  final String id;
  final String name;
  final String nameEn;
  final String icon;
  final int order;
  final String? videoId;
  final String? videoFilename;

  MenuCategory({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.icon,
    required this.order,
    this.videoId,
    this.videoFilename,
  });
}

class MenuItem {
  final String id;
  final String category;
  final String name;
  final String nameEn;
  final int price;
  final String description;
  final String? thumbnailUrl;
  final String? imageId;  // Image ID for downloading from server
  final String? imageFilename;  // Image filename for offline kiosk operation
  final String? videoFilename;  // Video filename for menu item video playback
  final bool available;
  final int order;

  // Option flags
  final bool sizeEnabled;
  final bool temperatureEnabled;
  final bool extrasEnabled;

  MenuItem({
    required this.id,
    required this.category,
    required this.name,
    required this.nameEn,
    required this.price,
    required this.description,
    this.thumbnailUrl,
    this.imageId,  // Image ID for downloading from server
    this.imageFilename,  // Image filename for offline kiosk operation
    this.videoFilename,  // Video filename for menu item video playback
    this.available = true,
    required this.order,
    this.sizeEnabled = true,
    this.temperatureEnabled = true,
    this.extrasEnabled = true,
  });

  // Convert to CoffeeMenuItem for compatibility with existing code
  toCoffeeMenuItem() {
    // Note: This will be implemented to convert to the existing CoffeeMenuItem class
    // For now, we'll update CoffeeMenuItem to accept optional imageUrl
  }
}

class MenuOptions {
  final List<SizeOption> sizes;
  final List<TemperatureOption> temperatures;
  final List<ExtraOption> extras;

  MenuOptions({
    required this.sizes,
    required this.temperatures,
    required this.extras,
  });
}

class SizeOption {
  final String id;
  final String name;
  final String nameKo;
  final int additionalPrice;

  SizeOption({
    required this.id,
    required this.name,
    required this.nameKo,
    this.additionalPrice = 0,
  });
}

class TemperatureOption {
  final String id;
  final String name;
  final String nameKo;

  TemperatureOption({
    required this.id,
    required this.name,
    required this.nameKo,
  });
}

class ExtraOption {
  final String id;
  final String name;
  final String nameEn;
  final int additionalPrice;

  ExtraOption({
    required this.id,
    required this.name,
    required this.nameEn,
    this.additionalPrice = 0,
  });
}

class MenuActions {
  final ActionVideo? addToCart;          // Video for adding item to cart
  final ActionVideo? checkout;            // Video for checkout/payment
  final ActionVideo? increaseQuantity;    // Video for increasing item quantity
  final ActionVideo? decreaseQuantity;    // Video for decreasing item quantity
  final ActionVideo? cancelItem;          // Video for canceling/removing item

  MenuActions({
    this.addToCart,
    this.checkout,
    this.increaseQuantity,
    this.decreaseQuantity,
    this.cancelItem,
  });
}

class ActionVideo {
  final String? videoId;
  final String? videoFilename;

  ActionVideo({
    this.videoId,
    this.videoFilename,
  });
}
