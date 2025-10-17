import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const [buttonClicks, setButtonClicks] = useState({ button1: 0, button2: 0 });

  const handleButton1Click = () => {
    setButtonClicks(prev => ({ ...prev, button1: prev.button1 + 1 }));
    alert('Button 1 clicked! Click count: ' + (buttonClicks.button1 + 1));
  };

  const handleButton2Click = () => {
    setButtonClicks(prev => ({ ...prev, button2: prev.button2 + 1 }));
    alert('Button 2 clicked! Click count: ' + (buttonClicks.button2 + 1));
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome to your Dashboard!</h2>
          <p>You are successfully logged in.</p>

          <div className="user-info">
            <h3>Your Profile</h3>
            <p><strong>Name:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>User ID:</strong> {user?.id}</p>
          </div>

          <div className="button-group">
            <button onClick={handleButton1Click} className="btn-action btn-primary-action">
              Edit Profile
            </button>
            <button onClick={handleButton2Click} className="btn-action btn-secondary-action">
              View Settings
            </button>
          </div>

          <div className="info-card">
            <h3>About this Authentication</h3>
            <p>
              This is a frontend-only authentication system using localStorage.
              Your credentials are stored in your browser's local storage.
            </p>
            <ul>
              <li>User data persists across page refreshes</li>
              <li>Protected routes require authentication</li>
              <li>Logout clears your session</li>
            </ul>
            <p className="warning">
              <strong>Note:</strong> This is for demonstration purposes only.
              In production, use a secure backend authentication system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
