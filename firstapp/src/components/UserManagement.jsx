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
    memo: '',
    status: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      memo: user.memo || '',
      status: user.status || 'ACTIVE'
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;

    // 전화번호 필드인 경우 숫자만 허용하고 포맷팅
    if (name === 'phoneNumber') {
      const numbersOnly = value.replace(/[^0-9]/g, '');
      // 한국 전화번호 형식으로 포맷팅
      // 11자리: 휴대폰 (010-1234-5678)
      // 12자리: 평생번호 (0501-1234-5678)
      let formatted = numbersOnly;

      if (numbersOnly.length <= 3) {
        formatted = numbersOnly;
      } else if (numbersOnly.length <= 7) {
        formatted = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
      } else if (numbersOnly.length <= 11) {
        // 11자리 이하: 3-4-4 포맷 (010-1234-5678)
        formatted = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
      } else {
        // 12자리: 4-4-4 포맷 (0501-1234-5678)
        formatted = `${numbersOnly.slice(0, 4)}-${numbersOnly.slice(4, 8)}-${numbersOnly.slice(8, 12)}`;
      }
      setEditFormData(prev => ({
        ...prev,
        [name]: formatted
      }));
    } else {
      setEditFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update profile first
      await updateUserProfileByAdmin(
        selectedUser.email,
        editFormData.displayName,
        editFormData.memo,
        editFormData.phoneNumber
      );

      // If status changed, update it
      if (editFormData.status !== selectedUser.status) {
        if (editFormData.status === 'ACTIVE') {
          await activateUser(selectedUser.email);
        } else if (editFormData.status === 'SUSPENDED') {
          await suspendUser(selectedUser.email);
        }
        console.log('=== User Status Updated ===');
        console.log('New status:', editFormData.status);
        console.log('==========================');
      }

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
      alert('수정 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setEditFormData({
      displayName: '',
      phoneNumber: '',
      memo: '',
      status: ''
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="status-badge status-active">활성</span>;
      case 'SUSPENDED':
        return <span className="status-badge status-suspended">정지</span>;
      case 'PENDING_APPROVAL':
        return <span className="status-badge status-pending">승인대기</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getStatusSelect = (user) => {
    // PENDING_APPROVAL 상태에서는 모든 옵션 표시
    // ACTIVE/SUSPENDED 상태에서는 PENDING_APPROVAL 제외
    const statusOptions = user.status === 'PENDING_APPROVAL'
      ? [
          { value: 'ACTIVE', label: '활성' },
          { value: 'SUSPENDED', label: '정지' },
          { value: 'PENDING_APPROVAL', label: '승인대기' }
        ]
      : [
          { value: 'ACTIVE', label: '활성' },
          { value: 'SUSPENDED', label: '정지' }
        ];

    return (
      <select
        value={user.status}
        onChange={(e) => handleStatusChange(user.email, e.target.value)}
        className="status-select"
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          backgroundColor: user.status === 'ACTIVE' ? '#d4edda' :
                          user.status === 'SUSPENDED' ? '#f8d7da' :
                          user.status === 'PENDING_APPROVAL' ? '#fff3cd' : 'white',
          fontWeight: '500'
        }}
      >
        {statusOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

  const handleStatusChange = async (email, newStatus) => {
    try {
      if (newStatus === 'ACTIVE') {
        await activateUser(email);
      } else if (newStatus === 'SUSPENDED') {
        await suspendUser(email);
      } else if (newStatus === 'PENDING_APPROVAL') {
        // PENDING_APPROVAL로 변경하는 것은 일반적이지 않지만, 필요시 구현
        alert('승인 대기 상태로 변경할 수 없습니다.');
        return;
      }
      console.log('=== User Status Change Success ===');
      console.log('New status:', newStatus);
      console.log('==================================');
      setError('');
      loadUsers();
    } catch (err) {
      console.error('=== User Status Change Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('================================');
      alert('상태 변경 실패: ' + (err.response?.data?.message || err.message));
      loadUsers(); // Reload to restore original state
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

  // Sort users: PENDING_APPROVAL first, then others
  const sortedUsers = [...users].sort((a, b) => {
    // PENDING_APPROVAL comes first
    if (a.status === 'PENDING_APPROVAL' && b.status !== 'PENDING_APPROVAL') return -1;
    if (a.status !== 'PENDING_APPROVAL' && b.status === 'PENDING_APPROVAL') return 1;
    // For same status, sort by creation date (newest first)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstItem, indexOfLastItem);

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

  // Reset to page 1 when users list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

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
            {currentUsers.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">사용자가 없습니다</td>
              </tr>
            ) : (
              currentUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.displayName}</td>
                  <td>{user.phoneNumber || '-'}</td>
                  <td>{getRoleSelect(user)}</td>
                  <td>{getStatusSelect(user)}</td>
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

      {users.length > 10 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          marginTop: '20px',
          padding: '20px'
        }}>
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f7fafc' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              color: currentPage === 1 ? '#a0aec0' : '#2d3748',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            이전
          </button>

          <div style={{ display: 'flex', gap: '5px' }}>
            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: currentPage === pageNumber ? '#4299e1' : 'white',
                    color: currentPage === pageNumber ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: currentPage === pageNumber ? '600' : '500',
                    minWidth: '40px'
                  }}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f7fafc' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              color: currentPage === totalPages ? '#a0aec0' : '#2d3748',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            다음
          </button>
        </div>
      )}

      <div className="store-summary">
        <p>전체 사용자 수: {users.length} | 페이지: {currentPage} / {totalPages}</p>
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
                <label htmlFor="edit-status">계정 상태</label>
                <select
                  id="edit-status"
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditFormChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: editFormData.status === 'ACTIVE' ? '#d4edda' :
                                    editFormData.status === 'SUSPENDED' ? '#f8d7da' :
                                    editFormData.status === 'PENDING_APPROVAL' ? '#fff3cd' : 'white',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ACTIVE">✅ 활성</option>
                  <option value="SUSPENDED">🚫 정지</option>
                  {selectedUser.status === 'PENDING_APPROVAL' && (
                    <option value="PENDING_APPROVAL">⏳ 승인대기</option>
                  )}
                </select>
                <small style={{color: '#666', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  계정의 상태를 변경할 수 있습니다
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
                  placeholder="010-1234-5678"
                  maxLength="14"
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
