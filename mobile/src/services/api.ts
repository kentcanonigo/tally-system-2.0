import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Customer,
  Plant,
  WeightClassification,
  TallySession,
  AllocationDetails,
  TallyLogEntry,
  TallyLogEntryRole,
} from '../types';

// Get the debugger host IP from Expo Constants (works for physical devices)
const getDebuggerHost = (): string | null => {
  try {
    // Try multiple sources for the host IP
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
    const experienceUrl = Constants.experienceUrl;
    
    // Check hostUri first (format: "192.168.1.100:8081" or "exp://192.168.1.100:8081")
    if (hostUri) {
      const match = hostUri.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        console.log('[API] Using hostUri IP:', match[1]);
        return match[1];
      }
    }
    
    // Check experienceUrl (format: "exp://192.168.1.100:8081")
    if (experienceUrl) {
      const match = experienceUrl.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        console.log('[API] Using experienceUrl IP:', match[1]);
        return match[1];
      }
    }
    
    // Debug logging
    console.log('[API] Debug - hostUri:', hostUri);
    console.log('[API] Debug - experienceUrl:', experienceUrl);
    console.log('[API] Debug - expoConfig:', Constants.expoConfig);
    console.log('[API] Debug - manifest:', Constants.manifest);
  } catch (error) {
    console.warn('[API] Could not get debugger host:', error);
  }
  return null;
};

// For Android emulator, use 10.0.2.2 to reach localhost
// For iOS simulator, use localhost
// For physical device, use the debugger host IP from Expo Constants
// You can also manually set the IP by storing it in AsyncStorage with key 'API_HOST_IP'
const getApiBaseUrl = async (): Promise<string> => {
  if (!__DEV__) {
    return 'https://tally-system-api-awdvavfdgtexhyhu.southeastasia-01.azurewebsites.net/api/v1';
  }

  // Check for manually configured IP in AsyncStorage first
  try {
    const manualIp = await AsyncStorage.getItem('API_HOST_IP');
    if (manualIp) {
      console.log('[API] Using manually configured IP:', manualIp);
      return `http://${manualIp}:8000/api/v1`;
    }
  } catch (error) {
    console.warn('[API] Could not read manual IP from storage:', error);
  }

  // Try to get the debugger host IP (for physical devices)
  const debuggerHost = getDebuggerHost();
  if (debuggerHost) {
    return `http://${debuggerHost}:8000/api/v1`;
  }

  // Fallback to emulator/simulator addresses
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  } else {
    return 'http://localhost:8000/api/v1';
  }
};

// Initialize API base URL (will be set asynchronously)
let API_BASE_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:8000/api/v1' 
  : 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set the API base URL asynchronously after api is created
getApiBaseUrl().then(url => {
  API_BASE_URL = url;
  console.log('[API] Base URL set to:', API_BASE_URL);
  // Update axios default baseURL
  api.defaults.baseURL = API_BASE_URL;
});

// Export function to manually set API host IP
export const setApiHostIp = async (ip: string) => {
  try {
    await AsyncStorage.setItem('API_HOST_IP', ip);
    const newUrl = `http://${ip}:8000/api/v1`;
    api.defaults.baseURL = newUrl;
    console.log('[API] Manually set API URL to:', newUrl);
    return newUrl;
  } catch (error) {
    console.error('[API] Error setting manual IP:', error);
    throw error;
  }
};

// Customers API
export const customersApi = {
  getAll: () => api.get<Customer[]>('/customers'),
  getById: (id: number) => api.get<Customer>(`/customers/${id}`),
};

// Plants API
export const plantsApi = {
  getAll: () => api.get<Plant[]>('/plants'),
  getById: (id: number) => api.get<Plant>(`/plants/${id}`),
};

// Weight Classifications API
export const weightClassificationsApi = {
  getByPlant: (plantId: number) =>
    api.get<WeightClassification[]>(`/plants/${plantId}/weight-classifications`),
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

// Tally Log Entries API
export const tallyLogEntriesApi = {
  create: (sessionId: number, data: { weight_classification_id: number; role: TallyLogEntryRole; weight: number; notes?: string | null }) =>
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
  delete: (entryId: number) =>
    api.delete(`/log-entries/${entryId}`),
};

// Cache helpers
export const cacheApi = {
  set: async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  },
  get: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  },
};

export default api;

