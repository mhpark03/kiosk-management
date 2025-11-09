import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiEdit, FiCopy, FiTrash2, FiPlus, FiFolder } from 'react-icons/fi';
import menuService from '../services/menuService';
import './MenuList.css';

function MenuList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadMenus();
  }, []);

  // Reload when returning from editor with reload flag
  useEffect(() => {
    if (location.state?.reload) {
      loadMenus();
      // Clear the state to prevent reload on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const s3Menus = await menuService.getMenusFromS3();

      // Filter only XML files (menu configuration files)
      const xmlMenus = s3Menus.filter(s3File =>
        s3File.fileType === 'XML' ||
        s3File.originalFilename?.toLowerCase().endsWith('.xml')
      );

      // Transform S3 response to menu format
      const transformedMenus = xmlMenus.map(s3File => ({
        id: s3File.id.toString(),
        name: s3File.title,
        version: '1.0.0', // Extract from description or default
        lastModified: s3File.uploadedAt,
        s3Key: s3File.s3Key,
        description: s3File.description,
        originalFilename: s3File.originalFilename,
        fileType: s3File.fileType,
        // We'll load full menu data when editing
        categories: [],
        menuItems: [],
        options: { sizes: [], temperatures: [], extras: [] }
      }));

      setMenus(transformedMenus);
      setError('');
    } catch (err) {
      console.error('Failed to load menus:', err);
      setError('메뉴 목록을 불러오는데 실패했습니다.');
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMenu = () => {
    // Generate unique menu name
    let menuNumber = 1;
    let menuName = `새 메뉴 ${menuNumber}`;
    while (menus.some(m => m.name === menuName)) {
      menuNumber++;
      menuName = `새 메뉴 ${menuNumber}`;
    }

    const newMenu = {
      id: 'new',
      name: menuName,
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
    navigate(`/menus/edit/new`, { state: { newMenu } });
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
          menu.id = 'new';
          navigate(`/menus/edit/new`, { state: { newMenu: menu } });
        } catch (error) {
          alert('XML 파일을 불러오는데 실패했습니다: ' + error.message);
        }
      }
    };
    input.click();
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

  const handleCopyMenu = async (menu) => {
    try {
      // Load full menu data from S3
      const fullMenuData = await menuService.getMenuById(menu.id);

      // Generate unique copy name
      let copyNumber = 1;
      let copyName = `${menu.name} (복사본 ${copyNumber})`;
      while (menus.some(m => m.name === copyName)) {
        copyNumber++;
        copyName = `${menu.name} (복사본 ${copyNumber})`;
      }

      // Parse XML content to get menu structure
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(fullMenuData.content, 'text/xml');
      const copiedMenu = parseXMLToMenu(xmlDoc);
      copiedMenu.id = 'new';
      copiedMenu.name = copyName;

      navigate(`/menus/edit/new`, { state: { newMenu: copiedMenu } });
    } catch (error) {
      console.error('Failed to copy menu:', error);
      alert('메뉴 복사에 실패했습니다: ' + error.message);
    }
  };

  const handleDeleteMenu = async (menuId) => {
    if (window.confirm('이 메뉴를 삭제하시겠습니까?\n삭제된 메뉴는 복구할 수 없습니다.')) {
      try {
        await menuService.deleteMenu(menuId);
        alert('메뉴가 삭제되었습니다.');
        loadMenus(); // Reload menu list
      } catch (error) {
        console.error('Failed to delete menu:', error);
        alert('메뉴 삭제에 실패했습니다: ' + error.message);
      }
    }
  };

  const handleEditMenu = (menuId) => {
    navigate(`/menus/edit/${menuId}`);
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

  if (loading) {
    return (
      <div className="store-management">
        <div className="store-header">
          <h1>메뉴 관리</h1>
        </div>
        <div className="loading" style={{textAlign: 'center', padding: '40px'}}>
          메뉴 목록을 불러오는 중...
        </div>
      </div>
    );
  }

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

      {error && (
        <div className="alert alert-error" style={{margin: '20px 0'}}>
          {error}
        </div>
      )}

      <div className="store-table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th style={{width: '80px', textAlign: 'center'}}>순서</th>
              <th style={{width: '200px'}}>메뉴 이름</th>
              <th>설명</th>
              <th style={{width: '200px'}}>수정일</th>
              <th style={{width: '150px', textAlign: 'center'}}>작업</th>
            </tr>
          </thead>
          <tbody>
            {currentMenus.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-data">
                  S3에 저장된 메뉴가 없습니다.<br />
                  "새 메뉴" 버튼을 눌러 메뉴를 생성하고 S3에 저장하세요.
                </td>
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
                  <td style={{fontSize: '13px', color: '#666'}}>
                    {menu.description || '-'}
                  </td>
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
