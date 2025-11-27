import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, Alert, Platform, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { tallySessionsApi, customersApi, plantsApi, exportApi } from '../services/api';
import type { TallySession, Customer, Plant } from '../types';
import { useResponsive } from '../utils/responsive';
import { useTimezone } from '../contexts/TimezoneContext';
import { usePlant } from '../contexts/PlantContext';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { getActiveSessions, toggleActiveSession, isActiveSession, getMaxActiveSessions, setActiveSessions } from '../utils/activeSessions';
import { usePermissions } from '../utils/usePermissions';
import { generateSessionReportHTML } from '../utils/pdfGenerator';

function TallySessionsScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const { activePlantId } = usePlant();
  const { hasPermission } = usePermissions();
  const canStartTally = hasPermission('can_tally');
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [allSessions, setAllSessions] = useState<TallySession[]>([]); // Store all sessions for filtering
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [activeSessionIds, setActiveSessionIds] = useState<number[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [hasMoreUnfilteredPages, setHasMoreUnfilteredPages] = useState(false);
  const SESSIONS_PER_PAGE = 10;
  const hasInitiallyLoaded = useRef(false);

  // Filter state
  const [filterCustomerId, setFilterCustomerId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [showExportTypeModal, setShowExportTypeModal] = useState(false);

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when plant changes
    fetchData().then(() => {
      hasInitiallyLoaded.current = true;
    });
    loadActiveSessions();
  }, [activePlantId]); // Refetch when activePlantId changes

  const loadActiveSessions = async () => {
    try {
      const activeIds = await getActiveSessions();
      setActiveSessionIds(activeIds);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  };

  // Refresh sessions when screen comes into focus (e.g., when returning from session details)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we've already loaded data initially (not on first mount)
      if (hasInitiallyLoaded.current && !loading && !refreshing) {
        // Use a small delay to ensure the previous screen has fully navigated away
        const timeoutId = setTimeout(() => {
          fetchData(false); // Don't show loading spinner on refresh
          loadActiveSessions();
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }, [loading, refreshing, activePlantId])
  );

  const fetchData = async (showLoading = true, page: number = currentPage) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const params: any = {};
      if (activePlantId) {
        params.plant_id = activePlantId;
      }
      
      // Add pagination parameters
      const skip = (page - 1) * SESSIONS_PER_PAGE;
      const limit = SESSIONS_PER_PAGE;
      params.skip = skip;
      params.limit = limit + 1; // Fetch one extra to check if there are more pages

      const [sessionsRes, customersRes, plantsRes] = await Promise.all([
        tallySessionsApi.getAll(params),
        customersApi.getAll(),
        plantsApi.getAll(),
      ]);

      // Check if there are more pages
      const sessions = sessionsRes.data;
      const hasMore = sessions.length > SESSIONS_PER_PAGE;
      if (hasMore) {
        sessions.pop(); // Remove the extra item
      }
      setHasMoreUnfilteredPages(hasMore);

      setAllSessions(sessions);
      setCustomers(customersRes.data);
      setPlants(plantsRes.data);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false, currentPage);
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

  const handleToggleActive = async (sessionId: number) => {
    try {
      const isActive = activeSessionIds.includes(sessionId);
      
      if (!isActive && activeSessionIds.length >= getMaxActiveSessions()) {
        Alert.alert(
          'Maximum Active Sessions Reached',
          `You can only have ${getMaxActiveSessions()} active sessions at a time. Please remove an active session first.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      const newActiveStatus = await toggleActiveSession(sessionId);
      await loadActiveSessions();
      
      if (!newActiveStatus && !isActive) {
        // This means we tried to add but hit the limit (shouldn't happen due to check above, but just in case)
        Alert.alert(
          'Maximum Active Sessions Reached',
          `You can only have ${getMaxActiveSessions()} active sessions at a time.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error toggling active session:', error);
      Alert.alert('Error', 'Failed to update active session');
    }
  };

  const toggleActiveFilter = () => {
    const newValue = !showActiveOnly;
    setShowActiveOnly(newValue);
    
    // Clear all filters when toggling active sessions
    if (newValue) {
      setFilterCustomerId(null);
      setFilterStatus('');
      setSelectedDate(null);
    }
  };

  // Selection mode handlers
  const handleLongPress = (sessionId: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedSessionIds([sessionId]);
    }
  };

  const toggleSessionSelection = (sessionId: number) => {
    if (!isSelectionMode) return;
    
    setSelectedSessionIds(prev => {
      if (prev.includes(sessionId)) {
        return prev.filter(id => id !== sessionId);
      } else {
        return [...prev, sessionId];
      }
    });
  };

  const selectAll = () => {
    if (selectedSessionIds.length === sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map(s => s.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedSessionIds([]);
  };

  // Export handlers
  const formatDateForFilename = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const handleExportButtonPress = () => {
    if (selectedSessionIds.length === 0) {
      Alert.alert('No Selection', 'Please select at least one session to export.');
      return;
    }
    setShowExportTypeModal(true);
  };

  const handleExportAllocationSummary = async () => {
    try {
      setExporting(true);
      
      const response = await exportApi.exportSessions({
        session_ids: selectedSessionIds
      });

      const html = generateSessionReportHTML(response.data);

      const { uri } = await printToFileAsync({
        html,
        base64: false
      });

      const currentDate = new Date();
      const dateString = formatDateForFilename(currentDate);
      const filename = `Allocation Report (${dateString}).pdf`;
      
      const fileDir = uri.substring(0, uri.lastIndexOf('/') + 1);
      const newUri = fileDir + filename;
      
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(newUri, { idempotent: true });
      }
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      await shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setExporting(false);
      setShowExportTypeModal(false);
      exitSelectionMode();
    }
  };

  const handleExportTallySheet = () => {
    Alert.alert('Coming Soon', 'Tally Sheet Report export will be available in a future update.');
  };

  // Filter sessions by all filters and apply sorting
  useEffect(() => {
    let filtered = allSessions;
    
    // Filter by active status if enabled
    if (showActiveOnly) {
      filtered = filtered.filter((session) => activeSessionIds.includes(session.id));
    }
    
    // Filter by selected date if set
    if (selectedDate) {
      filtered = filtered.filter((session) => {
        const sessionDate = new Date(session.created_at).toISOString().split('T')[0];
        return sessionDate === selectedDate;
      });
    }

    // Filter by Status
    if (filterStatus) {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    // Filter by Customer
    if (filterCustomerId) {
      filtered = filtered.filter(s => s.customer_id === filterCustomerId);
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    setSessions(filtered);
    
    // Update hasMorePages based on filtered results
    const hasFilters = showActiveOnly || selectedDate || filterStatus || filterCustomerId;
    if (hasFilters) {
      // Special case: If filtering by active sessions only, max is 10 active sessions
      // Since max is 10 and page size is 10, there can only be 1 page of active sessions
      if (showActiveOnly && !selectedDate && !filterStatus && !filterCustomerId) {
        setHasMorePages(false);
      } else {
        // With other filters: disable next button if:
        // 1. We got fewer than page size from server (no more pages available), OR
        // 2. Filtered results are less than page size (all matching results fit on this page)
        const hasFewerUnfiltered = allSessions.length < SESSIONS_PER_PAGE;
        const hasFewerFiltered = filtered.length < SESSIONS_PER_PAGE;
        setHasMorePages(hasMoreUnfilteredPages && !hasFewerUnfiltered && !hasFewerFiltered);
      }
    } else {
      // Without filters, use the server-side pagination indicator
      setHasMorePages(hasMoreUnfilteredPages);
    }
  }, [selectedDate, allSessions, showActiveOnly, activeSessionIds, hasMoreUnfilteredPages, filterStatus, filterCustomerId, sortBy, sortOrder, SESSIONS_PER_PAGE]);

  // Reset to page 1 when filters change (but not on initial load)
  useEffect(() => {
    if (hasInitiallyLoaded.current) {
      setCurrentPage(1);
      fetchData(false, 1);
    }
  }, [selectedDate, showActiveOnly, filterStatus, filterCustomerId]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchData(true, newPage);
    }
  };

  const handleNextPage = () => {
    if (hasMorePages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchData(true, newPage);
    }
  };

  const handleResetActiveSessions = () => {
    Alert.alert(
      'Reset Active Sessions',
      'Are you sure you want to clear all active sessions? This will remove all sessions marked as active.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await setActiveSessions([]);
              await loadActiveSessions();
              // Refresh the sessions list to update the active status
              fetchData(false, currentPage);
            } catch (error) {
              console.error('Error resetting active sessions:', error);
              Alert.alert('Error', 'Failed to reset active sessions');
            }
          },
        },
      ]
    );
  };

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

  const handleMonthYearSelect = () => {
    const newMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
    setShowMonthYearPicker(false);
    // Force calendar to update by ensuring the current prop changes
    // The Calendar component will automatically navigate to the new month
  };

  // Generate year options (current year ± 10 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Render filter modal
  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.filterModalOverlay}>
        <View style={styles.filterModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters & Sort</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            <Text style={styles.filterLabel}>Date</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => {
                setShowFilters(false);
                setShowCalendar(true);
              }}
            >
              <Text style={styles.datePickerButtonText}>
                {selectedDate ? formatDate(selectedDate, timezone) : 'Select Date'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#3498db" />
            </TouchableOpacity>
            {selectedDate && (
              <TouchableOpacity
                style={styles.clearDateButton}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={styles.clearDateButtonText}>Clear Date</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterPickerContainer}>
              <Picker
                selectedValue={filterStatus}
                onValueChange={(itemValue) => setFilterStatus(itemValue)}
              >
                <Picker.Item label="All Statuses" value="" />
                <Picker.Item label="Completed" value="completed" />
                <Picker.Item label="Ongoing" value="ongoing" />
                <Picker.Item label="Cancelled" value="cancelled" />
              </Picker>
            </View>

            <Text style={styles.filterLabel}>Customer</Text>
            <View style={styles.filterPickerContainer}>
              <Picker
                selectedValue={filterCustomerId}
                onValueChange={(itemValue) => setFilterCustomerId(itemValue)}
              >
                <Picker.Item label="All Customers" value={null} />
                {customers.map(c => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.filterLabel}>Sort By</Text>
            <View style={styles.row}>
              <TouchableOpacity 
                style={[styles.sortButton, sortBy === 'date' && styles.activeSortButton]}
                onPress={() => setSortBy('date')}
              >
                <Text style={[styles.sortButtonText, sortBy === 'date' && styles.activeSortButtonText]}>Date</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sortButton, sortBy === 'status' && styles.activeSortButton]}
                onPress={() => setSortBy('status')}
              >
                <Text style={[styles.sortButtonText, sortBy === 'status' && styles.activeSortButtonText]}>Status</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Sort Order</Text>
            <View style={styles.row}>
              <TouchableOpacity 
                style={[styles.sortButton, sortOrder === 'asc' && styles.activeSortButton]}
                onPress={() => setSortOrder('asc')}
              >
                <Text style={[styles.sortButtonText, sortOrder === 'asc' && styles.activeSortButtonText]}>Ascending</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sortButton, sortOrder === 'desc' && styles.activeSortButton]}
                onPress={() => setSortOrder('desc')}
              >
                <Text style={[styles.sortButtonText, sortOrder === 'desc' && styles.activeSortButtonText]}>Descending</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.filterModalActions}>
            <TouchableOpacity 
              style={styles.resetButtonBottom}
              onPress={() => {
                setFilterCustomerId(null);
                setFilterStatus('');
                setSelectedDate(null);
                setSortBy('date');
                setSortOrder('desc');
              }}
            >
              <Text style={styles.resetButtonText}>Reset filters</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );


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
    addButton: {
      ...styles.addButton,
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.spacing.sm,
      minHeight: responsive.isTablet ? 48 : 40,
      alignItems: 'center',
      justifyContent: 'center',
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
      minHeight: responsive.isTablet ? 48 : 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarButtonText: {
      ...styles.calendarButtonText,
      fontSize: responsive.fontSize.medium,
    },
    calendarModal: {
      ...styles.calendarModal,
      width: responsive.isTablet ? Math.min(responsive.width * 0.8, 400) : '90%',
    },
    monthYearPickerModal: {
      ...styles.monthYearPickerModal,
      width: responsive.isTablet ? Math.min(responsive.width * 0.8, 500) : '90%',
      maxHeight: responsive.isTablet ? '70%' : '80%',
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
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>{activePlantName || 'Tally Sessions'}</Text>
        <View style={styles.headerButtons}>
          {isSelectionMode ? (
            <>
              {hasPermission('can_export_data') && selectedSessionIds.length > 0 && (
                <TouchableOpacity
                  style={[dynamicStyles.calendarButton, { backgroundColor: '#27ae60' }]}
                  onPress={handleExportButtonPress}
                  disabled={exporting}
                >
                  {exporting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <MaterialIcons name="picture-as-pdf" size={responsive.fontSize.large} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[dynamicStyles.calendarButton]}
                onPress={selectAll}
              >
                <Text style={{ color: '#fff', fontSize: responsive.fontSize.small, fontWeight: '600' }}>
                  {selectedSessionIds.length === sessions.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.calendarButton]}
                onPress={exitSelectionMode}
              >
                <MaterialIcons name="close" size={responsive.fontSize.large} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[dynamicStyles.calendarButton, (selectedDate || filterStatus || filterCustomerId) && styles.calendarButtonActive]}
                onPress={() => setShowFilters(true)}
              >
                <MaterialIcons name="filter-list" size={responsive.fontSize.large} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.calendarButton, showActiveOnly && styles.calendarButtonActive]}
                onPress={toggleActiveFilter}
              >
                <MaterialIcons 
                  name={showActiveOnly ? 'star' : 'star-border'} 
                  size={responsive.fontSize.large} 
                  color={showActiveOnly ? '#f39c12' : '#fff'} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.calendarButton, !canStartTally && { opacity: 0.5 }]}
                onPress={() => navigation.navigate('CreateTallySession' as never)}
                disabled={!canStartTally}
              >
                <MaterialIcons name="add" size={responsive.fontSize.large} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Filter Status Subheader */}
      {(showActiveOnly || selectedDate || filterStatus || filterCustomerId || isSelectionMode) && (
        <View style={styles.filterStatusBar}>
          <View style={styles.filterStatusContent}>
            <MaterialIcons name="filter-list" size={16} color="#7f8c8d" />
            <Text style={styles.filterStatusText}>
              {isSelectionMode
                ? `${selectedSessionIds.length} session${selectedSessionIds.length !== 1 ? 's' : ''} selected`
                : showActiveOnly && selectedDate
                ? `Active sessions for ${formatDate(selectedDate, timezone)}`
                : showActiveOnly
                ? 'Showing active sessions only'
                : selectedDate
                ? `Showing sessions for ${formatDate(selectedDate, timezone)}`
                : filterStatus || filterCustomerId
                ? 'Filters applied'
                : 'Showing all sessions'}
            </Text>
            <View style={styles.filterStatusActions}>
              {!isSelectionMode && showActiveOnly && activeSessionIds.length > 0 && (
                <TouchableOpacity
                  style={styles.resetActiveButton}
                  onPress={handleResetActiveSessions}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <MaterialIcons name="refresh" size={16} color="#e74c3c" />
                  <Text style={styles.resetActiveText}>Reset Active</Text>
                </TouchableOpacity>
              )}
              {!isSelectionMode && (showActiveOnly || selectedDate || filterStatus || filterCustomerId) && (
                <TouchableOpacity
                  style={styles.clearFiltersButton}
                  onPress={() => {
                    setShowActiveOnly(false);
                    setSelectedDate(null);
                    setFilterStatus('');
                    setFilterCustomerId(null);
                  }}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <MaterialIcons name="close" size={16} color="#7f8c8d" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={sessions}
        renderItem={({ item }) => {
          const isActive = activeSessionIds.includes(item.id);
          const isSelected = selectedSessionIds.includes(item.id);
          return (
            <TouchableOpacity
              style={[
                dynamicStyles.sessionCard,
                isSelectionMode && isSelected && styles.selectedCard
              ]}
              onLongPress={() => handleLongPress(item.id)}
              onPress={() => {
                if (isSelectionMode) {
                  toggleSessionSelection(item.id);
                } else {
                  navigation.navigate('TallySessionDetail' as never, { sessionId: item.id } as never);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.sessionHeader}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  {isSelectionMode && (
                    <View style={styles.checkboxContainer}>
                      <MaterialIcons
                        name={isSelected ? "check-box" : "check-box-outline-blank"}
                        size={24}
                        color={isSelected ? "#3498db" : "#757575"}
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.activeToggleButton}
                    onPress={() => handleToggleActive(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={isSelectionMode}
                  >
                    <MaterialIcons
                      name={isActive ? 'star' : 'star-border'}
                      size={24}
                      color={isActive ? '#f39c12' : '#95a5a6'}
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[dynamicStyles.sessionId, { marginLeft: 8 }]}>
                      {getCustomerName(item.customer_id)} - Order #{item.session_number} - {formatDate(item.created_at, timezone)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.sessionDate}>Created: {formatDate(item.date, timezone)}</Text>
                <Text style={styles.sessionDate}>Last edited: {formatDateTime(item.updated_at, timezone)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={dynamicStyles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {showActiveOnly && selectedDate
                ? `No active sessions found for ${formatDate(selectedDate, timezone)}.`
                : showActiveOnly
                ? 'No active sessions found for this plant.'
                : selectedDate || filterStatus || filterCustomerId
                ? 'No sessions found matching the current filters.'
                : 'No sessions found for this plant.'}
            </Text>
          </View>
        }
      />

      {/* Pagination Controls */}
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
          onPress={handlePreviousPage}
          disabled={currentPage === 1}
        >
          <MaterialIcons 
            name="chevron-left" 
            size={24} 
            color={currentPage === 1 ? '#bdc3c7' : '#2c3e50'} 
          />
          <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.paginationInfo}>
          Page {currentPage}
        </Text>
        
        <TouchableOpacity
          style={[styles.paginationButton, !hasMorePages && styles.paginationButtonDisabled]}
          onPress={handleNextPage}
          disabled={!hasMorePages}
        >
          <Text style={[styles.paginationButtonText, !hasMorePages && styles.paginationButtonTextDisabled]}>
            Next
          </Text>
          <MaterialIcons 
            name="chevron-right" 
            size={24} 
            color={!hasMorePages ? '#bdc3c7' : '#2c3e50'} 
          />
        </TouchableOpacity>
      </View>

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
              <Text style={dynamicStyles.calendarTitle}>Filter</Text>
              <View style={styles.calendarHeaderButtons}>
                <TouchableOpacity
                  style={styles.monthYearButton}
                  onPress={() => {
                    const current = new Date(currentMonth + '-01');
                    setSelectedYear(current.getFullYear());
                    setSelectedMonth(current.getMonth() + 1);
                    setShowMonthYearPicker(true);
                  }}
                >
                  <Text style={styles.monthYearButtonText}>
                    {new Date(currentMonth + '-01').toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Calendar
              key={currentMonth} // Force re-render when month changes
              current={currentMonth}
              onDayPress={handleDateSelect}
              onMonthChange={(month) => {
                setCurrentMonth(month.dateString.slice(0, 7));
              }}
              markedDates={markedDates}
              enableSwipeMonths={true}
              hideExtraDays={true}
              firstDay={1}
              // Enable month/year selection by tapping the header
              // The library handles this automatically - tapping month/year opens picker
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
                textMonthFontSize: 18,
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

      {/* Month/Year Picker Modal */}
      <Modal
        visible={showMonthYearPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthYearPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.monthYearPickerModal}>
            <View style={styles.monthYearPickerHeader}>
              <Text style={dynamicStyles.calendarTitle}>Select Month & Year</Text>
              <TouchableOpacity onPress={() => setShowMonthYearPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Month</Text>
                <FlatList
                  data={months}
                  keyExtractor={(_, index) => String(index + 1)}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.pickerOption,
                        selectedMonth === index + 1 && styles.pickerOptionSelected,
                      ]}
                      onPress={() => setSelectedMonth(index + 1)}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          selectedMonth === index + 1 && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  initialScrollIndex={selectedMonth - 1}
                  getItemLayout={(_, index) => ({
                    length: 44,
                    offset: 44 * index,
                    index,
                  })}
                />
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Year</Text>
                <FlatList
                  data={years}
                  keyExtractor={(item) => String(item)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.pickerOption,
                        selectedYear === item && styles.pickerOptionSelected,
                      ]}
                      onPress={() => setSelectedYear(item)}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          selectedYear === item && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  initialScrollIndex={years.indexOf(selectedYear)}
                  getItemLayout={(_, index) => ({
                    length: 44,
                    offset: 44 * index,
                    index,
                  })}
                />
              </View>
            </View>
            <View style={styles.monthYearPickerActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowMonthYearPicker(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleMonthYearSelect}
              >
                <Text style={styles.confirmButtonText}>Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      {renderFilterModal()}

      {/* Export Type Selection Modal */}
      {hasPermission('can_export_data') && (
        <Modal
          transparent
          visible={showExportTypeModal}
          animationType="fade"
          onRequestClose={() => setShowExportTypeModal(false)}
        >
          <View style={styles.exportTypeModalOverlay}>
            <View style={styles.exportTypeModalContent}>
              <Text style={styles.exportTypeModalTitle}>Choose Export Type</Text>
              <Text style={styles.exportTypeModalSubtitle}>
                Exporting {selectedSessionIds.length} session{selectedSessionIds.length !== 1 ? 's' : ''}
              </Text>

              {/* Allocation Summary */}
              <TouchableOpacity
                style={[styles.exportTypeOption, styles.exportTypeOptionPrimary]}
                onPress={handleExportAllocationSummary}
                disabled={exporting}
              >
                <MaterialIcons
                  name="description"
                  size={24}
                  color="#fff"
                  style={styles.exportTypeOptionIcon}
                />
                <View style={styles.exportTypeOptionContent}>
                  <Text style={styles.exportTypeOptionTitleLight}>Allocation Summary</Text>
                  <Text style={styles.exportTypeOptionDescLight}>
                    Weight classifications and bag allocations
                  </Text>
                </View>
                {exporting && <ActivityIndicator size="small" color="#fff" />}
              </TouchableOpacity>

              {/* Tally Sheet Report (Placeholder) */}
              <TouchableOpacity
                style={[styles.exportTypeOption, styles.exportTypeOptionDisabled]}
                onPress={handleExportTallySheet}
                disabled={true}
              >
                <MaterialIcons
                  name="list-alt"
                  size={24}
                  color="#2c3e50"
                  style={styles.exportTypeOptionIcon}
                />
                <View style={styles.exportTypeOptionContent}>
                  <Text style={styles.exportTypeOptionTitle}>Tally Sheet Report</Text>
                  <Text style={styles.exportTypeOptionDesc}>Coming soon</Text>
                </View>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonBadgeText}>SOON</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportTypeCancelButton}
                onPress={() => setShowExportTypeModal(false)}
                disabled={exporting}
              >
                <Text style={styles.exportTypeCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  activeToggleButton: {
    padding: 4,
    marginRight: 4,
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
  filterStatusBar: {
    backgroundColor: '#ecf0f1',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  filterStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterStatusText: {
    flex: 1,
    color: '#7f8c8d',
    fontSize: 13,
    fontWeight: '500',
  },
  filterStatusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetActiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#fee',
  },
  resetActiveText: {
    color: '#e74c3c',
    fontSize: 12,
    fontWeight: '600',
  },
  clearFiltersButton: {
    padding: 4,
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
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
  monthYearHeader: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d4150',
  },
  calendarHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthYearButton: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    marginRight: 10,
  },
  monthYearButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: 14,
  },
  monthYearPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  monthYearPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  pickerContainer: {
    flexDirection: 'row',
    height: 300,
    marginBottom: 15,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  pickerOption: {
    padding: 12,
    borderRadius: 5,
    marginBottom: 2,
  },
  pickerOptionSelected: {
    backgroundColor: '#3498db',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  monthYearPickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#95a5a6',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#3498db',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
  },
  paginationButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  paginationButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: 14,
    marginHorizontal: 4,
  },
  paginationButtonTextDisabled: {
    color: '#bdc3c7',
  },
  paginationInfo: {
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '500',
  },
  // Filter Modal Styles
  filterModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  modalBodyContent: {
    paddingBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  filterPickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    padding: 12,
    marginBottom: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  clearDateButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearDateButtonText: {
    color: '#e74c3c',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sortButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  activeSortButton: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  sortButtonText: {
    color: '#666',
  },
  activeSortButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  filterModalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resetButtonBottom: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Selection Mode Styles
  selectedCard: {
    borderColor: '#3498db',
    borderWidth: 2,
    backgroundColor: '#f0f8ff',
  },
  checkboxContainer: {
    marginRight: 8,
  },
  // Export Type Modal Styles
  exportTypeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportTypeModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 360,
  },
  exportTypeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  exportTypeModalSubtitle: {
    fontSize: 13,
    color: '#3498db',
    marginBottom: 16,
    fontWeight: '500',
  },
  exportTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  exportTypeOptionPrimary: {
    backgroundColor: '#27ae60',
  },
  exportTypeOptionDisabled: {
    backgroundColor: '#ecf0f1',
    opacity: 0.7,
  },
  exportTypeOptionIcon: {
    marginRight: 12,
  },
  exportTypeOptionContent: {
    flex: 1,
  },
  exportTypeOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
  },
  exportTypeOptionTitleLight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  exportTypeOptionDesc: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  exportTypeOptionDescLight: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  soonBadge: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  soonBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  exportTypeCancelButton: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  exportTypeCancelButtonText: {
    fontSize: 15,
    color: '#7f8c8d',
    fontWeight: '600',
  },
});

export default TallySessionsScreen;
