import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, Modal } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate, formatTime } from '../utils/dateFormat';
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
  }>({
    role: 'all',
    weight_classification_id: 'all',
  });
  const [sortBy, setSortBy] = useState<'class' | 'weight' | 'time' | 'id'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showWeightClassDropdown, setShowWeightClassDropdown] = useState(false);
  const [showSortByDropdown, setShowSortByDropdown] = useState(false);
  const [showSortOrderDropdown, setShowSortOrderDropdown] = useState(false);

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
  }, [logEntries, filters, sortBy, sortOrder, weightClassifications, timezone]);

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
    sectionTitle: {
      ...styles.sectionTitle,
      fontSize: responsive.fontSize.medium,
      marginBottom: responsive.spacing.sm,
      marginTop: responsive.spacing.md,
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
        <Text style={dynamicStyles.title}>Tally Logs - Session #{session.id}</Text>
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
            {aggregations.map((agg) => (
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
                      color: agg.difference === 0 ? '#27ae60' : '#e74c3c',
                      fontWeight: agg.difference === 0 ? 'normal' : 'bold',
                    },
                  ]}
                >
                  {agg.difference === 0 ? '✓' : agg.difference.toFixed(1)}
                </Text>
              </View>
            ))}
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
                    color: overallTotals.difference === 0 ? '#27ae60' : '#e74c3c',
                    fontWeight: 'bold',
                  },
                ]}
              >
                {overallTotals.difference === 0 ? '✓' : overallTotals.difference.toFixed(1)}
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
      <Text style={dynamicStyles.sectionTitle}>Log Entries ({filteredEntries.length})</Text>
      <View style={dynamicStyles.tableContainer}>
        <View style={dynamicStyles.tableHeader}>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 0.8 }]}>ID</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1 }]}>Role</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.2 }]}>Class</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.2 }]}>Desc</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1 }]}>Range</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 0.8 }]}>Weight</Text>
          <Text style={[dynamicStyles.tableHeaderText, { flex: 1.2 }]}>Time</Text>
        </View>
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => {
            const wc = weightClassifications.find((wc) => wc.id === entry.weight_classification_id);
            return (
              <View key={entry.id} style={dynamicStyles.tableRow}>
                <Text style={[dynamicStyles.tableCell, { flex: 0.8 }]}>{entry.id}</Text>
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
                <Text style={[dynamicStyles.tableCell, { flex: 1.2, fontSize: 9 }]} numberOfLines={1}>
                  {wc?.description || '-'}
                </Text>
                <Text style={[dynamicStyles.tableCell, { flex: 1, fontSize: 10 }]} numberOfLines={1}>
                  {wc ? formatWeightRange(wc) : '-'}
                </Text>
                <Text style={[dynamicStyles.tableCell, { flex: 0.8 }]}>
                  {entry.weight.toFixed(2)}
                </Text>
                <Text style={[dynamicStyles.tableCell, { flex: 1.2, fontSize: 10 }]} numberOfLines={1}>
                  {formatTime(entry.created_at, timezone)}
                </Text>
              </View>
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

