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
  checkKioskDuplicate,
  getKioskConfig,
  updateKioskConfig,
  updateKioskConfigFromWeb
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
import { FiEdit, FiTrash2, FiClock, FiRotateCcw, FiVideo, FiSettings } from 'react-icons/fi';
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
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedKiosk, setSelectedKiosk] = useState(null);
  const [kioskConfig, setKioskConfig] = useState({
    downloadPath: '',
    apiUrl: '',
    autoSync: false,
    syncInterval: 12,
    lastSync: null
  });
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    posid: '',
    kioskno: '',
    maker: '',
    serialno: '',
    state: 'preparing',
    regdate: '',
    setdate: '',
    deldate: '',
    storeRegdate: '', // Store registration date for validation
    storeMinDate: '' // Minimum allowed start date (store regdate + 1 day)
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

      // Auto-update kiosk state based on setdate and deldate
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      for (const kiosk of data) {
        if (kiosk.state === 'deleted' || kiosk.state === 'maintenance') {
          continue;
        }

        // Check if deldate has passed - if so, change to inactive
        if (kiosk.deldate && (kiosk.state === 'active' || kiosk.state === 'preparing')) {
          const delDate = kiosk.deldate.toDate ? kiosk.deldate.toDate() : new Date(kiosk.deldate);
          delDate.setHours(0, 0, 0, 0);
          const delDateTime = delDate.getTime();

          if (delDateTime < todayTime) {
            console.log(`Auto-updating kiosk ${kiosk.kioskid} from '${kiosk.state}' to 'inactive' (deldate ${formatDate(kiosk.deldate)} has passed)`);
            try {
              await updateKioskState(kiosk.id, 'inactive');
              if (user) {
                await logKioskStateChange(kiosk.kioskid, kiosk.posid, user.email, kiosk.state, 'inactive');
              }
            } catch (err) {
              console.error(`Failed to auto-update kiosk ${kiosk.kioskid} state:`, err);
            }
            continue; // Skip other checks for this kiosk
          }
        }

        // Only check setdate logic if state is not inactive
        if (kiosk.state === 'inactive') {
          continue;
        }

        if (!kiosk.setdate) {
          continue;
        }

        const setDate = kiosk.setdate.toDate ? kiosk.setdate.toDate() : new Date(kiosk.setdate);
        setDate.setHours(0, 0, 0, 0);
        const setDateTime = setDate.getTime();

        // If setdate is in the future and state is active, change to preparing
        if (setDateTime > todayTime && kiosk.state === 'active') {
          console.log(`Auto-updating kiosk ${kiosk.kioskid} from 'active' to 'preparing' (setdate ${formatDate(kiosk.setdate)} is in the future)`);
          try {
            await updateKioskState(kiosk.id, 'preparing');
            if (user) {
              await logKioskStateChange(kiosk.kioskid, kiosk.posid, user.email, 'active', 'preparing');
            }
          } catch (err) {
            console.error(`Failed to auto-update kiosk ${kiosk.kioskid} state:`, err);
          }
        }

        // If setdate has arrived and state is preparing, change to active
        if (setDateTime <= todayTime && kiosk.state === 'preparing') {
          console.log(`Auto-updating kiosk ${kiosk.kioskid} from 'preparing' to 'active' (setdate ${formatDate(kiosk.setdate)} has arrived)`);
          try {
            await updateKioskState(kiosk.id, 'active');
            if (user) {
              await logKioskStateChange(kiosk.kioskid, kiosk.posid, user.email, 'preparing', 'active');
            }
          } catch (err) {
            console.error(`Failed to auto-update kiosk ${kiosk.kioskid} state:`, err);
          }
        }
      }

      // Reload data after auto-updates
      const updatedData = await getAllKiosks(showDeleted);
      // Sort by ID in descending order (newest first)
      const sortedData = [...updatedData].sort((a, b) => b.id - a.id);
      setKiosks(sortedData);
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

  // Helper function to format posid (remove leading zeros)
  const formatPosId = (posid) => {
    if (!posid) return 'N/A';
    return posid.replace(/^0+/, '') || '0';
  };

  // Helper function to get store name by posid
  const getStoreName = (posid) => {
    const store = stores.find(s => s.posid === posid);
    return store ? `${store.posname} (${formatPosId(posid)})` : formatPosId(posid); // Display store name with formatted posid in parentheses
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
    // Filter by inactive state - hide inactive kiosks unless showDeleted is true
    if (!showDeleted && kiosk.state === 'inactive') {
      return false;
    }

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
    } else if (name === 'state' && (value === 'inactive' || value === 'maintenance') && !formData.deldate) {
      // If state is changed to 'inactive' or 'maintenance' and deldate is empty, set deldate to today
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      setFormData(prev => ({
        ...prev,
        [name]: value,
        deldate: todayStr
      }));
    } else if (name === 'setdate' && value && formData.state === 'preparing') {
      // If setdate is set and current state is preparing, only change to active if setdate is today or in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const setDate = new Date(value + 'T00:00:00');

      if (setDate.getTime() <= today.getTime()) {
        // Setdate is today or in the past, change to active
        setFormData(prev => ({
          ...prev,
          [name]: value,
          state: 'active'
        }));
      } else {
        // Setdate is in the future, keep as preparing
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
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

      const kioskData = {
        ...formData,
        kioskno: kiosknoValue,
        regdate: dateLocalToTimestamp(formData.regdate),
        setdate: dateLocalToTimestamp(formData.setdate),
        deldate: dateLocalToTimestamp(formData.deldate)
      };
      const result = await createKiosk(kioskData);
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
      setFormData({ posid: '', kioskno: '', maker: '', serialno: '', state: 'preparing', regdate: '', setdate: '', deldate: '', storeRegdate: '', storeMinDate: '' });
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
        regdate: dateLocalToTimestamp(formData.regdate),
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
      const oldRegdate = timestampToDateLocal(selectedKiosk.regdate);
      if (oldRegdate !== formData.regdate) {
        changes.regdate = { old: oldRegdate || 'none', new: formData.regdate || 'none' };
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
      setFormData({ posid: '', kioskno: '', maker: '', serialno: '', state: 'preparing', regdate: '', setdate: '', deldate: '', storeRegdate: '', storeMinDate: '' });
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

    // Minimum allowed start date is the store registration date (inclusive)
    const storeRegdateStr = timestampToDateLocal(kiosk.storeRegdate);
    const storeMinDateStr = storeRegdateStr; // Same as store regdate (no +1 day)

    setFormData({
      posid: kiosk.posid,
      kioskno: kiosk.kioskno || '',
      maker: kiosk.maker || '',
      serialno: kiosk.serialno || '',
      state: kiosk.state,
      regdate: timestampToDateLocal(kiosk.regdate),
      setdate: timestampToDateLocal(kiosk.setdate),
      deldate: timestampToDateLocal(kiosk.deldate),
      storeRegdate: storeRegdateStr,
      storeMinDate: storeMinDateStr
    });
    setShowEditModal(true);
  };

  const handleViewHistory = (kiosk) => {
    navigate(`/history?entityType=KIOSK&entityId=${kiosk.kioskid}&posid=${kiosk.posid}`);
  };

  const handleManageVideos = (kiosk) => {
    console.log('=== handleManageVideos called ===');
    console.log('Kiosk ID:', kiosk.id);
    console.log('Kiosk state:', kiosk.state);
    console.log('Navigating to:', `/kiosks/${kiosk.id}/videos`);

    // Only pass serializable data (no functions)
    const kioskData = {
      id: kiosk.id,
      kioskid: kiosk.kioskid,
      posid: kiosk.posid,
      kioskno: kiosk.kioskno,
      state: kiosk.state,
      maker: kiosk.maker,
      serialno: kiosk.serialno
    };

    navigate(`/kiosks/${kiosk.id}/videos`, { state: { kiosk: kioskData } });
  };

  const handleViewConfig = async (kiosk) => {
    setSelectedKiosk(kiosk);
    try {
      const config = await getKioskConfig(kiosk.kioskid);

      // Check if config has any data
      const hasConfig = config.downloadPath || config.apiUrl || config.autoSync || config.syncInterval || config.lastSync;

      if (!hasConfig) {
        // No config exists - show alert and don't open modal
        alert(`키오스크 ${kiosk.kioskid}는 아직 연결되지 않았습니다.\n\n키오스크 앱에서 설정을 저장하면 여기에서 확인 및 수정할 수 있습니다.`);
        setSelectedKiosk(null);
        return;
      }

      setKioskConfig({
        downloadPath: config.downloadPath || '',
        apiUrl: config.apiUrl || '',
        autoSync: config.autoSync || false,
        syncInterval: config.syncInterval || 12,
        lastSync: config.lastSync || null
      });
      setShowConfigModal(true);
    } catch (err) {
      console.error('Failed to load kiosk config:', err);
      // Error occurred (404 or network error) - show alert and don't open modal
      alert(`키오스크 ${kiosk.kioskid}는 아직 연결되지 않았습니다.\n\n키오스크 앱에서 설정을 저장하면 여기에서 확인 및 수정할 수 있습니다.`);
      setSelectedKiosk(null);
    }
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    try {
      // Use admin web endpoint to set configModifiedByWeb flag
      await updateKioskConfigFromWeb(selectedKiosk.id, kioskConfig);
      setSuccess('키오스크 설정이 업데이트되었습니다. 키오스크 앱에 알림이 전송되었습니다.');
      setTimeout(() => setSuccess(''), 5000);
      setShowConfigModal(false);
      setSelectedKiosk(null);
      setKioskConfig({
        downloadPath: '',
        apiUrl: '',
        autoSync: false,
        syncInterval: 12,
        lastSync: null
      });
    } catch (err) {
      setError('설정 업데이트 실패: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleConfigInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setKioskConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'syncInterval' ? parseInt(value) || 12 : value)
    }));
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowConfigModal(false);
    setSelectedKiosk(null);
    setFormData({ posid: '', kioskno: '', maker: '', serialno: '', state: 'preparing', regdate: '', setdate: '', deldate: '', storeRegdate: '', storeMinDate: '' });
    setKioskConfig({
      downloadPath: '',
      apiUrl: '',
      autoSync: false,
      syncInterval: 12,
      lastSync: null
    });
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
      case 'preparing':
        return 'state-preparing';
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

  // Pagination logic
  const totalPages = Math.ceil(filteredKiosks.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentKiosks = filteredKiosks.slice(indexOfFirstItem, indexOfLastItem);

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
  }, [filteredKiosks.length]);

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
                <th>영상</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredKiosks.length === 0 ? (
                <tr>
                  <td colSpan="11" className="no-data">
                    {(appliedSearchStoreName || appliedSearchMaker) ? '필터와 일치하는 키오스크가 없습니다' : '키오스크가 없습니다'}
                  </td>
                </tr>
              ) : (
                currentKiosks.map((kiosk) => (
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
                    <td>{formatDate(kiosk.regdate)}</td>
                    <td>{formatDate(kiosk.setdate)}</td>
                    <td>{formatDate(kiosk.deldate)}</td>
                    <td style={{textAlign: 'center'}}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.9em'
                      }}>
                        <span style={{fontWeight: '600', color: '#48bb78'}}>
                          {kiosk.downloadedVideoCount || 0}
                        </span>
                        <span style={{color: '#666'}}>/</span>
                        <span style={{fontWeight: '600', color: '#667eea'}}>
                          {kiosk.totalVideoCount || 0}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`state-badge ${getStateColor(kiosk.state)}`}>
                        {kiosk.state === 'preparing' ? '준비중' :
                         kiosk.state === 'active' ? '활성' :
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
                        <button
                          onClick={() => {
                            console.log('Video button clicked! Kiosk state:', kiosk.state);
                            handleManageVideos(kiosk);
                          }}
                          className="btn-video"
                          title="영상 관리"
                          style={{
                            display: kiosk.state !== 'deleted' ? 'flex' : 'none'
                          }}
                        >
                          <FiVideo />
                        </button>
                        <button
                          onClick={() => handleViewConfig(kiosk)}
                          className="btn-config"
                          title="키오스크 설정"
                          style={{
                            display: kiosk.state !== 'deleted' ? 'flex' : 'none'
                          }}
                        >
                          <FiSettings />
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

      {/* Pagination */}
      {filteredKiosks.length > 0 && totalPages > 1 && (
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

      {/* Page info */}
      <div style={{
        textAlign: 'center',
        fontSize: '14px',
        color: '#718096',
        marginBottom: '20px'
      }}>
        전체 {filteredKiosks.length}개 키오스크 {filteredKiosks.length > 0 && `(${currentPage} / ${totalPages} 페이지)`}
      </div>

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
                  <option value="preparing">준비중</option>
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
                  <option value="preparing">준비중</option>
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                  <option value="maintenance">정비중</option>
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
                  min={formData.storeMinDate || undefined}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  {formData.storeRegdate
                    ? `매장 등록일(${formData.storeRegdate}) 이후(포함) 날짜만 선택 가능합니다`
                    : '키오스크가 시스템에 등록된 날짜'}
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-setdate">시작일</label>
                <input
                  type="date"
                  id="edit-setdate"
                  name="setdate"
                  value={formData.setdate}
                  onChange={handleInputChange}
                  min={formData.regdate || undefined}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  {formData.regdate
                    ? `키오스크 등록일(${formData.regdate}) 이후(포함) 날짜만 선택 가능합니다`
                    : '아직 시작하지 않았다면 비워두세요'}
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
                  min={formData.setdate || undefined}
                  disabled={!formData.setdate}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  {formData.setdate
                    ? `시작일(${formData.setdate}) 이후(포함) 날짜만 선택 가능합니다`
                    : '시작일을 먼저 설정해야 합니다'}
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

      {/* Config Modal */}
      {showConfigModal && selectedKiosk && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>키오스크 설정 - {selectedKiosk.kioskid}</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleUpdateConfig} className="modal-form">
              <div className="form-group">
                <label htmlFor="config-downloadPath" style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                  📁 다운로드 경로
                </label>
                <input
                  type="text"
                  id="config-downloadPath"
                  name="downloadPath"
                  value={kioskConfig.downloadPath}
                  onChange={handleConfigInputChange}
                  placeholder="예: C:\Videos"
                />
                <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                  💡 키오스크 앱에서 영상을 다운로드할 경로
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="config-apiUrl" style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                  🌐 API URL
                </label>
                <input
                  type="text"
                  id="config-apiUrl"
                  name="apiUrl"
                  value={kioskConfig.apiUrl}
                  onChange={handleConfigInputChange}
                  placeholder="예: http://localhost:8080/api"
                />
                <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                  💡 백엔드 API 서버 주소
                </small>
              </div>
              <div className="form-group">
                <label style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                  🔄 자동 동기화 설정
                </label>
                <div style={{display: 'flex', gap: '16px', alignItems: 'flex-start'}}>
                  <div style={{flex: 1}}>
                    <input
                      type="number"
                      id="config-syncInterval"
                      name="syncInterval"
                      value={kioskConfig.syncInterval}
                      onChange={handleConfigInputChange}
                      min="1"
                      max="24"
                      placeholder="12"
                      style={{width: '100%'}}
                    />
                    <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                      동기화 간격 (1-24시간)
                    </small>
                  </div>
                  <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px'}}>
                    <input
                      type="checkbox"
                      id="config-autoSync"
                      name="autoSync"
                      checked={kioskConfig.autoSync}
                      onChange={handleConfigInputChange}
                      style={{width: '20px', height: '20px', margin: 0, cursor: 'pointer'}}
                    />
                    <label htmlFor="config-autoSync" style={{margin: 0, cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: '#555'}}>
                      자동 동기화 활성화
                    </label>
                  </div>
                </div>
                <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                  💡 체크하면 설정된 간격마다 자동으로 영상을 동기화합니다
                </small>
              </div>
              <div className="form-group">
                <label style={{fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '10px'}}>
                  ⏰ 마지막 동기화 시간
                </label>
                <input
                  type="text"
                  value={kioskConfig.lastSync ? new Date(kioskConfig.lastSync).toLocaleString('ko-KR') : '없음'}
                  readOnly
                  style={{background: '#f7f7f7', cursor: 'not-allowed', color: '#666'}}
                />
                <small style={{color: '#888', fontSize: '11px', marginTop: '6px', display: 'block', fontStyle: 'italic'}}>
                  💡 키오스크 앱에서 마지막으로 동기화한 시간 (읽기 전용)
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  취소
                </button>
                <button type="submit" className="btn-submit">
                  설정 저장
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
