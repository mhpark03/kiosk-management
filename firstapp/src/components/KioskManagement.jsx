import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

    return matchesStoreName && matchesMaker;
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

      setSuccess('Kiosk created successfully!');
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

      setSuccess('Kiosk updated successfully!');
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

        setSuccess('Kiosk deleted successfully!');
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

      setSuccess('Kiosk restored successfully!');
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
        setSuccess('Kiosk permanently deleted!');
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

      setSuccess('Kiosk state updated successfully!');
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

  return (
    <div className="kiosk-management">
      <div className="kiosk-header">
        <h1>Kiosk Management</h1>
        <div className="header-actions">
          <div className="search-filters">
            <select
              className="search-select"
              value={searchStoreName}
              onChange={(e) => setSearchStoreName(e.target.value)}
            >
              <option value="">All Stores</option>
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
              <option value="">All Makers</option>
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
              title="Search"
            >
              Search
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
          <label className="toggle-deleted">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Show Deleted
          </label>
          <button onClick={() => setShowAddModal(true)} className="btn-add">
            + Add Kiosk
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">Loading kiosks...</div>
      ) : (
        <div className="kiosk-table-container">
          <table className="kiosk-table">
            <thead>
              <tr>
                <th>Kiosk ID</th>
                <th>Store Name</th>
                <th>Kiosk No</th>
                <th>Maker</th>
                <th>Serial No</th>
                <th>Registration Date</th>
                <th>Setup Date</th>
                <th>Delete Date</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKiosks.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">
                    {(appliedSearchStoreName || appliedSearchMaker) ? 'No kiosks match your filters' : 'No kiosks found'}
                  </td>
                </tr>
              ) : (
                filteredKiosks.map((kiosk) => (
                  <tr key={kiosk.id}>
                    <td>{kiosk.kioskid || 'N/A'}</td>
                    <td>{getStoreName(kiosk.posid)}</td>
                    <td>{kiosk.kioskno || 'N/A'}</td>
                    <td>{kiosk.maker || '-'}</td>
                    <td>{kiosk.serialno || '-'}</td>
                    <td>{formatDate(kiosk.regdate, true)}</td>
                    <td>{formatDate(kiosk.setdate)}</td>
                    <td>{formatDate(kiosk.deldate)}</td>
                    <td>
                      <span className={`state-badge ${getStateColor(kiosk.state)}`}>
                        {kiosk.state}
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
              <h2>Add New Kiosk</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleAddKiosk} className="modal-form">
              <div className="form-group">
                <label htmlFor="posid">Store</label>
                <select
                  id="posid"
                  name="posid"
                  value={formData.posid}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a store...</option>
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
                <label htmlFor="kioskno">Kiosk Number</label>
                <input
                  type="number"
                  id="kioskno"
                  name="kioskno"
                  value={formData.kioskno}
                  onChange={handleInputChange}
                  required
                  min="1"
                  placeholder="Auto-generated"
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  Auto-generated when store is selected, but can be modified
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="maker">Maker</label>
                <input
                  type="text"
                  id="maker"
                  name="maker"
                  value={formData.maker}
                  onChange={handleInputChange}
                  placeholder="Enter manufacturer name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="serialno">Serial Number</label>
                <input
                  type="text"
                  id="serialno"
                  name="serialno"
                  value={formData.serialno}
                  onChange={handleInputChange}
                  placeholder="Enter serial number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="state">State</label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Add Kiosk
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
              <h2>Edit Kiosk</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleEditKiosk} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-store">Store</label>
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
                      Store cannot be changed (POS ID: {formData.posid})
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
                      <option value="">Select a store...</option>
                      {stores
                        .filter(store => store.state === 'active' || store.state === 'maintenance')
                        .map((store) => (
                          <option key={store.id} value={store.posid}>
                            {store.posid} - {store.posname}
                          </option>
                        ))}
                    </select>
                    <small style={{color: '#999', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                      ⚠️ Original store (POS ID: {formData.posid}) not found. Please select a new store.
                    </small>
                  </>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="edit-kioskno">Kiosk Number</label>
                <input
                  type="number"
                  id="edit-kioskno"
                  name="kioskno"
                  value={formData.kioskno}
                  onChange={handleInputChange}
                  required
                  min="1"
                  placeholder="Enter kiosk number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-maker">Maker</label>
                <input
                  type="text"
                  id="edit-maker"
                  name="maker"
                  value={formData.maker}
                  onChange={handleInputChange}
                  placeholder="Enter manufacturer name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-serialno">Serial Number</label>
                <input
                  type="text"
                  id="edit-serialno"
                  name="serialno"
                  value={formData.serialno}
                  onChange={handleInputChange}
                  placeholder="Enter serial number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-state">State</label>
                <select
                  id="edit-state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-setdate">Setup Date</label>
                <input
                  type="date"
                  id="edit-setdate"
                  name="setdate"
                  value={formData.setdate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  Leave empty if not set up yet
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-deldate">Delete Date</label>
                <input
                  type="date"
                  id="edit-deldate"
                  name="deldate"
                  value={formData.deldate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  Leave empty if not deleted
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Update Kiosk
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
