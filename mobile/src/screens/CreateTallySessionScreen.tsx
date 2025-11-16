import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { customersApi, plantsApi, tallySessionsApi } from '../services/api';
import type { Customer, Plant } from '../types';
import { useResponsive } from '../utils/responsive';

function CreateTallySessionScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: 0,
    plant_id: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'ongoing' as const,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, plantsRes] = await Promise.all([
        customersApi.getAll(),
        plantsApi.getAll(),
      ]);
      setCustomers(customersRes.data);
      setPlants(plantsRes.data);
      if (customersRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, customer_id: customersRes.data[0].id }));
      }
      if (plantsRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, plant_id: plantsRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load customers and plants');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.customer_id || !formData.plant_id) {
      Alert.alert('Error', 'Please select a customer and plant');
      return;
    }

    setSubmitting(true);
    try {
      await tallySessionsApi.create(formData);
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
        <Text>Loading...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: {
      ...styles.container,
    },
    contentContainer: {
      ...styles.scrollContent,
      alignItems: responsive.isTablet ? 'center' as const : 'stretch' as const,
    },
    form: {
      ...styles.form,
      padding: responsive.padding.large,
      width: responsive.isTablet ? responsive.maxContentWidth : '100%',
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
          <View style={dynamicStyles.pickerContainer}>
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
          </View>
        </View>

        <View style={dynamicStyles.formGroup}>
          <Text style={dynamicStyles.label}>Plant</Text>
          <View style={dynamicStyles.pickerContainer}>
            {plants.map((plant) => (
              <TouchableOpacity
                key={plant.id}
                style={[
                  dynamicStyles.pickerOption,
                  formData.plant_id === plant.id && styles.pickerOptionSelected,
                ]}
                onPress={() => setFormData({ ...formData, plant_id: plant.id })}
              >
                <Text
                  style={[
                    dynamicStyles.pickerOptionText,
                    formData.plant_id === plant.id && styles.pickerOptionTextSelected,
                  ]}
                >
                  {plant.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
});

export default CreateTallySessionScreen;

