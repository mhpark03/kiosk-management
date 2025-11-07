import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MenuEditor.css';

function MenuEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'category' | 'item'
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadMenu();
  }, [id]);

  const loadMenu = () => {
    const savedMenus = localStorage.getItem('coffeeMenus');
    if (savedMenus) {
      const menus = JSON.parse(savedMenus);
      const foundMenu = menus.find(m => m.id === id);
      if (foundMenu) {
        setMenu(foundMenu);
      } else {
        alert('메뉴를 찾을 수 없습니다.');
        navigate('/menus');
      }
    }
  };

  const saveMenu = (updatedMenu) => {
    const savedMenus = localStorage.getItem('coffeeMenus');
    if (savedMenus) {
      const menus = JSON.parse(savedMenus);
      const index = menus.findIndex(m => m.id === id);
      if (index >= 0) {
        menus[index] = { ...updatedMenu, lastModified: new Date().toISOString() };
        localStorage.setItem('coffeeMenus', JSON.stringify(menus));
        setMenu(updatedMenu);
      }
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
      saveMenu(updatedMenu);
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
      saveMenu(updatedMenu);
    }
  };

  const deleteItem = (itemId) => {
    if (window.confirm('이 메뉴 아이템을 삭제하시겠습니까?')) {
      const updatedMenu = {
        ...menu,
        menuItems: menu.menuItems.filter(i => i.id !== itemId),
      };
      saveMenu(updatedMenu);
    }
  };

  if (!menu) {
    return <div className="menu-editor-container"><p>로딩중...</p></div>;
  }

  return (
    <div className="menu-editor-container">
      <div className="menu-editor-header">
        <h1>{menu.name} 편집</h1>
        <div className="menu-editor-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/menus')}>
            ← 목록으로
          </button>
          <button className="btn btn-primary" onClick={exportXML}>
            💾 XML 저장
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
                saveMenu(updatedMenu);
              }}
            />
          ) : (
            <div className="menu-detail-empty">
              <p>왼쪽에서 메뉴 아이템을 선택하세요</p>
            </div>
          )}
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
