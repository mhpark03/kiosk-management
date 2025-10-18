import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getAllStores,
  createStore,
  updateStore,
  updateStoreState,
  softDeleteStore,
  restoreStore,
  deleteStore
} from '../services/storeService';
import { useAuth } from '../context/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { FiEdit, FiTrash2, FiX, FiRotateCcw, FiClock } from 'react-icons/fi';
import './StoreManagement.css';

function StoreManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterRegion, setFilterRegion] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    posid: '',
    posname: '',
    zonecode: '',
    posaddress: '',
    posaddress_detail: '',
    state: 'active',
    regdate: '',
    enddate: ''
  });

  // Load stores on component mount
  useEffect(() => {
    loadStores();
  }, [showDeleted]);

  // Capture filter from navigation state
  useEffect(() => {
    if (location.state?.filterRegion) {
      setFilterRegion(location.state.filterRegion);
    }
  }, [location]);

  // Extract region from address
  const extractRegion = (address) => {
    if (!address) return '주소 미상';

    const regions = [
      '서울특별시', '서울시', '서울',
      '부산광역시', '부산시', '부산',
      '대구광역시', '대구시', '대구',
      '인천광역시', '인천시', '인천',
      '광주광역시', '광주시', '광주',
      '대전광역시', '대전시', '대전',
      '울산광역시', '울산시', '울산',
      '세종특별자치시', '세종시', '세종',
      '경기도', '경기',
      '강원특별자치도', '강원도', '강원',
      '충청북도', '충북',
      '충청남도', '충남',
      '전북특별자치도', '전라북도', '전북',
      '전라남도', '전남',
      '경상북도', '경북',
      '경상남도', '경남',
      '제주특별자치도', '제주도', '제주'
    ];

    const normalizeRegion = (region) => {
      if (region.includes('서울')) return '서울특별시';
      if (region.includes('부산')) return '부산광역시';
      if (region.includes('대구')) return '대구광역시';
      if (region.includes('인천')) return '인천광역시';
      if (region.includes('광주')) return '광주광역시';
      if (region.includes('대전')) return '대전광역시';
      if (region.includes('울산')) return '울산광역시';
      if (region.includes('세종')) return '세종특별자치시';
      if (region.includes('경기')) return '경기도';
      if (region.includes('강원')) return '강원특별자치도';
      if (region.includes('충청북') || region.includes('충북')) return '충청북도';
      if (region.includes('충청남') || region.includes('충남')) return '충청남도';
      if (region.includes('전북') || region.includes('전라북')) return '전북특별자치도';
      if (region.includes('전남') || region.includes('전라남')) return '전라남도';
      if (region.includes('경상북') || region.includes('경북')) return '경상북도';
      if (region.includes('경상남') || region.includes('경남')) return '경상남도';
      if (region.includes('제주')) return '제주특별자치도';
      return region;
    };

    for (const region of regions) {
      if (address.startsWith(region)) {
        return normalizeRegion(region);
      }
    }

    return '기타';
  };

  // Apply filter when stores or filterRegion changes
  useEffect(() => {
    if (!filterRegion) {
      setFilteredStores(stores);
    } else {
      const filtered = stores.filter(store => {
        const region = extractRegion(store.baseaddress);
        return region === filterRegion;
      });
      setFilteredStores(filtered);
    }
  }, [stores, filterRegion]);

  const loadStores = async () => {
    try {
      setLoading(true);
      const data = await getAllStores(showDeleted);
      // Sort by ID in descending order (newest first)
      const sortedData = [...data].sort((a, b) => b.id - a.id);
      setStores(sortedData);
      setError('');
    } catch (err) {
      console.error('Failed to load stores:', err.message);
      setError(''); // Don't show error on screen
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        // 주소 변수
        let addr = ''; // 주소 변수

        // 사용자가 선택한 주소 타입에 따라 해당 주소 값을 가져온다.
        if (data.userSelectedType === 'R') { // 도로명 주소
          addr = data.roadAddress;
        } else { // 지번 주소
          addr = data.jibunAddress;
        }

        // 우편번호와 주소 정보를 폼에 넣는다.
        setFormData(prev => ({
          ...prev,
          zonecode: data.zonecode,
          posaddress: addr
        }));
      }
    }).open();
  };

  const handleAddStore = async (e) => {
    e.preventDefault();
    try {
      // 전체 주소 조합 (우편번호 + 기본주소 + 상세주소)
      const fullAddress = `(${formData.zonecode}) ${formData.posaddress} ${formData.posaddress_detail}`.trim();

      const storeData = {
        posname: formData.posname,
        zonecode: formData.zonecode,
        baseaddress: formData.posaddress,
        detailaddress: formData.posaddress_detail,
        posaddress: fullAddress, // Full address for display
        state: formData.state,
        userid: user?.email || '',
        regdate: formData.regdate,
        enddate: dateLocalToTimestamp(formData.enddate)
      };

      await createStore(storeData);

      console.log('=== Store Created Successfully ===');
      console.log('Store name:', formData.posname);
      console.log('Address:', fullAddress);
      console.log('State:', formData.state);
      console.log('==================================');
      setShowAddModal(false);
      setFormData({ posid: '', posname: '', zonecode: '', posaddress: '', posaddress_detail: '', state: 'active', regdate: '', enddate: '' });
      loadStores();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create store: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEditStore = async (e) => {
    e.preventDefault();
    try {
      // 전체 주소 조합 (우편번호 + 기본주소 + 상세주소)
      const fullAddress = `(${formData.zonecode}) ${formData.posaddress} ${formData.posaddress_detail}`.trim();

      const updateData = {
        posname: formData.posname,
        zonecode: formData.zonecode,
        baseaddress: formData.posaddress,
        detailaddress: formData.posaddress_detail,
        posaddress: fullAddress, // Full address for display
        state: formData.state,
        regdate: formData.regdate,
        enddate: dateLocalToTimestamp(formData.enddate)
      };

      await updateStore(selectedStore.id, updateData);

      console.log('=== Store Updated Successfully ===');
      console.log('Store ID:', selectedStore.posid);
      console.log('Store name:', formData.posname);
      console.log('Address:', fullAddress);
      console.log('State:', formData.state);
      console.log('==================================');
      setShowEditModal(false);
      setSelectedStore(null);
      setFormData({ posid: '', posname: '', zonecode: '', posaddress: '', posaddress_detail: '', state: 'inactive', regdate: '', enddate: '' });
      loadStores();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update store: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (window.confirm('Are you sure you want to deactivate this store?')) {
      try {
        await softDeleteStore(storeId);

        console.log('=== Store Deactivated Successfully ===');
        console.log('Store ID:', storeId);
        console.log('======================================');
        loadStores();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to deactivate store: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleRestoreStore = async (storeId) => {
    try {
      await restoreStore(storeId);

      console.log('=== Store Restored Successfully ===');
      console.log('Store ID:', storeId);
      console.log('===================================');
      loadStores();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to restore store: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handlePermanentDelete = async (storeId) => {
    if (window.confirm('Are you sure you want to permanently delete this store? This action cannot be undone!')) {
      try {
        await deleteStore(storeId);

        console.log('=== Store Permanently Deleted ===');
        console.log('Store ID:', storeId);
        console.log('=================================');
        loadStores();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to delete store: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleStateChange = async (storeId, newState) => {
    try {
      await updateStoreState(storeId, newState);

      console.log('=== Store State Updated Successfully ===');
      console.log('Store ID:', storeId);
      console.log('New state:', newState);
      console.log('========================================');
      loadStores();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update store state: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleViewHistory = (storeId, posid) => {
    navigate(`/history?entityType=STORE&entityId=${storeId}&posid=${posid}`);
  };

  const openEditModal = (store) => {
    setSelectedStore(store);

    // Load address fields directly from store data
    // For backward compatibility, parse posaddress if separate fields don't exist
    let zonecode = store.zonecode || '';
    let baseAddress = store.baseaddress || '';
    let detailAddress = store.detailaddress || '';

    // Backward compatibility: if separate fields don't exist, try to parse posaddress
    if (!zonecode && !baseAddress && store.posaddress) {
      const zoneMatch = store.posaddress.match(/^\((\d+)\)\s*/);
      if (zoneMatch) {
        zonecode = zoneMatch[1];
        const remaining = store.posaddress.substring(zoneMatch[0].length);
        baseAddress = remaining;
      } else {
        baseAddress = store.posaddress;
      }
    }

    setFormData({
      posid: store.posid,
      posname: store.posname,
      zonecode: zonecode,
      posaddress: baseAddress,
      posaddress_detail: detailAddress,
      state: store.state,
      regdate: timestampToDateLocal(store.regdate),
      enddate: timestampToDateLocal(store.enddate)
    });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedStore(null);
    setFormData({ posid: '', posname: '', zonecode: '', posaddress: '', posaddress_detail: '', state: 'active', regdate: '', enddate: '' });
  };

  const formatDate = (timestamp, includeTime = false) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (includeTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    }
    return `${month}/${day}`;
  };

  const formatUserEmail = (email) => {
    if (!email) return 'N/A';
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return email.substring(0, atIndex);
    }
    return email;
  };

  // Convert Timestamp to date input format (YYYY-MM-DD)
  const timestampToDateLocal = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert date string to Timestamp (time set to midnight)
  const dateLocalToTimestamp = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    return Timestamp.fromDate(date);
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'active':
        return 'state-active';
      case 'inactive':
        return 'state-inactive';
      case 'deleted':
        return 'state-deleted';
      default:
        return '';
    }
  };

  // Remove leading zeros from POS ID for display
  const formatPosId = (posid) => {
    if (!posid) return 'N/A';
    return posid.replace(/^0+/, '') || '0';
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredStores.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStores = filteredStores.slice(indexOfFirstItem, indexOfLastItem);

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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredStores.length]);

  const openAddModal = () => {
    // Set regdate to current date when opening add modal
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;

    setFormData(prev => ({
      ...prev,
      regdate: currentDate
    }));
    setShowAddModal(true);
  };

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>매장 관리</h1>
        <div className="header-actions">
          <label className="toggle-deleted">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            삭제된 항목 표시
          </label>
          <button onClick={openAddModal} className="btn-add">
            + 매장 추가
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">매장 로딩 중...</div>
      ) : (
        <div className="store-table-container">
          <table className="store-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>매장명</th>
                <th>주소</th>
                <th>등록일</th>
                <th>종료일</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {currentStores.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">매장이 없습니다</td>
                </tr>
              ) : (
                currentStores.map((store) => (
                  <tr key={store.id}>
                    <td
                      style={{textAlign: 'center', cursor: 'pointer', color: '#667eea', fontWeight: '600'}}
                      onClick={() => openEditModal(store)}
                      className="clickable-posid"
                      title="클릭하여 편집"
                    >
                      {formatPosId(store.posid)}
                    </td>
                    <td>{store.posname}</td>
                    <td>{store.posaddress}</td>
                    <td>{formatDate(store.regdate)}</td>
                    <td>{formatDate(store.enddate)}</td>
                    <td>
                      <span className={`state-badge ${getStateColor(store.state)}`}>
                        {store.state === 'active' ? '활성' :
                         store.state === 'inactive' ? '비활성' :
                         store.state === 'deleted' ? '삭제됨' : store.state}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {store.state !== 'deleted' ? (
                          <>
                            <button
                              onClick={() => openEditModal(store)}
                              className="btn-edit"
                              title="Edit"
                            >
                              <FiEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteStore(store.id)}
                              className="btn-deactivate"
                              title="Deactivate"
                            >
                              <FiX />
                            </button>
                            <button
                              onClick={() => handleViewHistory(store.id, store.posid)}
                              className="btn-history"
                              title="View History"
                            >
                              <FiClock />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRestoreStore(store.id)}
                              className="btn-restore"
                              title="Restore"
                            >
                              <FiRotateCcw />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(store.id)}
                              className="btn-permanent-delete"
                              title="Permanently Delete"
                            >
                              <FiTrash2 />
                            </button>
                            <button
                              onClick={() => handleViewHistory(store.id, store.posid)}
                              className="btn-history"
                              title="View History"
                            >
                              <FiClock />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filteredStores.length > 0 && totalPages > 1 && (
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
        전체 {filteredStores.length}개 매장 {filteredStores.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>

      {/* Add Store Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>새 매장 추가</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleAddStore} className="modal-form">
              <div className="form-group">
                <label htmlFor="posname">매장명</label>
                <input
                  type="text"
                  id="posname"
                  name="posname"
                  value={formData.posname}
                  onChange={handleInputChange}
                  required
                  placeholder="매장명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="zonecode">우편번호</label>
                <div className="address-search-group">
                  <input
                    type="text"
                    id="zonecode"
                    name="zonecode"
                    value={formData.zonecode}
                    readOnly
                    placeholder="우편번호"
                    className="zonecode-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="btn-address-search"
                  >
                    주소 검색
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="posaddress">주소</label>
                <input
                  type="text"
                  id="posaddress"
                  name="posaddress"
                  value={formData.posaddress}
                  readOnly
                  required
                  placeholder="기본 주소"
                />
              </div>
              <div className="form-group">
                <label htmlFor="posaddress_detail">상세 주소</label>
                <input
                  type="text"
                  id="posaddress_detail"
                  name="posaddress_detail"
                  value={formData.posaddress_detail}
                  onChange={handleInputChange}
                  placeholder="상세 주소 입력"
                />
              </div>
              <div className="form-group">
                <label htmlFor="state">상태</label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="regdate">등록일</label>
                <input
                  type="date"
                  id="regdate"
                  name="regdate"
                  value={formData.regdate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  기본값은 오늘 날짜입니다
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  취소
                </button>
                <button type="submit" className="btn-submit">
                  매장 추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Store Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>매장 편집</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleEditStore} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-posid">ID</label>
                <input
                  type="text"
                  id="edit-posid"
                  name="posid"
                  value={formData.posid}
                  readOnly
                  className="readonly-field"
                  style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-posname">매장명</label>
                <input
                  type="text"
                  id="edit-posname"
                  name="posname"
                  value={formData.posname}
                  onChange={handleInputChange}
                  required
                  placeholder="매장명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-zonecode">우편번호</label>
                <div className="address-search-group">
                  <input
                    type="text"
                    id="edit-zonecode"
                    name="zonecode"
                    value={formData.zonecode}
                    readOnly
                    placeholder="우편번호"
                    className="zonecode-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    className="btn-address-search"
                  >
                    주소 검색
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="edit-posaddress">주소</label>
                <input
                  type="text"
                  id="edit-posaddress"
                  name="posaddress"
                  value={formData.posaddress}
                  readOnly
                  required
                  placeholder="기본 주소"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-posaddress_detail">상세 주소</label>
                <input
                  type="text"
                  id="edit-posaddress_detail"
                  name="posaddress_detail"
                  value={formData.posaddress_detail}
                  onChange={handleInputChange}
                  placeholder="상세 주소 입력"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-state">상태</label>
                <select
                  id="edit-state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-regdate">등록일</label>
                <input
                  type="date"
                  id="edit-regdate"
                  name="regdate"
                  value={formData.regdate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  매장이 처음 등록된 날짜입니다
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-enddate">종료일</label>
                <input
                  type="date"
                  id="edit-enddate"
                  name="enddate"
                  value={formData.enddate}
                  onChange={handleInputChange}
                  min={formData.regdate || undefined}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  {formData.regdate
                    ? `등록일(${formData.regdate}) 이후(포함) 날짜만 선택 가능합니다`
                    : '아직 활성 상태라면 비워두세요'}
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  취소
                </button>
                <button type="submit" className="btn-submit">
                  매장 수정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoreManagement;
