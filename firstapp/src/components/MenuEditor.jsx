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

          // Don't auto-select anything - show MenuInfoEditor by default
          setSelectedType(null);
          setSelectedId(null);
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

        // Don't auto-select anything - show MenuInfoEditor by default
        setSelectedType(null);
        setSelectedId(null);
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
    const videoId = metadata?.getElementsByTagName('videoId')[0]?.textContent || null;
    const videoFilename = metadata?.getElementsByTagName('videoFilename')[0]?.textContent || null;
    const videoUrl = metadata?.getElementsByTagName('videoUrl')[0]?.textContent || null;

    const categories = Array.from(xmlDoc.getElementsByTagName('category')).map(cat => ({
      id: cat.getAttribute('id'),
      name: cat.getAttribute('name'),
      nameEn: cat.getAttribute('nameEn'),
      icon: cat.getAttribute('icon'),
      order: parseInt(cat.getAttribute('order') || '0'),
      videoId: cat.getAttribute('videoId') || null,
      videoFilename: cat.getAttribute('videoFilename') || null,
      videoUrl: cat.getAttribute('videoUrl') || null,
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
      videoId: item.getElementsByTagName('videoId')[0]?.textContent || null,
      videoFilename: item.getElementsByTagName('videoFilename')[0]?.textContent || null,
      videoUrl: item.getElementsByTagName('videoUrl')[0]?.textContent || null,
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

    // Parse actions if present
    let actions = null;
    const actionsElement = xmlDoc.getElementsByTagName('actions')[0];
    if (actionsElement) {
      const addToCartElement = actionsElement.getElementsByTagName('addToCart')[0];
      const checkoutElement = actionsElement.getElementsByTagName('checkout')[0];
      const increaseQuantityElement = actionsElement.getElementsByTagName('increaseQuantity')[0];
      const decreaseQuantityElement = actionsElement.getElementsByTagName('decreaseQuantity')[0];
      const cancelItemElement = actionsElement.getElementsByTagName('cancelItem')[0];

      actions = {};
      if (addToCartElement) {
        actions.addToCart = {
          videoId: addToCartElement.getAttribute('videoId') || null,
          videoFilename: addToCartElement.getAttribute('videoFilename') || null,
        };
      }
      if (checkoutElement) {
        actions.checkout = {
          videoId: checkoutElement.getAttribute('videoId') || null,
          videoFilename: checkoutElement.getAttribute('videoFilename') || null,
        };
      }
      if (increaseQuantityElement) {
        actions.increaseQuantity = {
          videoId: increaseQuantityElement.getAttribute('videoId') || null,
          videoFilename: increaseQuantityElement.getAttribute('videoFilename') || null,
        };
      }
      if (decreaseQuantityElement) {
        actions.decreaseQuantity = {
          videoId: decreaseQuantityElement.getAttribute('videoId') || null,
          videoFilename: decreaseQuantityElement.getAttribute('videoFilename') || null,
        };
      }
      if (cancelItemElement) {
        actions.cancelItem = {
          videoId: cancelItemElement.getAttribute('videoId') || null,
          videoFilename: cancelItemElement.getAttribute('videoFilename') || null,
        };
      }
    }

    return {
      name,
      version,
      lastModified: new Date().toISOString(),
      videoId,
      videoFilename,
      videoUrl,
      categories,
      menuItems,
      options: { sizes, temperatures, extras },
      actions,
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
    console.log('[GENERATE XML] Generating XML for menu:', menu.name);
    console.log('[GENERATE XML] Menu actions:', JSON.stringify(menu.actions, null, 2));

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<kioskMenu>\n';

    // Metadata
    xml += '  <metadata>\n';
    xml += `    <name>${escapeXML(menu.name)}</name>\n`;
    xml += `    <version>${escapeXML(menu.version)}</version>\n`;
    xml += `    <lastModified>${escapeXML(menu.lastModified)}</lastModified>\n`;
    if (menu.videoId) {
      xml += `    <videoId>${escapeXML(menu.videoId)}</videoId>\n`;
    }
    if (menu.videoFilename) {
      xml += `    <videoFilename>${escapeXML(menu.videoFilename)}</videoFilename>\n`;
    }
    if (menu.videoUrl) {
      xml += `    <videoUrl>${escapeXML(menu.videoUrl)}</videoUrl>\n`;
    }
    xml += '  </metadata>\n\n';

    // Categories
    xml += '  <categories>\n';
    menu.categories.forEach(cat => {
      xml += `    <category id="${escapeXML(cat.id)}" name="${escapeXML(cat.name)}" nameEn="${escapeXML(cat.nameEn)}" icon="${escapeXML(cat.icon)}" order="${cat.order}"`;
      if (cat.videoId) {
        xml += ` videoId="${escapeXML(cat.videoId)}"`;
      }
      if (cat.videoFilename) {
        xml += ` videoFilename="${escapeXML(cat.videoFilename)}"`;
      }
      if (cat.videoUrl) {
        xml += ` videoUrl="${escapeXML(cat.videoUrl)}"`;
      }
      xml += ` />\n`;
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
      if (item.videoId) {
        xml += `      <videoId>${escapeXML(item.videoId)}</videoId>\n`;
      }
      if (item.videoFilename) {
        xml += `      <videoFilename>${escapeXML(item.videoFilename)}</videoFilename>\n`;
      }
      if (item.videoUrl) {
        xml += `      <videoUrl>${escapeXML(item.videoUrl)}</videoUrl>\n`;
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
    xml += '  </options>\n\n';

    // Actions
    if (menu.actions) {
      xml += '  <actions>\n';
      if (menu.actions.addToCart) {
        xml += `    <addToCart`;
        if (menu.actions.addToCart.videoId) {
          xml += ` videoId="${escapeXML(menu.actions.addToCart.videoId)}"`;
        }
        if (menu.actions.addToCart.videoFilename) {
          xml += ` videoFilename="${escapeXML(menu.actions.addToCart.videoFilename)}"`;
        }
        xml += ` />\n`;
      }
      if (menu.actions.checkout) {
        xml += `    <checkout`;
        if (menu.actions.checkout.videoId) {
          xml += ` videoId="${escapeXML(menu.actions.checkout.videoId)}"`;
        }
        if (menu.actions.checkout.videoFilename) {
          xml += ` videoFilename="${escapeXML(menu.actions.checkout.videoFilename)}"`;
        }
        xml += ` />\n`;
      }
      if (menu.actions.increaseQuantity) {
        xml += `    <increaseQuantity`;
        if (menu.actions.increaseQuantity.videoId) {
          xml += ` videoId="${escapeXML(menu.actions.increaseQuantity.videoId)}"`;
        }
        if (menu.actions.increaseQuantity.videoFilename) {
          xml += ` videoFilename="${escapeXML(menu.actions.increaseQuantity.videoFilename)}"`;
        }
        xml += ` />\n`;
      }
      if (menu.actions.decreaseQuantity) {
        xml += `    <decreaseQuantity`;
        if (menu.actions.decreaseQuantity.videoId) {
          xml += ` videoId="${escapeXML(menu.actions.decreaseQuantity.videoId)}"`;
        }
        if (menu.actions.decreaseQuantity.videoFilename) {
          xml += ` videoFilename="${escapeXML(menu.actions.decreaseQuantity.videoFilename)}"`;
        }
        xml += ` />\n`;
      }
      if (menu.actions.cancelItem) {
        xml += `    <cancelItem`;
        if (menu.actions.cancelItem.videoId) {
          xml += ` videoId="${escapeXML(menu.actions.cancelItem.videoId)}"`;
        }
        if (menu.actions.cancelItem.videoFilename) {
          xml += ` videoFilename="${escapeXML(menu.actions.cancelItem.videoFilename)}"`;
        }
        xml += ` />\n`;
      }
      xml += '  </actions>\n\n';
    }

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
      videoId: null,
      videoFilename: null,
      videoUrl: null,
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
      imageFilename: null,
      videoId: null,
      videoFilename: null,
      videoUrl: null,
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
        <h2 style={{ flex: 1, margin: 0 }}>{menu.name || '메뉴 편집'}</h2>
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
            <h3
              onClick={() => {
                setSelectedType(null);
                setSelectedId(null);
              }}
              style={{
                cursor: 'pointer',
                padding: '8px',
                margin: '0',
                borderRadius: '4px',
                backgroundColor: selectedType === null && selectedId === null ? '#eef2ff' : 'transparent',
                color: selectedType === null && selectedId === null ? '#667eea' : 'inherit',
                transition: 'background-color 0.2s'
              }}
            >
              메뉴
            </h3>
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
            <MenuInfoEditor
              menu={menu}
              onUpdate={updateMenu}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MenuInfoEditor({ menu, onUpdate }) {
  const [formData, setFormData] = useState({
    name: menu.name || '',
    description: menu.description || '',
    videoId: menu.videoId || null,
    videoFilename: menu.videoFilename || null,
    videoUrl: menu.videoUrl || null,
    actions: menu.actions || { addToCart: null, checkout: null, increaseQuantity: null, decreaseQuantity: null, cancelItem: null }
  });
  const [videos, setVideos] = useState([]);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [showAddToCartVideoSelector, setShowAddToCartVideoSelector] = useState(false);
  const [showCheckoutVideoSelector, setShowCheckoutVideoSelector] = useState(false);
  const [showIncreaseQuantityVideoSelector, setShowIncreaseQuantityVideoSelector] = useState(false);
  const [showDecreaseQuantityVideoSelector, setShowDecreaseQuantityVideoSelector] = useState(false);
  const [showCancelItemVideoSelector, setShowCancelItemVideoSelector] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentAddToCartPage, setCurrentAddToCartPage] = useState(1);
  const [currentCheckoutPage, setCurrentCheckoutPage] = useState(1);
  const [currentIncreaseQuantityPage, setCurrentIncreaseQuantityPage] = useState(1);
  const [currentDecreaseQuantityPage, setCurrentDecreaseQuantityPage] = useState(1);
  const [currentCancelItemPage, setCurrentCancelItemPage] = useState(1);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(menu.videoUrl);
  const [currentAddToCartVideoUrl, setCurrentAddToCartVideoUrl] = useState(menu.actions?.addToCart?.videoUrl);
  const [currentCheckoutVideoUrl, setCurrentCheckoutVideoUrl] = useState(menu.actions?.checkout?.videoUrl);
  const [currentIncreaseQuantityVideoUrl, setCurrentIncreaseQuantityVideoUrl] = useState(menu.actions?.increaseQuantity?.videoUrl);
  const [currentDecreaseQuantityVideoUrl, setCurrentDecreaseQuantityVideoUrl] = useState(menu.actions?.decreaseQuantity?.videoUrl);
  const [currentCancelItemVideoUrl, setCurrentCancelItemVideoUrl] = useState(menu.actions?.cancelItem?.videoUrl);
  const videosPerPage = 10;

  // Update formData when menu prop changes
  useEffect(() => {
    setFormData({
      name: menu.name || '',
      description: menu.description || '',
      videoId: menu.videoId || null,
      videoFilename: menu.videoFilename || null,
      videoUrl: menu.videoUrl || null,
      actions: menu.actions || { addToCart: null, checkout: null, increaseQuantity: null, decreaseQuantity: null, cancelItem: null }
    });
  }, [menu]);

  // Load fresh presigned URL for current video if videoId exists
  useEffect(() => {
    const loadVideoUrl = async () => {
      if (formData.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentVideoUrl(presignedUrl);
          console.log(`[MENU VIDEO] Loaded fresh presigned URL for videoId ${formData.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for videoId ${formData.videoId}:`, error);
          setCurrentVideoUrl(null);
        }
      } else {
        setCurrentVideoUrl(formData.videoUrl);
      }
    };

    loadVideoUrl();
  }, [formData.videoId]);

  // Load fresh presigned URL for addToCart video if videoId exists
  useEffect(() => {
    const loadAddToCartVideoUrl = async () => {
      if (formData.actions?.addToCart?.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.actions.addToCart.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentAddToCartVideoUrl(presignedUrl);
          console.log(`[ADD TO CART VIDEO] Loaded fresh presigned URL for videoId ${formData.actions.addToCart.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for addToCart videoId:`, error);
          setCurrentAddToCartVideoUrl(null);
        }
      } else {
        setCurrentAddToCartVideoUrl(formData.actions?.addToCart?.videoUrl);
      }
    };

    loadAddToCartVideoUrl();
  }, [formData.actions?.addToCart?.videoId]);

  // Load fresh presigned URL for checkout video if videoId exists
  useEffect(() => {
    const loadCheckoutVideoUrl = async () => {
      if (formData.actions?.checkout?.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.actions.checkout.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentCheckoutVideoUrl(presignedUrl);
          console.log(`[CHECKOUT VIDEO] Loaded fresh presigned URL for videoId ${formData.actions.checkout.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for checkout videoId:`, error);
          setCurrentCheckoutVideoUrl(null);
        }
      } else {
        setCurrentCheckoutVideoUrl(formData.actions?.checkout?.videoUrl);
      }
    };

    loadCheckoutVideoUrl();
  }, [formData.actions?.checkout?.videoId]);

  // Load fresh presigned URL for increaseQuantity video if videoId exists
  useEffect(() => {
    const loadIncreaseQuantityVideoUrl = async () => {
      if (formData.actions?.increaseQuantity?.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.actions.increaseQuantity.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentIncreaseQuantityVideoUrl(presignedUrl);
          console.log(`[INCREASE QUANTITY VIDEO] Loaded fresh presigned URL for videoId ${formData.actions.increaseQuantity.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for increaseQuantity videoId:`, error);
          setCurrentIncreaseQuantityVideoUrl(null);
        }
      } else {
        setCurrentIncreaseQuantityVideoUrl(formData.actions?.increaseQuantity?.videoUrl);
      }
    };

    loadIncreaseQuantityVideoUrl();
  }, [formData.actions?.increaseQuantity?.videoId]);

  // Load fresh presigned URL for decreaseQuantity video if videoId exists
  useEffect(() => {
    const loadDecreaseQuantityVideoUrl = async () => {
      if (formData.actions?.decreaseQuantity?.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.actions.decreaseQuantity.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentDecreaseQuantityVideoUrl(presignedUrl);
          console.log(`[DECREASE QUANTITY VIDEO] Loaded fresh presigned URL for videoId ${formData.actions.decreaseQuantity.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for decreaseQuantity videoId:`, error);
          setCurrentDecreaseQuantityVideoUrl(null);
        }
      } else {
        setCurrentDecreaseQuantityVideoUrl(formData.actions?.decreaseQuantity?.videoUrl);
      }
    };

    loadDecreaseQuantityVideoUrl();
  }, [formData.actions?.decreaseQuantity?.videoId]);

  // Load fresh presigned URL for cancelItem video if videoId exists
  useEffect(() => {
    const loadCancelItemVideoUrl = async () => {
      if (formData.actions?.cancelItem?.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.actions.cancelItem.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentCancelItemVideoUrl(presignedUrl);
          console.log(`[CANCEL ITEM VIDEO] Loaded fresh presigned URL for videoId ${formData.actions.cancelItem.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for cancelItem videoId:`, error);
          setCurrentCancelItemVideoUrl(null);
        }
      } else {
        setCurrentCancelItemVideoUrl(formData.actions?.cancelItem?.videoUrl);
      }
    };

    loadCancelItemVideoUrl();
  }, [formData.actions?.cancelItem?.videoId]);

  // Load videos from S3
  useEffect(() => {
    if ((showVideoSelector || showAddToCartVideoSelector || showCheckoutVideoSelector || showIncreaseQuantityVideoSelector || showDecreaseQuantityVideoSelector || showCancelItemVideoSelector) && videos.length === 0) {
      loadVideos();
    }
  }, [showVideoSelector, showAddToCartVideoSelector, showCheckoutVideoSelector, showIncreaseQuantityVideoSelector, showDecreaseQuantityVideoSelector, showCancelItemVideoSelector]);

  const loadVideos = async () => {
    try {
      setLoadingVideos(true);
      const videoList = await videoService.getAllVideos('KIOSK');

      // Generate presigned URLs for each video
      const videosWithPresignedUrls = await Promise.all(
        videoList.map(async (video) => {
          try {
            const presignedData = await videoService.getPresignedUrl(video.id, 60);
            return {
              ...video,
              presignedUrl: presignedData.url || presignedData.presignedUrl || presignedData
            };
          } catch (error) {
            console.error(`Failed to get presigned URL for video ${video.id}:`, error);
            return {
              ...video,
              presignedUrl: null
            };
          }
        })
      );

      const validVideos = videosWithPresignedUrls.filter(v => v.presignedUrl);
      setVideos(validVideos);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleChange = (field, value) => {
    const updated = { ...menu, [field]: value };
    setFormData({ ...formData, [field]: value });
    onUpdate(updated);
  };

  const handleSelectVideo = (video) => {
    const updated = {
      ...menu,
      videoUrl: video.presignedUrl,
      videoId: String(video.id),
      videoFilename: video.originalFilename
    };
    setFormData({
      ...formData,
      videoUrl: video.presignedUrl,
      videoId: String(video.id),
      videoFilename: video.originalFilename
    });
    onUpdate(updated);
    setShowVideoSelector(false);
    setCurrentPage(1);
  };

  const handleSelectAddToCartVideo = (video) => {
    console.log('[ADD TO CART] Selected video:', {
      id: video.id,
      title: video.title,
      originalFilename: video.originalFilename
    });

    const updatedActions = {
      ...(formData.actions || {}),
      addToCart: {
        videoUrl: video.presignedUrl,
        videoId: String(video.id),
        videoFilename: video.originalFilename
      }
    };
    const updated = { ...menu, actions: updatedActions };
    console.log('[ADD TO CART] Updated menu actions:', updatedActions);

    setFormData({ ...formData, actions: updatedActions });
    onUpdate(updated);
    setShowAddToCartVideoSelector(false);
    setCurrentAddToCartPage(1);
  };

  const handleSelectCheckoutVideo = (video) => {
    const updatedActions = {
      ...(formData.actions || {}),
      checkout: {
        videoUrl: video.presignedUrl,
        videoId: String(video.id),
        videoFilename: video.originalFilename
      }
    };
    const updated = { ...menu, actions: updatedActions };
    setFormData({ ...formData, actions: updatedActions });
    onUpdate(updated);
    setShowCheckoutVideoSelector(false);
    setCurrentCheckoutPage(1);
  };

  const handleSelectIncreaseQuantityVideo = (video) => {
    const updatedActions = {
      ...(formData.actions || {}),
      increaseQuantity: {
        videoUrl: video.presignedUrl,
        videoId: String(video.id),
        videoFilename: video.originalFilename
      }
    };
    const updated = { ...menu, actions: updatedActions };
    setFormData({ ...formData, actions: updatedActions });
    onUpdate(updated);
    setShowIncreaseQuantityVideoSelector(false);
    setCurrentIncreaseQuantityPage(1);
  };

  const handleSelectDecreaseQuantityVideo = (video) => {
    const updatedActions = {
      ...(formData.actions || {}),
      decreaseQuantity: {
        videoUrl: video.presignedUrl,
        videoId: String(video.id),
        videoFilename: video.originalFilename
      }
    };
    const updated = { ...menu, actions: updatedActions };
    setFormData({ ...formData, actions: updatedActions });
    onUpdate(updated);
    setShowDecreaseQuantityVideoSelector(false);
    setCurrentDecreaseQuantityPage(1);
  };

  const handleSelectCancelItemVideo = (video) => {
    const updatedActions = {
      ...(formData.actions || {}),
      cancelItem: {
        videoUrl: video.presignedUrl,
        videoId: String(video.id),
        videoFilename: video.originalFilename
      }
    };
    const updated = { ...menu, actions: updatedActions };
    setFormData({ ...formData, actions: updatedActions });
    onUpdate(updated);
    setShowCancelItemVideoSelector(false);
    setCurrentCancelItemPage(1);
  };

  // Pagination logic for main video selector
  const totalPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastVideo = currentPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = videos.slice(indexOfFirstVideo, indexOfLastVideo);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Pagination logic for addToCart video selector
  const totalAddToCartPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastAddToCartVideo = currentAddToCartPage * videosPerPage;
  const indexOfFirstAddToCartVideo = indexOfLastAddToCartVideo - videosPerPage;
  const currentAddToCartVideos = videos.slice(indexOfFirstAddToCartVideo, indexOfLastAddToCartVideo);

  const handleAddToCartPageChange = (pageNumber) => {
    setCurrentAddToCartPage(pageNumber);
  };

  // Pagination logic for checkout video selector
  const totalCheckoutPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastCheckoutVideo = currentCheckoutPage * videosPerPage;
  const indexOfFirstCheckoutVideo = indexOfLastCheckoutVideo - videosPerPage;
  const currentCheckoutVideos = videos.slice(indexOfFirstCheckoutVideo, indexOfLastCheckoutVideo);

  const handleCheckoutPageChange = (pageNumber) => {
    setCurrentCheckoutPage(pageNumber);
  };

  // Pagination logic for increaseQuantity video selector
  const totalIncreaseQuantityPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastIncreaseQuantityVideo = currentIncreaseQuantityPage * videosPerPage;
  const indexOfFirstIncreaseQuantityVideo = indexOfLastIncreaseQuantityVideo - videosPerPage;
  const currentIncreaseQuantityVideos = videos.slice(indexOfFirstIncreaseQuantityVideo, indexOfLastIncreaseQuantityVideo);

  const handleIncreaseQuantityPageChange = (pageNumber) => {
    setCurrentIncreaseQuantityPage(pageNumber);
  };

  // Pagination logic for decreaseQuantity video selector
  const totalDecreaseQuantityPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastDecreaseQuantityVideo = currentDecreaseQuantityPage * videosPerPage;
  const indexOfFirstDecreaseQuantityVideo = indexOfLastDecreaseQuantityVideo - videosPerPage;
  const currentDecreaseQuantityVideos = videos.slice(indexOfFirstDecreaseQuantityVideo, indexOfLastDecreaseQuantityVideo);

  const handleDecreaseQuantityPageChange = (pageNumber) => {
    setCurrentDecreaseQuantityPage(pageNumber);
  };

  // Pagination logic for cancelItem video selector
  const totalCancelItemPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastCancelItemVideo = currentCancelItemPage * videosPerPage;
  const indexOfFirstCancelItemVideo = indexOfLastCancelItemVideo - videosPerPage;
  const currentCancelItemVideos = videos.slice(indexOfFirstCancelItemVideo, indexOfLastCancelItemVideo);

  const handleCancelItemPageChange = (pageNumber) => {
    setCurrentCancelItemPage(pageNumber);
  };

  return (
    <div className="item-editor">
      <h3>메뉴 정보</h3>

      <div className="form-group">
        <label>제목</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
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
        <label>메뉴 영상 설정</label>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f7fafc' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', width: '150px' }}>영상 타입</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>미리보기</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '200px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {/* 메인 영상 */}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: '500' }}>메인 영상</td>
              <td style={{ padding: '12px' }}>
                {currentVideoUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <video
                      src={currentVideoUrl}
                      preload="metadata"
                      muted
                      style={{
                        width: '120px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#000',
                        flexShrink: 0
                      }}
                    />
                    {formData.videoId && videos.find(v => v.id === parseInt(formData.videoId)) && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                          {videos.find(v => v.id === parseInt(formData.videoId)).title}
                        </div>
                        <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videos.find(v => v.id === parseInt(formData.videoId)).description || '설명 없음'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '14px' }}>선택된 영상 없음</span>
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowVideoSelector(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {currentVideoUrl ? '변경' : '선택'}
                  </button>
                  {currentVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...menu, videoUrl: null, videoId: null, videoFilename: null };
                        setFormData({ ...formData, videoUrl: null, videoId: null, videoFilename: null });
                        onUpdate(updated);
                        setCurrentVideoUrl(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {/* 장바구니 추가 영상 */}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: '500' }}>장바구니 추가</td>
              <td style={{ padding: '12px' }}>
                {currentAddToCartVideoUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <video
                      src={currentAddToCartVideoUrl}
                      preload="metadata"
                      muted
                      style={{
                        width: '120px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#000',
                        flexShrink: 0
                      }}
                    />
                    {formData.actions?.addToCart?.videoId && videos.find(v => v.id === parseInt(formData.actions.addToCart.videoId)) && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.addToCart.videoId)).title}
                        </div>
                        <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.addToCart.videoId)).description || '설명 없음'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '14px' }}>선택된 영상 없음</span>
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddToCartVideoSelector(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {currentAddToCartVideoUrl ? '변경' : '선택'}
                  </button>
                  {currentAddToCartVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedActions = { ...(formData.actions || {}), addToCart: null };
                        const updated = { ...menu, actions: updatedActions };
                        setFormData({ ...formData, actions: updatedActions });
                        onUpdate(updated);
                        setCurrentAddToCartVideoUrl(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {/* 결제하기 영상 */}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: '500' }}>결제하기</td>
              <td style={{ padding: '12px' }}>
                {currentCheckoutVideoUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <video
                      src={currentCheckoutVideoUrl}
                      preload="metadata"
                      muted
                      style={{
                        width: '120px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#000',
                        flexShrink: 0
                      }}
                    />
                    {formData.actions?.checkout?.videoId && videos.find(v => v.id === parseInt(formData.actions.checkout.videoId)) && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.checkout.videoId)).title}
                        </div>
                        <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.checkout.videoId)).description || '설명 없음'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '14px' }}>선택된 영상 없음</span>
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowCheckoutVideoSelector(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {currentCheckoutVideoUrl ? '변경' : '선택'}
                  </button>
                  {currentCheckoutVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedActions = { ...(formData.actions || {}), checkout: null };
                        const updated = { ...menu, actions: updatedActions };
                        setFormData({ ...formData, actions: updatedActions });
                        onUpdate(updated);
                        setCurrentCheckoutVideoUrl(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {/* 수량 증가 영상 */}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: '500' }}>수량 증가</td>
              <td style={{ padding: '12px' }}>
                {currentIncreaseQuantityVideoUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <video
                      src={currentIncreaseQuantityVideoUrl}
                      preload="metadata"
                      muted
                      style={{
                        width: '120px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#000',
                        flexShrink: 0
                      }}
                    />
                    {formData.actions?.increaseQuantity?.videoId && videos.find(v => v.id === parseInt(formData.actions.increaseQuantity.videoId)) && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.increaseQuantity.videoId)).title}
                        </div>
                        <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.increaseQuantity.videoId)).description || '설명 없음'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '14px' }}>선택된 영상 없음</span>
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowIncreaseQuantityVideoSelector(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {currentIncreaseQuantityVideoUrl ? '변경' : '선택'}
                  </button>
                  {currentIncreaseQuantityVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedActions = { ...(formData.actions || {}), increaseQuantity: null };
                        const updated = { ...menu, actions: updatedActions };
                        setFormData({ ...formData, actions: updatedActions });
                        onUpdate(updated);
                        setCurrentIncreaseQuantityVideoUrl(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {/* 수량 감소 영상 */}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontWeight: '500' }}>수량 감소</td>
              <td style={{ padding: '12px' }}>
                {currentDecreaseQuantityVideoUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <video
                      src={currentDecreaseQuantityVideoUrl}
                      preload="metadata"
                      muted
                      style={{
                        width: '120px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#000',
                        flexShrink: 0
                      }}
                    />
                    {formData.actions?.decreaseQuantity?.videoId && videos.find(v => v.id === parseInt(formData.actions.decreaseQuantity.videoId)) && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.decreaseQuantity.videoId)).title}
                        </div>
                        <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.decreaseQuantity.videoId)).description || '설명 없음'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '14px' }}>선택된 영상 없음</span>
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowDecreaseQuantityVideoSelector(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {currentDecreaseQuantityVideoUrl ? '변경' : '선택'}
                  </button>
                  {currentDecreaseQuantityVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedActions = { ...(formData.actions || {}), decreaseQuantity: null };
                        const updated = { ...menu, actions: updatedActions };
                        setFormData({ ...formData, actions: updatedActions });
                        onUpdate(updated);
                        setCurrentDecreaseQuantityVideoUrl(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              </td>
            </tr>

            {/* 취소 영상 */}
            <tr>
              <td style={{ padding: '12px', fontWeight: '500' }}>취소</td>
              <td style={{ padding: '12px' }}>
                {currentCancelItemVideoUrl ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <video
                      src={currentCancelItemVideoUrl}
                      preload="metadata"
                      muted
                      style={{
                        width: '120px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#000',
                        flexShrink: 0
                      }}
                    />
                    {formData.actions?.cancelItem?.videoId && videos.find(v => v.id === parseInt(formData.actions.cancelItem.videoId)) && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.cancelItem.videoId)).title}
                        </div>
                        <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videos.find(v => v.id === parseInt(formData.actions.cancelItem.videoId)).description || '설명 없음'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '14px' }}>선택된 영상 없음</span>
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowCancelItemVideoSelector(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {currentCancelItemVideoUrl ? '변경' : '선택'}
                  </button>
                  {currentCancelItemVideoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedActions = { ...(formData.actions || {}), cancelItem: null };
                        const updated = { ...menu, actions: updatedActions };
                        setFormData({ ...formData, actions: updatedActions });
                        onUpdate(updated);
                        setCurrentCancelItemVideoUrl(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      제거
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Video Selector Modal */}
        {showVideoSelector && (
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
                  메뉴 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowVideoSelector(false); setCurrentPage(1); }}
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
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    {/* Video List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.videoUrl !== video.presignedUrl) {
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
                            {indexOfFirstVideo + index + 1}
                          </div>

                          {/* Video Thumbnail */}
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />

                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>

                          {/* Selected Indicator */}
                          {formData.videoUrl === video.presignedUrl && (
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
                      전체 {videos.length}개 영상 {totalPages > 1 && `(${currentPage} / ${totalPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add to Cart Video Selector Modal */}
        {showAddToCartVideoSelector && (
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
            zIndex: 1001
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
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  장바구니 추가 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowAddToCartVideoSelector(false); setCurrentAddToCartPage(1); }}
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
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentAddToCartVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectAddToCartVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.actions?.addToCart?.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.actions?.addToCart?.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.actions?.addToCart?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.actions?.addToCart?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          <div style={{ width: '25px', textAlign: 'center', fontWeight: '600', color: '#718096', fontSize: '13px', flexShrink: 0 }}>
                            {indexOfFirstAddToCartVideo + index + 1}
                          </div>
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />
                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>
                          {formData.actions?.addToCart?.videoUrl === video.presignedUrl && (
                            <div style={{ padding: '4px 10px', backgroundColor: '#667eea', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                              선택됨
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalAddToCartPages > 1 && (
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleAddToCartPageChange(currentAddToCartPage - 1)}
                          disabled={currentAddToCartPage === 1}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentAddToCartPage === 1 ? '#f7fafc' : 'white', color: currentAddToCartPage === 1 ? '#a0aec0' : '#2d3748', cursor: currentAddToCartPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          이전
                        </button>
                        {Array.from({ length: totalAddToCartPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleAddToCartPageChange(pageNum)}
                            style={{ padding: '8px 12px', border: pageNum === currentAddToCartPage ? '2px solid #667eea' : '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: pageNum === currentAddToCartPage ? '#667eea' : 'white', color: pageNum === currentAddToCartPage ? 'white' : '#2d3748', cursor: 'pointer', fontSize: '14px', fontWeight: pageNum === currentAddToCartPage ? '600' : '500', minWidth: '40px' }}
                          >
                            {pageNum}
                          </button>
                        ))}
                        <button
                          onClick={() => handleAddToCartPageChange(currentAddToCartPage + 1)}
                          disabled={currentAddToCartPage === totalAddToCartPages}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentAddToCartPage === totalAddToCartPages ? '#f7fafc' : 'white', color: currentAddToCartPage === totalAddToCartPages ? '#a0aec0' : '#2d3748', cursor: currentAddToCartPage === totalAddToCartPages ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          다음
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
                      전체 {videos.length}개 영상 {totalAddToCartPages > 1 && `(${currentAddToCartPage} / ${totalAddToCartPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Checkout Video Selector Modal */}
        {showCheckoutVideoSelector && (
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
            zIndex: 1001
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
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  결제 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowCheckoutVideoSelector(false); setCurrentCheckoutPage(1); }}
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
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentCheckoutVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectCheckoutVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.actions?.checkout?.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.actions?.checkout?.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.actions?.checkout?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.actions?.checkout?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          <div style={{ width: '25px', textAlign: 'center', fontWeight: '600', color: '#718096', fontSize: '13px', flexShrink: 0 }}>
                            {indexOfFirstCheckoutVideo + index + 1}
                          </div>
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />
                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>
                          {formData.actions?.checkout?.videoUrl === video.presignedUrl && (
                            <div style={{ padding: '4px 10px', backgroundColor: '#667eea', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                              선택됨
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalCheckoutPages > 1 && (
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleCheckoutPageChange(currentCheckoutPage - 1)}
                          disabled={currentCheckoutPage === 1}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentCheckoutPage === 1 ? '#f7fafc' : 'white', color: currentCheckoutPage === 1 ? '#a0aec0' : '#2d3748', cursor: currentCheckoutPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          이전
                        </button>
                        {Array.from({ length: totalCheckoutPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleCheckoutPageChange(pageNum)}
                            style={{ padding: '8px 12px', border: pageNum === currentCheckoutPage ? '2px solid #667eea' : '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: pageNum === currentCheckoutPage ? '#667eea' : 'white', color: pageNum === currentCheckoutPage ? 'white' : '#2d3748', cursor: 'pointer', fontSize: '14px', fontWeight: pageNum === currentCheckoutPage ? '600' : '500', minWidth: '40px' }}
                          >
                            {pageNum}
                          </button>
                        ))}
                        <button
                          onClick={() => handleCheckoutPageChange(currentCheckoutPage + 1)}
                          disabled={currentCheckoutPage === totalCheckoutPages}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentCheckoutPage === totalCheckoutPages ? '#f7fafc' : 'white', color: currentCheckoutPage === totalCheckoutPages ? '#a0aec0' : '#2d3748', cursor: currentCheckoutPage === totalCheckoutPages ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          다음
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
                      전체 {videos.length}개 영상 {totalCheckoutPages > 1 && `(${currentCheckoutPage} / ${totalCheckoutPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Increase Quantity Video Selector Modal */}
        {showIncreaseQuantityVideoSelector && (
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
            zIndex: 1001
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
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  수량 증가 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowIncreaseQuantityVideoSelector(false); setCurrentIncreaseQuantityPage(1); }}
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
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentIncreaseQuantityVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectIncreaseQuantityVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.actions?.increaseQuantity?.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.actions?.increaseQuantity?.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.actions?.increaseQuantity?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.actions?.increaseQuantity?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          <div style={{ width: '25px', textAlign: 'center', fontWeight: '600', color: '#718096', fontSize: '13px', flexShrink: 0 }}>
                            {indexOfFirstIncreaseQuantityVideo + index + 1}
                          </div>
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />
                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>
                          {formData.actions?.increaseQuantity?.videoUrl === video.presignedUrl && (
                            <div style={{ padding: '4px 10px', backgroundColor: '#667eea', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                              선택됨
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalIncreaseQuantityPages > 1 && (
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleIncreaseQuantityPageChange(currentIncreaseQuantityPage - 1)}
                          disabled={currentIncreaseQuantityPage === 1}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentIncreaseQuantityPage === 1 ? '#f7fafc' : 'white', color: currentIncreaseQuantityPage === 1 ? '#a0aec0' : '#2d3748', cursor: currentIncreaseQuantityPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          이전
                        </button>
                        {Array.from({ length: totalIncreaseQuantityPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleIncreaseQuantityPageChange(pageNum)}
                            style={{ padding: '8px 12px', border: pageNum === currentIncreaseQuantityPage ? '2px solid #667eea' : '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: pageNum === currentIncreaseQuantityPage ? '#667eea' : 'white', color: pageNum === currentIncreaseQuantityPage ? 'white' : '#2d3748', cursor: 'pointer', fontSize: '14px', fontWeight: pageNum === currentIncreaseQuantityPage ? '600' : '500', minWidth: '40px' }}
                          >
                            {pageNum}
                          </button>
                        ))}
                        <button
                          onClick={() => handleIncreaseQuantityPageChange(currentIncreaseQuantityPage + 1)}
                          disabled={currentIncreaseQuantityPage === totalIncreaseQuantityPages}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentIncreaseQuantityPage === totalIncreaseQuantityPages ? '#f7fafc' : 'white', color: currentIncreaseQuantityPage === totalIncreaseQuantityPages ? '#a0aec0' : '#2d3748', cursor: currentIncreaseQuantityPage === totalIncreaseQuantityPages ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          다음
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
                      전체 {videos.length}개 영상 {totalIncreaseQuantityPages > 1 && `(${currentIncreaseQuantityPage} / ${totalIncreaseQuantityPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Decrease Quantity Video Selector Modal */}
        {showDecreaseQuantityVideoSelector && (
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
            zIndex: 1001
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
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  수량 감소 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowDecreaseQuantityVideoSelector(false); setCurrentDecreaseQuantityPage(1); }}
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
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentDecreaseQuantityVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectDecreaseQuantityVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.actions?.decreaseQuantity?.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.actions?.decreaseQuantity?.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.actions?.decreaseQuantity?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.actions?.decreaseQuantity?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          <div style={{ width: '25px', textAlign: 'center', fontWeight: '600', color: '#718096', fontSize: '13px', flexShrink: 0 }}>
                            {indexOfFirstDecreaseQuantityVideo + index + 1}
                          </div>
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />
                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>
                          {formData.actions?.decreaseQuantity?.videoUrl === video.presignedUrl && (
                            <div style={{ padding: '4px 10px', backgroundColor: '#667eea', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                              선택됨
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalDecreaseQuantityPages > 1 && (
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleDecreaseQuantityPageChange(currentDecreaseQuantityPage - 1)}
                          disabled={currentDecreaseQuantityPage === 1}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentDecreaseQuantityPage === 1 ? '#f7fafc' : 'white', color: currentDecreaseQuantityPage === 1 ? '#a0aec0' : '#2d3748', cursor: currentDecreaseQuantityPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          이전
                        </button>
                        {Array.from({ length: totalDecreaseQuantityPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleDecreaseQuantityPageChange(pageNum)}
                            style={{ padding: '8px 12px', border: pageNum === currentDecreaseQuantityPage ? '2px solid #667eea' : '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: pageNum === currentDecreaseQuantityPage ? '#667eea' : 'white', color: pageNum === currentDecreaseQuantityPage ? 'white' : '#2d3748', cursor: 'pointer', fontSize: '14px', fontWeight: pageNum === currentDecreaseQuantityPage ? '600' : '500', minWidth: '40px' }}
                          >
                            {pageNum}
                          </button>
                        ))}
                        <button
                          onClick={() => handleDecreaseQuantityPageChange(currentDecreaseQuantityPage + 1)}
                          disabled={currentDecreaseQuantityPage === totalDecreaseQuantityPages}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentDecreaseQuantityPage === totalDecreaseQuantityPages ? '#f7fafc' : 'white', color: currentDecreaseQuantityPage === totalDecreaseQuantityPages ? '#a0aec0' : '#2d3748', cursor: currentDecreaseQuantityPage === totalDecreaseQuantityPages ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          다음
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
                      전체 {videos.length}개 영상 {totalDecreaseQuantityPages > 1 && `(${currentDecreaseQuantityPage} / ${totalDecreaseQuantityPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cancel Item Video Selector Modal */}
        {showCancelItemVideoSelector && (
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
            zIndex: 1001
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
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  취소 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowCancelItemVideoSelector(false); setCurrentCancelItemPage(1); }}
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
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentCancelItemVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectCancelItemVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.actions?.cancelItem?.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.actions?.cancelItem?.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.actions?.cancelItem?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.actions?.cancelItem?.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          <div style={{ width: '25px', textAlign: 'center', fontWeight: '600', color: '#718096', fontSize: '13px', flexShrink: 0 }}>
                            {indexOfFirstCancelItemVideo + index + 1}
                          </div>
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />
                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>
                          {formData.actions?.cancelItem?.videoUrl === video.presignedUrl && (
                            <div style={{ padding: '4px 10px', backgroundColor: '#667eea', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                              선택됨
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalCancelItemPages > 1 && (
                      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleCancelItemPageChange(currentCancelItemPage - 1)}
                          disabled={currentCancelItemPage === 1}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentCancelItemPage === 1 ? '#f7fafc' : 'white', color: currentCancelItemPage === 1 ? '#a0aec0' : '#2d3748', cursor: currentCancelItemPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          이전
                        </button>
                        {Array.from({ length: totalCancelItemPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleCancelItemPageChange(pageNum)}
                            style={{ padding: '8px 12px', border: pageNum === currentCancelItemPage ? '2px solid #667eea' : '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: pageNum === currentCancelItemPage ? '#667eea' : 'white', color: pageNum === currentCancelItemPage ? 'white' : '#2d3748', cursor: 'pointer', fontSize: '14px', fontWeight: pageNum === currentCancelItemPage ? '600' : '500', minWidth: '40px' }}
                          >
                            {pageNum}
                          </button>
                        ))}
                        <button
                          onClick={() => handleCancelItemPageChange(currentCancelItemPage + 1)}
                          disabled={currentCancelItemPage === totalCancelItemPages}
                          style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: '6px', backgroundColor: currentCancelItemPage === totalCancelItemPages ? '#f7fafc' : 'white', color: currentCancelItemPage === totalCancelItemPages ? '#a0aec0' : '#2d3748', cursor: currentCancelItemPage === totalCancelItemPages ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          다음
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#718096' }}>
                      전체 {videos.length}개 영상 {totalCancelItemPages > 1 && `(${currentCancelItemPage} / ${totalCancelItemPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryEditor({ category, onUpdate }) {
  const [formData, setFormData] = useState(category);
  const [videos, setVideos] = useState([]);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [currentVideoPage, setCurrentVideoPage] = useState(1);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(category.videoUrl);
  const videosPerPage = 10;

  // Update formData when category prop changes
  useEffect(() => {
    setFormData(category);
  }, [category]);

  // Load fresh presigned URL for current video if videoId exists
  useEffect(() => {
    const loadVideoUrl = async () => {
      if (formData.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentVideoUrl(presignedUrl);
          console.log(`[CATEGORY VIDEO] Loaded fresh presigned URL for videoId ${formData.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for videoId ${formData.videoId}:`, error);
          setCurrentVideoUrl(null);
        }
      } else {
        setCurrentVideoUrl(formData.videoUrl);
      }
    };

    loadVideoUrl();
  }, [formData.videoId]);

  // Load videos from S3
  useEffect(() => {
    if (showVideoSelector && videos.length === 0) {
      loadVideos();
    }
  }, [showVideoSelector]);

  const loadVideos = async () => {
    try {
      setLoadingVideos(true);
      const videoList = await videoService.getAllVideos('KIOSK');

      const videosWithPresignedUrls = await Promise.all(
        videoList.map(async (video) => {
          try {
            const presignedData = await videoService.getPresignedUrl(video.id, 60);
            return {
              ...video,
              presignedUrl: presignedData.url || presignedData.presignedUrl || presignedData
            };
          } catch (error) {
            console.error(`Failed to get presigned URL for video ${video.id}:`, error);
            return {
              ...video,
              presignedUrl: null
            };
          }
        })
      );

      const validVideos = videosWithPresignedUrls.filter(v => v.presignedUrl);
      setVideos(validVideos);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleSelectVideo = (video) => {
    const updated = {
      ...formData,
      videoUrl: video.presignedUrl,
      videoId: String(video.id),
      videoFilename: video.originalFilename
    };
    setFormData(updated);
    onUpdate(updated);
    setShowVideoSelector(false);
    setCurrentVideoPage(1);
  };

  // Pagination logic for videos
  const totalVideoPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastVideo = currentVideoPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = videos.slice(indexOfFirstVideo, indexOfLastVideo);

  const handleVideoPageChange = (pageNumber) => {
    setCurrentVideoPage(pageNumber);
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

      <div className="form-group">
        <label>카테고리 영상</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: 'column' }}>
          {currentVideoUrl && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
              <video
                src={currentVideoUrl}
                preload="metadata"
                muted
                style={{
                  width: '120px',
                  height: '72px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '2px solid #e2e8f0',
                  backgroundColor: '#000',
                  flexShrink: 0
                }}
              />
              {formData.videoId && videos.find(v => v.id === parseInt(formData.videoId)) && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                    {videos.find(v => v.id === parseInt(formData.videoId)).title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {videos.find(v => v.id === parseInt(formData.videoId)).description || '설명 없음'}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowVideoSelector(true)}
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
              {currentVideoUrl ? '영상 변경' : '영상 선택'}
            </button>
            {currentVideoUrl && (
              <button
                type="button"
                onClick={() => {
                  const updated = { ...formData, videoUrl: null, videoId: null, videoFilename: null };
                  setFormData(updated);
                  onUpdate(updated);
                  setCurrentVideoUrl(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                영상 제거
              </button>
            )}
          </div>
        </div>

        {/* Video Selector Modal */}
        {showVideoSelector && (
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
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#2d3748' }}>
                  카테고리 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowVideoSelector(false); setCurrentVideoPage(1); }}
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

              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px'
              }}>
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }
                          }}
                        >
                          <div style={{
                            width: '25px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#718096',
                            fontSize: '13px',
                            flexShrink: 0
                          }}>
                            {indexOfFirstVideo + index + 1}
                          </div>

                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />

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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>

                          {formData.videoUrl === video.presignedUrl && (
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

                    {totalVideoPages > 1 && (
                      <div style={{
                        marginTop: '24px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => handleVideoPageChange(currentVideoPage - 1)}
                          disabled={currentVideoPage === 1}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '6px',
                            backgroundColor: currentVideoPage === 1 ? '#f7fafc' : 'white',
                            color: currentVideoPage === 1 ? '#a0aec0' : '#2d3748',
                            cursor: currentVideoPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          이전
                        </button>

                        {Array.from({ length: totalVideoPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleVideoPageChange(pageNum)}
                            style={{
                              padding: '8px 12px',
                              border: pageNum === currentVideoPage ? '2px solid #667eea' : '1px solid #cbd5e0',
                              borderRadius: '6px',
                              backgroundColor: pageNum === currentVideoPage ? '#667eea' : 'white',
                              color: pageNum === currentVideoPage ? 'white' : '#2d3748',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: pageNum === currentVideoPage ? '600' : '500',
                              minWidth: '40px'
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}

                        <button
                          onClick={() => handleVideoPageChange(currentVideoPage + 1)}
                          disabled={currentVideoPage === totalVideoPages}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '6px',
                            backgroundColor: currentVideoPage === totalVideoPages ? '#f7fafc' : 'white',
                            color: currentVideoPage === totalVideoPages ? '#a0aec0' : '#2d3748',
                            cursor: currentVideoPage === totalVideoPages ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          다음
                        </button>
                      </div>
                    )}

                    <div style={{
                      marginTop: '16px',
                      textAlign: 'center',
                      fontSize: '13px',
                      color: '#718096'
                    }}>
                      전체 {videos.length}개 영상 {totalVideoPages > 1 && `(${currentVideoPage} / ${totalVideoPages} 페이지)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
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

  // Video selection states
  const [videos, setVideos] = useState([]);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [currentVideoPage, setCurrentVideoPage] = useState(1);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(item.videoUrl);
  const videosPerPage = 10;

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

  // Load fresh presigned URL for current video if videoId exists
  useEffect(() => {
    const loadVideoUrl = async () => {
      if (formData.videoId) {
        try {
          const presignedData = await videoService.getPresignedUrl(formData.videoId, 60);
          const presignedUrl = presignedData.url || presignedData.presignedUrl || presignedData;
          setCurrentVideoUrl(presignedUrl);
          console.log(`[MENU VIDEO] Loaded fresh presigned URL for videoId ${formData.videoId}`);
        } catch (error) {
          console.error(`Failed to get presigned URL for videoId ${formData.videoId}:`, error);
          setCurrentVideoUrl(null);
        }
      } else {
        setCurrentVideoUrl(formData.videoUrl);
      }
    };

    loadVideoUrl();
  }, [formData.videoId]);

  // Load menu images from S3
  useEffect(() => {
    if (showImageSelector && menuImages.length === 0) {
      loadMenuImages();
    }
  }, [showImageSelector]);

  // Load videos from S3
  useEffect(() => {
    if (showVideoSelector && videos.length === 0) {
      loadVideos();
    }
  }, [showVideoSelector]);

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

  const loadVideos = async () => {
    try {
      setLoadingVideos(true);
      const videoList = await videoService.getAllVideos('KIOSK');

      // Generate presigned URLs for each video
      const videosWithPresignedUrls = await Promise.all(
        videoList.map(async (video) => {
          try {
            const presignedData = await videoService.getPresignedUrl(video.id, 60);
            return {
              ...video,
              presignedUrl: presignedData.url || presignedData.presignedUrl || presignedData
            };
          } catch (error) {
            console.error(`Failed to get presigned URL for video ${video.id}:`, error);
            return {
              ...video,
              presignedUrl: null
            };
          }
        })
      );

      const validVideos = videosWithPresignedUrls.filter(v => v.presignedUrl);
      setVideos(validVideos);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleSelectImage = (image) => {
    // Use presigned URL for display (S3 is private) and store imageId + originalFilename for kiosk download
    const updated = {
      ...formData,
      thumbnailUrl: image.presignedUrl,
      imageId: String(image.id), // Store image ID for kiosk to download later
      imageFilename: image.originalFilename // Store original filename (without UUID) for offline kiosk usage
    };
    setFormData(updated);
    onUpdate(updated);
    setShowImageSelector(false);
    setCurrentPage(1);
  };

  const handleSelectVideo = (video) => {
    const updated = {
      ...formData,
      videoUrl: video.presignedUrl,
      videoId: String(video.id),
      videoFilename: video.originalFilename
    };
    setFormData(updated);
    onUpdate(updated);
    setShowVideoSelector(false);
    setCurrentVideoPage(1);
  };

  // Pagination logic for images
  const totalPages = Math.ceil(menuImages.length / imagesPerPage);
  const indexOfLastImage = currentPage * imagesPerPage;
  const indexOfFirstImage = indexOfLastImage - imagesPerPage;
  const currentImages = menuImages.slice(indexOfFirstImage, indexOfLastImage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Pagination logic for videos
  const totalVideoPages = Math.ceil(videos.length / videosPerPage);
  const indexOfLastVideo = currentVideoPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = videos.slice(indexOfFirstVideo, indexOfLastVideo);

  const handleVideoPageChange = (pageNumber) => {
    setCurrentVideoPage(pageNumber);
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: 'column', width: '100%' }}>
          {currentImageUrl && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
              <img
                src={currentImageUrl}
                alt="선택된 이미지"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '2px solid #e2e8f0',
                  flexShrink: 0
                }}
              />
              {formData.imageId && images.find(img => img.id === parseInt(formData.imageId)) && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                    {images.find(img => img.id === parseInt(formData.imageId)).title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {images.find(img => img.id === parseInt(formData.imageId)).description || '설명 없음'}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
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

      <div className="form-group">
        <label>메뉴 아이템 영상</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: 'column' }}>
          {currentVideoUrl && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
              <video
                src={currentVideoUrl}
                preload="metadata"
                muted
                style={{
                  width: '120px',
                  height: '72px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '2px solid #e2e8f0',
                  backgroundColor: '#000',
                  flexShrink: 0
                }}
              />
              {formData.videoId && videos.find(v => v.id === parseInt(formData.videoId)) && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                    {videos.find(v => v.id === parseInt(formData.videoId)).title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {videos.find(v => v.id === parseInt(formData.videoId)).description || '설명 없음'}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowVideoSelector(true)}
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
              {currentVideoUrl ? '영상 변경' : '영상 선택'}
            </button>
            {currentVideoUrl && (
              <button
                type="button"
                onClick={() => {
                  const updated = { ...formData, videoUrl: null, videoId: null, videoFilename: null };
                  setFormData(updated);
                  onUpdate(updated);
                  setCurrentVideoUrl(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                영상 제거
              </button>
            )}
          </div>
        </div>

        {/* Video Selector Modal */}
        {showVideoSelector && (
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
                  메뉴 아이템 영상 선택
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowVideoSelector(false); setCurrentVideoPage(1); }}
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
                {loadingVideos ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    영상 목록을 불러오는 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                    등록된 영상이 없습니다.<br />
                    영상 관리 페이지에서 영상을 업로드하세요.
                  </div>
                ) : (
                  <>
                    {/* Video List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentVideos.map((video, index) => (
                        <div
                          key={video.id}
                          onClick={() => handleSelectVideo(video)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px',
                            border: formData.videoUrl === video.presignedUrl ? '2px solid #667eea' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: formData.videoUrl === video.presignedUrl ? '#eef2ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onMouseEnter={(e) => {
                            if (formData.videoUrl !== video.presignedUrl) {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                              e.currentTarget.style.borderColor = '#a0aec0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (formData.videoUrl !== video.presignedUrl) {
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
                            {indexOfFirstVideo + index + 1}
                          </div>

                          {/* Video Thumbnail */}
                          <video
                            src={video.presignedUrl}
                            preload="metadata"
                            muted
                            style={{
                              width: '80px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#000',
                              flexShrink: 0
                            }}
                          />

                          {/* Video Info */}
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
                                {video.title}
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
                                {video.description || '설명 없음'}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#a0aec0',
                              flexShrink: 0,
                              width: '90px',
                              textAlign: 'right'
                            }}>
                              {new Date(video.uploadedAt).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </div>
                          </div>

                          {/* Selected Indicator */}
                          {formData.videoUrl === video.presignedUrl && (
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
                    {totalVideoPages > 1 && (
                      <div style={{
                        marginTop: '24px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => handleVideoPageChange(currentVideoPage - 1)}
                          disabled={currentVideoPage === 1}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '6px',
                            backgroundColor: currentVideoPage === 1 ? '#f7fafc' : 'white',
                            color: currentVideoPage === 1 ? '#a0aec0' : '#2d3748',
                            cursor: currentVideoPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          이전
                        </button>

                        {Array.from({ length: totalVideoPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => handleVideoPageChange(pageNum)}
                            style={{
                              padding: '8px 12px',
                              border: pageNum === currentVideoPage ? '2px solid #667eea' : '1px solid #cbd5e0',
                              borderRadius: '6px',
                              backgroundColor: pageNum === currentVideoPage ? '#667eea' : 'white',
                              color: pageNum === currentVideoPage ? 'white' : '#2d3748',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: pageNum === currentVideoPage ? '600' : '500',
                              minWidth: '40px'
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}

                        <button
                          onClick={() => handleVideoPageChange(currentVideoPage + 1)}
                          disabled={currentVideoPage === totalVideoPages}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '6px',
                            backgroundColor: currentVideoPage === totalVideoPages ? '#f7fafc' : 'white',
                            color: currentVideoPage === totalVideoPages ? '#a0aec0' : '#2d3748',
                            cursor: currentVideoPage === totalVideoPages ? 'not-allowed' : 'pointer',
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
                      전체 {videos.length}개 영상 {totalVideoPages > 1 && `(${currentVideoPage} / ${totalVideoPages} 페이지)`}
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
