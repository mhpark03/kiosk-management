import 'package:xml/xml.dart';
import '../models/menu_config.dart';

class XmlGenerator {
  /// Generate XML string from MenuConfig
  static String generateXml(MenuConfig config) {
    final builder = XmlBuilder();

    builder.processing('xml', 'version="1.0" encoding="UTF-8"');
    builder.element('kioskMenu', nest: () {
      // Metadata
      _buildMetadata(builder, config.metadata);

      // Categories
      _buildCategories(builder, config.categories);

      // Menu Items
      _buildMenuItems(builder, config.menuItems);

      // Options
      _buildOptions(builder, config.options);
    });

    return builder.buildDocument().toXmlString(pretty: true, indent: '  ');
  }

  static void _buildMetadata(XmlBuilder builder, MenuMetadata metadata) {
    builder.element('metadata', nest: () {
      builder.element('name', nest: metadata.name);
      builder.element('version', nest: metadata.version);
      builder.element('lastModified', nest: DateTime.now().toIso8601String());
    });
  }

  static void _buildCategories(XmlBuilder builder, List<MenuCategory> categories) {
    builder.element('categories', nest: () {
      // Sort by order
      final sortedCategories = List<MenuCategory>.from(categories)
        ..sort((a, b) => a.order.compareTo(b.order));

      for (final category in sortedCategories) {
        builder.element('category', nest: () {
          builder.attribute('id', category.id);
          builder.attribute('name', category.name);
          builder.attribute('nameEn', category.nameEn);
          builder.attribute('icon', category.icon);
          builder.attribute('order', category.order.toString());
        });
      }
    });
  }

  static void _buildMenuItems(XmlBuilder builder, List<MenuItem> menuItems) {
    builder.element('menuItems', nest: () {
      // Sort by category, then by order
      final sortedItems = List<MenuItem>.from(menuItems)
        ..sort((a, b) {
          final catCompare = a.category.compareTo(b.category);
          if (catCompare != 0) return catCompare;
          return a.order.compareTo(b.order);
        });

      for (final item in sortedItems) {
        _buildMenuItem(builder, item);
      }
    });
  }

  static void _buildMenuItem(XmlBuilder builder, MenuItem item) {
    builder.element('item', nest: () {
      builder.attribute('id', item.id);
      builder.attribute('category', item.category);
      builder.attribute('order', item.order.toString());

      builder.element('name', nest: item.name);
      builder.element('nameEn', nest: item.nameEn);
      builder.element('price', nest: item.price.toString());
      builder.element('description', nest: item.description);

      if (item.thumbnailUrl != null && item.thumbnailUrl!.isNotEmpty) {
        builder.element('thumbnailUrl', nest: item.thumbnailUrl);
      }

      builder.element('available', nest: item.available.toString());
      builder.element('sizeEnabled', nest: item.sizeEnabled.toString());
      builder.element('temperatureEnabled', nest: item.temperatureEnabled.toString());
      builder.element('extrasEnabled', nest: item.extrasEnabled.toString());
    });
  }

  static void _buildOptions(XmlBuilder builder, MenuOptions options) {
    builder.element('options', nest: () {
      // Sizes
      builder.element('sizes', nest: () {
        for (final size in options.sizes) {
          builder.element('size', nest: () {
            builder.attribute('id', size.id);
            builder.attribute('name', size.name);
            builder.attribute('nameKo', size.nameKo);
            builder.attribute('additionalPrice', size.additionalPrice.toString());
          });
        }
      });

      // Temperatures
      builder.element('temperatures', nest: () {
        for (final temp in options.temperatures) {
          builder.element('temperature', nest: () {
            builder.attribute('id', temp.id);
            builder.attribute('name', temp.name);
            builder.attribute('nameKo', temp.nameKo);
          });
        }
      });

      // Extras
      builder.element('extras', nest: () {
        for (final extra in options.extras) {
          builder.element('extra', nest: () {
            builder.attribute('id', extra.id);
            builder.attribute('name', extra.name);
            builder.attribute('nameEn', extra.nameEn);
            builder.attribute('additionalPrice', extra.additionalPrice.toString());
          });
        }
      });
    });
  }
}
