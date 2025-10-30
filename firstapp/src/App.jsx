import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './components/Dashboard';
import KioskManagement from './components/KioskManagement';
import StoreManagement from './components/StoreManagement';
import History from './components/History';
import Profile from './components/Profile';
import UserHistory from './components/UserHistory';
import UserManagement from './components/UserManagement';
import BatchManagement from './components/BatchManagement';
import VideoManagement from './components/VideoManagement';
import VideoUpload from './components/VideoUpload';
import VideoGenerator from './components/VideoGenerator';
import VeoGenerator from './components/VeoGenerator';
import ImageGenerator from './components/ImageGenerator';
import ImageManagement from './components/ImageManagement';
import ImageEdit from './components/ImageEdit';
import AIVideoManagement from './components/AIVideoManagement';
import KioskVideoManagement from './components/KioskVideoManagement';
import KioskEventHistory from './components/KioskEventHistory';
import AudioGenerator from './components/AudioGenerator';
import AudioEdit from './components/AudioEdit';
import UserGuide from './components/UserGuide';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    // Handle window resize and orientation change
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated after orientation change
      setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }, 100);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Modern API for orientation change (preferred)
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kiosks"
            element={
              <ProtectedRoute>
                <KioskManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kiosks/:id/videos"
            element={
              <ProtectedRoute>
                <KioskVideoManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores"
            element={
              <ProtectedRoute>
                <StoreManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-history"
            element={
              <ProtectedRoute>
                <UserHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/batch-management"
            element={
              <ProtectedRoute>
                <BatchManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos/upload"
            element={
              <ProtectedRoute>
                <VideoUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos"
            element={
              <ProtectedRoute>
                <VideoManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos/ai-generated"
            element={
              <ProtectedRoute>
                <AIVideoManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/images"
            element={
              <ProtectedRoute>
                <ImageManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/images/edit/:id"
            element={
              <ProtectedRoute>
                <ImageEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos/generate"
            element={
              <ProtectedRoute>
                <VideoGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos/generate-veo"
            element={
              <ProtectedRoute>
                <VeoGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audio/generate"
            element={
              <ProtectedRoute>
                <AudioGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audios/edit/:id"
            element={
              <ProtectedRoute>
                <AudioEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kiosk-events"
            element={
              <ProtectedRoute>
                <KioskEventHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-guide"
            element={
              <ProtectedRoute>
                <UserGuide />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
