import { useEffect, useState } from 'react';
import { plantsApi } from '../services/api';
import type { Plant } from '../types';

function Plants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    fetchPlants();
  }, []);

  const fetchPlants = async () => {
    try {
      const response = await plantsApi.getAll();
      setPlants(response.data);
    } catch (error) {
      console.error('Error fetching plants:', error);
      alert('Error fetching plants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPlant(null);
    setFormData({ name: '' });
    setShowModal(true);
  };

  const handleEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setFormData({ name: plant.name });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlant) {
        await plantsApi.update(editingPlant.id, formData);
      } else {
        await plantsApi.create(formData);
      }
      setShowModal(false);
      fetchPlants();
    } catch (error) {
      console.error('Error saving plant:', error);
      alert('Error saving plant');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this plant?')) return;
    try {
      await plantsApi.delete(id);
      fetchPlants();
    } catch (error) {
      console.error('Error deleting plant:', error);
      alert('Error deleting plant');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Plants</h1>
        <p>Manage your plants</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={handleCreate}>
          Add Plant
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((plant) => (
              <tr key={plant.id}>
                <td>{plant.id}</td>
                <td>{plant.name}</td>
                <td>{new Date(plant.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleEdit(plant)} style={{ marginRight: '10px' }}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(plant.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPlant ? 'Edit Plant' : 'Add Plant'}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPlant ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Plants;

