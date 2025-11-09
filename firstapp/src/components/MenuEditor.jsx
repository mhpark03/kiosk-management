import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import menuService from '../services/menuService';
import videoService from '../services/videoService';
import './MenuEditor.css';

function MenuEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(null);
  const [originalMenu, setOriginalMenu] = useState(null); // Store original menu for comparison
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null); // 'category' | 'item'
  const [selectedId, setSelectedId] = useState(null);

  // S3 Save states (no modal needed)
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    try {
      setLoading(true);

      if (id === 'new') {
        // New menu from state (passed from MenuList)
        if (location.state?.newMenu) {
          const newMenuData = {
            ...location.state.newMenu,
            description: location.state.newMenu.description || `${location.state.newMenu.name} 메뉴 설정 (버전: ${location.state.newMenu.version})`
          };
          setMenu(newMenuData);
          setOriginalMenu(JSON.parse(JSON.stringify(newMenuData))); // Deep copy for comparison

          // Auto-select first category on new menu
          if (newMenuData.categories && newMenuData.categories.length > 0) {
            setSelectedType('category');
            setSelectedId(newMenuData.categories[0].id);
          }
        } else {
          alert('메뉴 데이터를 찾을 수 없습니다.');
          navigate('/menus');
        }
      } else {
        // Load existing menu from S3
        const menuData = await menuService.getMenuById(id);

        // Check if content exists
        if (!menuData.content) {
          throw new Error('메뉴 파일의 내용을 불러올 수 없습니다. 파일이 손상되었거나 접근할 수 없습니다.');
        }

        // Fix XML content by escaping unescaped & characters in URLs and other places
        let xmlContent = menuData.content;

        // This regex finds & that are not part of existing XML entities (&amp;, &lt;, &gt;, &quot;, &apos;)
        xmlContent = xmlContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');

        // Parse XML content
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
          console.error('XML Parser Error:', parserError[0].textContent);
          alert('XML 파싱 에러: ' + parserError[0].textContent);
          navigate('/menus');
          return;
        }

        const parsedMenu = parseXMLToMenu(xmlDoc);

        parsedMenu.id = id;
        parsedMenu.s3Key = menuData.s3Key;
        parsedMenu.description = menuData.description || `${parsedMenu.name} 메뉴 설정 (버전: ${parsedMenu.version})`; // Store description from S3 metadata

        setMenu(parsedMenu);
        setOriginalMenu(JSON.parse(JSON.stringify(parsedMenu))); // Deep copy for comparison

        // Auto-select first category on load
        if (parsedMenu.categories && parsedMenu.categories.length > 0) {
          setSelectedType('category');
          setSelectedId(parsedMenu.categories[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load menu:', error);
      alert('메뉴를 불러오는데 실패했습니다: ' + error.message);
      navigate('/menus');
    } finally {
      setLoading(false);
    }
  };

  const parseXMLToMenu = (xmlDoc) => {
    const metadata = xmlDoc.getElementsByTagName('metadata')[0];
    const name = metadata?.getElementsByTagName('name')[0]?.textContent || '불러온 메뉴';
    const version = metadata?.getElementsByTagName('version')[0]?.textContent || '1.0.0';

    const categories = Array.from(xmlDoc.getElementsByTagName('category')).map(cat => ({
      id: cat.getAttribute('id'),
      name: cat.getAttribute('name'),
      nameEn: cat.getAttribute('nameEn'),
      icon: cat.getAttribute('icon'),
      order: parseInt(cat.getAttribute('order') || '0'),
    }));

    const menuItems = Array.from(xmlDoc.getElementsByTagName('item')).map(item => ({
      id: item.getAttribute('id'),
      category: item.getAttribute('category'),
      order: parseInt(item.getAttribute('order') || '0'),
      name: item.getElementsByTagName('name')[0]?.textContent || '',
      nameEn: item.getElementsByTagName('nameEn')[0]?.textContent || '',
      price: parseInt(item.getElementsByTagName('price')[0]?.textContent || '0'),
      description: item.getElementsByTagName('description')[0]?.textContent || '',
      thumbnailUrl: item.getElementsByTagName('thumbnailUrl')[0]?.textContent || null,
      imageId: item.getElementsByTagName('imageId')[0]?.textContent || null,
      imageFilename: item.getElementsByTagName('imageFilename')[0]?.textContent || null,
      available: item.getElementsByTagName('available')[0]?.textContent === 'true',
      sizeEnabled: item.getElementsByTagName('sizeEnabled')[0]?.textContent === 'true',
      temperatureEnabled: item.getElementsByTagName('temperatureEnabled')[0]?.textContent === 'true',
      extrasEnabled: item.getElementsByTagName('extrasEnabled')[0]?.textContent === 'true',
    }));

    const sizes = Array.from(xmlDoc.getElementsByTagName('size')).map(size => ({
      id: size.getAttribute('id'),
      name: size.getAttribute('name'),
      nameKo: size.getAttribute('nameKo'),
      additionalPrice: parseInt(size.getAttribute('additionalPrice') || '0'),
    }));

    const temperatures = Array.from(xmlDoc.getElementsByTagName('temperature')).map(temp => ({
      id: temp.getAttribute('id'),
      name: temp.getAttribute('name'),
      nameKo: temp.getAttribute('nameKo'),
    }));

    const extras = Array.from(xmlDoc.getElementsByTagName('extra')).map(extra => ({
      id: extra.getAttribute('id'),
      name: extra.getAttribute('name'),
      nameEn: extra.getAttribute('nameEn'),
      additionalPrice: parseInt(extra.getAttribute('additionalPrice') || '0'),
    }));

    return {
      name,
      version,
      lastModified: new Date().toISOString(),
      categories,
      menuItems,
      options: { sizes, temperatures, extras },
    };
  };

  // Check if menu has been modified
  const hasChanges = () => {
    if (!menu || !originalMenu) return false;
    // For new menus (including copied menus), always allow saving to S3
    if (id === 'new') return true;
    return JSON.stringify(menu) !== JSON.stringify(originalMenu);
  };

  const updateMenu = (updatedMenu) => {
    setMenu(updatedMenu);
  };

  const handleBackToList = () => {
    navigate('/menus');
  };

  const handleS3SaveClick = async () => {
    if (!menu) return;

    if (!menu.name.trim()) {
      setSaveError('제목을 입력해주세요.');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }

    try {
      setIsSaving(true);
      setSaveError('');

      const xml = generateXML(menu);

      if (id === 'new') {
        // New menu - upload
        await menuService.uploadMenuXML(xml, menu.name, menu.description);
        setSaveSuccess('S3에 성공적으로 저장되었습니다!');
      } else {
        // Existing menu - update (delete and re-upload)
        await menuService.updateMenu(id, xml, menu.name, menu.description);
        setSaveSuccess('메뉴가 성공적으로 업데이트되었습니다!');
      }

      // Update originalMenu to reflect saved state
      setOriginalMenu(JSON.parse(JSON.stringify(menu)));

      setTimeout(() => {
        setSaveSuccess('');
        navigate('/menus', { state: { reload: true } }); // Return to menu list with reload flag
      }, 2000);
    } catch (error) {
      setSaveError(error.message || 'S3 저장 중 오류가 발생했습니다.');
      setTimeout(() => setSaveError(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const exportXML = () => {
    if (!menu) return;

    const xml = generateXML(menu);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${menu.name.replace(/ /g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper function to escape XML special characters
  const escapeXML = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const generateXML = (menu) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<kioskMenu>\n';

    // Metadata
    xml += '  <metadata>\n';
    xml += `    <name>${escapeXML(menu.name)}</name>\n`;
    xml += `    <version>${escapeXML(menu.version)}</version>\n`;
    xml += `    <lastModified>${escapeXML(menu.lastModified)}</lastModified>\n`;
    xml += '  </metadata>\n\n';

    // Categories
    xml += '  <categories>\n';
    menu.categories.forEach(cat => {
      xml += `    <category id="${escapeXML(cat.id)}" name="${escapeXML(cat.name)}" nameEn="${escapeXML(cat.nameEn)}" icon="${escapeXML(cat.icon)}" order="${cat.order}" />\n`;
    });
    xml += '  </categories>\n\n';

    // Menu Items
    xml += '  <menuItems>\n';
    menu.menuItems.forEach(item => {
      xml += `    <item id="${escapeXML(item.id)}" category="${escapeXML(item.category)}" order="${item.order}">\n`;
      xml += `      <name>${escapeXML(item.name)}</name>\n`;
      xml += `      <nameEn>${escapeXML(item.nameEn)}</nameEn>\n`;
      xml += `      <price>${item.price}</price>\n`;
      xml += `      <description>${escapeXML(item.description)}</description>\n`;
      if (item.thumbnailUrl) {
        xml += `      <thumbnailUrl>${escapeXML(item.thumbnailUrl)}</thumbnailUrl>\n`;
      }
      if (item.imageId) {
        xml += `      <imageId>${escapeXML(item.imageId)}</imageId>\n`;
      }
      if (item.imageFilename) {
        xml += `      <imageFilename>${escapeXML(item.imageFilename)}</imageFilename>\n`;
      }
      xml += `      <available>${item.available}</available>\n`;
      xml += `      <sizeEnabled>${item.sizeEnabled}</sizeEnabled>\n`;
      xml += `      <temperatureEnabled>${item.temperatureEnabled}</temperatureEnabled>\n`;
      xml += `      <extrasEnabled>${item.extrasEnabled}</extrasEnabled>\n`;
      xml += `    </item>\n`;
    });
    xml += '  </menuItems>\n\n';

    // Options
    xml += '  <options>\n';
    xml += '    <sizes>\n';
    menu.options.sizes.forEach(size => {
      xml += `      <size id="${escapeXML(size.id)}" name="${escapeXML(size.name)}" nameKo="${escapeXML(size.nameKo)}" additionalPrice="${size.additionalPrice}" />\n`;
    });
    xml += '    </sizes>\n';
    xml += '    <temperatures>\n';
    menu.options.temperatures.forEach(temp => {
      xml += `      <temperature id="${escapeXML(temp.id)}" name="${escapeXML(temp.name)}" nameKo="${escapeXML(temp.nameKo)}" />\n`;
    });
    xml += '    </temperatures>\n';
    xml += '    <extras>\n';
    menu.options.extras.forEach(extra => {
      xml += `      <extra id="${escapeXML(extra.id)}" name="${escapeXML(extra.name)}" nameEn="${escapeXML(extra.nameEn)}" additionalPrice="${extra.additionalPrice}" />\n`;
    });
    xml += '    </extras>\n';
    xml += '  </options>\n';

    xml += '</kioskMenu>';
    return xml;
  };

  const addCategory = () => {
    // Auto-generate category with default values
    const categoryNumber = menu.categories.length + 1;
    const name = `새 카테고리 ${categoryNumber}`;
    const nameEn = `New Category ${categoryNumber}`;
    const icon = 'coffee';

    const newCategory = {
      id: `category_${Date.now()}`,
      name,
      nameEn,
      icon,
      order: categoryNumber,
    };
    const updatedMenu = {
      ...menu,
      categories: [...menu.categories, newCategory],
    };
    updateMenu(updatedMenu);

    // Auto-select the new category for editing
    setSelectedType('category');
    setSelectedId(newCategory.id);
  };

  const addItem = (categoryId) => {
    // Auto-generate item with default values
    const itemsInCategory = menu.menuItems.filter(i => i.category === categoryId);
    const itemNumber = itemsInCategory.length + 1;
    const name = `새 메뉴 ${itemNumber}`;
    const nameEn = `New Item ${itemNumber}`;
    const price = 4000;

    const newItem = {
      id: `${categoryId}_${Date.now()}`,
      category: categoryId,
      name,
      nameEn,
      price,
      description: '',
      thumbnailUrl: null,
      imageId: null,
      available: true,
      sizeEnabled: true,
      temperatureEnabled: true,
      extrasEnabled: true,
      order: itemNumber,
    };
    const updatedMenu = {
      ...menu,
      menuItems: [...menu.menuItems, newItem],
    };
    updateMenu(updatedMenu);

    // Auto-select the new item for editing
    setSelectedType('item');
    setSelectedId(newItem.id);
  };

  const deleteCategory = (categoryId) => {
    const itemsInCategory = menu.menuItems.filter(i => i.category === categoryId);

    if (itemsInCategory.length > 0) {
      alert('이 카테고리에 메뉴 아이템이 있습니다. 먼저 아이템을 삭제해주세요.');
      return;
    }

    if (window.confirm('이 카테고리를 삭제하시겠습니까?')) {
      const updatedMenu = {
        ...menu,
        categories: menu.categories.filter(c => c.id !== categoryId),
      };
      updateMenu(updatedMenu);
      // Clear selection if deleted category was selected
      if (selectedType === 'category' && selectedId === categoryId) {
        setSelectedType(null);
        setSelectedId(null);
      }
    }
  };

  const deleteItem = (itemId) => {
    if (window.confirm('이 메뉴 아이템을 삭제하시겠습니까?')) {
      const updatedMenu = {
        ...menu,
        menuItems: menu.menuItems.filter(i => i.id !== itemId),
      };
      updateMenu(updatedMenu);
      // Clear selection if deleted item was selected
      if (selectedType === 'item' && selectedId === itemId) {
        setSelectedType(null);
        setSelectedId(null);
      }
    }
  };

  if (loading || !menu) {
    return (
      <div className="menu-editor-container">
        <div className="menu-editor-header">
          <h1>메뉴 편집</h1>
        </div>
        <div style={{textAlign: 'center', padding: '40px'}}>
          메뉴를 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="menu-editor-container">
      <div className="menu-editor-header">
        <button className="btn btn-back" onClick={handleBackToList}>
          ← 목록으로
        </button>
        <div className="header-inputs">
          <div style={{ flex: '0 0 300px' }}>
            <input
              type="text"
              value={menu.name}
              onChange={(e) => updateMenu({ ...menu, name: e.target.value })}
              placeholder="메뉴 제목"
              className="header-title-input"
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={menu.description || ''}
              onChange={(e) => updateMenu({ ...menu, description: e.target.value })}
              placeholder="메뉴 설명 (선택사항)"
              className="header-desc-input"
            />
          </div>
        </div>
        <div className="menu-editor-actions">
          <button
            className="btn btn-primary"
            onClick={handleS3SaveClick}
            disabled={!hasChanges() || isSaving}
            title={!hasChanges() ? '변경사항이 없습니다' : 'S3에 저장'}
          >
            {isSaving ? '저장 중...' : '💾 S3 저장'}
          </button>
        </div>
      </div>

      {/* Error/Success messages */}
      {saveError && (
        <div style={{
          padding: '12px',
          margin: '0 20px 20px 20px',
          backgroundColor: '#fed7d7',
          color: '#c53030',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div style={{
          padding: '12px',
          margin: '0 20px 20px 20px',
          backgroundColor: '#c6f6d5',
          color: '#2f855a',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {saveSuccess}
        </div>
      )}

      <div className="menu-editor-content">
        {/* Left: Tree View */}
        <div className="menu-tree">
          <div className="menu-tree-header">
            <h3>구조</h3>
            <button className="btn-small" onClick={addCategory}>+ 카테고리</button>
          </div>

          {menu.categories.map(category => (
            <div key={category.id} className="tree-category">
              <div
                className={`tree-category-header ${selectedType === 'category' && selectedId === category.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedType('category');
                  setSelectedId(category.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <span className="tree-icon">{getCategoryIcon(category.icon)}</span>
                <span className="tree-label">{category.name}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button className="btn-small" onClick={(e) => { e.stopPropagation(); addItem(category.id); }}>+</button>
                  <button className="btn-delete" onClick={(e) => { e.stopPropagation(); deleteCategory(category.id); }}>🗑️</button>
                </div>
              </div>

              <div className="tree-items">
                {menu.menuItems.filter(i => i.category === category.id).map(item => (
                  <div
                    key={item.id}
                    className={`tree-item ${selectedType === 'item' && selectedId === item.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedType('item');
                      setSelectedId(item.id);
                    }}
                  >
                    <span className="tree-icon">☕</span>
                    <span className="tree-label">{item.name}</span>
                    <span className="tree-price">₩{item.price.toLocaleString()}</span>
                    <button className="btn-delete" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Detail Panel */}
        <div className="menu-detail">
          {selectedType === 'category' && selectedId ? (
            <CategoryEditor
              category={menu.categories.find(c => c.id === selectedId)}
              onUpdate={(updatedCategory) => {
                const updatedMenu = {
                  ...menu,
                  categories: menu.categories.map(c => c.id === selectedId ? updatedCategory : c),
                };
                updateMenu(updatedMenu);
              }}
            />
          ) : selectedType === 'item' && selectedId ? (
            <ItemEditor
              item={menu.menuItems.find(i => i.id === selectedId)}
              onUpdate={(updatedItem) => {
                const updatedMenu = {
                  ...menu,
                  menuItems: menu.menuItems.map(i => i.id === selectedId ? updatedItem : i),
                };
                updateMenu(updatedMenu);
              }}
            />
          ) : (
            <div className="menu-detail-empty">
              <p>왼쪽에서 카테고리 또는 메뉴 아이템을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryEditor({ category, onUpdate }) {
  const [formData, setFormData] = useState(category);

  // Update formData when category prop changes
  useEffect(() => {
    setFormData(category);
  }, [category]);

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const iconOptions = [
    { value: 'coffee', label: '☕ 커피', emoji: '☕' },
    { value: 'local_drink', label: '🥤 음료', emoji: '🥤' },
    { value: 'cake', label: '🍰 케이크', emoji: '🍰' },
    { value: 'icecream', label: '🍦 아이스크림', emoji: '🍦' },
    { value: 'food', label: '🍽️ 음식', emoji: '🍽️' },
  ];

  return (
    <div className="item-editor">
      <h3>카테고리 편집</h3>

      <div className="form-group">
        <label>이름 (한글)</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>이름 (영문)</label>
        <input
          type="text"
          value={formData.nameEn}
          onChange={(e) => handleChange('nameEn', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>아이콘</label>
        <select
          value={formData.icon}
          onChange={(e) => handleChange('icon', e.target.value)}
          style={{ fontSize: '16px', padding: '8px' }}
        >
          {iconOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px' }}>
        <strong>미리보기:</strong>
        <div style={{ marginTop: '8px', fontSize: '18px' }}>
          {getCategoryIcon(formData.icon)} {formData.name}
        </div>
      </div>
    </div>
  );
}

function ItemEditor({ item, onUpdate }) {
  const [formData, setFormData] = useState(item);
  const [menuImages, setMenuImages] = useState([]);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentImageUrl, setCurrentImageUrl] = useState(item.thumbnailUrl);
  const imagesPerPage = 10;

  // Update formData when item prop changes
  useEffect(() => {
    setFormData(item);
  }, [item]);

  // Load fresh presigned URL for current image if imageId exists
  useEffect(() => {
    const loadImageUrl = async () => {
      if (formData.imageId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.imageId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentImageUrl(presignedUrl);
          console.log(`[MENU IMAGE] Loaded fresh presigned URL for imageId ${formData.imageId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for imageId ${formData.imageId}:`, error);
          setCurrentImageUrl(null);
        }
      } else {
        setCurrentImageUrl(formData.thumbnailUrl);
      }
    };

    loadImageUrl();
  }, [formData.imageId]);

  // Load menu images from S3
  useEffect(() => {
    if (showImageSelector && menuImages.length === 0) {
      loadMenuImages();
    }
  }, [showImageSelector]);

  const loadMenuImages = async () => {
    try {
      setLoadingImages(true);
      const images = await videoService.getAllImages('MENU');

      // Generate presigned URLs for each image (since S3 is private)
      const imagesWithPresignedUrls = await Promise.all(
        images.map(async (image) => {
          try {
            const presignedData = await videoService.getPresignedUrl(image.id, 60); // 60 minutes
            return {
              ...image,
              presignedUrl: presignedData.url || presignedData.presignedUrl || presignedData
            };
          } catch (error) {
            console.error(`Failed to get presigned URL for image ${image.id}:`, error);
            return {
              ...image,
              presignedUrl: null
            };
          }
        })
      );

      // Filter out images without presigned URLs
      const validImages = imagesWithPresignedUrls.filter(img => img.presignedUrl);
      setMenuImages(validImages);
    } catch (error) {
      console.error('Failed to load menu images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleSelectImage = (image) => {
    // Use presigned URL for display (S3 is private) and store imageId + filename for kiosk download
    const updated = {
      ...formData,
      thumbnailUrl: image.presignedUrl,
      imageId: String(image.id), // Store image ID for kiosk to download later
      imageFilename: image.filename // Store filename for offline kiosk usage
    };
    setFormData(updated);
    onUpdate(updated);
    setShowImageSelector(false);
    setCurrentPage(1);
  };

  // Pagination logic
  const totalPages = Math.ceil(menuImages.length / imagesPerPage);
  const indexOfLastImage = currentPage * imagesPerPage;
  const indexOfFirstImage = indexOfLastImage - imagesPerPage;
  const currentImages = menuImages.slice(indexOfFirstImage, indexOfLastImage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="item-editor">
      <h3>메뉴 아이템 편집</h3>

      <div className="form-group">
        <label>이름 (한글)</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>이름 (영문)</label>
        <input
          type="text"
          value={formData.nameEn}
          onChange={(e) => handleChange('nameEn', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>가격 (₩)</label>
        <input
          type="number"
          value={formData.price}
          onChange={(e) => handleChange('price', parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="form-group">
        <label>설명</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>메뉴 이미지</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {currentImageUrl && (
            <img
              src={currentImageUrl}
              alt="선택된 이미지"
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '2px solid #e2e8f0'
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <button
              type="button"
              onClick={() => setShowImageSelector(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {currentImageUrl ? '이미지 변경' : '이미지 선택'}
            </button>
            {currentImageUrl && (
              <button
                type="button"
                onClick={() => {
                  const updated = { ...formData, thumbnailUrl: null, imageId: null };
                  setFormData(updated);
                  onUpdate(updated);
                  setCurrentImageUrl(null);
                }}
                style={{
                  marginLeft: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                이미지 제거
              </button>
            )}
          </div>
        </div>

        {/* Image Selector Modal */}
        {showImageSelector && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  메뉴 이미지 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowImageSelector(false); setCurrentPage(1); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#cbd5e0',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  닫기
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingImages ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    이미지 목록을 불러오는 중...
                  </div>
                ) : menuImages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 메뉴 이미지가 없습니다.<br />
                    이미지 관리 페이지에서 이미지를 업로드하세요.
                  </div>
                ) : (
                  <>
                    {/* Image List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentImages.map((image, index) => (
                        <div
                          key={image.id}
                          onClick={() => handleSelectImage(image)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.thumbnailUrl === image.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.thumbnailUrl === image.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.thumbnailUrl !== image.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.thumbnailUrl !== image.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          {/* Row Number */}
                          <div style={{
                            width: '25px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#718096',
                            fontSize: '13px',
                            flexShrink: 0
                          }}>
                            {indexOfFirstImage + index + 1}
                          </div>

                          {/* Thumbnail */}
                          <img
                            src={image.presignedUrl}
                            alt={image.title}
                            style={{
                              width: '50px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              flexShrink: 0
                            }}
                          />

                          {/* Image Info */}
                          <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minWidth: 0
                          }}>
                            <div style={{
                              flex: '0 0 200px',
                              minWidth: 0
                            }}>
                              <div style={{
                                fontWeight: '600',
                                fontSize: '14px',
                                color: '#2d3748',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {image.title}
                              </div>
                            </div>
                            <div style={{
                              flex: 1,
                              minWidth: 0
                            }}>
                              <div style={{
                                fontSize: '13px',
                                color: '#718096',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {image.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(image.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>

                          {/* Selected Indicator */}
                          {formData.thumbnailUrl === image.presignedUrl && (
                            <div style={{
                              padding: '4px 10px',
                              backgroundColor: '#667eea',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              flexShrink: 0
                            }}>
                              선택됨
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{
                        marginTop: '24px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '6px',
                            backgroundColor: currentPage === 1 ? '#f7fafc' : 'white',
                            color: currentPage === 1 ? '#a0aec0' : '#2d3748',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          이전
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            style={{
                              padding: '8px 12px',
                              border: pageNum === currentPage ? '2px solid #667eea' : '1px solid #cbd5e0',
                              borderRadius: '6px',
                              backgroundColor: pageNum === currentPage ? '#667eea' : 'white',
                              color: pageNum === currentPage ? 'white' : '#2d3748',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: pageNum === currentPage ? '600' : '500',
                              minWidth: '40px'
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}

                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '6px',
                            backgroundColor: currentPage === totalPages ? '#f7fafc' : 'white',
                            color: currentPage === totalPages ? '#a0aec0' : '#2d3748',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          다음
                        </button>
                      </div>
                    )}

                    {/* Footer Info */}
                    <div style={{
                      marginTop: '16px',
                      textAlign: 'center',
                      fontSize: '13px',
                      color: '#718096'
                    }}>
                      전체 {menuImages.length}개 이미지 {totalPages > 1 && `(${currentPage} / ${totalPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-group-checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.available}
            onChange={(e) => handleChange('available', e.target.checked)}
          />
          판매 가능
        </label>
      </div>

      <div className="form-group-checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.sizeEnabled}
            onChange={(e) => handleChange('sizeEnabled', e.target.checked)}
          />
          사이즈 선택 가능
        </label>
      </div>

      <div className="form-group-checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.temperatureEnabled}
            onChange={(e) => handleChange('temperatureEnabled', e.target.checked)}
          />
          온도 선택 가능
        </label>
      </div>

      <div className="form-group-checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.extrasEnabled}
            onChange={(e) => handleChange('extrasEnabled', e.target.checked)}
          />
          추가 옵션 가능
        </label>
      </div>
    </div>
  );
}

function getCategoryIcon(iconName) {
  switch (iconName) {
    case 'coffee': return '☕';
    case 'local_drink': return '🥤';
    case 'cake': return '🍰';
    case 'icecream': return '🍦';
    default: return '🍽️';
  }
}

export default MenuEditor;
