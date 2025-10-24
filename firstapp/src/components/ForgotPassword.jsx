import { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import './Auth.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !displayName || !newPassword || !confirmPassword) {
      setError('모든 필드를 입력해주세요');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    // Password validation
    const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordPattern.test(newPassword)) {
      setError('비밀번호는 8자 이상이며, 영문, 숫자, 특수문자(@$!%*#?&)를 포함해야 합니다');
      return;
    }

    try {
      setError('');
      setLoading(true);

      // Reset password with email and displayName verification
      await authService.resetPassword(email, displayName, newPassword);

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>비밀번호 변경 완료</h2>
          <div className="success-message">
            <p>비밀번호가 성공적으로 변경되었습니다!</p>
            <p style={{ fontSize: '14px', marginTop: '10px', color: '#666' }}>
              새로운 비밀번호로 로그인하실 수 있습니다.
            </p>
          </div>
          <p className="auth-link">
            <Link to="/login">로그인하러 가기</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>비밀번호 재설정</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
          이메일과 이름을 입력하여 본인 확인 후 비밀번호를 변경할 수 있습니다.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">이름</label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="가입 시 등록한 이름을 입력하세요"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">새 비밀번호</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호를 입력하세요"
              disabled={loading}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              8자 이상, 영문, 숫자, 특수문자(@$!%*#?&) 포함
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">비밀번호 확인</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호를 다시 입력하세요"
              disabled={loading}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '처리 중...' : '비밀번호 변경'}
          </button>
        </form>

        <p className="auth-link">
          비밀번호가 기억나셨나요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
