import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './Components/supabaseClient'
import Landing from './Body/Landing'
import UserLogin from './Components/UserLogin'
import Register from './Components/Register'
import Home from './Body/home'
import ReportsPage from './Body/ReportsPage'
import ReportIssues from './Body/ReportIssues'
import About from './Body/About'
import Profile from './Body/Profile'
import CommunityPage from './Body/CommunityPage'
import AdvertisementsPage from './Body/AdvertisementsPage'
import Sidebar from './Components/Sidebar'
import './App.css';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 8 minutes

function useIdleLogout(timeoutMs) {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleLogout, timeoutMs);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer(); // start the timer on mount

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeoutMs, handleLogout]);
}

function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activePage, setActivePage] = useState('home');

  // Auto log out after 8 minutes of no user activity.
  useIdleLogout(SESSION_TIMEOUT_MS);

  const content = activePage === 'reports'
    ? <ReportsPage selectedCategory={selectedCategory} onReportClick={() => setActivePage('reportIssues')} />
    : activePage === 'reportIssues'
    ? <ReportIssues />
    : activePage === 'about'
    ? <About selectedCategory={selectedCategory} onReportClick={() => setActivePage('reportIssues')}/>
    : activePage === 'profile'
    ? <Profile />
    : activePage === 'community'
    ? <CommunityPage />
    : activePage === 'services'
    ? <AdvertisementsPage />
    : <Home
        selectedCategory={selectedCategory}
        onReportClick={() => setActivePage('reportIssues')}
        onCommunityClick={() => setActivePage('community')}
      />;

  return (
    <Sidebar
      activePage={activePage}
      onPageChange={setActivePage}
      selectedCategory={selectedCategory}
      onCategoryChange={setSelectedCategory}
    >
      {content}
    </Sidebar>
  );
}

function App() {
  return (
    <BrowserRouter basename="/TrackServ">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;