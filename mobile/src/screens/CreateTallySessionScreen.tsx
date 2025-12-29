import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { customersApi, tallySessionsApi, plantsApi } from '../services/api';
import type { Customer, Plant } from '../types';
import { useResponsive } from '../utils/responsive';
import { usePlant } from '../contexts/PlantContext';
import { useTimezone } from '../contexts/TimezoneContext';
import { usePermissions } from '../utils/usePermissions';
import { formatDate } from '../utils/dateFormat';
import { colors } from '../theme/colors';

function CreateTallySessionScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { activePlantId } = usePlant();
  const { timezone } = useTimezone();
  const { hasPermission } = usePermissions();
  const canCreateSession = hasPermission('can_create_tally_sessions');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [formData, setFormData] = useState({
    customer_id: 0,
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
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId: number) => {
    return customers.find((c) => c.id === customerId)?.name || 'Select Customer';
  };

  const getPlantName = (plantId: number | null) => {
    if (!plantId) return 'No Plant Selected';
    return plants.find((p) => p.id === plantId)?.name || `Plant ${plantId}`;
  };

  const handleDateSelect = (day: { dateString: string }) => {
    setFormData({ ...formData, date: day.dateString });
    setShowCalendar(false);
  };

  const handleSubmit = async () => {
    if (!canCreateSession) {
      Alert.alert('Permission Denied', 'You do not have permission to create tally sessions.');
      return;
    }
    if (!activePlantId) {
      Alert.alert('Error', 'No active plant selected. Please select a plant in Settings.');
      return;
    }
    if (!formData.customer_id) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    // Check for existing session with same customer, date, and plant
    try {
      const existingSessionsRes = await tallySessionsApi.getAll({
        customer_id: formData.customer_id,
        plant_id: activePlantId,
      });
      
      const existingSession = existingSessionsRes.data.find(
        (session) => session.date === formData.date
      );

      if (existingSession) {
        const customerName = getCustomerName(formData.customer_id);
        const formattedDate = formatDate(formData.date, timezone);
        
        Alert.alert(
          'Session Already Exists',
          `A session already exists for ${customerName} on ${formattedDate}. Do you want to create another session?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Create Anyway',
              onPress: () => createSession(),
            },
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Error checking for existing sessions:', error);
      // Continue with creation if check fails
    }

    // No existing session found, proceed with creation
    createSession();
  };

  const createSession = async () => {
    if (!activePlantId) return;

    setSubmitting(true);
    try {
      await tallySessionsApi.create({
        ...formData,
        plant_id: activePlantId,
      });
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!activePlantId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Please select an active plant in Settings to create a session.</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: {
      ...styles.container,
    },
    contentContainer: {
      ...styles.scrollContent,
    },
    form: {
      ...styles.form,
      padding: responsive.padding.large,
      width: '100%',
      maxWidth: '100%',
    },
    formGroup: {
      ...styles.formGroup,
      marginBottom: responsive.spacing.lg,
    },
    label: {
      ...styles.label,
      fontSize: responsive.fontSize.medium,
      marginBottom: responsive.spacing.md,
    },
    dropdownButton: {
      ...styles.dropdownButton,
      padding: responsive.padding.medium,
      minHeight: responsive.isTablet ? 48 : 44,
    },
    dropdownText: {
      ...styles.dropdownText,
      fontSize: responsive.fontSize.medium,
    },
    dropdownMenu: {
      ...styles.dropdownMenu,
      width: responsive.isTablet ? Math.min(responsive.width * 0.8, 500) : '90%',
    },
    dropdownOption: {
      ...styles.dropdownOption,
      padding: responsive.padding.medium,
    },
    dropdownOptionText: {
      ...styles.dropdownOptionText,
      fontSize: responsive.fontSize.medium,
    },
    calendarModal: {
      ...styles.calendarModal,
      width: responsive.isTablet ? Math.min(responsive.width * 0.8, 400) : '90%',
    },
    calendarTitle: {
      ...styles.calendarTitle,
      fontSize: responsive.fontSize.large,
    },
    plantInfo: {
      ...styles.plantInfo,
      padding: responsive.padding.medium,
    },
    plantInfoText: {
      ...styles.plantInfoText,
      fontSize: responsive.fontSize.medium,
    },
    submitButton: {
      ...styles.submitButton,
      padding: responsive.padding.medium,
      marginTop: responsive.spacing.lg,
      maxWidth: responsive.isTablet ? 400 : undefined,
      alignSelf: responsive.isTablet ? 'center' as const : 'stretch' as const,
    },
    submitButtonText: {
      ...styles.submitButtonText,
      fontSize: responsive.fontSize.medium,
    },
  };

  const selectedDateMarked = {
    [formData.date]: {
      selected: true,
      selectedColor: colors.primary,
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView style={dynamicStyles.container} contentContainerStyle={dynamicStyles.contentContainer}>
        <View style={dynamicStyles.form}>
          {/* Active Plant Display */}
          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.label}>Active Plant</Text>
            <View style={dynamicStyles.plantInfo}>
              <Text style={dynamicStyles.plantInfoText}>
                {getPlantName(activePlantId)}
              </Text>
            </View>
          </View>

          {/* Customer Dropdown */}
          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.label}>Customer</Text>
            <TouchableOpacity
              style={dynamicStyles.dropdownButton}
              onPress={() => setShowCustomerDropdown(true)}
            >
              <Text style={dynamicStyles.dropdownText}>
                {formData.customer_id ? getCustomerName(formData.customer_id) : 'Select Customer'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#2c3e50" />
            </TouchableOpacity>
          </View>

          {/* Date Calendar Picker */}
          <View style={dynamicStyles.formGroup}>
            <Text style={dynamicStyles.label}>Date</Text>
            <TouchableOpacity
              style={dynamicStyles.dropdownButton}
              onPress={() => setShowCalendar(true)}
            >
              <Text style={dynamicStyles.dropdownText}>
                {formatDate(formData.date, timezone)}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#2c3e50" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              dynamicStyles.submitButton, 
              (submitting || !canCreateSession) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={submitting || !canCreateSession}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={dynamicStyles.submitButtonText}>
                {canCreateSession ? 'Create Session' : 'No Permission to Create'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Customer Dropdown Modal */}
      <Modal
        visible={showCustomerDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomerDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomerDropdown(false)}
        >
          <View
            style={dynamicStyles.dropdownMenu}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Customer</Text>
              <TouchableOpacity
                onPress={() => setShowCustomerDropdown(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: responsive.isTablet ? 400 : 300 }}
              contentContainerStyle={{ paddingBottom: responsive.spacing.md }}
            >
              {customers.map((customer, index) => (
                <TouchableOpacity
                  key={customer.id}
                  style={[
                    dynamicStyles.dropdownOption,
                    index === customers.length - 1 && styles.dropdownOptionLast,
                    formData.customer_id === customer.id && styles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, customer_id: customer.id });
                    setShowCustomerDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      dynamicStyles.dropdownOptionText,
                      formData.customer_id === customer.id && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {customer.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={dynamicStyles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Calendar
              key={currentMonth}
              current={currentMonth}
              onDayPress={handleDateSelect}
              onMonthChange={(month) => {
                setCurrentMonth(month.dateString.slice(0, 7));
              }}
              markedDates={selectedDateMarked}
              enableSwipeMonths={true}
              hideExtraDays={true}
              firstDay={1}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#b6c1cd',
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                dotColor: colors.primary,
                selectedDotColor: '#ffffff',
                arrowColor: colors.primary,
                monthTextColor: '#2d4150',
                indicatorColor: colors.primary,
                textDayFontWeight: '400',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 13,
              }}
            />
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
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    flexGrow: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '500',
    color: '#2c3e50',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dropdownText: {
    color: '#2c3e50',
    flex: 1,
  },
  plantInfo: {
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  plantInfoText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  dropdownOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.primary,
  },
  dropdownOptionText: {
    color: '#2c3e50',
  },
  dropdownOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarModal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  calendarTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default CreateTallySessionScreen;
