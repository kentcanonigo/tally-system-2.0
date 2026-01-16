import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { customersApi, plantsApi, tallySessionsApi, exportApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTimezone } from '../hooks/useTimezone';
import { formatDate } from '../utils/dateFormat';
import { generateSessionReportPDF } from '../utils/pdfGenerator';
import { generateTallySheetPDF } from '../utils/tallySheetPdfGenerator';
import { generateTallySheetExcel } from '../utils/tallySheetExcelGenerator';
import type { Customer, Plant, TallySession, TallyLogEntryRole } from '../types';
import { TallyLogEntryRole as RoleEnum } from '../types';

// Type for react-calendar's onChange value
type CalendarValue = Date | [Date, Date] | [Date | null, Date | null] | null;

function TallySessions() {
  const { user, hasPermission } = useAuth();
  const timezone = useTimezone();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [allSessions, setAllSessions] = useState<TallySession[]>([]); // Store all sessions for filtering
  const [sessionDates, setSessionDates] = useState<string[]>([]); // Store dates that have sessions
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
  const [sortBy, setSortBy] = useState<'date' | 'id' | 'session_number' | 'status' | 'created_at' | 'updated_at'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showTallySheetFormatModal, setShowTallySheetFormatModal] = useState(false);
  const [showAllocationReportRoleModal, setShowAllocationReportRoleModal] = useState(false);
  const [exportRole, setExportRole] = useState<TallyLogEntryRole>(RoleEnum.TALLY);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch session dates when calendar is opened
  useEffect(() => {
    if (showCalendar) {
      fetchSessionDates();
    }
  }, [showCalendar, filters]);

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
    fetchSessions(1);
  }, [filters]);

  useEffect(() => {
    fetchSessions(currentPage);
  }, [currentPage, itemsPerPage]);

  // Sort sessions function
  const sortSessions = useCallback((sessionsToSort: TallySession[]): TallySession[] => {
    const sorted = [...sessionsToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'session_number':
          aValue = a.session_number;
          bValue = b.session_number;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [sortBy, sortOrder]);

  // Helper function to format a Date object as YYYY-MM-DD in local timezone (no UTC conversion)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filter and sort sessions by selected date
  useEffect(() => {
    let filtered = allSessions;
    
    if (selectedDate) {
      const dateStr = formatDateLocal(selectedDate);
      filtered = allSessions.filter((session) => {
        // session.date is already a YYYY-MM-DD string from the backend
        const sessionDate = session.date;
        return sessionDate === dateStr;
      });
    }
    
    const sorted = sortSessions(filtered);
    setSessions(sorted);
  }, [selectedDate, allSessions, sortSessions]);

  // Reset to page 1 when date filter changes
  useEffect(() => {
    if (selectedDate !== null) {
      setCurrentPage(1);
    }
  }, [selectedDate]);

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

  const fetchSessionDates = async () => {
    try {
      const params: any = {};
      if (filters.customer_id) params.customer_id = Number(filters.customer_id);
      if (filters.plant_id) params.plant_id = Number(filters.plant_id);
      if (filters.status) params.status = filters.status;

      const response = await tallySessionsApi.getDates(params);
      setSessionDates(response.data);
    } catch (error) {
      console.error('Error fetching session dates:', error);
      setSessionDates([]);
    }
  };

  const fetchSessions = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.customer_id) params.customer_id = Number(filters.customer_id);
      if (filters.plant_id) params.plant_id = Number(filters.plant_id);
      if (filters.status) params.status = filters.status;

      // Add pagination parameters
      const skip = (page - 1) * itemsPerPage;
      const limit = itemsPerPage + 1; // Fetch one extra to check if there are more pages
      params.skip = skip;
      params.limit = limit;

      const response = await tallySessionsApi.getAll(params);
      const fetchedSessions = response.data;
      
      // Check if there are more pages
      const hasMore = fetchedSessions.length > itemsPerPage;
      if (hasMore) {
        fetchedSessions.pop(); // Remove the extra item
      }
      setHasMorePages(hasMore);
      
      setAllSessions(fetchedSessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      alert('Error fetching tally sessions');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId: number, sessionNumber?: number) => {
    const customerName = customers.find((c) => c.id === customerId)?.name || customerId;
    if (sessionNumber !== undefined) {
      return `${customerName} (#${sessionNumber})`;
    }
    return customerName;
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
      const dateStr = formatDateLocal(date);
      const hasSessions = sessionDates.includes(dateStr);
      if (hasSessions) {
        return <div style={{ height: '4px', width: '4px', backgroundColor: '#db2175', borderRadius: '50%', margin: '2px auto' }} />;
      }
    }
    return null;
  };

  // Mark dates with sessions
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = formatDateLocal(date);
      const hasSessions = sessionDates.includes(dateStr);
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
    
    if (selectedDate && formatDateLocal(selectedDate) === formatDateLocal(value)) {
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

  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sId => sId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === sessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sessions.map(s => s.id));
    }
  };

  const handleExport = async (role?: TallyLogEntryRole) => {
    if (selectedIds.length === 0) return;
    const selectedRole = role || exportRole;
    setExporting(true);
    setShowAllocationReportRoleModal(false);
    try {
      const response = await exportApi.exportSessions({ session_ids: selectedIds, role: selectedRole });
      const data = response.data;
      
      // Check if the report is empty
      if (!data.customers || data.customers.length === 0) {
        alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for the selected sessions.`);
        return;
      }
      
      // Check if all customers have no items
      const hasAnyItems = data.customers.some(customer => 
        customer.items && customer.items.length > 0
      );
      
      if (!hasAnyItems) {
        alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for the selected sessions.`);
        return;
      }
      
      generateSessionReportPDF(data);
    } catch (error: any) {
      console.error('Export failed', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (errorMessage.includes('No') && (errorMessage.includes('data') || errorMessage.includes('allocation'))) {
        alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for the selected sessions.`);
      } else {
        alert(`Export failed: ${errorMessage}`);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportTallySheet = async (format: 'pdf' | 'excel', role?: TallyLogEntryRole) => {
    if (selectedIds.length === 0) return;
    const selectedRole = role || exportRole;
    setExporting(true);
    setShowTallySheetFormatModal(false);
    try {
      const response = await exportApi.exportTallySheet({ session_ids: selectedIds, role: selectedRole });
      // Backend returns TallySheetMultiCustomerResponse with a customers array
      const customers = response.data.customers || [response.data];
      
      // Sort customers alphabetically by name (backend already sorts, but ensure it here too)
      const sortedCustomers = [...customers].sort((a, b) => 
        a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' })
      );
      
      // Check if any customer has tally data
      const customersWithData = sortedCustomers.filter(customer => 
        customer.pages && customer.pages.length > 0
      );
      
      if (customersWithData.length === 0) {
        alert(`Cannot export tally sheet: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} data found for the selected sessions.`);
        return;
      }
      
      // Pass all customers data to generators - always show grand total category table
      const showGrandTotal = true;
      const classificationOrder = user?.classification_order || undefined;
      if (format === 'pdf') {
        // Pass multi-customer response to generate single PDF with all customers
        generateTallySheetPDF({ customers: customersWithData }, showGrandTotal, classificationOrder);
      } else {
        // Pass multi-customer response to generate single Excel file with all customers
        await generateTallySheetExcel({ customers: customersWithData }, showGrandTotal, classificationOrder);
      }
    } catch (error: any) {
      console.error('Tally sheet export failed', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (errorMessage.includes('No tally entries found') || errorMessage.includes('No valid data found')) {
        alert(`Cannot export tally sheet: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} data found for the selected sessions.`);
      } else {
        alert(`Tally sheet export failed: ${errorMessage}`);
      }
    } finally {
      setExporting(false);
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
        {hasPermission('can_create_tally_sessions') && (
          <button 
            className="btn btn-primary" 
            onClick={handleCreate}
          >
            Create New Session
          </button>
        )}
        <button 
          className={`btn ${isSelectionMode ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setIsSelectionMode(!isSelectionMode);
            if (isSelectionMode) {
              setSelectedIds([]);
            }
          }}
        >
          {isSelectionMode ? 'Disable Selection' : 'Enable Selection'}
        </button>
        {isSelectionMode && hasPermission('can_export_data') && selectedIds.length > 0 && (
          <>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowAllocationReportRoleModal(true)}
              disabled={exporting}
              style={{ opacity: exporting ? 0.5 : 1 }}
            >
              {exporting ? 'Generating PDF...' : `Export Allocation Report (${selectedIds.length})`}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowTallySheetFormatModal(true)}
              disabled={exporting}
              style={{ opacity: exporting ? 0.5 : 1 }}
            >
              Export Tally Sheet ({selectedIds.length})
            </button>
          </>
        )}
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowCalendar(!showCalendar)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <span className="material-icons">calendar_today</span>
          {selectedDate ? `Filtered: ${formatDate(selectedDate.toISOString().split('T')[0], timezone)}` : 'Calendar'}
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
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="date">Date</option>
            <option value="id">ID</option>
            <option value="session_number">Session Number</option>
            <option value="status">Status</option>
            <option value="created_at">Created At</option>
            <option value="updated_at">Updated At</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Descending (Latest First)</option>
            <option value="asc">Ascending (Oldest First)</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
          <label>Items per Page</label>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1); // Reset to page 1 when changing items per page
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {isSelectionMode && (
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={sessions.length > 0 && selectedIds.length === sessions.length}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th>ID</th>
              <th>Customer</th>
              <th>Plant</th>
              <th>Date</th>
              <th>Status</th>
              {hasPermission('can_edit_tally_session') && <th>Change Status</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr 
                key={session.id}
                onClick={() => isSelectionMode && toggleSelection(session.id)}
                style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
              >
                {isSelectionMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(session.id)}
                      onChange={() => toggleSelection(session.id)}
                    />
                  </td>
                )}
                <td>{session.id}</td>
                <td>{getCustomerName(session.customer_id, session.session_number)}</td>
                <td>{getPlantName(session.plant_id)}</td>
                <td>{formatDate(session.date, timezone)}</td>
                <td>{getStatusBadge(session.status)}</td>
                {hasPermission('can_edit_tally_session') && (
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
                      {hasPermission('can_edit_tally_session') && (
                        <option value="ongoing">Ongoing</option>
                      )}
                      {hasPermission('can_complete_tally') && (
                        <option value="completed">Completed</option>
                      )}
                      {hasPermission('can_cancel_tally') && (
                        <option value="cancelled">Cancelled</option>
                      )}
                    </select>
                  </td>
                )}
                <td>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Link to={`/tally-sessions/${session.id}`}>
                      <button className="btn btn-primary">View Details</button>
                    </Link>
                    {hasPermission('can_delete_tally_session') && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(session.id)}
                        style={{ marginLeft: '5px' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {(sessions.length > 0 || allSessions.length > 0) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '20px',
          padding: '10px 0',
          borderTop: '1px solid #ddd'
        }}>
          <div style={{ color: '#666' }}>
            {selectedDate ? (
              <>Showing {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} matching selected date</>
            ) : (
              <>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, (currentPage - 1) * itemsPerPage + allSessions.length)} of {allSessions.length} {hasMorePages ? '+' : ''} sessions</>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading || selectedDate !== null}
              style={{ opacity: (currentPage === 1 || loading || selectedDate !== null) ? 0.5 : 1 }}
            >
              Previous
            </button>
            <span style={{ padding: '0 10px' }}>
              Page {currentPage}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={!hasMorePages || loading || selectedDate !== null}
              style={{ opacity: (!hasMorePages || loading || selectedDate !== null) ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      {sessions.length === 0 && allSessions.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          {selectedDate ? 'No sessions found for the selected date.' : 'No sessions found.'}
        </div>
      )}

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

      {showTallySheetFormatModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '300px'
          }}>
            <h3 style={{ marginTop: 0 }}>Select Export Options</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Role:</label>
              <select
                value={exportRole}
                onChange={(e) => setExportRole(e.target.value as TallyLogEntryRole)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value={RoleEnum.TALLY}>Tally-er</option>
                <option value={RoleEnum.DISPATCHER}>Dispatcher</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Format:</label>
              <p style={{ marginTop: '5px', color: '#666' }}>Choose the format for the tally sheet export:</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleExportTallySheet('pdf', exportRole)}
                disabled={exporting}
              >
                PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExportTallySheet('excel', exportRole)}
                disabled={exporting}
              >
                Excel
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowTallySheetFormatModal(false)}
                disabled={exporting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAllocationReportRoleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '300px'
          }}>
            <h3 style={{ marginTop: 0 }}>Select Role for Allocation Report</h3>
            <p style={{ marginBottom: '15px' }}>Choose which role's allocation data to export:</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Role:</label>
              <select
                value={exportRole}
                onChange={(e) => setExportRole(e.target.value as TallyLogEntryRole)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value={RoleEnum.TALLY}>Tally-er</option>
                <option value={RoleEnum.DISPATCHER}>Dispatcher</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleExport(exportRole)}
                disabled={exporting}
              >
                Export
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAllocationReportRoleModal(false)}
                disabled={exporting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TallySessions;

