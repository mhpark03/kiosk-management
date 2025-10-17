import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getAllKiosks,
  createKiosk,
  updateKiosk,
  updateKioskState,
  softDeleteKiosk,
  restoreKiosk,
  permanentDeleteKiosk,
  generateKioskNo,
  checkKioskDuplicate
} from '../services/kioskService';
import {
  logKioskCreation,
  logKioskUpdate,
  logKioskStateChange,
  logKioskDeletion,
  logKioskRestoration
} from '../services/kioskHistoryService';
import { getAllStores } from '../services/storeService';
import { useAuth } from '../context/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { FiEdit, FiTrash2, FiClock, FiRotateCcw } from 'react-icons/fi';
import './KioskManagement.css';

function KioskManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [kiosks, setKiosks] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedKiosk, setSelectedKiosk] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchStoreName, setSearchStoreName] = useState('');
  const [searchMaker, setSearchMaker] = useState('');
  const [appliedSearchStoreName, setAppliedSearchStoreName] = useState('');
  const [appliedSearchMaker, setAppliedSearchMaker] = useState('');
  const [dashboardFilterRegion, setDashboardFilterRegion] = useState(null);
  const [dashboardFilterState, setDashboardFilterState] = useState(null);
  const [dashboardFilterInstallMonth, setDashboardFilterInstallMonth] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    posid: '',
    kioskno: '',
    maker: '',
    serialno: '',
    state: 'inactive',
    setdate: '',
    deldate: ''
  });

  // Load kiosks and stores on component mount
  useEffect(() => {
    loadKiosks();
    loadStores();
  }, [showDeleted]);

  // Reset maker filter when store selection changes
  useEffect(() => {
    setSearchMaker('');
  }, [searchStoreName]);

  // Capture dashboard filters from navigation state
  useEffect(() => {
    if (location.state?.filterRegion) {
      setDashboardFilterRegion(location.state.filterRegion);
    }
    if (location.state?.filterState) {
      setDashboardFilterState(location.state.filterState);
    }
    if (location.state?.filterInstallMonth) {
      setDashboardFilterInstallMonth(location.state.filterInstallMonth);
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

  const loadKiosks = async () => {
    try {
      setLoading(true);
      const data = await getAllKiosks(showDeleted);
      setKiosks(data);
      setError('');
    } catch (err) {
      setError('Failed to load kiosks: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const data = await getAllStores();
      // Load all stores (not just active) to display store names for all kiosks
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  };

  // Helper function to get store name by posid
  const getStoreName = (posid) => {
    const store = stores.find(s => s.posid === posid);
    return store ? store.posname : posid; // Fallback to posid if store not found
  };

  // Get unique makers - if store is selected, only show makers from that store
  const kiosksForMakerFilter = searchStoreName
    ? kiosks.filter(k => k.posid === searchStoreName)
    : kiosks;

  const uniqueMakers = [...new Set(kiosksForMakerFilter.map(k => k.maker).filter(m => m && m.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b));

  // Check if there are any kiosks with empty maker (in filtered set)
  const hasEmptyMaker = kiosksForMakerFilter.some(k => !k.maker || k.maker.trim() === '');

  // Create store address map for region filtering
  const storeMap = {};
  stores.forEach(store => {
    storeMap[store.posid] = store.baseaddress || '';
  });

  // Helper function to format timestamp to "2025년 5월" format
  const formatMonthLabel = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}년 ${month}월`;
  };

  // Filter kiosks based on applied filters (only when search button is clicked)
  const filteredKiosks = kiosks.filter(kiosk => {
    // Filter by store name
    let matchesStoreName = true;
    if (appliedSearchStoreName) {
      matchesStoreName = kiosk.posid === appliedSearchStoreName;
    }

    // Filter by maker (exact match)
    let matchesMaker = true;
    if (appliedSearchMaker) {
      if (appliedSearchMaker === '(None)') {
        // Show kiosks with empty maker
        matchesMaker = !kiosk.maker || kiosk.maker.trim() === '';
      } else {
        matchesMaker = kiosk.maker === appliedSearchMaker;
      }
    }

    // Filter by dashboard region
    let matchesRegion = true;
    if (dashboardFilterRegion) {
      const storeAddress = storeMap[kiosk.posid];
      const region = extractRegion(storeAddress);
      matchesRegion = region === dashboardFilterRegion;
    }

    // Filter by dashboard state
    let matchesState = true;
    if (dashboardFilterState) {
      matchesState = kiosk.state === dashboardFilterState;
    }

    // Filter by installation month
    let matchesInstallMonth = true;
    if (dashboardFilterInstallMonth) {
      const kioskMonth = formatMonthLabel(kiosk.regdate);
      matchesInstallMonth = kioskMonth === dashboardFilterInstallMonth;
    }

    return matchesStoreName && matchesMaker && matchesRegion && matchesState && matchesInstallMonth;
  });

  // Handle search button click
  const handleSearch = () => {
    setAppliedSearchStoreName(searchStoreName);
    setAppliedSearchMaker(searchMaker);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchStoreName('');
    setSearchMaker('');
    setAppliedSearchStoreName('');
    setAppliedSearchMaker('');
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    // If posid changes in Add modal, auto-generate kioskno
    if (name === 'posid' && showAddModal && value) {
      try {
        const nextKioskNo = await generateKioskNo(value);
        setFormData(prev => ({
          ...prev,
          posid: value,
          kioskno: nextKioskNo
        }));
      } catch (err) {
        console.error('Failed to generate kioskno:', err);
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else if (name === 'state' && value === 'active' && !formData.setdate) {
      // If state is changed to 'active' and setdate is empty, set setdate to today
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      setFormData(prev => ({
        ...prev,
        [name]: value,
        setdate: todayStr
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddKiosk = async (e) => {
    e.preventDefault();
    try {
      const kiosknoValue = parseInt(formData.kioskno, 10) || 1;

      // Check for duplicate posid + kioskno combination
      const isDuplicate = await checkKioskDuplicate(formData.posid, kiosknoValue);
      if (isDuplicate) {
        setError(`Kiosk number ${kiosknoValue} already exists for this store. Please use a different number.`);
        setTimeout(() => setError(''), 5000);
        return; // Stop execution
      }

      const result = await createKiosk({ ...formData, kioskno: kiosknoValue });
      const { docId, kioskid } = result;

      // Log history (separate try-catch to not fail kiosk creation)
      if (user) {
        try {
          await logKioskCreation(kioskid, formData.posid, user.email, formData.state);
        } catch (historyErr) {
          console.error('Failed to log history:', historyErr);
          setError('Kiosk created but failed to log history: ' + historyErr.message);
          setTimeout(() => setError(''), 5000);
        }
      }

      console.log('=== Kiosk Created Successfully ===');
      console.log('Kiosk ID:', kioskid);
      console.log('Store ID:', formData.posid);
      console.log('Kiosk number:', kiosknoValue);
      console.log('Maker:', formData.maker || 'Not specified');
      console.log('Serial number:', formData.serialno || 'Not specified');
      console.log('State:', formData.state);
      console.log('==================================');
      setShowAddModal(false);
      setFormData({ posid: '', kioskno: '', maker: '', serialno: '', state: 'inactive', setdate: '', deldate: '' });
      loadKiosks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create kiosk: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEditKiosk = async (e) => {
    e.preventDefault();
    try {
      const kiosknoValue = parseInt(formData.kioskno, 10) || 1;

      // Check for duplicate posid + kioskno combination
      const isDuplicate = await checkKioskDuplicate(formData.posid, kiosknoValue, selectedKiosk.id);
      if (isDuplicate) {
        setError(`Kiosk number ${kiosknoValue} already exists for this store. Please use a different number.`);
        setTimeout(() => setError(''), 5000);
        return; // Stop execution
      }

      const updateData = {
        posid: formData.posid,
        kioskno: kiosknoValue,
        maker: formData.maker || '',
        serialno: formData.serialno || '',
        state: formData.state,
        setdate: dateLocalToTimestamp(formData.setdate),
        deldate: dateLocalToTimestamp(formData.deldate)
      };

      // Track changes for history
      const changes = {};
      if (selectedKiosk.posid !== formData.posid) {
        changes.posid = { old: selectedKiosk.posid, new: formData.posid };
      }
      if (selectedKiosk.kioskno !== kiosknoValue) {
        changes.kioskno = { old: selectedKiosk.kioskno, new: kiosknoValue };
      }
      if (selectedKiosk.maker !== formData.maker) {
        changes.maker = { old: selectedKiosk.maker || 'none', new: formData.maker || 'none' };
      }
      if (selectedKiosk.serialno !== formData.serialno) {
        changes.serialno = { old: selectedKiosk.serialno || 'none', new: formData.serialno || 'none' };
      }
      if (selectedKiosk.state !== formData.state) {
        changes.state = { old: selectedKiosk.state, new: formData.state };
      }
      const oldSetdate = timestampToDateLocal(selectedKiosk.setdate);
      if (oldSetdate !== formData.setdate) {
        changes.setdate = { old: oldSetdate || 'none', new: formData.setdate || 'none' };
      }
      const oldDeldate = timestampToDateLocal(selectedKiosk.deldate);
      if (oldDeldate !== formData.deldate) {
        changes.deldate = { old: oldDeldate || 'none', new: formData.deldate || 'none' };
      }

      await updateKiosk(selectedKiosk.id, updateData);

      // Log history
      if (user && Object.keys(changes).length > 0) {
        await logKioskUpdate(selectedKiosk.kioskid, formData.posid, user.email, changes);
      }

      console.log('=== Kiosk Updated Successfully ===');
      console.log('Kiosk ID:', selectedKiosk.kioskid);
      console.log('Store ID:', formData.posid);
      console.log('Changes:', changes);
      console.log('==================================');
      setShowEditModal(false);
      setSelectedKiosk(null);
      setFormData({ posid: '', kioskno: '', maker: '', serialno: '', state: 'inactive', setdate: '', deldate: '' });
      loadKiosks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update kiosk: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteKiosk = async (kioskId) => {
    if (window.confirm('Are you sure you want to delete this kiosk?')) {
      try {
        const kiosk = kiosks.find(k => k.id === kioskId);
        await softDeleteKiosk(kioskId);

        // Log history
        if (user && kiosk) {
          await logKioskDeletion(kiosk.kioskid, kiosk.posid, user.email);
        }

        console.log('=== Kiosk Deleted Successfully ===');
        console.log('Kiosk ID:', kiosk?.kioskid || kioskId);
        console.log('==================================');
        loadKiosks();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to delete kiosk: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleRestoreKiosk = async (kioskId) => {
    try {
      const kiosk = kiosks.find(k => k.id === kioskId);
      await restoreKiosk(kioskId);

      // Log history
      if (user && kiosk) {
        await logKioskRestoration(kiosk.kioskid, kiosk.posid, user.email);
      }

      console.log('=== Kiosk Restored Successfully ===');
      console.log('Kiosk ID:', kiosk?.kioskid || kioskId);
      console.log('===================================');
      loadKiosks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to restore kiosk: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handlePermanentDeleteKiosk = async (kioskId) => {
    const kiosk = kiosks.find(k => k.id === kioskId);
    if (window.confirm(`Are you sure you want to PERMANENTLY delete this kiosk (${kiosk?.kioskid || kioskId})?\n\nThis action CANNOT be undone!\n\nThe kiosk data will be completely removed from the database.`)) {
      try {
        await permanentDeleteKiosk(kioskId);
        console.log('=== Kiosk Permanently Deleted ===');
        console.log('Kiosk ID:', kiosk?.kioskid || kioskId);
        console.log('=================================');
        loadKiosks();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError('Failed to permanently delete kiosk: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleStateChange = async (kioskId, newState) => {
    try {
      const kiosk = kiosks.find(k => k.id === kioskId);
      const oldState = kiosk?.state;

      await updateKioskState(kioskId, newState);

      // Log history
      if (user && kiosk && oldState !== newState) {
        await logKioskStateChange(kiosk.kioskid, kiosk.posid, user.email, oldState, newState);
      }

      console.log('=== Kiosk State Updated Successfully ===');
      console.log('Kiosk ID:', kiosk?.kioskid || kioskId);
      console.log('Old state:', oldState);
      console.log('New state:', newState);
      console.log('========================================');
      loadKiosks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update kiosk state: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const openEditModal = (kiosk) => {
    setSelectedKiosk(kiosk);
    setFormData({
      posid: kiosk.posid,
      kioskno: kiosk.kioskno || '',
      maker: kiosk.maker || '',
      serialno: kiosk.serialno || '',
      state: kiosk.state,
      setdate: timestampToDateLocal(kiosk.setdate),
      deldate: timestampToDateLocal(kiosk.deldate)
    });
    setShowEditModal(true);
  };

  const handleViewHistory = (kiosk) => {
    navigate(`/history?entityType=KIOSK&entityId=${kiosk.kioskid}&posid=${kiosk.posid}`);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedKiosk(null);
    setFormData({ posid: '', kioskno: '', maker: '', serialno: '', state: 'inactive', setdate: '', deldate: '' });
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
    // Extract username part before @ symbol
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
      case 'maintenance':
        return 'state-maintenance';
      case 'deleted':
        return 'state-deleted';
      default:
        return '';
    }
  };

  // Remove leading zeros from kiosk ID for display
  const formatKioskId = (kioskid) => {
    if (!kioskid) return 'N/A';
    return kioskid.replace(/^0+/, '') || '0';
  };

  return (
    <div className="kiosk-management">
      <div className="kiosk-header">
        <h1>키오스크 관리</h1>
        <div className="header-actions">
          <div className="search-filters">
            <select
              className="search-select"
              value={searchStoreName}
              onChange={(e) => setSearchStoreName(e.target.value)}
            >
              <option value="">전체 매장</option>
              {stores.map((store) => (
                <option key={store.id} value={store.posid}>
                  {store.posname}
                </option>
              ))}
            </select>
            <select
              className="search-select"
              value={searchMaker}
              onChange={(e) => setSearchMaker(e.target.value)}
            >
              <option value="">전체 제조사</option>
              {hasEmptyMaker && (
                <option value="(None)">(None)</option>
              )}
              {uniqueMakers.map((maker) => (
                <option key={maker} value={maker}>
                  {maker}
                </option>
              ))}
            </select>
            <button
              className="btn-search"
              onClick={handleSearch}
              title="검색"
            >
              검색
            </button>
            {(appliedSearchStoreName || appliedSearchMaker) && (
              <button
                className="btn-clear-search"
                onClick={handleClearFilters}
                title="Clear filters"
              >
                ✕
              </button>
            )}
          </div>
          <div className="action-group">
            <label className="toggle-deleted">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              삭제된 항목 표시
            </label>
            <button onClick={() => setShowAddModal(true)} className="btn-add">
              + 키오스크 추가
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">키오스크 로딩 중...</div>
      ) : (
        <div className="kiosk-table-container">
          <table className="kiosk-table">
            <thead>
              <tr>
                <th>키오스크 ID</th>
                <th>매장명</th>
                <th>번호</th>
                <th>제조사</th>
                <th>시리얼 번호</th>
                <th>등록일</th>
                <th>시작일</th>
                <th>종료일</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredKiosks.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">
                    {(appliedSearchStoreName || appliedSearchMaker) ? '필터와 일치하는 키오스크가 없습니다' : '키오스크가 없습니다'}
                  </td>
                </tr>
              ) : (
                filteredKiosks.map((kiosk) => (
                  <tr key={kiosk.id}>
                    <td
                      style={{textAlign: 'center', cursor: 'pointer', color: '#667eea', fontWeight: '600'}}
                      onClick={() => openEditModal(kiosk)}
                      className="clickable-kioskid"
                      title="클릭하여 편집"
                    >
                      {formatKioskId(kiosk.kioskid)}
                    </td>
                    <td>{getStoreName(kiosk.posid)}</td>
                    <td style={{textAlign: 'center'}}>{kiosk.kioskno || 'N/A'}</td>
                    <td>{kiosk.maker || '-'}</td>
                    <td>{kiosk.serialno || '-'}</td>
                    <td>{formatDate(kiosk.regdate, true)}</td>
                    <td>{formatDate(kiosk.setdate)}</td>
                    <td>{formatDate(kiosk.deldate)}</td>
                    <td>
                      <span className={`state-badge ${getStateColor(kiosk.state)}`}>
                        {kiosk.state === 'active' ? '활성' :
                         kiosk.state === 'inactive' ? '비활성' :
                         kiosk.state === 'maintenance' ? '정비중' :
                         kiosk.state === 'deleted' ? '삭제됨' : kiosk.state}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {kiosk.state !== 'deleted' ? (
                          <>
                            <button
                              onClick={() => openEditModal(kiosk)}
                              className="btn-edit"
                              title="Edit"
                            >
                              <FiEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteKiosk(kiosk.id)}
                              className="btn-delete"
                              title="Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRestoreKiosk(kiosk.id)}
                              className="btn-restore"
                              title="Restore"
                            >
                              <FiRotateCcw />
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteKiosk(kiosk.id)}
                              className="btn-permanent-delete"
                              title="Permanently Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleViewHistory(kiosk)}
                          className="btn-history"
                          title="History"
                        >
                          <FiClock />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Kiosk Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>새 키오스크 추가</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleAddKiosk} className="modal-form">
              <div className="form-group">
                <label htmlFor="posid">매장</label>
                <select
                  id="posid"
                  name="posid"
                  value={formData.posid}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">매장을 선택하세요...</option>
                  {stores
                    .filter(store => store.state === 'active' || store.state === 'maintenance')
                    .map((store) => (
                      <option key={store.id} value={store.posid}>
                        {store.posid} - {store.posname}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="kioskno">키오스크 번호</label>
                <input
                  type="number"
                  id="kioskno"
                  name="kioskno"
                  value={formData.kioskno}
                  onChange={handleInputChange}
                  required
                  min="1"
                  placeholder="자동 생성"
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  매장 선택 시 자동 생성되지만 수정 가능합니다
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="maker">제조사</label>
                <input
                  type="text"
                  id="maker"
                  name="maker"
                  value={formData.maker}
                  onChange={handleInputChange}
                  placeholder="제조사명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="serialno">시리얼 번호</label>
                <input
                  type="text"
                  id="serialno"
                  name="serialno"
                  value={formData.serialno}
                  onChange={handleInputChange}
                  placeholder="시리얼 번호를 입력하세요"
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
                  <option value="maintenance">정비중</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  취소
                </button>
                <button type="submit" className="btn-submit">
                  키오스크 추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Kiosk Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>키오스크 편집</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleEditKiosk} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-store">매장</label>
                {stores.find(s => s.posid === formData.posid) ? (
                  <>
                    <input
                      type="text"
                      id="edit-storename"
                      value={formData.posid ? getStoreName(formData.posid) : ''}
                      readOnly
                      style={{background: '#f0f0f0', cursor: 'not-allowed', fontWeight: '600', color: '#333'}}
                    />
                    <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                      매장은 변경할 수 없습니다 (POS ID: {formData.posid})
                    </small>
                  </>
                ) : (
                  <>
                    <select
                      id="edit-store"
                      name="posid"
                      value={formData.posid}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">매장을 선택하세요...</option>
                      {stores
                        .filter(store => store.state === 'active' || store.state === 'maintenance')
                        .map((store) => (
                          <option key={store.id} value={store.posid}>
                            {store.posid} - {store.posname}
                          </option>
                        ))}
                    </select>
                    <small style={{color: '#999', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                      ⚠️ 원래 매장 (POS ID: {formData.posid})을 찾을 수 없습니다. 새 매장을 선택하세요.
                    </small>
                  </>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="edit-kioskno">키오스크 번호</label>
                <input
                  type="number"
                  id="edit-kioskno"
                  name="kioskno"
                  value={formData.kioskno}
                  onChange={handleInputChange}
                  required
                  min="1"
                  placeholder="키오스크 번호를 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-maker">제조사</label>
                <input
                  type="text"
                  id="edit-maker"
                  name="maker"
                  value={formData.maker}
                  onChange={handleInputChange}
                  placeholder="제조사명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-serialno">시리얼 번호</label>
                <input
                  type="text"
                  id="edit-serialno"
                  name="serialno"
                  value={formData.serialno}
                  onChange={handleInputChange}
                  placeholder="시리얼 번호를 입력하세요"
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
                  <option value="maintenance">정비중</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-setdate">시작일</label>
                <input
                  type="date"
                  id="edit-setdate"
                  name="setdate"
                  value={formData.setdate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  아직 시작하지 않았다면 비워두세요
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-deldate">종료일</label>
                <input
                  type="date"
                  id="edit-deldate"
                  name="deldate"
                  value={formData.deldate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  아직 운영 중이라면 비워두세요
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  취소
                </button>
                <button type="submit" className="btn-submit">
                  키오스크 수정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default KioskManagement;
