import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tallySessionsApi, allocationDetailsApi, customersApi, plantsApi, weightClassificationsApi, exportApi, tallyLogEntriesApi } from '../services/api';
import { generateSessionReportPDF } from '../utils/pdfGenerator';
import { generateTallySheetPDF } from '../utils/tallySheetPdfGenerator';
import { generateTallySheetExcel } from '../utils/tallySheetExcelGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useTimezone } from '../hooks/useTimezone';
import { formatDate } from '../utils/dateFormat';
import type { TallySession, AllocationDetails, Customer, Plant, WeightClassification, TallyLogEntry, TallyLogEntryRole } from '../types';
import { TallyLogEntryRole as RoleEnum } from '../types';
import { getAcceptableDifferenceThreshold } from '../utils/settings';

function TallySessionDetail() {
  const { hasPermission } = useAuth();
  const timezone = useTimezone();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [allocations, setAllocations] = useState<AllocationDetails[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [logEntries, setLogEntries] = useState<TallyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTallySheetFormatModal, setShowTallySheetFormatModal] = useState(false);
  const [showAllocationReportRoleModal, setShowAllocationReportRoleModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationDetails | null>(null);
  const [exportRole, setExportRole] = useState<TallyLogEntryRole>(RoleEnum.TALLY);
  const [formData, setFormData] = useState({
    weight_classification_id: 0,
    required_bags: 0,
    allocated_bags_tally: 0,
    allocated_bags_dispatcher: 0,
  });
  const [threshold, setThreshold] = useState<number>(0);

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

      const canViewLogs = hasPermission('can_view_tally_logs');
      
      const promises: Promise<any>[] = [
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        allocationDetailsApi.getBySession(Number(id)),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ];

      // Only fetch log entries if user has permission
      if (canViewLogs) {
        promises.push(tallyLogEntriesApi.getBySession(Number(id)));
      }

      const results = await Promise.all(promises);

      setCustomer(results[0].data);
      setPlant(results[1].data);
      setAllocations(results[2].data);
      setWeightClassifications(results[3].data);
      
      // Only set log entries if we fetched them
      if (canViewLogs) {
        setLogEntries(results[4].data);
      } else {
        setLogEntries([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error fetching session details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAllocation(null);
    setFormData({
      weight_classification_id: weightClassifications[0]?.id || 0,
      required_bags: 0,
      allocated_bags_tally: 0,
      allocated_bags_dispatcher: 0,
    });
    setShowModal(true);
  };

  const handleEdit = (allocation: AllocationDetails) => {
    setEditingAllocation(allocation);
    setFormData({
      weight_classification_id: allocation.weight_classification_id,
      required_bags: allocation.required_bags,
      allocated_bags_tally: allocation.allocated_bags_tally,
      allocated_bags_dispatcher: allocation.allocated_bags_dispatcher,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      if (editingAllocation) {
        // When editing, only send fields that can be updated (not allocated_bags fields)
        const updateData = {
          weight_classification_id: formData.weight_classification_id,
          required_bags: formData.required_bags,
        };
        await allocationDetailsApi.update(editingAllocation.id, updateData);
      } else {
        // When creating, allocated bags default to 0 (computed from logs)
        await allocationDetailsApi.create(Number(id), {
          weight_classification_id: formData.weight_classification_id,
          required_bags: formData.required_bags,
          allocated_bags_tally: 0,
          allocated_bags_dispatcher: 0,
        });
      }
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving allocation:', error);
      alert(error.response?.data?.detail || 'Error saving allocation');
    }
  };

  const handleDelete = async (allocationId: number) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return;
    try {
      await allocationDetailsApi.delete(allocationId);
      fetchData();
    } catch (error) {
      console.error('Error deleting allocation:', error);
      alert('Error deleting allocation');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!session || !id) return;
    try {
      await tallySessionsApi.update(Number(id), { status: newStatus as any });
      fetchData();
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(error.response?.data?.detail || 'Error updating status');
    }
  };

  const handleResetTally = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to reset all Tally-er allocations for this session? This will delete all Tally-er log entries and recalculate allocated bags from the remaining log entries.')) {
      return;
    }
    try {
      const response = await allocationDetailsApi.resetTally(Number(id));
      const result = response.data;
      alert(`Tally-er allocations reset successfully.\n${result.log_entries_deleted} log entry/entries deleted.\n${result.allocations_updated} allocation(s) recalculated.`);
      fetchData();
    } catch (error: any) {
      console.error('Error resetting tally allocations:', error);
      alert(error.response?.data?.detail || 'Error resetting tally allocations');
    }
  };

  const handleResetDispatcher = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to reset all Dispatcher allocations for this session? This will delete all Dispatcher log entries and recalculate allocated bags from the remaining log entries.')) {
      return;
    }
    try {
      const response = await allocationDetailsApi.resetDispatcher(Number(id));
      const result = response.data;
      alert(`Dispatcher allocations reset successfully.\n${result.log_entries_deleted} log entry/entries deleted.\n${result.allocations_updated} allocation(s) recalculated.`);
      fetchData();
    } catch (error: any) {
      console.error('Error resetting dispatcher allocations:', error);
      alert(error.response?.data?.detail || 'Error resetting dispatcher allocations');
    }
  };

  const handleExport = async (role?: TallyLogEntryRole) => {
    if (!id) return;
    const selectedRole = role || exportRole;
    setLoading(true);
    setShowAllocationReportRoleModal(false);
    try {
      const response = await exportApi.exportSessions({ session_ids: [Number(id)], role: selectedRole });
      const data = response.data;
      
      // Check if the report is empty
      if (!data.customers || data.customers.length === 0) {
        alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for this session.`);
        return;
      }
      
      // Check if all customers have no items
      const hasAnyItems = data.customers.some(customer => 
        customer.items && customer.items.length > 0
      );
      
      if (!hasAnyItems) {
        alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for this session.`);
        return;
      }
      
      generateSessionReportPDF(data);
    } catch (error: any) {
      console.error('Export error:', error);
      // Check if the error is from the backend about empty data
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (errorMessage.includes('No') && (errorMessage.includes('data') || errorMessage.includes('allocation'))) {
        alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for this session.`);
      } else {
        alert(`Failed to export PDF: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportTallySheet = async (format: 'pdf' | 'excel', role?: TallyLogEntryRole) => {
    if (!id) return;
    const selectedRole = role || exportRole;
    setLoading(true);
    setShowTallySheetFormatModal(false);
    try {
      const response = await exportApi.exportTallySheet({ session_ids: [Number(id)], role: selectedRole });
      // Backend returns TallySheetMultiCustomerResponse with a customers array
      // For a single session, there should be only one customer
      const customerData = response.data.customers?.[0] || response.data;
      
      // Check if the tally sheet is empty
      if (!customerData.pages || customerData.pages.length === 0) {
        alert(`Cannot export tally sheet: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} data found for this session.`);
        return;
      }
      
      // Single customer, so don't show grand total
      if (format === 'pdf') {
        generateTallySheetPDF(customerData, false);
      } else {
        await generateTallySheetExcel(customerData, false);
      }
    } catch (error: any) {
      console.error('Tally sheet export error:', error);
      // Check if the error is from the backend about empty data
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (errorMessage.includes('No tally entries found') || errorMessage.includes('No valid data found')) {
        alert(`Cannot export tally sheet: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} data found for this session.`);
      } else {
        alert(`Failed to export tally sheet: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getWeightClassificationName = (wcId: number) => {
    return weightClassifications.find((wc) => wc.id === wcId)?.classification || wcId;
  };

  const getTotalHeadsForWeightClassification = (wcId: number): number => {
    return logEntries
      .filter(entry => entry.weight_classification_id === wcId)
      .reduce((sum, entry) => sum + (entry.heads || 0), 0);
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Session not found</div>;
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate('/tally-sessions')} style={{ marginBottom: '20px' }}>
          ← Back to Sessions
        </button>
        <h1>{customer?.name || 'Unknown'} - Session #{session.session_number} - {formatDate(session.date, timezone)}</h1>
        <p>
          Plant: {plant?.name}
        </p>
        <p>
          Status:{' '}
          {hasPermission('can_edit_tally_session') ? (
            <select
              value={session.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px',
                marginLeft: '8px',
                cursor: 'pointer',
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
          ) : (
            <span style={{ marginLeft: '8px', fontWeight: '600' }}>{session.status}</span>
          )}
        </p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {hasPermission('can_edit_tally_allocations') && (
          <button className="btn btn-primary" onClick={handleCreate}>
            Add Allocation
          </button>
        )}
        {hasPermission('can_view_tally_logs') && (
          <button className="btn btn-secondary" onClick={() => navigate(`/tally-sessions/${id}/logs`)}>
            View Logs
          </button>
        )}
        {hasPermission('can_export_data') && (
          <>
            <button 
              className="btn btn-info" 
              onClick={() => setShowAllocationReportRoleModal(true)}
              style={{ backgroundColor: '#17a2b8', color: 'white' }}
            >
              Export Allocation Report
            </button>
            <button 
              className="btn btn-info" 
              onClick={() => setShowTallySheetFormatModal(true)}
              style={{ backgroundColor: '#6c757d', color: 'white' }}
            >
              Export Tally Sheet
            </button>
          </>
        )}
        {hasPermission('can_delete_tally_allocations') && (
          <>
            <button 
              className="btn btn-warning" 
              onClick={handleResetTally}
              style={{ backgroundColor: '#f39c12', color: 'white' }}
            >
              Reset Tally-er Allocations
            </button>
            <button 
              className="btn btn-warning" 
              onClick={handleResetDispatcher}
              style={{ backgroundColor: '#e67e22', color: 'white' }}
            >
              Reset Dispatcher Allocations
            </button>
          </>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Weight Classification</th>
              {hasPermission('can_view_tally_logs') ? (
                <>
                  <th>Required Bags</th>
                  <th>Allocated (Tally)</th>
                  <th>Allocated (Dispatcher)</th>
                  <th>Difference</th>
                  <th>Heads</th>
                </>
              ) : (
                <th>Required</th>
              )}
              {(hasPermission('can_edit_tally_allocations') || hasPermission('can_delete_tally_allocations')) && (
                <th>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {allocations.map((allocation) => {
              const hasProgressData = hasPermission('can_view_tally_logs') && 'allocated_bags_tally' in allocation;
              const difference = hasProgressData ? allocation.allocated_bags_tally - allocation.allocated_bags_dispatcher : 0;
              const isNotStarted = hasProgressData && allocation.allocated_bags_tally === 0 && allocation.allocated_bags_dispatcher === 0;
              const diffColor = hasProgressData ? getDifferenceColor(difference, isNotStarted) : '#666';
              const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
              
              return (
                <tr key={allocation.id}>
                  <td>{allocation.id}</td>
                  <td>
                    {getWeightClassificationName(allocation.weight_classification_id)}
                    {wc?.description && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{wc.description}</div>}
                  </td>
                  {hasPermission('can_view_tally_logs') ? (
                    <>
                      <td>{allocation.required_bags}</td>
                      <td>{hasProgressData ? allocation.allocated_bags_tally : '-'}</td>
                      <td>{hasProgressData ? allocation.allocated_bags_dispatcher : '-'}</td>
                      <td style={{ color: diffColor, fontWeight: difference === 0 && !isNotStarted ? 'normal' : 'bold' }}>
                        {hasProgressData 
                          ? (isNotStarted ? 'Not started' : (difference === 0 ? 'Match' : difference.toFixed(2)))
                          : '-'}
                      </td>
                      <td>
                        {hasProgressData ? getTotalHeadsForWeightClassification(allocation.weight_classification_id).toFixed(0) : '-'}
                      </td>
                    </>
                  ) : (
                    <td>{allocation.required_bags} req</td>
                  )}
                  {(hasPermission('can_edit_tally_allocations') || hasPermission('can_delete_tally_allocations')) && (
                    <td>
                      {hasPermission('can_edit_tally_allocations') && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEdit(allocation)}
                          style={{ marginRight: '10px' }}
                        >
                          Edit
                        </button>
                      )}
                      {hasPermission('can_delete_tally_allocations') && (
                        <button className="btn btn-danger" onClick={() => handleDelete(allocation.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAllocation ? 'Edit Allocation' : 'Add Allocation'}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Weight Classification</label>
                <select
                  value={formData.weight_classification_id}
                  onChange={(e) =>
                    setFormData({ ...formData, weight_classification_id: Number(e.target.value) })
                  }
                  required
                >
                  <option value="">Select classification</option>
                  {weightClassifications.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.classification} ({wc.category}) - {formatWeightRange(wc)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Required Bags</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.required_bags}
                  onChange={(e) => setFormData({ ...formData, required_bags: parseFloat(e.target.value) })}
                  required
                />
              </div>
              {editingAllocation && (
                <>
                  <div className="form-group">
                    <label>Allocated Bags (Tally)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingAllocation.allocated_bags_tally}
                      disabled
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                      Computed from log entries (read-only)
                    </small>
                  </div>
                  <div className="form-group">
                    <label>Allocated Bags (Dispatcher)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingAllocation.allocated_bags_dispatcher}
                      disabled
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                      Computed from log entries (read-only)
                    </small>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAllocation ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
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
                disabled={loading}
              >
                PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExportTallySheet('excel', exportRole)}
                disabled={loading}
              >
                Excel
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowTallySheetFormatModal(false)}
                disabled={loading}
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
                disabled={loading}
              >
                Export
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAllocationReportRoleModal(false)}
                disabled={loading}
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

export default TallySessionDetail;

