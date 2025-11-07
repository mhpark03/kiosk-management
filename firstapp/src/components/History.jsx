import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAllHistory, getHistoryByEntityType, getHistoryByEntityTypeAndEntityId } from '../services/historyService';
import { getAllStores } from '../services/storeService';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import './StoreHistory.css';

function History() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Search input states (temporary)
  const [searchEntityType, setSearchEntityType] = useState('ALL');
  const [searchAction, setSearchAction] = useState('ALL');
  const [searchStore, setSearchStore] = useState('');
  const [searchUserid, setSearchUserid] = useState('');
  const [searchKioskId, setSearchKioskId] = useState('');

  // Applied filter states
  const [filterEntityType, setFilterEntityType] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterStore, setFilterStore] = useState('');
  const [filterUserid, setFilterUserid] = useState('');
  const [filterKioskId, setFilterKioskId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const posid = searchParams.get('posid');

  useEffect(() => {
    loadHistory();
    loadStores();

    // Initialize search fields based on URL parameters
    if (entityType) {
      setSearchEntityType(entityType);
      setFilterEntityType(entityType);
    } else {
      setSearchEntityType('ALL');
      setFilterEntityType('ALL');
    }

    if (posid) {
      setSearchStore(posid);
      setFilterStore(posid);
    } else {
      setSearchStore('');
      setFilterStore('');
    }

    if (entityId) {
      setSearchKioskId(entityId);
      setFilterKioskId(entityId);
    } else {
      setSearchKioskId('');
      setFilterKioskId('');
    }

    // Always reset Action and User filters (not URL-based)
    setSearchAction('ALL');
    setFilterAction('ALL');
    setSearchUserid('');
    setFilterUserid('');
  }, [entityType, entityId, posid]);

  const loadStores = async () => {
    try {
      const data = await getAllStores();
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      let data;

      if (entityType && entityId) {
        // Load history for specific entity (kiosk or store)
        data = await getHistoryByEntityTypeAndEntityId(entityType, entityId);
      } else if (entityType) {
        // Load history for entity type only
        data = await getHistoryByEntityType(entityType);
      } else {
        // Load all history
        data = await getAllHistory();
      }

      // Filter out USER type history (device history only)
      const filteredData = data.filter(item => item.entityType !== 'USER');
      setHistory(filteredData);
      setError('');
    } catch (err) {
      setError('Failed to load history: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // If URL parameters exist, clear them to reload all data
    if (entityType || entityId) {
      navigate('/history', { replace: true });
    }

    // Apply filters
    setFilterEntityType(searchEntityType);
    setFilterAction(searchAction);
    setFilterStore(searchStore);
    setFilterUserid(searchUserid);
    setFilterKioskId(searchKioskId);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleReset = () => {
    // Reset only search input fields (not filters)
    // User must click Search button to apply the reset
    setSearchEntityType('ALL');
    setSearchAction('ALL');
    setSearchStore('');
    setSearchUserid('');
    setSearchKioskId('');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);

    // Convert to KST (Korea Standard Time, UTC+9)
    const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    const hours = String(kstDate.getHours()).padStart(2, '0');
    const minutes = String(kstDate.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const formatUserEmail = (email) => {
    if (!email) return 'N/A';
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return email.substring(0, atIndex);
    }
    return email;
  };

  const getUserDisplayName = (item) => {
    // Use username if available, otherwise fallback to email (without @domain)
    if (item.username) {
      return item.username;
    }
    return formatUserEmail(item.userid);
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'action-create';
      case 'UPDATE':
        return 'action-update';
      case 'DELETE':
        return 'action-delete';
      case 'RESTORE':
        return 'action-restore';
      case 'STATE_CHANGE':
        return 'action-state-change';
      case 'LOGIN':
        return 'action-create';
      case 'LOGOUT':
        return 'action-update';
      case 'PASSWORD_CHANGE':
        return 'action-restore';
      case 'SUSPEND':
        return 'action-delete';
      case 'ACTIVATE':
        return 'action-restore';
      default:
        return '';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE':
        return '생성';
      case 'UPDATE':
        return '수정';
      case 'DELETE':
        return '삭제';
      case 'RESTORE':
        return '복원';
      case 'STATE_CHANGE':
        return '상태 변경';
      case 'LOGIN':
        return '로그인';
      case 'LOGOUT':
        return '로그아웃';
      case 'PASSWORD_CHANGE':
        return '비밀번호 변경';
      case 'SUSPEND':
        return '정지';
      case 'ACTIVATE':
        return '활성화';
      default:
        return action;
    }
  };

  const getEntityTypeLabel = (type) => {
    switch (type) {
      case 'KIOSK':
        return '키오스크';
      case 'STORE':
        return '매장';
      case 'USER':
        return '사용자';
      default:
        return type;
    }
  };

  const getEntityTypeBadgeColor = (type) => {
    switch (type) {
      case 'KIOSK':
        return 'action-create';
      case 'STORE':
        return 'action-update';
      case 'USER':
        return 'action-state-change';
      default:
        return '';
    }
  };

  // Helper function to get store name by posid
  const getStoreName = (posid) => {
    if (!posid) return '-';
    const store = stores.find(s => s.posid === posid);
    return store ? store.posname : posid;
  };

  // Format kiosk ID by removing leading zeros
  const formatKioskId = (kioskid) => {
    if (!kioskid) return '-';
    return kioskid.replace(/^0+/, '') || '0';
  };

  // Get unique users from history - create a map of userid to username
  const userMap = new Map();
  history.forEach(h => {
    if (h.userid && !userMap.has(h.userid)) {
      userMap.set(h.userid, h.username || formatUserEmail(h.userid));
    }
  });
  const uniqueUsers = Array.from(userMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  // Filter history
  const filteredHistory = history.filter((item) => {
    if (filterEntityType !== 'ALL' && item.entityType !== filterEntityType) {
      return false;
    }
    if (filterAction !== 'ALL' && item.action !== filterAction) {
      return false;
    }
    if (filterStore && item.posid !== filterStore) {
      return false;
    }
    if (filterUserid && item.userid !== filterUserid) {
      return false;
    }
    if (filterKioskId) {
      // Remove leading zeros from both values for comparison
      const searchValue = filterKioskId.replace(/^0+/, '') || '0';
      const entityValue = (item.entityId || '').replace(/^0+/, '') || '0';
      if (entityValue !== searchValue) {
        return false;
      }
    }
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistory = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

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
  }, [filteredHistory.length]);

  return (
    <div className="store-history">
      <div className="history-header">
        <div>
          <h1>이력 조회</h1>
          {posid && <p className="store-filter-info">매장 ID: {posid}</p>}
          {entityType && <p className="store-filter-info">유형: {getEntityTypeLabel(entityType)}</p>}
        </div>
        {(entityType || entityId) && (
          <button
            onClick={() => navigate('/history')}
            className="btn-show-all"
          >
            전체 이력 보기
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="searchEntityType">유형:</label>
          <select
            id="searchEntityType"
            value={searchEntityType}
            onChange={(e) => setSearchEntityType(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">전체</option>
            <option value="KIOSK">키오스크</option>
            <option value="STORE">매장</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="searchAction">작업:</label>
          <select
            id="searchAction"
            value={searchAction}
            onChange={(e) => setSearchAction(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">전체</option>
            <option value="CREATE">생성</option>
            <option value="UPDATE">수정</option>
            <option value="DELETE">삭제</option>
            <option value="RESTORE">복원</option>
            <option value="STATE_CHANGE">상태 변경</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="searchStore">매장:</label>
          <select
            id="searchStore"
            value={searchStore}
            onChange={(e) => setSearchStore(e.target.value)}
            className="filter-select"
          >
            <option value="">전체 매장</option>
            {stores.map((store) => (
              <option key={store.id} value={store.posid}>
                {store.posname}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="searchUserid">사용자:</label>
          <select
            id="searchUserid"
            value={searchUserid}
            onChange={(e) => setSearchUserid(e.target.value)}
            className="filter-select"
          >
            <option value="">전체 사용자</option>
            {uniqueUsers.map(([userid, username]) => (
              <option key={userid} value={userid}>
                {username}
              </option>
            ))}
          </select>
        </div>

        <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
            <label htmlFor="searchKioskId" style={{fontSize: '13px', fontWeight: 600, color: '#4a5568'}}>키오스크 ID:</label>
            <div style={{position: 'relative', width: '160px'}}>
              <input
                type="text"
                id="searchKioskId"
                value={searchKioskId}
                onChange={(e) => setSearchKioskId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="키오스크 ID"
                style={{
                  width: '100%',
                  padding: '8px 35px 8px 12px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              {searchKioskId && (
                <button
                  onClick={() => setSearchKioskId('')}
                  style={{
                    position: 'absolute',
                    right: '5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#999',
                    padding: '0 5px'
                  }}
                  type="button"
                  title="지우기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <button onClick={handleSearch} className="btn-refresh" title="검색" style={{padding: '8px 16px', background: 'none', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666'}}>
          <FiSearch size={16} /> 검색
        </button>
        <button onClick={handleReset} className="btn-refresh" title="초기화" style={{marginLeft: '5px', padding: '8px 16px', background: 'none', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666'}}>
          <FiRefreshCw size={16} /> 초기화
        </button>
      </div>

      {loading ? (
        <div className="loading">이력을 불러오는 중...</div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>유형</th>
                <th>시간</th>
                <th>매장</th>
                <th>키오스크 ID</th>
                <th>작업</th>
                <th>사용자</th>
                <th>필드</th>
                <th>이전 값</th>
                <th>새 값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              {currentHistory.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">이력이 없습니다</td>
                </tr>
              ) : (
                currentHistory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`action-badge ${getEntityTypeBadgeColor(item.entityType)}`}>
                        {getEntityTypeLabel(item.entityType)}
                      </span>
                    </td>
                    <td>{formatDate(item.timestamp)}</td>
                    <td>{getStoreName(item.posid)}</td>
                    <td style={{textAlign: 'center'}}>{item.entityType === 'KIOSK' ? formatKioskId(item.entityId) : '-'}</td>
                    <td>
                      <span className={`action-badge ${getActionColor(item.action)}`}>
                        {getActionLabel(item.action)}
                      </span>
                    </td>
                    <td>{getUserDisplayName(item)}</td>
                    <td>{item.fieldName || '-'}</td>
                    <td className="value-cell" title={item.oldValue || '-'}>{item.oldValue || '-'}</td>
                    <td className="value-cell" title={item.newValue || '-'}>{item.newValue || '-'}</td>
                    <td className="description-cell">{item.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {filteredHistory.length > 10 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          marginTop: '20px',
          padding: '20px'
        }}>
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f7fafc' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              color: currentPage === 1 ? '#a0aec0' : '#2d3748',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            이전
          </button>

          <div style={{ display: 'flex', gap: '5px' }}>
            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: currentPage === pageNumber ? '#4299e1' : 'white',
                    color: currentPage === pageNumber ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: currentPage === pageNumber ? '600' : '500',
                    minWidth: '40px'
                  }}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f7fafc' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              color: currentPage === totalPages ? '#a0aec0' : '#2d3748',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            다음
          </button>
        </div>
      )}

      <div className="history-summary">
        <p>전체 레코드: {filteredHistory.length} / {history.length} | 페이지: {currentPage} / {totalPages}</p>
      </div>
    </div>
  );
}

export default History;
