import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHistoryByUser } from '../services/historyService';
import { getAllStores } from '../services/storeService';
import { getAllUsers } from '../services/userService';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import './StoreHistory.css';

function UserHistory() {
  const { user } = useAuth();
  const location = useLocation();
  const [history, setHistory] = useState([]);
  const [stores, setStores] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter states (user input)
  const [filterEntityType, setFilterEntityType] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterStore, setFilterStore] = useState('');
  const [filterKioskId, setFilterKioskId] = useState('');

  // Applied filter states (actually used for filtering)
  const [appliedFilterEntityType, setAppliedFilterEntityType] = useState('ALL');
  const [appliedFilterAction, setAppliedFilterAction] = useState('ALL');
  const [appliedFilterStore, setAppliedFilterStore] = useState('');
  const [appliedFilterKioskId, setAppliedFilterKioskId] = useState('');

  // Get target user from location state (passed from UserManagement page)
  const targetUserFromState = location.state?.targetUser;
  // For admin with target user from state, use selected user email from dropdown, otherwise use logged-in user's email
  const isAdmin = user?.role === 'ADMIN';
  const targetEmail = (targetUserFromState && isAdmin && selectedUserEmail) ? selectedUserEmail : (targetUserFromState?.email || user?.email);

  useEffect(() => {
    loadStores();
    if (isAdmin && targetUserFromState) {
      loadAllUsers();
    }
  }, []);

  useEffect(() => {
    if (targetEmail) {
      loadUserHistory();
    }
  }, [targetEmail]);

  const loadStores = async () => {
    try {
      const data = await getAllStores();
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await getAllUsers();
      setAllUsers(users);
      // Set targetUser's email as default selection if it exists
      if (targetUserFromState?.email && !selectedUserEmail) {
        setSelectedUserEmail(targetUserFromState.email);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleUserChange = (email) => {
    setSelectedUserEmail(email);
  };

  const loadUserHistory = async () => {
    try {
      setLoading(true);
      const data = await getHistoryByUser(targetEmail);
      setHistory(data);
      setError('');
    } catch (err) {
      setError('사용자 이력을 불러오는데 실패했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setAppliedFilterEntityType(filterEntityType);
    setAppliedFilterAction(filterAction);
    setAppliedFilterStore(filterStore);
    setAppliedFilterKioskId(filterKioskId);
  };

  const handleReset = () => {
    setFilterEntityType('ALL');
    setFilterAction('ALL');
    setFilterStore('');
    setFilterKioskId('');
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
      case 'VIDEO_UPLOAD':
        return 'action-create';
      case 'VIDEO_PLAY':
        return 'action-update';
      case 'VIDEO_DOWNLOAD':
        return 'action-state-change';
      case 'VIDEO_DELETE':
        return 'action-delete';
      default:
        return '';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE':
        return '생성됨';
      case 'UPDATE':
        return '수정됨';
      case 'DELETE':
        return '삭제됨';
      case 'RESTORE':
        return '복원됨';
      case 'STATE_CHANGE':
        return '수정됨';
      case 'LOGIN':
        return '로그인';
      case 'LOGOUT':
        return '로그아웃';
      case 'PASSWORD_CHANGE':
        return '비밀번호 변경';
      case 'SUSPEND':
        return '정지됨';
      case 'ACTIVATE':
        return '활성화됨';
      case 'VIDEO_UPLOAD':
        return '영상 업로드';
      case 'VIDEO_PLAY':
        return '영상 재생';
      case 'VIDEO_DOWNLOAD':
        return '영상 다운로드';
      case 'VIDEO_DELETE':
        return '영상 삭제';
      default:
        return action;
    }
  };

  // Helper function to check if item is a batch job
  const isBatchJob = (item) => {
    return item.entityId === 'BATCH_JOB';
  };

  const getEntityTypeLabel = (item) => {
    if (isBatchJob(item)) {
      return '배치';
    }

    switch (item.entityType) {
      case 'KIOSK':
        return '키오스크';
      case 'STORE':
        return '매장';
      case 'USER':
        return '사용자';
      case 'VIDEO':
        return '영상';
      default:
        return item.entityType;
    }
  };

  const getEntityTypeBadgeColor = (item) => {
    if (isBatchJob(item)) {
      return 'action-restore'; // Purple for batch jobs
    }

    switch (item.entityType) {
      case 'KIOSK':
        return 'action-create';
      case 'STORE':
        return 'action-update';
      case 'USER':
        return 'action-state-change';
      case 'VIDEO':
        return 'action-delete'; // Red for video
      default:
        return '';
    }
  };

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

  // Filter history using applied filters
  const filteredHistory = history.filter((item) => {
    if (appliedFilterEntityType !== 'ALL') {
      if (appliedFilterEntityType === 'BATCH') {
        // For BATCH filter, match items where entityId is BATCH_JOB
        if (!isBatchJob(item)) {
          return false;
        }
      } else if (item.entityType !== appliedFilterEntityType) {
        return false;
      }
    }
    if (appliedFilterAction !== 'ALL' && item.action !== appliedFilterAction) {
      return false;
    }
    if (appliedFilterStore && item.posid !== appliedFilterStore) {
      return false;
    }
    if (appliedFilterKioskId) {
      const searchValue = appliedFilterKioskId.replace(/^0+/, '') || '0';
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
          <h1>{targetUserFromState ? '사용자 활동 이력' : '내 활동 이력'}</h1>
          {isAdmin && targetUserFromState ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <label htmlFor="userSelect" style={{ fontSize: '14px', fontWeight: 600, color: '#4a5568' }}>
                사용자:
              </label>
              <select
                id="userSelect"
                value={selectedUserEmail}
                onChange={(e) => handleUserChange(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minWidth: '300px'
                }}
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.displayName || u.email} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="store-filter-info">
              사용자: {targetUserFromState ? `${targetUserFromState.displayName || targetUserFromState.email} (${targetUserFromState.email})` : `${user?.displayName || user?.email} (${user?.email})`}
            </p>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="filterEntityType">엔티티 유형:</label>
          <select
            id="filterEntityType"
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">모든 유형</option>
            <option value="KIOSK">키오스크</option>
            <option value="STORE">매장</option>
            <option value="USER">사용자</option>
            <option value="VIDEO">영상</option>
            <option value="BATCH">배치</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filterAction">작업:</label>
          <select
            id="filterAction"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">모든 작업</option>
            <option value="CREATE">생성</option>
            <option value="UPDATE">수정</option>
            <option value="DELETE">삭제</option>
            <option value="RESTORE">복원</option>
            <option value="STATE_CHANGE">상태 변경</option>
            <option value="LOGIN">로그인</option>
            <option value="LOGOUT">로그아웃</option>
            <option value="PASSWORD_CHANGE">비밀번호 변경</option>
            <option value="SUSPEND">정지</option>
            <option value="ACTIVATE">활성화</option>
            <option value="VIDEO_UPLOAD">영상 업로드</option>
            <option value="VIDEO_PLAY">영상 재생</option>
            <option value="VIDEO_DOWNLOAD">영상 다운로드</option>
            <option value="VIDEO_DELETE">영상 삭제</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filterStore">매장:</label>
          <select
            id="filterStore"
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="filter-select"
          >
            <option value="">모든 매장</option>
            {stores.map((store) => (
              <option key={store.id} value={store.posid}>
                {store.posname}
              </option>
            ))}
          </select>
        </div>

        <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
            <label htmlFor="filterKioskId" style={{fontSize: '13px', fontWeight: 600, color: '#4a5568'}}>키오스크 ID:</label>
            <div style={{position: 'relative', width: '160px'}}>
              <input
                type="text"
                id="filterKioskId"
                value={filterKioskId}
                onChange={(e) => setFilterKioskId(e.target.value)}
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
              {filterKioskId && (
                <button
                  onClick={() => setFilterKioskId('')}
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
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <button onClick={handleSearch} className="btn-refresh" title="검색" style={{marginLeft: '5px', padding: '8px 16px', background: 'none', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666'}}>
          <FiSearch size={16} /> 검색
        </button>

        <button onClick={handleReset} className="btn-refresh" title="초기화" style={{marginLeft: '5px', padding: '8px 16px', background: 'none', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666'}}>
          <FiRefreshCw size={16} /> 초기화
        </button>
      </div>

      {loading ? (
        <div className="loading">이력 로딩 중...</div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>유형</th>
                <th>시각</th>
                <th>매장</th>
                <th>키오스크 ID</th>
                <th>작업</th>
                <th>필드</th>
                <th>이전 값</th>
                <th>새 값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">이력을 찾을 수 없습니다</td>
                </tr>
              ) : (
                currentHistory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`action-badge ${getEntityTypeBadgeColor(item)}`}>
                        {getEntityTypeLabel(item)}
                      </span>
                    </td>
                    <td>{formatDate(item.timestamp)}</td>
                    <td>{getStoreName(item.posid)}</td>
                    <td style={{textAlign: 'center'}}>
                      {item.entityType === 'KIOSK' ? formatKioskId(item.entityId) :
                       item.entityType === 'VIDEO' ? item.entityId : '-'}
                    </td>
                    <td>
                      <span className={`action-badge ${getActionColor(item.action)}`}>
                        {getActionLabel(item.action)}
                      </span>
                    </td>
                    <td>{item.fieldName || '-'}</td>
                    <td className="value-cell">{item.oldValue || '-'}</td>
                    <td className="value-cell">{item.newValue || '-'}</td>
                    <td className="description-cell">{item.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filteredHistory.length > 0 && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          marginTop: '20px',
          marginBottom: '10px'
        }}>
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f7fafc' : '#fff',
              color: currentPage === 1 ? '#a0aec0' : '#2d3748',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
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
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px',
                  background: currentPage === pageNum ? '#667eea' : '#fff',
                  color: currentPage === pageNum ? '#fff' : '#2d3748',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '40px'
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
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f7fafc' : '#fff',
              color: currentPage === totalPages ? '#a0aec0' : '#2d3748',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            다음
          </button>
        </div>
      )}

      <div className="history-summary">
        <p>전체 기록: {filteredHistory.length} / {history.length} {filteredHistory.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}</p>
      </div>
    </div>
  );
}

export default UserHistory;
