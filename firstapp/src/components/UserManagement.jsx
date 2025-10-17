import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, suspendUser, activateUser, deleteUser, updateUserRole, updateUserProfileByAdmin } from '../services/userService';
import './StoreManagement.css';

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    displayName: '',
    phoneNumber: '',
    memo: ''
  });

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
      console.log('=== User Suspend Success ===');
      console.log('User suspended successfully');
      console.log('============================');
      setError('');
      loadUsers();
    } catch (err) {
      console.error('=== User Suspend Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('==========================');
    }
  };

  const handleActivate = async (email) => {
    if (!window.confirm(`사용자 ${email}를 활성화하시겠습니까?`)) {
      return;
    }

    try {
      await activateUser(email);
      console.log('=== User Activate Success ===');
      console.log('User activated successfully');
      console.log('=============================');
      setError('');
      loadUsers();
    } catch (err) {
      console.error('=== User Activate Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('===========================');
    }
  };

  const handleDelete = async (email) => {
    if (!window.confirm(`사용자 ${email}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await deleteUser(email);
      console.log('=== User Delete Success ===');
      console.log('User deleted successfully');
      console.log('===========================');
      setError('');
      loadUsers();
    } catch (err) {
      console.error('=== User Delete Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('=========================');
    }
  };

  const handleRoleChange = async (email, newRole) => {
    try {
      await updateUserRole(email, newRole);
      console.log('=== User Role Change Success ===');
      console.log('New role:', newRole);
      console.log('================================');
      setError('');
      loadUsers();
    } catch (err) {
      console.error('=== User Role Change Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('==============================');
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditFormData({
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      memo: user.memo || ''
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateUserProfileByAdmin(
        selectedUser.email,
        editFormData.displayName,
        editFormData.memo,
        editFormData.phoneNumber
      );
      console.log('=== User Profile Updated by Admin ===');
      console.log('Display name:', editFormData.displayName);
      console.log('Memo:', editFormData.memo);
      console.log('====================================');
      setShowEditModal(false);
      setSelectedUser(null);
      setError('');
      loadUsers();
    } catch (err) {
      console.error('=== User Profile Update Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('=================================');
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setEditFormData({
      displayName: '',
      phoneNumber: '',
      memo: ''
    });
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
        <button onClick={loadUsers} className="btn-refresh" title="새로고침" style={{background: 'none', border: 'none', cursor: 'pointer'}}>
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
              <th>전화번호</th>
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
                <td colSpan="9" className="no-data">사용자가 없습니다</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.displayName}</td>
                  <td>{user.phoneNumber || '-'}</td>
                  <td>{getRoleSelect(user)}</td>
                  <td>{getStatusBadge(user.status)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.updatedAt)}</td>
                  <td className="memo-cell">{user.memo || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEditClick(user)}
                        className="btn-edit"
                        title="편집"
                        style={{fontSize: '18px', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer'}}
                      >
                        ✏️
                      </button>
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
                        style={{fontSize: '18px', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer'}}
                      >
                        📋
                      </button>
                      {user.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleSuspend(user.email)}
                          className="btn-suspend"
                          title="정지"
                          style={{fontSize: '18px', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer'}}
                        >
                          ⏸️
                        </button>
                      )}
                      {user.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleActivate(user.email)}
                          className="btn-activate"
                          title="활성화"
                          style={{fontSize: '18px', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer'}}
                        >
                          ▶️
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.email)}
                        className="btn-delete"
                        title="삭제"
                        style={{fontSize: '18px', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer'}}
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

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h2>사용자 정보 편집</h2>
              <button onClick={handleCloseEditModal} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-email">이메일</label>
                <input
                  type="email"
                  id="edit-email"
                  value={selectedUser.email}
                  readOnly
                  style={{background: '#f0f0f0', cursor: 'not-allowed'}}
                />
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  이메일은 변경할 수 없습니다
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="edit-displayName">이름</label>
                <input
                  type="text"
                  id="edit-displayName"
                  name="displayName"
                  value={editFormData.displayName}
                  onChange={handleEditFormChange}
                  required
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-phoneNumber">전화번호 (선택)</label>
                <input
                  type="tel"
                  id="edit-phoneNumber"
                  name="phoneNumber"
                  value={editFormData.phoneNumber}
                  onChange={handleEditFormChange}
                  placeholder="전화번호를 입력하세요"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-memo">메모</label>
                <textarea
                  id="edit-memo"
                  name="memo"
                  value={editFormData.memo}
                  onChange={handleEditFormChange}
                  rows="5"
                  placeholder="메모를 입력하세요"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={handleCloseEditModal} className="btn-cancel">
                  취소
                </button>
                <button type="submit" className="btn-submit">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
