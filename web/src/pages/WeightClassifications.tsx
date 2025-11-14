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
    min_weight: 0,
    max_weight: 0,
    category: '',
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
    setFormData({ classification: '', min_weight: 0, max_weight: 0, category: '' });
    setShowModal(true);
  };

  const handleEdit = (classification: WeightClassification) => {
    setEditingClassification(classification);
    setFormData({
      classification: classification.classification,
      min_weight: classification.min_weight,
      max_weight: classification.max_weight,
      category: classification.category,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlantId) return;
    try {
      if (editingClassification) {
        await weightClassificationsApi.update(editingClassification.id, formData);
      } else {
        await weightClassificationsApi.create(selectedPlantId, formData);
      }
      setShowModal(false);
      fetchClassifications();
    } catch (error: any) {
      console.error('Error saving classification:', error);
      alert(error.response?.data?.detail || 'Error saving weight classification');
    }
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
                    <th>Min Weight</th>
                    <th>Max Weight</th>
                    <th>Category</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classifications.map((classification) => (
                    <tr key={classification.id}>
                      <td>{classification.id}</td>
                      <td>{classification.classification}</td>
                      <td>{classification.min_weight}</td>
                      <td>{classification.max_weight}</td>
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
                <label>Min Weight</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.min_weight}
                  onChange={(e) => setFormData({ ...formData, min_weight: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Max Weight</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.max_weight}
                  onChange={(e) => setFormData({ ...formData, max_weight: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
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

