import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { customersApi, plantsApi, tallySessionsApi } from '../services/api';
import { useResponsive } from '../utils/responsive';
import { usePermissions } from '../utils/usePermissions';

function HomeScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { hasPermission } = usePermissions();
  const canStartTally = hasPermission('can_start_tally');
  const [stats, setStats] = useState({
    customers: 0,
    plants: 0,
    sessions: 0,
    ongoingSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const [customersRes, plantsRes, sessionsRes] = await Promise.all([
        customersApi.getAll(),
        plantsApi.getAll(),
        tallySessionsApi.getAll(),
      ]);

      const sessions = sessionsRes.data;
      const ongoingSessions = sessions.filter((s) => s.status === 'ongoing').length;

      setStats({
        customers: customersRes.data.length,
        plants: plantsRes.data.length,
        sessions: sessions.length,
        ongoingSessions,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchStats(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
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
      padding: responsive.padding.large,
    },
    title: {
      ...styles.title,
      fontSize: responsive.fontSize.xlarge,
    },
    subtitle: {
      ...styles.subtitle,
      fontSize: responsive.fontSize.medium,
    },
    statsContainer: {
      ...styles.statsContainer,
      padding: responsive.padding.medium,
      flexWrap: responsive.isLargeTablet ? 'wrap' as const : 'nowrap' as const,
    },
    statCard: {
      ...styles.statCard,
      padding: responsive.padding.large,
      margin: responsive.spacing.sm,
      minWidth: responsive.isLargeTablet ? '22%' : undefined,
      maxWidth: responsive.isLargeTablet ? '22%' : undefined,
    },
    statValue: {
      ...styles.statValue,
      fontSize: responsive.isTablet ? 40 : 32,
    },
    statLabel: {
      ...styles.statLabel,
      fontSize: responsive.fontSize.small,
    },
    button: {
      ...styles.button,
      padding: responsive.padding.medium,
      margin: responsive.padding.large,
      maxWidth: responsive.isTablet ? 400 : undefined,
      alignSelf: responsive.isTablet ? 'center' as const : 'stretch' as const,
    },
    buttonText: {
      ...styles.buttonText,
      fontSize: responsive.fontSize.medium,
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={dynamicStyles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <View style={dynamicStyles.contentWrapper}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>Tally System</Text>
          <Text style={dynamicStyles.subtitle}>Dashboard</Text>
        </View>

        {responsive.isLargeTablet ? (
          <View style={styles.statsContainer}>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>{stats.customers}</Text>
              <Text style={dynamicStyles.statLabel}>Customers</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>{stats.plants}</Text>
              <Text style={dynamicStyles.statLabel}>Plants</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>{stats.sessions}</Text>
              <Text style={dynamicStyles.statLabel}>Total Sessions</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>{stats.ongoingSessions}</Text>
              <Text style={dynamicStyles.statLabel}>Ongoing</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.statsContainer}>
              <View style={dynamicStyles.statCard}>
                <Text style={dynamicStyles.statValue}>{stats.customers}</Text>
                <Text style={dynamicStyles.statLabel}>Customers</Text>
              </View>
              <View style={dynamicStyles.statCard}>
                <Text style={dynamicStyles.statValue}>{stats.plants}</Text>
                <Text style={dynamicStyles.statLabel}>Plants</Text>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={dynamicStyles.statCard}>
                <Text style={dynamicStyles.statValue}>{stats.sessions}</Text>
                <Text style={dynamicStyles.statLabel}>Total Sessions</Text>
              </View>
              <View style={dynamicStyles.statCard}>
                <Text style={dynamicStyles.statValue}>{stats.ongoingSessions}</Text>
                <Text style={dynamicStyles.statLabel}>Ongoing</Text>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[dynamicStyles.button, !canStartTally && { backgroundColor: '#95a5a6' }]}
          onPress={() => navigation.navigate('Sessions' as never, { screen: 'CreateTallySession' } as never)}
          disabled={!canStartTally}
        >
          <Text style={dynamicStyles.buttonText}>
            {canStartTally ? 'Create New Session' : 'No Permission to Create Sessions'}
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: '#2c3e50',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    color: '#bdc3c7',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  statLabel: {
    color: '#7f8c8d',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen;

