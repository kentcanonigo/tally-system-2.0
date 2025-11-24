import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate } from '../utils/dateFormat';
import { useAcceptableDifference } from '../utils/settings';
import {
  tallySessionsApi,
  allocationDetailsApi,
  customersApi,
  plantsApi,
  weightClassificationsApi,
  tallyLogEntriesApi,
  exportApi,
} from '../services/api';
import { generateSessionReportHTML } from '../utils/pdfGenerator';
import type { TallySession, AllocationDetails, Customer, Plant, WeightClassification, TallyLogEntry } from '../types';
import { useResponsive } from '../utils/responsive';
import { usePermissions } from '../utils/usePermissions';

function TallySessionDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const threshold = useAcceptableDifference();
  const { hasPermission } = usePermissions();
  const sessionId = (route.params as any)?.sessionId;
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [allocations, setAllocations] = useState<AllocationDetails[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [logEntries, setLogEntries] = useState<TallyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWeightClassDropdown, setShowWeightClassDropdown] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationDetails | null>(null);
  const [formData, setFormData] = useState({
    weight_classification_id: 0,
    required_bags: '',
  });

  // Track if we've done the initial fetch to prevent double-fetching
  const hasInitialFetchedRef = useRef(false);
  const previousSessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionId) {
      // Reset flag when sessionId changes
      if (previousSessionIdRef.current !== sessionId) {
        hasInitialFetchedRef.current = false;
        previousSessionIdRef.current = sessionId;
      }
      
      if (!hasInitialFetchedRef.current) {
        fetchData();
        hasInitialFetchedRef.current = true;
      }
    }
  }, [sessionId]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (sessionId && hasInitialFetchedRef.current) {
        fetchData(false);
      }
    }, [sessionId])
  );

  const fetchData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const sessionRes = await tallySessionsApi.getById(sessionId);
      const sessionData = sessionRes.data;
      setSession(sessionData);

      // Check if user has permission to view log entries
      const canViewLogs = hasPermission('can_view_tally_logs');
      
      // Build list of promises - only include log entries if user has permission
      const promises = [
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        allocationDetailsApi.getBySession(sessionId),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ];
      
      if (canViewLogs) {
        promises.push(tallyLogEntriesApi.getBySession(sessionId));
      }
      
      const results = await Promise.all(promises);

      setCustomer(results[0].data);
      setPlant(results[1].data);
      setAllocations(results[2].data);
      setWeightClassifications(results[3].data);
      
      // Only set log entries if we fetched them
      if (canViewLogs && results[4]) {
        setLogEntries(results[4].data);
      } else {
        setLogEntries([]); // Empty array if user can't view logs
      }
      
      // Set default weight classification for form
      if (results[3].data.length > 0) {
        setFormData((prev) => ({ ...prev, weight_classification_id: results[3].data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load session details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const handleAddAllocation = async () => {
    if (!formData.weight_classification_id || !formData.required_bags) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const existingAllocation = allocations.find(
      (alloc) => alloc.weight_classification_id === formData.weight_classification_id
    );
    if (existingAllocation) {
      const wcName = getWeightClassificationName(formData.weight_classification_id);
      Alert.alert('Error', `An allocation with weight classification "${wcName}" already exists for this session. Please choose a different classification.`);
      return;
    }

    try {
      await allocationDetailsApi.create(sessionId, {
        weight_classification_id: formData.weight_classification_id,
        required_bags: parseFloat(formData.required_bags),
        allocated_bags_tally: 0.0,
        allocated_bags_dispatcher: 0.0,
      });
      setShowAddModal(false);
      setFormData({ 
        weight_classification_id: weightClassifications[0]?.id || 0, 
        required_bags: '', 
      });
      await fetchData();
    } catch (error: any) {
      console.error('Error creating allocation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to create allocation';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleEditAllocation = (allocation: AllocationDetails) => {
    setEditingAllocation(allocation);
    setFormData({
      weight_classification_id: allocation.weight_classification_id,
      required_bags: allocation.required_bags.toString(),
    });
    setShowEditModal(true);
  };

  const handleUpdateAllocation = async () => {
    if (!editingAllocation || !formData.weight_classification_id || !formData.required_bags) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (formData.weight_classification_id !== editingAllocation.weight_classification_id) {
      const hasLogEntries = logEntries.some(
        (entry) => 
          entry.tally_session_id === sessionId &&
          entry.weight_classification_id === editingAllocation.weight_classification_id
      );
      
      if (hasLogEntries) {
        Alert.alert(
          'Cannot Change Weight Classification',
          'This allocation has existing log entries. Please delete the log entries from the view logs screen first for safety before changing the weight classification.'
        );
        return;
      }

      const existingAllocation = allocations.find(
        (alloc) => 
          alloc.weight_classification_id === formData.weight_classification_id &&
          alloc.id !== editingAllocation.id
      );
      if (existingAllocation) {
        const wcName = getWeightClassificationName(formData.weight_classification_id);
        Alert.alert('Error', `An allocation with weight classification "${wcName}" already exists for this session. Please choose a different classification.`);
        return;
      }
    }

    try {
      await allocationDetailsApi.update(editingAllocation.id, {
        weight_classification_id: formData.weight_classification_id,
        required_bags: parseFloat(formData.required_bags),
      });
      setShowEditModal(false);
      setEditingAllocation(null);
      setFormData({ 
        weight_classification_id: weightClassifications[0]?.id || 0, 
        required_bags: '', 
      });
      await fetchData();
    } catch (error: any) {
      console.error('Error updating allocation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to update allocation';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDeleteAllocation = async (allocationId: number) => {
    Alert.alert(
      'Delete Allocation',
      'Are you sure you want to delete this allocation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await allocationDetailsApi.delete(allocationId);
              fetchData();
            } catch (error: any) {
              console.error('Error deleting allocation:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete allocation');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSession = async () => {
    if (!session) return;

    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete Session #${session.session_number}? This will delete all associated allocations and log entries. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tallySessionsApi.delete(session.id);
              Alert.alert('Success', 'Session deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const handleUpdateStatus = async (status: string) => {
    if (!session) return;
    setShowStatusDropdown(false);
    try {
      await tallySessionsApi.update(session.id, { status: status as any });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      ongoing: 'Ongoing',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const getWeightClassificationName = (wcId: number) => {
    return weightClassifications.find((wc) => wc.id === wcId)?.classification || `WC ${wcId}`;
  };

  const getWeightClassificationLabel = (wcId: number) => {
    const wc = weightClassifications.find((wc) => wc.id === wcId);
    if (!wc) return 'Select Weight Classification';
    return `${wc.classification} (${wc.category}) - ${formatWeightRange(wc)}`;
  };

  const dressedAllocations = useMemo(() => {
    return allocations.filter((allocation) => {
      const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
      return wc?.category === 'Dressed';
    });
  }, [allocations, weightClassifications]);

  const byproductAllocations = useMemo(() => {
    return allocations.filter((allocation) => {
      const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
      return wc?.category === 'Byproduct';
    });
  }, [allocations, weightClassifications]);

  const getMatchStatus = (allocation: AllocationDetails): string => {
    // Check if progress data exists
    const hasProgressData = 'allocated_bags_tally' in allocation;
    if (!hasProgressData) return '-';
    
    const allocatedTally = allocation.allocated_bags_tally ?? 0;
    const allocatedDispatcher = allocation.allocated_bags_dispatcher ?? 0;
    const difference = allocatedTally - allocatedDispatcher;
    const isNotStarted = allocatedTally === 0 && allocatedDispatcher === 0;
    
    if (isNotStarted) {
      return 'Not started';
    }
    
    if (difference === 0) {
      // Tally and dispatcher match
      const matchedCount = allocatedTally;
      if (allocation.required_bags > 0) {
        if (matchedCount < allocation.required_bags) {
          return 'Match (Short)';
        } else if (matchedCount > allocation.required_bags) {
          return 'Match (Over)';
        } else {
          return 'Match';
        }
      }
      return 'Match';
    }
    
    return difference.toFixed(2);
  };

  const getDifferenceColor = (allocation: AllocationDetails): string => {
    // Check if progress data exists
    const hasProgressData = 'allocated_bags_tally' in allocation;
    if (!hasProgressData) return '#666';
    
    const allocatedTally = allocation.allocated_bags_tally ?? 0;
    const allocatedDispatcher = allocation.allocated_bags_dispatcher ?? 0;
    const difference = allocatedTally - allocatedDispatcher;
    const isNotStarted = allocatedTally === 0 && allocatedDispatcher === 0;
    
    if (isNotStarted) {
      return '#666';
    }
    
    if (difference === 0) {
      // Tally and dispatcher match - check if short, over, or exact
      const matchedCount = allocatedTally;
      if (allocation.required_bags > 0) {
        if (matchedCount < allocation.required_bags) {
          return '#f39c12'; // Orange for short
        } else if (matchedCount > allocation.required_bags) {
          return '#e74c3c'; // Red for over
        } else {
          return '#27ae60'; // Green for exact match
        }
      }
      return '#27ae60'; // Green for match (no required amount)
    }
    
    const absDifference = Math.abs(difference);
    if (absDifference <= threshold) {
      return '#f39c12';
    }
    return '#e74c3c';
  };

  const getTotalHeadsForWeightClassification = (wcId: number): number => {
    return logEntries
      .filter(entry => entry.weight_classification_id === wcId)
      .reduce((sum, entry) => sum + (entry.heads || 0), 0);
  };

  const renderAllocationCard = (allocation: AllocationDetails) => {
    // Check if user has permission to view progress data
    const canViewLogs = hasPermission('can_view_tally_logs');
    const hasProgressData = 'allocated_bags_tally' in allocation;
    
    // Only calculate these if user can view logs and data exists
    const difference = hasProgressData ? (allocation.allocated_bags_tally ?? 0) - (allocation.allocated_bags_dispatcher ?? 0) : 0;
    const isNotStarted = hasProgressData ? (allocation.allocated_bags_tally ?? 0) === 0 && (allocation.allocated_bags_dispatcher ?? 0) === 0 : true;
    const diffColor = hasProgressData ? getDifferenceColor(allocation) : '#666';
    const matchStatus = hasProgressData ? getMatchStatus(allocation) : '-';
    const hasTallyOverallocation = hasProgressData && allocation.required_bags > 0 && (allocation.allocated_bags_tally ?? 0) > allocation.required_bags;
    const hasDispatcherOverallocation = hasProgressData && allocation.required_bags > 0 && (allocation.allocated_bags_dispatcher ?? 0) > allocation.required_bags;
    const orangeColor = '#f39c12';
    
    return (
      <View 
        key={allocation.id} 
        style={[
          dynamicStyles.allocationCard,
          responsive.isLargeTablet && { width: '45%', marginHorizontal: '2.5%' }
        ]}
      >
        <View style={styles.allocationHeader}>
          <Text style={dynamicStyles.allocationTitle}>
            {getWeightClassificationName(allocation.weight_classification_id)}
          </Text>
          {/* Only show edit/delete buttons if user has permission */}
          {hasPermission('can_edit_tally_session') && (
            <View style={styles.allocationActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditAllocation(allocation)}
              >
                <Text style={styles.editButtonText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteAllocationButton}
                onPress={() => handleDeleteAllocation(allocation.id)}
              >
                <Text style={styles.deleteAllocationButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Required - Always visible */}
        <View style={styles.allocationRow}>
          <Text style={dynamicStyles.allocationLabel}>Required:</Text>
          <Text style={dynamicStyles.allocationValue}>{allocation.required_bags}</Text>
        </View>
        
        {/* Progress fields - Only visible if user has permission and data exists */}
        {canViewLogs && hasProgressData && (
          <>
            <View style={styles.allocationRow}>
              <Text style={[
                dynamicStyles.allocationLabel,
                hasTallyOverallocation && { color: orangeColor }
              ]}>Allocated (Tally):</Text>
              <Text style={[
                dynamicStyles.allocationValue,
                hasTallyOverallocation && { color: orangeColor }
              ]}>{allocation.allocated_bags_tally ?? 0}</Text>
            </View>
            <View style={styles.allocationRow}>
              <Text style={[
                dynamicStyles.allocationLabel,
                hasDispatcherOverallocation && { color: orangeColor }
              ]}>Allocated (Dispatcher):</Text>
              <Text style={[
                dynamicStyles.allocationValue,
                hasDispatcherOverallocation && { color: orangeColor }
              ]}>{allocation.allocated_bags_dispatcher ?? 0}</Text>
            </View>
            <View style={styles.allocationRow}>
              <Text style={dynamicStyles.allocationLabel}>Difference:</Text>
              <Text style={[
                dynamicStyles.allocationValue, 
                { 
                  color: diffColor,
                  fontWeight: difference === 0 && !isNotStarted ? 'normal' : 'bold'
                }
              ]}>
                {matchStatus}
              </Text>
            </View>
            <View style={styles.allocationRow}>
              <Text style={dynamicStyles.allocationLabel}>Heads:</Text>
              <Text style={dynamicStyles.allocationValue}>
                {getTotalHeadsForWeightClassification(allocation.weight_classification_id).toFixed(0)}
              </Text>
            </View>
          </>
        )}
        
        {/* Show minimal message for users without permission */}
        {!canViewLogs && (
          <View style={[styles.allocationRow, { marginTop: responsive.spacing.sm }]}>
            <Text style={[dynamicStyles.allocationLabel, { fontSize: responsive.fontSize.small, color: '#7f8c8d', fontStyle: 'italic' }]}>
              Progress data requires view logs permission
            </Text>
          </View>
        )}
      </View>
    );
  };
  
  const formatWeightRange = (wc: WeightClassification): string => {
    if (wc.category === 'Byproduct') {
      return wc.description || 'N/A';
    }
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'Catch-all';
    }
    if (wc.min_weight === null && wc.max_weight !== null) {
      return `≤ ${wc.max_weight} kg`;
    }
    if (wc.min_weight !== null && wc.max_weight === null) {
      return `≥ ${wc.min_weight} kg`;
    }
    if (wc.min_weight !== null && wc.max_weight !== null) {
      return `${wc.min_weight} - ${wc.max_weight} kg`;
    }
    return 'N/A';
  };

  const formatDateForFilename = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const handleExportPDF = async () => {
    if (!session) return;
    try {
      setLoading(true);
      const response = await exportApi.exportSessions({ session_ids: [session.id] });
      const html = generateSessionReportHTML(response.data);
      const { uri } = await printToFileAsync({ html, base64: false });
      
      // Generate filename with current date
      const currentDate = new Date();
      const dateString = formatDateForFilename(currentDate);
      const filename = `Allocation Report (${dateString}).pdf`;
      
      // Get the directory of the original file
      const fileDir = uri.substring(0, uri.lastIndexOf('/') + 1);
      const newUri = fileDir + filename;
      
      // Delete existing file if it exists (in case of multiple exports on same day)
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(newUri, { idempotent: true });
      }
      
      // Move/rename the file to the desired filename
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });
      
      await shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTally = () => {
    Alert.alert(
      'Select Mode',
      'What would you like to tally?',
      [
        {
          text: 'Dressed',
          onPress: () => {
            Alert.alert(
              'Select Role',
              'Are you a tally-er or dispatcher?',
              [
                {
                  text: 'Tally-er',
                  onPress: () => {
                    (navigation as any).navigate('Tally', {
                      sessionId: sessionId,
                      tallyRole: 'tally',
                      tallyMode: 'dressed',
                    });
                  },
                },
                {
                  text: 'Dispatcher',
                  onPress: () => {
                    (navigation as any).navigate('Tally', {
                      sessionId: sessionId,
                      tallyRole: 'dispatcher',
                      tallyMode: 'dressed',
                    });
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
        {
          text: 'Byproduct',
          onPress: () => {
            Alert.alert(
              'Select Role',
              'Are you a tally-er or dispatcher?',
              [
                {
                  text: 'Tally-er',
                  onPress: () => {
                    (navigation as any).navigate('Tally', {
                      sessionId: sessionId,
                      tallyRole: 'tally',
                      tallyMode: 'byproduct',
                    });
                  },
                },
                {
                  text: 'Dispatcher',
                  onPress: () => {
                    (navigation as any).navigate('Tally', {
                      sessionId: sessionId,
                      tallyRole: 'dispatcher',
                      tallyMode: 'byproduct',
                    });
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
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
    },
    contentContainer: {
      ...styles.scrollContent,
    },
    contentWrapper: {
      width: '100%',
      maxWidth: '100%',
    },
    header: {
      ...styles.header,
      padding: responsive.padding.medium,
      width: '100%',
      maxWidth: '100%',
    },
    sessionId: {
      ...styles.sessionId,
      fontSize: responsive.fontSize.medium,
    },
    statusPickerContainer: {
      ...styles.statusPickerContainer,
      minWidth: responsive.isTablet ? 150 : 120,
    },
    statusDropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.small,
      minHeight: 40,
    },
    statusDropdownText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
      fontWeight: '500',
      flex: 1,
    },
    statusDropdownIcon: {
      color: '#2c3e50',
      fontSize: 10,
      marginLeft: responsive.spacing.xs,
    },
    statusDropdownMenu: {
      backgroundColor: '#fff',
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
      minWidth: responsive.isTablet ? 150 : 120,
      overflow: 'hidden',
    },
    statusDropdownOption: {
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    statusDropdownOptionLast: {
      borderBottomWidth: 0,
    },
    statusDropdownOptionSelected: {
      backgroundColor: '#3498db',
    },
    statusDropdownOptionText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
    },
    statusDropdownOptionTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    infoCard: {
      ...styles.infoCard,
      padding: responsive.padding.medium,
      margin: responsive.spacing.md,
    },
    infoLabel: {
      ...styles.infoLabel,
      fontSize: responsive.fontSize.small,
      marginTop: responsive.spacing.md,
    },
    infoValue: {
      ...styles.infoValue,
      fontSize: responsive.fontSize.medium,
    },
    actions: {
      ...styles.actions,
      padding: responsive.spacing.md,
      flexDirection: responsive.isTablet ? 'row' as const : 'column' as const,
      width: '100%',
      maxWidth: '100%',
    },
    actionButton: {
      ...styles.actionButton,
      padding: responsive.padding.medium,
      marginHorizontal: responsive.isTablet ? responsive.spacing.sm : 0,
      marginVertical: responsive.isTablet ? 0 : responsive.spacing.sm,
    },
    actionButtonText: {
      ...styles.actionButtonText,
      fontSize: responsive.fontSize.small,
    },
    sectionTitle: {
      ...styles.sectionTitle,
      fontSize: responsive.fontSize.large,
      padding: responsive.padding.medium,
      paddingBottom: responsive.spacing.xs,
    },
    allocationCard: {
      ...styles.allocationCard,
      padding: responsive.padding.medium,
      margin: responsive.spacing.md,
    },
    allocationTitle: {
      ...styles.allocationTitle,
      fontSize: responsive.fontSize.medium,
    },
    allocationLabel: {
      ...styles.allocationLabel,
      fontSize: responsive.fontSize.small,
    },
    allocationValue: {
      ...styles.allocationValue,
      fontSize: responsive.fontSize.small,
    },
    modalContent: {
      ...styles.modalContent,
      padding: responsive.padding.large,
      width: responsive.isTablet ? Math.min(responsive.width * 0.6, 500) : '90%',
      maxHeight: responsive.isTablet ? '85%' : '80%',
    },
    modalTitle: {
      ...styles.modalTitle,
      fontSize: responsive.fontSize.large,
      marginBottom: responsive.spacing.lg,
    },
    label: {
      ...styles.label,
      fontSize: responsive.fontSize.small,
      marginTop: responsive.spacing.md,
      marginBottom: responsive.spacing.xs,
    },
    input: {
      ...styles.input,
      padding: responsive.padding.medium,
      fontSize: responsive.fontSize.medium,
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
    weightClassDropdownMenu: {
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
    weightClassDropdownMenuScroll: {
      maxHeight: '80%',
    },
    weightClassDropdownOption: {
      paddingHorizontal: responsive.padding.medium,
      paddingVertical: responsive.padding.medium,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    weightClassDropdownOptionLast: {
      borderBottomWidth: 0,
    },
    weightClassDropdownOptionSelected: {
      backgroundColor: '#3498db',
    },
    weightClassDropdownOptionText: {
      color: '#2c3e50',
      fontSize: responsive.fontSize.small,
    },
    weightClassDropdownOptionTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    pickerContainer: {
      ...styles.pickerContainer,
      maxHeight: responsive.isTablet ? 200 : 150,
    },
    pickerOption: {
      ...styles.pickerOption,
      padding: responsive.padding.medium,
    },
    pickerOptionText: {
      ...styles.pickerOptionText,
      fontSize: responsive.fontSize.small,
    },
    modalActions: {
      ...styles.modalActions,
      marginTop: responsive.spacing.lg,
    },
    modalButton: {
      ...styles.modalButton,
      padding: responsive.padding.medium,
    },
    modalButtonText: {
      ...styles.modalButtonText,
      fontSize: responsive.fontSize.small,
    },
  };

  return (
    <ScrollView 
      style={dynamicStyles.container} 
      contentContainerStyle={dynamicStyles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={dynamicStyles.contentWrapper}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.sessionId}>
            {customer?.name || 'Unknown'} - Session #{session.session_number} - {formatDate(session.date, timezone)}
          </Text>
          <View style={dynamicStyles.statusPickerContainer}>
            <TouchableOpacity
              style={dynamicStyles.statusDropdownButton}
              onPress={() => setShowStatusDropdown(true)}
            >
              <Text style={dynamicStyles.statusDropdownText}>
                {getStatusLabel(session.status)}
              </Text>
              <Text style={dynamicStyles.statusDropdownIcon}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={dynamicStyles.infoCard}>
          <Text style={dynamicStyles.infoLabel}>Customer</Text>
          <Text style={dynamicStyles.infoValue}>{customer?.name}</Text>
          {/* Plant info is now implied by context, but we can still show it or remove it. 
              Since the user can change plants in settings, showing it confirms context. 
              But it's read-only. */}
          <Text style={dynamicStyles.infoLabel}>Plant</Text>
          <Text style={dynamicStyles.infoValue}>{plant?.name}</Text>
          <Text style={dynamicStyles.infoLabel}>Date</Text>
          <Text style={dynamicStyles.infoValue}>{formatDate(session.date, timezone)}</Text>
        </View>

        <View style={dynamicStyles.actions}>
          {/* Only show View Logs button if user has permission */}
          {hasPermission('can_view_tally_logs') && (
            <TouchableOpacity
              style={[dynamicStyles.actionButton, styles.viewLogsButton]}
              onPress={() => navigation.navigate('TallySessionLogs' as never, { sessionId: session.id } as never)}
            >
              <Text style={dynamicStyles.actionButtonText}>View Logs</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[dynamicStyles.actionButton, styles.exportButton]}
            onPress={handleExportPDF}
          >
            <Text style={dynamicStyles.actionButtonText}>Export PDF</Text>
          </TouchableOpacity>
          {session.status === 'ongoing' && (
            <>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, styles.startTallyButton]}
                onPress={handleStartTally}
              >
                <Text style={dynamicStyles.actionButtonText}>Start Tally</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>Allocations</Text>
          {/* Only show add allocation button if session is ongoing and user has permission */}
          {session.status === 'ongoing' && hasPermission('can_edit_tally_session') && (
            <TouchableOpacity
              style={styles.addAllocationButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addAllocationButtonText}>+</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dressed Allocations Section */}
        <View style={{ marginBottom: responsive.spacing.lg }}>
          <Text style={[dynamicStyles.sectionTitle, { marginBottom: responsive.spacing.md, fontSize: responsive.fontSize.medium }]}>
            Dressed
          </Text>
          {dressedAllocations.length === 0 ? (
            <Text style={styles.emptyText}>No Dressed allocations</Text>
          ) : (
            <View style={responsive.isLargeTablet ? styles.allocationGrid : undefined}>
              {dressedAllocations.map((allocation) => renderAllocationCard(allocation))}
            </View>
          )}
        </View>

        {/* Byproduct Allocations Section */}
        <View style={{ marginBottom: responsive.spacing.lg }}>
          <Text style={[dynamicStyles.sectionTitle, { marginBottom: responsive.spacing.md, fontSize: responsive.fontSize.medium }]}>
            Byproduct
          </Text>
          {byproductAllocations.length === 0 ? (
            <Text style={styles.emptyText}>No Byproduct allocations</Text>
          ) : (
            <View style={responsive.isLargeTablet ? styles.allocationGrid : undefined}>
              {byproductAllocations.map((allocation) => renderAllocationCard(allocation))}
            </View>
          )}
        </View>

        <View style={{ padding: responsive.padding.medium, marginTop: responsive.spacing.lg, marginBottom: responsive.spacing.xl, flexDirection: 'row' }}>
          <TouchableOpacity
            style={[dynamicStyles.actionButton, styles.deleteButton]}
            onPress={handleDeleteSession}
          >
            <Text style={dynamicStyles.actionButtonText}>Delete Session</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showStatusDropdown && (
        <Modal
          transparent
          visible={showStatusDropdown}
          animationType="fade"
          onRequestClose={() => setShowStatusDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowStatusDropdown(false)}
          >
            <View 
              style={dynamicStyles.statusDropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={[
                  dynamicStyles.statusDropdownOption,
                  session.status === 'ongoing' && dynamicStyles.statusDropdownOptionSelected,
                ]}
                onPress={() => handleUpdateStatus('ongoing')}
              >
                <Text
                  style={[
                    dynamicStyles.statusDropdownOptionText,
                    session.status === 'ongoing' && dynamicStyles.statusDropdownOptionTextSelected,
                  ]}
                >
                  Ongoing
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.statusDropdownOption,
                  session.status === 'completed' && dynamicStyles.statusDropdownOptionSelected,
                ]}
                onPress={() => handleUpdateStatus('completed')}
              >
                <Text
                  style={[
                    dynamicStyles.statusDropdownOptionText,
                    session.status === 'completed' && dynamicStyles.statusDropdownOptionTextSelected,
                  ]}
                >
                  Completed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.statusDropdownOption,
                  dynamicStyles.statusDropdownOptionLast,
                  session.status === 'cancelled' && dynamicStyles.statusDropdownOptionSelected,
                ]}
                onPress={() => handleUpdateStatus('cancelled')}
              >
                <Text
                  style={[
                    dynamicStyles.statusDropdownOptionText,
                    session.status === 'cancelled' && dynamicStyles.statusDropdownOptionTextSelected,
                  ]}
                >
                  Cancelled
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showEditModal && (
        <View style={styles.modal}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Edit Allocation</Text>
            <Text style={dynamicStyles.label}>Weight Classification</Text>
            <View style={dynamicStyles.pickerWrapper}>
              <TouchableOpacity
                style={dynamicStyles.dropdownButton}
                onPress={() => setShowWeightClassDropdown(true)}
              >
                <Text style={dynamicStyles.dropdownText} numberOfLines={2}>
                  {formData.weight_classification_id > 0 
                    ? getWeightClassificationLabel(formData.weight_classification_id)
                    : 'Select Weight Classification'}
                </Text>
                <Text style={dynamicStyles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={dynamicStyles.label}>Required Bags</Text>
            <TextInput
              style={dynamicStyles.input}
              value={formData.required_bags}
              onChangeText={(text) => setFormData({ ...formData, required_bags: text })}
              keyboardType="numeric"
              placeholder="0"
            />
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingAllocation(null);
                  setFormData({ 
                    weight_classification_id: weightClassifications[0]?.id || 0, 
                    required_bags: '', 
                  });
                }}
              >
                <Text style={dynamicStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.saveButton]}
                onPress={handleUpdateAllocation}
              >
                <Text style={dynamicStyles.modalButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showAddModal && (
        <View style={styles.modal}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Add Allocation</Text>
            <Text style={dynamicStyles.label}>Weight Classification</Text>
            <View style={dynamicStyles.pickerWrapper}>
              <TouchableOpacity
                style={dynamicStyles.dropdownButton}
                onPress={() => setShowWeightClassDropdown(true)}
              >
                <Text style={dynamicStyles.dropdownText} numberOfLines={2}>
                  {formData.weight_classification_id > 0 
                    ? getWeightClassificationLabel(formData.weight_classification_id)
                    : 'Select Weight Classification'}
                </Text>
                <Text style={dynamicStyles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={dynamicStyles.label}>Required Bags</Text>
            <TextInput
              style={dynamicStyles.input}
              value={formData.required_bags}
              onChangeText={(text) => setFormData({ ...formData, required_bags: text })}
              keyboardType="numeric"
              placeholder="0"
            />
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setFormData({ 
                    weight_classification_id: weightClassifications[0]?.id || 0, 
                    required_bags: '', 
                  });
                }}
              >
                <Text style={dynamicStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, styles.saveButton]}
                onPress={handleAddAllocation}
              >
                <Text style={dynamicStyles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Weight Classification Dropdown Modal */}
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
              style={dynamicStyles.weightClassDropdownMenuScroll}
              contentContainerStyle={dynamicStyles.weightClassDropdownMenu}
              onStartShouldSetResponder={() => true}
            >
              {weightClassifications
                .filter((wc) => {
                  // When editing, allow the current allocation's weight classification
                  if (showEditModal && editingAllocation && wc.id === editingAllocation.weight_classification_id) {
                    return true;
                  }
                  // When adding or editing to a different one, exclude already used classifications
                  const isUsed = allocations.some(
                    (alloc) => {
                      // When editing, exclude the current allocation from the check
                      if (showEditModal && editingAllocation && alloc.id === editingAllocation.id) {
                        return false;
                      }
                      return alloc.weight_classification_id === wc.id;
                    }
                  );
                  return !isUsed;
                })
                .map((wc, index, filtered) => (
                  <TouchableOpacity
                    key={wc.id}
                    style={[
                      dynamicStyles.weightClassDropdownOption,
                      index === filtered.length - 1 && dynamicStyles.weightClassDropdownOptionLast,
                      formData.weight_classification_id === wc.id && dynamicStyles.weightClassDropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setFormData({ ...formData, weight_classification_id: wc.id });
                      setShowWeightClassDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        dynamicStyles.weightClassDropdownOptionText,
                        formData.weight_classification_id === wc.id && dynamicStyles.weightClassDropdownOptionTextSelected,
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
  },
  sessionId: {
    fontWeight: 'bold',
    color: '#fff',
  },
  statusPickerContainer: {
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
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    color: '#7f8c8d',
  },
  infoValue: {
    color: '#2c3e50',
    fontWeight: '500',
  },
  actions: {
    flexGrow: 1,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#27ae60',
  },
  addButton: {
    backgroundColor: '#3498db',
  },
  viewLogsButton: {
    backgroundColor: '#9b59b6',
  },
  exportButton: {
    backgroundColor: '#e67e22',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    padding: 20,
  },
  allocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  allocationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  allocationTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  allocationLabel: {
    color: '#7f8c8d',
  },
  allocationValue: {
    fontWeight: '500',
    color: '#2c3e50',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  label: {
    fontWeight: '500',
    color: '#2c3e50',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  pickerOptionSelected: {
    backgroundColor: '#3498db',
  },
  pickerOptionText: {
    color: '#2c3e50',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#3498db',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  startTallyButton: {
    backgroundColor: '#27ae60',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  allocationActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 4,
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 18,
  },
  deleteAllocationButton: {
    padding: 4,
  },
  deleteAllocationButtonText: {
    fontSize: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  addAllocationButton: {
    backgroundColor: '#3498db',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAllocationButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: -2,
  },
});

export default TallySessionDetailScreen;
