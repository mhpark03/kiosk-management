import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAllStoreHistory, getStoreHistoryByStoreId } from '../services/storeHistoryService';
import './StoreHistory.css';

function StoreHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterPosid, setFilterPosid] = useState('');
  const [filterUserid, setFilterUserid] = useState('');

  const storeId = searchParams.get('storeId');
  const posid = searchParams.get('posid');

  useEffect(() => {
    loadHistory();
  }, [storeId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      let data;
      if (storeId) {
        data = await getStoreHistoryByStoreId(storeId);
      } else {
        data = await getAllStoreHistory();
      }
      setHistory(data);
      setError('');
    } catch (err) {
      setError('Failed to load store history: ' + err.message);
    } finally {
      setLoading(false);
    }
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

  const formatUserEmail = (email) => {
    if (!email) return 'N/A';
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return email.substring(0, atIndex);
    }
    return email;
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

  // Filter history
  const filteredHistory = history.filter((item) => {
    if (filterAction !== 'ALL' && item.action !== filterAction) {
      return false;
    }
    if (filterPosid && !item.posid.includes(filterPosid)) {
      return false;
    }
    if (filterUserid && !item.userid.toLowerCase().includes(filterUserid.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="store-history">
      <div className="history-header">
        <div>
          <h1>Store Change History</h1>
          {posid && <p className="store-filter-info">매장: {posid}</p>}
        </div>
        {storeId && (
          <button
            onClick={() => navigate('/store-history')}
            className="btn-show-all"
          >
            모든 이력 보기
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-section">
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
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filterPosid">POS ID:</label>
          <input
            type="text"
            id="filterPosid"
            value={filterPosid}
            onChange={(e) => setFilterPosid(e.target.value)}
            placeholder="Filter by POS ID"
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filterUserid">User:</label>
          <input
            type="text"
            id="filterUserid"
            value={filterUserid}
            onChange={(e) => setFilterUserid(e.target.value)}
            placeholder="Filter by user"
            className="filter-input"
          />
        </div>

        <button onClick={loadHistory} className="btn-refresh">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>POS ID</th>
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
                  <td colSpan="8" className="no-data">No history found</td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.timestamp)}</td>
                    <td>{item.posid}</td>
                    <td>
                      <span className={`action-badge ${getActionColor(item.action)}`}>
                        {getActionLabel(item.action)}
                      </span>
                    </td>
                    <td>{formatUserEmail(item.userid)}</td>
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

export default StoreHistory;
