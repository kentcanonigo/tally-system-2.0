import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';
import { weightClassificationsApi } from '../services/api';
import type { WeightClassification } from '../types';
import { useResponsive } from '../utils/responsive';
import { usePlant } from '../contexts/PlantContext';
import { usePermissions } from '../utils/usePermissions';

function WeightClassificationsScreen() {
  const responsive = useResponsive();
  const { activePlantId } = usePlant();
  const { hasPermission } = usePermissions();
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWC, setEditingWC] = useState<WeightClassification | null>(null);
  
  // Form state
  const [classification, setClassification] = useState('');
  const [description, setDescription] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [category, setCategory] = useState<'Dressed' | 'Byproduct'>('Dressed');

  useEffect(() => {
    if (activePlantId) {
      fetchData();
    } else {
      setWeightClassifications([]);
      setLoading(false);
    }
  }, [activePlantId]);

  const fetchData = async (showLoading = true) => {
    if (!activePlantId) return;
    
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await weightClassificationsApi.getByPlant(activePlantId);
      setWeightClassifications(response.data);
    } catch (error) {
      console.error('Error fetching weight classifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(false);
  };

  const handleAdd = () => {
    if (!activePlantId) {
      Alert.alert('Error', 'Please select an active plant in Settings first.');
      return;
    }
    setEditingWC(null);
    setClassification('');
    setDescription('');
    setMinWeight('');
    setMaxWeight('');
    setCategory('Dressed');
    setModalVisible(true);
  };

  const handleEdit = (wc: WeightClassification) => {
    setEditingWC(wc);
    setClassification(wc.classification);
    setDescription(wc.description || '');
    setMinWeight(wc.min_weight?.toString() || '');
    setMaxWeight(wc.max_weight?.toString() || '');
    setCategory(wc.category as 'Dressed' | 'Byproduct');
    setModalVisible(true);
  };

  const handleDelete = (wc: WeightClassification) => {
    Alert.alert(
      'Delete Weight Classification',
      `Are you sure you want to delete ${wc.classification}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await weightClassificationsApi.delete(wc.id);
              fetchData(false);
            } catch (error: any) {
              console.error('Error deleting weight classification:', error);
              const errorMessage = error.response?.data?.detail || 'Failed to delete weight classification';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const formatWeightRange = (wc: WeightClassification) => {
    if (wc.category === 'Byproduct') {
      return wc.description || 'N/A';
    }
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'Catch-all';
    }
    if (wc.min_weight === null && wc.max_weight !== null) {
      return `≤ ${wc.max_weight} kg`;
    }
    if (wc.min_weight !== null && wc.max_weight === null) {
      return `≥ ${wc.min_weight} kg`;
    }
    if (wc.min_weight !== null && wc.max_weight !== null) {
      return `${wc.min_weight} - ${wc.max_weight} kg`;
    }
    return 'N/A';
  };

  // Filter and group classifications by category
  const groupedClassifications = useMemo(() => {
    const dressed = weightClassifications.filter(wc => wc.category === 'Dressed');
    const byproducts = weightClassifications.filter(wc => wc.category === 'Byproduct');
    return { dressed, byproducts };
  }, [weightClassifications]);

  const handleSave = async () => {
    if (!activePlantId) {
      Alert.alert('Error', 'No active plant selected.');
      return;
    }

    if (!classification.trim()) {
      Alert.alert('Error', 'Classification cannot be empty');
      return;
    }

    if (category === 'Byproduct' && !description.trim()) {
      Alert.alert('Error', 'Description is required for Byproduct category');
      return;
    }

    try {
      const data: any = {
        classification: classification.trim(),
        category,
        description: description.trim() || null,
      };

      // Handle weights based on category
      if (category === 'Dressed') {
        // Parse weights - allow empty strings for null values
        data.min_weight = minWeight.trim() === '' ? null : parseFloat(minWeight);
        data.max_weight = maxWeight.trim() === '' ? null : parseFloat(maxWeight);

        // Validate that at least one weight is set or both are null (catch-all)
        if (data.min_weight === null && data.max_weight === null) {
          // Catch-all is valid
        } else if (data.min_weight !== null && data.max_weight !== null) {
          if (isNaN(data.min_weight) || isNaN(data.max_weight)) {
            Alert.alert('Error', 'Please enter valid numbers for weights');
            return;
          }
          if (data.max_weight < data.min_weight) {
            Alert.alert('Error', 'Max weight must be greater than or equal to min weight');
            return;
          }
        } else if (data.min_weight !== null && isNaN(data.min_weight)) {
          Alert.alert('Error', 'Please enter a valid number for min weight');
          return;
        } else if (data.max_weight !== null && isNaN(data.max_weight)) {
          Alert.alert('Error', 'Please enter a valid number for max weight');
          return;
        }
      } else {
        // Byproduct - no weights
        data.min_weight = null;
        data.max_weight = null;
      }

      if (editingWC) {
        await weightClassificationsApi.update(editingWC.id, data);
      } else {
        await weightClassificationsApi.create(activePlantId, data);
      }
      setModalVisible(false);
      fetchData(false);
    } catch (error: any) {
      console.error('Error saving weight classification:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save weight classification';
      Alert.alert('Error', errorMessage);
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
        <Text style={styles.emptyText}>No active plant set</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: {
      ...styles.container,
    },
    header: {
      ...styles.header,
      padding: responsive.padding.medium,
      width: '100%',
      maxWidth: '100%',
    },
    title: {
      ...styles.title,
      fontSize: responsive.fontSize.large,
    },
    list: {
      ...styles.list,
      padding: responsive.padding.medium,
      width: '100%',
      maxWidth: '100%',
    },
    card: {
      ...styles.card,
      padding: responsive.padding.medium,
      marginBottom: responsive.spacing.md,
    },
    addButton: {
      ...styles.addButton,
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.spacing.sm,
    },
    addButtonText: {
      ...styles.addButtonText,
      fontSize: responsive.fontSize.small,
    },
    modalContent: {
      ...styles.modalContent,
      width: responsive.isTablet ? 500 : '90%',
      maxHeight: '85%',
      padding: responsive.padding.large,
    },
    modalScrollView: {
      ...styles.modalScrollView,
      maxHeight: responsive.isTablet ? 450 : 350,
    },
    input: {
      ...styles.input,
      padding: responsive.padding.medium,
      fontSize: responsive.fontSize.medium,
    },
    modalButton: {
      ...styles.modalButton,
      padding: responsive.padding.medium,
    },
    modalButtonText: {
      ...styles.modalButtonText,
      fontSize: responsive.fontSize.small,
    },
    sectionHeader: {
      ...styles.sectionHeader,
      padding: responsive.padding.medium,
    },
    sectionTitle: {
      ...styles.sectionTitle,
      fontSize: responsive.fontSize.large,
    },
    emptySectionText: {
      ...styles.emptySectionText,
      fontSize: responsive.fontSize.small,
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Weight Classifications</Text>
        {/* Only show add button if user has permission */}
        {hasPermission('can_manage_weight_classes') && (
          <TouchableOpacity style={dynamicStyles.addButton} onPress={handleAdd}>
            <MaterialIcons name="add" size={responsive.fontSize.medium} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={dynamicStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Dressed Section */}
        <View style={styles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Dressed</Text>
          </View>
          {groupedClassifications.dressed.length > 0 ? (
            groupedClassifications.dressed.map((item) => (
              <View key={item.id.toString()} style={dynamicStyles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.classification}>{item.classification}</Text>
                    <Text style={styles.weightRange}>{formatWeightRange(item)}</Text>
                    {item.description && (
                      <Text style={styles.description}>{item.description}</Text>
                    )}
                  </View>
                  {/* Only show edit/delete buttons if user has permission */}
                  {hasPermission('can_manage_weight_classes') && (
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                        <MaterialIcons name="edit" size={20} color="#3498db" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                        <MaterialIcons name="delete" size={20} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={dynamicStyles.emptySectionText}>No dressed classifications found</Text>
            </View>
          )}
        </View>

        {/* Byproducts Section */}
        <View style={styles.section}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Byproducts</Text>
          </View>
          {groupedClassifications.byproducts.length > 0 ? (
            groupedClassifications.byproducts.map((item) => (
              <View key={item.id.toString()} style={dynamicStyles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.classification}>{item.classification}</Text>
                    <Text style={styles.weightRange}>{formatWeightRange(item)}</Text>
                  </View>
                  {/* Only show edit/delete buttons if user has permission */}
                  {hasPermission('can_manage_weight_classes') && (
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                        <MaterialIcons name="edit" size={20} color="#3498db" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                        <MaterialIcons name="delete" size={20} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={dynamicStyles.emptySectionText}>No byproduct classifications found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingWC ? 'Edit Weight Classification' : 'Add Weight Classification'}
            </Text>
            <ScrollView 
              style={dynamicStyles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Plant selection removed as it is handled globally */}
              
              <Text style={styles.label}>Classification *</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., Small, Medium, Large"
                value={classification}
                onChangeText={setClassification}
              />

              <Text style={styles.label}>Category *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    if (value === 'Byproduct') {
                      setMinWeight('');
                      setMaxWeight('');
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Dressed" value="Dressed" />
                  <Picker.Item label="Byproduct" value="Byproduct" />
                </Picker>
              </View>

              <Text style={styles.label}>Description {category === 'Byproduct' ? '*' : ''}</Text>
              <TextInput
                style={[dynamicStyles.input, styles.textArea]}
                placeholder={category === 'Byproduct' ? 'Required for byproducts' : 'Optional'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              {category === 'Dressed' && (
                <>
                  <Text style={styles.label}>Min Weight (kg) - Leave empty for "up to" or catch-all</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="e.g., 1.5"
                    value={minWeight}
                    onChangeText={setMinWeight}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>Max Weight (kg) - Leave empty for "and up" or catch-all</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="e.g., 2.5"
                    value={maxWeight}
                    onChangeText={setMaxWeight}
                    keyboardType="numeric"
                  />

                  <Text style={styles.helpText}>
                    Leave both empty for catch-all. Leave min empty for "up to X". Leave max empty for "X and up".
                  </Text>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={dynamicStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={dynamicStyles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  header: {
    backgroundColor: '#2c3e50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#3498db',
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  emptySectionContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  classification: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#2c3e50',
    marginBottom: 4,
  },
  weightRange: {
    fontSize: 14,
    color: '#27ae60',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '85%',
    width: '90%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2c3e50',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2c3e50',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  helpText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    borderRadius: 4,
    marginLeft: 8,
    minWidth: 80,
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
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default WeightClassificationsScreen;
