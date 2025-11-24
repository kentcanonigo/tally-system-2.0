import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, Modal } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate, formatTime } from '../utils/dateFormat';
import { useAcceptableDifference } from '../utils/settings';
import {
  tallySessionsApi,
  customersApi,
  plantsApi,
  weightClassificationsApi,
  tallyLogEntriesApi,
} from '../services/api';
import type { TallySession, Customer, Plant, WeightClassification, TallyLogEntry } from '../types';
import { TallyLogEntryRole } from '../types';
import { useResponsive } from '../utils/responsive';

function TallySessionLogsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const threshold = useAcceptableDifference();
  const sessionId = (route.params as any)?.sessionId;
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
    category: 'Dressed' | 'Byproduct' | 'all';
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

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);

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

  const getCategoryLabel = (category: 'Dressed' | 'Byproduct' | 'all') => {
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

  const dynamicStyles = {
    container: {
      ...styles.container,
      padding: responsive.padding.medium,
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
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
      minWidth: 200,
      maxWidth: '90%',
      overflow: 'hidden',
    },
    dropdownMenuScroll: {
      maxHeight: '80%',
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
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      width: responsive.isTablet ? Math.min(responsive.width * 0.5, 400) : '85%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    columnSettingsTitle: {
      fontSize: responsive.fontSize.large,
      fontWeight: 'bold',
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
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: '#bdc3c7',
      borderRadius: 4,
      marginRight: responsive.spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fff',
    },
    checkboxChecked: {
      backgroundColor: '#3498db',
      borderColor: '#3498db',
    },
    checkboxCheckmark: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    columnSettingsOptionText: {
      fontSize: responsive.fontSize.medium,
      color: '#2c3e50',
      fontWeight: '500',
    },
    columnSettingsButton: {
      backgroundColor: '#3498db',
      borderRadius: 8,
      padding: responsive.padding.medium,
      alignItems: 'center',
      marginTop: responsive.spacing.sm,
    },
    columnSettingsButtonText: {
      color: '#fff',
      fontSize: responsive.fontSize.medium,
      fontWeight: '600',
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
      paddingVertical: responsive.padding.xs,
      paddingHorizontal: responsive.padding.small,
    },
    tableCell: {
      ...styles.tableCell,
      fontSize: responsive.fontSize.small,
    },
  };

  return (
    <ScrollView
      style={dynamicStyles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
              <TouchableOpacity
                style={[dynamicStyles.settingsButton, { marginRight: 8 }]}
                onPress={handleDeleteSelected}
              >
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                style={[dynamicStyles.settingsButton, { marginRight: 8 }]}
                onPress={toggleSelectionMode}
              >
                <Text style={{ fontSize: 14, color: '#3498db', fontWeight: 'bold' }}>Select</Text>
              </TouchableOpacity>
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
        </View>
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => {
            const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
            return (
              <TouchableOpacity
                key={entry.id}
                style={dynamicStyles.tableRow}
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
    </ScrollView>
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

