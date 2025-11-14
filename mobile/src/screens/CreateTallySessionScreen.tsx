import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { customersApi, plantsApi, tallySessionsApi } from '../services/api';
import type { Customer, Plant } from '../types';

function CreateTallySessionScreen() {
  const navigation = useNavigation();
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Customer</Text>
          <View style={styles.pickerContainer}>
            {customers.map((customer) => (
              <TouchableOpacity
                key={customer.id}
                style={[
                  styles.pickerOption,
                  formData.customer_id === customer.id && styles.pickerOptionSelected,
                ]}
                onPress={() => setFormData({ ...formData, customer_id: customer.id })}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    formData.customer_id === customer.id && styles.pickerOptionTextSelected,
                  ]}
                >
                  {customer.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Plant</Text>
          <View style={styles.pickerContainer}>
            {plants.map((plant) => (
              <TouchableOpacity
                key={plant.id}
                style={[
                  styles.pickerOption,
                  formData.plant_id === plant.id && styles.pickerOptionSelected,
                ]}
                onPress={() => setFormData({ ...formData, plant_id: plant.id })}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    formData.plant_id === plant.id && styles.pickerOptionTextSelected,
                  ]}
                >
                  {plant.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={formData.date}
            onChangeText={(text) => setFormData({ ...formData, date: text })}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
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
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerOptionSelected: {
    backgroundColor: '#3498db',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateTallySessionScreen;

