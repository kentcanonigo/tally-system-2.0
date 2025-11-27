import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { User, LoginRequest, AuthResponse, UserRole, UserPreferencesUpdate } from '../types';

const TOKEN_KEY = 'tally_system_token';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isSuperadmin: boolean;
  token: string | null;
  refetchUser: () => Promise<void>;
  updatePreferences: (preferences: UserPreferencesUpdate) => Promise<void>;
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
  apiBaseUrl: string;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, apiBaseUrl }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load token and user on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
          await fetchUserData(storedToken);
        }
      } catch (err) {
        console.error('Failed to load auth:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAuth();
  }, []);

  const fetchUserData = async (authToken: string) => {
    try {
      const response = await axios.get<User>(`${apiBaseUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      setUser(response.data);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      // Token might be invalid, clear it
      await logout();
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      setError(null);
      setLoading(true);

      // Login and get token
      const loginResponse = await axios.post<AuthResponse>(
        `${apiBaseUrl}/auth/login`,
        credentials
      );

      const newToken = loginResponse.data.access_token;
      
      // Store token
      await AsyncStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);

      // Fetch user data
      await fetchUserData(newToken);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  const refetchUser = async () => {
    if (token) {
      try {
        await fetchUserData(token);
      } catch (err) {
        console.error('Failed to refetch user:', err);
        await logout();
      }
    }
  };

  const updatePreferences = async (preferences: UserPreferencesUpdate) => {
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    try {
      // Don't set loading state for preference updates to avoid navigation resets
      const response = await axios.put<User>(
        `${apiBaseUrl}/auth/me/preferences`,
        preferences,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setUser(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to update preferences';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Helper to check if user has a specific RBAC role
  const hasRole = (roleName: string): boolean => {
    if (!user || !user.role_ids || user.role_ids.length === 0) return false;
    // For SUPERADMIN, check via legacy field or permissions count (they have all permissions)
    return user.role === UserRole.SUPERADMIN || 
           (roleName === 'SUPERADMIN' && user.permissions && user.permissions.length >= 4);
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
    token,
    refetchUser,
    updatePreferences,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

