import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { customersApi, plantsApi, tallySessionsApi } from '../services/api';
import type { Customer, Plant, TallySession } from '../types';

// Type for react-calendar's onChange value
type CalendarValue = Date | [Date, Date] | [Date | null, Date | null] | null;

function TallySessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [allSessions, setAllSessions] = useState<TallySession[]>([]); // Store all sessions for filtering
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    plant_id: '',
    date: new Date().toISOString().split('T')[0], // Today's date as default
    status: 'ongoing',
  });
  const [filters, setFilters] = useState({
    customer_id: '',
    plant_id: '',
    status: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [filters]);

  // Filter sessions by selected date
  useEffect(() => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const filtered = allSessions.filter((session) => {
        const sessionDate = new Date(session.date).toISOString().split('T')[0];
        return sessionDate === dateStr;
      });
      setSessions(filtered);
    } else {
      setSessions(allSessions);
    }
  }, [selectedDate, allSessions]);

  const fetchData = async () => {
    try {
      const [customersRes, plantsRes] = await Promise.all([
        customersApi.getAll(),
        plantsApi.getAll(),
      ]);
      setCustomers(customersRes.data);
      setPlants(plantsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.customer_id) params.customer_id = Number(filters.customer_id);
      if (filters.plant_id) params.plant_id = Number(filters.plant_id);
      if (filters.status) params.status = filters.status;

      const response = await tallySessionsApi.getAll(params);
      setAllSessions(response.data);
      // Apply date filter if selected
      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const filtered = response.data.filter((session) => {
          const sessionDate = new Date(session.date).toISOString().split('T')[0];
          return sessionDate === dateStr;
        });
        setSessions(filtered);
      } else {
        setSessions(response.data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      alert('Error fetching tally sessions');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId: number) => {
    return customers.find((c) => c.id === customerId)?.name || customerId;
  };

  const getPlantName = (plantId: number) => {
    return plants.find((p) => p.id === plantId)?.name || plantId;
  };

  const getStatusBadge = (status: string) => {
    return <span className={`status-badge status-${status}`}>{status}</span>;
  };

  // Create tile content for calendar to mark dates with sessions
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = date.toISOString().split('T')[0];
      const hasSessions = allSessions.some((session) => {
        const sessionDate = new Date(session.date).toISOString().split('T')[0];
        return sessionDate === dateStr;
      });
      if (hasSessions) {
        return <div style={{ height: '4px', width: '4px', backgroundColor: '#3498db', borderRadius: '50%', margin: '2px auto' }} />;
      }
    }
    return null;
  };

  // Mark dates with sessions
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = date.toISOString().split('T')[0];
      const hasSessions = allSessions.some((session) => {
        const sessionDate = new Date(session.date).toISOString().split('T')[0];
        return sessionDate === dateStr;
      });
      if (hasSessions) {
        return 'has-sessions';
      }
    }
    return null;
  };

  const handleDateChange = (value: CalendarValue, _event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (!value || Array.isArray(value)) {
      // Handle null or date range (we only support single date selection)
      setSelectedDate(null);
      return;
    }
    
    // Value should be Date at this point
    if (!(value instanceof Date)) {
      setSelectedDate(null);
      return;
    }
    
    if (selectedDate && selectedDate.toISOString().split('T')[0] === value.toISOString().split('T')[0]) {
      // If same date clicked, clear filter
      setSelectedDate(null);
    } else {
      setSelectedDate(value);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    setShowCalendar(false);
  };

  const handleDelete = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this tally session? This action cannot be undone.')) {
      return;
    }

    try {
      await tallySessionsApi.delete(sessionId);
      // Refresh the sessions list
      fetchSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      alert(error.response?.data?.detail || 'Error deleting tally session');
    }
  };

  const handleStatusChange = async (sessionId: number, newStatus: string) => {
    try {
      await tallySessionsApi.update(sessionId, { status: newStatus as any });
      // Refresh the sessions list
      fetchSessions();
    } catch (error: any) {
      console.error('Error updating session status:', error);
      alert(error.response?.data?.detail || 'Error updating session status');
    }
  };

  const handleCreate = () => {
    setFormData({
      customer_id: '',
      plant_id: '',
      date: new Date().toISOString().split('T')[0],
      status: 'ongoing',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await tallySessionsApi.create({
        customer_id: Number(formData.customer_id),
        plant_id: Number(formData.plant_id),
        date: formData.date,
        status: formData.status as any,
      });
      setShowModal(false);
      // Navigate to the newly created session detail page
      navigate(`/tally-sessions/${response.data.id}`);
    } catch (error: any) {
      console.error('Error creating session:', error);
      alert(error.response?.data?.detail || 'Error creating tally session');
    }
  };

  if (loading && sessions.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Tally Sessions</h1>
        <p>View and manage tally sessions</p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleCreate}>
          Create New Session
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowCalendar(!showCalendar)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <span className="material-icons">calendar_today</span>
          {selectedDate ? `Filtered: ${selectedDate.toLocaleDateString()}` : 'Calendar'}
        </button>
        {selectedDate && (
          <button className="btn btn-secondary" onClick={clearDateFilter}>
            Clear Date Filter
          </button>
        )}
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Filter by Customer</label>
          <select
            value={filters.customer_id}
            onChange={(e) => setFilters({ ...filters, customer_id: e.target.value })}
          >
            <option value="">All Customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Filter by Plant</label>
          <select
            value={filters.plant_id}
            onChange={(e) => setFilters({ ...filters, plant_id: e.target.value })}
          >
            <option value="">All Plants</option>
            {plants.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Filter by Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Plant</th>
              <th>Date</th>
              <th>Status</th>
              <th>Change Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.id}</td>
                <td>{getCustomerName(session.customer_id)}</td>
                <td>{getPlantName(session.plant_id)}</td>
                <td>{new Date(session.date).toLocaleDateString()}</td>
                <td>{getStatusBadge(session.status)}</td>
                <td>
                  <select
                    value={session.status}
                    onChange={(e) => handleStatusChange(session.id, e.target.value)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Link to={`/tally-sessions/${session.id}`}>
                      <button className="btn btn-primary">View Details</button>
                    </Link>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(session.id)}
                      style={{ marginLeft: '5px' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Tally Session</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Customer</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Plant</label>
                <select
                  value={formData.plant_id}
                  onChange={(e) => setFormData({ ...formData, plant_id: e.target.value })}
                  required
                >
                  <option value="">Select a plant</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCalendar && (
        <div className="modal" onClick={() => setShowCalendar(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Select Date</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Calendar
                onChange={handleDateChange}
                value={selectedDate || undefined}
                tileContent={tileContent}
                tileClassName={tileClassName}
                className="tally-calendar"
              />
              {selectedDate && (
                <button 
                  className="btn btn-secondary" 
                  onClick={clearDateFilter}
                  style={{ marginTop: '15px' }}
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TallySessions;

