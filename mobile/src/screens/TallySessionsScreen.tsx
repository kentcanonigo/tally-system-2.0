import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { tallySessionsApi, customersApi, plantsApi } from '../services/api';
import type { TallySession, Customer, Plant } from '../types';
import { useResponsive } from '../utils/responsive';
import { useTimezone } from '../contexts/TimezoneContext';
import { usePlant } from '../contexts/PlantContext';
import { formatDate, formatDateTime } from '../utils/dateFormat';

function TallySessionsScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const { activePlantId } = usePlant();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [allSessions, setAllSessions] = useState<TallySession[]>([]); // Store all sessions for filtering
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const hasInitiallyLoaded = useRef(false);

  useEffect(() => {
    fetchData().then(() => {
      hasInitiallyLoaded.current = true;
    });
  }, [activePlantId]); // Refetch when activePlantId changes

  // Refresh sessions when screen comes into focus (e.g., when returning from session details)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we've already loaded data initially (not on first mount)
      if (hasInitiallyLoaded.current && !loading && !refreshing) {
        // Use a small delay to ensure the previous screen has fully navigated away
        const timeoutId = setTimeout(() => {
          fetchData(false); // Don't show loading spinner on refresh
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }, [loading, refreshing, activePlantId])
  );

  const fetchData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const params: any = {};
      if (activePlantId) {
        params.plant_id = activePlantId;
      }

      const [sessionsRes, customersRes, plantsRes] = await Promise.all([
        tallySessionsApi.getAll(params),
        customersApi.getAll(),
        plantsApi.getAll(),
      ]);

      setAllSessions(sessionsRes.data);
      setSessions(sessionsRes.data);
      setCustomers(customersRes.data);
      setPlants(plantsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getCustomerName = (customerId: number) => {
    return customers.find((c) => c.id === customerId)?.name || `Customer ${customerId}`;
  };

  const getPlantName = (plantId: number) => {
    return plants.find((p) => p.id === plantId)?.name || `Plant ${plantId}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return '#f39c12';
      case 'completed':
        return '#27ae60';
      case 'cancelled':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  // Filter sessions by selected date
  useEffect(() => {
    if (selectedDate) {
      const filtered = allSessions.filter((session) => {
        const sessionDate = new Date(session.created_at).toISOString().split('T')[0];
        return sessionDate === selectedDate;
      });
      setSessions(filtered);
    } else {
      setSessions(allSessions);
    }
  }, [selectedDate, allSessions]);

  // Create marked dates object for calendar highlighting
  const markedDates = useMemo(() => {
    const marked: { [key: string]: { marked: boolean; dotColor: string } } = {};
    allSessions.forEach((session) => {
      const dateKey = new Date(session.created_at).toISOString().split('T')[0];
      if (!marked[dateKey]) {
        marked[dateKey] = { marked: true, dotColor: '#3498db' };
      }
    });
    
    // Add selected date styling
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#3498db',
      };
    }
    
    return marked;
  }, [allSessions, selectedDate]);

  const handleDateSelect = (day: { dateString: string }) => {
    if (selectedDate === day.dateString) {
      // If same date clicked, clear filter
      setSelectedDate(null);
    } else {
      setSelectedDate(day.dateString);
    }
    setShowCalendar(false);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    setShowCalendar(false);
  };


  if (loading && sessions.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (!activePlantId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Please select an active plant in Settings to view sessions.</Text>
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
    addButton: {
      ...styles.addButton,
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.spacing.sm,
    },
    addButtonText: {
      ...styles.addButtonText,
      fontSize: responsive.fontSize.small,
    },
    calendarButton: {
      ...styles.calendarButton,
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.spacing.sm,
      marginRight: responsive.spacing.sm,
    },
    calendarButtonText: {
      ...styles.calendarButtonText,
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
    list: {
      ...styles.list,
      padding: responsive.padding.medium,
      width: '100%',
      maxWidth: '100%',
    },
    sessionCard: {
      ...styles.sessionCard,
      padding: responsive.padding.medium,
      marginBottom: responsive.spacing.md,
    },
    sessionId: {
      ...styles.sessionId,
      fontSize: responsive.fontSize.medium,
    },
    sessionInfo: {
      ...styles.sessionInfo,
      fontSize: responsive.fontSize.small,
    },
  };

  const activePlantName = activePlantId ? getPlantName(activePlantId) : '';

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>{activePlantName || 'Tally Sessions'}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[dynamicStyles.calendarButton, selectedDate && styles.calendarButtonActive]}
            onPress={() => setShowCalendar(true)}
          >
            <Text style={dynamicStyles.calendarButtonText}>📅</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={dynamicStyles.addButton}
            onPress={() => navigation.navigate('CreateTallySession' as never)}
          >
            <Text style={dynamicStyles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sessions}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={dynamicStyles.sessionCard}
            onPress={() => navigation.navigate('TallySessionDetail' as never, { sessionId: item.id } as never)}
          >
            <View style={styles.sessionHeader}>
              <Text style={dynamicStyles.sessionId}>
                {getCustomerName(item.customer_id)} - {formatDate(item.created_at, timezone)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.sessionDate}>Created: {formatDate(item.date, timezone)}</Text>
            <Text style={styles.sessionDate}>Last edited: {formatDateTime(item.updated_at, timezone)}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={dynamicStyles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedDate 
                ? `No sessions found for ${formatDate(selectedDate, timezone)}.` 
                : 'No sessions found for this plant.'}
            </Text>
          </View>
        }
      />

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
              <Text style={dynamicStyles.calendarTitle}>Filter by Date Created</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={markedDates}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#b6c1cd',
                selectedDayBackgroundColor: '#3498db',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#3498db',
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                dotColor: '#3498db',
                selectedDotColor: '#ffffff',
                arrowColor: '#3498db',
                monthTextColor: '#2d4150',
                indicatorColor: '#3498db',
                textDayFontWeight: '400',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13,
              }}
            />
            {selectedDate && (
              <View style={styles.calendarActions}>
                <TouchableOpacity
                  style={styles.clearFilterButton}
                  onPress={clearDateFilter}
                >
                  <Text style={styles.clearFilterText}>Clear Filter</Text>
                </TouchableOpacity>
              </View>
            )}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#3498db',
    borderRadius: 5,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    flexGrow: 1,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionId: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  sessionInfo: {
    color: '#7f8c8d',
    marginBottom: 5,
  },
  sessionDate: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 5,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    fontSize: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarButton: {
    backgroundColor: '#34495e',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  calendarButtonActive: {
    backgroundColor: '#3498db',
  },
  calendarButtonText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  closeButton: {
    fontSize: 24,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  calendarActions: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  clearFilterButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
  },
  clearFilterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default TallySessionsScreen;
