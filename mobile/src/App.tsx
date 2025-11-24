import React, { useState, useEffect } from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, View, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './contexts/AuthContext';
import { TimezoneProvider } from './contexts/TimezoneContext';
import { PlantProvider } from './contexts/PlantContext';
import AppNavigator from './navigation/AppNavigator';

// Get API Base URL
const getApiBaseUrl = async (): Promise<string> => {
  const __DEV__ = !Constants.expoConfig?.extra?.production;
  
  if (!__DEV__) {
    return 'https://tally-system-api-awdvavfdgtexhyhu.southeastasia-01.azurewebsites.net/api/v1';
  }

  // Check for manually configured IP in AsyncStorage first
  try {
    const manualIp = await AsyncStorage.getItem('API_HOST_IP');
    if (manualIp) {
      return `http://${manualIp}:8000/api/v1`;
    }
  } catch (error) {
    console.warn('[API] Could not read manual IP from storage:', error);
  }

  // Try to get the debugger host IP (for physical devices)
  try {
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
    if (hostUri) {
      const match = hostUri.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        return `http://${match[1]}:8000/api/v1`;
      }
    }
  } catch (error) {
    console.warn('[API] Could not get debugger host:', error);
  }

  // Fallback to emulator/simulator addresses
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  } else {
    return 'http://localhost:8000/api/v1';
  }
};

function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    getApiBaseUrl().then(url => {
      console.log('[App] API Base URL:', url);
      setApiBaseUrl(url);
    });
  }, []);

  if (!apiBaseUrl) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider apiBaseUrl={apiBaseUrl}>
        <TimezoneProvider>
          <PlantProvider>
            <AppNavigator />
          </PlantProvider>
        </TimezoneProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;

registerRootComponent(App);

