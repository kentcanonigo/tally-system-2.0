import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { weightClassificationsApi, userPreferencesApi } from '../services/api';
import { WeightClassification } from '../types';
import { usePlant } from '../contexts/PlantContext';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../utils/responsive';
import { colors } from '../theme/colors';

interface ClassificationOrderDialogProps {
  visible: boolean;
  onClose: () => void;
}

// Default order for classifications (case-insensitive matching)
const DEFAULT_DRESSED_ORDER = ['Dressed Chicken', 'os', 'p4', 'p3', 'p2', 'p1', 'us', 'SQ', 'cb'];
const DEFAULT_BYPRODUCT_ORDER = ['lv', 'gz', 'si', 'ft', 'hd', 'pv', 'bld'];

const getDefaultOrder = (category: string): string[] => {
  if (category === 'Dressed') return DEFAULT_DRESSED_ORDER;
  if (category === 'Byproduct') return DEFAULT_BYPRODUCT_ORDER;
  return []; // Frozen: alphabetical
};

const sortByDefaultOrder = (classifications: WeightClassification[], category: string): WeightClassification[] => {
  const defaultOrder = getDefaultOrder(category);
  if (defaultOrder.length === 0) {
    // Alphabetical for Frozen
    return [...classifications].sort((a, b) => 
      a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
    );
  }
  
  const ordered: WeightClassification[] = [];
  const unordered: WeightClassification[] = [];
  const lowerDefaultOrder = defaultOrder.map(c => c.toLowerCase());
  
  // Add classifications in default order
  for (const defaultClass of lowerDefaultOrder) {
    const found = classifications.find(wc => 
      wc.classification.toLowerCase() === defaultClass
    );
    if (found) {
      ordered.push(found);
    }
  }
  
  // Add remaining classifications alphabetically
  for (const wc of classifications) {
    if (!ordered.find(o => o.id === wc.id)) {
      unordered.push(wc);
    }
  }
  unordered.sort((a, b) => 
    a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
  );
  
  return [...ordered, ...unordered];
};

export const ClassificationOrderDialog: React.FC<ClassificationOrderDialogProps> = ({ visible, onClose }) => {
  const { activePlantId } = usePlant();
  const { user, refetchUser } = useAuth();
  const responsive = useResponsive();
  
  const [classifications, setClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderedClassifications, setOrderedClassifications] = useState<{
    Dressed: WeightClassification[];
    Frozen: WeightClassification[];
    Byproduct: WeightClassification[];
  }>({ Dressed: [], Frozen: [], Byproduct: [] });

  useEffect(() => {
    if (visible) {
      if (activePlantId) {
        loadClassifications();
      } else {
        setError('No active plant selected. Please select a plant in Settings.');
        setLoading(false);
      }
    } else {
      // Reset state when dialog closes
      setError(null);
      setClassifications([]);
      setOrderedClassifications({ Dressed: [], Frozen: [], Byproduct: [] });
    }
  }, [visible, activePlantId]);

  const loadClassifications = async () => {
    if (!activePlantId) {
      Alert.alert('Error', 'No active plant selected');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await weightClassificationsApi.getByPlant(activePlantId);
      const allClassifications = response.data;
      
      if (!allClassifications || allClassifications.length === 0) {
        setError('No weight classifications found for this plant. Please add classifications first.');
        setClassifications([]);
        setOrderedClassifications({ Dressed: [], Frozen: [], Byproduct: [] });
        setLoading(false);
        return;
      }
      
      // Group by category
      const grouped = {
        Dressed: allClassifications.filter(wc => wc.category === 'Dressed'),
        Frozen: allClassifications.filter(wc => wc.category === 'Frozen'),
        Byproduct: allClassifications.filter(wc => wc.category === 'Byproduct'),
      };

      // Apply custom order if exists, otherwise use default
      const customOrder = user?.classification_order;
      
      const ordered: typeof grouped = {
        Dressed: applyOrder(grouped.Dressed, customOrder?.Dressed, 'Dressed'),
        Frozen: applyOrder(grouped.Frozen, customOrder?.Frozen, 'Frozen'),
        Byproduct: applyOrder(grouped.Byproduct, customOrder?.Byproduct, 'Byproduct'),
      };

      setClassifications(allClassifications);
      setOrderedClassifications(ordered);
      setError(null);
    } catch (error: any) {
      console.error('Error loading classifications:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load classifications';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const applyOrder = (
    items: WeightClassification[],
    customOrder: number[] | undefined,
    category: string
  ): WeightClassification[] => {
    if (customOrder && customOrder.length > 0) {
      // Create a map for quick lookup
      const itemMap = new Map(items.map(item => [item.id, item]));
      const ordered: WeightClassification[] = [];
      const unordered: WeightClassification[] = [];

      // Add items in custom order
      for (const id of customOrder) {
        const item = itemMap.get(id);
        if (item) {
          ordered.push(item);
          itemMap.delete(id);
        }
      }

      // Add remaining items alphabetically
      for (const item of itemMap.values()) {
        unordered.push(item);
      }
      unordered.sort((a, b) => 
        a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
      );

      return [...ordered, ...unordered];
    }

    // Use default order
    return sortByDefaultOrder(items, category);
  };

  const moveItem = (category: 'Dressed' | 'Frozen' | 'Byproduct', index: number, direction: 'up' | 'down') => {
    const items = [...orderedClassifications[category]];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;
    
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    
    setOrderedClassifications({
      ...orderedClassifications,
      [category]: items,
    });
  };

  const resetToDefault = () => {
    if (!activePlantId) return;
    
    const grouped = {
      Dressed: classifications.filter(wc => wc.category === 'Dressed'),
      Frozen: classifications.filter(wc => wc.category === 'Frozen'),
      Byproduct: classifications.filter(wc => wc.category === 'Byproduct'),
    };

    setOrderedClassifications({
      Dressed: sortByDefaultOrder(grouped.Dressed, 'Dressed'),
      Frozen: sortByDefaultOrder(grouped.Frozen, 'Frozen'),
      Byproduct: sortByDefaultOrder(grouped.Byproduct, 'Byproduct'),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const classificationOrder: { [category: string]: number[] } = {
        Dressed: orderedClassifications.Dressed.map(wc => wc.id),
        Frozen: orderedClassifications.Frozen.map(wc => wc.id),
        Byproduct: orderedClassifications.Byproduct.map(wc => wc.id),
      };

      await userPreferencesApi.update({ classification_order: classificationOrder });
      await refetchUser();
      Alert.alert('Success', 'Classification order saved successfully');
      onClose();
    } catch (error: any) {
      console.error('Error saving classification order:', error);
      Alert.alert('Error', error.message || 'Failed to save classification order');
    } finally {
      setSaving(false);
    }
  };

  const renderCategorySection = (category: 'Dressed' | 'Frozen' | 'Byproduct', title: string) => {
    const items = orderedClassifications[category];
    if (items.length === 0) return null;

    return (
      <View style={styles.categorySection}>
        <Text style={[styles.categoryTitle, { fontSize: responsive.fontSize.medium }]}>
          {title} ({items.length})
        </Text>
        {items.map((wc, index) => (
          <View key={wc.id} style={styles.classificationRow}>
            <View style={styles.classificationInfo}>
              <Text style={[styles.classificationText, { fontSize: responsive.fontSize.small }]}>
                {wc.classification}
              </Text>
            </View>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                onPress={() => moveItem(category, index, 'up')}
                disabled={index === 0}
              >
                <MaterialIcons 
                  name="arrow-upward" 
                  size={20} 
                  color={index === 0 ? '#ccc' : colors.primary} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moveButton, index === items.length - 1 && styles.moveButtonDisabled]}
                onPress={() => moveItem(category, index, 'down')}
                disabled={index === items.length - 1}
              >
                <MaterialIcons 
                  name="arrow-downward" 
                  size={20} 
                  color={index === items.length - 1 ? '#ccc' : colors.primary} 
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { 
          width: responsive.isTablet ? Math.min(responsive.width * 0.8, 600) : '90%',
          maxHeight: '85%',
        }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { fontSize: responsive.fontSize.large }]}>
              Customize Classification Order
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#2c3e50" />
            </TouchableOpacity>
          </View>

          <View style={styles.scrollContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { fontSize: responsive.fontSize.small }]}>
                  Loading classifications...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={48} color="#e74c3c" />
                <Text style={[styles.errorText, { fontSize: responsive.fontSize.small }]}>
                  {error}
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {renderCategorySection('Dressed', 'Dressed Chicken')}
                {renderCategorySection('Frozen', 'Frozen Chicken')}
                {renderCategorySection('Byproduct', 'Byproduct')}
                {orderedClassifications.Dressed.length === 0 && 
                 orderedClassifications.Frozen.length === 0 && 
                 orderedClassifications.Byproduct.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { fontSize: responsive.fontSize.small }]}>
                      No classifications found for this plant.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={resetToDefault}
              disabled={loading || saving}
            >
              <Text style={[styles.buttonText, { fontSize: responsive.fontSize.small }]}>
                Reset to Default
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { fontSize: responsive.fontSize.small }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.buttonText, styles.saveButtonText, { fontSize: responsive.fontSize.small }]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
    minHeight: 200,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    color: '#7f8c8d',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorText: {
    marginTop: 16,
    color: '#e74c3c',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  classificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  classificationInfo: {
    flex: 1,
  },
  classificationText: {
    color: '#2c3e50',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  moveButtonDisabled: {
    opacity: 0.5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: '#95a5a6',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
  },
});
