import { useEffect, useState } from 'react';
import { customersApi, plantsApi, tallySessionsApi, exportApi } from '../services/api';
import { generateSessionReportPDF } from '../utils/pdfGenerator';
import { generateTallySheetPDF } from '../utils/tallySheetPdfGenerator';
import { generateTallySheetExcel } from '../utils/tallySheetExcelGenerator';
import type { Customer, Plant, TallySession } from '../types';

function ExportPage() {
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showTallySheetFormatModal, setShowTallySheetFormatModal] = useState(false);
  
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

  const handleExport = async () => {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      const response = await exportApi.exportSessions({ session_ids: selectedIds });
      generateSessionReportPDF(response.data);
    } catch (error) {
      console.error('Export failed', error);
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTallySheet = async (format: 'pdf' | 'excel') => {
    if (selectedIds.length === 0) return;
    setExporting(true);
    setShowTallySheetFormatModal(false);
    try {
      const response = await exportApi.exportTallySheet({ session_ids: selectedIds });
      if (format === 'pdf') {
        generateTallySheetPDF(response.data);
      } else {
        generateTallySheetExcel(response.data);
      }
    } catch (error) {
      console.error('Tally sheet export failed', error);
      alert('Tally sheet export failed');
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
          onClick={handleExport}
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
            <h3 style={{ marginTop: 0 }}>Select Export Format</h3>
            <p>Choose the format for the tally sheet export:</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleExportTallySheet('pdf')}
                disabled={exporting}
              >
                PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExportTallySheet('excel')}
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
                <td>{new Date(session.date).toLocaleDateString()}</td>
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

