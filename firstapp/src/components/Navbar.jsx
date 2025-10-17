import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Don't show navbar on login, signup, and forgot password pages
  const hideNavbar = ['/login', '/signup', '/forgot-password'].includes(location.pathname);

  if (hideNavbar || !isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-logo" onClick={closeMenu}>
          <h1>My App</h1>
        </Link>

        {/* Hamburger Menu Icon */}
        <button
          className={`hamburger ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Navigation Menu */}
        <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
          <ul className="navbar-links">
            <li>
              <Link
                to="/dashboard"
                className={location.pathname === '/dashboard' ? 'active' : ''}
                onClick={closeMenu}
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/kiosks"
                className={location.pathname === '/kiosks' ? 'active' : ''}
                onClick={closeMenu}
              >
                Kiosks
              </Link>
            </li>
            <li>
              <Link
                to="/stores"
                className={location.pathname === '/stores' ? 'active' : ''}
                onClick={closeMenu}
              >
                Stores
              </Link>
            </li>
            <li>
              <Link
                to="/history"
                className={location.pathname === '/history' ? 'active' : ''}
                onClick={closeMenu}
              >
                History
              </Link>
            </li>
            <li>
              <a href="#profile" onClick={closeMenu}>Profile</a>
            </li>
            <li>
              <a href="#settings" onClick={closeMenu}>Settings</a>
            </li>
          </ul>

          <div className="navbar-user">
            <span className="user-name">Welcome, {user?.name}!</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
