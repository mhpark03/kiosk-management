import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    setIsSettingsOpen(false);
  };

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
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
          <h1>AiOZ 플랫폼</h1>
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
                대시보드
              </Link>
            </li>
            <li>
              <Link
                to="/kiosks"
                className={location.pathname === '/kiosks' ? 'active' : ''}
                onClick={closeMenu}
              >
                키오스크
              </Link>
            </li>
            <li>
              <Link
                to="/stores"
                className={location.pathname === '/stores' ? 'active' : ''}
                onClick={closeMenu}
              >
                매장
              </Link>
            </li>
            <li>
              <Link
                to="/videos"
                className={location.pathname === '/videos' ? 'active' : ''}
                onClick={closeMenu}
              >
                영상
              </Link>
            </li>
            <li className="dropdown">
              <button
                className={`dropdown-toggle ${isSettingsOpen ? 'active' : ''}`}
                onClick={toggleSettings}
              >
                설정
                <span className={`arrow ${isSettingsOpen ? 'open' : ''}`}>▼</span>
              </button>
              {isSettingsOpen && (
                <ul className="dropdown-menu">
                  <li>
                    <Link
                      to="/profile"
                      className={location.pathname === '/profile' ? 'active' : ''}
                      onClick={closeMenu}
                    >
                      사용자정보 변경
                    </Link>
                  </li>
                  {user?.role === 'ADMIN' && (
                    <li className="hide-mobile">
                      <Link
                        to="/user-history"
                        className={location.pathname === '/user-history' ? 'active' : ''}
                        onClick={closeMenu}
                      >
                        사용자 이력보기
                      </Link>
                    </li>
                  )}
                  <li className="hide-mobile">
                    <Link
                      to="/history"
                      className={location.pathname === '/history' ? 'active' : ''}
                      onClick={closeMenu}
                    >
                      장치 이력보기
                    </Link>
                  </li>
                  {user?.role === 'ADMIN' && (
                    <li className="hide-mobile">
                      <Link
                        to="/kiosk-events"
                        className={location.pathname === '/kiosk-events' ? 'active' : ''}
                        onClick={closeMenu}
                      >
                        키오스크 이벤트 이력
                      </Link>
                    </li>
                  )}
                  {user?.role === 'ADMIN' && (
                    <li className="hide-mobile">
                      <Link
                        to="/user-management"
                        className={location.pathname === '/user-management' ? 'active' : ''}
                        onClick={closeMenu}
                      >
                        사용자 관리
                      </Link>
                    </li>
                  )}
                  {user?.role === 'ADMIN' && (
                    <li className="hide-mobile">
                      <Link
                        to="/batch-management"
                        className={location.pathname === '/batch-management' ? 'active' : ''}
                        onClick={closeMenu}
                      >
                        배치 관리
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          </ul>

          <div className="navbar-user">
            <span className="user-name">환영합니다, {user?.name}!</span>
            <button onClick={handleLogout} className="btn-logout">
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
