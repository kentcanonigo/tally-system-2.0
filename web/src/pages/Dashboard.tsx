import { useEffect, useState } from 'react';
import { customersApi, plantsApi, tallySessionsApi } from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState({
    customers: 0,
    plants: 0,
    sessions: 0,
    ongoingSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [customersRes, plantsRes, sessionsRes] = await Promise.all([
          customersApi.getAll(),
          plantsApi.getAll(),
          tallySessionsApi.getAll(),
        ]);

        const sessions = sessionsRes.data;
        const ongoingSessions = sessions.filter(s => s.status === 'ongoing').length;

        setStats({
          customers: customersRes.data.length,
          plants: plantsRes.data.length,
          sessions: sessions.length,
          ongoingSessions,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your tally system</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="table-container" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '10px', color: '#2c3e50' }}>Total Customers</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#db2175' }}>{stats.customers}</p>
        </div>
        <div className="table-container" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '10px', color: '#2c3e50' }}>Total Plants</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#27ae60' }}>{stats.plants}</p>
        </div>
        <div className="table-container" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '10px', color: '#2c3e50' }}>Total Sessions</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#9b59b6' }}>{stats.sessions}</p>
        </div>
        <div className="table-container" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '10px', color: '#2c3e50' }}>Ongoing Sessions</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#f39c12' }}>{stats.ongoingSessions}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

