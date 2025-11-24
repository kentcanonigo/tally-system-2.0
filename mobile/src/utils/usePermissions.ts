import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

/**
 * Custom hook for checking user permissions in the mobile app.
 * Works with the RBAC system to control access to features.
 * 
 * This is a convenience wrapper around the AuthContext permission functions.
 */
export const usePermissions = () => {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  
  return {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
};

