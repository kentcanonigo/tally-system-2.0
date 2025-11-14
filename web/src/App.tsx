import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Plants from './pages/Plants';
import WeightClassifications from './pages/WeightClassifications';
import TallySessions from './pages/TallySessions';
import TallySessionDetail from './pages/TallySessionDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-header">
            <h1>Tally System</h1>
            <p>Admin Dashboard</p>
          </div>
          <ul className="sidebar-menu">
            <li>
              <Link to="/">Dashboard</Link>
            </li>
            <li>
              <Link to="/customers">Customers</Link>
            </li>
            <li>
              <Link to="/plants">Plants</Link>
            </li>
            <li>
              <Link to="/weight-classifications">Weight Classifications</Link>
            </li>
            <li>
              <Link to="/tally-sessions">Tally Sessions</Link>
            </li>
          </ul>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/plants" element={<Plants />} />
            <Route path="/weight-classifications" element={<WeightClassifications />} />
            <Route path="/tally-sessions" element={<TallySessions />} />
            <Route path="/tally-sessions/:id" element={<TallySessionDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

