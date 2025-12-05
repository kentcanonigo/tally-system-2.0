import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { tallySessionsApi, customersApi, exportApi } from '../services/api';
import type { TallySession, Customer } from '../types';
import { useResponsive } from '../utils/responsive';
import { getActiveSessions, removeActiveSession } from '../utils/activeSessions';
import TallyScreen from './TallyScreen';
import { usePlant } from '../contexts/PlantContext';
import { MaterialIcons } from '@expo/vector-icons';
import { usePermissions } from '../utils/usePermissions';
import { generateSessionReportHTML } from '../utils/pdfGenerator';

// Minimum width for the numpad area before switching to vertical layout
const MIN_NUMPAD_WIDTH = 600;

function TallyTabScreen() {
  const responsive = useResponsive();
  const { activePlantId } = usePlant();
  const navigation = useNavigation<any>();
  const { hasPermission } = usePermissions();
  const [activeSessionIds, setActiveSessionIds] = useState<number[]>([]);
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tallyMode, setTallyMode] = useState<'dressed' | 'byproduct'>('dressed');
  const [tallyRole, setTallyRole] = useState<'tally' | 'dispatcher'>('tally');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportTypeModal, setShowExportTypeModal] = useState(false);
  const [exportSessionIds, setExportSessionIds] = useState<number[]>([]);
  const [exportTitle, setExportTitle] = useState('');
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Calculate sidebar width and determine layout mode
  const sidebarWidth = responsive.isTablet ? 200 : 150;
  const availableNumpadWidth = responsive.width - sidebarWidth;
  const useVerticalLayout = availableNumpadWidth < MIN_NUMPAD_WIDTH;

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
        Promise.all(activeIds.map(async (id) => {
          try {
            return { id, data: await tallySessionsApi.getById(id) };
          } catch (error: any) {
            // Track which IDs failed (404 or other errors)
            if (error.response?.status === 404) {
              return { id, data: null, notFound: true };
            }
            return { id, data: null };
          }
        })),
        customersApi.getAll(),
      ]);

      // Separate valid sessions from invalid ones
      const validSessionData: TallySession[] = [];
      const invalidSessionIds: number[] = [];

      sessionsRes.forEach((res) => {
        if (res.data && res.data.data) {
          const session = res.data.data;
          // Only include sessions that match the active plant filter
          if (!activePlantId || session.plant_id === activePlantId) {
            validSessionData.push(session);
          }
          // Note: If session exists but doesn't match plant filter, we keep it in storage
          // since it might be valid for other plants
        } else if (res.notFound) {
          // Session doesn't exist (404) - remove from storage
          invalidSessionIds.push(res.id);
        }
      });

      // Remove invalid session IDs from AsyncStorage
      if (invalidSessionIds.length > 0) {
        await Promise.all(invalidSessionIds.map(id => removeActiveSession(id)));
        // Update active session IDs state to reflect removal
        const remainingIds = activeIds.filter(id => !invalidSessionIds.includes(id));
        setActiveSessionIds(remainingIds);
      }

      setSessions(validSessionData);
      setCustomers(customersRes.data);

      // If selected session is no longer in active sessions, clear selection
      if (selectedSessionId && !validSessionData.find(s => s.id === selectedSessionId)) {
        setSelectedSessionId(null);
      }

      // Auto-select first session if none selected and we have sessions
      if (!selectedSessionId && validSessionData.length > 0) {
        setSelectedSessionId(validSessionData[0].id);
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

  const handleRemoveCurrentSession = async () => {
    if (!selectedSessionId) return;

    try {
      await removeActiveSession(selectedSessionId);
      
      // Find the next available session
      const remainingSessions = sessions.filter(s => s.id !== selectedSessionId);
      
      if (remainingSessions.length > 0) {
        // Select the first remaining session
        setSelectedSessionId(remainingSessions[0].id);
      } else {
        setSelectedSessionId(null);
      }
      
      // Update local state
      setActiveSessionIds(prev => prev.filter(id => id !== selectedSessionId));
      setSessions(remainingSessions);
      setShowRemoveConfirmModal(false);
    } catch (error) {
      console.error('Error removing session:', error);
      Alert.alert('Error', 'Failed to remove session from active list');
    }
  };

  const getSelectedCustomerName = () => {
    if (!selectedSessionId) return '';
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return '';
    return getCustomerName(session.customer_id);
  };

  const formatDateForFilename = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  // Step 1: Select which sessions to export, then move to type selection
  const handleSelectExportScope = (scope: 'current' | 'all') => {
    if (scope === 'current') {
      if (!selectedSessionId) {
        Alert.alert('No Session Selected', 'Please select a session to export.');
        return;
      }
      setExportSessionIds([selectedSessionId]);
      setExportTitle(getSelectedCustomerName());
    } else {
      setExportSessionIds(activeSessionIds);
      setExportTitle(`All Active Sessions (${activeSessionIds.length})`);
    }
    setShowExportModal(false);
    setShowExportTypeModal(true);
  };

  // Step 2: Export with the selected type
  const handleExportAllocationSummary = async () => {
    if (exportSessionIds.length === 0) {
      Alert.alert('No Sessions', 'There are no sessions to export.');
      return;
    }

    try {
      setIsExporting(true);

      const response = await exportApi.exportSessions({
        session_ids: exportSessionIds,
      });

      const html = generateSessionReportHTML(response.data);

      const { uri } = await printToFileAsync({
        html,
        base64: false,
      });

      const currentDate = new Date();
      const dateString = formatDateForFilename(currentDate);
      const filenamePrefix = exportSessionIds.length === 1 ? `${exportTitle} Allocation` : 'Allocation Report';
      const filename = `${filenamePrefix} (${dateString}).pdf`;

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
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExporting(false);
      setShowExportTypeModal(false);
    }
  };

  const handleExportTallySheet = () => {
    // Placeholder for future implementation
    Alert.alert('Coming Soon', 'Tally Sheet Report export will be available in a future update.');
  };

  const handleBackToScopeSelection = () => {
    setShowExportTypeModal(false);
    setShowExportModal(true);
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
      justifyContent: useVerticalLayout ? 'flex-start' as const : 'space-between' as const,
    },
    title: {
      ...styles.title,
      fontSize: responsive.fontSize.large,
    },
    headerButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(236,240,241,0.3)',
      backgroundColor: 'rgba(255,255,255,0.1)',
      gap: 6,
    },
    headerButtonActive: {
      backgroundColor: 'rgba(236,240,241,0.2)',
      borderColor: 'rgba(236,240,241,0.5)',
    },
    headerButtonText: {
      color: '#ecf0f1',
      fontSize: responsive.fontSize.small,
      fontWeight: '600' as const,
    },
    dropdownButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(236,240,241,0.3)',
      backgroundColor: 'rgba(255,255,255,0.1)',
      gap: 6,
      minWidth: responsive.isTablet ? 110 : 100,
      justifyContent: 'space-between' as const,
    },
    dropdownButtonText: {
      color: '#ecf0f1',
      fontSize: responsive.fontSize.small,
      fontWeight: '600' as const,
    },
    contentRow: {
      flex: 1,
      flexDirection: useVerticalLayout ? 'column' as const : 'row' as const,
    },
    // Vertical layout: horizontal session bar at top
    sessionsTopBar: {
      backgroundColor: '#ecf0f1',
      borderBottomWidth: 1,
      borderBottomColor: '#bdc3c7',
    },
    sessionsTopBarContainer: {
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    sessionTopBarButton: {
      ...styles.sessionButton,
      paddingHorizontal: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
      minWidth: undefined,
      width: 'auto' as const,
      marginRight: responsive.spacing.sm,
      marginBottom: 0,
    },
    sessionTopBarButtonText: {
      ...styles.sessionButtonText,
      fontSize: responsive.fontSize.small,
    },
    // Horizontal layout: vertical sidebar on left
    sessionsSidebar: {
      width: sidebarWidth,
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
      <SafeAreaView style={[dynamicStyles.container, styles.centered]} edges={['top']}>
        <ActivityIndicator size="large" color="#3498db" />
      </SafeAreaView>
    );
  }

  if (!activePlantId) {
    return (
      <SafeAreaView style={[dynamicStyles.container, styles.centered]} edges={['top']}>
        <View style={dynamicStyles.emptyContainer}>
          <Text style={dynamicStyles.emptyText}>
            No active plant set
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (activeSessionIds.length === 0 || sessions.length === 0) {
    return (
      <SafeAreaView style={[dynamicStyles.container, styles.centered]} edges={['top']}>
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
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        {!useVerticalLayout && <Text style={dynamicStyles.title}>Active Sessions</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: responsive.spacing.sm }}>
          {/* Remove current session button */}
          {selectedSessionId && (
            <TouchableOpacity
              style={dynamicStyles.headerButton}
              onPress={() => setShowRemoveConfirmModal(true)}
            >
              <MaterialIcons
                name="remove-circle-outline"
                size={responsive.isTablet ? 18 : 16}
                color="#e74c3c"
              />
              {!useVerticalLayout && (
                <Text style={[dynamicStyles.headerButtonText, { color: '#e74c3c' }]}>
                  Remove
                </Text>
              )}
            </TouchableOpacity>
          )}
          {/* Export button */}
          {hasPermission('can_export_data') && (
            <TouchableOpacity
              style={dynamicStyles.headerButton}
              onPress={() => setShowExportModal(true)}
              disabled={activeSessionIds.length === 0 || isExporting}
            >
              <MaterialIcons
                name="picture-as-pdf"
                size={responsive.isTablet ? 18 : 16}
                color="#ecf0f1"
              />
              {!useVerticalLayout && (
                <Text style={dynamicStyles.headerButtonText}>Export</Text>
              )}
            </TouchableOpacity>
          )}
          {/* Mode dropdown */}
          <View>
            <TouchableOpacity
              style={dynamicStyles.dropdownButton}
              onPress={() => {
                setShowRoleDropdown(false);
                setShowModeDropdown(!showModeDropdown);
              }}
            >
              <Text style={dynamicStyles.dropdownButtonText}>
                {tallyMode === 'dressed' ? 'Dressed' : 'Byproduct'}
              </Text>
              <MaterialIcons
                name={showModeDropdown ? 'expand-less' : 'expand-more'}
                size={20}
                color="#ecf0f1"
              />
            </TouchableOpacity>
          </View>
          {/* Role dropdown */}
          <View>
            <TouchableOpacity
              style={dynamicStyles.dropdownButton}
              onPress={() => {
                setShowModeDropdown(false);
                setShowRoleDropdown(!showRoleDropdown);
              }}
            >
              <Text style={dynamicStyles.dropdownButtonText}>
                {tallyRole === 'tally' ? 'Tallyer' : 'Dispatcher'}
              </Text>
              <MaterialIcons
                name={showRoleDropdown ? 'expand-less' : 'expand-more'}
                size={20}
                color="#ecf0f1"
              />
            </TouchableOpacity>
          </View>
          {/* Focus mode button */}
          <TouchableOpacity
            style={[
              dynamicStyles.headerButton,
              isFocusMode && dynamicStyles.headerButtonActive,
            ]}
            onPress={() => setIsFocusMode((prev) => !prev)}
          >
            <MaterialIcons
              name={isFocusMode ? 'lock-open' : 'lock'}
              size={responsive.isTablet ? 18 : 16}
              color={isFocusMode ? '#2c3e50' : '#ecf0f1'}
            />
            {!useVerticalLayout && (
              <Text
                style={[
                  dynamicStyles.headerButtonText,
                  isFocusMode && { color: '#2c3e50' },
                ]}
              >
                Focus
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={dynamicStyles.contentRow}>
        {/* Vertical layout: Horizontal session bar at top */}
        {useVerticalLayout ? (
          <View style={dynamicStyles.sessionsTopBar}>
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={dynamicStyles.sessionsTopBarContainer}
            >
              {sessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      dynamicStyles.sessionTopBarButton,
                      isSelected && dynamicStyles.sessionButtonSelected,
                    ]}
                    onPress={() => handleSessionSelect(session.id)}
                  >
                    <Text
                      style={[
                        dynamicStyles.sessionTopBarButtonText,
                        isSelected && dynamicStyles.sessionButtonTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {`${getCustomerName(session.customer_id)} (#${session.session_number})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          /* Horizontal layout: Vertical sidebar on left */
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
                      {`${getCustomerName(session.customer_id)} (#${session.session_number})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Tally UI: Takes remaining space */}
        {selectedSessionId && (
          <View style={dynamicStyles.tallyContainer}>
            <TallyScreen
              sessionId={selectedSessionId}
              tallyRole={tallyRole}
              tallyMode={tallyMode}
              hideTitle={true}
              disableSafeArea={true}
            />
          </View>
        )}
      </View>

      {/* Export selection modal */}
      {hasPermission('can_export_data') && (
        <Modal
          transparent
          visible={showExportModal}
          animationType="fade"
          onRequestClose={() => setShowExportModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: responsive.padding.medium,
                width: responsive.isTablet ? 360 : '85%',
              }}
            >
              <Text
                style={{
                  fontSize: responsive.fontSize.medium,
                  fontWeight: '700',
                  color: '#2c3e50',
                  marginBottom: responsive.spacing.sm,
                }}
              >
                Select Sessions to Export
              </Text>
              <Text
                style={{
                  fontSize: responsive.fontSize.small,
                  color: '#7f8c8d',
                  marginBottom: responsive.spacing.md,
                }}
              >
                Choose which sessions you want to include in the export.
              </Text>

              {/* Export current session */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: responsive.spacing.sm,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 8,
                  backgroundColor: '#3498db',
                  marginBottom: responsive.spacing.sm,
                  opacity: !selectedSessionId ? 0.6 : 1,
                }}
                onPress={() => handleSelectExportScope('current')}
                disabled={!selectedSessionId}
              >
                <MaterialIcons
                  name="person"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      fontWeight: '600',
                      color: '#fff',
                    }}
                  >
                    Current Session
                  </Text>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small - 2,
                      color: 'rgba(255,255,255,0.8)',
                      marginTop: 2,
                    }}
                  >
                    Export only "{getSelectedCustomerName() || 'No session selected'}"
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color="rgba(255,255,255,0.8)"
                />
              </TouchableOpacity>

              {/* Export all active sessions */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: responsive.spacing.sm,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 8,
                  backgroundColor: '#ecf0f1',
                  marginBottom: responsive.spacing.sm,
                  opacity: activeSessionIds.length === 0 ? 0.6 : 1,
                }}
                onPress={() => handleSelectExportScope('all')}
                disabled={activeSessionIds.length === 0}
              >
                <MaterialIcons
                  name="groups"
                  size={20}
                  color="#2c3e50"
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      fontWeight: '600',
                      color: '#2c3e50',
                    }}
                  >
                    All Active Sessions ({activeSessionIds.length})
                  </Text>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small - 2,
                      color: '#7f8c8d',
                      marginTop: 2,
                    }}
                  >
                    Export all currently active sessions
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color="#7f8c8d"
                />
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  marginTop: responsive.spacing.md,
                }}
              >
                <TouchableOpacity
                  style={{
                    paddingVertical: responsive.spacing.xs,
                    paddingHorizontal: responsive.padding.small,
                    borderRadius: 6,
                    backgroundColor: '#ecf0f1',
                  }}
                  onPress={() => setShowExportModal(false)}
                  disabled={isExporting}
                >
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      color: '#2c3e50',
                      fontWeight: '600',
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Export type selection modal */}
      {hasPermission('can_export_data') && (
        <Modal
          transparent
          visible={showExportTypeModal}
          animationType="fade"
          onRequestClose={() => setShowExportTypeModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: responsive.padding.medium,
                width: responsive.isTablet ? 360 : '85%',
              }}
            >
              <Text
                style={{
                  fontSize: responsive.fontSize.medium,
                  fontWeight: '700',
                  color: '#2c3e50',
                  marginBottom: responsive.spacing.xs,
                }}
              >
                Choose Export Type
              </Text>
              <Text
                style={{
                  fontSize: responsive.fontSize.small - 2,
                  color: '#3498db',
                  marginBottom: responsive.spacing.md,
                  fontWeight: '500',
                }}
              >
                Exporting: {exportTitle}
              </Text>

              {/* Allocation Summary */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: responsive.spacing.sm,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 8,
                  backgroundColor: '#27ae60',
                  marginBottom: responsive.spacing.sm,
                  opacity: isExporting ? 0.6 : 1,
                }}
                onPress={handleExportAllocationSummary}
                disabled={isExporting}
              >
                <MaterialIcons
                  name="description"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      fontWeight: '600',
                      color: '#fff',
                    }}
                  >
                    Allocation Summary
                  </Text>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small - 2,
                      color: 'rgba(255,255,255,0.8)',
                      marginTop: 2,
                    }}
                  >
                    Weight classifications and bag allocations
                  </Text>
                </View>
                {isExporting && (
                  <ActivityIndicator size="small" color="#fff" />
                )}
              </TouchableOpacity>

              {/* Tally Sheet Report (Placeholder) */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: responsive.spacing.sm,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 8,
                  backgroundColor: '#ecf0f1',
                  marginBottom: responsive.spacing.sm,
                  opacity: 0.6,
                }}
                onPress={handleExportTallySheet}
                disabled={true}
              >
                <MaterialIcons
                  name="list-alt"
                  size={20}
                  color="#2c3e50"
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      fontWeight: '600',
                      color: '#2c3e50',
                    }}
                  >
                    Tally Sheet Report
                  </Text>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small - 2,
                      color: '#7f8c8d',
                      marginTop: 2,
                    }}
                  >
                    Coming soon
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: '#f39c12',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: '#fff',
                      fontWeight: '600',
                    }}
                  >
                    SOON
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: responsive.spacing.md,
                }}
              >
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: responsive.spacing.xs,
                    paddingHorizontal: responsive.padding.small,
                    borderRadius: 6,
                    backgroundColor: '#ecf0f1',
                  }}
                  onPress={handleBackToScopeSelection}
                  disabled={isExporting}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={18}
                    color="#2c3e50"
                  />
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      color: '#2c3e50',
                      fontWeight: '600',
                    }}
                  >
                    Back
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingVertical: responsive.spacing.xs,
                    paddingHorizontal: responsive.padding.small,
                    borderRadius: 6,
                    backgroundColor: '#ecf0f1',
                  }}
                  onPress={() => setShowExportTypeModal(false)}
                  disabled={isExporting}
                >
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small,
                      color: '#2c3e50',
                      fontWeight: '600',
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Remove session confirmation modal */}
      <Modal
        transparent
        visible={showRemoveConfirmModal}
        animationType="fade"
        onRequestClose={() => setShowRemoveConfirmModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: responsive.padding.medium,
              width: responsive.isTablet ? 360 : '85%',
            }}
          >
            <Text
              style={{
                fontSize: responsive.fontSize.medium,
                fontWeight: '700',
                color: '#2c3e50',
                marginBottom: responsive.spacing.sm,
              }}
            >
              Remove from Active Sessions?
            </Text>
            <Text
              style={{
                fontSize: responsive.fontSize.small,
                color: '#7f8c8d',
                marginBottom: responsive.spacing.md,
              }}
            >
              Are you sure you want to remove "{getSelectedCustomerName()}" from active sessions? You can re-add it later from the Sessions tab.
            </Text>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: responsive.spacing.sm,
              }}
            >
              <TouchableOpacity
                style={{
                  paddingVertical: responsive.spacing.xs,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 6,
                  backgroundColor: '#ecf0f1',
                }}
                onPress={() => setShowRemoveConfirmModal(false)}
              >
                <Text
                  style={{
                    fontSize: responsive.fontSize.small,
                    color: '#2c3e50',
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: responsive.spacing.xs,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 6,
                  backgroundColor: '#e74c3c',
                }}
                onPress={handleRemoveCurrentSession}
              >
                <Text
                  style={{
                    fontSize: responsive.fontSize.small,
                    color: '#fff',
                    fontWeight: '600',
                  }}
                >
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mode Dropdown Modal */}
      <Modal
        transparent
        visible={showModeDropdown}
        animationType="fade"
        onRequestClose={() => setShowModeDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowModeDropdown(false)}
        >
          <View
            style={[
              styles.dropdownMenu,
              {
                width: responsive.isTablet ? 200 : 180,
                maxHeight: 200,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                tallyMode === 'dressed' && styles.dropdownOptionSelected,
                { padding: responsive.padding.medium },
              ]}
              onPress={() => {
                setTallyMode('dressed');
                setShowModeDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  tallyMode === 'dressed' && styles.dropdownOptionTextSelected,
                  { fontSize: responsive.fontSize.small },
                ]}
              >
                Dressed
              </Text>
              {tallyMode === 'dressed' && (
                <MaterialIcons name="check" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                styles.dropdownOptionLast,
                tallyMode === 'byproduct' && styles.dropdownOptionSelected,
                { padding: responsive.padding.medium },
              ]}
              onPress={() => {
                setTallyMode('byproduct');
                setShowModeDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  tallyMode === 'byproduct' && styles.dropdownOptionTextSelected,
                  { fontSize: responsive.fontSize.small },
                ]}
              >
                Byproduct
              </Text>
              {tallyMode === 'byproduct' && (
                <MaterialIcons name="check" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Role Dropdown Modal */}
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
            style={[
              styles.dropdownMenu,
              {
                width: responsive.isTablet ? 200 : 180,
                maxHeight: 200,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                tallyRole === 'tally' && styles.dropdownOptionSelected,
                { padding: responsive.padding.medium },
              ]}
              onPress={() => {
                setTallyRole('tally');
                setShowRoleDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  tallyRole === 'tally' && styles.dropdownOptionTextSelected,
                  { fontSize: responsive.fontSize.small },
                ]}
              >
                Tallyer
              </Text>
              {tallyRole === 'tally' && (
                <MaterialIcons name="check" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                styles.dropdownOptionLast,
                tallyRole === 'dispatcher' && styles.dropdownOptionSelected,
                { padding: responsive.padding.medium },
              ]}
              onPress={() => {
                setTallyRole('dispatcher');
                setShowRoleDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  tallyRole === 'dispatcher' && styles.dropdownOptionTextSelected,
                  { fontSize: responsive.fontSize.small },
                ]}
              >
                Dispatcher
              </Text>
              {tallyRole === 'dispatcher' && (
                <MaterialIcons name="check" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  dropdownOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default TallyTabScreen;

