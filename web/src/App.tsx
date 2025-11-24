import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Plants from './pages/Plants';
import WeightClassifications from './pages/WeightClassifications';
import TallySessions from './pages/TallySessions';
import TallySessionDetail from './pages/TallySessionDetail';
import TallySessionLogs from './pages/TallySessionLogs';
import Settings from './pages/Settings';
import ExportPage from './pages/ExportPage';
import Users from './pages/Users';
import './App.css';

// Protected Route Component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Superadmin Only Route Component
function SuperadminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperadmin, loading } = useAuth();

  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }

  if (!isSuperadmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Main Layout with Sidebar
function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1>Tally System</h1>
          <p>Admin Dashboard</p>
          {user && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '5px',
              fontSize: '0.85rem'
            }}>
              <p style={{ margin: '0 0 5px 0', color: '#fff' }}>
                <strong>{user.username}</strong>
              </p>
              <p style={{ margin: 0, color: '#ddd', textTransform: 'capitalize' }}>
                {user.role}
              </p>
            </div>
          )}
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
          <li>
            <Link to="/export">Export</Link>
          </li>
          {user?.role === 'superadmin' && (
            <li>
              <Link to="/users">User Management</Link>
            </li>
          )}
          <li>
            <Link to="/settings">Settings</Link>
          </li>
          <li style={{ marginTop: '20px' }}>
            <button 
              onClick={logout}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Logout
            </button>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/plants" element={<Plants />} />
                    <Route path="/weight-classifications" element={<WeightClassifications />} />
                    <Route path="/tally-sessions" element={<TallySessions />} />
                    <Route path="/tally-sessions/:id" element={<TallySessionDetail />} />
                    <Route path="/tally-sessions/:id/logs" element={<TallySessionLogs />} />
                    <Route path="/export" element={<ExportPage />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route
                      path="/users"
                      element={
                        <SuperadminRoute>
                          <Users />
                        </SuperadminRoute>
                      }
                    />
                  </Routes>
                </MainLayout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

