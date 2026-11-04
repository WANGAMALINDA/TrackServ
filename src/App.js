import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './Components/supabaseClient'
import Landing from './Body/Landing'
import NotFound from './Body/NotFound'
import UserLogin from './Components/UserLogin'
import ResetPassword from './Components/ResetPassword'
import Register from './Components/Register'
import Home from './Body/home'
import ReportsPage from './Body/ReportsPage'
import ReportIssues from './Body/ReportIssues'
import About from './Body/About'
import Profile from './Body/Profile'
import CommunityPage from './Body/CommunityPage'
import AdvertisementsPage from './Body/AdvertisementsPage'
import Sidebar from './Components/Sidebar'
import CookieConsent from './Components/CookieConsent'
import './App.css';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
  const [accountState, setAccountState] = useState({ loading: true, error: '' });
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = location.pathname.split('/').filter(Boolean)[1] || 'home';

  // Auto log out after 5 minutes of no user activity.
  useIdleLogout(SESSION_TIMEOUT_MS);

  useEffect(() => {
    let active = true;

    const ensureCitizenProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw userError || new Error('Your session has expired. Please sign in again.');
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, role, is_suspended, is_banned, profile_picture')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!existingProfile) {
        const fullName = user.user_metadata?.full_name
          || user.user_metadata?.name
          || user.email?.split('@')[0]
          || 'TrackServ user';
        const username = `google-${user.id.replaceAll('-', '').slice(0, 20)}`;
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: fullName,
            username,
            location: 'Tshwane Municipality',
            role: 'citizen',
          })
          .select('id, full_name, username, role, is_suspended, is_banned, profile_picture')
          .single();

        if (createError) throw createError;
        if (active) setAccountState({ loading: false, error: '', profile: createdProfile });
        return;
      }

      if (existingProfile.is_suspended || existingProfile.is_banned) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw new Error('This account is restricted, and sign-out could not be completed.');
        if (active) {
          navigate('/login', {
            replace: true,
            state: { authError: 'This account is restricted and cannot sign in.' },
          });
        }
        return;
      }

      if (existingProfile.role !== 'citizen') {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw new Error('This account is not registered as a citizen account, and sign-out could not be completed.');
        if (active) {
          navigate('/login', {
            replace: true,
            state: { authError: 'This account is not registered as a citizen account. Use the correct TrackServ login.' },
          });
        }
        return;
      }

      if (active) setAccountState({ loading: false, error: '', profile: existingProfile });
    };

    ensureCitizenProfile().catch((error) => {
      console.error('Could not verify the citizen profile:', error);
      if (active) setAccountState({ loading: false, error: error.message || 'Could not verify your account.' });
    });

    return () => {
      active = false;
    };
  }, []);

  if (accountState.loading) {
    return (
      <main className="app-loading" aria-live="polite">
        <div className="app-loading__spinner" aria-hidden="true" />
        <p>Checking your account…</p>
      </main>
    );
  }

  if (accountState.error) {
    return (
      <main className="account-access-page" role="alert">
        <section className="account-access-card" aria-labelledby="account-access-title">
          <div className="account-access-icon" aria-hidden="true">!</div>
          <p className="account-access-eyebrow">Access unavailable</p>
          <h1 id="account-access-title">We couldn’t verify your account</h1>
          <p className="account-access-message">{accountState.error}</p>
          <button className="account-access-button" type="button" onClick={() => navigate('/login', { replace: true })}>
            Return to login
          </button>
        </section>
      </main>
    );
  }

  const content = activePage === 'reports'
    ? <ReportsPage selectedCategory={selectedCategory} onReportClick={() => navigate('/home/reportIssues')} />
    : activePage === 'reportIssues'
    ? <ReportIssues />
    : activePage === 'about'
    ? <About selectedCategory={selectedCategory} onReportClick={() => navigate('/home/reportIssues')}/>
    : activePage === 'profile'
    ? <Profile />
    : activePage === 'community'
    ? <CommunityPage />
    : <Home
        selectedCategory={selectedCategory}
        onPageChange={(page) => navigate(`/home/${page}`)}
        onReportClick={() => navigate('/home/reportIssues')}
        onCommunityClick={() => navigate('/home/community')}
      />;

  return (
    <Sidebar
      activePage={activePage}
      onPageChange={(page) => navigate(`/home/${page}`)}
      selectedCategory={selectedCategory}
      onCategoryChange={setSelectedCategory}
    >
      {content}
    </Sidebar>
  );
}

function AuthEntryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== '/') return undefined;

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not check the session at the app entry point:', error);
        return;
      }

      if (active && data.session) navigate('/home', { replace: true });
    });

    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <BrowserRouter basename="/TrackServ">
      <AuthEntryRedirect />
      <CookieConsent />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home/*" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;