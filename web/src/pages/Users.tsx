import { useState, useEffect } from 'react';
import { usersApi, plantsApi, rolesApi } from '../services/api';
import { User, Plant, Role, UserCreateRequest, UserUpdateRequest } from '../types';
import '../App.css';

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
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
    plant_ids: [] as number[],
    role_ids: [] as number[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, plantsRes, rolesRes] = await Promise.all([
        usersApi.getAll(),
        plantsApi.getAll(),
        rolesApi.getAll()
      ]);
      setUsers(usersRes.data);
      setPlants(plantsRes.data);
      setRoles(rolesRes.data);
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
      plant_ids: [],
      role_ids: [],
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
      plant_ids: user.plant_ids,
      role_ids: user.role_ids || [],
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

    // Validation: ensure at least one role is assigned
    if (formData.role_ids.length === 0) {
      setError('Please assign at least one role to the user');
      return;
    }

    try {
      if (modalMode === 'create') {
        const createData: UserCreateRequest = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          plant_ids: formData.plant_ids,
          role_ids: formData.role_ids,
        };
        await usersApi.create(createData);
      } else if (selectedUser) {
        const updateData: UserUpdateRequest = {
          username: formData.username,
          email: formData.email,
          plant_ids: formData.plant_ids,
          role_ids: formData.role_ids,
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
      // Handle different error formats
      let errorMessage = 'Operation failed';
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        // Check if detail is an array of validation errors (Pydantic format)
        if (Array.isArray(detail)) {
          errorMessage = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
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

  const toggleRoleSelection = (roleId: number) => {
    setFormData(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...prev.role_ids, roleId]
    }));
  };

  // Helper to check if user has SUPERADMIN role (for plant access check)
  const userHasSuperadminRole = (roleIds: number[]) => {
    return roleIds.some(id => {
      const role = roles.find(r => r.id === id);
      return role?.name === 'SUPERADMIN';
    });
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
            <th>Roles</th>
            <th>Permissions</th>
            <th>Status</th>
            <th>Plant Access</th>
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
                {user.role_ids && user.role_ids.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {user.role_ids.map((roleId) => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <span 
                          key={roleId} 
                          className={`badge ${role.is_system ? 'badge-primary' : 'badge-info'}`}
                          style={{ fontSize: '11px' }}
                        >
                          {role.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <em style={{ color: '#95a5a6' }}>No roles</em>
                )}
              </td>
              <td>
                <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                  {user.permissions && user.permissions.length > 0 
                    ? `${user.permissions.length} permission(s)` 
                    : 'None'}
                </span>
              </td>
              <td>
                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                {userHasSuperadminRole(user.role_ids || []) ? (
                  <em style={{ color: '#3498db' }}>All plants</em>
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
                <label>Assigned Roles *</label>
                <div className="checkbox-group" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {roles.map((role) => (
                    <label key={role.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.role_ids.includes(role.id)}
                        onChange={() => toggleRoleSelection(role.id)}
                      />
                      <span>
                        {role.name}
                        {role.is_system && (
                          <span style={{ 
                            marginLeft: '6px', 
                            fontSize: '11px', 
                            color: '#7f8c8d',
                            fontStyle: 'italic' 
                          }}>
                            (System)
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {formData.role_ids.length === 0 && (
                  <small style={{ color: '#e74c3c', display: 'block', marginTop: '5px' }}>
                    Please select at least one role
                  </small>
                )}
                <small style={{ color: '#7f8c8d', display: 'block', marginTop: '4px' }}>
                  Users inherit all permissions from their assigned roles. Select multiple roles as needed.
                </small>
              </div>

              {!userHasSuperadminRole(formData.role_ids) && (
                <div className="form-group">
                  <label>Assigned Plants *</label>
                  <div className="checkbox-group">
                    {plants.map((plant) => (
                      <label key={plant.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.plant_ids.includes(plant.id)}
                          onChange={() => togglePlantSelection(plant.id)}
                        />
                        <span>{plant.name}</span>
                      </label>
                    ))}
                  </div>
                  {formData.plant_ids.length === 0 && (
                    <small style={{ color: '#e74c3c', display: 'block', marginTop: '5px' }}>
                      Please select at least one plant (SUPERADMIN role has access to all plants)
                    </small>
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
                  disabled={
                    formData.role_ids.length === 0 || 
                    (!userHasSuperadminRole(formData.role_ids) && formData.plant_ids.length === 0)
                  }
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

