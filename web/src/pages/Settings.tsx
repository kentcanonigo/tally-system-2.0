import { useEffect, useState } from 'react';

const ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY = 'tally_system_acceptable_difference_threshold';
const DEFAULT_THRESHOLD = 0;

function Settings() {
  const [threshold, setThreshold] = useState<string>('0');
  const [currentThreshold, setCurrentThreshold] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadThreshold();
  }, []);

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
      </div>
    </div>
  );
}

export default Settings;

