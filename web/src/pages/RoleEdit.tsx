import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rolesApi, permissionsApi } from '../services/api';
import { RoleWithPermissions, Permission } from '../types';

export default function RoleEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [isSystem, setIsSystem] = useState(false);

  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all permissions
      const permsResponse = await permissionsApi.getAll();
      const permissions = permsResponse.data;

      // Group by category
      const grouped = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) {
          acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
      }, {} as Record<string, Permission[]>);
      setPermissionsByCategory(grouped);

      // Fetch role if editing
      if (!isNew) {
        const roleResponse = await rolesApi.getById(Number(id));
        const role: RoleWithPermissions = roleResponse.data;
        setName(role.name);
        setDescription(role.description || '');
        setIsSystem(role.is_system);
        setSelectedPermissions(role.permissions.map(p => p.id));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: number) => {
    if (isSystem) return; // Can't edit system roles

    if (selectedPermissions.includes(permissionId)) {
      setSelectedPermissions(selectedPermissions.filter(id => id !== permissionId));
    } else {
      setSelectedPermissions([...selectedPermissions, permissionId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Role name is required');
      return;
    }

    try {
      setSaving(true);
      
      if (isNew) {
        await rolesApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          permission_ids: selectedPermissions,
        });
      } else {
        await rolesApi.update(Number(id), {
          name: name.trim(),
          description: description.trim() || undefined,
          permission_ids: selectedPermissions,
        });
      }

      navigate('/roles');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? 'Create Role' : `Edit Role: ${name}`}</h1>
        <p>
          {isNew
            ? 'Define a new role and assign permissions.'
            : 'Update role details and manage its permissions.'}
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: '15px' }}
          onClick={() => navigate('/roles')}
        >
          ← Back to Roles
        </button>
      </div>

      {isSystem && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '4px',
            backgroundColor: '#fff8e5',
            border: '1px solid #f1c40f',
            color: '#7d6608',
          }}
        >
          This is a system role and cannot be edited. You can only view its permissions.
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '4px',
            backgroundColor: '#fdecea',
            border: '1px solid #f5c6cb',
            color: '#c0392b',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="table-container" style={{ padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '15px', color: '#2c3e50' }}>Role Details</h2>

          <div className="form-group">
            <label htmlFor="name">Role Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
              placeholder="e.g., Tally Operator"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSystem}
              rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
              placeholder="Describe the role and its responsibilities"
            />
          </div>
        </div>

        <div className="table-container" style={{ padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '10px', color: '#2c3e50' }}>Permissions</h2>
          <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '15px' }}>
            Select the permissions this role should have. Users with this role will inherit all selected
            permissions.
          </p>

          {Object.entries(permissionsByCategory).map(([category, permissions]) => (
            <div
              key={category}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                padding: '12px 15px',
                marginBottom: '15px',
                backgroundColor: '#fafafa',
              }}
            >
              <h3
                style={{
                  marginBottom: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  color: '#2c3e50',
                }}
              >
                {category}
              </h3>
              {category === 'tally' && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '10px 12px',
                    borderRadius: '4px',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    fontSize: '13px',
                    color: '#856404',
                  }}
                >
                  <strong>⚠️ Important:</strong> To create tally sessions, users must have <strong>all three</strong> of these permissions:{' '}
                  <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '3px' }}>can_start_tally</code>,{' '}
                  <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '3px' }}>can_edit_tally_session</code>, and{' '}
                  <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '3px' }}>can_edit_tally_entries</code>.
                </div>
              )}
              <div className="checkbox-group" style={{ maxHeight: '220px' }}>
                {permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className="checkbox-label"
                    style={isSystem ? { cursor: 'not-allowed', opacity: 0.7 } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(permission.id)}
                      onChange={() => handleTogglePermission(permission.id)}
                      disabled={isSystem}
                    />
                    <span>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{permission.name}</div>
                      {permission.description && (
                        <div style={{ fontSize: '13px', color: '#7f8c8d' }}>{permission.description}</div>
                      )}
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#95a5a6',
                          marginTop: '2px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {permission.code}
                      </div>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(permissionsByCategory).length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>
              No permissions available.
            </div>
          )}
        </div>

        {!isSystem && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : isNew ? 'Create Role' : 'Update Role'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/roles')}
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

