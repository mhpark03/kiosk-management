import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    posid: '',
    posname: '',
    zonecode: '',
    posaddress: '',
    posaddress_detail: '',
    state: 'inactive',
    startdate: '',
    enddate: ''
  });

  // Load stores on component mount
  useEffect(() => {
    loadStores();
  }, [showDeleted]);

  const loadStores = async () => {
    try {
      setLoading(true);
      const data = await getAllStores(showDeleted);
      setStores(data);
      setError('');
    } catch (err) {
      setError('Failed to load stores: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If state is changed to 'active' and startdate is empty, set startdate to today
    if (name === 'state' && value === 'active' && !formData.startdate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      setFormData(prev => ({
        ...prev,
        [name]: value,
        startdate: todayStr
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
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
        startdate: dateLocalToTimestamp(formData.startdate),
        enddate: dateLocalToTimestamp(formData.enddate)
      };

      await createStore(storeData);

      setSuccess('Store created successfully!');
      setShowAddModal(false);
      setFormData({ posid: '', posname: '', zonecode: '', posaddress: '', posaddress_detail: '', state: 'inactive', startdate: '', enddate: '' });
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
        startdate: dateLocalToTimestamp(formData.startdate),
        enddate: dateLocalToTimestamp(formData.enddate)
      };

      await updateStore(selectedStore.id, updateData);

      setSuccess('Store updated successfully!');
      setShowEditModal(false);
      setSelectedStore(null);
      setFormData({ posid: '', posname: '', zonecode: '', posaddress: '', posaddress_detail: '', state: 'inactive', startdate: '', enddate: '' });
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

        setSuccess('Store deactivated successfully!');
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

      setSuccess('Store restored successfully!');
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

        setSuccess('Store permanently deleted!');
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

      setSuccess('Store state updated successfully!');
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
      startdate: timestampToDateLocal(store.startdate),
      enddate: timestampToDateLocal(store.enddate)
    });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedStore(null);
    setFormData({ posid: '', posname: '', zonecode: '', posaddress: '', posaddress_detail: '', state: 'inactive', startdate: '', enddate: '' });
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
      case 'maintenance':
        return 'state-maintenance';
      case 'deleted':
        return 'state-deleted';
      default:
        return '';
    }
  };

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>Store Management</h1>
        <div className="header-actions">
          <label className="toggle-deleted">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Show Deleted
          </label>
          <button onClick={() => setShowAddModal(true)} className="btn-add">
            + Add Store
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">Loading stores...</div>
      ) : (
        <div className="store-table-container">
          <table className="store-table">
            <thead>
              <tr>
                <th>POS ID</th>
                <th>Store Name</th>
                <th>Address</th>
                <th>Registration Date</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>State</th>
                <th>User ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">No stores found</td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id}>
                    <td>{store.posid}</td>
                    <td>{store.posname}</td>
                    <td>{store.posaddress}</td>
                    <td>{formatDate(store.regdate, true)}</td>
                    <td>{formatDate(store.startdate)}</td>
                    <td>{formatDate(store.enddate)}</td>
                    <td>
                      <span className={`state-badge ${getStateColor(store.state)}`}>
                        {store.state}
                      </span>
                    </td>
                    <td>{formatUserEmail(store.userid)}</td>
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

      {/* Add Store Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Store</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleAddStore} className="modal-form">
              <div className="form-group">
                <label htmlFor="posname">Store Name</label>
                <input
                  type="text"
                  id="posname"
                  name="posname"
                  value={formData.posname}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter store name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="zonecode">Postal Code</label>
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
                <label htmlFor="posaddress">Address</label>
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
                <label htmlFor="posaddress_detail">Detailed Address</label>
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
              <div className="form-group">
                <label htmlFor="startdate">Start Date</label>
                <input
                  type="date"
                  id="startdate"
                  name="startdate"
                  value={formData.startdate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  Leave empty if not started yet
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Add Store
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
              <h2>Edit Store</h2>
              <button onClick={closeModals} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleEditStore} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-posid">POS ID</label>
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
                <label htmlFor="edit-posname">Store Name</label>
                <input
                  type="text"
                  id="edit-posname"
                  name="posname"
                  value={formData.posname}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter store name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-zonecode">Postal Code</label>
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
                <label htmlFor="edit-posaddress">Address</label>
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
                <label htmlFor="edit-posaddress_detail">Detailed Address</label>
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
                <label htmlFor="edit-startdate">Start Date</label>
                <input
                  type="date"
                  id="edit-startdate"
                  name="startdate"
                  value={formData.startdate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  Leave empty if not started yet
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-enddate">End Date</label>
                <input
                  type="date"
                  id="edit-enddate"
                  name="enddate"
                  value={formData.enddate}
                  onChange={handleInputChange}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  Leave empty if still active
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModals} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Update Store
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
