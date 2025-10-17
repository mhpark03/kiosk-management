import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Password must contain at least one letter, one number, and one special character
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Password must contain at least one letter, one number, and one special character (@$!%*#?&)');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter your password (min 8 characters)"
              disabled={loading}
            />
            {password && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                {passwordValidation.minLength && passwordValidation.hasLetter &&
                 passwordValidation.hasNumber && passwordValidation.hasSpecial ? (
                  <div style={{ color: '#10b981' }}>
                    ✓ Password meets all requirements
                  </div>
                ) : (
                  <div style={{ color: '#ef4444' }}>
                    ✗ Password must be 8+ characters with letter, number, and special character (@$!%*#?&)
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="Confirm your password"
              disabled={loading}
            />
            {confirmPassword && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                {confirmPasswordValidation.matches ? (
                  <div style={{ color: '#10b981' }}>
                    ✓ Passwords match
                  </div>
                ) : (
                  <div style={{ color: '#ef4444' }}>
                    ✗ Passwords do not match
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
