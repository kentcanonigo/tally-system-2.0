import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { customersApi, plantsApi, tallySessionsApi } from '../services/api';
import { useResponsive } from '../utils/responsive';
import { usePermissions } from '../utils/usePermissions';
import { usePlant } from '../contexts/PlantContext';
import { colors } from '../theme/colors';
import { LoadingScreen } from '../components/LoadingScreen';

function HomeScreen() {
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { hasPermission } = usePermissions();
  const { activePlantId, isLoading: isPlantLoading } = usePlant();
  const canStartTally = hasPermission('can_create_tally_sessions');
  const [stats, setStats] = useState({
    customers: 0,
    activePlantName: 'None',
    sessions: 0,
    ongoingSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isPlantLoading) {
      fetchStats();
    }
  }, [activePlantId, isPlantLoading]);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // If no active plant is set, show zero stats
      if (!activePlantId) {
        setStats({
          customers: 0,
          activePlantName: 'None',
          sessions: 0,
          ongoingSessions: 0,
        });
        return;
      }

      // Fetch sessions and plants filtered by active plant
      const [sessionsRes, plantsRes] = await Promise.all([
        tallySessionsApi.getAll({ plant_id: activePlantId }),
        plantsApi.getAll(),
      ]);
      
      const sessions = sessionsRes.data;
      const ongoingSessions = sessions.filter((s) => s.status === 'ongoing').length;

      // Get unique customer IDs from sessions
      const customerIds = new Set(sessions.map((s) => s.customer_id));
      const uniqueCustomerCount = customerIds.size;

      // Get active plant name
      const activePlant = plantsRes.data.find(p => p.id === activePlantId);
      const activePlantName = activePlant?.name || 'None';

      setStats({
        customers: uniqueCustomerCount,
        activePlantName,
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

  if (loading || isPlantLoading) {
    return <LoadingScreen />;
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

        {/* Active Plant - Main Attraction */}
        <View style={[styles.activePlantContainer, { 
          paddingVertical: responsive.isTablet ? 48 : 32,
          paddingHorizontal: responsive.padding.large,
          marginTop: responsive.isTablet ? 40 : 28,
          marginHorizontal: responsive.padding.medium,
          marginBottom: responsive.spacing.lg,
          borderColor: activePlantId ? '#27ae60' : '#e74c3c',
        }]}>
          <Text style={[styles.activePlantLabel, {
            fontSize: responsive.fontSize.small,
            marginBottom: responsive.spacing.sm,
          }]}>
            ACTIVE PLANT
          </Text>
          <Text style={[styles.activePlantName, {
            fontSize: responsive.isTablet ? 48 : 36,
            color: activePlantId ? '#27ae60' : '#e74c3c',
          }]} numberOfLines={2}>
            {activePlantId ? stats.activePlantName : 'No active plant!'}
          </Text>
        </View>

        {/* Other Stats */}
        {responsive.isLargeTablet ? (
          <View style={styles.statsContainer}>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>{stats.customers}</Text>
              <Text style={dynamicStyles.statLabel}>Customers</Text>
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
          <View style={styles.statsContainer}>
            <View style={dynamicStyles.statCard}>
              <Text style={dynamicStyles.statValue}>{stats.customers}</Text>
              <Text style={dynamicStyles.statLabel}>Customers</Text>
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
        )}

        {canStartTally && (
          <TouchableOpacity
            style={dynamicStyles.button}
            onPress={() => navigation.navigate('Sessions' as never, { screen: 'CreateTallySession' } as never)}
          >
            <Text style={dynamicStyles.buttonText}>
              Create New Session
            </Text>
          </TouchableOpacity>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: colors.primary,
  },
  title: {
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
  },
  subtitle: {
    color: colors.white,
    opacity: 0.9,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
  },
  statLabel: {
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  activePlantContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.activePlantBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlantLabel: {
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  activePlantName: {
    fontWeight: 'bold',
    color: colors.activePlantBorder,
    textAlign: 'center',
  },
});

export default HomeScreen;

