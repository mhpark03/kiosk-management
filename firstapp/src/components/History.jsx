import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAllHistory, getHistoryByEntityType, getHistoryByEntityTypeAndEntityId } from '../services/historyService';
import { getAllStores } from '../services/storeService';
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

      setHistory(data);
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
    return date.toLocaleString('ko-KR');
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
        return 'State Changed';
      default:
        return action;
    }
  };

  const getEntityTypeLabel = (type) => {
    return type === 'KIOSK' ? 'Kiosk' : 'Store';
  };

  const getEntityTypeBadgeColor = (type) => {
    return type === 'KIOSK' ? 'action-create' : 'action-update';
  };

  // Helper function to get store name by posid
  const getStoreName = (posid) => {
    if (!posid) return '-';
    const store = stores.find(s => s.posid === posid);
    return store ? store.posname : posid;
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

  return (
    <div className="store-history">
      <div className="history-header">
        <div>
          <h1>Change History</h1>
          {posid && <p className="store-filter-info">POS ID: {posid}</p>}
          {entityType && <p className="store-filter-info">Type: {getEntityTypeLabel(entityType)}</p>}
        </div>
        {(entityType || entityId) && (
          <button
            onClick={() => navigate('/history')}
            className="btn-show-all"
          >
            Show All History
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-section">
        <div className="filter-group">
          <label htmlFor="searchEntityType">Entity Type:</label>
          <select
            id="searchEntityType"
            value={searchEntityType}
            onChange={(e) => setSearchEntityType(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Types</option>
            <option value="KIOSK">Kiosk</option>
            <option value="STORE">Store</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="searchAction">Action:</label>
          <select
            id="searchAction"
            value={searchAction}
            onChange={(e) => setSearchAction(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="RESTORE">Restore</option>
            <option value="STATE_CHANGE">State Change</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="searchStore">Store:</label>
          <select
            id="searchStore"
            value={searchStore}
            onChange={(e) => setSearchStore(e.target.value)}
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

        <div className="filter-group">
          <label htmlFor="searchUserid">User:</label>
          <select
            id="searchUserid"
            value={searchUserid}
            onChange={(e) => setSearchUserid(e.target.value)}
            className="filter-select"
          >
            <option value="">All Users</option>
            {uniqueUsers.map(([userid, username]) => (
              <option key={userid} value={userid}>
                {username}
              </option>
            ))}
          </select>
        </div>

        <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
            <label htmlFor="searchKioskId" style={{fontSize: '13px', fontWeight: 600, color: '#4a5568'}}>Kiosk ID:</label>
            <div style={{position: 'relative', width: '160px'}}>
              <input
                type="text"
                id="searchKioskId"
                value={searchKioskId}
                onChange={(e) => setSearchKioskId(e.target.value)}
                onKeyPress={handleKeyPress}
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
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <button onClick={handleSearch} className="btn-refresh" title="Search" style={{fontSize: '18px'}}>
          🔍
        </button>
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
                <th>User</th>
                <th>Field</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">No history found</td>
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
                    <td>{getUserDisplayName(item)}</td>
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

export default History;
