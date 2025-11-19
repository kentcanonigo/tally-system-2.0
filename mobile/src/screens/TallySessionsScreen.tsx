import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { tallySessionsApi, customersApi, plantsApi } from '../services/api';
import type { TallySession, Customer, Plant } from '../types';
import { useResponsive } from '../utils/responsive';
import { useTimezone } from '../contexts/TimezoneContext';
import { formatDate } from '../utils/dateFormat';

function TallySessionsScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasInitiallyLoaded = useRef(false);

  useEffect(() => {
    fetchData().then(() => {
      hasInitiallyLoaded.current = true;
    });
  }, []);

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
    }, [loading, refreshing])
  );

  const fetchData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [sessionsRes, customersRes, plantsRes] = await Promise.all([
        tallySessionsApi.getAll(),
        customersApi.getAll(),
        plantsApi.getAll(),
      ]);

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


  if (loading && sessions.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: {
      ...styles.container,
      alignItems: responsive.isTablet ? 'center' as const : 'stretch' as const,
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
      paddingVertical: responsive.spacing.md,
    },
    addButtonText: {
      ...styles.addButtonText,
      fontSize: responsive.fontSize.small,
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

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Tally Sessions</Text>
        <TouchableOpacity
          style={dynamicStyles.addButton}
          onPress={() => navigation.navigate('CreateTallySession' as never)}
        >
          <Text style={dynamicStyles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={`flatlist-${responsive.isLargeTablet ? 2 : 1}-columns`}
        data={sessions}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={dynamicStyles.sessionCard}
            onPress={() => navigation.navigate('TallySessionDetail' as never, { sessionId: item.id } as never)}
          >
            <View style={styles.sessionHeader}>
              <Text style={dynamicStyles.sessionId}>Session #{item.id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={dynamicStyles.sessionInfo}>{getCustomerName(item.customer_id)}</Text>
            <Text style={dynamicStyles.sessionInfo}>{getPlantName(item.plant_id)}</Text>
            <Text style={styles.sessionDate}>{formatDate(item.date, timezone)}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={dynamicStyles.list}
        numColumns={responsive.isLargeTablet ? 2 : 1}
        columnWrapperStyle={responsive.isLargeTablet ? styles.row : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  row: {
    justifyContent: 'space-between',
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    marginHorizontal: 5,
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
});

export default TallySessionsScreen;

