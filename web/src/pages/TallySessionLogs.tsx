import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tallySessionsApi, customersApi, plantsApi, weightClassificationsApi, tallyLogEntriesApi } from '../services/api';
import type { TallySession, Customer, Plant, WeightClassification, TallyLogEntry, TallyLogEntryAudit } from '../types';
import { TallyLogEntryRole } from '../types';
import { getAcceptableDifferenceThreshold } from '../utils/settings';
import { useAuth } from '../contexts/AuthContext';
import { useTimezone } from '../hooks/useTimezone';
import { formatDate, formatDateTime } from '../utils/dateFormat';

function TallySessionLogs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const timezone = useTimezone();
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [logEntries, setLogEntries] = useState<TallyLogEntry[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    role: TallyLogEntryRole | 'all';
    weight_classification_id: number | 'all';
    category: 'Dressed' | 'Byproduct' | 'Frozen' | 'all';
  }>({
    role: 'all',
    weight_classification_id: 'all',
    category: 'all',
  });
  const [sortBy, setSortBy] = useState<'class' | 'weight' | 'time' | 'id'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [threshold, setThreshold] = useState<number>(0);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [availableSessions, setAvailableSessions] = useState<TallySession[]>([]);
  const [selectedTargetCustomerId, setSelectedTargetCustomerId] = useState<number | null>(null);
  const [selectedTargetSessionId, setSelectedTargetSessionId] = useState<number | null>(null);
  const [loadingTransferData, setLoadingTransferData] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TallyLogEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    weight: 0,
    role: TallyLogEntryRole.TALLY,
    heads: 0,
    notes: '',
    weight_classification_id: 0,
  });
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedEntryForAudit, setSelectedEntryForAudit] = useState<TallyLogEntry | null>(null);
  const [auditHistory, setAuditHistory] = useState<TallyLogEntryAudit[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [pageSize, setPageSize] = useState<number | null>(50); // Default 50, null means "All"
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchData();
    }
    // Load threshold from localStorage
    setThreshold(getAcceptableDifferenceThreshold());
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const sessionRes = await tallySessionsApi.getById(Number(id));
      const sessionData = sessionRes.data;
      setSession(sessionData);

      // Fetch all entries (needed for client-side filtering)
      // TODO: Optimize to use server-side pagination when no filters are applied
      const [customerRes, plantRes, entriesRes, wcRes] = await Promise.all([
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        tallyLogEntriesApi.getBySession(Number(id)),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ]);

      setCustomer(customerRes.data);
      setPlant(plantRes.data);
      // Handle paginated response structure
      const entriesData = entriesRes.data;
      const entries = entriesData.entries || entriesData || [];
      const total = entriesData.total !== undefined ? entriesData.total : entries.length;
      setLogEntries(Array.isArray(entries) ? entries : []);
      setTotalCount(total);
      setWeightClassifications(wcRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error fetching session logs');
    } finally {
      setLoading(false);
    }
  };

  const getWeightClassificationName = (wcId: number) => {
    return weightClassifications.find((wc) => wc.id === wcId)?.classification || wcId;
  };

  // Helper function to get color based on difference and threshold
  const getDifferenceColor = (difference: number, isNotStarted: boolean): string => {
    if (isNotStarted) {
      return '#666';
    }
    if (difference === 0) {
      return '#27ae60'; // Green for exact match
    }
    const absDifference = Math.abs(difference);
    if (absDifference <= threshold) {
      return '#f39c12'; // Orange for acceptable difference
    }
    return '#e74c3c'; // Red for unacceptable difference
  };

  const formatWeightRange = (wc: WeightClassification): string => {
    // For Byproduct with both weights null, show N/A
    if (wc.category === 'Byproduct' && wc.min_weight === null && wc.max_weight === null) {
      return 'N/A';
    }
    // For Dressed/Frozen with both weights null, show Custom (manual input only)
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'Custom';
    }
    if (wc.min_weight === null && wc.max_weight !== null) {
      return `Up to ${wc.max_weight}`;
    }
    if (wc.max_weight === null) {
      return `${wc.min_weight} and up`;
    }
    return `${wc.min_weight}-${wc.max_weight}`;
  };

  // Filter and sort log entries based on current filters and sort settings
  const filteredEntries = useMemo(() => {
    if (!Array.isArray(logEntries) || logEntries.length === 0) {
      return [];
    }
    let filtered = logEntries.filter((entry) => {
      if (filters.role !== 'all' && entry.role !== filters.role) {
        return false;
      }
      if (filters.weight_classification_id !== 'all' && entry.weight_classification_id !== filters.weight_classification_id) {
        return false;
      }
      if (filters.category !== 'all') {
        const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
        if (!wc || wc.category !== filters.category) {
          return false;
        }
      }
      return true;
    });

    // Sort the filtered entries
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      let timeComparison = 0;
      
      switch (sortBy) {
        case 'class':
          const aWc = weightClassifications.find((wc) => wc.id === a.weight_classification_id);
          const bWc = weightClassifications.find((wc) => wc.id === b.weight_classification_id);
          const aClass = aWc?.classification || '';
          const bClass = bWc?.classification || '';
          comparison = aClass.localeCompare(bClass);
          break;
        case 'weight':
          comparison = a.weight - b.weight;
          break;
        case 'time':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'id':
          comparison = a.id - b.id;
          break;
      }
      
      // Secondary sort by time (descending - newest first) if primary comparison is equal and time is not the primary sort
      if (comparison === 0 && sortBy !== 'time') {
        timeComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Descending order
        return timeComparison;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [logEntries, filters, sortBy, sortOrder, weightClassifications]);

  // Paginate filtered entries
  const paginatedEntries = useMemo(() => {
    if (pageSize === null) {
      return filteredEntries; // Show all
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredEntries.slice(startIndex, endIndex);
  }, [filteredEntries, pageSize, currentPage]);

  const totalPages = useMemo(() => {
    if (pageSize === null) return 1;
    return Math.ceil(filteredEntries.length / pageSize);
  }, [filteredEntries.length, pageSize]);

  // Reset to first page when filters or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.role, filters.weight_classification_id, filters.category, sortBy, sortOrder]);

  // Calculate aggregations by weight classification
  const aggregations = useMemo(() => {
    const agg: Record<number, { tally: number; dispatcher: number; classification: string }> = {};

    filteredEntries.forEach((entry) => {
      if (!agg[entry.weight_classification_id]) {
        const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
        agg[entry.weight_classification_id] = {
          tally: 0,
          dispatcher: 0,
          classification: wc?.classification || `WC ${entry.weight_classification_id}`,
        };
      }

      if (entry.role === TallyLogEntryRole.TALLY) {
        agg[entry.weight_classification_id].tally += entry.weight;
      } else if (entry.role === TallyLogEntryRole.DISPATCHER) {
        agg[entry.weight_classification_id].dispatcher += entry.weight;
      }
    });

    return Object.entries(agg).map(([wcId, data]) => ({
      weight_classification_id: Number(wcId),
      ...data,
      difference: data.tally - data.dispatcher,
    }));
  }, [filteredEntries, weightClassifications]);

  // Calculate overall totals
  const overallTotals = useMemo(() => {
    const totals = filteredEntries.reduce(
      (acc, entry) => {
        if (entry.role === TallyLogEntryRole.TALLY) {
          acc.tally += entry.weight;
        } else if (entry.role === TallyLogEntryRole.DISPATCHER) {
          acc.dispatcher += entry.weight;
        }
        return acc;
      },
      { tally: 0, dispatcher: 0 }
    );
    return {
      ...totals,
      difference: totals.tally - totals.dispatcher,
    };
  }, [filteredEntries]);

  const loadTransferData = async () => {
    if (!plant) return;
    setLoadingTransferData(true);
    try {
      const customersRes = await customersApi.getAll();
      setAvailableCustomers(customersRes.data);
      setSelectedTargetCustomerId(null);
      setSelectedTargetSessionId(null);
      setAvailableSessions([]);
    } catch (error) {
      console.error('Error loading transfer data:', error);
      alert('Error loading customers');
    } finally {
      setLoadingTransferData(false);
    }
  };

  const loadSessionsForCustomer = async (customerId: number) => {
    if (!plant) return;
    try {
      const sessionsRes = await tallySessionsApi.getAll({
        customer_id: customerId,
        plant_id: plant.id,
        status: 'ongoing',
      });
      // Filter out the current session and only show ongoing sessions
      setAvailableSessions(sessionsRes.data.filter(s => s.id !== Number(id) && s.status === 'ongoing'));
      setSelectedTargetSessionId(null);
    } catch (error) {
      console.error('Error loading sessions:', error);
      alert('Error loading sessions');
    }
  };

  const handleTransfer = async () => {
    if (selectedEntryIds.size === 0) {
      alert('Please select entries to transfer');
      return;
    }
    
    if (!selectedTargetSessionId) {
      alert('Please select a target session');
      return;
    }
    
    if (!hasPermission('can_transfer_tally_log_entries')) {
      alert('Permission Denied: You do not have permission to transfer tally log entries.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await tallyLogEntriesApi.transfer(Array.from(selectedEntryIds), selectedTargetSessionId);
      alert(`Successfully transferred ${response.data.count} log entries`);
      setShowTransferModal(false);
      setSelectionMode(false);
      setSelectedEntryIds(new Set());
      setSelectedTargetCustomerId(null);
      setSelectedTargetSessionId(null);
      setAvailableSessions([]);
      fetchData();
    } catch (error: any) {
      console.error('Error transferring logs:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to transfer log entries';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntrySelection = (entryId: number) => {
    const newSelection = new Set(selectedEntryIds);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntryIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedEntryIds.size === filteredEntries.length) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!hasPermission('can_delete_tally_log_entries')) {
      alert('Permission Denied: You do not have permission to delete tally log entries.');
      return;
    }

    if (!confirm('Are you sure you want to delete this log entry? This action cannot be undone and will update the allocation counts.')) {
      return;
    }

    setLoading(true);
    try {
      await tallyLogEntriesApi.delete(entryId);
      alert('Log entry deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting log entry:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete log entry';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEntryIds.size === 0) {
      alert('Please select entries to delete');
      return;
    }

    if (!hasPermission('can_delete_tally_log_entries')) {
      alert('Permission Denied: You do not have permission to delete tally log entries.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedEntryIds.size} log entry/entries? This action cannot be undone and will update the allocation counts.`)) {
      return;
    }

    setLoading(true);
    try {
      // Delete entries one by one (backend doesn't support bulk delete)
      const deletePromises = Array.from(selectedEntryIds).map(id => tallyLogEntriesApi.delete(id));
      await Promise.all(deletePromises);
      alert(`Successfully deleted ${selectedEntryIds.size} log entry/entries`);
      setSelectionMode(false);
      setSelectedEntryIds(new Set());
      fetchData();
    } catch (error: any) {
      console.error('Error deleting log entries:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete log entries';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEntry = (entry: TallyLogEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      weight: entry.weight,
      role: entry.role,
      heads: entry.heads || 0,
      notes: entry.notes || '',
      weight_classification_id: entry.weight_classification_id,
    });
    setShowEditModal(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

    if (!hasPermission('can_edit_tally_log_entries')) {
      alert('Permission Denied: You do not have permission to edit tally log entries.');
      return;
    }

    setLoading(true);
    try {
      // Only send fields that have changed
      const updateData: any = {};
      if (editFormData.weight !== editingEntry.weight) {
        updateData.weight = editFormData.weight;
      }
      if (editFormData.role !== editingEntry.role) {
        updateData.role = editFormData.role;
      }
      if (editFormData.heads !== (editingEntry.heads || 0)) {
        updateData.heads = editFormData.heads;
      }
      if (editFormData.notes !== (editingEntry.notes || '')) {
        updateData.notes = editFormData.notes || null;
      }
      if (editFormData.weight_classification_id !== editingEntry.weight_classification_id) {
        updateData.weight_classification_id = editFormData.weight_classification_id;
      }

      await tallyLogEntriesApi.update(editingEntry.id, updateData);
      alert('Log entry updated successfully');
      setShowEditModal(false);
      setEditingEntry(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating log entry:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update log entry';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditHistory = async (entry: TallyLogEntry) => {
    setSelectedEntryForAudit(entry);
    setLoadingAudit(true);
    setShowAuditModal(true);
    try {
      const response = await tallyLogEntriesApi.getAuditHistory(entry.id);
      setAuditHistory(response.data);
    } catch (error: any) {
      console.error('Error loading audit history:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load audit history';
      alert(`Error: ${errorMessage}`);
      setShowAuditModal(false);
    } finally {
      setLoadingAudit(false);
    }
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      'weight': 'Weight',
      'role': 'Role',
      'heads': 'Heads',
      'notes': 'Notes',
      'weight_classification': 'Weight Classification',
      'tally_session': 'Tally Session',
    };
    return fieldMap[fieldName] || fieldName;
  };

  const formatFieldValue = (fieldName: string, value: any): string => {
    if (value === null || value === undefined) {
      return '(empty)';
    }
    if (fieldName === 'role') {
      return value === 'tally' ? 'Tally-er' : 'Dispatcher';
    }
    if (fieldName === 'weight') {
      return `${value} kg`;
    }
    if (fieldName === 'heads') {
      return value.toString();
    }
    return String(value);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Session not found</div>;
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate(`/tally-sessions/${id}`)} style={{ marginBottom: '20px' }}>
          ← Back to Session Details
        </button>
        <h1>{customer?.name || 'Unknown'} - Session #{session.session_number} - {formatDate(session.date, timezone)}</h1>
        <p>
          Plant: {plant?.name}
        </p>
        <p>
          Status: <span className={`status-badge status-${session.status}`}>{session.status}</span>
        </p>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Filter by Role:</label>
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value as TallyLogEntryRole | 'all' })}
            style={{ padding: '8px', minWidth: '150px' }}
          >
            <option value="all">All Roles</option>
            <option value={TallyLogEntryRole.TALLY}>Tally-er</option>
            <option value={TallyLogEntryRole.DISPATCHER}>Dispatcher</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Filter by Weight Class:</label>
          <select
            value={filters.weight_classification_id}
            onChange={(e) =>
              setFilters({
                ...filters,
                weight_classification_id: e.target.value === 'all' ? 'all' : Number(e.target.value),
              })
            }
            style={{ padding: '8px', minWidth: '200px' }}
          >
            <option value="all">All Weight Classes</option>
            {weightClassifications.map((wc) => (
              <option key={wc.id} value={wc.id}>
                {wc.classification} - {formatWeightRange(wc)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Filter by Category:</label>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({
                ...filters,
                category: e.target.value as 'Dressed' | 'Byproduct' | 'Frozen' | 'all',
              })
            }
            style={{ padding: '8px', minWidth: '150px' }}
          >
            <option value="all">All Categories</option>
            <option value="Dressed">Dressed</option>
            <option value="Frozen">Frozen</option>
            <option value="Byproduct">Byproduct</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Sort By:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'class' | 'weight' | 'time' | 'id')}
            style={{ padding: '8px', minWidth: '150px' }}
          >
            <option value="time">Time</option>
            <option value="class">Class</option>
            <option value="weight">Weight</option>
            <option value="id">ID</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Order:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            style={{ padding: '8px', minWidth: '120px' }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Aggregation Summary */}
      <div style={{ marginBottom: '30px' }}>
        <h2>Aggregation Summary</h2>
        <div className="table-container" style={{ marginBottom: '20px' }}>
          <table>
            <thead>
              <tr>
                <th>Weight Classification</th>
                <th>Tally-er Total</th>
                <th>Dispatcher Total</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {aggregations.length > 0 ? (
                aggregations.map((agg) => {
                  const isNotStarted = agg.tally === 0 && agg.dispatcher === 0;
                  const diffColor = getDifferenceColor(agg.difference, isNotStarted);
                  return (
                    <tr key={agg.weight_classification_id}>
                      <td>{agg.classification}</td>
                      <td>{agg.tally.toFixed(2)}</td>
                      <td>{agg.dispatcher.toFixed(2)}</td>
                      <td
                        style={{
                          color: diffColor,
                          fontWeight: agg.difference === 0 && !isNotStarted ? 'normal' : 'bold',
                        }}
                      >
                        {isNotStarted ? 'Not started' : (agg.difference === 0 ? 'Match' : agg.difference.toFixed(2))}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }}>
                    No entries found
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                <td>Overall Total</td>
                <td>{overallTotals.tally.toFixed(2)}</td>
                <td>{overallTotals.dispatcher.toFixed(2)}</td>
                <td
                  style={{
                    color: getDifferenceColor(overallTotals.difference, overallTotals.tally === 0 && overallTotals.dispatcher === 0),
                  }}
                >
                  {(overallTotals.tally === 0 && overallTotals.dispatcher === 0) ? 'Not started' : (overallTotals.difference === 0 ? 'Match' : overallTotals.difference.toFixed(2))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Log Entries Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <h2>Log Entries ({filteredEntries.length})</h2>
          {(hasPermission('can_edit_tally_log_entries') || hasPermission('can_delete_tally_log_entries') || hasPermission('can_transfer_tally_log_entries')) && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {!selectionMode ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectionMode(true);
                    setSelectedEntryIds(new Set());
                  }}
                >
                  Select Entries
                </button>
              ) : (
                <>
                  {hasPermission('can_transfer_tally_log_entries') && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setShowTransferModal(true);
                        loadTransferData();
                      }}
                      disabled={selectedEntryIds.size === 0}
                      style={{ opacity: selectedEntryIds.size === 0 ? 0.5 : 1 }}
                    >
                      Transfer Selected ({selectedEntryIds.size})
                    </button>
                  )}
                  {hasPermission('can_delete_tally_log_entries') && (
                    <button
                      className="btn btn-danger"
                      onClick={handleDeleteSelected}
                      disabled={selectedEntryIds.size === 0}
                      style={{ 
                        opacity: selectedEntryIds.size === 0 ? 0.5 : 1,
                        backgroundColor: '#dc3545',
                        color: 'white'
                      }}
                    >
                      Delete Selected ({selectedEntryIds.size})
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedEntryIds(new Set());
                    }}
                  >
                    Cancel Selection
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {filteredEntries.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Items per page:</label>
              <select
                value={pageSize === null ? 'all' : pageSize.toString()}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? null : parseInt(e.target.value);
                  setPageSize(value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '0.9rem',
                }}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="all">All</option>
              </select>
            </div>
            
            {pageSize !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredEntries.length)} of {filteredEntries.length}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: currentPage === 1 ? '#bdc3c7' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                >
                  ‹ Prev
                </button>
                <span style={{ fontSize: '0.9rem' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: currentPage === totalPages ? '#bdc3c7' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                  }}
                >
                  Next ›
                </button>
              </div>
            )}
            
            {pageSize === null && (
              <span style={{ fontSize: '0.9rem' }}>
                Showing all {filteredEntries.length} entries
              </span>
            )}
          </div>
        )}
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {selectionMode && (
                  <th style={{ width: '50px' }}>
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.size === filteredEntries.length && filteredEntries.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th>ID</th>
                <th>Role</th>
                <th>Weight Classification</th>
                <th>Description</th>
                <th>Category</th>
                <th>Weight Range</th>
                <th>Weight</th>
                <th>Heads</th>
                <th>Notes</th>
                <th>Timestamp</th>
                {(hasPermission('can_edit_tally_log_entries') || hasPermission('can_delete_tally_log_entries')) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((entry) => {
                  const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
                  const isTransferred = entry.original_session_id !== null && entry.original_session_id !== undefined;
                  const isSelected = selectedEntryIds.has(entry.id);
                  return (
                    <tr 
                      key={entry.id}
                      style={{
                        ...(isTransferred ? { backgroundColor: '#ffe0b2' } : {}),
                        ...(isSelected && selectionMode ? { backgroundColor: '#cfe2ff' } : {}),
                        cursor: selectionMode ? 'pointer' : 'default'
                      }}
                      onClick={() => selectionMode && toggleEntrySelection(entry.id)}
                    >
                      {selectionMode && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEntrySelection(entry.id)}
                          />
                        </td>
                      )}
                      <td>{entry.id}</td>
                      <td>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: entry.role === TallyLogEntryRole.TALLY ? '#db2175' : '#9b59b6',
                            color: 'white',
                            fontSize: '12px',
                          }}
                        >
                          {entry.role === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher'}
                        </span>
                      </td>
                      <td>{getWeightClassificationName(entry.weight_classification_id)}</td>
                      <td>{wc?.description || '-'}</td>
                      <td>{wc?.category || '-'}</td>
                      <td>{wc ? formatWeightRange(wc) : '-'}</td>
                      <td>{entry.weight.toFixed(2)}</td>
                      <td>{entry.heads !== undefined && entry.heads !== null ? entry.heads.toFixed(0) : '-'}</td>
                      <td>{entry.notes || '-'}</td>
                      <td>{formatDateTime(entry.created_at, timezone)}</td>
                      {(hasPermission('can_edit_tally_log_entries') || hasPermission('can_delete_tally_log_entries')) && (
                        <td>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {hasPermission('can_edit_tally_log_entries') && (
                              <button
                                className="btn btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditEntry(entry);
                                }}
                                disabled={loading}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              className="btn btn-info"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadAuditHistory(entry);
                              }}
                              disabled={loading || loadingAudit}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                backgroundColor: '#17a2b8',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: (loading || loadingAudit) ? 'not-allowed' : 'pointer'
                              }}
                            >
                              History
                            </button>
                            {hasPermission('can_delete_tally_log_entries') && (
                              <button
                                className="btn btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEntry(entry.id);
                                }}
                                disabled={loading}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={selectionMode ? ((hasPermission('can_edit_tally_log_entries') || hasPermission('can_delete_tally_log_entries')) ? 12 : 11) : ((hasPermission('can_edit_tally_log_entries') || hasPermission('can_delete_tally_log_entries')) ? 11 : 10)} style={{ textAlign: 'center' }}>
                    No log entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
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
            minWidth: '400px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Transfer Log Entries</h3>
            <p style={{ marginBottom: '20px' }}>
              Transfer {selectedEntryIds.size} selected log entry/entries to another session.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Target Customer:
              </label>
              <select
                value={selectedTargetCustomerId || ''}
                onChange={(e) => {
                  const customerId = e.target.value ? Number(e.target.value) : null;
                  setSelectedTargetCustomerId(customerId);
                  if (customerId) {
                    loadSessionsForCustomer(customerId);
                  } else {
                    setAvailableSessions([]);
                    setSelectedTargetSessionId(null);
                  }
                }}
                disabled={loadingTransferData}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value="">Select a customer...</option>
                {availableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Target Session:
              </label>
              <select
                value={selectedTargetSessionId || ''}
                onChange={(e) => setSelectedTargetSessionId(e.target.value ? Number(e.target.value) : null)}
                disabled={!selectedTargetCustomerId || availableSessions.length === 0}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  opacity: !selectedTargetCustomerId || availableSessions.length === 0 ? 0.6 : 1
                }}
              >
                <option value="">
                  {!selectedTargetCustomerId 
                    ? 'Select a customer first...' 
                    : availableSessions.length === 0 
                    ? 'No ongoing sessions available for this customer'
                    : 'Select a session...'}
                </option>
                {availableSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    Session #{session.session_number} - {formatDate(session.date, timezone)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ 
              padding: '10px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#666'
            }}>
              <strong>Note:</strong> Entries can only be transferred to ongoing sessions in the same plant.
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedTargetCustomerId(null);
                  setSelectedTargetSessionId(null);
                  setAvailableSessions([]);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleTransfer}
                disabled={loading || !selectedTargetSessionId || selectedEntryIds.size === 0}
                style={{ 
                  opacity: (!selectedTargetSessionId || selectedEntryIds.size === 0) ? 0.5 : 1 
                }}
              >
                {loading ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingEntry && (
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
            minWidth: '400px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Edit Log Entry</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Weight Classification:
              </label>
              <select
                value={editFormData.weight_classification_id}
                onChange={(e) => setEditFormData({ ...editFormData, weight_classification_id: Number(e.target.value) })}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                {weightClassifications.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.classification} ({wc.category}) - {formatWeightRange(wc)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Role:
              </label>
              <select
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as TallyLogEntryRole })}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value={TallyLogEntryRole.TALLY}>Tally-er</option>
                <option value={TallyLogEntryRole.DISPATCHER}>Dispatcher</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Weight (kg):
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={editFormData.weight}
                onChange={(e) => setEditFormData({ ...editFormData, weight: parseFloat(e.target.value) || 0 })}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Heads:
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editFormData.heads}
                onChange={(e) => setEditFormData({ ...editFormData, heads: parseFloat(e.target.value) || 0 })}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Notes:
              </label>
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                disabled={loading}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEntry(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpdateEntry}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {showAuditModal && selectedEntryForAudit && (
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
            minWidth: '600px',
            maxWidth: '900px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>Edit History - Entry #{selectedEntryForAudit.id}</h3>
            
            {loadingAudit ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading audit history...</div>
            ) : auditHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                No edit history found for this entry.
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                  This entry has been edited {auditHistory.length} time{auditHistory.length !== 1 ? 's' : ''}.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {auditHistory.map((audit, index) => (
                    <div
                      key={audit.id}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '15px',
                        backgroundColor: '#f9f9f9'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div>
                          <strong>Edit #{auditHistory.length - index}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {formatDateTime(audit.edited_at, timezone)}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                        Edited by: <strong>{audit.user_username || `User ID ${audit.user_id}`}</strong>
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <strong>Changes:</strong>
                        <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                          {Object.entries(audit.changes).map(([fieldName, change]) => (
                            <li key={fieldName} style={{ marginBottom: '5px' }}>
                              <strong>{formatFieldName(fieldName)}:</strong>{' '}
                              <span style={{ color: '#e74c3c' }}>
                                {formatFieldValue(fieldName, change.old)}
                              </span>
                              {' → '}
                              <span style={{ color: '#27ae60' }}>
                                {formatFieldValue(fieldName, change.new)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowAuditModal(false);
                  setSelectedEntryForAudit(null);
                  setAuditHistory([]);
                }}
                disabled={loadingAudit}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TallySessionLogs;

