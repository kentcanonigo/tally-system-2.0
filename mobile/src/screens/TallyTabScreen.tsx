import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, ScrollView, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { tallySessionsApi, customersApi, exportApi, allocationDetailsApi, tallyLogEntriesApi } from '../services/api';
import type { TallySession, Customer } from '../types';
import { TallySessionStatus, TallyLogEntryRole } from '../types';
import { useResponsive } from '../utils/responsive';
import { getActiveSessions, removeActiveSession, setActiveSessions, getSelectedSessionId, setSelectedSessionId as persistSelectedSessionId } from '../utils/activeSessions';
import TallyScreen from './TallyScreen';
import { usePlant } from '../contexts/PlantContext';
import { MaterialIcons } from '@expo/vector-icons';
import { usePermissions } from '../utils/usePermissions';
import { generateSessionReportHTML } from '../utils/pdfGenerator';
import { generateTallySheetHTML } from '../utils/tallySheetPdfGenerator';
import { generateTallySheetExcel } from '../utils/tallySheetExcelGenerator';
import { colors } from '../theme/colors';

// Minimum width for the numpad area before switching to vertical layout
const MIN_NUMPAD_WIDTH = 600;

function TallyTabScreen() {
  const responsive = useResponsive();
  const { activePlantId } = usePlant();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { hasPermission, user } = usePermissions();
  const [activeSessionIds, setActiveSessionIds] = useState<number[]>([]);
  const [sessions, setSessions] = useState<TallySession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tallyMode, setTallyMode] = useState<'dressed' | 'byproduct' | 'frozen'>('dressed');
  const canTallyAsTallyer = hasPermission('can_tally_as_tallyer');
  const canTallyAsDispatcher = hasPermission('can_tally_as_dispatcher');
  
  // Set default role based on available permissions
  const defaultRole = canTallyAsTallyer ? 'tally' : (canTallyAsDispatcher ? 'dispatcher' : 'tally');
  const [tallyRole, setTallyRole] = useState<'tally' | 'dispatcher'>(defaultRole);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportTypeModal, setShowExportTypeModal] = useState(false);
  const [exportSessionIds, setExportSessionIds] = useState<number[]>([]);
  const [exportTitle, setExportTitle] = useState('');
  const [exportRole, setExportRole] = useState<TallyLogEntryRole>(TallyLogEntryRole.TALLY);
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  
  // Update role if permissions change and current role is not allowed
  useEffect(() => {
    // If user has neither permission, default to 'tally' (will be disabled anyway)
    if (!canTallyAsTallyer && !canTallyAsDispatcher) {
      setTallyRole('tally');
      setShowRoleDropdown(false); // Close dropdown if no permissions
      return;
    }
    
    // Close dropdown if it's open but user doesn't have permission for current role
    if (showRoleDropdown) {
      if (tallyRole === 'tally' && !canTallyAsTallyer) {
        setShowRoleDropdown(false);
      } else if (tallyRole === 'dispatcher' && !canTallyAsDispatcher) {
        setShowRoleDropdown(false);
      }
    }
    
    // If current role is 'tally' but user doesn't have permission, switch to dispatcher if available
    if (tallyRole === 'tally' && !canTallyAsTallyer && canTallyAsDispatcher) {
      setTallyRole('dispatcher');
    } 
    // If current role is 'dispatcher' but user doesn't have permission, switch to tally if available
    else if (tallyRole === 'dispatcher' && !canTallyAsDispatcher && canTallyAsTallyer) {
      setTallyRole('tally');
    }
    // If current role is 'dispatcher' but user doesn't have permission and no tally permission, force to tally
    else if (tallyRole === 'dispatcher' && !canTallyAsDispatcher && !canTallyAsTallyer) {
      setTallyRole('tally');
    }
  }, [canTallyAsTallyer, canTallyAsDispatcher, tallyRole, showRoleDropdown]);
  const [showTallySheetFormatModal, setShowTallySheetFormatModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0, index: -1 });
  const isLongPressActive = useRef<Map<number, boolean>>(new Map());

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
          // Only include sessions that match the active plant filter and are ongoing
          if (!activePlantId || session.plant_id === activePlantId) {
            // Filter out non-ongoing sessions
            if (session.status === TallySessionStatus.ONGOING) {
              validSessionData.push(session);
            } else {
              // Session is not ongoing - remove from storage
              invalidSessionIds.push(res.id);
            }
          }
          // Note: If session exists but doesn't match plant filter, we keep it in storage
          // since it might be valid for other plants
        } else if (res.notFound) {
          // Session doesn't exist (404) - remove from storage
          invalidSessionIds.push(res.id);
        }
      });

      // Remove invalid session IDs (non-existent or non-ongoing) from AsyncStorage
      if (invalidSessionIds.length > 0) {
        await Promise.all(invalidSessionIds.map(id => removeActiveSession(id)));
        // Update active session IDs state to reflect removal
        const remainingIds = activeIds.filter(id => !invalidSessionIds.includes(id));
        setActiveSessionIds(remainingIds);
      }

      // Order sessions according to activeSessionIds order (respecting user's custom order)
      const orderedSessions = activeIds
        .filter(id => !invalidSessionIds.includes(id))
        .map(id => validSessionData.find(s => s.id === id))
        .filter((session): session is TallySession => session !== undefined);

      setSessions(orderedSessions);
      setCustomers(customersRes.data);

      // Check if we should restore a session from navigation params (takes priority)
      const restoreSessionId = (route.params as any)?.restoreSessionId;
      if (restoreSessionId && validSessionData.find(s => s.id === restoreSessionId)) {
        // Restore the session if it's still valid
        setSelectedSessionId(restoreSessionId);
        await persistSelectedSessionId(restoreSessionId);
        // Clear the param so it doesn't interfere with future navigations
        navigation.setParams({ restoreSessionId: undefined });
      } else {
        // Try to restore from persistent storage if no navigation param
        const persistedSessionId = await getSelectedSessionId();
        if (persistedSessionId && validSessionData.find(s => s.id === persistedSessionId)) {
          // Restore the persisted session if it's still valid
          setSelectedSessionId(persistedSessionId);
        } else {
          // If selected session is no longer in active sessions, clear selection
          if (selectedSessionId && !validSessionData.find(s => s.id === selectedSessionId)) {
            setSelectedSessionId(null);
            await persistSelectedSessionId(null);
          }

          // Auto-select first session if none selected and we have sessions
          if (!selectedSessionId && validSessionData.length > 0) {
            const firstSessionId = validSessionData[0].id;
            setSelectedSessionId(firstSessionId);
            await persistSelectedSessionId(firstSessionId);
          }
        }
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

  const handleSessionSelect = async (sessionId: number) => {
    setSelectedSessionId(sessionId);
    await persistSelectedSessionId(sessionId);
  };


  // Handle long press to activate drag mode
  const handleLongPress = useCallback((index: number, evt: any) => {
    // Activate drag mode
    isLongPressActive.current.set(index, true);
    setDraggedIndex(index);
    dragStartPos.current = {
      x: evt?.nativeEvent?.pageX || 0,
      y: evt?.nativeEvent?.pageY || 0,
      index: index,
    };
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const createPanResponder = useCallback((index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate drag if long press was detected
        if (!isLongPressActive.current.get(index) || draggedIndex !== index) {
          return false;
        }
        // Long press is active, allow dragging
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Only capture if long press is active
        if (!isLongPressActive.current.get(index) || draggedIndex !== index) {
          return false;
        }
        // Capture the gesture to prevent ScrollView from handling it
        // Only capture if movement is primarily in the drag direction
        if (useVerticalLayout) {
          // For horizontal layout, capture if horizontal movement is greater
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
        } else {
          // For vertical layout, capture if vertical movement is greater
          return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 5;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (draggedIndex === null || draggedIndex !== index) {
          return;
        }
        
        const currentPos = useVerticalLayout 
          ? evt.nativeEvent.pageX 
          : evt.nativeEvent.pageY;
        const startPos = useVerticalLayout 
          ? dragStartPos.current.x 
          : dragStartPos.current.y;
        const delta = currentPos - startPos;
        
        setDragOffset({
          x: useVerticalLayout ? gestureState.dx : 0,
          y: useVerticalLayout ? 0 : gestureState.dy,
        });
        
        // Calculate which index we should move to
        const itemSize = useVerticalLayout ? 120 : 60; // Approximate item size
        const newIndex = Math.round(delta / itemSize) + dragStartPos.current.index;
        
        if (newIndex >= 0 && newIndex < sessions.length && newIndex !== draggedIndex) {
          const newSessions = [...sessions];
          const [movedItem] = newSessions.splice(draggedIndex, 1);
          newSessions.splice(newIndex, 0, movedItem);
          setSessions(newSessions);
          setDraggedIndex(newIndex);
          dragStartPos.current.index = newIndex;
          dragStartPos.current.x = evt.nativeEvent.pageX;
          dragStartPos.current.y = evt.nativeEvent.pageY;
        }
      },
      onPanResponderRelease: async () => {
        if (draggedIndex === null || draggedIndex !== index) {
          return;
        }
        
        try {
          const newOrderedIds = sessions.map(s => s.id);
          await setActiveSessions(newOrderedIds);
          setActiveSessionIds(newOrderedIds);
        } catch (error) {
          console.error('Error reordering sessions:', error);
          loadActiveSessions();
        } finally {
          setDraggedIndex(null);
          setDragOffset({ x: 0, y: 0 });
          isLongPressActive.current.set(index, false);
        }
      },
      onPanResponderTerminate: () => {
        if (draggedIndex === index) {
          setDraggedIndex(null);
          setDragOffset({ x: 0, y: 0 });
          isLongPressActive.current.set(index, false);
        }
      },
    });
  }, [draggedIndex, sessions, useVerticalLayout, handleLongPress]);

  const handleRemoveCurrentSession = async () => {
    if (!selectedSessionId) return;

    try {
      await removeActiveSession(selectedSessionId);
      
      // Find the next available session
      const remainingSessions = sessions.filter(s => s.id !== selectedSessionId);
      
      if (remainingSessions.length > 0) {
        // Select the first remaining session
        const newSelectedId = remainingSessions[0].id;
        setSelectedSessionId(newSelectedId);
        await persistSelectedSessionId(newSelectedId);
      } else {
        setSelectedSessionId(null);
        await persistSelectedSessionId(null);
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
      if (activeSessionIds.length === 0) {
        Alert.alert('No Sessions', 'There are no active sessions to export.');
        return;
      }
      setExportSessionIds(activeSessionIds);
      setExportTitle(`All Active Sessions (${activeSessionIds.length})`);
    }
    setShowExportModal(false);
    setShowExportTypeModal(true);
  };

  // Step 2: Export with the selected type
  const handleExportAllocationSummary = async (role?: TallyLogEntryRole) => {
    if (exportSessionIds.length === 0) {
      Alert.alert('No Sessions', 'There are no sessions to export.');
      return;
    }

    try {
      setIsExporting(true);
      const selectedRole = role || exportRole;

      const response = await exportApi.exportSessions({
        session_ids: exportSessionIds,
        role: selectedRole,
      });

      const data = response.data;

      // Check if the report is empty
      if (!data.customers || data.customers.length === 0) {
        Alert.alert(
          'No Data',
          `Cannot export allocation report: No ${selectedRole === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for the selected sessions.`
        );
        return;
      }

      // Check if all customers have no items
      const hasAnyItems = data.customers.some(
        (customer: any) => customer.items && customer.items.length > 0
      );

      if (!hasAnyItems) {
        Alert.alert(
          'No Data',
          `Cannot export allocation report: No ${selectedRole === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for the selected sessions.`
        );
        return;
      }

      const html = generateSessionReportHTML(data);

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
    } catch (error: any) {
      console.error('Export error:', error);
      const selectedRole = role || exportRole;
      // Check if the error is from the backend about empty data
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      if (errorMessage.includes('No') && (errorMessage.includes('data') || errorMessage.includes('allocation'))) {
        Alert.alert(
          'No Data',
          `Cannot export allocation report: No ${selectedRole === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher'} allocation data found for the selected sessions.`
        );
      } else {
        Alert.alert('Error', `Failed to export PDF: ${errorMessage}`);
      }
    } finally {
      setIsExporting(false);
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
            const session = sessions.find(s => s.id === sessionId);
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

  const checkSessionsForTallyEntries = async (sessionIds: number[]): Promise<{ sessionsWithoutEntries: string[]; validSessionIds: number[] }> => {
    const sessionsWithoutEntries: string[] = [];
    const validSessionIds: number[] = [];
    
    try {
      // Check each session for tally log entries
      const checkPromises = sessionIds.map(async (sessionId) => {
        try {
          // Try to fetch tally log entries for this session (TALLY role only)
          const entriesRes = await tallyLogEntriesApi.getBySession(sessionId, TallyLogEntryRole.TALLY);
          const entries = entriesRes.data;
          
          if (entries.length === 0) {
            // No tally entries found - get session info for display
            const session = sessions.find(s => s.id === sessionId);
            const customer = session ? customers.find(c => c.id === session.customer_id) : null;
            const sessionName = customer ? `${customer.name} - Session #${session?.session_number || sessionId}` : `Session #${session?.session_number || sessionId}`;
            return { sessionId, hasEntries: false, sessionName };
          }
          
          return { sessionId, hasEntries: true, sessionName: null };
        } catch (error: any) {
          // If 404 or other error, assume no entries
          console.error(`Error checking tally entries for session ${sessionId}:`, error);
          const session = sessions.find(s => s.id === sessionId);
          const customer = session ? customers.find(c => c.id === session.customer_id) : null;
          const sessionName = customer ? `${customer.name} - Session #${session?.session_number || sessionId}` : `Session #${session?.session_number || sessionId}`;
          return { sessionId, hasEntries: false, sessionName };
        }
      });
      
      const results = await Promise.all(checkPromises);
      
      results.forEach(result => {
        if (result.hasEntries) {
          validSessionIds.push(result.sessionId);
        } else if (result.sessionName) {
          sessionsWithoutEntries.push(result.sessionName);
        }
      });
      
      return { sessionsWithoutEntries, validSessionIds };
    } catch (error) {
      console.error('Error checking sessions for tally entries:', error);
      // If we can't check, allow all sessions to proceed
      return { sessionsWithoutEntries: [], validSessionIds: sessionIds };
    }
  };

  const handleExportTallySheet = async (format: 'pdf' | 'excel', role?: TallyLogEntryRole) => {
    if (exportSessionIds.length === 0) {
      Alert.alert('No Sessions', 'There are no sessions to export.');
      return;
    }

    const selectedRole = role || exportRole;

    // Check for sessions without tally entries
    const { sessionsWithoutEntries, validSessionIds } = await checkSessionsForTallyEntries(exportSessionIds);
    
    if (sessionsWithoutEntries.length > 0) {
      const sessionList = sessionsWithoutEntries.join('\n• ');
      Alert.alert(
        'Sessions Without Tally Entries',
        `The following session(s) do not have any tally log entries yet:\n\n• ${sessionList}\n\nThese sessions will be excluded from the export. Do you want to proceed with exporting the remaining ${validSessionIds.length} session(s)?`,
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
            onPress: () => {
              if (validSessionIds.length === 0) {
                Alert.alert('No Valid Sessions', 'None of the selected sessions have tally entries to export.');
                setShowTallySheetFormatModal(false);
                return;
              }
              // Store valid session IDs and proceed with export
              setExportSessionIds(validSessionIds);
              performExportWithChecks(format, validSessionIds, selectedRole);
            }
          }
        ]
      );
      return;
    }

    // All sessions have entries, proceed with checks
    performExportWithChecks(format, exportSessionIds, selectedRole);
  };

  const performExportWithChecks = async (format: 'pdf' | 'excel', sessionIdsToExport: number[], role?: TallyLogEntryRole) => {
    // Check for allocation mismatches
    const { hasMismatches, mismatchedSessions } = await checkAllocationMismatches(sessionIdsToExport);
    
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
            onPress: () => performExport(format, sessionIdsToExport, role)
          }
        ]
      );
      return;
    }

    // No mismatches, proceed with export
    performExport(format, sessionIdsToExport, role);
  };

  const performExport = async (format: 'pdf' | 'excel', sessionIdsToExport?: number[], role?: TallyLogEntryRole) => {
    // Use provided session IDs or fall back to exportSessionIds
    const sessionIds = sessionIdsToExport || exportSessionIds;
    const selectedRole = role || exportRole;

    try {
      setIsExporting(true);
      setShowTallySheetFormatModal(false);
      setShowExportTypeModal(false);

      // Validate that we have valid session IDs
      if (sessionIds.length === 0) {
        Alert.alert('No Sessions', 'There are no valid sessions to export.');
        return;
      }

      const response = await exportApi.exportTallySheet({
        session_ids: sessionIds,
        role: selectedRole,
      });

      if (format === 'pdf') {
        const html = generateTallySheetHTML(response.data);
        const { uri } = await printToFileAsync({
          html,
          base64: false
        });

        const currentDate = new Date();
        const dateString = formatDateForFilename(currentDate);
        
        // Determine filename based on number of customers
        let filename: string;
        const data = response.data as any;
        if (data.customers && data.customers.length > 1) {
          // Multiple customers - use generic name with count
          filename = `Tally Sheet - Multiple Customers (${data.customers.length}) (${dateString}).pdf`;
        } else if (data.customers && data.customers.length === 1) {
          // Single customer from multi-customer response
          filename = `Tally Sheet - ${data.customers[0].customer_name} (${dateString}).pdf`;
        } else if (data.customer_name) {
          // Single customer (backward compatibility)
          filename = `Tally Sheet - ${data.customer_name} (${dateString}).pdf`;
        } else {
          // Fallback
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
    } catch (error: any) {
      console.error('Tally sheet export error:', error);
      let errorMessage = 'Failed to export tally sheet';
      const roleLabel = selectedRole === TallyLogEntryRole.TALLY ? 'Tally-er' : 'Dispatcher';
      
      if (error.response?.status === 404) {
        const detail = error.response?.data?.detail || '';
        if (detail.includes('not found')) {
          errorMessage = 'One or more sessions were not found. Please refresh and try again.';
        } else if (detail.includes('No tally entries') || detail.includes('No data')) {
          errorMessage = `The selected sessions do not have any ${roleLabel.toLowerCase()} tally entries. Please ensure sessions have ${roleLabel.toLowerCase()} data before exporting.`;
        } else {
          errorMessage = `No valid ${roleLabel.toLowerCase()} data found for export. Please ensure the selected sessions have ${roleLabel.toLowerCase()} tally entries.`;
        }
      } else if (error.response?.status === 400) {
        const detail = error.response?.data?.detail || 'Invalid request. Please try again.';
        if (detail.includes('No') && (detail.includes('data') || detail.includes('entries'))) {
          errorMessage = `Cannot export tally sheet: No ${roleLabel} data found for the selected sessions.`;
        } else {
          errorMessage = detail;
        }
      }
      
      Alert.alert('Export Error', errorMessage);
    } finally {
      setIsExporting(false);
    }
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
        <ActivityIndicator size="large" color={colors.primary} />
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
                color={colors.white}
              />
              {!useVerticalLayout && (
                <Text style={[dynamicStyles.headerButtonText, { color: colors.white }]}>
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
                {tallyMode === 'dressed' ? 'Dressed' : tallyMode === 'frozen' ? 'Frozen' : 'Byproduct'}
              </Text>
              <MaterialIcons
                name={showModeDropdown ? 'expand-less' : 'expand-more'}
                size={20}
                color="#ecf0f1"
              />
            </TouchableOpacity>
          </View>
          {/* Role dropdown - only show if user has at least one permission */}
          {(canTallyAsTallyer || canTallyAsDispatcher) && (
            <View>
              <TouchableOpacity
                style={dynamicStyles.dropdownButton}
                onPress={() => {
                  // Only open dropdown if user has at least one permission
                  if (canTallyAsTallyer || canTallyAsDispatcher) {
                    setShowModeDropdown(false);
                    setShowRoleDropdown(!showRoleDropdown);
                  }
                }}
                disabled={!canTallyAsTallyer && !canTallyAsDispatcher}
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
          )}
          {/* View Logs button - icon only */}
          {hasPermission('can_view_tally_logs') && selectedSessionId && (
            <TouchableOpacity
              style={dynamicStyles.headerButton}
              onPress={() => navigation.navigate('Sessions' as never, {
                screen: 'TallySessionLogs',
                params: { sessionId: selectedSessionId, fromTallyTab: true }
              } as never)}
            >
              <MaterialIcons
                name="list-alt"
                size={responsive.isTablet ? 18 : 16}
                color="#ecf0f1"
              />
            </TouchableOpacity>
          )}
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
              scrollEnabled={draggedIndex === null}
              scrollEventThrottle={16}
            >
              {sessions.map((session, index) => {
                const isSelected = selectedSessionId === session.id;
                const isDragging = draggedIndex === index;
                const panResponder = createPanResponder(index);
                return (
                  <Animated.View
                    key={session.id}
                    style={[
                      isDragging && {
                        transform: [
                          { translateX: dragOffset.x },
                          { translateY: dragOffset.y },
                          { scale: 1.05 },
                        ],
                        zIndex: 1000,
                        opacity: 0.8,
                      },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    <TouchableOpacity
                      style={[
                        dynamicStyles.sessionTopBarButton,
                        isSelected && dynamicStyles.sessionButtonSelected,
                      ]}
                      onPress={() => {
                        if (draggedIndex === null) {
                          handleSessionSelect(session.id);
                        }
                      }}
                      onLongPress={(evt) => {
                        if (draggedIndex === null) {
                          handleLongPress(index, evt);
                        }
                      }}
                      delayLongPress={500}
                      activeOpacity={0.7}
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
                  </Animated.View>
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
              scrollEnabled={draggedIndex === null}
              scrollEventThrottle={16}
            >
              {sessions.map((session, index) => {
                const isSelected = selectedSessionId === session.id;
                const isDragging = draggedIndex === index;
                const panResponder = createPanResponder(index);
                return (
                  <Animated.View
                    key={session.id}
                    style={[
                      isDragging && {
                        transform: [
                          { translateX: dragOffset.x },
                          { translateY: dragOffset.y },
                          { scale: 1.05 },
                        ],
                        zIndex: 1000,
                        opacity: 0.8,
                      },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    <TouchableOpacity
                      style={[
                        dynamicStyles.sessionButton,
                        isSelected && dynamicStyles.sessionButtonSelected,
                      ]}
                      onPress={() => {
                        if (draggedIndex === null) {
                          handleSessionSelect(session.id);
                        }
                      }}
                      onLongPress={(evt) => {
                        if (draggedIndex === null) {
                          handleLongPress(index, evt);
                        }
                      }}
                      delayLongPress={500}
                      activeOpacity={0.7}
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
                  </Animated.View>
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
                  backgroundColor: colors.primary,
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
                  color: colors.primary,
                  marginBottom: responsive.spacing.sm,
                  fontWeight: '500',
                }}
              >
                Exporting: {exportTitle}
              </Text>

              {/* Role Selection */}
              <View style={{ marginBottom: responsive.spacing.md }}>
                <Text
                  style={{
                    fontSize: responsive.fontSize.small,
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: responsive.spacing.xs,
                  }}
                >
                  Role
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    backgroundColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <Picker
                    selectedValue={exportRole}
                    onValueChange={(itemValue) => setExportRole(itemValue)}
                    style={{
                      color: '#2c3e50',
                    }}
                  >
                    <Picker.Item label="Tally-er" value={TallyLogEntryRole.TALLY} />
                    <Picker.Item label="Dispatcher" value={TallyLogEntryRole.DISPATCHER} />
                  </Picker>
                </View>
              </View>

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
                onPress={() => handleExportAllocationSummary(exportRole)}
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

              {/* Tally Sheet Report */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: responsive.spacing.sm,
                  paddingHorizontal: responsive.padding.small,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  marginBottom: responsive.spacing.sm,
                  opacity: isExporting ? 0.6 : 1,
                }}
                onPress={() => setShowTallySheetFormatModal(true)}
                disabled={isExporting}
              >
                <MaterialIcons
                  name="list-alt"
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
                    Tally Sheet Report
                  </Text>
                  <Text
                    style={{
                      fontSize: responsive.fontSize.small - 2,
                      color: 'rgba(255,255,255,0.8)',
                      marginTop: 2,
                    }}
                  >
                    Detailed tally entries and summaries
                  </Text>
                </View>
                {isExporting && (
                  <ActivityIndicator size="small" color="#fff" />
                )}
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

      {/* Tally Sheet Format Selection Modal */}
      {hasPermission('can_export_data') && (
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
            <View
              style={[
                styles.formatModalContent,
                {
                  width: responsive.isTablet ? 400 : '90%',
                  maxWidth: 400,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.formatModalHeader}>
                <Text style={styles.formatModalTitle}>Export Format</Text>
                <TouchableOpacity
                  onPress={() => setShowTallySheetFormatModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: 8,
                  }}
                >
                  Role
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    backgroundColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <Picker
                    selectedValue={exportRole}
                    onValueChange={(itemValue) => setExportRole(itemValue)}
                    style={{
                      color: '#2c3e50',
                    }}
                  >
                    <Picker.Item label="Tally-er" value={TallyLogEntryRole.TALLY} />
                    <Picker.Item label="Dispatcher" value={TallyLogEntryRole.DISPATCHER} />
                  </Picker>
                </View>
              </View>

              <View style={styles.formatOptionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    isExporting && styles.formatOptionDisabled,
                  ]}
                  onPress={() => handleExportTallySheet('pdf', exportRole)}
                  disabled={isExporting}
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
                  {isExporting && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    isExporting && styles.formatOptionDisabled,
                  ]}
                  onPress={() => handleExportTallySheet('excel', exportRole)}
                  disabled={isExporting}
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
                  {isExporting && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
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
                  backgroundColor: colors.primaryDark,
                }}
                onPress={handleRemoveCurrentSession}
              >
                <Text
                  style={{
                    fontSize: responsive.fontSize.small,
                    color: colors.white,
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
                tallyMode === 'frozen' && styles.dropdownOptionSelected,
                { padding: responsive.padding.medium },
              ]}
              onPress={() => {
                setTallyMode('frozen');
                setShowModeDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  tallyMode === 'frozen' && styles.dropdownOptionTextSelected,
                  { fontSize: responsive.fontSize.small },
                ]}
              >
                Frozen
              </Text>
              {tallyMode === 'frozen' && (
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

      {/* Role Dropdown Modal - only render if user has at least one permission */}
      {(canTallyAsTallyer || canTallyAsDispatcher) && (
        <Modal
          transparent
          visible={showRoleDropdown && (canTallyAsTallyer || canTallyAsDispatcher)}
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
            {canTallyAsTallyer && hasPermission('can_tally_as_tallyer') ? (
              <TouchableOpacity
                style={[
                  styles.dropdownOption,
                  tallyRole === 'tally' && styles.dropdownOptionSelected,
                  { padding: responsive.padding.medium },
                ]}
                onPress={() => {
                  // Triple-check permission before allowing role change
                  if (hasPermission('can_tally_as_tallyer')) {
                    setTallyRole('tally');
                    setShowRoleDropdown(false);
                  } else {
                    console.warn('[TallyTabScreen] Permission check failed for can_tally_as_tallyer');
                  }
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
            ) : null}
            {canTallyAsDispatcher && hasPermission('can_tally_as_dispatcher') ? (
              <TouchableOpacity
                style={[
                  styles.dropdownOption,
                  (!canTallyAsTallyer || tallyRole === 'dispatcher') && styles.dropdownOptionLast,
                  tallyRole === 'dispatcher' && styles.dropdownOptionSelected,
                  { padding: responsive.padding.medium },
                ]}
                onPress={() => {
                  // Triple-check permission before allowing role change
                  if (hasPermission('can_tally_as_dispatcher')) {
                    setTallyRole('dispatcher');
                    setShowRoleDropdown(false);
                  } else {
                    console.warn('[TallyTabScreen] Permission check failed for can_tally_as_dispatcher');
                  }
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
            ) : null}
          </View>
        </TouchableOpacity>
        </Modal>
      )}
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.white,
    borderColor: colors.primary,
  },
  sessionButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'center',
  },
  sessionButtonTextSelected: {
    color: colors.primary,
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
    backgroundColor: colors.primary,
  },
  dropdownOptionText: {
    color: '#2c3e50',
  },
  dropdownOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
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
});

export default TallyTabScreen;

