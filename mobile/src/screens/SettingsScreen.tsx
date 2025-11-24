import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimezone } from '../contexts/TimezoneContext';
import { usePlant } from '../contexts/PlantContext';
import { useResponsive } from '../utils/responsive';
import { getTimezoneAbbreviation } from '../utils/dateFormat';
import { plantsApi } from '../services/api';
import { Plant } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDefaultHeadsAmount } from '../utils/settings';

const ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY = '@tally_system_acceptable_difference_threshold';
const DEFAULT_THRESHOLD = 0;

function SettingsScreen() {
  const { timezone, setTimezone, availableTimezones } = useTimezone();
  const { activePlantId, setActivePlantId, isLoading: isPlantLoading } = usePlant();
  const responsive = useResponsive();
  const defaultHeadsAmount = useDefaultHeadsAmount();
  const insets = useSafeAreaInsets();
  
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [threshold, setThreshold] = useState<string>('0');
  const [currentThreshold, setCurrentThreshold] = useState<number>(0);
  
  // Plants state
  const [plants, setPlants] = useState<Plant[]>([]);
  const [showPlantDropdown, setShowPlantDropdown] = useState(false);
  const [isLoadingPlants, setIsLoadingPlants] = useState(false);

  // Update selectedTimezone when timezone changes from context
  React.useEffect(() => {
    setSelectedTimezone(timezone);
  }, [timezone]);

  // Load threshold on mount
  useEffect(() => {
    loadThreshold();
    fetchPlants();
  }, []);

  const fetchPlants = async () => {
    try {
      setIsLoadingPlants(true);
      const response = await plantsApi.getAll();
      setPlants(response.data);
    } catch (error) {
      console.error('Error fetching plants:', error);
      Alert.alert('Error', 'Failed to load plants');
    } finally {
      setIsLoadingPlants(false);
    }
  };

  const loadThreshold = async () => {
    try {
      const stored = await AsyncStorage.getItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY);
      if (stored !== null) {
        const value = parseFloat(stored);
        setCurrentThreshold(value);
        setThreshold(value.toString());
      } else {
        setCurrentThreshold(DEFAULT_THRESHOLD);
        setThreshold(DEFAULT_THRESHOLD.toString());
      }
    } catch (error) {
      console.error('Error loading threshold:', error);
    }
  };

  const handleSaveTimezone = async () => {
    try {
      await setTimezone(selectedTimezone);
      Alert.alert('Success', `Timezone preference saved successfully. All dates and times will now display in ${selectedTimezone}.`);
    } catch (error) {
      console.error('Error saving timezone:', error);
      Alert.alert('Error', 'Failed to save timezone preference');
    }
  };

  const handleSaveThreshold = async () => {
    try {
      const thresholdValue = parseFloat(threshold);
      if (isNaN(thresholdValue) || thresholdValue < 0) {
        Alert.alert('Error', 'Please enter a valid number greater than or equal to 0');
        return;
      }
      await AsyncStorage.setItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY, thresholdValue.toString());
      setCurrentThreshold(thresholdValue);
      Alert.alert('Success', `Acceptable difference threshold saved successfully. Differences within ${thresholdValue} will now be displayed in orange.`);
    } catch (error) {
      console.error('Error saving threshold:', error);
      Alert.alert('Error', 'Failed to save threshold preference');
    }
  };

  const handleSelectPlant = async (plantId: number) => {
    try {
      await setActivePlantId(plantId);
      setShowPlantDropdown(false);
      Alert.alert('Success', 'Active plant updated successfully.');
    } catch (error) {
      console.error('Error saving active plant:', error);
      Alert.alert('Error', 'Failed to save active plant');
    }
  };

  const getActivePlantName = () => {
    if (!activePlantId) return 'None Selected';
    const plant = plants.find(p => p.id === activePlantId);
    return plant ? plant.name : 'Unknown Plant';
  };

  const dynamicStyles = {
    container: {
      ...styles.container,
      // Only apply horizontal + top padding so bottom can align cleanly with tab bar
      paddingHorizontal: responsive.padding.medium,
      paddingTop: responsive.padding.medium,
    },
    title: {
      ...styles.title,
      fontSize: responsive.fontSize.large,
      marginBottom: responsive.spacing.lg,
    },
    section: {
      ...styles.section,
      marginBottom: responsive.spacing.lg,
    },
    sectionTitle: {
      ...styles.sectionTitle,
      fontSize: responsive.fontSize.medium,
      marginBottom: responsive.spacing.md,
    },
    label: {
      ...styles.label,
      fontSize: responsive.fontSize.small,
      marginBottom: responsive.spacing.sm,
    },
    pickerWrapper: {
      ...styles.pickerWrapper,
      marginBottom: responsive.spacing.md,
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.small,
      minHeight: 40,
    },
    dropdownText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
      fontWeight: '500',
      flex: 1,
    },
    dropdownIcon: {
      color: '#2c3e50',
      fontSize: 10,
      marginLeft: responsive.spacing.xs,
    },
    dropdownMenu: {
      backgroundColor: '#fff',
      borderRadius: 12,
      width: responsive.isTablet ? Math.min(responsive.width * 0.6, 500) : '90%',
      maxWidth: 500,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
      overflow: 'hidden',
    },
    dropdownHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    dropdownTitle: {
      fontSize: responsive.fontSize.large,
      fontWeight: 'bold',
      color: '#2c3e50',
    },
    dropdownCloseButton: {
      padding: responsive.spacing.xs,
    },
    dropdownCloseText: {
      fontSize: responsive.fontSize.large,
      color: '#7f8c8d',
      fontWeight: 'bold',
    },
    dropdownScroll: {
      maxHeight: responsive.isTablet ? 400 : 300,
    },
    dropdownContent: {
      paddingBottom: responsive.spacing.md,
    },
    dropdownOption: {
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    dropdownOptionLast: {
      borderBottomWidth: 0,
    },
    dropdownOptionSelected: {
      backgroundColor: '#3498db',
    },
    dropdownOptionText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
    },
    dropdownOptionTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    currentTimezone: {
      ...styles.currentTimezone,
      fontSize: responsive.fontSize.small,
      marginTop: responsive.spacing.sm,
    },
    saveButton: {
      ...styles.saveButton,
      padding: responsive.padding.medium,
    },
    saveButtonText: {
      ...styles.saveButtonText,
      fontSize: responsive.fontSize.medium,
    },
    infoText: {
      ...styles.infoText,
      fontSize: responsive.fontSize.small,
      marginTop: responsive.spacing.md,
    },
    inputWrapper: {
      marginBottom: responsive.spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.small,
      fontSize: responsive.fontSize.medium,
      color: '#2c3e50',
      backgroundColor: '#fff',
    },
  };

  if (isPlantLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <View style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0, flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: responsive.spacing.md }}
          showsVerticalScrollIndicator={true}
        >
      <Text style={dynamicStyles.title}>Settings</Text>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Active Plant</Text>
        <Text style={dynamicStyles.label}>
          Select the plant you are currently working on:
        </Text>

        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowPlantDropdown(true)}
            disabled={isLoadingPlants}
          >
            {isLoadingPlants ? (
              <ActivityIndicator size="small" color="#3498db" />
            ) : (
              <>
                <Text style={dynamicStyles.dropdownText} numberOfLines={1}>
                  {getActivePlantName()}
                </Text>
                <Text style={dynamicStyles.dropdownIcon}>▼</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={dynamicStyles.infoText}>
          This setting filters sessions, weight classifications, and exports to show only data relevant to the selected plant.
        </Text>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Timezone</Text>
        <Text style={dynamicStyles.label}>
          Select your preferred timezone for viewing dates and times:
        </Text>

        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowTimezoneDropdown(true)}
          >
            <Text style={dynamicStyles.dropdownText} numberOfLines={1}>
              {selectedTimezone} ({getTimezoneAbbreviation(selectedTimezone)})
            </Text>
            <Text style={dynamicStyles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={dynamicStyles.currentTimezone}>
          Current: {timezone} ({getTimezoneAbbreviation(timezone)})
        </Text>

        {selectedTimezone !== timezone && (
          <TouchableOpacity style={dynamicStyles.saveButton} onPress={handleSaveTimezone}>
            <Text style={dynamicStyles.saveButtonText}>Save Timezone</Text>
          </TouchableOpacity>
        )}

        <Text style={dynamicStyles.infoText}>
          All dates and times throughout the app will be displayed in your selected timezone.
          Log entries are stored in UTC and converted to your timezone for display.
        </Text>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Difference Threshold</Text>
        <Text style={dynamicStyles.label}>
          Set the acceptable difference between tally-er and dispatcher weights:
        </Text>

        <View style={dynamicStyles.inputWrapper}>
          <TextInput
            style={dynamicStyles.input}
            value={threshold}
            onChangeText={setThreshold}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor="#999"
          />
        </View>

        <Text style={dynamicStyles.currentTimezone}>
          Current: {currentThreshold}
        </Text>

        {parseFloat(threshold) !== currentThreshold && !isNaN(parseFloat(threshold)) && parseFloat(threshold) >= 0 && (
          <TouchableOpacity style={dynamicStyles.saveButton} onPress={handleSaveThreshold}>
            <Text style={dynamicStyles.saveButtonText}>Save Threshold</Text>
          </TouchableOpacity>
        )}

        <Text style={dynamicStyles.infoText}>
          When viewing session logs, differences within this threshold will be displayed in orange (acceptable).
          Exact matches (0) will be green, and differences beyond the threshold will be red (unacceptable).
        </Text>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Default Heads Amount</Text>
        <Text style={dynamicStyles.label}>
          Default number of heads per bag:
        </Text>

        <View style={dynamicStyles.inputWrapper}>
          <TextInput
            style={[dynamicStyles.input, { backgroundColor: '#f5f5f5', color: '#7f8c8d' }]}
            value={defaultHeadsAmount.toString()}
            editable={false}
            placeholder="15"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>

        <Text style={dynamicStyles.infoText}>
          This is the default number of heads that will be assigned to each bag when tallying. This setting is currently view-only.
        </Text>
      </View>

      {/* Plant Dropdown Modal */}
      {showPlantDropdown && (
        <Modal
          transparent
          visible={showPlantDropdown}
          animationType="fade"
          onRequestClose={() => setShowPlantDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowPlantDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <View style={dynamicStyles.dropdownHeader}>
                <Text style={dynamicStyles.dropdownTitle}>Select Active Plant</Text>
                <TouchableOpacity
                  onPress={() => setShowPlantDropdown(false)}
                  style={dynamicStyles.dropdownCloseButton}
                >
                  <Text style={dynamicStyles.dropdownCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={dynamicStyles.dropdownScroll}
                contentContainerStyle={dynamicStyles.dropdownContent}
              >
                {plants.map((plant, index) => (
                  <TouchableOpacity
                    key={plant.id}
                    style={[
                      dynamicStyles.dropdownOption,
                      index === plants.length - 1 && dynamicStyles.dropdownOptionLast,
                      activePlantId === plant.id && dynamicStyles.dropdownOptionSelected,
                    ]}
                    onPress={() => handleSelectPlant(plant.id)}
                  >
                    <Text
                      style={[
                        dynamicStyles.dropdownOptionText,
                        activePlantId === plant.id && dynamicStyles.dropdownOptionTextSelected,
                      ]}
                    >
                      {plant.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Timezone Dropdown Modal */}
      {showTimezoneDropdown && (
        <Modal
          transparent
          visible={showTimezoneDropdown}
          animationType="fade"
          onRequestClose={() => setShowTimezoneDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowTimezoneDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <View style={dynamicStyles.dropdownHeader}>
                <Text style={dynamicStyles.dropdownTitle}>Select Timezone</Text>
                <TouchableOpacity
                  onPress={() => setShowTimezoneDropdown(false)}
                  style={dynamicStyles.dropdownCloseButton}
                >
                  <Text style={dynamicStyles.dropdownCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={dynamicStyles.dropdownScroll}
                contentContainerStyle={dynamicStyles.dropdownContent}
              >
                {availableTimezones.map((tz, index) => (
                  <TouchableOpacity
                    key={tz}
                    style={[
                      dynamicStyles.dropdownOption,
                      index === availableTimezones.length - 1 && dynamicStyles.dropdownOptionLast,
                      selectedTimezone === tz && dynamicStyles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedTimezone(tz);
                      setShowTimezoneDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        dynamicStyles.dropdownOptionText,
                        selectedTimezone === tz && dynamicStyles.dropdownOptionTextSelected,
                      ]}
                    >
                      {tz} ({getTimezoneAbbreviation(tz)})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
        </ScrollView>
      </View>
    </View>
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
  },
  title: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  label: {
    color: '#555',
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    marginBottom: 12,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentTimezone: {
    color: '#666',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoText: {
    color: '#666',
    fontStyle: 'italic',
    marginTop: 12,
  },
});

export default SettingsScreen;
