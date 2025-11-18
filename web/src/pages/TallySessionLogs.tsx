import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tallySessionsApi, customersApi, plantsApi, weightClassificationsApi, tallyLogEntriesApi } from '../services/api';
import type { TallySession, Customer, Plant, WeightClassification, TallyLogEntry } from '../types';
import { TallyLogEntryRole } from '../types';

function TallySessionLogs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [logEntries, setLogEntries] = useState<TallyLogEntry[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    role: TallyLogEntryRole | 'all';
    weight_classification_id: number | 'all';
  }>({
    role: 'all',
    weight_classification_id: 'all',
  });
  const [sortBy, setSortBy] = useState<'class' | 'weight' | 'time' | 'id'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const sessionRes = await tallySessionsApi.getById(Number(id));
      const sessionData = sessionRes.data;
      setSession(sessionData);

      const [customerRes, plantRes, entriesRes, wcRes] = await Promise.all([
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        tallyLogEntriesApi.getBySession(Number(id)),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ]);

      setCustomer(customerRes.data);
      setPlant(plantRes.data);
      setLogEntries(entriesRes.data);
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

  const formatWeightRange = (wc: WeightClassification): string => {
    // For Byproduct with both weights null, show N/A
    if (wc.category === 'Byproduct' && wc.min_weight === null && wc.max_weight === null) {
      return 'N/A';
    }
    // For Dressed with both weights null, show All Sizes (catch-all)
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'All Sizes';
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
    let filtered = logEntries.filter((entry) => {
      if (filters.role !== 'all' && entry.role !== filters.role) {
        return false;
      }
      if (filters.weight_classification_id !== 'all' && entry.weight_classification_id !== filters.weight_classification_id) {
        return false;
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
        <h1>Tally Logs - Session #{session.id}</h1>
        <p>
          Customer: {customer?.name} | Plant: {plant?.name} | Date: {new Date(session.date).toLocaleDateString()}
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
                aggregations.map((agg) => (
                  <tr key={agg.weight_classification_id}>
                    <td>{agg.classification}</td>
                    <td>{agg.tally.toFixed(2)}</td>
                    <td>{agg.dispatcher.toFixed(2)}</td>
                    <td
                      style={{
                        color: agg.difference === 0 ? '#27ae60' : '#e74c3c',
                        fontWeight: agg.difference === 0 ? 'normal' : 'bold',
                      }}
                    >
                      {agg.difference === 0 ? 'Match' : agg.difference.toFixed(2)}
                    </td>
                  </tr>
                ))
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
                    color: overallTotals.difference === 0 ? '#27ae60' : '#e74c3c',
                  }}
                >
                  {overallTotals.difference === 0 ? 'Match' : overallTotals.difference.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Log Entries Table */}
      <div>
        <h2>Log Entries ({filteredEntries.length})</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Role</th>
                <th>Weight Classification</th>
                <th>Description</th>
                <th>Weight Range</th>
                <th>Weight</th>
                <th>Notes</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => {
                  const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
                  return (
                    <tr key={entry.id}>
                      <td>{entry.id}</td>
                      <td>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: entry.role === TallyLogEntryRole.TALLY ? '#3498db' : '#9b59b6',
                            color: 'white',
                            fontSize: '12px',
                          }}
                        >
                          {entry.role === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher'}
                        </span>
                      </td>
                      <td>{getWeightClassificationName(entry.weight_classification_id)}</td>
                      <td>{wc?.description || '-'}</td>
                      <td>{wc ? formatWeightRange(wc) : '-'}</td>
                      <td>{entry.weight.toFixed(2)}</td>
                      <td>{entry.notes || '-'}</td>
                      <td>{new Date(entry.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center' }}>
                    No log entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TallySessionLogs;

