import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './Body/Landing'
import UserLogin from './Components/UserLogin'
import Register from './Components/Register'
import Home from './Body/home'
import ReportIssues from './Body/ReportIssues'
import About from './Body/About'
import Profile from './Body/Profile'
import Sidebar from './Components/Sidebar'
import './App.css';

function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activePage, setActivePage] = useState('home');

  const content = activePage === 'reports'
    ? <ReportIssues />
    : activePage === 'about'
    ? <About />
    : activePage === 'profile'
    ? <Profile />
    : <Home selectedCategory={selectedCategory} onReportClick={() => setActivePage('reports')} />;

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