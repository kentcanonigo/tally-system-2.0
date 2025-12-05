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

// Polyfill for Base64 if not available (needed for xlsx library in React Native)
// This must be set before any modules that use Base64 are imported
if (typeof (global as any).Base64 === 'undefined') {
  (global as any).Base64 = {
    encode: (input: string) => {
      // Simple base64 encode using btoa if available, otherwise manual implementation
      if (typeof btoa !== 'undefined') {
        return btoa(input);
      }
      // Manual base64 encoding fallback
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = input;
      let output = '';
      for (let i = 0; i < str.length; i += 3) {
        const a = str.charCodeAt(i);
        const b = str.charCodeAt(i + 1) || 0;
        const c = str.charCodeAt(i + 2) || 0;
        const bitmap = (a << 16) | (b << 8) | c;
        output += chars.charAt((bitmap >> 18) & 63);
        output += chars.charAt((bitmap >> 12) & 63);
        output += i + 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        output += i + 2 < str.length ? chars.charAt(bitmap & 63) : '=';
      }
      return output;
    },
    decode: (input: string) => {
      if (typeof atob !== 'undefined') {
        return atob(input);
      }
      // Manual base64 decoding fallback
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      let output = '';
      for (let i = 0; i < str.length; i += 4) {
        const enc1 = chars.indexOf(str.charAt(i));
        const enc2 = chars.indexOf(str.charAt(i + 1));
        const enc3 = chars.indexOf(str.charAt(i + 2));
        const enc4 = chars.indexOf(str.charAt(i + 3));
        const bitmap = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
        output += String.fromCharCode((bitmap >> 16) & 255);
        if (enc3 !== 64) output += String.fromCharCode((bitmap >> 8) & 255);
        if (enc4 !== 64) output += String.fromCharCode(bitmap & 255);
      }
      return output;
    }
  };
}

// Get API Base URL (must match the logic in api.ts)
const getApiBaseUrl = async (): Promise<string> => {
  const __DEV__ = !Constants.expoConfig?.extra?.production;
  
  if (!__DEV__) {
    // In production, check for manually configured URL first
    try {
      const manualUrl = await AsyncStorage.getItem('API_BASE_URL');
      if (manualUrl) {
        console.log('[App] Using manually configured URL:', manualUrl);
        return manualUrl;
      }
    } catch (error) {
      console.warn('[App] Could not read manual URL from storage:', error);
    }
    return 'https://tally-system-api-awdvavfdgtexhyhu.southeastasia-01.azurewebsites.net/api/v1';
  }

  // Check for manually configured full URL in AsyncStorage first (highest priority)
  try {
    const manualUrl = await AsyncStorage.getItem('API_BASE_URL');
    if (manualUrl) {
      console.log('[App] Using manually configured URL:', manualUrl);
      return manualUrl;
    }
  } catch (error) {
    console.warn('[App] Could not read manual URL from storage:', error);
  }

  // Check for manually configured IP in AsyncStorage (legacy support)
  try {
    const manualIp = await AsyncStorage.getItem('API_HOST_IP');
    if (manualIp) {
      console.log('[App] Using manually configured IP:', manualIp);
      return `http://${manualIp}:8000/api/v1`;
    }
  } catch (error) {
    console.warn('[App] Could not read manual IP from storage:', error);
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
    console.warn('[App] Could not get debugger host:', error);
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

