import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { setApiBaseUrl } from '../services/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isSavingApiUrl, setIsSavingApiUrl] = useState(false);
  const { login, loading, error } = useAuth();

  // Load current API URL from storage on mount
  useEffect(() => {
    const loadApiUrl = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem('API_BASE_URL');
        setApiUrl(storedUrl || '');
      } catch (error) {
        console.error('Error loading API URL:', error);
      }
    };
    loadApiUrl();
  }, []);

  const handleApiUrlChange = async (url: string) => {
    setApiUrl(url);
  };

  const handleApiUrlBlur = async () => {
    if (isSavingApiUrl) return;
    
    setIsSavingApiUrl(true);
    try {
      const urlToSave = apiUrl.trim() || null;
      await setApiBaseUrl(urlToSave);
      // Update local state to reflect what was saved
      setApiUrl(urlToSave || '');
    } catch (error: any) {
      console.error('Error saving API URL:', error);
      // Revert to stored value on error
      const storedUrl = await AsyncStorage.getItem('API_BASE_URL');
      setApiUrl(storedUrl || '');
      Alert.alert('Error', error.message || 'Failed to save API URL');
    } finally {
      setIsSavingApiUrl(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    // Save API URL if it was changed
    if (isSavingApiUrl === false) {
      const urlToSave = apiUrl.trim() || null;
      const currentStoredUrl = await AsyncStorage.getItem('API_BASE_URL');
      if (urlToSave !== currentStoredUrl) {
        try {
          await setApiBaseUrl(urlToSave);
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to save API URL');
          return;
        }
      }
    }

    try {
      await login({ username, password });
      // Navigation will handle automatically after successful login
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.formContainer}>
        <Text style={styles.title}>Tally System</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Backend URL (Optional)</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={handleApiUrlChange}
            onBlur={handleApiUrlBlur}
            placeholder="https://example.com/api/v1"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !isSavingApiUrl}
          />
          {apiUrl.trim() && (
            <Text style={styles.helperText}>
              Leave empty to use default URL
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || isSavingApiUrl}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>Default credentials:</Text>
          <Text style={styles.infoText}>Username: admin</Text>
          <Text style={styles.infoText}>Password: admin123</Text>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c00',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 30,
    padding: 16,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

