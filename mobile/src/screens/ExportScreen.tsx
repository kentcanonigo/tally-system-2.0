import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { tallySessionsApi, exportApi, customersApi } from '../services/api';
import { generateSessionReportHTML } from '../utils/pdfGenerator';
import { TallySession, Customer } from '../types';
import { usePlant } from '../contexts/PlantContext';
import { usePermissions } from '../utils/usePermissions';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate, formatDateTime } from '../utils/dateFormat';

const ExportScreen = () => {
  const { activePlantId } = usePlant();
  const { hasPermission } = usePermissions();
  const { timezone } = useTimezone();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters state
  const [filterCustomerId, setFilterCustomerId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(''); // Default to all statuses
  
  // Sort state
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    if (!activePlantId) return;
    
    try {
      setLoading(true);
      const [sessionsRes, customersRes] = await Promise.all([
        tallySessionsApi.getAll({ plant_id: activePlantId }),
        customersApi.getAll(),
      ]);
      
      setSessions(sessionsRes.data);
      setCustomers(customersRes.data);
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
      fetchData();
    } else {
      setSessions([]);
      setCustomers([]);
      setLoading(false);
    }
  }, [activePlantId, fetchData]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...sessions];

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
    // Reset selection when filters change
    setSelectedSessionIds([]);
  }, [sessions, filterCustomerId, filterStatus, sortBy, sortOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
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

  const handleExport = async () => {
    if (selectedSessionIds.length === 0) {
      Alert.alert('No Selection', 'Please select at least one session to export.');
      return;
    }

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
              <Text style={styles.itemCustomer}>
                {getCustomerName(item.customer_id)} - Order #{item.session_number} - {formatDate(item.date, timezone)}
              </Text>
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
        <Text style={styles.emptyText}>Please select an active plant in Settings to export sessions.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Export Sessions</Text>
        <View style={styles.headerActions}>
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
          <Text style={styles.emptyStateSubtext}>Try adjusting your filters to see more results.</Text>
          <TouchableOpacity 
            style={styles.adjustFiltersButton}
            onPress={() => setShowFilters(true)}
          >
            <Text style={styles.adjustFiltersButtonText}>Adjust Filters</Text>
          </TouchableOpacity>
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

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>{selectedSessionIds.length} selected</Text>
        {/* Only show export button if user has permission */}
        {hasPermission('can_export_data') ? (
          <TouchableOpacity 
            style={[styles.exportButton, (selectedSessionIds.length === 0 || exporting) && styles.disabledButton]} 
            onPress={handleExport}
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
    paddingBottom: 80,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  itemDate: {
    fontSize: 14,
    color: '#666',
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
});

export default ExportScreen;
