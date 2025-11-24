import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { tallySessionsApi, customersApi } from '../services/api';
import type { TallySession, Customer } from '../types';
import { useResponsive } from '../utils/responsive';
import { getActiveSessions } from '../utils/activeSessions';
import TallyScreen from './TallyScreen';
import { usePlant } from '../contexts/PlantContext';
import { MaterialIcons } from '@expo/vector-icons';

function TallyTabScreen() {
  const responsive = useResponsive();
  const { activePlantId } = usePlant();
  const navigation = useNavigation<any>();
  const [activeSessionIds, setActiveSessionIds] = useState<number[]>([]);
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tallyMode, setTallyMode] = useState<'dressed' | 'byproduct'>('dressed');
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Load active sessions and their data
  const loadActiveSessions = async () => {
    try {
      setLoading(true);
      const activeIds = await getActiveSessions();
      setActiveSessionIds(activeIds);

      if (activeIds.length === 0) {
        setSessions([]);
        setSelectedSessionId(null);
        setLoading(false);
        return;
      }

      // Fetch sessions and customers in parallel
      const [sessionsRes, customersRes] = await Promise.all([
        Promise.all(activeIds.map(id => tallySessionsApi.getById(id).catch(() => null))),
        customersApi.getAll(),
      ]);

      // Filter out any null results (sessions that no longer exist)
      const validSessions = sessionsRes
        .filter((res): res is { data: TallySession } => res !== null)
        .map(res => res.data)
        .filter(session => !activePlantId || session.plant_id === activePlantId); // Filter by active plant if set

      setSessions(validSessions);
      setCustomers(customersRes.data);

      // If selected session is no longer in active sessions, clear selection
      if (selectedSessionId && !validSessions.find(s => s.id === selectedSessionId)) {
        setSelectedSessionId(null);
      }

      // Auto-select first session if none selected and we have sessions
      if (!selectedSessionId && validSessions.length > 0) {
        setSelectedSessionId(validSessions[0].id);
      }
    } catch (error) {
      console.error('Error loading active sessions:', error);
      Alert.alert('Error', 'Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveSessions();
  }, [activePlantId]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadActiveSessions();
    }, [activePlantId])
  );

  // Toggle bottom tab bar visibility when in focus mode (per-screen tabBarStyle)
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isFocusMode ? { display: 'none' } : undefined,
    });
  }, [navigation, isFocusMode]);

  const getCustomerName = (customerId: number) => {
    return customers.find((c) => c.id === customerId)?.name || `Customer ${customerId}`;
  };

  const handleSessionSelect = (sessionId: number) => {
    setSelectedSessionId(sessionId);
  };

  const dynamicStyles = {
    container: {
      ...styles.container,
    },
    header: {
      ...styles.header,
      padding: responsive.padding.medium,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    title: {
      ...styles.title,
      fontSize: responsive.fontSize.large,
    },
    modeToggleContainer: {
      flexDirection: 'row' as const,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 999,
      padding: 2,
    },
    modeButton: {
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
      borderRadius: 999,
      minWidth: responsive.isTablet ? 90 : 80,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    modeButtonActive: {
      backgroundColor: '#fff',
    },
    modeButtonText: {
      color: '#ecf0f1',
      fontSize: responsive.fontSize.small,
      fontWeight: '600' as const,
    },
    modeButtonTextActive: {
      color: '#2c3e50',
    },
    focusButton: {
      marginLeft: responsive.spacing.sm,
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#ecf0f1',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: 'transparent',
    },
    focusButtonActive: {
      backgroundColor: '#ecf0f1',
      borderColor: '#fff',
    },
    focusButtonText: {
      color: '#ecf0f1',
      fontSize: responsive.fontSize.small,
      fontWeight: '600' as const,
    },
    focusButtonTextActive: {
      color: '#2c3e50',
    },
    contentRow: {
      flex: 1,
      flexDirection: 'row',
    },
    sessionsSidebar: {
      width: responsive.isTablet ? 200 : 150,
      backgroundColor: '#ecf0f1',
      borderRightWidth: 1,
      borderRightColor: '#bdc3c7',
    },
    sessionsContainer: {
      ...styles.sessionsContainer,
      padding: responsive.padding.small,
    },
    sessionButton: {
      ...styles.sessionButton,
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.sm,
      minHeight: responsive.isTablet ? 50 : 45,
      marginBottom: responsive.spacing.sm,
    },
    sessionButtonSelected: {
      ...styles.sessionButtonSelected,
    },
    sessionButtonText: {
      ...styles.sessionButtonText,
      fontSize: responsive.fontSize.medium,
    },
    sessionButtonTextSelected: {
      ...styles.sessionButtonTextSelected,
    },
    emptyContainer: {
      ...styles.emptyContainer,
      padding: responsive.padding.large,
    },
    emptyText: {
      ...styles.emptyText,
      fontSize: responsive.fontSize.medium,
    },
    tallyContainer: {
      flex: 1,
    },
  };

  if (loading) {
    return (
      <SafeAreaView style={[dynamicStyles.container, styles.centered]} edges={Platform.OS === 'android' ? ['top'] : []}>
        <ActivityIndicator size="large" color="#3498db" />
      </SafeAreaView>
    );
  }

  if (activeSessionIds.length === 0 || sessions.length === 0) {
    return (
      <SafeAreaView style={[dynamicStyles.container, styles.centered]} edges={Platform.OS === 'android' ? ['top'] : []}>
        <View style={dynamicStyles.emptyContainer}>
          <Text style={dynamicStyles.emptyText}>
            No active sessions found.{'\n\n'}
            Go to the Sessions tab to mark sessions as active (up to 10 sessions).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={Platform.OS === 'android' ? ['top'] : []}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Active Sessions</Text>
        <View style={dynamicStyles.modeToggleContainer}>
          <TouchableOpacity
            style={[
              dynamicStyles.modeButton,
              tallyMode === 'dressed' && dynamicStyles.modeButtonActive,
            ]}
            onPress={() => setTallyMode('dressed')}
          >
            <Text
              style={[
                dynamicStyles.modeButtonText,
                tallyMode === 'dressed' && dynamicStyles.modeButtonTextActive,
              ]}
            >
              Dressed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dynamicStyles.modeButton,
              tallyMode === 'byproduct' && dynamicStyles.modeButtonActive,
            ]}
            onPress={() => setTallyMode('byproduct')}
          >
            <Text
              style={[
                dynamicStyles.modeButtonText,
                tallyMode === 'byproduct' && dynamicStyles.modeButtonTextActive,
              ]}
            >
              Byproduct
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dynamicStyles.focusButton,
              isFocusMode && dynamicStyles.focusButtonActive,
            ]}
            onPress={() => setIsFocusMode((prev) => !prev)}
          >
            <MaterialIcons
              name={isFocusMode ? 'lock-open' : 'lock'}
              size={responsive.isTablet ? 20 : 18}
              color={isFocusMode ? '#2c3e50' : '#ecf0f1'}
            />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={dynamicStyles.contentRow}>
        {/* Left side: Active sessions buttons */}
        <View style={dynamicStyles.sessionsSidebar}>
          <ScrollView 
            showsVerticalScrollIndicator={true}
            style={styles.sessionsScrollView}
            contentContainerStyle={dynamicStyles.sessionsContainer}
          >
            {sessions.map((session) => {
              const isSelected = selectedSessionId === session.id;
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[
                    dynamicStyles.sessionButton,
                    isSelected && dynamicStyles.sessionButtonSelected,
                  ]}
                  onPress={() => handleSessionSelect(session.id)}
                >
                  <Text
                    style={[
                      dynamicStyles.sessionButtonText,
                      isSelected && dynamicStyles.sessionButtonTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {getCustomerName(session.customer_id)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right side: Tally UI */}
        {selectedSessionId && (
          <View style={dynamicStyles.tallyContainer}>
            <TallyScreen
              sessionId={selectedSessionId}
              tallyRole="tally"
              tallyMode={tallyMode}
              hideTitle={true}
              disableSafeArea={true}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#2c3e50',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  sessionsScrollView: {
    flex: 1,
  },
  sessionsContainer: {
    flexGrow: 1,
  },
  sessionButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#bdc3c7',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sessionButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  sessionButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'center',
  },
  sessionButtonTextSelected: {
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default TallyTabScreen;

