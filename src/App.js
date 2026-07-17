import { useState } from 'react'
import Home from './Body/home'
import ReportIssues from './Body/ReportIssues'
import Sidebar from './Components/Sidebar'
import './App.css';

function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activePage, setActivePage] = useState('home');

  const content = activePage === 'reports'
    ? <ReportIssues />
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

export default App;
