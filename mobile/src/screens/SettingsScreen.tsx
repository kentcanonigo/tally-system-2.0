import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTimezone } from '../contexts/TimezoneContext';
import { useResponsive } from '../utils/responsive';
import { getTimezoneAbbreviation } from '../utils/dateFormat';

function SettingsScreen() {
  const { timezone, setTimezone, availableTimezones } = useTimezone();
  const responsive = useResponsive();
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);

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
    picker: {
      height: responsive.isTablet ? 200 : 50,
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
          <Picker
            selectedValue={selectedTimezone}
            onValueChange={(value) => setSelectedTimezone(value)}
            style={dynamicStyles.picker}
            dropdownIconColor="#2c3e50"
          >
            {availableTimezones.map((tz) => (
              <Picker.Item
                key={tz}
                label={`${tz} (${getTimezoneAbbreviation(tz)})`}
                value={tz}
              />
            ))}
          </Picker>
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
  picker: {
    height: 50,
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

