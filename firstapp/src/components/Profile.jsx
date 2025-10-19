import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, getCurrentUser, changePassword, deleteMyAccount } from '../services/userService';
import './Auth.css';

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    memo: '',
    phoneNumber: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getCurrentUser();
      setFormData({
        name: userData.displayName || '',
        email: userData.email || '',
        memo: userData.memo || '',
        phoneNumber: userData.phoneNumber || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      console.error('Failed to load user data:', err);
      setError('사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // 전화번호 필드인 경우 숫자만 허용하고 포맷팅
    if (name === 'phoneNumber') {
      const numbersOnly = value.replace(/[^0-9]/g, '');
      let formatted = numbersOnly;
      if (numbersOnly.length <= 3) {
        formatted = numbersOnly;
      } else if (numbersOnly.length <= 7) {
        formatted = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
      } else if (numbersOnly.length <= 11) {
        formatted = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7)}`;
      } else {
        // 11자리 초과 시 11자리까지만 허용
        formatted = `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7, 11)}`;
      }
      setFormData({
        ...formData,
        [name]: formatted
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await updateProfile(formData.name, formData.memo, formData.phoneNumber);
      console.log('=== Profile Update Success ===');
      console.log('Name:', formData.name);
      console.log('Memo:', formData.memo || 'Empty');
      console.log('==============================');
    } catch (err) {
      setError(err.message || '프로필 업데이트에 실패했습니다.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      console.log('=== Password Change Success ===');
      console.log('Password changed successfully');
      console.log('===============================');
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || '비밀번호 변경에 실패했습니다.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('정말로 회원 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    if (!window.confirm('모든 데이터가 삭제됩니다. 정말 탈퇴하시겠습니까?')) {
      return;
    }

    try {
      await deleteMyAccount();
      console.log('=== Account Deletion Success ===');
      console.log('Account deleted successfully');
      console.log('================================');
      logout();
      navigate('/login');
    } catch (err) {
      console.error('=== Account Deletion Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.response?.data?.message || err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Status code:', err.response?.status);
      console.error('==============================');
      setError(err.response?.data?.message || err.message || '회원 탈퇴에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{maxWidth: '600px'}}>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{maxWidth: '600px', position: 'relative'}}>
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#999',
            padding: '5px',
            lineHeight: '1',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = '#333'}
          onMouseLeave={(e) => e.target.style.color = '#999'}
          title="닫기"
        >
          ✕
        </button>

        <h2>사용자정보 변경</h2>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Profile Update Form */}
        <form onSubmit={handleUpdateProfile} style={{marginBottom: '40px'}}>
          <h3 style={{marginBottom: '20px', color: '#333', fontSize: '18px'}}>기본 정보</h3>

          <div className="form-group">
            <label htmlFor="name">이름</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled
              style={{background: '#f5f5f5', cursor: 'not-allowed'}}
            />
            <small style={{color: '#666', fontSize: '12px'}}>이메일은 변경할 수 없습니다.</small>
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">전화번호 (선택)</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="010-1234-5678"
              maxLength="13"
            />
          </div>

          <div className="form-group">
            <label htmlFor="memo">메모</label>
            <textarea
              id="memo"
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              rows="5"
              placeholder="개인 메모를 입력하세요..."
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

          <button type="submit" className="btn-primary" style={{width: '100%'}}>
            정보 업데이트
          </button>
        </form>

        {/* Password Change Form */}
        <form onSubmit={handleChangePassword}>
          <h3 style={{marginBottom: '20px', color: '#333', fontSize: '18px', borderTop: '1px solid #eee', paddingTop: '30px'}}>
            비밀번호 변경
          </h3>

          <div className="form-group">
            <label htmlFor="currentPassword">현재 비밀번호</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">새 비밀번호</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              required
              minLength="6"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">새 비밀번호 확인</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength="6"
            />
          </div>

          <button type="submit" className="btn-primary" style={{width: '100%'}}>
            비밀번호 변경
          </button>
        </form>

        {/* Account Deletion Section */}
        <div style={{marginTop: '40px', paddingTop: '30px', borderTop: '1px solid #eee'}}>
          <h3 style={{marginBottom: '20px', color: '#d32f2f', fontSize: '18px'}}>
            회원 탈퇴
          </h3>
          <p style={{marginBottom: '20px', color: '#666', fontSize: '14px'}}>
            계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
          </p>
          <button
            type="button"
            onClick={handleDeleteAccount}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#b71c1c'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#d32f2f'}
          >
            회원 탈퇴
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
