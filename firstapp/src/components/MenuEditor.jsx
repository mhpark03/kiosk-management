import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import menuService from '../services/menuService';
import './MenuEditor.css';

function MenuEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null); // 'category' | 'item'
  const [selectedId, setSelectedId] = useState(null);

  // S3 Save Modal states
  const [showS3Modal, setShowS3Modal] = useState(false);
  const [s3Title, setS3Title] = useState('');
  const [s3Description, setS3Description] = useState('');
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
          setMenu(location.state.newMenu);
        } else {
          alert('메뉴 데이터를 찾을 수 없습니다.');
          navigate('/menus');
        }
      } else {
        // Load existing menu from S3
        const menuData = await menuService.getMenuById(id);

        // Parse XML content
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(menuData.content, 'text/xml');
        const parsedMenu = parseXMLToMenu(xmlDoc);
        parsedMenu.id = id;
        parsedMenu.s3Key = menuData.s3Key;
        parsedMenu.description = menuData.description; // Store description from S3 metadata

        setMenu(parsedMenu);
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
    const metadata = xmlDoc.querySelector('metadata');
    const name = metadata?.querySelector('name')?.textContent || '불러온 메뉴';
    const version = metadata?.querySelector('version')?.textContent || '1.0.0';

    const categories = Array.from(xmlDoc.querySelectorAll('category')).map(cat => ({
      id: cat.getAttribute('id'),
      name: cat.getAttribute('name'),
      nameEn: cat.getAttribute('nameEn'),
      icon: cat.getAttribute('icon'),
      order: parseInt(cat.getAttribute('order') || '0'),
    }));

    const menuItems = Array.from(xmlDoc.querySelectorAll('menuItems item')).map(item => ({
      id: item.getAttribute('id'),
      category: item.getAttribute('category'),
      order: parseInt(item.getAttribute('order') || '0'),
      name: item.querySelector('name')?.textContent || '',
      nameEn: item.querySelector('nameEn')?.textContent || '',
      price: parseInt(item.querySelector('price')?.textContent || '0'),
      description: item.querySelector('description')?.textContent || '',
      thumbnailUrl: item.querySelector('thumbnailUrl')?.textContent || null,
      available: item.querySelector('available')?.textContent === 'true',
      sizeEnabled: item.querySelector('sizeEnabled')?.textContent === 'true',
      temperatureEnabled: item.querySelector('temperatureEnabled')?.textContent === 'true',
      extrasEnabled: item.querySelector('extrasEnabled')?.textContent === 'true',
    }));

    const sizes = Array.from(xmlDoc.querySelectorAll('sizes size')).map(size => ({
      id: size.getAttribute('id'),
      name: size.getAttribute('name'),
      nameKo: size.getAttribute('nameKo'),
      additionalPrice: parseInt(size.getAttribute('additionalPrice') || '0'),
    }));

    const temperatures = Array.from(xmlDoc.querySelectorAll('temperatures temperature')).map(temp => ({
      id: temp.getAttribute('id'),
      name: temp.getAttribute('name'),
      nameKo: temp.getAttribute('nameKo'),
    }));

    const extras = Array.from(xmlDoc.querySelectorAll('extras extra')).map(extra => ({
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

  const updateMenu = (updatedMenu) => {
    setMenu(updatedMenu);
  };

  const handleBackToList = () => {
    navigate('/menus');
  };

  const handleS3SaveClick = () => {
    if (!menu) return;

    // For existing menus, pre-fill title and description
    if (id !== 'new') {
      setS3Title(menu.name);
      setS3Description(menu.description || `${menu.name} 메뉴 설정 (버전: ${menu.version})`);
    } else {
      setS3Title(menu.name);
      setS3Description(`${menu.name} 메뉴 설정 (버전: ${menu.version})`);
    }

    setSaveError('');
    setSaveSuccess('');
    setShowS3Modal(true);
  };

  const handleS3SaveConfirm = async () => {
    if (!menu) return;

    if (!s3Title.trim()) {
      setSaveError('제목을 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError('');

      const xml = generateXML(menu);

      if (id === 'new') {
        // New menu - upload
        await menuService.uploadMenuXML(xml, s3Title, s3Description);
        setSaveSuccess('S3에 성공적으로 저장되었습니다!');
      } else {
        // Existing menu - update (delete and re-upload)
        await menuService.updateMenu(id, xml, s3Title, s3Description);
        setSaveSuccess('메뉴가 성공적으로 업데이트되었습니다!');
      }

      setTimeout(() => {
        setShowS3Modal(false);
        setSaveSuccess('');
        navigate('/menus'); // Return to menu list
      }, 2000);
    } catch (error) {
      setSaveError(error.message || 'S3 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleS3ModalClose = () => {
    if (isSaving) return;
    setShowS3Modal(false);
    setSaveError('');
    setSaveSuccess('');
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

  const generateXML = (menu) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<kioskMenu>\n';

    // Metadata
    xml += '  <metadata>\n';
    xml += `    <name>${menu.name}</name>\n`;
    xml += `    <version>${menu.version}</version>\n`;
    xml += `    <lastModified>${menu.lastModified}</lastModified>\n`;
    xml += '  </metadata>\n\n';

    // Categories
    xml += '  <categories>\n';
    menu.categories.forEach(cat => {
      xml += `    <category id="${cat.id}" name="${cat.name}" nameEn="${cat.nameEn}" icon="${cat.icon}" order="${cat.order}" />\n`;
    });
    xml += '  </categories>\n\n';

    // Menu Items
    xml += '  <menuItems>\n';
    menu.menuItems.forEach(item => {
      xml += `    <item id="${item.id}" category="${item.category}" order="${item.order}">\n`;
      xml += `      <name>${item.name}</name>\n`;
      xml += `      <nameEn>${item.nameEn}</nameEn>\n`;
      xml += `      <price>${item.price}</price>\n`;
      xml += `      <description>${item.description}</description>\n`;
      if (item.thumbnailUrl) {
        xml += `      <thumbnailUrl>${item.thumbnailUrl}</thumbnailUrl>\n`;
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
      xml += `      <size id="${size.id}" name="${size.name}" nameKo="${size.nameKo}" additionalPrice="${size.additionalPrice}" />\n`;
    });
    xml += '    </sizes>\n';
    xml += '    <temperatures>\n';
    menu.options.temperatures.forEach(temp => {
      xml += `      <temperature id="${temp.id}" name="${temp.name}" nameKo="${temp.nameKo}" />\n`;
    });
    xml += '    </temperatures>\n';
    xml += '    <extras>\n';
    menu.options.extras.forEach(extra => {
      xml += `      <extra id="${extra.id}" name="${extra.name}" nameEn="${extra.nameEn}" additionalPrice="${extra.additionalPrice}" />\n`;
    });
    xml += '    </extras>\n';
    xml += '  </options>\n';

    xml += '</kioskMenu>';
    return xml;
  };

  const addCategory = () => {
    const name = prompt('카테고리 이름 (한글):');
    const nameEn = prompt('카테고리 이름 (영문):');
    const icon = prompt('아이콘 이름 (예: coffee, cake, local_drink):', 'coffee');

    if (name && nameEn) {
      const newCategory = {
        id: name.toLowerCase().replace(/ /g, '_'),
        name,
        nameEn,
        icon,
        order: menu.categories.length + 1,
      };
      const updatedMenu = {
        ...menu,
        categories: [...menu.categories, newCategory],
      };
      updateMenu(updatedMenu);
    }
  };

  const addItem = (categoryId) => {
    const name = prompt('메뉴 이름 (한글):');
    const nameEn = prompt('메뉴 이름 (영문):');
    const price = prompt('가격 (원):', '4000');

    if (name && nameEn && price) {
      const newItem = {
        id: `${categoryId}_${Date.now()}`,
        category: categoryId,
        name,
        nameEn,
        price: parseInt(price),
        description: '',
        thumbnailUrl: null,
        available: true,
        sizeEnabled: true,
        temperatureEnabled: true,
        extrasEnabled: true,
        order: menu.menuItems.filter(i => i.category === categoryId).length + 1,
      };
      const updatedMenu = {
        ...menu,
        menuItems: [...menu.menuItems, newItem],
      };
      updateMenu(updatedMenu);
    }
  };

  const deleteItem = (itemId) => {
    if (window.confirm('이 메뉴 아이템을 삭제하시겠습니까?')) {
      const updatedMenu = {
        ...menu,
        menuItems: menu.menuItems.filter(i => i.id !== itemId),
      };
      updateMenu(updatedMenu);
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
        <h1>{menu.name} 편집</h1>
        <div className="menu-editor-actions">
          <button className="btn btn-primary" onClick={handleS3SaveClick}>
            💾 S3 저장
          </button>
        </div>
      </div>

      <div className="menu-editor-content">
        {/* Left: Tree View */}
        <div className="menu-tree">
          <div className="menu-tree-header">
            <h3>구조</h3>
            <button className="btn-small" onClick={addCategory}>+ 카테고리</button>
          </div>

          {menu.categories.map(category => (
            <div key={category.id} className="tree-category">
              <div className="tree-category-header">
                <span className="tree-icon">{getCategoryIcon(category.icon)}</span>
                <span className="tree-label">{category.name}</span>
                <button className="btn-small" onClick={() => addItem(category.id)}>+</button>
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
          {selectedType === 'item' && selectedId ? (
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
              <p>왼쪽에서 메뉴 아이템을 선택하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* S3 Save Modal */}
      {showS3Modal && (
        <div className="video-modal" onClick={handleS3ModalClose}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <button className="modal-close" onClick={handleS3ModalClose}>×</button>
            <h3>S3에 메뉴 저장</h3>

            {saveError && <div className="alert alert-error" style={{marginTop: '15px'}}>{saveError}</div>}
            {saveSuccess && <div className="alert alert-success" style={{marginTop: '15px'}}>{saveSuccess}</div>}

            <div style={{padding: '20px 0'}}>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  제목 <span style={{color: '#f56565'}}>*</span>
                </label>
                <input
                  type="text"
                  value={s3Title}
                  onChange={(e) => setS3Title(e.target.value)}
                  placeholder="메뉴 제목을 입력하세요"
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748'}}>
                  설명
                </label>
                <textarea
                  value={s3Description}
                  onChange={(e) => setS3Description(e.target.value)}
                  rows={4}
                  placeholder="메뉴에 대한 설명을 입력하세요 (선택사항)"
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button
                  onClick={handleS3ModalClose}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#2d3748',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: isSaving ? 0.5 : 1
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleS3SaveConfirm}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '4px',
                    background: isSaving ? '#a0aec0' : '#667eea',
                    color: '#fff',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {isSaving ? '저장 중...' : 'S3에 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
