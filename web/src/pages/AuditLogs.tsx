import { useEffect, useState } from 'react';
import { tallyLogEntriesApi } from '../services/api';
import type { TallyLogEntryAudit } from '../types';
import { useTimezone } from '../hooks/useTimezone';
import { formatDateTime } from '../utils/dateFormat';
import '../App.css';

function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<TallyLogEntryAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(100);
  const timezone = useTimezone();

  useEffect(() => {
    fetchAuditLogs();
  }, [limit]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await tallyLogEntriesApi.getAllAuditLogs(limit);
      setAuditLogs(response.data);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      'weight': 'Weight',
      'role': 'Role',
      'heads': 'Heads',
      'notes': 'Notes',
      'weight_classification_id': 'Weight Classification',
      'tally_session_id': 'Tally Session',
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
    return (
      <div className="container">
        <p>Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Audit Logs</h1>
        <p>View all editing activity for tally log entries</p>
      </div>

      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold' }}>Number of Records:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ padding: '8px', minWidth: '150px' }}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchAuditLogs}
          style={{ marginTop: '20px' }}
        >
          Refresh
        </button>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Entry ID</th>
              <th>User</th>
              <th>Customer</th>
              <th>Plant</th>
              <th>Session</th>
              <th>Weight Class</th>
              <th>Category</th>
              <th>Edited At</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length > 0 ? (
              auditLogs.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.id}</td>
                  <td>
                    {audit.session_id ? (
                      <a 
                        href={`/tally-sessions/${audit.session_id}/logs`}
                        style={{ color: '#007bff', textDecoration: 'none' }}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/tally-sessions/${audit.session_id}/logs`;
                        }}
                      >
                        {audit.tally_log_entry_id}
                      </a>
                    ) : (
                      audit.tally_log_entry_id
                    )}
                  </td>
                  <td>
                    <strong>{audit.user_username || `User ID ${audit.user_id}`}</strong>
                  </td>
                  <td>{audit.customer_name || '-'}</td>
                  <td>{audit.plant_name || '-'}</td>
                  <td>
                    {audit.session_id ? (
                      <a 
                        href={`/tally-sessions/${audit.session_id}`}
                        style={{ color: '#007bff', textDecoration: 'none' }}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/tally-sessions/${audit.session_id}`;
                        }}
                      >
                        #{audit.session_number}
                        {audit.session_date && ` (${new Date(audit.session_date).toLocaleDateString()})`}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{audit.weight_classification_name || '-'}</td>
                  <td>
                    {audit.weight_classification_category ? (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          backgroundColor: 
                            audit.weight_classification_category === 'Dressed' ? '#e3f2fd' :
                            audit.weight_classification_category === 'Frozen' ? '#f3e5f5' :
                            '#fff3e0',
                          color: 
                            audit.weight_classification_category === 'Dressed' ? '#1976d2' :
                            audit.weight_classification_category === 'Frozen' ? '#7b1fa2' :
                            '#e65100',
                        }}
                      >
                        {audit.weight_classification_category}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{formatDateTime(audit.edited_at, timezone)}</td>
                  <td style={{ maxWidth: '400px', wordBreak: 'break-word' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {Object.entries(audit.changes).map(([fieldName, change]) => (
                        <div key={fieldName} style={{ fontSize: '12px' }}>
                          <strong>{formatFieldName(fieldName)}:</strong>{' '}
                          <span style={{ color: '#e74c3c' }}>
                            {formatFieldValue(fieldName, change.old)}
                          </span>
                          {' → '}
                          <span style={{ color: '#27ae60' }}>
                            {formatFieldValue(fieldName, change.new)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center' }}>
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {auditLogs.length > 0 && (
        <div style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
          Showing {auditLogs.length} audit log{auditLogs.length !== 1 ? 's' : ''} (latest first)
        </div>
      )}
    </div>
  );
}

export default AuditLogs;

