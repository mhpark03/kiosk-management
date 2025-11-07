import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit, FiCopy, FiTrash2, FiPlus, FiFolder } from 'react-icons/fi';
import './MenuList.css';

function MenuList() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Pagination logic
  const totalPages = Math.ceil(menus.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMenus = menus.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Reset to page 1 when menus changes
  useEffect(() => {
    setCurrentPage(1);
  }, [menus.length]);

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>메뉴 관리</h1>
        <div className="header-actions">
          <button onClick={handleNewMenu} className="btn-add">
            <FiPlus /> 새 메뉴
          </button>
          <button onClick={handleOpenMenu} className="btn-secondary-action">
            <FiFolder /> 메뉴 열기
          </button>
        </div>
      </div>

      <div className="store-table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th style={{width: '80px', textAlign: 'center'}}>순서</th>
              <th>메뉴 이름</th>
              <th style={{width: '120px', textAlign: 'center'}}>버전</th>
              <th style={{width: '120px', textAlign: 'center'}}>카테고리</th>
              <th style={{width: '120px', textAlign: 'center'}}>메뉴 아이템</th>
              <th style={{width: '180px'}}>수정일</th>
              <th style={{width: '150px', textAlign: 'center'}}>작업</th>
            </tr>
          </thead>
          <tbody>
            {currentMenus.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">등록된 메뉴가 없습니다</td>
              </tr>
            ) : (
              currentMenus.map((menu, index) => (
                <tr key={menu.id}>
                  <td style={{textAlign: 'center', fontWeight: '600'}}>
                    {indexOfFirstItem + index + 1}
                  </td>
                  <td>
                    <span style={{fontWeight: '500', color: '#333'}}>{menu.name}</span>
                  </td>
                  <td style={{textAlign: 'center'}}>{menu.version}</td>
                  <td style={{textAlign: 'center'}}>{menu.categories.length}개</td>
                  <td style={{textAlign: 'center'}}>{menu.menuItems.length}개</td>
                  <td>{formatDate(menu.lastModified)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditMenu(menu.id)}
                        className="btn-edit"
                        title="편집"
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleCopyMenu(menu)}
                        className="btn-copy"
                        title="복사"
                      >
                        <FiCopy />
                      </button>
                      <button
                        onClick={() => handleDeleteMenu(menu.id)}
                        className="btn-deactivate"
                        title="삭제"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {menus.length > 0 && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '20px 0',
          gap: '10px'
        }}>
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f7fafc' : '#fff',
              color: currentPage === 1 ? '#a0aec0' : '#2d3748',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            이전
          </button>

          <div style={{display: 'flex', gap: '5px'}}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                style={{
                  padding: '8px 12px',
                  border: pageNum === currentPage ? '2px solid #667eea' : '1px solid #cbd5e0',
                  borderRadius: '4px',
                  background: pageNum === currentPage ? '#667eea' : '#fff',
                  color: pageNum === currentPage ? '#fff' : '#2d3748',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: pageNum === currentPage ? '600' : '500',
                  minWidth: '36px'
                }}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f7fafc' : '#fff',
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

      <div style={{
        textAlign: 'center',
        color: '#718096',
        fontSize: '14px',
        margin: '10px 0 20px'
      }}>
        전체 {menus.length}개 메뉴 {menus.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>
    </div>
  );
}

export default MenuList;
