import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { tallySessionsApi, exportApi, customersApi, allocationDetailsApi } from '../services/api';
import { generateSessionReportHTML } from '../utils/pdfGenerator';
import { generateTallySheetHTML } from '../utils/tallySheetPdfGenerator';
import { generateTallySheetExcel } from '../utils/tallySheetExcelGenerator';
import { TallySession, Customer } from '../types';
import { usePlant } from '../contexts/PlantContext';
import { usePermissions } from '../utils/usePermissions';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { getActiveSessions } from '../utils/activeSessions';

const ExportScreen = () => {
  const { activePlantId } = usePlant();
  const { hasPermission } = usePermissions();
  const { timezone } = useTimezone();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [allSessions, setAllSessions] = useState<TallySession[]>([]); // Store all sessions for filtering
  const [filteredSessions, setFilteredSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportTypeModal, setShowExportTypeModal] = useState(false);
  const [showTallySheetFormatModal, setShowTallySheetFormatModal] = useState(false);
  const [activeSessionIds, setActiveSessionIds] = useState<number[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [hasMoreUnfilteredPages, setHasMoreUnfilteredPages] = useState(false);
  const SESSIONS_PER_PAGE = 10;
  const hasInitiallyLoaded = useRef(false);

  // Filters state
  const [filterCustomerId, setFilterCustomerId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(''); // Default to all statuses
  
  // Sort state
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadActiveSessions = async () => {
    try {
      const activeIds = await getActiveSessions();
      setActiveSessionIds(activeIds);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  };

  const fetchData = useCallback(async (showLoading = true, page: number = currentPage) => {
    if (!activePlantId) return;
    
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const params: any = { plant_id: activePlantId };
      
      // Add pagination parameters
      const skip = (page - 1) * SESSIONS_PER_PAGE;
      const limit = SESSIONS_PER_PAGE;
      params.skip = skip;
      params.limit = limit + 1; // Fetch one extra to check if there are more pages

      const [sessionsRes, customersRes] = await Promise.all([
        tallySessionsApi.getAll(params),
        customersApi.getAll(),
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
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to fetch sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePlantId]);

  useEffect(() => {
    if (activePlantId) {
      setCurrentPage(1); // Reset to page 1 when plant changes
      fetchData().then(() => {
        hasInitiallyLoaded.current = true;
      });
      loadActiveSessions();
    } else {
      setSessions([]);
      setAllSessions([]);
      setCustomers([]);
      setLoading(false);
    }
  }, [activePlantId]); // Remove fetchData from dependencies to avoid infinite loop

  // Refresh active sessions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we've already loaded data initially (not on first mount)
      if (hasInitiallyLoaded.current && !loading && !refreshing) {
        loadActiveSessions();
      }
    }, [loading, refreshing])
  );

  const toggleActiveFilter = () => {
    const newValue = !showActiveOnly;
    setShowActiveOnly(newValue);
    
    // Clear all filters when toggling active sessions
    if (newValue) {
      setFilterCustomerId(null);
      setFilterStatus('');
    }
  };

  // Apply filters and sorting
  useEffect(() => {
    let result = [...allSessions];

    // Filter by active status if enabled
    if (showActiveOnly) {
      result = result.filter((session) => activeSessionIds.includes(session.id));
    }

    // Filter by Status
    if (filterStatus) {
      result = result.filter(s => s.status === filterStatus);
    }

    // Filter by Customer
    if (filterCustomerId) {
      result = result.filter(s => s.customer_id === filterCustomerId);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredSessions(result);
    
    // Update hasMorePages based on filtered results
    const hasFilters = showActiveOnly || filterStatus || filterCustomerId;
    if (hasFilters) {
      // Special case: If filtering by active sessions only, max is 10 active sessions
      // Since max is 10 and page size is 10, there can only be 1 page of active sessions
      if (showActiveOnly && !filterStatus && !filterCustomerId) {
        setHasMorePages(false);
      } else {
        // With other filters: disable next button if:
        // 1. We got fewer than page size from server (no more pages available), OR
        // 2. Filtered results are less than page size (all matching results fit on this page)
        const hasFewerUnfiltered = allSessions.length < SESSIONS_PER_PAGE;
        const hasFewerFiltered = result.length < SESSIONS_PER_PAGE;
        setHasMorePages(hasMoreUnfilteredPages && !hasFewerUnfiltered && !hasFewerFiltered);
      }
    } else {
      // Without filters, use the server-side pagination indicator
      setHasMorePages(hasMoreUnfilteredPages);
    }
    
    // Reset selection when filters change
    setSelectedSessionIds([]);
  }, [allSessions, filterCustomerId, filterStatus, sortBy, sortOrder, showActiveOnly, activeSessionIds, hasMoreUnfilteredPages, SESSIONS_PER_PAGE]);

  // Reset to page 1 when filters change (but not on initial load)
  useEffect(() => {
    if (hasInitiallyLoaded.current) {
      setCurrentPage(1);
      fetchData(false, 1);
    }
  }, [filterStatus, filterCustomerId, showActiveOnly]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false, currentPage);
    loadActiveSessions();
  };

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

  const toggleSessionSelection = (sessionId: number) => {
    setSelectedSessionIds(prev => {
      if (prev.includes(sessionId)) {
        return prev.filter(id => id !== sessionId);
      } else {
        return [...prev, sessionId];
      }
    });
  };

  const selectAll = () => {
    if (selectedSessionIds.length === filteredSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(filteredSessions.map(s => s.id));
    }
  };

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
      setExporting(false);
      setShowExportTypeModal(false);
    }
  };

  const checkAllocationMismatches = async (sessionIds: number[]): Promise<{ hasMismatches: boolean; mismatchedSessions: string[] }> => {
    const mismatchedSessions: string[] = [];
    
    try {
      // Fetch allocations for all sessions
      const allocationPromises = sessionIds.map(async (sessionId) => {
        try {
          const allocationsRes = await allocationDetailsApi.getBySession(sessionId);
          const allocations = allocationsRes.data;
          
          // Check if any allocation has mismatched tallyer and dispatcher counts
          const hasMismatch = allocations.some(
            (allocation) => allocation.allocated_bags_tally !== allocation.allocated_bags_dispatcher
          );
          
          if (hasMismatch) {
            // Get session info for display
            const session = allSessions.find(s => s.id === sessionId);
            const customer = session ? customers.find(c => c.id === session.customer_id) : null;
            const sessionName = customer ? `${customer.name} - Session #${session?.session_number || sessionId}` : `Session #${session?.session_number || sessionId}`;
            return sessionName;
          }
          return null;
        } catch (error) {
          console.error(`Error fetching allocations for session ${sessionId}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(allocationPromises);
      mismatchedSessions.push(...results.filter((name): name is string => name !== null));
      
      return {
        hasMismatches: mismatchedSessions.length > 0,
        mismatchedSessions
      };
    } catch (error) {
      console.error('Error checking allocation mismatches:', error);
      // If we can't check, allow export to proceed
      return { hasMismatches: false, mismatchedSessions: [] };
    }
  };

  const handleExportTallySheet = async (format: 'pdf' | 'excel') => {
    if (selectedSessionIds.length === 0) {
      Alert.alert('No Sessions Selected', 'Please select at least one session to export.');
      return;
    }

    // Check for allocation mismatches
    const { hasMismatches, mismatchedSessions } = await checkAllocationMismatches(selectedSessionIds);
    
    if (hasMismatches) {
      const sessionList = mismatchedSessions.join('\n• ');
      Alert.alert(
        'Allocation Mismatch Detected',
        `The following session(s) have mismatched tallyer and dispatcher allocations:\n\n• ${sessionList}\n\nDo you want to proceed with the export anyway?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowTallySheetFormatModal(false);
            }
          },
          {
            text: 'Proceed',
            onPress: () => performExport(format)
          }
        ]
      );
      return;
    }

    // No mismatches, proceed with export
    performExport(format);
  };

  const performExport = async (format: 'pdf' | 'excel') => {
    try {
      setExporting(true);
      setShowTallySheetFormatModal(false);
      setShowExportTypeModal(false);

      const response = await exportApi.exportTallySheet({
        session_ids: selectedSessionIds
      });

      if (format === 'pdf') {
        const html = generateTallySheetHTML(response.data);
        const { uri } = await printToFileAsync({
          html,
          base64: false
        });

        const currentDate = new Date();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[currentDate.getMonth()];
        const day = currentDate.getDate();
        const year = currentDate.getFullYear();
        const dateString = `${month}-${day}-${year}`;
        
        // Determine filename based on number of customers
        let filename: string;
        const data = response.data as any;
        if (data.customers && data.customers.length > 1) {
          filename = `Tally Sheet - Multiple Customers (${data.customers.length}) (${dateString}).pdf`;
        } else if (data.customers && data.customers.length === 1) {
          filename = `Tally Sheet - ${data.customers[0].customer_name} (${dateString}).pdf`;
        } else if (data.customer_name) {
          filename = `Tally Sheet - ${data.customer_name} (${dateString}).pdf`;
        } else {
          filename = `Tally Sheet (${dateString}).pdf`;
        }
        
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
      } else {
        await generateTallySheetExcel(response.data);
      }
    } catch (error) {
      console.error('Tally sheet export error:', error);
      Alert.alert('Error', 'Failed to export tally sheet');
    } finally {
      setExporting(false);
    }
  };

  const getCustomerName = (customerId: number) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters & Sort</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.pickerContainer}>
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
            <View style={styles.pickerContainer}>
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

            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => {
                setFilterCustomerId(null);
                setFilterStatus('');
                setSortBy('date');
                setSortOrder('desc');
              }}
            >
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderItem = ({ item }: { item: TallySession }) => {
    const isSelected = selectedSessionIds.includes(item.id);
    const isActive = activeSessionIds.includes(item.id);
    return (
      <TouchableOpacity 
        style={[styles.item, isSelected && styles.selectedItem]} 
        onPress={() => toggleSessionSelection(item.id)}
      >
        <View style={styles.itemContent}>
          <View style={styles.checkboxContainer}>
            <MaterialIcons 
              name={isSelected ? "check-box" : "check-box-outline-blank"} 
              size={24} 
              color={isSelected ? "#3498db" : "#757575"} 
            />
          </View>
          <View style={styles.itemDetails}>
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleRow}>
                {isActive && (
                  <MaterialIcons 
                    name="star" 
                    size={18} 
                    color="#f39c12" 
                    style={styles.activeStarIcon}
                  />
                )}
                <Text style={styles.itemCustomer}>
                  {getCustomerName(item.customer_id)} - Order #{item.session_number} - {formatDate(item.date, timezone)}
                </Text>
              </View>
              <Text style={styles.itemDate}>Last edited: {formatDateTime(item.updated_at, timezone)}</Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#2ecc71';
      case 'ongoing': return '#3498db';
      case 'cancelled': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Export Sessions</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.filterButton, showActiveOnly && styles.activeFilterButton]} 
            onPress={toggleActiveFilter}
          >
            <MaterialIcons 
              name={showActiveOnly ? 'star' : 'star-border'} 
              size={24} 
              color={showActiveOnly ? '#f39c12' : '#3498db'} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <MaterialIcons name="filter-list" size={24} color="#3498db" />
          </TouchableOpacity>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {selectedSessionIds.length === filteredSessions.length && filteredSessions.length > 0 ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {filteredSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No sessions found</Text>
          <Text style={styles.emptyStateSubtext}>
            {showActiveOnly 
              ? 'No active sessions found. Mark sessions as active in the Sessions tab.' 
              : 'Try adjusting your filters to see more results.'}
          </Text>
          {!showActiveOnly && (
            <TouchableOpacity 
              style={styles.adjustFiltersButton}
              onPress={() => setShowFilters(true)}
            >
              <Text style={styles.adjustFiltersButtonText}>Adjust Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
        />
      )}

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

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>{selectedSessionIds.length} selected</Text>
        {/* Only show export button if user has permission */}
        {hasPermission('can_export_data') ? (
          <TouchableOpacity 
            style={[styles.exportButton, (selectedSessionIds.length === 0 || exporting) && styles.disabledButton]} 
            onPress={handleExportButtonPress}
            disabled={selectedSessionIds.length === 0 || exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.exportButtonText}>Export PDF</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.noPermissionContainer}>
            <Text style={styles.noPermissionText}>Export requires permission</Text>
          </View>
        )}
      </View>

      {renderFilterModal()}

      {/* Export Type Selection Modal */}
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

            {/* Tally Sheet Report */}
            <TouchableOpacity
              style={[styles.exportTypeOption, styles.exportTypeOptionSecondary]}
              onPress={() => {
                setShowExportTypeModal(false);
                setShowTallySheetFormatModal(true);
              }}
              disabled={exporting}
            >
              <MaterialIcons
                name="list-alt"
                size={24}
                color="#fff"
                style={styles.exportTypeOptionIcon}
              />
              <View style={styles.exportTypeOptionContent}>
                <Text style={styles.exportTypeOptionTitleLight}>Tally Sheet Report</Text>
                <Text style={styles.exportTypeOptionDescLight}>
                  Detailed grid with individual entries
                </Text>
              </View>
              {exporting && <ActivityIndicator size="small" color="#fff" />}
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

      {/* Tally Sheet Format Selection Modal */}
      <Modal
        transparent
        visible={showTallySheetFormatModal}
        animationType="fade"
        onRequestClose={() => setShowTallySheetFormatModal(false)}
      >
        <TouchableOpacity
          style={styles.formatModalOverlay}
          activeOpacity={1}
          onPress={() => setShowTallySheetFormatModal(false)}
        >
          <View style={styles.formatModalContent}>
            <View style={styles.formatModalHeader}>
              <Text style={styles.formatModalTitle}>Export Format</Text>
              <TouchableOpacity
                onPress={() => setShowTallySheetFormatModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formatOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.formatOption,
                  exporting && styles.formatOptionDisabled
                ]}
                onPress={() => handleExportTallySheet('pdf')}
                disabled={exporting}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="picture-as-pdf"
                  size={28}
                  color="#e74c3c"
                />
                <View style={styles.formatOptionTextContainer}>
                  <Text style={styles.formatOptionTitle}>PDF</Text>
                  <Text style={styles.formatOptionDescription}>
                    Portable Document Format
                  </Text>
                </View>
                {exporting && (
                  <ActivityIndicator size="small" color="#3498db" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formatOption,
                  exporting && styles.formatOptionDisabled
                ]}
                onPress={() => handleExportTallySheet('excel')}
                disabled={exporting}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="table-chart"
                  size={28}
                  color="#27ae60"
                />
                <View style={styles.formatOptionTextContainer}>
                  <Text style={styles.formatOptionTitle}>Excel</Text>
                  <Text style={styles.formatOptionDescription}>
                    Microsoft Excel format
                  </Text>
                </View>
                {exporting && (
                  <ActivityIndicator size="small" color="#3498db" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  selectAllText: {
    color: '#3498db',
    fontSize: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 8,
    paddingBottom: 140, // Space for pagination (~60px) + footer (~60px) + extra padding
  },
  item: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  selectedItem: {
    borderColor: '#3498db',
    borderWidth: 1,
    backgroundColor: '#f0f8ff',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'column',
    marginBottom: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeStarIcon: {
    marginRight: 6,
  },
  itemCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  itemDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
    zIndex: 2,
  },
  selectionCount: {
    fontSize: 16,
    color: '#666',
  },
  exportButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 8,
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
  resetButton: {
    marginTop: 24,
    padding: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#e74c3c',
    fontSize: 16,
  },
  applyButton: {
    backgroundColor: '#3498db',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  adjustFiltersButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  adjustFiltersButtonText: {
    color: '#3498db',
    fontWeight: '600',
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    fontSize: 16,
  },
  noPermissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  noPermissionText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
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
  // Format Selection Modal Styles (Clean Design)
  formatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formatModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  formatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  formatModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  formatOptionsContainer: {
    padding: 20,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  formatOptionDisabled: {
    opacity: 0.6,
  },
  formatOptionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  formatOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  formatOptionDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  activeFilterButton: {
    backgroundColor: '#fff3cd',
    borderRadius: 4,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 70, // Position above footer (footer is ~60px tall)
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    zIndex: 1,
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
});

export default ExportScreen;
