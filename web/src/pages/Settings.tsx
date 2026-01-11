import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { consoleApi, authApi } from '../services/api';
import { ClassificationOrderDialog } from '../components/ClassificationOrderDialog';

const ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY = 'tally_system_acceptable_difference_threshold';
const DEFAULT_THRESHOLD = 0;

// Common timezones list
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function Settings() {
  const { isAdmin, isSuperadmin, user, refetchUser } = useAuth();
  const [threshold, setThreshold] = useState<string>('0');
  const [currentThreshold, setCurrentThreshold] = useState<number>(0);
  const [saved, setSaved] = useState(false);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [timezoneSaved, setTimezoneSaved] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
  
  // Console modal state
  const [showConsoleModal, setShowConsoleModal] = useState(false);
  const [consoleCommand, setConsoleCommand] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleMessage, setConsoleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Classification order dialog state
  const [showClassificationOrderDialog, setShowClassificationOrderDialog] = useState(false);

  useEffect(() => {
    loadThreshold();
    loadTimezone();
  }, [user]);

  const loadTimezone = () => {
    if (user?.timezone) {
      setTimezone(user.timezone);
    } else {
      setTimezone(DEFAULT_TIMEZONE);
    }
  };

  const loadThreshold = () => {
    try {
      const stored = localStorage.getItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY);
      if (stored !== null) {
        const value = parseFloat(stored);
        setCurrentThreshold(value);
        setThreshold(value.toString());
      } else {
        setCurrentThreshold(DEFAULT_THRESHOLD);
        setThreshold(DEFAULT_THRESHOLD.toString());
      }
    } catch (error) {
      console.error('Error loading threshold:', error);
    }
  };

  const handleSave = () => {
    try {
      const thresholdValue = parseFloat(threshold);
      if (isNaN(thresholdValue) || thresholdValue < 0) {
        alert('Please enter a valid number greater than or equal to 0');
        return;
      }
      localStorage.setItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY, thresholdValue.toString());
      setCurrentThreshold(thresholdValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving threshold:', error);
      alert('Error saving threshold preference');
    }
  };

  const hasChanges = parseFloat(threshold) !== currentThreshold && !isNaN(parseFloat(threshold)) && parseFloat(threshold) >= 0;
  const hasTimezoneChanges = timezone !== (user?.timezone || DEFAULT_TIMEZONE);

  const handleSaveTimezone = async () => {
    try {
      setSavingTimezone(true);
      await authApi.updatePreferences({ timezone });
      await refetchUser();
      setTimezoneSaved(true);
      setTimeout(() => setTimezoneSaved(false), 3000);
    } catch (error) {
      console.error('Error saving timezone:', error);
      alert('Error saving timezone preference');
    } finally {
      setSavingTimezone(false);
    }
  };

  const handleConsoleCommand = async () => {
    const command = consoleCommand.trim().toLowerCase();
    
    if (!command) {
      setConsoleMessage({ type: 'error', text: 'Please enter a command' });
      return;
    }

    if (command === 'delete_everything') {
      setShowDeleteConfirmation(true);
      return;
    }

    // For other commands, execute directly
    await executeCommand(command);
  };

  const executeCommand = async (command: string) => {
    setIsExecuting(true);
    setConsoleMessage(null);
    
    try {
      const response = await consoleApi.executeCommand(command);
      setConsoleMessage({ type: 'success', text: response.data.message || 'Command executed successfully' });
      setConsoleCommand('');
      
      // Close modal after successful execution (except for delete_everything which needs confirmation)
      if (command !== 'delete_everything') {
        setTimeout(() => {
          setShowConsoleModal(false);
          setConsoleMessage(null);
        }, 2000);
      }
    } catch (error: any) {
      setConsoleMessage({
        type: 'error',
        text: error.response?.data?.detail || error.message || 'Failed to execute command'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirmation(false);
    await executeCommand('delete_everything');
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setConsoleCommand('');
  };

  const openConsoleModal = () => {
    setShowConsoleModal(true);
    setConsoleCommand('');
    setConsoleMessage(null);
    setShowDeleteConfirmation(false);
  };

  const closeConsoleModal = () => {
    setShowConsoleModal(false);
    setConsoleCommand('');
    setConsoleMessage(null);
    setShowDeleteConfirmation(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your preferences</p>
      </div>

      <div className="table-container" style={{ padding: '30px' }}>
        <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Difference Threshold</h2>
        <div className="form-group">
          <label>Acceptable Difference Threshold</label>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '10px' }}>
            Set the acceptable difference between tally-er and dispatcher weights:
          </p>
          <input
            type="number"
            step="0.01"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px', fontStyle: 'italic' }}>
            Current: {currentThreshold}
          </p>
          {hasChanges && (
            <div style={{ marginTop: '15px' }}>
              <button className="btn btn-primary" onClick={handleSave}>
                Save Threshold
              </button>
              {saved && (
                <span style={{ marginLeft: '15px', color: '#27ae60', fontWeight: '500' }}>
                  ✓ Saved successfully!
                </span>
              )}
            </div>
          )}
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '15px', fontStyle: 'italic' }}>
            When viewing session logs, differences within this threshold will be displayed in orange (acceptable).
            Exact matches (0) will be green, and differences beyond the threshold will be red (unacceptable).
          </p>
        </div>

        <h2 style={{ marginBottom: '20px', marginTop: '40px', color: '#2c3e50' }}>Timezone</h2>
        <div className="form-group">
          <label>Timezone</label>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '10px' }}>
            Set your preferred timezone for displaying dates and times:
          </p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              maxWidth: '300px',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px', fontStyle: 'italic' }}>
            Current: {user?.timezone || DEFAULT_TIMEZONE}
          </p>
          {hasTimezoneChanges && (
            <div style={{ marginTop: '15px' }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveTimezone}
                disabled={savingTimezone}
              >
                {savingTimezone ? 'Saving...' : 'Save Timezone'}
              </button>
              {timezoneSaved && (
                <span style={{ marginLeft: '15px', color: '#27ae60', fontWeight: '500' }}>
                  ✓ Saved successfully!
                </span>
              )}
            </div>
          )}
        </div>

        <h2 style={{ marginBottom: '20px', marginTop: '40px', color: '#2c3e50' }}>Export Settings</h2>
        <div className="form-group">
          <label>Classification Order</label>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '10px' }}>
            Customize the order of classifications in tally sheet grand totals:
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowClassificationOrderDialog(true)}
          >
            Customize Classification Order
          </button>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '10px', fontStyle: 'italic' }}>
            Reorder classifications within each category (Dressed, Frozen, Byproduct) to control how they appear in exported tally sheets.
          </p>
        </div>

        {(isAdmin || isSuperadmin) && (
          <>
            <h2 style={{ marginBottom: '20px', marginTop: '40px', color: '#2c3e50' }}>Admin Console</h2>
            <div className="form-group">
              <label>System Console</label>
              <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '10px' }}>
                Execute administrative commands (superadmin only):
              </p>
              <button
                className="btn btn-secondary"
                onClick={openConsoleModal}
                style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none' }}
              >
                Open Console
              </button>
            </div>
          </>
        )}
      </div>

      {/* Console Modal */}
      {showConsoleModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !showDeleteConfirmation) {
              closeConsoleModal();
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!showDeleteConfirmation ? (
              <>
                <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Admin Console</h2>
                <div className="form-group">
                  <label>Enter Command</label>
                  <div style={{ marginBottom: '10px', fontSize: '14px', color: '#7f8c8d' }}>
                    <p style={{ marginBottom: '8px' }}>Available commands:</p>
                    <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
                      <li><code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>delete_everything</code> - Purge all data (keeps users/roles)</li>
                      <li><code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>setup_plant &lt;plant_name&gt;</code> - Create plant with standard weight classifications</li>
                      <li><code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>populate_test_sessions &lt;plant_name&gt; [customers] [sessions]</code> - Create test data</li>
                    </ul>
                    <p style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '8px' }}>
                      Example: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>setup_plant My Plant</code> or <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>populate_test_sessions My Plant 5 2</code>
                    </p>
                  </div>
                  <input
                    type="text"
                    value={consoleCommand}
                    onChange={(e) => setConsoleCommand(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !isExecuting) {
                        handleConsoleCommand();
                      }
                    }}
                    placeholder="e.g., setup_plant My Plant"
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '8px',
                      marginBottom: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}
                    disabled={isExecuting}
                  />
                  {consoleMessage && (
                    <div
                      style={{
                        padding: '10px',
                        marginTop: '10px',
                        borderRadius: '4px',
                        backgroundColor: consoleMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                        color: consoleMessage.type === 'success' ? '#155724' : '#721c24',
                        border: `1px solid ${consoleMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                      }}
                    >
                      {consoleMessage.text}
                    </div>
                  )}
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleConsoleCommand}
                      disabled={isExecuting || !consoleCommand.trim()}
                    >
                      {isExecuting ? 'Executing...' : 'Execute'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={closeConsoleModal}
                      disabled={isExecuting}
                      style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ marginBottom: '20px', color: '#e74c3c' }}>⚠️ Confirm Database Purge</h2>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px' }}>
                    <strong>WARNING: This action cannot be undone!</strong>
                  </p>
                  <p style={{ color: '#555', marginBottom: '10px' }}>
                    You are about to delete <strong>ALL</strong> data from the database, including:
                  </p>
                  <ul style={{ color: '#555', marginLeft: '20px', marginBottom: '15px' }}>
                    <li>All tally sessions</li>
                    <li>All allocation details</li>
                    <li>All tally log entries</li>
                    <li>All weight classifications</li>
                    <li>All customers</li>
                    <li>All plants</li>
                    <li>All plant permissions</li>
                  </ul>
                  <p style={{ color: '#555', marginBottom: '10px' }}>
                    The following will be <strong>preserved</strong>:
                  </p>
                  <ul style={{ color: '#27ae60', marginLeft: '20px', marginBottom: '15px' }}>
                    <li>Users</li>
                    <li>Roles</li>
                    <li>Permissions</li>
                    <li>Role assignments</li>
                  </ul>
                  <p style={{ color: '#e74c3c', fontWeight: 'bold', marginTop: '20px' }}>
                    Are you absolutely sure you want to proceed?
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCancelDelete}
                    disabled={isExecuting}
                    style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none' }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handleConfirmDelete}
                    disabled={isExecuting}
                    style={{
                      backgroundColor: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    {isExecuting ? 'Purging...' : 'Yes, Delete Everything'}
                  </button>
                </div>
                {consoleMessage && (
                  <div
                    style={{
                      padding: '10px',
                      marginTop: '20px',
                      borderRadius: '4px',
                      backgroundColor: consoleMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                      color: consoleMessage.type === 'success' ? '#155724' : '#721c24',
                      border: `1px solid ${consoleMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                    }}
                  >
                    {consoleMessage.text}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Classification Order Dialog */}
      <ClassificationOrderDialog
        visible={showClassificationOrderDialog}
        onClose={() => setShowClassificationOrderDialog(false)}
        activePlantId={user?.active_plant_id || null}
      />
    </div>
  );
}

export default Settings;

