import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('모든 필드를 입력해주세요');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      console.log('=== Login Success ===');
      console.log('Login successful, navigating to dashboard');
      console.log('=====================');
      navigate('/dashboard');
    } catch (err) {
      console.error('=== Login Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error response message:', err.response?.data?.message);
      console.error('==================');

      // Check if it's an account approval required error
      if (err.message && err.message.includes('관리자의 승인이 필요합니다')) {
        alert('⚠️ 계정 승인 필요\n\n관리자의 승인이 필요합니다.\n승인 후 로그인해 주세요.\n\n문의사항이 있으시면 관리자에게 연락해주세요.');
        setError(''); // Don't show error in the form
      } else if (err.message && err.message.includes('계정이 정지되었습니다')) {
        alert('🚫 계정 정지\n\n계정이 정지되었습니다.\n관리자에게 문의하세요.');
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>로그인</h2>
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
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              disabled={loading}
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: '15px' }}>
            <Link to="/forgot-password" style={{ fontSize: '14px', color: '#667eea', textDecoration: 'none' }}>
              비밀번호를 잊으셨나요?
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ marginBottom: '10px', color: '#666', fontSize: '14px' }}>
            계정이 없으신가요?
          </p>
          <Link to="/signup" style={{ textDecoration: 'none' }}>
            <button
              type="button"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'white',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#667eea';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.color = '#667eea';
              }}
            >
              회원가입
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
