import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTimezone } from '../contexts/TimezoneContext';
import { usePlant } from '../contexts/PlantContext';
import { useResponsive } from '../utils/responsive';
import { getTimezoneAbbreviation } from '../utils/dateFormat';
import { plantsApi, rolesApi } from '../services/api';
import { Plant, Role } from '../types';
import { useDefaultHeadsAmount } from '../utils/settings';

// Available tabs that can be shown/hidden
const AVAILABLE_TABS = [
  { key: 'Home', label: 'Home' },
  { key: 'Sessions', label: 'Sessions' },
  { key: 'Tally', label: 'Tally' },
  { key: 'Customers', label: 'Customers' },
  { key: 'WeightClassifications', label: 'Weight Classifications' },
  { key: 'Calculator', label: 'Calculator' },
  // Export functionality is now in Sessions screen
  // Settings is always visible, so we don't include it here
];

// Filter out 'Export' if it exists (legacy from when Export was a separate tab)
const getFilteredVisibleTabs = (tabs: string[] | null | undefined) => {
  const filtered = tabs?.filter(tab => tab !== 'Export') || [];
  return filtered.length > 0 ? filtered : AVAILABLE_TABS.map(tab => tab.key);
};

function SettingsScreen() {
  const { user, logout, updatePreferences, refetchUser } = useAuth();
  const { timezone, setTimezone, availableTimezones } = useTimezone();
  const { activePlantId, setActivePlantId, isLoading: isPlantLoading } = usePlant();
  const responsive = useResponsive();
  const defaultHeadsAmount = useDefaultHeadsAmount();
  
  const [selectedTimezone, setSelectedTimezone] = useState(user?.timezone || timezone);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [threshold, setThreshold] = useState<string>((user?.acceptable_difference_threshold || 0).toString());
  const [selectedActivePlant, setSelectedActivePlant] = useState<number | null>(user?.active_plant_id || activePlantId);
  
  const [visibleTabs, setVisibleTabs] = useState<string[]>(
    getFilteredVisibleTabs(user?.visible_tabs)
  );
  
  // Plants state
  const [plants, setPlants] = useState<Plant[]>([]);
  const [showPlantDropdown, setShowPlantDropdown] = useState(false);
  const [isLoadingPlants, setIsLoadingPlants] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Update state when user data changes
  useEffect(() => {
    if (user) {
      setSelectedTimezone(user.timezone || timezone);
      setThreshold((user.acceptable_difference_threshold || 0).toString());
      setSelectedActivePlant(user.active_plant_id || activePlantId);
      setVisibleTabs(getFilteredVisibleTabs(user.visible_tabs));
    }
  }, [user, timezone, activePlantId]);

  // Load data on mount
  useEffect(() => {
    fetchPlants();
    fetchRoles();
  }, []);

  const fetchPlants = async () => {
    try {
      setIsLoadingPlants(true);
      const response = await plantsApi.getAll();
      const fetchedPlants = response.data;
      setPlants(fetchedPlants);
      
      // If active plant ID is set but the plant doesn't exist in the fetched list (404 scenario),
      // set active plant to null
      const currentActivePlantId = selectedActivePlant || activePlantId;
      if (currentActivePlantId && !fetchedPlants.find(p => p.id === currentActivePlantId)) {
        console.log('Active plant not found in fetched plants, setting to null');
        setSelectedActivePlant(null);
        await setActivePlantId(null);
        try {
          await updatePreferences({
            active_plant_id: null,
          });
        } catch (prefError) {
          console.error('Error updating preferences:', prefError);
        }
      }
    } catch (error: any) {
      console.error('Error fetching plants:', error);
      // If we get a 404 or the active plant doesn't exist, set it to null
      const currentActivePlantId = selectedActivePlant || activePlantId;
      if (error.response?.status === 404 || currentActivePlantId) {
        setSelectedActivePlant(null);
        await setActivePlantId(null);
        try {
          await updatePreferences({
            active_plant_id: null,
          });
        } catch (prefError) {
          console.error('Error updating preferences:', prefError);
        }
      }
      Alert.alert('Error', 'Failed to load plants');
    } finally {
      setIsLoadingPlants(false);
    }
  };

  const fetchRoles = async () => {
    try {
      setIsLoadingRoles(true);
      const response = await rolesApi.getAll();
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Silent fail – we can still fall back to legacy user.role display
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleSelectPlant = async (plantId: number | null) => {
    setSelectedActivePlant(plantId);
    setShowPlantDropdown(false);
    
    // Auto-save plant selection immediately
    try {
      await updatePreferences({
        active_plant_id: plantId,
      });
      
      // Update context for backward compatibility
      await setActivePlantId(plantId);
    } catch (error: any) {
      console.error('Error saving plant preference:', error);
      Alert.alert('Error', error.message || 'Failed to save plant preference');
      // Revert on error
      setSelectedActivePlant(user?.active_plant_id || activePlantId);
    }
  };

  const toggleTabVisibility = async (tabKey: string) => {
    let newVisibleTabs: string[];
    
    if (visibleTabs.includes(tabKey)) {
      // Don't allow hiding all tabs - keep at least one
      if (visibleTabs.length <= 1) {
        Alert.alert('Notice', 'You must have at least one tab visible.');
        return;
      }
      newVisibleTabs = visibleTabs.filter(key => key !== tabKey);
    } else {
      newVisibleTabs = [...visibleTabs, tabKey];
    }
    
    setVisibleTabs(newVisibleTabs);
    
    // Auto-save tab visibility immediately
    try {
      await updatePreferences({
        visible_tabs: newVisibleTabs,
      });
    } catch (error: any) {
      console.error('Error saving tab visibility preference:', error);
      Alert.alert('Error', error.message || 'Failed to save tab visibility preference');
      // Revert on error
      setVisibleTabs(getFilteredVisibleTabs(user?.visible_tabs));
    }
  };

  const getActivePlantName = () => {
    if (!selectedActivePlant) return 'None';
    const plant = plants.find(p => p.id === selectedActivePlant);
    return plant ? plant.name : 'None';
  };

  const getUserRoleLabel = () => {
    if (!user) return 'Unknown';

    // Prefer RBAC roles from role_ids if available and roles are loaded
    if (user.role_ids && user.role_ids.length > 0 && roles.length > 0) {
      const assignedRoles = roles.filter(role => user.role_ids.includes(role.id));
      if (assignedRoles.length > 0) {
        return assignedRoles.map(role => role.name).join(', ');
      }
    }

    // Fallback to legacy system role (superadmin/admin)
    if (user.role) {
      return typeof user.role === 'string'
        ? user.role.toUpperCase()
        : String(user.role).toUpperCase();
    }

    return 'Unknown';
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
    tabToggleLabel: {
      ...styles.tabToggleLabel,
      fontSize: responsive.fontSize.medium,
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
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
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
            onBlur={async () => {
              // Auto-save threshold on blur (when user finishes editing)
              const thresholdValue = parseFloat(threshold);
              if (isNaN(thresholdValue) || thresholdValue < 0) {
                Alert.alert('Error', 'Please enter a valid number for threshold (≥ 0)');
                setThreshold((user?.acceptable_difference_threshold || 0).toString());
                return;
              }

              try {
                await updatePreferences({
                  acceptable_difference_threshold: thresholdValue,
                });
              } catch (error: any) {
                console.error('Error saving threshold preference:', error);
                Alert.alert('Error', error.message || 'Failed to save threshold preference');
                // Revert on error
                setThreshold((user?.acceptable_difference_threshold || 0).toString());
              }
            }}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor="#999"
          />
        </View>

        <Text style={dynamicStyles.infoText}>
          When viewing session logs, differences within this threshold will be displayed in orange (acceptable).
          Exact matches (0) will be green, and differences beyond the threshold will be red (unacceptable).
        </Text>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Visible Tabs</Text>
        <Text style={dynamicStyles.label}>
          Customize which tabs appear in your navigation bar:
        </Text>

        {AVAILABLE_TABS.map((tab) => (
          <View key={tab.key} style={styles.tabToggleRow}>
            <Text style={dynamicStyles.tabToggleLabel}>{tab.label}</Text>
            <Switch
              value={visibleTabs.includes(tab.key)}
              onValueChange={() => toggleTabVisibility(tab.key)}
              trackColor={{ false: '#ccc', true: '#3498db' }}
              thumbColor={visibleTabs.includes(tab.key) ? '#fff' : '#f4f3f4'}
            />
          </View>
        ))}

        <Text style={dynamicStyles.infoText}>
          Settings tab is always visible. You must have at least one other tab visible.
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
          This is the default number of heads per bag for Dressed category items. Byproduct items do not use heads tracking. This setting is currently view-only.
        </Text>
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Account</Text>
        {user && (
          <>
            <View style={[dynamicStyles.inputWrapper, { marginBottom: responsive.spacing.sm }]}>
              <Text style={dynamicStyles.label}>Username:</Text>
              <Text style={[dynamicStyles.input, { backgroundColor: '#f5f5f5', color: '#7f8c8d' }]}>
                {user.username}
              </Text>
            </View>
            <View style={[dynamicStyles.inputWrapper, { marginBottom: responsive.spacing.sm }]}>
              <Text style={dynamicStyles.label}>Role:</Text>
              <Text style={[dynamicStyles.input, { backgroundColor: '#f5f5f5', color: '#7f8c8d' }]}>
                {isLoadingRoles ? 'Loading...' : getUserRoleLabel()}
              </Text>
            </View>
          </>
        )}
        
        <TouchableOpacity 
          style={[dynamicStyles.saveButton, { backgroundColor: '#e74c3c' }]} 
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to logout?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Logout', 
                  style: 'destructive',
                  onPress: async () => {
                    await logout();
                  }
                },
              ]
            );
          }}
        >
          <Text style={dynamicStyles.saveButtonText}>Logout</Text>
        </TouchableOpacity>
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
                <TouchableOpacity
                  style={[
                    dynamicStyles.dropdownOption,
                    plants.length === 0 && dynamicStyles.dropdownOptionLast,
                    !selectedActivePlant && dynamicStyles.dropdownOptionSelected,
                  ]}
                  onPress={() => handleSelectPlant(null)}
                >
                  <Text
                    style={[
                      dynamicStyles.dropdownOptionText,
                      !selectedActivePlant && dynamicStyles.dropdownOptionTextSelected,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>
                {plants.map((plant, index) => (
                  <TouchableOpacity
                    key={plant.id}
                    style={[
                      dynamicStyles.dropdownOption,
                      index === plants.length - 1 && dynamicStyles.dropdownOptionLast,
                      selectedActivePlant === plant.id && dynamicStyles.dropdownOptionSelected,
                    ]}
                    onPress={() => handleSelectPlant(plant.id)}
                  >
                    <Text
                      style={[
                        dynamicStyles.dropdownOptionText,
                        selectedActivePlant === plant.id && dynamicStyles.dropdownOptionTextSelected,
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
                    onPress={async () => {
                      setSelectedTimezone(tz);
                      setShowTimezoneDropdown(false);
                      
                      // Auto-save timezone selection immediately
                      try {
                        await updatePreferences({
                          timezone: tz,
                        });
                        
                        // Update context for backward compatibility
                        await setTimezone(tz);
                      } catch (error: any) {
                        console.error('Error saving timezone preference:', error);
                        Alert.alert('Error', error.message || 'Failed to save timezone preference');
                        // Revert on error
                        setSelectedTimezone(user?.timezone || timezone);
                      }
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
  tabToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabToggleLabel: {
    fontSize: 16,
    color: '#2c3e50',
  },
});

export default SettingsScreen;
