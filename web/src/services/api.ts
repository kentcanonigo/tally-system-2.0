import axios from 'axios';
import type {
  Customer,
  Plant,
  WeightClassification,
  TallySession,
  AllocationDetails,
} from '../types';

// Vite replaces import.meta.env.VITE_API_URL at build time
// If not set, fallback to localhost for local development
const API_BASE_URL = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  create: (data: Omit<TallySession, 'id' | 'created_at' | 'updated_at'>) =>
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
};

export default api;

