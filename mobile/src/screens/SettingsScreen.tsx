import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { useTimezone } from '../contexts/TimezoneContext';
import { useResponsive } from '../utils/responsive';
import { getTimezoneAbbreviation } from '../utils/dateFormat';

function SettingsScreen() {
  const { timezone, setTimezone, availableTimezones } = useTimezone();
  const responsive = useResponsive();
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);

  // Update selectedTimezone when timezone changes from context
  React.useEffect(() => {
    setSelectedTimezone(timezone);
  }, [timezone]);

  const handleSave = async () => {
    try {
      await setTimezone(selectedTimezone);
      Alert.alert('Success', `Timezone preference saved successfully. All dates and times will now display in ${selectedTimezone}.`);
    } catch (error) {
      console.error('Error saving timezone:', error);
      Alert.alert('Error', 'Failed to save timezone preference');
    }
  };

  const dynamicStyles = {
    container: {
      ...styles.container,
      padding: responsive.padding.medium,
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
    timezoneDropdownMenu: {
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
    timezoneDropdownHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    timezoneDropdownTitle: {
      fontSize: responsive.fontSize.large,
      fontWeight: 'bold',
      color: '#2c3e50',
    },
    timezoneDropdownCloseButton: {
      padding: responsive.spacing.xs,
    },
    timezoneDropdownCloseText: {
      fontSize: responsive.fontSize.large,
      color: '#7f8c8d',
      fontWeight: 'bold',
    },
    timezoneDropdownScroll: {
      maxHeight: responsive.isTablet ? 400 : 300,
    },
    timezoneDropdownContent: {
      paddingBottom: responsive.spacing.md,
    },
    timezoneDropdownOption: {
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    timezoneDropdownOptionLast: {
      borderBottomWidth: 0,
    },
    timezoneDropdownOptionSelected: {
      backgroundColor: '#3498db',
    },
    timezoneDropdownOptionText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
    },
    timezoneDropdownOptionTextSelected: {
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
  };

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={dynamicStyles.title}>Settings</Text>

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
          <TouchableOpacity style={dynamicStyles.saveButton} onPress={handleSave}>
            <Text style={dynamicStyles.saveButtonText}>Save Timezone</Text>
          </TouchableOpacity>
        )}

        <Text style={dynamicStyles.infoText}>
          All dates and times throughout the app will be displayed in your selected timezone.
          Log entries are stored in UTC and converted to your timezone for display.
        </Text>
      </View>

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
              style={dynamicStyles.timezoneDropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <View style={dynamicStyles.timezoneDropdownHeader}>
                <Text style={dynamicStyles.timezoneDropdownTitle}>Select Timezone</Text>
                <TouchableOpacity
                  onPress={() => setShowTimezoneDropdown(false)}
                  style={dynamicStyles.timezoneDropdownCloseButton}
                >
                  <Text style={dynamicStyles.timezoneDropdownCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={dynamicStyles.timezoneDropdownScroll}
                contentContainerStyle={dynamicStyles.timezoneDropdownContent}
              >
                {availableTimezones.map((tz, index) => (
                  <TouchableOpacity
                    key={tz}
                    style={[
                      dynamicStyles.timezoneDropdownOption,
                      index === availableTimezones.length - 1 && dynamicStyles.timezoneDropdownOptionLast,
                      selectedTimezone === tz && dynamicStyles.timezoneDropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedTimezone(tz);
                      setShowTimezoneDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        dynamicStyles.timezoneDropdownOptionText,
                        selectedTimezone === tz && dynamicStyles.timezoneDropdownOptionTextSelected,
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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

