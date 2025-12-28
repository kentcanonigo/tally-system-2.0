import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, Modal, BackHandler, ViewStyle, TextStyle, DimensionValue, TextInput } from 'react-native';
import { useRoute, useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate, formatTime, formatDateTime } from '../utils/dateFormat';
import { useAcceptableDifference } from '../utils/settings';
import {
  tallySessionsApi,
  customersApi,
  plantsApi,
  weightClassificationsApi,
  tallyLogEntriesApi,
} from '../services/api';
import type { TallySession, Customer, Plant, WeightClassification, TallyLogEntry, TallyLogEntryAudit } from '../types';
import { TallyLogEntryRole } from '../types';
import { useResponsive } from '../utils/responsive';
import { usePermissions } from '../utils/usePermissions';
import { SafeAreaView } from 'react-native-safe-area-context';

function TallySessionLogsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const threshold = useAcceptableDifference();
  const { hasPermission } = usePermissions();
  const sessionId = (route.params as any)?.sessionId;
  const fromTallyTab = (route.params as any)?.fromTallyTab;
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [logEntries, setLogEntries] = useState<TallyLogEntry[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<{
    role: TallyLogEntryRole | 'all';
    weight_classification_id: number | 'all';
    category: 'Dressed' | 'Byproduct' | 'Frozen' | 'all';
  }>({
    role: 'all',
    weight_classification_id: 'all',
    category: 'all',
  });
  const [sortBy, setSortBy] = useState<'class' | 'weight' | 'time' | 'id'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showWeightClassDropdown, setShowWeightClassDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortByDropdown, setShowSortByDropdown] = useState(false);
  const [showSortOrderDropdown, setShowSortOrderDropdown] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    description: true,
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransferCustomerDropdown, setShowTransferCustomerDropdown] = useState(false);
  const [showTransferSessionDropdown, setShowTransferSessionDropdown] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [availableSessions, setAvailableSessions] = useState<TallySession[]>([]);
  const [selectedTargetCustomerId, setSelectedTargetCustomerId] = useState<number | null>(null);
  const [selectedTargetSessionId, setSelectedTargetSessionId] = useState<number | null>(null);
  const [loadingTransferData, setLoadingTransferData] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TallyLogEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    weight: 0,
    role: TallyLogEntryRole.TALLY,
    heads: 0,
    notes: '',
    weight_classification_id: 0,
  });
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedEntryForAudit, setSelectedEntryForAudit] = useState<TallyLogEntry | null>(null);
  const [auditHistory, setAuditHistory] = useState<TallyLogEntryAudit[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showEditWeightClassDropdown, setShowEditWeightClassDropdown] = useState(false);
  const [showEditRoleDropdown, setShowEditRoleDropdown] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Only navigate to Tally tab if we explicitly came from there
        if (fromTallyTab === true && sessionId) {
          // Navigate back to Tally tab if we came from there, preserving the session selection
          const parent = navigation.getParent();
          const tabNavigator = parent?.getParent();
          if (tabNavigator) {
            // Use navigate instead of jumpTo to pass params
            (tabNavigator as any).navigate('Tally', { restoreSessionId: sessionId });
          } else {
            (navigation as any).navigate('Tally', { restoreSessionId: sessionId });
          }
          return true; // Prevent default back behavior
        }
        return false; // Allow default back behavior (go back in stack)
      });

      return () => backHandler.remove();
    }
  }, [fromTallyTab, navigation, sessionId]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (sessionId) {
        const hasData = session !== null || logEntries.length > 0;
        if (hasData && !loading && !refreshing) {
          fetchData(false);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId])
  );

  const fetchData = async (showLoading = true) => {
    if (!sessionId) return;
    
    // Check permission before fetching
    if (!hasPermission('can_view_tally_logs')) {
      setLoading(false);
      return;
    }
    
    if (showLoading) {
      setLoading(true);
    }
    try {
      const sessionRes = await tallySessionsApi.getById(sessionId);
      const sessionData = sessionRes.data;
      setSession(sessionData);

      const [customerRes, plantRes, entriesRes, wcRes] = await Promise.all([
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        tallyLogEntriesApi.getBySession(sessionId),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ]);

      setCustomer(customerRes.data);
      setPlant(plantRes.data);
      setLogEntries(entriesRes.data);
      setWeightClassifications(wcRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load session logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const getWeightClassificationName = (wcId: number) => {
    return weightClassifications.find((wc) => wc.id === wcId)?.classification || wcId;
  };

  const formatWeightRange = (wc: WeightClassification): string => {
    // For Byproduct with both weights null, show N/A
    if (wc.category === 'Byproduct' && wc.min_weight === null && wc.max_weight === null) {
      return 'N/A';
    }
    // For Dressed with both weights null, show All Sizes (catch-all)
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'All Sizes';
    }
    if (wc.min_weight === null && wc.max_weight !== null) {
      return `Up to ${wc.max_weight}`;
    }
    if (wc.max_weight === null) {
      return `${wc.min_weight} and up`;
    }
    return `${wc.min_weight}-${wc.max_weight}`;
  };

  const getRoleLabel = (role: TallyLogEntryRole | 'all') => {
    if (role === 'all') return 'All Roles';
    if (role === TallyLogEntryRole.TALLY) return 'Tally-er';
    return 'Dispatcher';
  };

  const getWeightClassLabel = (wcId: number | 'all') => {
    if (wcId === 'all') return 'All Weight Classes';
    const wc = weightClassifications.find((wc) => wc.id === wcId);
    if (!wc) return `WC ${wcId}`;
    return `${wc.classification} - ${formatWeightRange(wc)}`;
  };

  const getCategoryLabel = (category: 'Dressed' | 'Byproduct' | 'Frozen' | 'all') => {
    if (category === 'all') return 'All Categories';
    return category;
  };

  const getSortByLabel = (sortBy: 'class' | 'weight' | 'time' | 'id') => {
    const labels: { [key: string]: string } = {
      time: 'Time',
      class: 'Class',
      weight: 'Weight',
      id: 'ID',
    };
    return labels[sortBy] || sortBy;
  };

  const getSortOrderLabel = (order: 'asc' | 'desc') => {
    return order === 'asc' ? 'Ascending' : 'Descending';
  };

  // Filter and sort log entries based on current filters and sort settings
  const filteredEntries = useMemo(() => {
    let filtered = logEntries.filter((entry) => {
      if (filters.role !== 'all' && entry.role !== filters.role) {
        return false;
      }
      if (filters.weight_classification_id !== 'all' && entry.weight_classification_id !== filters.weight_classification_id) {
        return false;
      }
      if (filters.category !== 'all') {
        const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
        if (!wc || wc.category !== filters.category) {
          return false;
        }
      }
      return true;
    });

    // Sort the filtered entries
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      let timeComparison = 0;
      
      switch (sortBy) {
        case 'class':
          const aWc = weightClassifications.find((wc) => wc.id === a.weight_classification_id);
          const bWc = weightClassifications.find((wc) => wc.id === b.weight_classification_id);
          const aClass = aWc?.classification || '';
          const bClass = bWc?.classification || '';
          comparison = aClass.localeCompare(bClass);
          break;
        case 'weight':
          comparison = a.weight - b.weight;
          break;
        case 'time':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'id':
          comparison = a.id - b.id;
          break;
      }
      
      // Secondary sort by time (descending - newest first) if primary comparison is equal and time is not the primary sort
      if (comparison === 0 && sortBy !== 'time') {
        timeComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Descending order
        return timeComparison;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [logEntries, filters, sortBy, sortOrder, weightClassifications]);

  // Calculate aggregations by weight classification
  const aggregations = useMemo(() => {
    const agg: Record<number, { tally: number; dispatcher: number; classification: string }> = {};

    filteredEntries.forEach((entry) => {
      if (!agg[entry.weight_classification_id]) {
        const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
        agg[entry.weight_classification_id] = {
          tally: 0,
          dispatcher: 0,
          classification: wc?.classification || `WC ${entry.weight_classification_id}`,
        };
      }

      if (entry.role === TallyLogEntryRole.TALLY) {
        agg[entry.weight_classification_id].tally += entry.weight;
      } else if (entry.role === TallyLogEntryRole.DISPATCHER) {
        agg[entry.weight_classification_id].dispatcher += entry.weight;
      }
    });

    return Object.entries(agg).map(([wcId, data]) => ({
      weight_classification_id: Number(wcId),
      ...data,
      difference: data.tally - data.dispatcher,
    }));
  }, [filteredEntries, weightClassifications]);

  // Calculate overall totals
  const overallTotals = useMemo(() => {
    const totals = filteredEntries.reduce(
      (acc, entry) => {
        if (entry.role === TallyLogEntryRole.TALLY) {
          acc.tally += entry.weight;
        } else if (entry.role === TallyLogEntryRole.DISPATCHER) {
          acc.dispatcher += entry.weight;
        }
        return acc;
      },
      { tally: 0, dispatcher: 0 }
    );
    return {
      ...totals,
      difference: totals.tally - totals.dispatcher,
    };
  }, [filteredEntries]);

  // Helper function to get color based on difference and threshold
  const getDifferenceColor = (difference: number, isNotStarted: boolean): string => {
    if (isNotStarted) {
      return '#666';
    }
    if (difference === 0) {
      return '#27ae60'; // Green for exact match
    }
    const absDifference = Math.abs(difference);
    if (absDifference <= threshold) {
      return '#f39c12'; // Orange for acceptable difference
    }
    return '#e74c3c'; // Red for unacceptable difference
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(filteredEntries.map(e => e.id));
      setSelectedIds(newSelected);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    if (!hasPermission('can_tally')) {
      Alert.alert('Permission Denied', 'You do not have permission to delete tally log entries.');
      return;
    }
    
    Alert.alert(
      'Delete Logs',
      `Are you sure you want to delete ${selectedIds.size} log entries?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const deletePromises = Array.from(selectedIds).map(id => tallyLogEntriesApi.delete(id));
              await Promise.all(deletePromises);
              
              setSelectionMode(false);
              setSelectedIds(new Set());
              fetchData();
            } catch (error) {
              console.error('Error deleting logs:', error);
              Alert.alert('Error', 'Failed to delete some logs');
              fetchData();
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const loadTransferData = async () => {
    if (!session || !plant) return;
    
    setLoadingTransferData(true);
    try {
      // Load all customers (we'll filter by plant on the backend if needed, but for now just get all)
      const customersRes = await customersApi.getAll();
      // Filter customers that have sessions in the same plant (we'll filter sessions by plant)
      setAvailableCustomers(customersRes.data.filter(c => c.id !== customer?.id));
      
      // Reset selections
      setSelectedTargetCustomerId(null);
      setSelectedTargetSessionId(null);
      setAvailableSessions([]);
    } catch (error) {
      console.error('Error loading transfer data:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoadingTransferData(false);
    }
  };

  const loadSessionsForCustomer = async (customerId: number) => {
    if (!plant) return;
    
    try {
      const sessionsRes = await tallySessionsApi.getAll({
        customer_id: customerId,
        plant_id: plant.id,
        status: 'ongoing',
      });
      // Filter out the current session and only show ongoing sessions
      setAvailableSessions(sessionsRes.data.filter(s => s.id !== sessionId && s.status === 'ongoing'));
      setSelectedTargetSessionId(null);
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions');
    }
  };

  const handleTransfer = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Error', 'Please select entries to transfer');
      return;
    }
    
    if (!selectedTargetSessionId) {
      Alert.alert('Error', 'Please select a target session');
      return;
    }
    
    if (!hasPermission('can_tally')) {
      Alert.alert('Permission Denied', 'You do not have permission to transfer tally log entries.');
      return;
    }
    
    setLoading(true);
    try {
      await tallyLogEntriesApi.transfer(Array.from(selectedIds), selectedTargetSessionId);
      
      Alert.alert('Success', `Successfully transferred ${selectedIds.size} log entries`);
      setShowTransferModal(false);
      setSelectionMode(false);
      setSelectedIds(new Set());
      setSelectedTargetCustomerId(null);
      setSelectedTargetSessionId(null);
      setAvailableSessions([]);
      fetchData();
    } catch (error: any) {
      console.error('Error transferring logs:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to transfer log entries';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openTransferModal = () => {
    setShowTransferModal(true);
    loadTransferData();
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!hasPermission('can_tally')) {
      Alert.alert('Permission Denied', 'You do not have permission to delete tally log entries.');
      return;
    }

    Alert.alert(
      'Delete Log Entry',
      'Are you sure you want to delete this log entry? This action cannot be undone and will update the allocation counts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await tallyLogEntriesApi.delete(entryId);
              Alert.alert('Success', 'Log entry deleted successfully');
              fetchData();
            } catch (error: any) {
              console.error('Error deleting log entry:', error);
              const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete log entry';
              Alert.alert('Error', errorMessage);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditEntry = (entry: TallyLogEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      weight: entry.weight,
      role: entry.role,
      heads: entry.heads || 0,
      notes: entry.notes || '',
      weight_classification_id: entry.weight_classification_id,
    });
    setShowEditModal(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

    if (!hasPermission('can_tally')) {
      Alert.alert('Permission Denied', 'You do not have permission to edit tally log entries.');
      return;
    }

    setLoading(true);
    try {
      // Only send fields that have changed
      const updateData: any = {};
      if (editFormData.weight !== editingEntry.weight) {
        updateData.weight = editFormData.weight;
      }
      if (editFormData.role !== editingEntry.role) {
        updateData.role = editFormData.role;
      }
      if (editFormData.heads !== (editingEntry.heads || 0)) {
        updateData.heads = editFormData.heads;
      }
      if (editFormData.notes !== (editingEntry.notes || '')) {
        updateData.notes = editFormData.notes || null;
      }
      if (editFormData.weight_classification_id !== editingEntry.weight_classification_id) {
        updateData.weight_classification_id = editFormData.weight_classification_id;
      }

      await tallyLogEntriesApi.update(editingEntry.id, updateData);
      Alert.alert('Success', 'Log entry updated successfully');
      setShowEditModal(false);
      setEditingEntry(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating log entry:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update log entry';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditHistory = async (entry: TallyLogEntry) => {
    setSelectedEntryForAudit(entry);
    setLoadingAudit(true);
    setShowAuditModal(true);
    try {
      const response = await tallyLogEntriesApi.getAuditHistory(entry.id);
      setAuditHistory(response.data);
    } catch (error: any) {
      console.error('Error loading audit history:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load audit history';
      Alert.alert('Error', errorMessage);
      setShowAuditModal(false);
    } finally {
      setLoadingAudit(false);
    }
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      'weight': 'Weight',
      'role': 'Role',
      'heads': 'Heads',
      'notes': 'Notes',
      'weight_classification': 'Weight Classification',
      'tally_session': 'Tally Session',
    };
    return fieldMap[fieldName] || fieldName;
  };

  const formatFieldValue = (fieldName: string, value: any): string => {
    if (value === null || value === undefined) {
      return '(empty)';
    }
    if (fieldName === 'role') {
      return value === 'tally' ? 'Tally-er' : 'Dispatcher';
    }
    if (fieldName === 'weight') {
      return `${value} kg`;
    }
    if (fieldName === 'heads') {
      return value.toString();
    }
    return String(value);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Session not found</Text>
      </View>
    );
  }

  const dynamicStyles: {
    container: ViewStyle;
    header: ViewStyle;
    title: TextStyle;
    infoText: TextStyle;
    filterContainer: ViewStyle;
    filterLabel: TextStyle;
    pickerWrapper: ViewStyle;
    dropdownButton: ViewStyle;
    dropdownText: TextStyle;
    dropdownIcon: TextStyle;
    dropdownMenu: ViewStyle;
    dropdownMenuScroll: ViewStyle;
    dropdownOption: ViewStyle;
    dropdownOptionLast: ViewStyle;
    dropdownOptionSelected: ViewStyle;
    dropdownOptionText: TextStyle;
    dropdownOptionTextSelected: TextStyle;
    sectionTitleContainer: ViewStyle;
    sectionTitle: TextStyle;
    settingsButton: ViewStyle;
    settingsButtonText: TextStyle;
    columnSettingsModal: ViewStyle;
    columnSettingsTitle: TextStyle;
    columnSettingsSubtitle: TextStyle;
    columnSettingsOption: ViewStyle;
    columnSettingsOptionLast: ViewStyle;
    checkboxContainer: ViewStyle;
    checkbox: ViewStyle;
    checkboxChecked: ViewStyle;
    checkboxCheckmark: TextStyle;
    columnSettingsOptionText: TextStyle;
    columnSettingsButton: ViewStyle;
    columnSettingsButtonText: TextStyle;
    tableContainer: ViewStyle;
    tableHeader: ViewStyle;
    tableHeaderText: TextStyle;
    tableRow: ViewStyle;
    tableCell: TextStyle;
  } = {
    container: {
      ...styles.container,
      paddingHorizontal: responsive.padding.medium,
      paddingBottom: responsive.padding.medium,
    },
    header: {
      ...styles.header,
      marginBottom: responsive.spacing.md,
    },
    title: {
      ...styles.title,
      fontSize: responsive.fontSize.large,
    },
    infoText: {
      ...styles.infoText,
      fontSize: responsive.fontSize.small,
    },
    filterContainer: {
      ...styles.filterContainer,
      marginBottom: responsive.spacing.md,
    },
    filterLabel: {
      ...styles.filterLabel,
      fontSize: responsive.fontSize.small,
      marginBottom: responsive.spacing.xs,
    },
    pickerWrapper: {
      ...styles.pickerWrapper,
      marginBottom: responsive.spacing.md,
    },
    dropdownButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.small,
      minHeight: 40,
    },
    dropdownText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
      fontWeight: '500' as const,
      flex: 1,
    },
    dropdownIcon: {
      color: '#2c3e50',
      fontSize: 10,
      marginLeft: responsive.spacing.xs,
    },
    dropdownMenu: {
      backgroundColor: '#fff',
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
      minWidth: 200,
      maxWidth: '90%' as DimensionValue,
      overflow: 'hidden' as const,
    },
    dropdownMenuScroll: {
      maxHeight: '70%' as DimensionValue,
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
      fontWeight: '600' as const,
    },
    sectionTitleContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: responsive.spacing.sm,
      marginTop: responsive.spacing.md,
    },
    sectionTitle: {
      ...styles.sectionTitle,
      fontSize: responsive.fontSize.medium,
      flex: 1,
    },
    settingsButton: {
      padding: responsive.spacing.xs,
      marginLeft: responsive.spacing.sm,
    },
    settingsButtonText: {
      fontSize: responsive.fontSize.medium,
    },
    columnSettingsModal: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: responsive.padding.large,
      width: (responsive.isTablet ? Math.min(responsive.width * 0.5, 400) : '85%') as DimensionValue,
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    columnSettingsTitle: {
      fontSize: responsive.fontSize.large,
      fontWeight: 'bold' as const,
      color: '#2c3e50',
      marginBottom: responsive.spacing.xs,
    },
    columnSettingsSubtitle: {
      fontSize: responsive.fontSize.small,
      color: '#7f8c8d',
      marginBottom: responsive.spacing.lg,
    },
    columnSettingsOption: {
      paddingVertical: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    columnSettingsOptionLast: {
      borderBottomWidth: 0,
      marginBottom: responsive.spacing.md,
    },
    checkboxContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: '#bdc3c7',
      borderRadius: 4,
      marginRight: responsive.spacing.md,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: '#fff',
    },
    checkboxChecked: {
      backgroundColor: '#3498db',
      borderColor: '#3498db',
    },
    checkboxCheckmark: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold' as const,
    },
    columnSettingsOptionText: {
      fontSize: responsive.fontSize.medium,
      color: '#2c3e50',
      fontWeight: '500' as const,
    },
    columnSettingsButton: {
      backgroundColor: '#3498db',
      borderRadius: 8,
      padding: responsive.padding.medium,
      alignItems: 'center' as const,
      marginTop: responsive.spacing.sm,
    },
    columnSettingsButtonText: {
      color: '#fff',
      fontSize: responsive.fontSize.medium,
      fontWeight: '600' as const,
    },
    tableContainer: {
      ...styles.tableContainer,
      marginBottom: responsive.spacing.md,
    },
    tableHeader: {
      ...styles.tableHeader,
      paddingVertical: responsive.padding.small,
      paddingHorizontal: responsive.padding.small,
    },
    tableHeaderText: {
      ...styles.tableHeaderText,
      fontSize: responsive.fontSize.small,
    },
    tableRow: {
      ...styles.tableRow,
      paddingVertical: responsive.spacing.xs,
      paddingHorizontal: responsive.padding.small,
    },
    tableCell: {
      ...styles.tableCell,
      fontSize: responsive.fontSize.small,
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <View style={dynamicStyles.header}>
        <TouchableOpacity 
          onPress={() => {
            // UI back button always goes back to previous screen (e.g., TallySessionDetail)
            navigation.goBack();
          }} 
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.title}>
          {customer?.name || 'Unknown'} - Session #{session.session_number} - {formatDate(session.date, timezone)}
        </Text>
        <Text style={dynamicStyles.infoText}>
          {customer?.name} | {plant?.name}
        </Text>
        <Text style={dynamicStyles.infoText}>
          {formatDate(session.date, timezone)} | {session.status}
        </Text>
      </View>

      {/* Filters */}
      <View style={dynamicStyles.filterContainer}>
        <Text style={dynamicStyles.filterLabel}>Filter by Role:</Text>
        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowRoleDropdown(true)}
          >
            <Text style={dynamicStyles.dropdownText}>
              {getRoleLabel(filters.role)}
            </Text>
            <Text style={dynamicStyles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={[dynamicStyles.filterLabel, { marginTop: 16 }]}>Filter by Weight Class:</Text>
        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowWeightClassDropdown(true)}
          >
            <Text style={dynamicStyles.dropdownText} numberOfLines={1}>
              {getWeightClassLabel(filters.weight_classification_id)}
            </Text>
            <Text style={dynamicStyles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={[dynamicStyles.filterLabel, { marginTop: 16 }]}>Filter by Category:</Text>
        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowCategoryDropdown(true)}
          >
            <Text style={dynamicStyles.dropdownText}>
              {getCategoryLabel(filters.category)}
            </Text>
            <Text style={dynamicStyles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={[dynamicStyles.filterLabel, { marginTop: 16 }]}>Sort By:</Text>
        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowSortByDropdown(true)}
          >
            <Text style={dynamicStyles.dropdownText}>
              {getSortByLabel(sortBy)}
            </Text>
            <Text style={dynamicStyles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={[dynamicStyles.filterLabel, { marginTop: 16 }]}>Order:</Text>
        <View style={dynamicStyles.pickerWrapper}>
          <TouchableOpacity
            style={dynamicStyles.dropdownButton}
            onPress={() => setShowSortOrderDropdown(true)}
          >
            <Text style={dynamicStyles.dropdownText}>
              {getSortOrderLabel(sortOrder)}
            </Text>
            <Text style={dynamicStyles.dropdownIcon}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Aggregation Summary Table */}
      <Text style={dynamicStyles.sectionTitle}>Aggregation Summary</Text>
      <View style={dynamicStyles.tableContainer}>
        <View style={dynamicStyles.tableHeader}>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 2 }]}>Weight Class</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.5 }]}>Tally-er</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.5 }]}>Dispatcher</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1 }]}>Diff</Text>
        </View>
        {aggregations.length > 0 ? (
          <>
            {aggregations.map((agg) => {
              const isNotStarted = agg.tally === 0 && agg.dispatcher === 0;
              const diffColor = getDifferenceColor(agg.difference, isNotStarted);
              return (
                <View key={agg.weight_classification_id} style={dynamicStyles.tableRow}>
                  <Text style={[dynamicStyles.tableCell, { flex: 2 }]} numberOfLines={1}>
                    {agg.classification}
                  </Text>
                  <Text style={[dynamicStyles.tableCell, { flex: 1.5 }]}>
                    {agg.tally.toFixed(2)}
                  </Text>
                  <Text style={[dynamicStyles.tableCell, { flex: 1.5 }]}>
                    {agg.dispatcher.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      dynamicStyles.tableCell,
                      {
                        flex: 1,
                        color: diffColor,
                        fontWeight: agg.difference === 0 && !isNotStarted ? 'normal' : 'bold',
                      },
                    ]}
                  >
                    {isNotStarted ? 'Not started' : (agg.difference === 0 ? '✓' : agg.difference.toFixed(1))}
                  </Text>
                </View>
              );
            })}
            <View style={[dynamicStyles.tableRow, styles.totalRow]}>
              <Text style={[dynamicStyles.tableCell, { flex: 2, fontWeight: 'bold' }]}>Total</Text>
              <Text style={[dynamicStyles.tableCell, { flex: 1.5, fontWeight: 'bold' }]}>
                {overallTotals.tally.toFixed(2)}
              </Text>
              <Text style={[dynamicStyles.tableCell, { flex: 1.5, fontWeight: 'bold' }]}>
                {overallTotals.dispatcher.toFixed(2)}
              </Text>
              <Text
                style={[
                  dynamicStyles.tableCell,
                  {
                    flex: 1,
                    color: getDifferenceColor(overallTotals.difference, overallTotals.tally === 0 && overallTotals.dispatcher === 0),
                    fontWeight: 'bold',
                  },
                ]}
              >
                {(overallTotals.tally === 0 && overallTotals.dispatcher === 0) ? 'Not started' : (overallTotals.difference === 0 ? '✓' : overallTotals.difference.toFixed(1))}
              </Text>
            </View>
          </>
        ) : (
          <View style={dynamicStyles.tableRow}>
            <Text style={[dynamicStyles.tableCell, { flex: 1, textAlign: 'center' }]}>
              No entries found
            </Text>
          </View>
        )}
      </View>

      {/* Log Entries Table */}
      <View style={dynamicStyles.sectionTitleContainer}>
        <Text style={dynamicStyles.sectionTitle}>Log Entries ({filteredEntries.length})</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {selectionMode ? (
            <>
              {hasPermission('can_tally') && (
                <>
                  <TouchableOpacity
                    style={[dynamicStyles.settingsButton, { marginRight: 8 }]}
                    onPress={openTransferModal}
                  >
                    <MaterialIcons name="swap-horiz" size={20} color="#3498db" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dynamicStyles.settingsButton, { marginRight: 8 }]}
                    onPress={handleDeleteSelected}
                  >
                    <MaterialIcons name="delete-forever" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[dynamicStyles.settingsButton, { marginRight: 8 }]}
                onPress={selectAll}
              >
                <Text style={{ fontSize: 14, color: '#3498db', fontWeight: 'bold' }}>
                  {selectedIds.size === filteredEntries.length && filteredEntries.length > 0 ? 'None' : 'All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dynamicStyles.settingsButton}
                onPress={toggleSelectionMode}
              >
                <Text style={{ fontSize: 14, color: '#e74c3c', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {hasPermission('can_tally') && (
                <TouchableOpacity
                  style={[dynamicStyles.settingsButton, { marginRight: 8 }]}
                  onPress={toggleSelectionMode}
                >
                  <Text style={{ fontSize: 14, color: '#3498db', fontWeight: 'bold' }}>Select</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={dynamicStyles.settingsButton}
                onPress={() => setShowColumnSettings(true)}
              >
                <Text style={dynamicStyles.settingsButtonText}>⚙️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      <View style={dynamicStyles.tableContainer}>
        <View style={dynamicStyles.tableHeader}>
          {selectionMode && (
            <View style={{ width: 40 }} />
          )}
          {visibleColumns.id && (
            <Text style={[dynamicStyles.tableHeaderText, { flex: 0.8 }]}>ID</Text>
          )}
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1 }]}>Role</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.2 }]}>Class</Text>
          {visibleColumns.description && (
            <Text style={[dynamicStyles.tableHeaderText, { flex: 1.2 }]}>Desc</Text>
          )}
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1 }]}>Category</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 0.8 }]}>Weight</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 0.8 }]}>Heads</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.2 }]}>Time</Text>
          {hasPermission('can_tally') && !selectionMode && (
            <Text style={[dynamicStyles.tableHeaderText, { flex: 1.5 }]}>Actions</Text>
          )}
        </View>
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => {
            const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
            const isTransferred = entry.original_session_id !== null && entry.original_session_id !== undefined;
            return (
              <TouchableOpacity
                key={entry.id}
                style={[
                  dynamicStyles.tableRow,
                  isTransferred && { backgroundColor: '#ffe0b2' } // Orange background for transferred entries
                ]}
                onPress={() => selectionMode ? toggleSelection(entry.id) : null}
                activeOpacity={selectionMode ? 0.7 : 1}
              >
                {selectionMode && (
                  <View style={{ width: 40, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: selectedIds.has(entry.id) ? '#3498db' : '#bdc3c7',
                      backgroundColor: selectedIds.has(entry.id) ? '#3498db' : 'transparent',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      {selectedIds.has(entry.id) && <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </View>
                )}
                {visibleColumns.id && (
                  <Text style={[dynamicStyles.tableCell, { flex: 0.8 }]}>{entry.id}</Text>
                )}
                <View style={[dynamicStyles.tableCell, { flex: 1 }]}>
                  <View
                    style={[
                      styles.roleBadgeSmall,
                      {
                        backgroundColor:
                          entry.role === TallyLogEntryRole.TALLY ? '#3498db' : '#9b59b6',
                      },
                    ]}
                  >
                    <Text style={styles.roleBadgeTextSmall}>
                      {entry.role === TallyLogEntryRole.TALLY ? 'T' : 'D'}
                    </Text>
                  </View>
                </View>
                <Text style={[dynamicStyles.tableCell, { flex: 1.2, fontSize: 10 }]} numberOfLines={1}>
                  {getWeightClassificationName(entry.weight_classification_id)}
                </Text>
                {visibleColumns.description && (
                  <Text style={[dynamicStyles.tableCell, { flex: 1.2, fontSize: 9 }]} numberOfLines={1}>
                    {wc?.description || '-'}
                  </Text>
                )}
                <Text style={[dynamicStyles.tableCell, { flex: 1, fontSize: 10 }]} numberOfLines={1}>
                  {wc?.category || '-'}
                </Text>
                <Text style={[dynamicStyles.tableCell, { flex: 0.8 }]}>
                  {entry.weight.toFixed(2)}
                </Text>
                <Text style={[dynamicStyles.tableCell, { flex: 0.8 }]}>
                  {entry.heads !== undefined && entry.heads !== null ? entry.heads.toFixed(0) : '-'}
                </Text>
                <Text style={[dynamicStyles.tableCell, { flex: 1.2, fontSize: 10 }]} numberOfLines={1}>
                  {formatTime(entry.created_at, timezone)}
                </Text>
                {hasPermission('can_tally') && !selectionMode && (
                  <View style={{ flex: 1.5, flexDirection: 'row', gap: 4, paddingHorizontal: 4 }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleEditEntry(entry);
                      }}
                      disabled={loading}
                      style={{
                        padding: 4,
                        backgroundColor: '#6c757d',
                        borderRadius: 4,
                        opacity: loading ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        loadAuditHistory(entry);
                      }}
                      disabled={loading || loadingAudit}
                      style={{
                        padding: 4,
                        backgroundColor: '#17a2b8',
                        borderRadius: 4,
                        opacity: (loading || loadingAudit) ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteEntry(entry.id);
                      }}
                      disabled={loading}
                      style={{
                        padding: 4,
                        backgroundColor: '#dc3545',
                        borderRadius: 4,
                        opacity: loading ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>Del</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={dynamicStyles.tableRow}>
            <Text style={[dynamicStyles.tableCell, { flex: 1, textAlign: 'center' }]}>
              No log entries found
            </Text>
          </View>
        )}
      </View>

      {/* Role Dropdown Modal */}
      {showRoleDropdown && (
        <Modal
          transparent
          visible={showRoleDropdown}
          animationType="fade"
          onRequestClose={() => setShowRoleDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowRoleDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  filters.role === 'all' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, role: 'all' });
                  setShowRoleDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.role === 'all' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  All Roles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  filters.role === TallyLogEntryRole.TALLY && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, role: TallyLogEntryRole.TALLY });
                  setShowRoleDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.role === TallyLogEntryRole.TALLY && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Tally-er
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  dynamicStyles.dropdownOptionLast,
                  filters.role === TallyLogEntryRole.DISPATCHER && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, role: TallyLogEntryRole.DISPATCHER });
                  setShowRoleDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.role === TallyLogEntryRole.DISPATCHER && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Dispatcher
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Weight Class Dropdown Modal */}
      {showWeightClassDropdown && (
        <Modal
          transparent
          visible={showWeightClassDropdown}
          animationType="fade"
          onRequestClose={() => setShowWeightClassDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowWeightClassDropdown(false)}
          >
            <ScrollView 
              style={dynamicStyles.dropdownMenuScroll}
              contentContainerStyle={dynamicStyles.dropdownMenu}
              showsVerticalScrollIndicator
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  filters.weight_classification_id === 'all' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, weight_classification_id: 'all' });
                  setShowWeightClassDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.weight_classification_id === 'all' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  All Weight Classes
                </Text>
              </TouchableOpacity>
              {weightClassifications.map((wc, index) => (
                <TouchableOpacity
                  key={wc.id}
                  style={[
                    dynamicStyles.dropdownOption,
                    index === weightClassifications.length - 1 && dynamicStyles.dropdownOptionLast,
                    filters.weight_classification_id === wc.id && dynamicStyles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    setFilters({ ...filters, weight_classification_id: wc.id });
                    setShowWeightClassDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      dynamicStyles.dropdownOptionText,
                      filters.weight_classification_id === wc.id && dynamicStyles.dropdownOptionTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {wc.classification} - {formatWeightRange(wc)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Category Dropdown Modal */}
      {showCategoryDropdown && (
        <Modal
          transparent
          visible={showCategoryDropdown}
          animationType="fade"
          onRequestClose={() => setShowCategoryDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowCategoryDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  filters.category === 'all' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, category: 'all' });
                  setShowCategoryDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.category === 'all' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  All Categories
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  filters.category === 'Dressed' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, category: 'Dressed' });
                  setShowCategoryDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.category === 'Dressed' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Dressed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  filters.category === 'Frozen' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, category: 'Frozen' });
                  setShowCategoryDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.category === 'Frozen' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Frozen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  dynamicStyles.dropdownOptionLast,
                  filters.category === 'Byproduct' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setFilters({ ...filters, category: 'Byproduct' });
                  setShowCategoryDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    filters.category === 'Byproduct' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Byproduct
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Sort By Dropdown Modal */}
      {showSortByDropdown && (
        <Modal
          transparent
          visible={showSortByDropdown}
          animationType="fade"
          onRequestClose={() => setShowSortByDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowSortByDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  sortBy === 'time' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSortBy('time');
                  setShowSortByDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    sortBy === 'time' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Time
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  sortBy === 'class' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSortBy('class');
                  setShowSortByDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    sortBy === 'class' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Class
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  sortBy === 'weight' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSortBy('weight');
                  setShowSortByDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    sortBy === 'weight' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Weight
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  dynamicStyles.dropdownOptionLast,
                  sortBy === 'id' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSortBy('id');
                  setShowSortByDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    sortBy === 'id' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  ID
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Sort Order Dropdown Modal */}
      {showSortOrderDropdown && (
        <Modal
          transparent
          visible={showSortOrderDropdown}
          animationType="fade"
          onRequestClose={() => setShowSortOrderDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowSortOrderDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  sortOrder === 'desc' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSortOrder('desc');
                  setShowSortOrderDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    sortOrder === 'desc' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Descending
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  dynamicStyles.dropdownOptionLast,
                  sortOrder === 'asc' && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSortOrder('asc');
                  setShowSortOrderDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    sortOrder === 'asc' && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Ascending
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Column Settings Modal */}
      {showColumnSettings && (
        <Modal
          transparent
          visible={showColumnSettings}
          animationType="fade"
          onRequestClose={() => setShowColumnSettings(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowColumnSettings(false)}
          >
            <View 
              style={dynamicStyles.columnSettingsModal}
              onStartShouldSetResponder={() => true}
            >
              <Text style={dynamicStyles.columnSettingsTitle}>Show Columns</Text>
              <Text style={dynamicStyles.columnSettingsSubtitle}>
                Select which columns to display in the log entries table
              </Text>
              
              <TouchableOpacity
                style={dynamicStyles.columnSettingsOption}
                onPress={() => setVisibleColumns({ ...visibleColumns, id: !visibleColumns.id })}
              >
                <View style={dynamicStyles.checkboxContainer}>
                  <View style={[
                    dynamicStyles.checkbox,
                    visibleColumns.id && dynamicStyles.checkboxChecked
                  ]}>
                    {visibleColumns.id && <Text style={dynamicStyles.checkboxCheckmark}>✓</Text>}
                  </View>
                  <Text style={dynamicStyles.columnSettingsOptionText}>ID</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[dynamicStyles.columnSettingsOption, dynamicStyles.columnSettingsOptionLast]}
                onPress={() => setVisibleColumns({ ...visibleColumns, description: !visibleColumns.description })}
              >
                <View style={dynamicStyles.checkboxContainer}>
                  <View style={[
                    dynamicStyles.checkbox,
                    visibleColumns.description && dynamicStyles.checkboxChecked
                  ]}>
                    {visibleColumns.description && <Text style={dynamicStyles.checkboxCheckmark}>✓</Text>}
                  </View>
                  <Text style={dynamicStyles.columnSettingsOptionText}>Description</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.columnSettingsButton}
                onPress={() => setShowColumnSettings(false)}
              >
                <Text style={dynamicStyles.columnSettingsButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <Modal
          transparent
          visible={showTransferModal}
          animationType="fade"
          onRequestClose={() => {
            setShowTransferModal(false);
            setShowTransferCustomerDropdown(false);
            setShowTransferSessionDropdown(false);
          }}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => {
              if (!showTransferCustomerDropdown && !showTransferSessionDropdown) {
                setShowTransferModal(false);
                setSelectedTargetCustomerId(null);
                setSelectedTargetSessionId(null);
                setAvailableSessions([]);
              }
            }}
          >
            <View 
              style={dynamicStyles.columnSettingsModal}
              onStartShouldSetResponder={() => true}
            >
              <Text style={dynamicStyles.columnSettingsTitle}>Transfer Log Entries</Text>
              <Text style={dynamicStyles.columnSettingsSubtitle}>
                Transfer {selectedIds.size} selected entries to another customer's session
              </Text>
              
              <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Select Customer:</Text>
              <View style={dynamicStyles.pickerWrapper}>
                <TouchableOpacity
                  style={dynamicStyles.dropdownButton}
                  onPress={() => setShowTransferCustomerDropdown(true)}
                  disabled={loadingTransferData}
                >
                  <Text style={dynamicStyles.dropdownText} numberOfLines={1}>
                    {selectedTargetCustomerId 
                      ? availableCustomers.find(c => c.id === selectedTargetCustomerId)?.name || 'Select Customer'
                      : 'Select Customer'}
                  </Text>
                  <Text style={dynamicStyles.dropdownIcon}>▼</Text>
                </TouchableOpacity>
              </View>
              
              {selectedTargetCustomerId && (
                <>
                  <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Select Session:</Text>
                  <View style={dynamicStyles.pickerWrapper}>
                    <TouchableOpacity
                      style={dynamicStyles.dropdownButton}
                      onPress={() => setShowTransferSessionDropdown(true)}
                      disabled={availableSessions.length === 0}
                    >
                      <Text style={dynamicStyles.dropdownText} numberOfLines={1}>
                        {selectedTargetSessionId
                          ? (() => {
                              const selectedSession = availableSessions.find(s => s.id === selectedTargetSessionId);
                              return selectedSession 
                                ? `Session #${selectedSession.session_number} - ${formatDate(selectedSession.date, timezone)} (${selectedSession.status})`
                                : 'Select Session';
                            })()
                          : availableSessions.length === 0
                          ? 'No ongoing sessions available'
                          : 'Select Session'}
                      </Text>
                      <Text style={dynamicStyles.dropdownIcon}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {selectedTargetCustomerId && availableSessions.length === 0 && !loadingTransferData && (
                <Text style={[dynamicStyles.columnSettingsSubtitle, { marginTop: 8, color: '#e74c3c' }]}>
                  No ongoing sessions available for this customer in the same plant. Only ongoing sessions can receive transferred entries.
                </Text>
              )}
              
              {selectedTargetCustomerId && availableSessions.length > 0 && (
                <Text style={[dynamicStyles.columnSettingsSubtitle, { marginTop: 8, fontSize: 12, color: '#7f8c8d' }]}>
                  Only ongoing sessions are available for transfer
                </Text>
              )}

              <View style={{ flexDirection: 'row', marginTop: responsive.spacing.md, gap: responsive.spacing.sm }}>
                <TouchableOpacity
                  style={[dynamicStyles.columnSettingsButton, { flex: 1, backgroundColor: '#95a5a6' }]}
                  onPress={() => {
                    setShowTransferModal(false);
                    setShowTransferCustomerDropdown(false);
                    setShowTransferSessionDropdown(false);
                    setSelectedTargetCustomerId(null);
                    setSelectedTargetSessionId(null);
                    setAvailableSessions([]);
                  }}
                >
                  <Text style={dynamicStyles.columnSettingsButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    dynamicStyles.columnSettingsButton, 
                    { flex: 1 },
                    (!selectedTargetSessionId || loading) && { opacity: 0.5 }
                  ]}
                  onPress={handleTransfer}
                  disabled={!selectedTargetSessionId || loading}
                >
                  <Text style={dynamicStyles.columnSettingsButtonText}>
                    {loading ? 'Transferring...' : 'Transfer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Transfer Customer Dropdown Modal */}
      {showTransferCustomerDropdown && (
        <Modal
          transparent
          visible={showTransferCustomerDropdown}
          animationType="fade"
          onRequestClose={() => setShowTransferCustomerDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowTransferCustomerDropdown(false)}
          >
            <ScrollView 
              style={dynamicStyles.dropdownMenuScroll}
              contentContainerStyle={dynamicStyles.dropdownMenu}
              showsVerticalScrollIndicator
              onStartShouldSetResponder={() => true}
            >
              {availableCustomers.map((cust, index) => (
                <TouchableOpacity
                  key={cust.id}
                  style={[
                    dynamicStyles.dropdownOption,
                    index === availableCustomers.length - 1 && dynamicStyles.dropdownOptionLast,
                    selectedTargetCustomerId === cust.id && dynamicStyles.dropdownOptionSelected,
                  ]}
                  onPress={async () => {
                    setSelectedTargetCustomerId(cust.id);
                    setShowTransferCustomerDropdown(false);
                    await loadSessionsForCustomer(cust.id);
                  }}
                >
                  <Text
                    style={[
                      dynamicStyles.dropdownOptionText,
                      selectedTargetCustomerId === cust.id && dynamicStyles.dropdownOptionTextSelected,
                    ]}
                  >
                    {cust.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {availableCustomers.length === 0 && (
                <View style={dynamicStyles.dropdownOption}>
                  <Text style={dynamicStyles.dropdownOptionText}>No other customers available</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Transfer Session Dropdown Modal */}
      {showTransferSessionDropdown && (
        <Modal
          transparent
          visible={showTransferSessionDropdown}
          animationType="fade"
          onRequestClose={() => setShowTransferSessionDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowTransferSessionDropdown(false)}
          >
            <ScrollView 
              style={dynamicStyles.dropdownMenuScroll}
              contentContainerStyle={dynamicStyles.dropdownMenu}
              showsVerticalScrollIndicator
              onStartShouldSetResponder={() => true}
            >
              {availableSessions.map((sess, index) => (
                <TouchableOpacity
                  key={sess.id}
                  style={[
                    dynamicStyles.dropdownOption,
                    index === availableSessions.length - 1 && dynamicStyles.dropdownOptionLast,
                    selectedTargetSessionId === sess.id && dynamicStyles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedTargetSessionId(sess.id);
                    setShowTransferSessionDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      dynamicStyles.dropdownOptionText,
                      selectedTargetSessionId === sess.id && dynamicStyles.dropdownOptionTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    Session #{sess.session_number} - {formatDate(sess.date, timezone)} ({sess.status})
                  </Text>
                </TouchableOpacity>
              ))}
              {availableSessions.length === 0 && (
                <View style={dynamicStyles.dropdownOption}>
                  <Text style={dynamicStyles.dropdownOptionText}>No ongoing sessions available</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && editingEntry && (
        <Modal
          transparent
          visible={showEditModal}
          animationType="fade"
          onRequestClose={() => {
            setShowEditModal(false);
            setEditingEntry(null);
          }}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowEditModal(false);
              setEditingEntry(null);
            }}
          >
            <View 
              style={dynamicStyles.columnSettingsModal}
              onStartShouldSetResponder={() => true}
            >
              <Text style={dynamicStyles.columnSettingsTitle}>Edit Log Entry</Text>
              
              <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Weight Classification:</Text>
              <View style={dynamicStyles.pickerWrapper}>
                <TouchableOpacity
                  style={dynamicStyles.dropdownButton}
                  onPress={() => setShowEditWeightClassDropdown(true)}
                  disabled={loading}
                >
                  <Text style={dynamicStyles.dropdownText} numberOfLines={1}>
                    {(() => {
                      const selectedWc = weightClassifications.find(wc => wc.id === editFormData.weight_classification_id);
                      return selectedWc 
                        ? `${selectedWc.classification} (${selectedWc.category}) - ${formatWeightRange(selectedWc)}`
                        : 'Select Weight Classification';
                    })()}
                  </Text>
                  <Text style={dynamicStyles.dropdownIcon}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Role:</Text>
              <View style={dynamicStyles.pickerWrapper}>
                <TouchableOpacity
                  style={dynamicStyles.dropdownButton}
                  onPress={() => setShowEditRoleDropdown(true)}
                  disabled={loading}
                >
                  <Text style={dynamicStyles.dropdownText}>
                    {editFormData.role === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher'}
                  </Text>
                  <Text style={dynamicStyles.dropdownIcon}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Weight (kg):</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                }}
                keyboardType="numeric"
                value={editFormData.weight.toString()}
                onChangeText={(text) => setEditFormData({ ...editFormData, weight: parseFloat(text) || 0 })}
                editable={!loading}
              />

              <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Heads:</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                }}
                keyboardType="numeric"
                value={editFormData.heads.toString()}
                onChangeText={(text) => setEditFormData({ ...editFormData, heads: parseFloat(text) || 0 })}
                editable={!loading}
              />

              <Text style={[dynamicStyles.filterLabel, { marginTop: 16, marginBottom: 8 }]}>Notes:</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                multiline
                numberOfLines={3}
                value={editFormData.notes}
                onChangeText={(text) => setEditFormData({ ...editFormData, notes: text })}
                editable={!loading}
              />

              <View style={{ flexDirection: 'row', marginTop: responsive.spacing.md, gap: responsive.spacing.sm }}>
                <TouchableOpacity
                  style={[dynamicStyles.columnSettingsButton, { flex: 1, backgroundColor: '#95a5a6' }]}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                  }}
                  disabled={loading}
                >
                  <Text style={dynamicStyles.columnSettingsButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    dynamicStyles.columnSettingsButton,
                    { flex: 1 },
                    loading && { opacity: 0.5 }
                  ]}
                  onPress={handleUpdateEntry}
                  disabled={loading}
                >
                  <Text style={dynamicStyles.columnSettingsButtonText}>
                    {loading ? 'Updating...' : 'Update'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Edit Weight Classification Dropdown Modal */}
      {showEditWeightClassDropdown && (
        <Modal
          transparent
          visible={showEditWeightClassDropdown}
          animationType="fade"
          onRequestClose={() => setShowEditWeightClassDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowEditWeightClassDropdown(false)}
          >
            <ScrollView 
              style={dynamicStyles.dropdownMenuScroll}
              contentContainerStyle={dynamicStyles.dropdownMenu}
              showsVerticalScrollIndicator
              onStartShouldSetResponder={() => true}
            >
              {weightClassifications.map((wc, index) => (
                <TouchableOpacity
                  key={wc.id}
                  style={[
                    dynamicStyles.dropdownOption,
                    index === weightClassifications.length - 1 && dynamicStyles.dropdownOptionLast,
                    editFormData.weight_classification_id === wc.id && dynamicStyles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    setEditFormData({ ...editFormData, weight_classification_id: wc.id });
                    setShowEditWeightClassDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      dynamicStyles.dropdownOptionText,
                      editFormData.weight_classification_id === wc.id && dynamicStyles.dropdownOptionTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {wc.classification} ({wc.category}) - {formatWeightRange(wc)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Edit Role Dropdown Modal */}
      {showEditRoleDropdown && (
        <Modal
          transparent
          visible={showEditRoleDropdown}
          animationType="fade"
          onRequestClose={() => setShowEditRoleDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowEditRoleDropdown(false)}
          >
            <View 
              style={dynamicStyles.dropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  editFormData.role === TallyLogEntryRole.TALLY && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setEditFormData({ ...editFormData, role: TallyLogEntryRole.TALLY });
                  setShowEditRoleDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    editFormData.role === TallyLogEntryRole.TALLY && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Tally-er
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.dropdownOption,
                  dynamicStyles.dropdownOptionLast,
                  editFormData.role === TallyLogEntryRole.DISPATCHER && dynamicStyles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setEditFormData({ ...editFormData, role: TallyLogEntryRole.DISPATCHER });
                  setShowEditRoleDropdown(false);
                }}
              >
                <Text
                  style={[
                    dynamicStyles.dropdownOptionText,
                    editFormData.role === TallyLogEntryRole.DISPATCHER && dynamicStyles.dropdownOptionTextSelected,
                  ]}
                >
                  Dispatcher
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Audit History Modal */}
      {showAuditModal && selectedEntryForAudit && (
        <Modal
          transparent
          visible={showAuditModal}
          animationType="fade"
          onRequestClose={() => {
            setShowAuditModal(false);
            setSelectedEntryForAudit(null);
            setAuditHistory([]);
          }}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAuditModal(false);
              setSelectedEntryForAudit(null);
              setAuditHistory([]);
            }}
          >
            <View 
              style={[dynamicStyles.columnSettingsModal, { maxHeight: '80%', width: responsive.isTablet ? Math.min(responsive.width * 0.7, 600) : '90%' }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={dynamicStyles.columnSettingsTitle}>Edit History - Entry #{selectedEntryForAudit.id}</Text>
              
              {loadingAudit ? (
                <Text style={{ textAlign: 'center', padding: 20, color: '#666' }}>Loading audit history...</Text>
              ) : auditHistory.length === 0 ? (
                <Text style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                  No edit history found for this entry.
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: '70%' }}>
                  <Text style={[dynamicStyles.columnSettingsSubtitle, { marginBottom: 16 }]}>
                    This entry has been edited {auditHistory.length} time{auditHistory.length !== 1 ? 's' : ''}.
                  </Text>
                  {auditHistory.map((audit, index) => (
                    <View
                      key={audit.id}
                      style={{
                        borderWidth: 1,
                        borderColor: '#ddd',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                        backgroundColor: '#f9f9f9',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#2c3e50' }}>
                          Edit #{auditHistory.length - index}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#666' }}>
                          {formatDateTime(audit.edited_at, timezone)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                        Edited by: <Text style={{ fontWeight: '600' }}>{audit.user_username || `User ID ${audit.user_id}`}</Text>
                      </Text>
                      <Text style={{ fontWeight: '600', marginBottom: 8, fontSize: 13 }}>Changes:</Text>
                      {Object.entries(audit.changes).map(([fieldName, change]) => (
                        <View key={fieldName} style={{ marginBottom: 6, paddingLeft: 8 }}>
                          <Text style={{ fontSize: 12, color: '#2c3e50' }}>
                            <Text style={{ fontWeight: '600' }}>{formatFieldName(fieldName)}:</Text>{' '}
                            <Text style={{ color: '#e74c3c' }}>
                              {formatFieldValue(fieldName, change.old)}
                            </Text>
                            {' → '}
                            <Text style={{ color: '#27ae60' }}>
                              {formatFieldValue(fieldName, change.new)}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[dynamicStyles.columnSettingsButton, { marginTop: responsive.spacing.md }]}
                onPress={() => {
                  setShowAuditModal(false);
                  setSelectedEntryForAudit(null);
                  setAuditHistory([]);
                }}
                disabled={loadingAudit}
              >
                <Text style={dynamicStyles.columnSettingsButtonText}>Close</Text>
              </TouchableOpacity>
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  infoText: {
    color: '#7f8c8d',
    marginTop: 4,
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterLabel: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#34495e',
    borderBottomWidth: 1,
    borderBottomColor: '#bdc3c7',
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  tableCell: {
    color: '#2c3e50',
    paddingHorizontal: 4,
  },
  totalRow: {
    backgroundColor: '#f8f9fa',
    borderTopWidth: 2,
    borderTopColor: '#bdc3c7',
  },
  roleBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleBadgeTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default TallySessionLogsScreen;

