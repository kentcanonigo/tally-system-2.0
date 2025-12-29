import { useEffect, useState } from 'react';
import { customersApi, plantsApi, tallySessionsApi, exportApi } from '../services/api';
import { generateSessionReportPDF } from '../utils/pdfGenerator';
import { generateTallySheetPDF } from '../utils/tallySheetPdfGenerator';
import { generateTallySheetExcel } from '../utils/tallySheetExcelGenerator';
import { useTimezone } from '../hooks/useTimezone';
import { formatDate } from '../utils/dateFormat';
import type { Customer, Plant, TallySession, TallyLogEntryRole } from '../types';
import { TallyLogEntryRole as RoleEnum } from '../types';

function ExportPage() {
  const timezone = useTimezone();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showTallySheetFormatModal, setShowTallySheetFormatModal] = useState(false);
  const [showAllocationReportRoleModal, setShowAllocationReportRoleModal] = useState(false);
  const [showDateExportModal, setShowDateExportModal] = useState(false);
  const [exportRole, setExportRole] = useState<TallyLogEntryRole>(RoleEnum.TALLY);
  const [exportDate, setExportDate] = useState<string>('');
  
  const [filters, setFilters] = useState({
    customer_id: '',
    plant_id: '',
    status: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [filters]);

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
      
      // API might not support date range filtering yet in getAll, but if it does:
      // if (filters.date_from) params.date_from = filters.date_from;
      // if (filters.date_to) params.date_to = filters.date_to;

      const response = await tallySessionsApi.getAll(params);
      let data = response.data;
      
      // Client side date filtering if API doesn't support it in getAll
      if (filters.date_from) {
        data = data.filter(s => s.date >= filters.date_from);
      }
      if (filters.date_to) {
        data = data.filter(s => s.date <= filters.date_to);
      }
      
      // Sort by date desc
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setSessions(data);
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
      // Check if the error is from the backend about empty data
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

  const handleExportTallySheet = async (format: 'pdf' | 'excel', role?: TallyLogEntryRole, sessionIds?: number[]) => {
    const idsToUse = sessionIds || selectedIds;
    if (idsToUse.length === 0) return;
    const selectedRole = role || exportRole;
    setExporting(true);
    setShowTallySheetFormatModal(false);
    try {
      const response = await exportApi.exportTallySheet({ session_ids: idsToUse, role: selectedRole });
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
      
      // Generate separate files for each customer with data
      // Add a small delay between downloads to avoid browser blocking multiple downloads
      // Only show grand total if there are multiple customers
      const showGrandTotal = customersWithData.length > 1;
      for (let i = 0; i < customersWithData.length; i++) {
        if (i > 0) {
          // Wait 500ms between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (format === 'pdf') {
          generateTallySheetPDF(customersWithData[i], showGrandTotal);
        } else {
          await generateTallySheetExcel(customersWithData[i], showGrandTotal);
        }
      }
    } catch (error: any) {
      console.error('Tally sheet export failed', error);
      // Check if the error is from the backend about empty data
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

  const handleExportByDate = async (exportType: 'allocation' | 'tally-sheet', format?: 'pdf' | 'excel') => {
    if (!exportDate) {
      alert('Please select a date');
      return;
    }

    setExporting(true);
    setShowDateExportModal(false);
    
    try {
      // Fetch all sessions for the selected date
      const response = await tallySessionsApi.getAll({});
      const allSessions = response.data;
      
      // Filter sessions by the selected date
      const dateStr = exportDate; // YYYY-MM-DD format
      const sessionsForDate = allSessions.filter(session => {
        const sessionDate = new Date(session.date).toISOString().split('T')[0];
        return sessionDate === dateStr;
      });

      if (sessionsForDate.length === 0) {
        alert(`No sessions found for ${formatDate(exportDate, timezone)}`);
        setExporting(false);
        return;
      }

      const sessionIds = sessionsForDate.map(s => s.id);

      if (exportType === 'allocation') {
        // Export allocation details using date filter
        const selectedRole = exportRole;
        const exportResponse = await exportApi.exportSessions({ 
          date_from: exportDate, 
          date_to: exportDate, 
          role: selectedRole 
        });
        const data = exportResponse.data;
        
        // Check if the report is empty
        if (!data.customers || data.customers.length === 0) {
          alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for ${formatDate(exportDate, timezone)}.`);
          setExporting(false);
          return;
        }
        
        // Check if all customers have no items
        const hasAnyItems = data.customers.some(customer => 
          customer.items && customer.items.length > 0
        );
        
        if (!hasAnyItems) {
          alert(`Cannot export allocation report: No ${selectedRole === RoleEnum.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for ${formatDate(exportDate, timezone)}.`);
          setExporting(false);
          return;
        }
        
        generateSessionReportPDF(data);
      } else if (exportType === 'tally-sheet' && format) {
        // Export tally sheet using session IDs
        await handleExportTallySheet(format, exportRole, sessionIds);
        return; // handleExportTallySheet handles setExporting(false)
      }
    } catch (error: any) {
      console.error('Export by date failed', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (errorMessage.includes('No') && (errorMessage.includes('data') || errorMessage.includes('allocation') || errorMessage.includes('tally entries'))) {
        alert(`Cannot export: No data found for ${formatDate(exportDate, timezone)}.`);
      } else {
        alert(`Export failed: ${errorMessage}`);
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
        <h1>Export Sessions</h1>
        <p>Select sessions to export to PDF</p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAllocationReportRoleModal(true)}
          disabled={selectedIds.length === 0 || exporting}
          style={{ opacity: selectedIds.length === 0 ? 0.5 : 1 }}
        >
          {exporting ? 'Generating PDF...' : `Export Allocation Report (${selectedIds.length})`}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowTallySheetFormatModal(true)}
          disabled={selectedIds.length === 0 || exporting}
          style={{ opacity: selectedIds.length === 0 ? 0.5 : 1 }}
        >
          Export Tally Sheet ({selectedIds.length})
        </button>
        <div style={{ marginLeft: '20px', paddingLeft: '20px', borderLeft: '2px solid #ddd', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: '#666' }}>Export by Date:</span>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowDateExportModal(true)}
            disabled={exporting}
          >
            Export All for Date
          </button>
        </div>
      </div>

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

      {showDateExportModal && (
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
            minWidth: '350px'
          }}>
            <h3 style={{ marginTop: 0 }}>Export All Sessions for Date</h3>
            <p style={{ marginBottom: '15px', color: '#666' }}>
              Export all allocation details or tally sheets for all sessions on a specific date.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date:</label>
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
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
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Export Type:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleExportByDate('allocation')}
                  disabled={exporting || !exportDate}
                  style={{ width: '100%' }}
                >
                  Export All Allocation Details
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExportByDate('tally-sheet', 'pdf')}
                    disabled={exporting || !exportDate}
                    style={{ flex: 1 }}
                  >
                    Export All Tally Sheets (PDF)
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExportByDate('tally-sheet', 'excel')}
                    disabled={exporting || !exportDate}
                    style={{ flex: 1 }}
                  >
                    Export All Tally Sheets (Excel)
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDateExportModal(false);
                  setExportDate('');
                }}
                disabled={exporting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Date From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Date To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
          <label>Customer</label>
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
          <label>Plant</label>
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
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={sessions.length > 0 && selectedIds.length === sessions.length}
                  onChange={toggleAll}
                />
              </th>
              <th>ID</th>
              <th>Customer</th>
              <th>Plant</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} onClick={() => toggleSelection(session.id)} style={{ cursor: 'pointer' }}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(session.id)}
                    onChange={() => toggleSelection(session.id)}
                  />
                </td>
                <td>{session.id}</td>
                <td>{getCustomerName(session.customer_id)}</td>
                <td>{getPlantName(session.plant_id)}</td>
                <td>{formatDate(session.date, timezone)}</td>
                <td>{getStatusBadge(session.status)}</td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                  No sessions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExportPage;

