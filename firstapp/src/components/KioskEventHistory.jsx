import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { getAllKioskEvents } from '../services/kioskEventService';
import { getAllStores } from '../services/storeService';
import { getAllKiosks } from '../services/kioskService';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import './StoreHistory.css';

function KioskEventHistory() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [stores, setStores] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search input states
  const [searchEventType, setSearchEventType] = useState('ALL');
  const [searchStore, setSearchStore] = useState('');
  const [searchKioskId, setSearchKioskId] = useState('');
  const [searchUserEmail, setSearchUserEmail] = useState('');

  // Applied filter states
  const [filterEventType, setFilterEventType] = useState('ALL');
  const [filterStore, setFilterStore] = useState('');
  const [filterKioskId, setFilterKioskId] = useState('');
  const [filterUserEmail, setFilterUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check if user is admin
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, storesData, kiosksData] = await Promise.all([
        getAllKioskEvents(),
        getAllStores(),
        getAllKiosks()
      ]);
      setEvents(eventsData);
      setStores(storesData);
      setKiosks(kiosksData);
      setError('');
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilterEventType(searchEventType);
    setFilterStore(searchStore);
    setFilterKioskId(searchKioskId);
    setFilterUserEmail(searchUserEmail);
    setCurrentPage(1);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleReset = () => {
    setSearchEventType('ALL');
    setSearchStore('');
    setSearchKioskId('');
    setSearchUserEmail('');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);

    // Convert to KST (Korea Standard Time, UTC+9)
    const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    const hours = String(kstDate.getHours()).padStart(2, '0');
    const minutes = String(kstDate.getMinutes()).padStart(2, '0');
    const seconds = String(kstDate.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatUserEmail = (email) => {
    if (!email) return 'N/A';
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return email.substring(0, atIndex);
    }
    return email;
  };

  const getEventTypeLabel = (type) => {
    const labels = {
      // App lifecycle
      'APP_START': '앱 시작',
      'APP_SHUTDOWN': '앱 종료',

      // User authentication
      'USER_LOGIN': '사용자 로그인',
      'USER_LOGOUT': '사용자 로그아웃',

      // Sync events
      'SYNC_STARTED': '동기화 시작',
      'SYNC_COMPLETED': '동기화 완료',
      'SYNC_FAILED': '동기화 실패',
      'AUTO_SYNC_TRIGGERED': '자동 동기화',

      // Download events
      'DOWNLOAD_STARTED': '다운로드 시작',
      'DOWNLOAD_PROGRESS': '다운로드 진행',
      'DOWNLOAD_COMPLETED': '다운로드 완료',
      'DOWNLOAD_FAILED': '다운로드 실패',
      'DOWNLOAD_CANCELLED': '다운로드 취소',

      // Config events
      'CONFIG_SAVED': '설정 저장',
      'CONFIG_DELETED': '설정 삭제',
      'CONFIG_SYNCED_FROM_SERVER': '서버 설정 동기화',
      'CONFIG_UPDATED_BY_WEB': '웹 설정 업데이트',

      // WebSocket events
      'WEBSOCKET_CONNECTED': 'WebSocket 연결',
      'WEBSOCKET_DISCONNECTED': 'WebSocket 연결 해제',

      // File events
      'FILE_DELETED': '파일 삭제',
      'FILE_VERIFIED': '파일 검증',

      // Connection events
      'CONNECTION_TEST': '연결 테스트',
      'CONNECTION_SUCCESS': '연결 성공',
      'CONNECTION_FAILED': '연결 실패',

      // Generic events
      'ERROR': '오류',
      'ERROR_OCCURRED': '오류 발생',
      'NETWORK_ERROR': '네트워크 오류',
      'STORAGE_ERROR': '저장소 오류',
      'WARNING': '경고',
      'INFO': '정보',
      'HEALTH_CHECK': '상태 확인',
      'MANUAL_ACTION': '수동 작업'
    };
    return labels[type] || type;
  };

  const getEventTypeBadgeColor = (type) => {
    // Success/Completion events - green
    if (type?.includes('COMPLETED') || type?.includes('SUCCESS') ||
        type === 'APP_START' || type === 'CONFIG_SAVED' ||
        type === 'USER_LOGIN' || type === 'USER_LOGOUT' ||
        type === 'WEBSOCKET_CONNECTED' || type === 'FILE_VERIFIED') {
      return 'action-create';
    }
    // Error/Failed events - red
    if (type?.includes('FAILED') || type?.includes('ERROR') ||
        type === 'APP_SHUTDOWN' || type === 'WEBSOCKET_DISCONNECTED') {
      return 'action-delete';
    }
    // In-progress events - blue
    if (type?.includes('STARTED') || type?.includes('PROGRESS') ||
        type === 'AUTO_SYNC_TRIGGERED') {
      return 'action-update';
    }
    // Warning/Config events - yellow
    if (type === 'WARNING' || type?.includes('CONFIG_') ||
        type?.includes('CANCELLED') || type?.includes('DELETED')) {
      return 'action-state-change';
    }
    // Default - gray
    return 'action-restore';
  };

  const getStoreName = (posid) => {
    if (!posid) return '-';
    const store = stores.find(s => s.posid === posid);
    return store ? store.posname : posid;
  };

  const formatKioskId = (kioskid) => {
    if (!kioskid) return '-';
    return kioskid.replace(/^0+/, '') || '0';
  };

  const formatDeviceInfo = (osType, osVersion) => {
    if (!osType && !osVersion) return '-';
    // Truncate osVersion to max 15 characters
    const truncatedVersion = osVersion && osVersion.length > 15 ? osVersion.substring(0, 15) + '...' : osVersion;
    if (osType && osVersion) return `${osType} ${truncatedVersion}`;
    return osType || truncatedVersion || '-';
  };

  // Get unique users from events
  const uniqueUsers = [...new Set(events.map(e => e.userEmail).filter(Boolean))].sort();

  // Filter events
  const filteredEvents = events.filter((item) => {
    if (filterEventType !== 'ALL' && item.eventType !== filterEventType) {
      return false;
    }
    if (filterStore && item.posid !== filterStore) {
      return false;
    }
    if (filterUserEmail && item.userEmail !== filterUserEmail) {
      return false;
    }
    if (filterKioskId) {
      const searchValue = filterKioskId.replace(/^0+/, '') || '0';
      const eventValue = (item.kioskid || '').replace(/^0+/, '') || '0';
      if (eventValue !== searchValue) {
        return false;
      }
    }
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEvents = filteredEvents.slice(indexOfFirstItem, indexOfLastItem);

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
  }, [filteredEvents.length]);

  return (
    <div className="store-history">
      <div className="history-header">
        <div>
          <h1>키오스크 이벤트 이력</h1>
          <p style={{fontSize: '14px', color: '#666', marginTop: '5px'}}>
            키오스크 장치에서 발생한 모든 이벤트를 조회할 수 있습니다.
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn-refresh"
          title="새로고침"
          style={{
            background: 'none',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: '#666'
          }}
        >
          <FiRefreshCw size={16} /> 새로고침
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="searchEventType">이벤트 유형:</label>
          <select
            id="searchEventType"
            value={searchEventType}
            onChange={(e) => setSearchEventType(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">전체</option>
            <optgroup label="앱">
              <option value="APP_START">앱 시작</option>
              <option value="APP_SHUTDOWN">앱 종료</option>
            </optgroup>
            <optgroup label="사용자">
              <option value="USER_LOGIN">사용자 로그인</option>
              <option value="USER_LOGOUT">사용자 로그아웃</option>
            </optgroup>
            <optgroup label="동기화">
              <option value="SYNC_STARTED">동기화 시작</option>
              <option value="SYNC_COMPLETED">동기화 완료</option>
              <option value="SYNC_FAILED">동기화 실패</option>
              <option value="AUTO_SYNC_TRIGGERED">자동 동기화</option>
            </optgroup>
            <optgroup label="다운로드">
              <option value="DOWNLOAD_STARTED">다운로드 시작</option>
              <option value="DOWNLOAD_PROGRESS">다운로드 진행</option>
              <option value="DOWNLOAD_COMPLETED">다운로드 완료</option>
              <option value="DOWNLOAD_FAILED">다운로드 실패</option>
              <option value="DOWNLOAD_CANCELLED">다운로드 취소</option>
            </optgroup>
            <optgroup label="설정">
              <option value="CONFIG_SAVED">설정 저장</option>
              <option value="CONFIG_DELETED">설정 삭제</option>
              <option value="CONFIG_SYNCED_FROM_SERVER">서버 설정 동기화</option>
              <option value="CONFIG_UPDATED_BY_WEB">웹 설정 업데이트</option>
            </optgroup>
            <optgroup label="WebSocket">
              <option value="WEBSOCKET_CONNECTED">WebSocket 연결</option>
              <option value="WEBSOCKET_DISCONNECTED">WebSocket 연결 해제</option>
            </optgroup>
            <optgroup label="연결">
              <option value="CONNECTION_TEST">연결 테스트</option>
              <option value="CONNECTION_SUCCESS">연결 성공</option>
              <option value="CONNECTION_FAILED">연결 실패</option>
            </optgroup>
            <optgroup label="기타">
              <option value="FILE_DELETED">파일 삭제</option>
              <option value="FILE_VERIFIED">파일 검증</option>
              <option value="ERROR">오류</option>
              <option value="ERROR_OCCURRED">오류 발생</option>
              <option value="NETWORK_ERROR">네트워크 오류</option>
              <option value="STORAGE_ERROR">저장소 오류</option>
              <option value="WARNING">경고</option>
              <option value="INFO">정보</option>
              <option value="HEALTH_CHECK">상태 확인</option>
              <option value="MANUAL_ACTION">수동 작업</option>
            </optgroup>
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
          <label htmlFor="searchUserEmail">사용자:</label>
          <select
            id="searchUserEmail"
            value={searchUserEmail}
            onChange={(e) => setSearchUserEmail(e.target.value)}
            className="filter-select"
          >
            <option value="">전체 사용자</option>
            {uniqueUsers.map((email) => (
              <option key={email} value={email}>
                {formatUserEmail(email)}
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
        <div className="loading">이벤트를 불러오는 중...</div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>이벤트 유형</th>
                <th>매장</th>
                <th>키오스크 ID</th>
                <th>키오스크 번호</th>
                <th>디바이스</th>
                <th>사용자</th>
                <th>메시지</th>
                <th>메타데이터</th>
              </tr>
            </thead>
            <tbody>
              {currentEvents.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">이벤트가 없습니다</td>
                </tr>
              ) : (
                currentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDate(event.timestamp)}</td>
                    <td>
                      <span className={`action-badge ${getEventTypeBadgeColor(event.eventType)}`}>
                        {getEventTypeLabel(event.eventType)}
                      </span>
                    </td>
                    <td>{getStoreName(event.posid)}</td>
                    <td style={{textAlign: 'center'}}>{formatKioskId(event.kioskid)}</td>
                    <td style={{textAlign: 'center'}}>{event.kioskno || '-'}</td>
                    <td title={`${event.osType || ''} ${event.osVersion || ''}\n${event.deviceName || ''}`}>
                      <div style={{fontSize: '13px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {formatDeviceInfo(event.osType, event.osVersion)}
                      </div>
                      {event.deviceName && (
                        <div style={{fontSize: '11px', color: '#666', marginTop: '2px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                          {event.deviceName}
                        </div>
                      )}
                    </td>
                    <td>{event.userName || formatUserEmail(event.userEmail)}</td>
                    <td className="description-cell">{event.message || '-'}</td>
                    <td className="value-cell" title={event.metadata || '-'}>
                      {event.metadata || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {filteredEvents.length > 10 && (
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
        <p>전체 레코드: {filteredEvents.length} / {events.length} | 페이지: {currentPage} / {totalPages}</p>
      </div>
    </div>
  );
}

export default KioskEventHistory;
