import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rolesApi } from '../services/api';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSuperadmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await rolesApi.getAll();
      setRoles(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roleId: number, roleName: string, isSystem: boolean) => {
    if (isSystem) {
      alert('Cannot delete system roles');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
      return;
    }

    try {
      await rolesApi.delete(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete role');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Roles</h1>
        <p>Manage system and custom roles and their permissions.</p>
      </div>

      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '14px', color: '#7f8c8d', maxWidth: '600px' }}>
          <p style={{ marginBottom: '4px' }}>
            Roles control what users can do in the system. System roles are built-in and cannot be edited or deleted.
          </p>
          <p style={{ marginBottom: 0 }}>
            Custom roles let you combine permissions to match your team&apos;s responsibilities.
          </p>
        </div>

        {isSuperadmin && (
          <button className="btn btn-primary" onClick={() => navigate('/roles/new')}>
            Create Role
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '4px',
            backgroundColor: '#fdecea',
            color: '#c0392b',
            border: '1px solid #f5c6cb',
          }}
        >
          {error}
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: 'center',
                    padding: '30px 15px',
                    color: '#7f8c8d',
                  }}
                >
                  No roles found.{' '}
                  {isSuperadmin
                    ? 'Create your first custom role to get started.'
                    : 'Contact a superadmin to configure roles.'}
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.description || '—'}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor: role.is_system ? '#e8f4fb' : '#e9f7ef',
                        color: role.is_system ? '#2c3e50' : '#1e8449',
                      }}
                    >
                      {role.is_system ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate(`/roles/${role.id}`)}
                      style={{ marginRight: '10px' }}
                    >
                      View / Edit
                    </button>
                    {!role.is_system && isSuperadmin && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(role.id, role.name, role.is_system)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


