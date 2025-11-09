import 'package:xml/xml.dart';
import '../models/menu_config.dart';

class XmlMenuParser {
  /// Parse XML string into MenuConfig
  static MenuConfig parseXml(String xmlContent) {
    final document = XmlDocument.parse(xmlContent);
    final root = document.rootElement;

    return MenuConfig(
      metadata: _parseMetadata(root.findElements('metadata').first),
      categories: _parseCategories(root.findElements('categories').first),
      menuItems: _parseMenuItems(root.findElements('menuItems').first),
      options: _parseOptions(root.findElements('options').first),
    );
  }

  static MenuMetadata _parseMetadata(XmlElement element) {
    return MenuMetadata(
      name: element.findElements('name').first.innerText,
      version: element.findElements('version').first.innerText,
      lastModified: element.findElements('lastModified').first.innerText,
    );
  }

  static List<MenuCategory> _parseCategories(XmlElement element) {
    return element.findElements('category').map((categoryElement) {
      return MenuCategory(
        id: categoryElement.getAttribute('id')!,
        name: categoryElement.getAttribute('name')!,
        nameEn: categoryElement.getAttribute('nameEn')!,
        icon: categoryElement.getAttribute('icon')!,
        order: int.parse(categoryElement.getAttribute('order') ?? '0'),
      );
    }).toList();
  }

  static List<MenuItem> _parseMenuItems(XmlElement element) {
    return element.findElements('item').map((itemElement) {
      return MenuItem(
        id: itemElement.getAttribute('id')!,
        category: itemElement.getAttribute('category')!,
        order: int.parse(itemElement.getAttribute('order') ?? '0'),
        name: itemElement.findElements('name').first.innerText,
        nameEn: itemElement.findElements('nameEn').first.innerText,
        price: int.parse(itemElement.findElements('price').first.innerText),
        description: itemElement.findElements('description').first.innerText,
        thumbnailUrl: itemElement.findElements('thumbnailUrl').isNotEmpty
            ? itemElement.findElements('thumbnailUrl').first.innerText
            : null,
        imageId: itemElement.findElements('imageId').isNotEmpty
            ? itemElement.findElements('imageId').first.innerText
            : null,
        imageFilename: itemElement.findElements('imageFilename').isNotEmpty
            ? itemElement.findElements('imageFilename').first.innerText
            : null,
        videoFilename: itemElement.findElements('videoFilename').isNotEmpty
            ? itemElement.findElements('videoFilename').first.innerText
            : null,
        available: itemElement.findElements('available').first.innerText == 'true',
        sizeEnabled: itemElement.findElements('sizeEnabled').first.innerText == 'true',
        temperatureEnabled: itemElement.findElements('temperatureEnabled').first.innerText == 'true',
        extrasEnabled: itemElement.findElements('extrasEnabled').first.innerText == 'true',
      );
    }).toList();
  }

  static MenuOptions _parseOptions(XmlElement element) {
    final sizesElement = element.findElements('sizes').first;
    final temperaturesElement = element.findElements('temperatures').first;
    final extrasElement = element.findElements('extras').first;

    return MenuOptions(
      sizes: sizesElement.findElements('size').map((sizeElement) {
        return SizeOption(
          id: sizeElement.getAttribute('id')!,
          name: sizeElement.getAttribute('name')!,
          nameKo: sizeElement.getAttribute('nameKo')!,
          additionalPrice: int.parse(sizeElement.getAttribute('additionalPrice') ?? '0'),
        );
      }).toList(),
      temperatures: temperaturesElement.findElements('temperature').map((tempElement) {
        return TemperatureOption(
          id: tempElement.getAttribute('id')!,
          name: tempElement.getAttribute('name')!,
          nameKo: tempElement.getAttribute('nameKo')!,
        );
      }).toList(),
      extras: extrasElement.findElements('extra').map((extraElement) {
        return ExtraOption(
          id: extraElement.getAttribute('id')!,
          name: extraElement.getAttribute('name')!,
          nameEn: extraElement.getAttribute('nameEn')!,
          additionalPrice: int.parse(extraElement.getAttribute('additionalPrice') ?? '0'),
        );
      }).toList(),
    );
  }
}
