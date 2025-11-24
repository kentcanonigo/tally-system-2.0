import axios from 'axios';
import type { LoginRequest, AuthResponse, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const TOKEN_KEY = 'tally_system_token';

// Token management
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};

// Authentication API calls
export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  const response = await axios.post<AuthResponse>(
    `${API_BASE_URL}/auth/login`,
    credentials
  );
  
  // Store token
  setToken(response.data.access_token);
  
  return response.data;
};

export const logout = (): void => {
  removeToken();
  // Redirect to login page
  window.location.href = '/login';
};

export const getCurrentUser = async (): Promise<User> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  const response = await axios.get<User>(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  return response.data;
};

