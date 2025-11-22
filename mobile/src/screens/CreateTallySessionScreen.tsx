import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { customersApi, tallySessionsApi } from '../services/api';
import type { Customer } from '../types';
import { useResponsive } from '../utils/responsive';
import { usePlant } from '../contexts/PlantContext';

function CreateTallySessionScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { activePlantId } = usePlant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'ongoing' as const,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const customersRes = await customersApi.getAll();
      setCustomers(customersRes.data);
      if (customersRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, customer_id: customersRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!activePlantId) {
      Alert.alert('Error', 'No active plant selected. Please select a plant in Settings.');
      return;
    }
    if (!formData.customer_id) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    setSubmitting(true);
    try {
      await tallySessionsApi.create({
        ...formData,
        plant_id: activePlantId,
      });
      Alert.alert('Success', 'Tally session created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error creating session:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create tally session');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (!activePlantId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Please select an active plant in Settings to create a session.</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: {
      ...styles.container,
    },
    contentContainer: {
      ...styles.scrollContent,
    },
    form: {
      ...styles.form,
      padding: responsive.padding.large,
      width: '100%',
      maxWidth: '100%',
    },
    formGroup: {
      ...styles.formGroup,
      marginBottom: responsive.spacing.lg,
    },
    label: {
      ...styles.label,
      fontSize: responsive.fontSize.medium,
      marginBottom: responsive.spacing.md,
    },
    input: {
      ...styles.input,
      padding: responsive.padding.medium,
      fontSize: responsive.fontSize.medium,
    },
    pickerContainer: {
      ...styles.pickerContainer,
      maxHeight: responsive.isTablet ? 200 : 150,
    },
    pickerOption: {
      ...styles.pickerOption,
      padding: responsive.padding.medium,
    },
    pickerOptionText: {
      ...styles.pickerOptionText,
      fontSize: responsive.fontSize.medium,
    },
    submitButton: {
      ...styles.submitButton,
      padding: responsive.padding.medium,
      marginTop: responsive.spacing.lg,
      maxWidth: responsive.isTablet ? 400 : undefined,
      alignSelf: responsive.isTablet ? 'center' as const : 'stretch' as const,
    },
    submitButtonText: {
      ...styles.submitButtonText,
      fontSize: responsive.fontSize.medium,
    },
  };

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={dynamicStyles.contentContainer}>
      <View style={dynamicStyles.form}>
        <View style={dynamicStyles.formGroup}>
          <Text style={dynamicStyles.label}>Customer</Text>
          <ScrollView style={dynamicStyles.pickerContainer} nestedScrollEnabled={true}>
            {customers.map((customer) => (
              <TouchableOpacity
                key={customer.id}
                style={[
                  dynamicStyles.pickerOption,
                  formData.customer_id === customer.id && styles.pickerOptionSelected,
                ]}
                onPress={() => setFormData({ ...formData, customer_id: customer.id })}
              >
                <Text
                  style={[
                    dynamicStyles.pickerOptionText,
                    formData.customer_id === customer.id && styles.pickerOptionTextSelected,
                  ]}
                >
                  {customer.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={dynamicStyles.formGroup}>
          <Text style={dynamicStyles.label}>Date</Text>
          <TextInput
            style={dynamicStyles.input}
            value={formData.date}
            onChangeText={(text) => setFormData({ ...formData, date: text })}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <TouchableOpacity
          style={[dynamicStyles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={dynamicStyles.submitButtonText}>
            {submitting ? 'Creating...' : 'Create Session'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    flexGrow: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '500',
    color: '#2c3e50',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerOptionSelected: {
    backgroundColor: '#3498db',
  },
  pickerOptionText: {
    color: '#2c3e50',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default CreateTallySessionScreen;
