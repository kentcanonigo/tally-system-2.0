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
import { useResponsive } from '../utils/responsive';

function TallySessionDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const responsive = useResponsive();
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
  
  const formatWeightRange = (wc: WeightClassification): string => {
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'All Sizes';
    }
    if (wc.max_weight === null) {
      return `${wc.min_weight} and up`;
    }
    return `${wc.min_weight}-${wc.max_weight}`;
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

  const dynamicStyles = {
    container: {
      ...styles.container,
    },
    contentContainer: {
      ...styles.scrollContent,
      alignItems: responsive.isTablet ? 'center' as const : 'stretch' as const,
    },
    contentWrapper: {
      width: responsive.isTablet ? responsive.maxContentWidth : '100%',
      maxWidth: '100%',
    },
    header: {
      ...styles.header,
      padding: responsive.padding.medium,
      width: responsive.isTablet ? responsive.maxContentWidth : '100%',
      maxWidth: '100%',
    },
    sessionId: {
      ...styles.sessionId,
      fontSize: responsive.fontSize.medium,
    },
    infoCard: {
      ...styles.infoCard,
      padding: responsive.padding.medium,
      margin: responsive.spacing.md,
    },
    infoLabel: {
      ...styles.infoLabel,
      fontSize: responsive.fontSize.small,
      marginTop: responsive.spacing.md,
    },
    infoValue: {
      ...styles.infoValue,
      fontSize: responsive.fontSize.medium,
    },
    actions: {
      ...styles.actions,
      padding: responsive.spacing.md,
      flexDirection: responsive.isTablet ? 'row' as const : 'column' as const,
      width: responsive.isTablet ? responsive.maxContentWidth : '100%',
      maxWidth: '100%',
    },
    actionButton: {
      ...styles.actionButton,
      padding: responsive.padding.medium,
      marginHorizontal: responsive.isTablet ? responsive.spacing.sm : 0,
      marginVertical: responsive.isTablet ? 0 : responsive.spacing.sm,
    },
    actionButtonText: {
      ...styles.actionButtonText,
      fontSize: responsive.fontSize.small,
    },
    sectionTitle: {
      ...styles.sectionTitle,
      fontSize: responsive.fontSize.large,
      padding: responsive.padding.medium,
      paddingBottom: responsive.spacing.xs,
    },
    allocationCard: {
      ...styles.allocationCard,
      padding: responsive.padding.medium,
      margin: responsive.spacing.md,
    },
    allocationTitle: {
      ...styles.allocationTitle,
      fontSize: responsive.fontSize.medium,
    },
    allocationLabel: {
      ...styles.allocationLabel,
      fontSize: responsive.fontSize.small,
    },
    allocationValue: {
      ...styles.allocationValue,
      fontSize: responsive.fontSize.small,
    },
    modalContent: {
      ...styles.modalContent,
      padding: responsive.padding.large,
      width: responsive.isTablet ? Math.min(responsive.width * 0.6, 500) : '90%',
      maxHeight: responsive.isTablet ? '85%' : '80%',
    },
    modalTitle: {
      ...styles.modalTitle,
      fontSize: responsive.fontSize.large,
      marginBottom: responsive.spacing.lg,
    },
    label: {
      ...styles.label,
      fontSize: responsive.fontSize.small,
      marginTop: responsive.spacing.md,
      marginBottom: responsive.spacing.xs,
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
      fontSize: responsive.fontSize.small,
    },
    modalActions: {
      ...styles.modalActions,
      marginTop: responsive.spacing.lg,
      gap: responsive.spacing.md,
    },
    modalButton: {
      ...styles.modalButton,
      padding: responsive.padding.medium,
    },
    modalButtonText: {
      ...styles.modalButtonText,
      fontSize: responsive.fontSize.small,
    },
  };

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={dynamicStyles.contentContainer}>
      <View style={dynamicStyles.contentWrapper}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.sessionId}>Session #{session.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: session.status === 'ongoing' ? '#f39c12' : session.status === 'completed' ? '#27ae60' : '#e74c3c' }]}>
            <Text style={styles.statusText}>{session.status}</Text>
          </View>
        </View>

        <View style={dynamicStyles.infoCard}>
          <Text style={dynamicStyles.infoLabel}>Customer</Text>
          <Text style={dynamicStyles.infoValue}>{customer?.name}</Text>
          <Text style={dynamicStyles.infoLabel}>Plant</Text>
          <Text style={dynamicStyles.infoValue}>{plant?.name}</Text>
          <Text style={dynamicStyles.infoLabel}>Date</Text>
          <Text style={dynamicStyles.infoValue}>{new Date(session.date).toLocaleDateString()}</Text>
        </View>

        <View style={dynamicStyles.actions}>
          {session.status === 'ongoing' && (
            <>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, styles.completeButton]}
                onPress={() => handleUpdateStatus('completed')}
              >
                <Text style={dynamicStyles.actionButtonText}>Mark Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, styles.addButton]}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={dynamicStyles.actionButtonText}>Add Allocation</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={dynamicStyles.sectionTitle}>Allocations</Text>
        {allocations.length === 0 ? (
          <Text style={styles.emptyText}>No allocations yet</Text>
        ) : (
          <View style={responsive.isLargeTablet ? styles.allocationGrid : undefined}>
            {allocations.map((allocation) => {
              const difference = allocation.allocated_bags - allocation.required_bags;
              return (
                <View 
                  key={allocation.id} 
                  style={[
                    dynamicStyles.allocationCard,
                    responsive.isLargeTablet && { width: '45%', marginHorizontal: '2.5%' }
                  ]}
                >
                  <Text style={dynamicStyles.allocationTitle}>
                    {getWeightClassificationName(allocation.weight_classification_id)}
                  </Text>
                  <View style={styles.allocationRow}>
                    <Text style={dynamicStyles.allocationLabel}>Required:</Text>
                    <Text style={dynamicStyles.allocationValue}>{allocation.required_bags}</Text>
                  </View>
                  <View style={styles.allocationRow}>
                    <Text style={dynamicStyles.allocationLabel}>Allocated:</Text>
                    <Text style={dynamicStyles.allocationValue}>{allocation.allocated_bags}</Text>
                  </View>
                  <View style={styles.allocationRow}>
                    <Text style={dynamicStyles.allocationLabel}>Difference:</Text>
                    <Text style={[dynamicStyles.allocationValue, { color: difference >= 0 ? '#27ae60' : '#e74c3c' }]}>
                      {difference >= 0 ? '+' : ''}{difference.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showAddModal && (
        <View style={styles.modal}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Add Allocation</Text>
            <Text style={dynamicStyles.label}>Weight Classification</Text>
            <ScrollView style={dynamicStyles.pickerContainer}>
              {weightClassifications.map((wc) => (
                <TouchableOpacity
                  key={wc.id}
                  style={[
                    dynamicStyles.pickerOption,
                    formData.weight_classification_id === wc.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, weight_classification_id: wc.id })}
                >
                  <Text
                    style={[
                      dynamicStyles.pickerOptionText,
                      formData.weight_classification_id === wc.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {wc.classification} ({wc.category}) - {formatWeightRange(wc)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={dynamicStyles.label}>Required Bags</Text>
            <TextInput
              style={dynamicStyles.input}
              value={formData.required_bags}
              onChangeText={(text) => setFormData({ ...formData, required_bags: text })}
              keyboardType="numeric"
              placeholder="0"
            />
            <Text style={dynamicStyles.label}>Allocated Bags</Text>
            <TextInput
              style={dynamicStyles.input}
              value={formData.allocated_bags}
              onChangeText={(text) => setFormData({ ...formData, allocated_bags: text })}
              keyboardType="numeric"
              placeholder="0"
            />
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={dynamicStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.saveButton]}
                onPress={handleAddAllocation}
              >
                <Text style={dynamicStyles.modalButtonText}>Save</Text>
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
  },
  sessionId: {
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
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    color: '#7f8c8d',
  },
  infoValue: {
    color: '#2c3e50',
    fontWeight: '500',
  },
  actions: {
    flexGrow: 1,
  },
  actionButton: {
    flex: 1,
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
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    padding: 20,
  },
  allocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  allocationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  allocationTitle: {
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
    color: '#7f8c8d',
  },
  allocationValue: {
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
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  label: {
    fontWeight: '500',
    color: '#2c3e50',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
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
  modalActions: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
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

