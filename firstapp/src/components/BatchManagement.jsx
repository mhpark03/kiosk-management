import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Management.css';

function BatchManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [executionHistory, setExecutionHistory] = useState([]);

  // Fetch execution history
  const fetchExecutionHistory = async () => {
    try {
      const response = await api.get('/batch/execution-history');
      setExecutionHistory(response.data);
    } catch (err) {
      console.error('Failed to fetch execution history:', err);
    }
  };

  // Load execution history on component mount
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchExecutionHistory();
    }
  }, [user]);

  const handleCleanupHistory = async () => {
    if (!window.confirm('정말로 1개월 이상 지난 Kiosk/Store 이력을 삭제하시겠습니까?\n\n(사용자 이력은 삭제되지 않습니다)')) {
      return;
    }

    try {
      setError('');
      setLoading(true);
      setResult(null);

      const response = await api.post('/batch/cleanup-history');

      setResult({
        success: true,
        deletedRecords: response.data.deletedRecords,
        message: response.data.message
      });

      // Refresh execution history after successful execution
      fetchExecutionHistory();

    } catch (err) {
      console.error('Batch execution error:', err);
      setError(err.response?.data?.message || '배치 실행 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Parse detail to extract key information
  const parseDetail = (detail) => {
    if (!detail) return {};

    const lines = detail.split('\n');
    const result = {};

    lines.forEach(line => {
      if (line.includes('Status:')) {
        result.status = line.split('Status:')[1]?.trim();
      }
      if (line.includes('Deleted Records:')) {
        result.deletedRecords = line.split('Deleted Records:')[1]?.trim();
      }
      if (line.includes('Executed By:')) {
        result.executedBy = line.split('Executed By:')[1]?.trim();
      }
      if (line.includes('Error:')) {
        result.error = line.split('Error:')[1]?.trim();
      }
    });

    return result;
  };

  // Only accessible by ADMIN
  if (user?.role !== 'ADMIN') {
    return (
      <div className="management-container">
        <div className="error-message">
          이 페이지는 관리자만 접근할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="management-container">
      <h1>배치 관리</h1>

      <div className="batch-section">
        <div className="batch-card">
          <h2>Entity History 정리</h2>
          <p className="batch-description">
            1개월 이상 지난 Kiosk 및 Store 이력 데이터를 삭제합니다.<br />
            사용자(USER) 관련 이력은 보존됩니다.
          </p>

          <div className="batch-info">
            <h3>자동 실행 일정</h3>
            <p>매일 새벽 2시 자동 실행</p>
          </div>

          <div className="batch-actions">
            <button
              onClick={handleCleanupHistory}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? '실행 중...' : '수동 실행'}
            </button>
          </div>

          {error && (
            <div className="error-message" style={{ marginTop: '20px' }}>
              {error}
            </div>
          )}

          {result && (
            <div className="success-message" style={{ marginTop: '20px' }}>
              <h3>실행 완료</h3>
              <p>삭제된 레코드 수: <strong>{result.deletedRecords}</strong></p>
              <p>{result.message}</p>
              <p style={{ fontSize: '14px', marginTop: '10px', color: '#666' }}>
                실행 결과는 History 페이지에서 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        <div className="batch-info-card">
          <h3>최근 실행 이력</h3>

          {executionHistory.length === 0 ? (
            <p style={{ marginTop: '16px', color: '#666' }}>
              아직 실행 이력이 없습니다.
            </p>
          ) : (
            <div style={{ marginTop: '16px', overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#f9f9f9',
                    borderBottom: '2px solid #e0e0e0'
                  }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left' }}>실행 시간</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left' }}>실행자</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>삭제 건수</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {executionHistory.map((record, index) => {
                    const details = parseDetail(record.detail);
                    return (
                      <tr key={record.id || index} style={{
                        borderBottom: '1px solid #e0e0e0'
                      }}>
                        <td style={{ padding: '12px 8px' }}>
                          {formatDate(record.timestamp)}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {details.executedBy || record.username}
                        </td>
                        <td style={{
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {details.deletedRecords || record.newValue || '0'}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: details.status === 'SUCCESS' ? '#def7ec' : '#fee',
                            color: details.status === 'SUCCESS' ? '#22543d' : '#c53030'
                          }}>
                            {details.status || 'SUCCESS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: '16px', fontSize: '13px', color: '#666' }}>
            전체 이력은 <strong>History</strong> 페이지에서 "배치" 필터로 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BatchManagement;
