import axios from 'axios';
import type {
  Customer,
  Plant,
  WeightClassification,
  TallySession,
  AllocationDetails,
  TallyLogEntry,
  TallyLogEntryRole,
  ExportRequest,
  ExportResponse,
  User,
  UserCreateRequest,
  UserUpdateRequest,
} from '../types';
import { getToken, removeToken } from './auth';

// Vite replaces import.meta.env.VITE_API_URL at build time
// If not set, fallback to localhost for local development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Customers API
export const customersApi = {
  getAll: () => api.get<Customer[]>('/customers'),
  getById: (id: number) => api.get<Customer>(`/customers/${id}`),
  create: (data: { name: string }) => api.post<Customer>('/customers', data),
  update: (id: number, data: { name?: string }) => api.put<Customer>(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
};

// Plants API
export const plantsApi = {
  getAll: () => api.get<Plant[]>('/plants'),
  getById: (id: number) => api.get<Plant>(`/plants/${id}`),
  create: (data: { name: string }) => api.post<Plant>('/plants', data),
  update: (id: number, data: { name?: string }) => api.put<Plant>(`/plants/${id}`, data),
  delete: (id: number) => api.delete(`/plants/${id}`),
};

// Weight Classifications API
export const weightClassificationsApi = {
  getByPlant: (plantId: number) =>
    api.get<WeightClassification[]>(`/plants/${plantId}/weight-classifications`),
  getById: (id: number) => api.get<WeightClassification>(`/weight-classifications/${id}`),
  create: (plantId: number, data: Omit<WeightClassification, 'id' | 'plant_id' | 'created_at' | 'updated_at'>) =>
    api.post<WeightClassification>(`/plants/${plantId}/weight-classifications`, { ...data, plant_id: plantId }),
  update: (id: number, data: Partial<WeightClassification>) =>
    api.put<WeightClassification>(`/weight-classifications/${id}`, data),
  delete: (id: number) => api.delete(`/weight-classifications/${id}`),
};

// Tally Sessions API
export const tallySessionsApi = {
  getAll: (params?: { customer_id?: number; plant_id?: number; status?: string }) =>
    api.get<TallySession[]>('/tally-sessions', { params }),
  getById: (id: number) => api.get<TallySession>(`/tally-sessions/${id}`),
  create: (data: Omit<TallySession, 'id' | 'session_number' | 'created_at' | 'updated_at'>) =>
    api.post<TallySession>('/tally-sessions', data),
  update: (id: number, data: Partial<TallySession>) =>
    api.put<TallySession>(`/tally-sessions/${id}`, data),
  delete: (id: number) => api.delete(`/tally-sessions/${id}`),
};

// Allocation Details API
export const allocationDetailsApi = {
  getBySession: (sessionId: number) =>
    api.get<AllocationDetails[]>(`/tally-sessions/${sessionId}/allocations`),
  getById: (id: number) => api.get<AllocationDetails>(`/allocations/${id}`),
  create: (sessionId: number, data: Omit<AllocationDetails, 'id' | 'tally_session_id' | 'created_at' | 'updated_at'>) =>
    api.post<AllocationDetails>(`/tally-sessions/${sessionId}/allocations`, {
      ...data,
      tally_session_id: sessionId,
    }),
  update: (id: number, data: Partial<AllocationDetails>) =>
    api.put<AllocationDetails>(`/allocations/${id}`, data),
  delete: (id: number) => api.delete(`/allocations/${id}`),
  resetTally: (sessionId: number) =>
    api.post<{ message: string; allocations_updated: number; log_entries_deleted: number }>(`/tally-sessions/${sessionId}/allocations/reset-tally`),
  resetDispatcher: (sessionId: number) =>
    api.post<{ message: string; allocations_updated: number; log_entries_deleted: number }>(`/tally-sessions/${sessionId}/allocations/reset-dispatcher`),
};

// Tally Log Entries API
export const tallyLogEntriesApi = {
  create: (sessionId: number, data: { weight_classification_id: number; role: TallyLogEntryRole; weight: number; heads?: number; notes?: string | null }) =>
    api.post<TallyLogEntry>(`/tally-sessions/${sessionId}/log-entries`, {
      ...data,
      tally_session_id: sessionId,
    }),
  getBySession: (sessionId: number, role?: TallyLogEntryRole) =>
    api.get<TallyLogEntry[]>(`/tally-sessions/${sessionId}/log-entries`, {
      params: role ? { role } : undefined,
    }),
  getById: (entryId: number) =>
    api.get<TallyLogEntry>(`/log-entries/${entryId}`),
};

// Export API
export const exportApi = {
  exportSessions: (data: ExportRequest) =>
    api.post<ExportResponse>('/export/sessions', data),
};

// Users API (superadmin only)
export const usersApi = {
  getAll: () => api.get<User[]>('/users'),
  getById: (id: number) => api.get<User>(`/users/${id}`),
  create: (data: UserCreateRequest) => api.post<User>('/users', data),
  update: (id: number, data: UserUpdateRequest) => api.put<User>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export default api;

