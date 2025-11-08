import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import menuService from '../services/menuService';
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
        } else {
          alert('메뉴 데이터를 찾을 수 없습니다.');
          navigate('/menus');
        }
      } else {
        // Load existing menu from S3
        const menuData = await menuService.getMenuById(id);

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
        <div style={{ flex: 1, marginLeft: '20px', marginRight: '20px' }}>
          <input
            type="text"
            value={menu.name}
            onChange={(e) => updateMenu({ ...menu, name: e.target.value })}
            placeholder="메뉴 제목을 입력하세요"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '20px',
              fontWeight: 'bold',
              border: '2px solid #e2e8f0',
              borderRadius: '6px',
              marginBottom: '8px'
            }}
          />
          <textarea
            value={menu.description || ''}
            onChange={(e) => updateMenu({ ...menu, description: e.target.value })}
            placeholder="메뉴 설명을 입력하세요 (선택사항)"
            rows={2}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              resize: 'vertical'
            }}
          />
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

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
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
        <label>이미지 URL</label>
        <input
          type="text"
          value={formData.thumbnailUrl || ''}
          onChange={(e) => handleChange('thumbnailUrl', e.target.value)}
          placeholder="https://example.com/image.jpg"
        />
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
