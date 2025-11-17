import { useEffect, useState } from 'react';
import { plantsApi, weightClassificationsApi } from '../services/api';
import type { Plant, WeightClassification } from '../types';

function WeightClassifications() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [classifications, setClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClassification, setEditingClassification] = useState<WeightClassification | null>(null);
  const [formData, setFormData] = useState({
    classification: '',
    min_weight: null as number | null,
    max_weight: null as number | null,
    category: '',
    isCatchAll: false,
    isUpRange: false,
    isDownRange: false,
  });

  useEffect(() => {
    fetchPlants();
  }, []);

  useEffect(() => {
    if (selectedPlantId) {
      fetchClassifications();
    }
  }, [selectedPlantId]);

  const fetchPlants = async () => {
    try {
      const response = await plantsApi.getAll();
      setPlants(response.data);
      if (response.data.length > 0 && !selectedPlantId) {
        setSelectedPlantId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching plants:', error);
      alert('Error fetching plants');
    }
  };

  const fetchClassifications = async () => {
    if (!selectedPlantId) return;
    setLoading(true);
    try {
      const response = await weightClassificationsApi.getByPlant(selectedPlantId);
      setClassifications(response.data);
    } catch (error) {
      console.error('Error fetching classifications:', error);
      alert('Error fetching weight classifications');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingClassification(null);
    setFormData({ 
      classification: '', 
      min_weight: null, 
      max_weight: null, 
      category: '',
      isCatchAll: false,
      isUpRange: false,
      isDownRange: false,
    });
    setShowModal(true);
  };

  const handleEdit = (classification: WeightClassification) => {
    const isCatchAll = classification.min_weight === null && classification.max_weight === null;
    const isUpRange = classification.min_weight !== null && classification.max_weight === null;
    const isDownRange = classification.min_weight === null && classification.max_weight !== null;
    
    setEditingClassification(classification);
    setFormData({
      classification: classification.classification,
      min_weight: classification.min_weight ?? null,
      max_weight: classification.max_weight ?? null,
      category: classification.category,
      isCatchAll,
      isUpRange,
      isDownRange,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlantId) return;
    
    // Prepare data based on catch-all and up range flags
    let submitData: any = {
      classification: formData.classification,
      category: formData.category,
    };
    
    if (formData.isCatchAll) {
      submitData.min_weight = null;
      submitData.max_weight = null;
    } else if (formData.isUpRange) {
      submitData.min_weight = formData.min_weight;
      submitData.max_weight = null;
    } else if (formData.isDownRange) {
      submitData.min_weight = null;
      submitData.max_weight = formData.max_weight;
    } else {
      submitData.min_weight = formData.min_weight;
      submitData.max_weight = formData.max_weight;
    }
    
    try {
      if (editingClassification) {
        await weightClassificationsApi.update(editingClassification.id, submitData);
      } else {
        await weightClassificationsApi.create(selectedPlantId, submitData);
      }
      setShowModal(false);
      fetchClassifications();
    } catch (error: any) {
      console.error('Error saving classification:', error);
      alert(error.response?.data?.detail || 'Error saving weight classification');
    }
  };
  
  const formatWeightRange = (wc: WeightClassification): string => {
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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this weight classification?')) return;
    try {
      await weightClassificationsApi.delete(id);
      fetchClassifications();
    } catch (error) {
      console.error('Error deleting classification:', error);
      alert('Error deleting weight classification');
    }
  };

  if (loading && !selectedPlantId) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Weight Classifications</h1>
        <p>Manage weight classifications by plant</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div className="form-group" style={{ maxWidth: '300px' }}>
          <label>Select Plant</label>
          <select
            value={selectedPlantId || ''}
            onChange={(e) => setSelectedPlantId(Number(e.target.value))}
          >
            <option value="">Select a plant</option>
            {plants.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedPlantId && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <button className="btn btn-primary" onClick={handleCreate}>
              Add Weight Classification
            </button>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Classification</th>
                    <th>Weight Range</th>
                    <th>Category</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classifications.map((classification) => (
                    <tr key={classification.id}>
                      <td>{classification.id}</td>
                      <td>{classification.classification}</td>
                      <td>{formatWeightRange(classification)}</td>
                      <td>{classification.category}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEdit(classification)}
                          style={{ marginRight: '10px' }}
                        >
                          Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(classification.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingClassification ? 'Edit Weight Classification' : 'Add Weight Classification'}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Classification</label>
                <input
                  type="text"
                  value={formData.classification}
                  onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isCatchAll}
                    onChange={(e) => {
                      const isCatchAll = e.target.checked;
                      setFormData({
                        ...formData,
                        isCatchAll,
                        isUpRange: isCatchAll ? false : formData.isUpRange,
                        min_weight: isCatchAll ? null : formData.min_weight,
                        max_weight: isCatchAll ? null : formData.max_weight,
                      });
                    }}
                  />
                  {' '}Catch-all (All Sizes)
                </label>
              </div>
              
              {!formData.isCatchAll && (
                <>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.isDownRange}
                        onChange={(e) => {
                          const isDownRange = e.target.checked;
                          setFormData({
                            ...formData,
                            isDownRange,
                            isUpRange: isDownRange ? false : formData.isUpRange,
                            min_weight: isDownRange ? null : formData.min_weight,
                          });
                        }}
                      />
                      {' '}Down range (no lower limit - up to X)
                    </label>
                  </div>
                  {!formData.isDownRange && (
                    <div className="form-group">
                      <label>Min Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.min_weight ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value);
                          setFormData({ ...formData, min_weight: value });
                        }}
                        required
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.isUpRange}
                        onChange={(e) => {
                          const isUpRange = e.target.checked;
                          setFormData({
                            ...formData,
                            isUpRange,
                            isDownRange: isUpRange ? false : formData.isDownRange,
                            max_weight: isUpRange ? null : formData.max_weight,
                          });
                        }}
                      />
                      {' '}Up range (no upper limit - X and up)
                    </label>
                  </div>
                  {!formData.isUpRange && (
                    <div className="form-group">
                      <label>Max Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.max_weight ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value);
                          setFormData({ ...formData, max_weight: value });
                        }}
                        required
                      />
                    </div>
                  )}
                </>
              )}
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Select a category</option>
                  <option value="Dressed">Dressed</option>
                  <option value="Byproduct">Byproduct</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClassification ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeightClassifications;

