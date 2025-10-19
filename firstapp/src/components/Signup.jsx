import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasLetter: false,
    hasNumber: false,
    hasSpecial: false
  });
  const [confirmPasswordValidation, setConfirmPasswordValidation] = useState({
    notEmpty: false,
    matches: false
  });
  const navigate = useNavigate();
  const { signup } = useAuth();

  // Validate password as user types
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

    // Check each validation rule
    setPasswordValidation({
      minLength: newPassword.length >= 8,
      hasLetter: /[A-Za-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSpecial: /[@$!%*#?&]/.test(newPassword)
    });

    // Re-validate confirm password if it exists
    if (confirmPassword) {
      setConfirmPasswordValidation({
        notEmpty: confirmPassword.length > 0,
        matches: newPassword === confirmPassword
      });
    }
  };

  // Validate confirm password as user types
  const handleConfirmPasswordChange = (e) => {
    const newConfirmPassword = e.target.value;
    setConfirmPassword(newConfirmPassword);

    // Check if matches password
    setConfirmPasswordValidation({
      notEmpty: newConfirmPassword.length > 0,
      matches: password === newConfirmPassword
    });
  };

  // Format phone number as user types (숫자만 허용, 자동 하이픈 추가)
  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    // 숫자만 추출
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

    setPhoneNumber(formatted);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      setError('모든 필드를 입력해주세요');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다');
      return;
    }

    // Password must contain at least one letter, one number, and one special character
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('비밀번호는 최소 하나의 문자, 숫자, 특수문자(@$!%*#?&)를 포함해야 합니다');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, name, phoneNumber);
      console.log('=== Signup Success ===');
      console.log('User name:', name);
      console.log('Signup successful, navigating to dashboard');
      console.log('======================');
      navigate('/dashboard');
    } catch (err) {
      console.error('=== Signup Error ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.message);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error response message:', err.response?.data?.message);
      console.error('===================');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>회원가입</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">이름</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              disabled={loading}
            />
          </div>

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
            <label htmlFor="phoneNumber">전화번호 (선택사항)</label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="010-1234-5678"
              disabled={loading}
              maxLength="14"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="비밀번호를 입력하세요 (최소 8자)"
              disabled={loading}
            />
            {password && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                {passwordValidation.minLength && passwordValidation.hasLetter &&
                 passwordValidation.hasNumber && passwordValidation.hasSpecial ? (
                  <div style={{ color: '#10b981' }}>
                    ✓ 비밀번호가 모든 요구사항을 충족합니다
                  </div>
                ) : (
                  <div style={{ color: '#ef4444' }}>
                    ✗ 비밀번호는 8자 이상이어야 하며 문자, 숫자, 특수문자(@$!%*#?&)를 포함해야 합니다
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">비밀번호 확인</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="비밀번호를 다시 입력하세요"
              disabled={loading}
            />
            {confirmPassword && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                {confirmPasswordValidation.matches ? (
                  <div style={{ color: '#10b981' }}>
                    ✓ 비밀번호가 일치합니다
                  </div>
                ) : (
                  <div style={{ color: '#ef4444' }}>
                    ✗ 비밀번호가 일치하지 않습니다
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '계정 생성 중...' : '회원가입'}
          </button>
        </form>

        <p className="auth-link">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
