import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, suspendUser, activateUser, deleteUser, updateUserRole } from '../services/userService';
import './StoreManagement.css';

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setError('사용자 목록 로드 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (email) => {
    if (!window.confirm(`사용자 ${email}를 정지하시겠습니까?`)) {
      return;
    }

    try {
      await suspendUser(email);
      setMessage(`사용자 ${email}가 정지되었습니다.`);
      setError('');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || '사용자 정지에 실패했습니다.');
      setMessage('');
    }
  };

  const handleActivate = async (email) => {
    if (!window.confirm(`사용자 ${email}를 활성화하시겠습니까?`)) {
      return;
    }

    try {
      await activateUser(email);
      setMessage(`사용자 ${email}가 활성화되었습니다.`);
      setError('');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || '사용자 활성화에 실패했습니다.');
      setMessage('');
    }
  };

  const handleDelete = async (email) => {
    if (!window.confirm(`사용자 ${email}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await deleteUser(email);
      setMessage(`사용자 ${email}가 삭제되었습니다.`);
      setError('');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || '사용자 삭제에 실패했습니다.');
      setMessage('');
    }
  };

  const handleRoleChange = async (email, newRole) => {
    try {
      await updateUserRole(email, newRole);
      setMessage(`사용자 ${email}의 역할이 ${newRole === 'ADMIN' ? '관리자' : '사용자'}로 변경되었습니다.`);
      setError('');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || '역할 변경에 실패했습니다.');
      setMessage('');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="status-badge status-active">활성</span>;
      case 'SUSPENDED':
        return <span className="status-badge status-suspended">정지</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getRoleSelect = (user) => {
    return (
      <select
        value={user.role}
        onChange={(e) => handleRoleChange(user.email, e.target.value)}
        className="role-select"
        style={{padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd'}}
      >
        <option value="USER">사용자</option>
        <option value="ADMIN">관리자</option>
      </select>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="store-management">
        <div className="loading">사용자 목록 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>사용자 관리</h1>
        <button onClick={loadUsers} className="btn-refresh" title="새로고침">
          🔄
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="table-container">
        <table className="store-table">
          <thead>
            <tr>
              <th>이메일</th>
              <th>이름</th>
              <th>역할</th>
              <th>상태</th>
              <th>생성일</th>
              <th>수정일</th>
              <th>메모</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">사용자가 없습니다</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.displayName}</td>
                  <td>{getRoleSelect(user)}</td>
                  <td>{getStatusBadge(user.status)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.updatedAt)}</td>
                  <td className="memo-cell">{user.memo || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => navigate('/user-history', {
                          state: {
                            targetUser: {
                              email: user.email,
                              displayName: user.displayName,
                              id: user.id
                            }
                          }
                        })}
                        className="btn-view"
                        title="이력보기"
                        style={{fontSize: '18px', padding: '6px 12px'}}
                      >
                        📋
                      </button>
                      {user.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleSuspend(user.email)}
                          className="btn-suspend"
                          title="정지"
                          style={{fontSize: '18px', padding: '6px 12px'}}
                        >
                          ⏸️
                        </button>
                      )}
                      {user.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleActivate(user.email)}
                          className="btn-activate"
                          title="활성화"
                          style={{fontSize: '18px', padding: '6px 12px'}}
                        >
                          ▶️
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.email)}
                        className="btn-delete"
                        title="삭제"
                        style={{fontSize: '18px', padding: '6px 12px'}}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="store-summary">
        <p>전체 사용자 수: {users.length}</p>
      </div>
    </div>
  );
}

export default UserManagement;
