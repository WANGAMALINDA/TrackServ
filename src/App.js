import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activePage, setActivePage] = useState('home');

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
    : <Home selectedCategory={selectedCategory} onReportClick={() => setActivePage('reportIssues')} />;

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