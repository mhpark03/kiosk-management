import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MenuList.css';

function MenuList() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = () => {
    const savedMenus = localStorage.getItem('coffeeMenus');
    if (savedMenus) {
      setMenus(JSON.parse(savedMenus));
    } else {
      // Create default menu if none exists
      const defaultMenu = {
        id: Date.now().toString(),
        name: '기본 메뉴',
        version: '1.0.0',
        lastModified: new Date().toISOString(),
        categories: [
          { id: 'coffee', name: '커피', nameEn: 'Coffee', icon: 'coffee', order: 1 },
          { id: 'beverage', name: '음료', nameEn: 'Beverage', icon: 'local_drink', order: 2 },
          { id: 'dessert', name: '디저트', nameEn: 'Dessert', icon: 'cake', order: 3 },
        ],
        menuItems: [],
        options: {
          sizes: [
            { id: 'small', name: 'Small', nameKo: '스몰', additionalPrice: 0 },
            { id: 'medium', name: 'Medium (R)', nameKo: '미디움', additionalPrice: 500 },
            { id: 'large', name: 'Large', nameKo: '라지', additionalPrice: 1000 },
          ],
          temperatures: [
            { id: 'hot', name: 'Hot', nameKo: '따뜻하게' },
            { id: 'iced', name: 'Iced', nameKo: '차갑게' },
          ],
          extras: [
            { id: 'shot', name: '샷 추가', nameEn: 'Extra Shot', additionalPrice: 500 },
            { id: 'syrup', name: '시럽 추가', nameEn: 'Syrup', additionalPrice: 500 },
            { id: 'whipped', name: '휘핑크림', nameEn: 'Whipped Cream', additionalPrice: 500 },
          ],
        },
      };
      const initialMenus = [defaultMenu];
      localStorage.setItem('coffeeMenus', JSON.stringify(initialMenus));
      setMenus(initialMenus);
    }
  };

  const saveMenus = (updatedMenus) => {
    localStorage.setItem('coffeeMenus', JSON.stringify(updatedMenus));
    setMenus(updatedMenus);
  };

  const handleNewMenu = () => {
    const newMenu = {
      id: Date.now().toString(),
      name: `새 메뉴 ${menus.length + 1}`,
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      categories: [
        { id: 'coffee', name: '커피', nameEn: 'Coffee', icon: 'coffee', order: 1 },
        { id: 'beverage', name: '음료', nameEn: 'Beverage', icon: 'local_drink', order: 2 },
        { id: 'dessert', name: '디저트', nameEn: 'Dessert', icon: 'cake', order: 3 },
      ],
      menuItems: [],
      options: {
        sizes: [
          { id: 'small', name: 'Small', nameKo: '스몰', additionalPrice: 0 },
          { id: 'medium', name: 'Medium (R)', nameKo: '미디움', additionalPrice: 500 },
          { id: 'large', name: 'Large', nameKo: '라지', additionalPrice: 1000 },
        ],
        temperatures: [
          { id: 'hot', name: 'Hot', nameKo: '따뜻하게' },
          { id: 'iced', name: 'Iced', nameKo: '차갑게' },
        ],
        extras: [
          { id: 'shot', name: '샷 추가', nameEn: 'Extra Shot', additionalPrice: 500 },
          { id: 'syrup', name: '시럽 추가', nameEn: 'Syrup', additionalPrice: 500 },
          { id: 'whipped', name: '휘핑크림', nameEn: 'Whipped Cream', additionalPrice: 500 },
        ],
      },
    };
    const updatedMenus = [...menus, newMenu];
    saveMenus(updatedMenus);
    navigate(`/menus/edit/${newMenu.id}`);
  };

  const handleOpenMenu = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const menu = parseXMLToMenu(xmlDoc);
          menu.id = Date.now().toString();
          const updatedMenus = [...menus, menu];
          saveMenus(updatedMenus);
          navigate(`/menus/edit/${menu.id}`);
        } catch (error) {
          alert('XML 파일을 불러오는데 실패했습니다: ' + error.message);
        }
      }
    };
    input.click();
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

  const handleCopyMenu = (menu) => {
    const copiedMenu = {
      ...JSON.parse(JSON.stringify(menu)), // Deep copy
      id: Date.now().toString(),
      name: `${menu.name} (복사본)`,
      lastModified: new Date().toISOString(),
    };
    const updatedMenus = [...menus, copiedMenu];
    saveMenus(updatedMenus);
  };

  const handleDeleteMenu = (menuId) => {
    if (menus.length === 1) {
      alert('마지막 메뉴는 삭제할 수 없습니다.');
      return;
    }
    if (window.confirm('이 메뉴를 삭제하시겠습니까?')) {
      const updatedMenus = menus.filter(m => m.id !== menuId);
      saveMenus(updatedMenus);
    }
  };

  const handleEditMenu = (menuId) => {
    navigate(`/menus/edit/${menuId}`);
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="menu-list-container">
      <div className="menu-list-header">
        <h1>메뉴 관리</h1>
        <div className="menu-list-actions">
          <button className="btn btn-primary" onClick={handleNewMenu}>
            <span className="icon">➕</span> 새 메뉴
          </button>
          <button className="btn btn-secondary" onClick={handleOpenMenu}>
            <span className="icon">📁</span> 메뉴 열기
          </button>
        </div>
      </div>

      <div className="menu-list-grid">
        {menus.map(menu => (
          <div key={menu.id} className="menu-card" onClick={() => handleEditMenu(menu.id)}>
            <div className="menu-card-header">
              <h3>{menu.name}</h3>
              <div className="menu-card-actions">
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyMenu(menu);
                  }}
                  title="복사"
                >
                  📋
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMenu(menu.id);
                  }}
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div className="menu-card-body">
              <div className="menu-card-stat">
                <span className="label">버전:</span>
                <span className="value">{menu.version}</span>
              </div>
              <div className="menu-card-stat">
                <span className="label">카테고리:</span>
                <span className="value">{menu.categories.length}개</span>
              </div>
              <div className="menu-card-stat">
                <span className="label">메뉴 아이템:</span>
                <span className="value">{menu.menuItems.length}개</span>
              </div>
              <div className="menu-card-stat">
                <span className="label">수정일:</span>
                <span className="value">{formatDate(menu.lastModified)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MenuList;
