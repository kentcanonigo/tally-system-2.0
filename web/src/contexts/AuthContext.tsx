import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, LoginRequest } from '../types';
import * as authService from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperadmin: boolean;
  isAdmin: boolean;
  refetchUser: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (authService.isAuthenticated()) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (err) {
          console.error('Failed to load user:', err);
          // Token might be invalid, clear it
          authService.removeToken();
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setError(null);
      setLoading(true);
      
      // Login and get token
      await authService.login(credentials);
      
      // Fetch user data
      const userData = await authService.getCurrentUser();
      setUser(userData);
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authService.logout();
  };

  const refetchUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to refetch user:', err);
      setUser(null);
      authService.removeToken();
    }
  };

  // Helper to check if user has a specific RBAC role
  const hasRole = (roleName: string): boolean => {
    if (!user) return false;
    // Check legacy role field first
    if (roleName === 'SUPERADMIN' && user.role === UserRole.SUPERADMIN) return true;
    if (roleName === 'ADMIN' && user.role === UserRole.ADMIN) return true;
    // Fallback: We need to fetch roles to check names, but for now we can check via permissions
    // SUPERADMIN users have all permissions, so we can infer from that
    // For a more robust check, we'd need to store role names in the user object
    if (!user.role_ids || user.role_ids.length === 0) return false;
    return (roleName === 'SUPERADMIN' && user.permissions && user.permissions.length >= 4);
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    // Check if user has SUPERADMIN role (they have all permissions)
    if (hasRole('SUPERADMIN')) return true;
    return user.permissions?.includes(permissionCode) || false;
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (!user) return false;
    if (hasRole('SUPERADMIN')) return true;
    return permissionCodes.some(code => user.permissions?.includes(code));
  };

  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    if (!user) return false;
    if (hasRole('SUPERADMIN')) return true;
    return permissionCodes.every(code => user.permissions?.includes(code));
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: user !== null,
    isSuperadmin: hasRole('SUPERADMIN'),
    isAdmin: hasRole('ADMIN') || hasRole('SUPERADMIN'),
    refetchUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

