import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { tallySessionsApi, exportApi, customersApi } from '../services/api';
import { generateSessionReportHTML } from '../utils/pdfGenerator';
import { TallySession, Customer } from '../types';

const ExportScreen = () => {
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionsRes, customersRes] = await Promise.all([
        tallySessionsApi.getAll(),
        customersApi.getAll(),
      ]);
      
      // Sort sessions by date desc
      const sortedSessions = sessionsRes.data.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setSessions(sortedSessions);
      setCustomers(customersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to fetch sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (selectedSessionIds.length === sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map(s => s.id));
    }
  };

  const handleExport = async () => {
    if (selectedSessionIds.length === 0) {
      Alert.alert('No Selection', 'Please select at least one session to export.');
      return;
    }

    try {
      setExporting(true);
      
      // Fetch export data
      const response = await exportApi.exportSessions({
        session_ids: selectedSessionIds
      });

      // Generate HTML
      const html = generateSessionReportHTML(response.data);

      // Generate PDF
      const { uri } = await printToFileAsync({
        html,
        base64: false
      });

      // Share PDF
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

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
            <Text style={styles.itemCustomer}>{getCustomerName(item.customer_id)}</Text>
            <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
            <Text style={styles.itemStatus}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Export Sessions</Text>
        <TouchableOpacity onPress={selectAll}>
          <Text style={styles.selectAllText}>
            {selectedSessionIds.length === sessions.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.selectionCount}>{selectedSessionIds.length} selected</Text>
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  itemCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  itemStatus: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
});

export default ExportScreen;

