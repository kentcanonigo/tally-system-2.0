import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  tallySessionsApi,
  allocationDetailsApi,
  customersApi,
  plantsApi,
  weightClassificationsApi,
} from '../services/api';
import type { TallySession, AllocationDetails, Customer, Plant, WeightClassification } from '../types';

function TallySessionDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const sessionId = (route.params as any)?.sessionId;
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [allocations, setAllocations] = useState<AllocationDetails[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    weight_classification_id: 0,
    required_bags: '',
    allocated_bags: '',
  });

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sessionRes = await tallySessionsApi.getById(sessionId);
      const sessionData = sessionRes.data;
      setSession(sessionData);

      const [customerRes, plantRes, allocationsRes, wcRes] = await Promise.all([
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        allocationDetailsApi.getBySession(sessionId),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ]);

      setCustomer(customerRes.data);
      setPlant(plantRes.data);
      setAllocations(allocationsRes.data);
      setWeightClassifications(wcRes.data);
      if (wcRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, weight_classification_id: wcRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllocation = async () => {
    if (!formData.weight_classification_id || !formData.required_bags || !formData.allocated_bags) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      await allocationDetailsApi.create(sessionId, {
        weight_classification_id: formData.weight_classification_id,
        required_bags: parseFloat(formData.required_bags),
        allocated_bags: parseFloat(formData.allocated_bags),
      });
      setShowAddModal(false);
      setFormData({ weight_classification_id: weightClassifications[0]?.id || 0, required_bags: '', allocated_bags: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating allocation:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create allocation');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!session) return;
    try {
      await tallySessionsApi.update(session.id, { status: status as any });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getWeightClassificationName = (wcId: number) => {
    return weightClassifications.find((wc) => wc.id === wcId)?.classification || `WC ${wcId}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Session not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sessionId}>Session #{session.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: session.status === 'ongoing' ? '#f39c12' : session.status === 'completed' ? '#27ae60' : '#e74c3c' }]}>
          <Text style={styles.statusText}>{session.status}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Customer</Text>
        <Text style={styles.infoValue}>{customer?.name}</Text>
        <Text style={styles.infoLabel}>Plant</Text>
        <Text style={styles.infoValue}>{plant?.name}</Text>
        <Text style={styles.infoLabel}>Date</Text>
        <Text style={styles.infoValue}>{new Date(session.date).toLocaleDateString()}</Text>
      </View>

      <View style={styles.actions}>
        {session.status === 'ongoing' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleUpdateStatus('completed')}
            >
              <Text style={styles.actionButtonText}>Mark Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.actionButtonText}>Add Allocation</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Allocations</Text>
      {allocations.length === 0 ? (
        <Text style={styles.emptyText}>No allocations yet</Text>
      ) : (
        allocations.map((allocation) => {
          const difference = allocation.allocated_bags - allocation.required_bags;
          return (
            <View key={allocation.id} style={styles.allocationCard}>
              <Text style={styles.allocationTitle}>
                {getWeightClassificationName(allocation.weight_classification_id)}
              </Text>
              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>Required:</Text>
                <Text style={styles.allocationValue}>{allocation.required_bags}</Text>
              </View>
              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>Allocated:</Text>
                <Text style={styles.allocationValue}>{allocation.allocated_bags}</Text>
              </View>
              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>Difference:</Text>
                <Text style={[styles.allocationValue, { color: difference >= 0 ? '#27ae60' : '#e74c3c' }]}>
                  {difference >= 0 ? '+' : ''}{difference.toFixed(2)}
                </Text>
              </View>
            </View>
          );
        })
      )}

      {showAddModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Allocation</Text>
            <Text style={styles.label}>Weight Classification</Text>
            <ScrollView style={styles.pickerContainer}>
              {weightClassifications.map((wc) => (
                <TouchableOpacity
                  key={wc.id}
                  style={[
                    styles.pickerOption,
                    formData.weight_classification_id === wc.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, weight_classification_id: wc.id })}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      formData.weight_classification_id === wc.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {wc.classification} ({wc.category})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Required Bags</Text>
            <TextInput
              style={styles.input}
              value={formData.required_bags}
              onChangeText={(text) => setFormData({ ...formData, required_bags: text })}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={styles.label}>Allocated Bags</Text>
            <TextInput
              style={styles.input}
              value={formData.allocated_bags}
              onChangeText={(text) => setFormData({ ...formData, allocated_bags: text })}
              keyboardType="numeric"
              placeholder="0"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddAllocation}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2c3e50',
  },
  sessionId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 10,
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#27ae60',
  },
  addButton: {
    backgroundColor: '#3498db',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    padding: 15,
    paddingBottom: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    padding: 20,
  },
  allocationCard: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  allocationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  allocationLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  allocationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerContainer: {
    maxHeight: 150,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  pickerOptionSelected: {
    backgroundColor: '#3498db',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#3498db',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default TallySessionDetailScreen;

