import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { plantsApi } from '../services/api';
import type { Plant } from '../types';
import { useResponsive } from '../utils/responsive';

function PlantsScreen() {
  const responsive = useResponsive();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [plantName, setPlantName] = useState('');

  const fetchData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await plantsApi.getAll();
      setPlants(response.data);
    } catch (error) {
      console.error('Error fetching plants:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const handleAdd = () => {
    setEditingPlant(null);
    setPlantName('');
    setModalVisible(true);
  };

  const handleEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setPlantName(plant.name);
    setModalVisible(true);
  };

  const handleDelete = (plant: Plant) => {
    Alert.alert(
      'Delete Plant',
      `Are you sure you want to delete ${plant.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await plantsApi.delete(plant.id);
              fetchData(false);
            } catch (error: any) {
              console.error('Error deleting plant:', error);
              const errorMessage = error.response?.data?.detail || 'Failed to delete plant';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!plantName.trim()) {
      Alert.alert('Error', 'Plant name cannot be empty');
      return;
    }

    try {
      if (editingPlant) {
        await plantsApi.update(editingPlant.id, { name: plantName });
      } else {
        await plantsApi.create({ name: plantName });
      }
      setModalVisible(false);
      fetchData(false);
    } catch (error) {
      console.error('Error saving plant:', error);
      Alert.alert('Error', 'Failed to save plant');
    }
  };

  if (loading && plants.length === 0) {
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
    name: {
      ...styles.name,
      fontSize: responsive.fontSize.medium,
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
      width: responsive.isTablet ? 400 : '90%',
      padding: responsive.padding.large,
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
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Plants</Text>
        <TouchableOpacity style={dynamicStyles.addButton} onPress={handleAdd}>
          <Text style={dynamicStyles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={plants}
        renderItem={({ item }) => (
          <View style={dynamicStyles.card}>
            <View style={styles.cardContent}>
              <Text style={dynamicStyles.name}>{item.name}</Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                  <Text style={styles.actionText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                  <Text style={styles.actionText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={dynamicStyles.list}
      />

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingPlant ? 'Edit Plant' : 'Add Plant'}
            </Text>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Plant Name"
              value={plantName}
              onChangeText={setPlantName}
            />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  list: {
    flexGrow: 1,
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
    alignItems: 'center',
  },
  name: {
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2c3e50',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
});

export default PlantsScreen;
