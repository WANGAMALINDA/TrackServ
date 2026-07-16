import { useState } from 'react'
import Home from './Body/home'
import Sidebar from './Components/Sidebar'
import './App.css';

function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  return (
    <Sidebar selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}>
      <Home selectedCategory={selectedCategory} />
    </Sidebar>
  );
}

export default App;
