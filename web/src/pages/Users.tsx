import { useState, useEffect } from 'react';
import { usersApi, plantsApi } from '../services/api';
import { User, UserRole, Plant, UserCreateRequest, UserUpdateRequest } from '../types';
import '../App.css';

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: UserRole.ADMIN as UserRole,
    plant_ids: [] as number[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, plantsRes] = await Promise.all([
        usersApi.getAll(),
        plantsApi.getAll()
      ]);
      setUsers(usersRes.data);
      setPlants(plantsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: UserRole.ADMIN,
      plant_ids: [],
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      plant_ids: user.plant_ids,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (modalMode === 'create') {
        const createData: UserCreateRequest = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          plant_ids: formData.plant_ids,
        };
        await usersApi.create(createData);
      } else if (selectedUser) {
        const updateData: UserUpdateRequest = {
          username: formData.username,
          email: formData.email,
          role: formData.role,
          plant_ids: formData.plant_ids,
        };
        
        // Include password only if it's not empty
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        await usersApi.update(selectedUser.id, updateData);
      }

      await loadData();
      closeModal();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await usersApi.delete(userId);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const togglePlantSelection = (plantId: number) => {
    setFormData(prev => ({
      ...prev,
      plant_ids: prev.plant_ids.includes(plantId)
        ? prev.plant_ids.filter(id => id !== plantId)
        : [...prev.plant_ids, plantId]
    }));
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <p>Manage users and their permissions</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add User
        </button>
      </div>

      {error && !showModal && (
        <div className="error-message">{error}</div>
      )}

      <div className="table-container">
        <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Assigned Plants</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td>
                <span className={`badge ${user.role === UserRole.SUPERADMIN ? 'badge-primary' : 'badge-secondary'}`}>
                  {user.role}
                </span>
              </td>
              <td>
                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                {user.role === UserRole.SUPERADMIN ? (
                  <em>All plants</em>
                ) : (
                  <span>{user.plant_ids.length} plant(s)</span>
                )}
              </td>
              <td>
                <button
                  className="btn btn-secondary"
                  onClick={() => openEditModal(user)}
                  style={{ marginRight: '10px' }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(user.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {showModal && (
        <div className="modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Create New User' : 'Edit User'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="error-message">{error}</div>
              )}

              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password {modalMode === 'edit' && '(leave blank to keep current)'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={modalMode === 'create'}
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  required
                >
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SUPERADMIN}>Superadmin</option>
                </select>
              </div>

              {formData.role === UserRole.ADMIN && (
                <div className="form-group">
                  <label>Assigned Plants *</label>
                  <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #ddd', padding: '10px', borderRadius: '4px' }}>
                    {plants.map((plant) => (
                      <div key={plant.id} style={{ marginBottom: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formData.plant_ids.includes(plant.id)}
                            onChange={() => togglePlantSelection(plant.id)}
                            style={{ marginRight: '8px' }}
                          />
                          {plant.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.plant_ids.length === 0 && (
                    <small style={{ color: '#c33' }}>Please select at least one plant</small>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formData.role === UserRole.ADMIN && formData.plant_ids.length === 0}
                >
                  {modalMode === 'create' ? 'Create' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;

