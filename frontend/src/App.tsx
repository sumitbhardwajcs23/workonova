import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

function Home() {
  return (
    <div className="card">
      <h1>Workonova MVP</h1>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <a href="/client-dashboard.html" className="btn">Client Dashboard (Legacy)</a>
        <a href="/freelancer-dashboard.html" className="btn">Freelancer Dashboard (Legacy)</a>
      </div>
      <p style={{ marginTop: '2rem' }}>
        Note: The legacy HTML files are served from the public directory. 
        You can gradually convert them into React components here.
      </p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
