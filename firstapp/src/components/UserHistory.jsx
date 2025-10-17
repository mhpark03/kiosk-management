import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHistoryByUser } from '../services/historyService';
import { getAllStores } from '../services/storeService';
import { getAllUsers } from '../services/userService';
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

  // Filter states
  const [filterEntityType, setFilterEntityType] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterStore, setFilterStore] = useState('');
  const [filterKioskId, setFilterKioskId] = useState('');

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
      setError('Failed to load user history: ' + err.message);
    } finally {
      setLoading(false);
    }
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
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
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
      default:
        return '';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE':
        return 'Created';
      case 'UPDATE':
        return 'Updated';
      case 'DELETE':
        return 'Deleted';
      case 'RESTORE':
        return 'Restored';
      case 'STATE_CHANGE':
        return 'Updated';
      case 'LOGIN':
        return 'Login';
      case 'LOGOUT':
        return 'Logout';
      case 'PASSWORD_CHANGE':
        return 'Password Change';
      case 'SUSPEND':
        return 'Suspended';
      case 'ACTIVATE':
        return 'Activated';
      default:
        return action;
    }
  };

  const getEntityTypeLabel = (type) => {
    switch (type) {
      case 'KIOSK':
        return 'Kiosk';
      case 'STORE':
        return 'Store';
      case 'USER':
        return 'User';
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

  const getStoreName = (posid) => {
    if (!posid) return '-';
    const store = stores.find(s => s.posid === posid);
    return store ? store.posname : posid;
  };

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
    if (filterKioskId) {
      const searchValue = filterKioskId.replace(/^0+/, '') || '0';
      const entityValue = (item.entityId || '').replace(/^0+/, '') || '0';
      if (entityValue !== searchValue) {
        return false;
      }
    }
    return true;
  });

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
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="store-filter-info">
              사용자: {targetUserFromState ? `${targetUserFromState.displayName} (${targetUserFromState.email})` : `${user?.displayName} (${user?.email})`}
            </p>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="filterEntityType">Entity Type:</label>
          <select
            id="filterEntityType"
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Types</option>
            <option value="KIOSK">Kiosk</option>
            <option value="STORE">Store</option>
            <option value="USER">User</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filterAction">Action:</label>
          <select
            id="filterAction"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="RESTORE">Restore</option>
            <option value="STATE_CHANGE">State Change</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="PASSWORD_CHANGE">Password Change</option>
            <option value="SUSPEND">Suspend</option>
            <option value="ACTIVATE">Activate</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filterStore">Store:</label>
          <select
            id="filterStore"
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="filter-select"
          >
            <option value="">All Stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.posid}>
                {store.posname}
              </option>
            ))}
          </select>
        </div>

        <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
            <label htmlFor="filterKioskId" style={{fontSize: '13px', fontWeight: 600, color: '#4a5568'}}>Kiosk ID:</label>
            <div style={{position: 'relative', width: '160px'}}>
              <input
                type="text"
                id="filterKioskId"
                value={filterKioskId}
                onChange={(e) => setFilterKioskId(e.target.value)}
                placeholder="Kiosk ID"
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

        <button onClick={handleReset} className="btn-refresh" title="Reset" style={{marginLeft: '5px', fontSize: '18px'}}>
          🔄
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Timestamp</th>
                <th>Store</th>
                <th>Kiosk ID</th>
                <th>Action</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="9" className="no-data">No history found</td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`action-badge ${getEntityTypeBadgeColor(item.entityType)}`}>
                        {getEntityTypeLabel(item.entityType)}
                      </span>
                    </td>
                    <td>{formatDate(item.timestamp)}</td>
                    <td>{getStoreName(item.posid)}</td>
                    <td>{item.entityType === 'KIOSK' ? (item.entityId || '-') : '-'}</td>
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

      <div className="history-summary">
        <p>Total Records: {filteredHistory.length} / {history.length}</p>
      </div>
    </div>
  );
}

export default UserHistory;
