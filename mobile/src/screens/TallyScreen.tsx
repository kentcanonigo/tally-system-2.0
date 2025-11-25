import React, { useEffect, useState, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  allocationDetailsApi,
  weightClassificationsApi,
  tallySessionsApi,
  customersApi,
  plantsApi,
  tallyLogEntriesApi,
} from '../services/api';
import type { AllocationDetails, WeightClassification, TallySession, Customer, Plant, TallyLogEntry } from '../types';
import { TallyLogEntryRole } from '../types';
import { useResponsive } from '../utils/responsive';
import { getDefaultHeadsAmount } from '../utils/settings';
import { formatDate } from '../utils/dateFormat';
import { useTimezone } from '../contexts/TimezoneContext';
import { usePermissions } from '../utils/usePermissions';

interface TallyScreenProps {
  sessionId?: number;
  tallyRole?: 'tally' | 'dispatcher';
  tallyMode?: 'dressed' | 'byproduct';
  hideTitle?: boolean; // If true, don't update navigation title
  disableSafeArea?: boolean; // If true, don't wrap with SafeAreaView (for use as child component)
}

function TallyScreen(props?: TallyScreenProps) {
  const route = useRoute();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const { timezone } = useTimezone();
  const { hasPermission } = usePermissions();
  
  // Check if user has permission to start/add tally entries
  const canStartTally = hasPermission('can_start_tally');
  
  // Use props if provided, otherwise fall back to route params
  const sessionId = props?.sessionId ?? (route.params as any)?.sessionId;
  const tallyRole = (props?.tallyRole ?? (route.params as any)?.tallyRole) as 'tally' | 'dispatcher' || 'tally';
  const tallyMode = (props?.tallyMode ?? (route.params as any)?.tallyMode) as 'dressed' | 'byproduct' || 'dressed';
  const hideTitle = props?.hideTitle ?? false;
  const disableSafeArea = props?.disableSafeArea ?? false;
  const [session, setSession] = useState<TallySession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [allocations, setAllocations] = useState<AllocationDetails[]>([]);
  const [weightClassifications, setWeightClassifications] = useState<WeightClassification[]>([]);
  const [logEntries, setLogEntries] = useState<TallyLogEntry[]>([]);
  const [tallyInput, setTallyInput] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedByproductId, setSelectedByproductId] = useState<number | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  
  // Manual input state for dressed mode
  const [showManualInput, setShowManualInput] = useState(false);
  const [selectedWeightClassId, setSelectedWeightClassId] = useState<number | null>(null);
  const [manualHeadsInput, setManualHeadsInput] = useState('15');
  const [manualWeightInput, setManualWeightInput] = useState('0');
  const [activeInputField, setActiveInputField] = useState<'weight' | 'heads' | null>(null);
  const [showWeightClassDropdown, setShowWeightClassDropdown] = useState(false);
  const [defaultHeadsAmount, setDefaultHeadsAmount] = useState<number>(15);
  
  // Refs for TextInput fields to maintain focus
  const headsInputRef = useRef<TextInput>(null);
  const weightInputRef = useRef<TextInput>(null);

  // Determine if we should use landscape layout (side by side)
  // Use landscape layout if width > height (landscape orientation) or if width >= 900 (large tablet)
  const isLandscape = responsive.width > responsive.height || responsive.width >= 900;

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
    // Load default heads amount
    getDefaultHeadsAmount().then(setDefaultHeadsAmount);
  }, [sessionId]);

  // Reset manual input state when toggle is turned off
  useEffect(() => {
    if (!showManualInput) {
      // Clear all manual input fields
      setSelectedWeightClassId(null);
      setManualHeadsInput(defaultHeadsAmount.toString());
      setManualWeightInput('0');
      setActiveInputField(null);
      // Blur any focused input fields
      headsInputRef.current?.blur();
      weightInputRef.current?.blur();
      // Reset to automatic input mode
      setTallyInput('0');
    }
  }, [showManualInput, defaultHeadsAmount]);

  // Update navigation title when data is loaded (only if not hidden)
  useLayoutEffect(() => {
    if (hideTitle) return;
    
    if (plant && customer && session) {
      const titleParts = [customer.name, `Session #${session.session_number}`, formatDate(session.date, timezone)];
      const modeText = tallyMode === 'byproduct' ? 'Byproduct' : 'Dressed';
      const roleText = tallyRole === 'tally' ? 'Tally-er' : 'Dispatcher';
      const titleText = `${titleParts.join(' - ')} (${modeText} - ${roleText})`;
      navigation.setOptions({ title: titleText });
    } else {
      const modeText = tallyMode === 'byproduct' ? 'Byproduct' : 'Dressed';
      navigation.setOptions({ title: `Tally - ${modeText} - ${tallyRole === 'tally' ? 'Tally-er' : 'Dispatcher'}` });
    }
  }, [plant, customer, session, tallyRole, tallyMode, navigation, hideTitle]);

  const fetchData = async () => {
    try {
      // First fetch the session to get plant_id and customer_id
      const sessionRes = await tallySessionsApi.getById(sessionId);
      const sessionData = sessionRes.data;
      setSession(sessionData);
      
      // Check if user has permission to view log entries
      const canViewLogs = hasPermission('can_view_tally_logs');
      
      // Fetch all required data in parallel
      const [customerRes, plantRes, allocationsRes, weightClassificationsRes] = await Promise.all([
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        allocationDetailsApi.getBySession(sessionId),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
      ]);
      
      setCustomer(customerRes.data);
      setPlant(plantRes.data);
      setAllocations(allocationsRes.data);
      setWeightClassifications(weightClassificationsRes.data);
      
      // Only fetch log entries if user has permission
      if (canViewLogs) {
        const logEntriesRes = await tallyLogEntriesApi.getBySession(sessionId);
        setLogEntries(logEntriesRes.data);
      } else {
        setLogEntries([]); // Empty array if user can't view logs
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load tally data');
    }
  };

  const findWeightClassification = (weight: number): WeightClassification | null => {
    // Priority order: regular ranges > "up" ranges > "down" ranges > catch-all
    
    // First, check regular ranges (most specific)
    for (const wc of weightClassifications) {
      if (wc.min_weight !== null && wc.max_weight !== null) {
        if (weight >= wc.min_weight && weight <= wc.max_weight) {
          return wc;
        }
      }
    }
    
    // Then check "up" ranges (less specific)
    for (const wc of weightClassifications) {
      if (wc.min_weight !== null && wc.max_weight === null) {
        if (weight >= wc.min_weight) {
          return wc;
        }
      }
    }
    
    // Then check "down" ranges (less specific)
    for (const wc of weightClassifications) {
      if (wc.min_weight === null && wc.max_weight !== null) {
        if (weight <= wc.max_weight) {
          return wc;
        }
      }
    }
    
    // Finally, check catch-all (least specific)
    const catchAll = weightClassifications.find(
      (wc) => wc.min_weight === null && wc.max_weight === null
    );
    return catchAll || null;
  };

  const getCurrentAllocation = (wcId: number): AllocationDetails | null => {
    return allocations.find((a) => a.weight_classification_id === wcId) || null;
  };

  const formatWeightRange = (wc: WeightClassification): string => {
    // For Byproduct with both weights null, show N/A
    if (wc.category === 'Byproduct' && wc.min_weight === null && wc.max_weight === null) {
      return 'N/A';
    }
    // For Dressed with both weights null, show All Sizes (catch-all)
    if (wc.min_weight === null && wc.max_weight === null) {
      return 'All Sizes';
    }
    if (wc.min_weight === null && wc.max_weight !== null) {
      return `Up to ${wc.max_weight}`;
    }
    if (wc.max_weight === null) {
      return `${wc.min_weight} and up`;
    }
    return `${wc.min_weight}-${wc.max_weight}`;
  };

  // Calculate sum of weights for a specific weight classification and role
  const getSumForWeightClassification = (wcId: number): number => {
    return logEntries
      .filter(entry => 
        entry.weight_classification_id === wcId && 
        entry.role === (tallyRole === 'tally' ? TallyLogEntryRole.TALLY : TallyLogEntryRole.DISPATCHER)
      )
      .reduce((sum, entry) => sum + entry.weight, 0);
  };

  const getTotalHeadsForWeightClassification = (wcId: number): number => {
    return logEntries
      .filter(entry => 
        entry.weight_classification_id === wcId && 
        entry.role === (tallyRole === 'tally' ? TallyLogEntryRole.TALLY : TallyLogEntryRole.DISPATCHER)
      )
      .reduce((sum, entry) => sum + (entry.heads || 0), 0);
  };

  const handleTallyNumberPress = (num: string) => {
    if (activeInputField === 'heads') {
      setManualHeadsInput((prev) => {
        if (prev === '0' || prev === '') {
          return num;
        }
        return prev + num;
      });
      // Immediately refocus to prevent blur
      requestAnimationFrame(() => {
        headsInputRef.current?.focus();
      });
    } else if (activeInputField === 'weight') {
      setManualWeightInput((prev) => {
        if (prev === '0' || prev === '') {
          return num;
        }
        return prev + num;
      });
      // Immediately refocus to prevent blur
      requestAnimationFrame(() => {
        weightInputRef.current?.focus();
      });
    } else {
      setTallyInput((prev) => {
        if (prev === '0') {
          return num;
        }
        return prev + num;
      });
    }
  };

  const handleTallyDecimal = () => {
    if (activeInputField === 'heads') {
      if (manualHeadsInput.indexOf('.') === -1) {
        setManualHeadsInput((prev) => prev + '.');
      }
      // Immediately refocus to prevent blur
      requestAnimationFrame(() => {
        headsInputRef.current?.focus();
      });
    } else if (activeInputField === 'weight') {
      if (manualWeightInput.indexOf('.') === -1) {
        setManualWeightInput((prev) => prev + '.');
      }
      // Immediately refocus to prevent blur
      requestAnimationFrame(() => {
        weightInputRef.current?.focus();
      });
    } else {
      if (tallyInput.indexOf('.') === -1) {
        setTallyInput((prev) => prev + '.');
      }
    }
  };

  const handleTallyClear = () => {
    if (activeInputField === 'heads') {
      // Clear heads to default heads amount
      setManualHeadsInput(defaultHeadsAmount.toString());
      requestAnimationFrame(() => {
        headsInputRef.current?.focus();
      });
    } else if (activeInputField === 'weight') {
      // Clear weight to 0
      setManualWeightInput('0');
      requestAnimationFrame(() => {
        weightInputRef.current?.focus();
      });
    } else {
      // Clear the main tally input (automatic mode)
      setTallyInput('0');
    }
  };

  const handleTallyBackspace = () => {
    if (activeInputField === 'heads') {
      setManualHeadsInput((prev) => {
        if (prev.length > 1) {
          return prev.slice(0, -1);
        }
        return '0';
      });
      // Immediately refocus to prevent blur
      requestAnimationFrame(() => {
        headsInputRef.current?.focus();
      });
    } else if (activeInputField === 'weight') {
      setManualWeightInput((prev) => {
        if (prev.length > 1) {
          return prev.slice(0, -1);
        }
        return '0';
      });
      // Immediately refocus to prevent blur
      requestAnimationFrame(() => {
        weightInputRef.current?.focus();
      });
    } else {
      setTallyInput((prev) => {
        if (prev.length > 1) {
          return prev.slice(0, -1);
        }
        return '0';
      });
    }
  };

  const handleTallyEnter = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    // If manual input mode is enabled, handle manual entry
    if (showManualInput) {
      if (!selectedWeightClassId) {
        Alert.alert('Error', 'Please select a weight classification');
        return;
      }

      const heads = parseFloat(manualHeadsInput);
      const weight = parseFloat(manualWeightInput);

      // Skip heads validation for byproducts (will be set to 1 automatically)
      if (!isSelectedWCByproduct && (isNaN(heads) || heads < 0)) {
        Alert.alert('Error', 'Please enter a valid heads amount');
        return;
      }

      if (isNaN(weight) || weight <= 0) {
        Alert.alert('Error', 'Please enter a valid weight');
        return;
      }

      if (!sessionId) {
        Alert.alert('Error', 'Session ID is missing');
        return;
      }

      // Check for over-allocation
      const allocation = getCurrentAllocation(selectedWeightClassId);
      
      if (!allocation || allocation.required_bags === 0) {
        const wc = weightClassifications.find((wc) => wc.id === selectedWeightClassId);
        const wcName = wc?.classification || 'this classification';
        Alert.alert(
          'No Required Allocation',
          `There is no required allocation for ${wcName}.\n\n` +
          `Are you sure you want to add this tally entry?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Yes, Add It',
              onPress: () => createManualLogEntry(),
            },
          ]
        );
        return;
      }
      
      if (allocation.required_bags > 0) {
        const currentAllocated = tallyRole === 'tally' 
          ? allocation.allocated_bags_tally 
          : allocation.allocated_bags_dispatcher;
        const newAllocated = currentAllocated + 1;
        
        if (newAllocated > allocation.required_bags) {
          const wc = weightClassifications.find((wc) => wc.id === selectedWeightClassId);
          const wcName = wc?.classification || 'this classification';
          Alert.alert(
            'Over-Allocation Warning',
            `This entry would cause over-allocation for ${wcName}.\n\n` +
            `Required: ${allocation.required_bags}\n` +
            `Current: ${currentAllocated}\n` +
            `After this entry: ${newAllocated}\n\n` +
            `Do you want to proceed?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Proceed',
                onPress: () => createManualLogEntry(),
              },
            ]
          );
          return;
        }
      }

      createManualLogEntry();

      async function createManualLogEntry() {
        setIsSubmitting(true);
        try {
          // Force heads=1 for byproducts
          const finalHeads = isSelectedWCByproduct ? 1 : heads;
          
          if (!selectedWeightClassId) {
            throw new Error('Weight classification ID is missing');
          }
          
          await tallyLogEntriesApi.create(sessionId, {
            weight_classification_id: selectedWeightClassId,
            role: tallyRole as TallyLogEntryRole,
            weight: weight,
            heads: finalHeads,
            notes: null,
          });

          // Reset manual inputs
          setSelectedWeightClassId(null);
          setManualHeadsInput('15');
          setManualWeightInput('0');
          setActiveInputField(null);

          // Refresh allocations and log entries
          const canViewLogs = hasPermission('can_view_tally_logs');
          const allocationsRes = await allocationDetailsApi.getBySession(sessionId);
          setAllocations(allocationsRes.data);
          
          if (canViewLogs) {
            const logEntriesRes = await tallyLogEntriesApi.getBySession(sessionId);
            setLogEntries(logEntriesRes.data);
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail
            || error.message
            || 'Failed to log tally entry. Please try again.';
          Alert.alert('Error', errorMessage);
        } finally {
          setIsSubmitting(false);
        }
      }
      return;
    }

    // Normal mode: handle weight-based entry
    const weight = parseFloat(tallyInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    const matchedWC = findWeightClassification(weight);
    if (!matchedWC) {
      Alert.alert('Error', 'No weight classification found for this weight');
      return;
    }

    if (!sessionId) {
      Alert.alert('Error', 'Session ID is missing');
      return;
    }

    // Check for over-allocation before proceeding
    const currentAllocation = getCurrentAllocation(matchedWC.id);
    
    // Check if there's no allocation or required_bags is 0
    if (!currentAllocation || currentAllocation.required_bags === 0) {
      Alert.alert(
        'No Required Allocation',
        `There is no required allocation for ${matchedWC.classification}.\n\n` +
        `Are you sure you want to add this tally entry?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Yes, Add It',
            onPress: () => createLogEntry(),
          },
        ]
      );
      return;
    }
    
    if (currentAllocation.required_bags > 0) {
      const currentAllocated = tallyRole === 'tally' 
        ? currentAllocation.allocated_bags_tally 
        : currentAllocation.allocated_bags_dispatcher;
      const newAllocated = currentAllocated + 1; // We increment by 1
      
      if (newAllocated > currentAllocation.required_bags) {
        // Show confirmation dialog for over-allocation
        Alert.alert(
          'Over-Allocation Warning',
          `This entry would cause over-allocation for ${matchedWC.classification}.\n\n` +
          `Required: ${currentAllocation.required_bags}\n` +
          `Current: ${currentAllocated}\n` +
          `After this entry: ${newAllocated}\n\n` +
          `Do you want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed',
              onPress: () => createLogEntry(),
            },
          ]
        );
        return;
      }
    }

    // No over-allocation, proceed directly
    // Capture the ID to avoid null check issues in nested function
    const matchedWCId = matchedWC.id;
    createLogEntry();

    async function createLogEntry() {
      setIsSubmitting(true);
      try {
        // Create log entry - this will also increment the allocation
        // Default heads to 15 when using numpad
        const defaultHeads = await getDefaultHeadsAmount();
        await tallyLogEntriesApi.create(sessionId, {
          weight_classification_id: matchedWCId,
          role: tallyRole as TallyLogEntryRole,
          weight: weight,
          heads: defaultHeads,
          notes: null,
        });

        // Reset input
        setTallyInput('0');

        // Refresh allocations and log entries to show updated counts
        const canViewLogs = hasPermission('can_view_tally_logs');
        const allocationsRes = await allocationDetailsApi.getBySession(sessionId);
        setAllocations(allocationsRes.data);
        
        if (canViewLogs) {
          const logEntriesRes = await tallyLogEntriesApi.getBySession(sessionId);
          setLogEntries(logEntriesRes.data);
        }

        // Show success feedback (optional - you can remove this if it's too much)
        // Alert.alert('Success', `Logged ${weight} for ${matchedWC.classification}`);
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail 
          || error.message 
          || 'Failed to log tally entry. Please try again.';
        
        Alert.alert('Error', errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Filter allocations based on mode: byproduct mode shows only byproducts, dressed mode shows only dressed
  const filteredAllocations = useMemo((): AllocationDetails[] => {
    if (tallyMode === 'byproduct') {
      return allocations.filter((allocation) => {
        const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
        return wc && wc.category === 'Byproduct';
      });
    } else {
      // dressed mode - show only dressed allocations
      return allocations.filter((allocation) => {
        const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
        return wc && wc.category === 'Dressed';
      });
    }
  }, [tallyMode, allocations, weightClassifications]);

  const currentWeight = parseFloat(tallyInput) || 0;
  const matchedWC = currentWeight > 0 ? findWeightClassification(currentWeight) : null;
  const currentAllocation = matchedWC ? getCurrentAllocation(matchedWC.id) : null;

  // Check if the selected weight classification (in manual mode) is a byproduct
  const selectedWC = weightClassifications.find((wc) => wc.id === selectedWeightClassId);
  const isSelectedWCByproduct = selectedWC?.category === 'Byproduct';

  // Byproduct increment function
  const handleByproductIncrement = async (wcId: number) => {
    if (isSubmitting) {
      return;
    }

    if (!sessionId) {
      Alert.alert('Error', 'Session ID is missing');
      return;
    }

    const allocation = getCurrentAllocation(wcId);
    
    // Check if there's no allocation or required_bags is 0
    if (!allocation || allocation.required_bags === 0) {
      const wc = weightClassifications.find((wc) => wc.id === wcId);
      const wcName = wc?.classification || 'this byproduct';
      Alert.alert(
        'No Required Allocation',
        `There is no required allocation for ${wcName}.\n\n` +
        `Are you sure you want to add this tally entry?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Yes, Add It',
            onPress: () => createByproductLogEntry(wcId),
          },
        ]
      );
      return;
    }
    
    if (allocation.required_bags > 0) {
      const currentAllocated = tallyRole === 'tally'
        ? allocation.allocated_bags_tally
        : allocation.allocated_bags_dispatcher;
      const newAllocated = currentAllocated + 1;

      if (newAllocated > allocation.required_bags) {
        Alert.alert(
          'Over-Allocation Warning',
          `This entry would cause over-allocation.\n\n` +
          `Required: ${allocation.required_bags}\n` +
          `Current: ${currentAllocated}\n` +
          `After this entry: ${newAllocated}\n\n` +
          `Do you want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed',
              onPress: () => createByproductLogEntry(wcId),
            },
          ]
        );
        return;
      }
    }

    createByproductLogEntry(wcId);

    async function createByproductLogEntry(wcId: number) {
      setIsSubmitting(true);
      try {
        await tallyLogEntriesApi.create(sessionId, {
          weight_classification_id: wcId,
          role: tallyRole as TallyLogEntryRole,
          weight: 1,
          notes: null,
        });

        // Refresh allocations and log entries
        const canViewLogs = hasPermission('can_view_tally_logs');
        const allocationsRes = await allocationDetailsApi.getBySession(sessionId);
        setAllocations(allocationsRes.data);
        
        if (canViewLogs) {
          const logEntriesRes = await tallyLogEntriesApi.getBySession(sessionId);
          setLogEntries(logEntriesRes.data);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail
          || error.message
          || 'Failed to log tally entry. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle quantity modal submission
  const handleQuantitySubmit = async () => {
    if (!selectedByproductId) {
      Alert.alert('Error', 'Please select a byproduct');
      return;
    }

    const quantity = parseInt(quantityInput);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!sessionId) {
      Alert.alert('Error', 'Session ID is missing');
      return;
    }

    // Check if there's no allocation or required_bags is 0
    const allocation = getCurrentAllocation(selectedByproductId);
    if (!allocation || allocation.required_bags === 0) {
      const wc = weightClassifications.find((wc) => wc.id === selectedByproductId);
      const wcName = wc?.classification || 'this byproduct';
      Alert.alert(
        'No Required Allocation',
        `There is no required allocation for ${wcName}.\n\n` +
        `Are you sure you want to add ${quantity} tally ${quantity === 1 ? 'entry' : 'entries'}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Yes, Add It',
            onPress: () => createQuantityLogEntries(quantity),
          },
        ]
      );
      return;
    }

    // Check for over-allocation before proceeding
    if (allocation.required_bags > 0) {
      const currentAllocated = tallyRole === 'tally'
        ? allocation.allocated_bags_tally
        : allocation.allocated_bags_dispatcher;
      const newAllocated = currentAllocated + quantity;

      if (newAllocated > allocation.required_bags) {
        const wc = weightClassifications.find((wc) => wc.id === selectedByproductId);
        const wcName = wc?.classification || 'this byproduct';
        Alert.alert(
          'Over-Allocation Warning',
          `Adding ${quantity} ${quantity === 1 ? 'entry' : 'entries'} would cause over-allocation for ${wcName}.\n\n` +
          `Required: ${allocation.required_bags}\n` +
          `Current: ${currentAllocated}\n` +
          `After adding ${quantity}: ${newAllocated}\n\n` +
          `Do you want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed',
              onPress: () => createQuantityLogEntries(quantity),
            },
          ]
        );
        return;
      }
    }

    // No over-allocation, proceed directly
    createQuantityLogEntries(quantity);

    async function createQuantityLogEntries(quantity: number) {
      setIsSubmitting(true);
      try {
        if (!selectedByproductId) {
          throw new Error('Byproduct ID is missing');
        }
        
        // Create log entries sequentially to avoid race conditions
        // Each entry has weight = 1, and the backend counts each entry as 1 bag
        for (let i = 0; i < quantity; i++) {
          await tallyLogEntriesApi.create(sessionId, {
            weight_classification_id: selectedByproductId,
            role: tallyRole as TallyLogEntryRole,
            weight: 1,
            notes: null,
          });
        }

        // Refresh allocations and log entries
        const canViewLogs = hasPermission('can_view_tally_logs');
        const allocationsRes = await allocationDetailsApi.getBySession(sessionId);
        setAllocations(allocationsRes.data);
        
        if (canViewLogs) {
          const logEntriesRes = await tallyLogEntriesApi.getBySession(sessionId);
          setLogEntries(logEntriesRes.data);
        }

        // Close modal and reset after state updates
        // Use setTimeout to ensure state updates are processed before closing modal
        setTimeout(() => {
          setShowQuantityModal(false);
          setSelectedByproductId(null);
          setQuantityInput('1');
        }, 0);
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail
          || error.message
          || 'Failed to log tally entries. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle manual entry for dressed mode
  const handleManualEntry = async () => {
    if (isSubmitting) {
      return;
    }

    if (!selectedWeightClassId) {
      Alert.alert('Error', 'Please select a weight classification');
      return;
    }

    const heads = parseFloat(manualHeadsInput);
    const weight = parseFloat(manualWeightInput);

    if (isNaN(heads) || heads < 0) {
      Alert.alert('Error', 'Please enter a valid heads amount');
      return;
    }

    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    if (!sessionId) {
      Alert.alert('Error', 'Session ID is missing');
      return;
    }

    // Check for over-allocation
    const allocation = getCurrentAllocation(selectedWeightClassId);
    
    if (!allocation || allocation.required_bags === 0) {
      const wc = weightClassifications.find((wc) => wc.id === selectedWeightClassId);
      const wcName = wc?.classification || 'this classification';
      Alert.alert(
        'No Required Allocation',
        `There is no required allocation for ${wcName}.\n\n` +
        `Are you sure you want to add this tally entry?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Yes, Add It',
            onPress: () => createManualLogEntry(),
          },
        ]
      );
      return;
    }
    
    if (allocation.required_bags > 0) {
      const currentAllocated = tallyRole === 'tally' 
        ? allocation.allocated_bags_tally 
        : allocation.allocated_bags_dispatcher;
      const newAllocated = currentAllocated + 1;
      
      if (newAllocated > allocation.required_bags) {
        const wc = weightClassifications.find((wc) => wc.id === selectedWeightClassId);
        const wcName = wc?.classification || 'this classification';
        Alert.alert(
          'Over-Allocation Warning',
          `This entry would cause over-allocation for ${wcName}.\n\n` +
          `Required: ${allocation.required_bags}\n` +
          `Current: ${currentAllocated}\n` +
          `After this entry: ${newAllocated}\n\n` +
          `Do you want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed',
              onPress: () => createManualLogEntry(),
            },
          ]
        );
        return;
      }
    }

    createManualLogEntry();

    async function createManualLogEntry() {
      setIsSubmitting(true);
      try {
        if (!selectedWeightClassId) {
          throw new Error('Weight classification ID is missing');
        }
        
        await tallyLogEntriesApi.create(sessionId, {
          weight_classification_id: selectedWeightClassId,
          role: tallyRole as TallyLogEntryRole,
          weight: weight,
          heads: heads,
          notes: null,
        });

        // Reset manual inputs
        setSelectedWeightClassId(null);
        setManualHeadsInput('15');
        setManualWeightInput('0');
        setActiveInputField(null);

        // Refresh allocations and log entries
        const canViewLogs = hasPermission('can_view_tally_logs');
        const allocationsRes = await allocationDetailsApi.getBySession(sessionId);
        setAllocations(allocationsRes.data);
        
        if (canViewLogs) {
          const logEntriesRes = await tallyLogEntriesApi.getBySession(sessionId);
          setLogEntries(logEntriesRes.data);
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail
          || error.message
          || 'Failed to log tally entry. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Filter weight classifications to only Dressed category for manual input
  const dressedWeightClassifications = useMemo(() => {
    return weightClassifications.filter((wc) => wc.category === 'Dressed');
  }, [weightClassifications]);

  const dynamicStyles = {
    container: {
      ...styles.container,
      padding: responsive.padding.medium,
    },
    contentContainer: {
      flexDirection: isLandscape ? ('row-reverse' as const) : ('column' as const),
      flex: isLandscape ? 1 : undefined,
      gap: responsive.spacing.md,
      padding: isLandscape ? 0 : responsive.padding.medium,
    },
    calculatorSection: {
      flex: isLandscape ? 1 : undefined,
      minHeight: isLandscape ? undefined : 400,
    },
    summarySection: {
      flex: isLandscape ? 1 : undefined,
      minHeight: isLandscape ? undefined : 300,
    },
    displayRow: {
      ...styles.displayRow,
      marginBottom: responsive.spacing.md,
      gap: responsive.spacing.sm,
    },
    displayField: {
      ...styles.displayField,
      padding: responsive.padding.small,
      paddingVertical: responsive.spacing.xs,
    },
    displayLabel: {
      ...styles.displayLabel,
      fontSize: responsive.isTablet ? 10 : 9,
      marginBottom: 2,
    },
    displayValue: {
      ...styles.displayValue,
      fontSize: responsive.fontSize.small,
    },
    weightDisplayValue: {
      ...styles.displayValue,
      fontSize: responsive.isTablet ? 18 : 16,
    },
    buttonsContainer: {
      ...styles.buttonsContainer,
      gap: responsive.spacing.md,
    },
    numberPad: {
      flex: 2,
    },
    buttonRow: {
      ...styles.buttonRow,
      marginBottom: responsive.spacing.sm,
      gap: responsive.spacing.sm,
    },
    numberButton: {
      ...styles.numberButton,
      padding: responsive.isTablet ? 24 : 20,
      minHeight: responsive.isTablet ? 70 : 60,
    },
    buttonText: {
      ...styles.buttonText,
      fontSize: responsive.isTablet ? 28 : 24,
    },
    actionButtons: {
      flex: 1,
      gap: responsive.spacing.sm,
    },
    actionButton: {
      ...styles.actionButton,
      padding: responsive.isTablet ? 24 : 20,
      minHeight: responsive.isTablet ? 70 : 60,
    },
    actionButtonText: {
      ...styles.actionButtonText,
      fontSize: responsive.isTablet ? 20 : 18,
    },
    summaryContainer: {
      ...styles.summaryContainer,
      padding: responsive.padding.medium,
    },
    summaryTitle: {
      ...styles.summaryTitle,
      fontSize: responsive.fontSize.medium,
      marginBottom: responsive.spacing.md,
    },
    summaryTable: {
      ...styles.summaryTable,
    },
    summaryHeader: {
      ...styles.summaryHeader,
      paddingVertical: responsive.padding.small,
      paddingHorizontal: responsive.padding.small,
    },
    summaryHeaderText: {
      ...styles.summaryHeaderText,
      fontSize: responsive.fontSize.small,
    },
    summaryRow: {
      ...styles.summaryRow,
      paddingVertical: responsive.padding.small,
      paddingHorizontal: responsive.padding.small,
    },
    summaryCell: {
      ...styles.summaryCell,
      fontSize: responsive.fontSize.small,
    },
  };

  // Render byproduct mode UI
  const renderByproductMode = () => (
    <View style={dynamicStyles.contentContainer}>
      <View style={dynamicStyles.summarySection}>
        <View style={dynamicStyles.summaryContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: responsive.spacing.md }}>
            <Text style={dynamicStyles.summaryTitle}>Byproducts</Text>
            <TouchableOpacity
              style={[styles.addQuantityButton, { padding: responsive.padding.small }, !canStartTally && { opacity: 0.5 }]}
              onPress={() => setShowQuantityModal(true)}
              disabled={!canStartTally}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons
                  name="add"
                  size={responsive.fontSize.small}
                  color="#fff"
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.addQuantityButtonText, { fontSize: responsive.fontSize.small }]}>
                  {canStartTally ? 'Add Quantity' : 'No Permission'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={dynamicStyles.summaryTable}>
            <View style={dynamicStyles.summaryHeader}>
              <Text style={[dynamicStyles.summaryHeaderText, { flex: 2 }]}>Classification</Text>
              <Text style={[dynamicStyles.summaryHeaderText, { flex: 2 }]}>Description</Text>
              <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.5 }]}>Count / Required</Text>
              <Text style={[dynamicStyles.summaryHeaderText, { flex: 1 }]}>Action</Text>
            </View>
            {filteredAllocations.length > 0 ? (
              filteredAllocations.map((allocation: AllocationDetails) => {
                const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                if (!wc) return null;

                // Handle case where allocated_bags might not be available (users without can_view_tally_logs)
                const allocatedBags = tallyRole === 'tally'
                  ? (allocation.allocated_bags_tally ?? 0)
                  : (allocation.allocated_bags_dispatcher ?? 0);

                const isFulfilled = allocation.required_bags > 0 && allocatedBags >= allocation.required_bags;
                const hasProgressData = 'allocated_bags_tally' in allocation;

                return (
                  <View key={allocation.id} style={dynamicStyles.summaryRow}>
                    <Text style={[dynamicStyles.summaryCell, { flex: 2 }]} numberOfLines={1}>
                      {wc.classification}
                    </Text>
                    <Text style={[dynamicStyles.summaryCell, { flex: 2 }]} numberOfLines={2}>
                      {wc.description || '-'}
                    </Text>
                    <Text style={[
                      dynamicStyles.summaryCell,
                      { flex: 1.5 },
                      isFulfilled ? { color: '#27ae60', fontWeight: '600' } : {}
                    ]}>
                      {hasProgressData ? `${allocatedBags} / ${(allocation as AllocationDetails).required_bags}` : `${(allocation as AllocationDetails).required_bags} req`}
                    </Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[styles.incrementButton, (isSubmitting || !canStartTally) && { opacity: 0.6 }]}
                        onPress={() => handleByproductIncrement(wc.id)}
                        disabled={isSubmitting || !canStartTally}
                      >
                        <Text style={styles.incrementButtonText}>{canStartTally ? '+1' : '—'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={dynamicStyles.summaryRow}>
                <Text style={[dynamicStyles.summaryCell, { flex: 1, textAlign: 'center' }]}>
                  No byproduct allocations found
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  // Render dressed mode UI (existing)
  const renderDressedMode = () => {
    const calculatorContent = (
      <>
        {/* Toggle Button and Allocated/Required Field */}
        <View style={{ marginBottom: responsive.spacing.md, flexDirection: 'row', alignItems: 'stretch', gap: responsive.spacing.sm }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ecf0f1',
              borderRadius: 8,
              padding: responsive.padding.small,
              borderWidth: 1,
              borderColor: '#bdc3c7',
              flex: 1,
              justifyContent: 'space-between',
              opacity: canStartTally ? 1 : 0.5,
            }}
            onPress={() => canStartTally && setShowManualInput(!showManualInput)}
            disabled={!canStartTally}
          >
            <Text style={{ fontSize: responsive.fontSize.small, color: '#2c3e50', fontWeight: '600' }}>
              Manual Input
            </Text>
            <View
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                backgroundColor: showManualInput ? '#27ae60' : '#95a5a6',
                justifyContent: 'center',
                alignItems: showManualInput ? 'flex-end' : 'flex-start',
                paddingHorizontal: 4,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                }}
              />
            </View>
          </TouchableOpacity>
          
            {/* Allocated/Required Field - Always visible, matching toggle height */}
          <View style={[
            {
              backgroundColor: '#ecf0f1',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#bdc3c7',
              padding: responsive.padding.small,
              flex: 1.5,
              justifyContent: 'center',
            }
          ]}>
            <Text style={[dynamicStyles.displayLabel, { marginBottom: 2 }]}>
              {hasPermission('can_view_tally_logs') ? 'Alloc / Req' : 'Required'}
            </Text>
            <Text style={[
              dynamicStyles.displayValue,
              (() => {
                const allocation: AllocationDetails | null = showManualInput && selectedWeightClassId !== null
                  ? getCurrentAllocation(selectedWeightClassId)
                  : currentAllocation;
                if (!allocation) return {};
                
                const hasProgressData = 'allocated_bags_tally' in allocation;
                if (!hasProgressData) return {};
                
                return allocation && 
                  (tallyRole === 'tally' 
                    ? allocation.allocated_bags_tally >= allocation.required_bags
                    : allocation.allocated_bags_dispatcher >= allocation.required_bags) &&
                  allocation.required_bags > 0
                    ? { color: '#27ae60' }
                    : {};
              })()
            ]}>
              {(() => {
                const allocation: AllocationDetails | null = showManualInput && selectedWeightClassId !== null
                  ? getCurrentAllocation(selectedWeightClassId)
                  : currentAllocation;
                if (!allocation) return '- / -';
                
                const hasProgressData = 'allocated_bags_tally' in allocation;
                if (!hasProgressData) {
                  return `${(allocation as AllocationDetails).required_bags}`;
                }
                
                const allocatedBags = tallyRole === 'tally' 
                  ? (allocation.allocated_bags_tally ?? 0)
                  : (allocation.allocated_bags_dispatcher ?? 0);
                return `${allocatedBags} / ${allocation.required_bags}`;
              })()}
            </Text>
          </View>
        </View>

        {showManualInput ? (
          /* Manual Input Form - Single Row Style */
          <View style={dynamicStyles.displayRow}>
            {/* Weight Input - Main Input (First Position) */}
            <View style={[
              dynamicStyles.displayField,
              {
                flex: 1.5,
                backgroundColor: activeInputField === 'weight' ? '#fff' : '#f8f9fa',
                borderWidth: 2,
                borderColor: activeInputField === 'weight' ? '#3498db' : '#bdc3c7',
                borderLeftWidth: 3,
                borderLeftColor: '#3498db',
              }
            ]}>
              <Text style={dynamicStyles.displayLabel}>Weight</Text>
              <TextInput
                ref={weightInputRef}
                style={{
                  marginTop: 2,
                  padding: 0,
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  fontSize: responsive.isTablet ? 18 : 16,
                  color: '#2c3e50',
                  fontWeight: '600',
                }}
                value={manualWeightInput}
                onChangeText={setManualWeightInput}
                onFocus={() => {
                  setActiveInputField('weight');
                  // Clear heads field focus when weight is focused
                  if (activeInputField === 'heads') {
                    headsInputRef.current?.blur();
                  }
                }}
                onBlur={() => {
                  // Don't clear activeInputField on blur - only clear when user explicitly focuses another field
                  // This prevents losing focus when numpad buttons are pressed
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#999"
              />
            </View>

            {/* Weight Classification Dropdown */}
            <View style={[
              dynamicStyles.displayField,
              {
                flex: 2,
                backgroundColor: '#f8f9fa',
                borderWidth: 2,
                borderColor: showWeightClassDropdown ? '#3498db' : '#bdc3c7',
              }
            ]}>
              <Text style={dynamicStyles.displayLabel}>Weight Classification</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}
                onPress={() => {
                  // Clear active input field when opening dropdown
                  if (activeInputField === 'heads') {
                    headsInputRef.current?.blur();
                    setActiveInputField(null);
                  } else if (activeInputField === 'weight') {
                    weightInputRef.current?.blur();
                    setActiveInputField(null);
                  }
                  setShowWeightClassDropdown(true);
                }}
              >
                <Text style={{ color: selectedWeightClassId ? '#2c3e50' : '#999', flex: 1 }} numberOfLines={1}>
                  {selectedWeightClassId
                    ? dressedWeightClassifications.find((wc) => wc.id === selectedWeightClassId)?.classification || 'Select...'
                    : 'Select...'}
                </Text>
                <Text style={{ color: '#2c3e50', fontSize: 10, marginLeft: responsive.spacing.xs }}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Heads Input - Hidden for byproducts */}
            {!isSelectedWCByproduct && (
              <View style={[
                dynamicStyles.displayField,
                {
                  flex: 1,
                  backgroundColor: activeInputField === 'heads' ? '#fff' : '#f8f9fa',
                  borderWidth: 2,
                  borderColor: activeInputField === 'heads' ? '#3498db' : '#bdc3c7',
                }
              ]}>
                <Text style={dynamicStyles.displayLabel}>Heads</Text>
                <TextInput
                  ref={headsInputRef}
                  style={{
                    marginTop: 2,
                    padding: 0,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    fontSize: responsive.fontSize.small,
                    color: '#2c3e50',
                    fontWeight: '600',
                  }}
                  value={manualHeadsInput}
                  onChangeText={setManualHeadsInput}
                  onFocus={() => {
                    setActiveInputField('heads');
                    // Clear weight field focus when heads is focused
                    if (activeInputField === 'weight') {
                      weightInputRef.current?.blur();
                    }
                  }}
                  onBlur={() => {
                    // Don't clear activeInputField on blur - only clear when user explicitly focuses another field
                    // This prevents losing focus when numpad buttons are pressed
                  }}
                  keyboardType="numeric"
                  placeholder="15"
                  placeholderTextColor="#999"
                />
              </View>
            )}
          </View>
        ) : (
          /* Three display fields in a row - Automatic mode */
          <View style={dynamicStyles.displayRow}>
            {/* Weight - Main Input (First Position) */}
            <View style={[
              dynamicStyles.displayField, 
              { 
                flex: 1.5,
                borderLeftWidth: 3,
                borderLeftColor: '#27ae60',
              }
            ]}>
              <Text style={dynamicStyles.displayLabel}>Weight</Text>
              <Text style={dynamicStyles.weightDisplayValue}>
                {tallyInput}
              </Text>
            </View>
            <View style={[dynamicStyles.displayField, { flex: 2 }]}>
              <Text style={dynamicStyles.displayLabel}>Classification</Text>
              <Text style={dynamicStyles.displayValue} numberOfLines={1}>
                {matchedWC ? matchedWC.classification : '-'}
              </Text>
            </View>
            <View style={[dynamicStyles.displayField, { flex: 1 }]}>
              <Text style={dynamicStyles.displayLabel}>Heads</Text>
              <Text style={dynamicStyles.displayValue}>
                {defaultHeadsAmount}
              </Text>
            </View>
          </View>
        )}

        {/* Calculator buttons - Always visible */}
        <View style={dynamicStyles.buttonsContainer}>
          {/* Number pad */}
          <View style={dynamicStyles.numberPad}>
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('7')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>7</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('8')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>8</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('9')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>9</Text>
              </TouchableOpacity>
            </View>
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('4')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>4</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('5')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>5</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('6')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>6</Text>
              </TouchableOpacity>
            </View>
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('1')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('2')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('3')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>3</Text>
              </TouchableOpacity>
            </View>
            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={() => handleTallyNumberPress('0')}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={handleTallyDecimal}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>.</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[dynamicStyles.numberButton, !canStartTally && { opacity: 0.5 }]} 
                onPress={handleTallyBackspace}
                activeOpacity={0.7}
                disabled={!canStartTally}
              >
                <Text style={dynamicStyles.buttonText}>⌫</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action buttons */}
          <View style={dynamicStyles.actionButtons}>
            <TouchableOpacity
              style={[dynamicStyles.actionButton, styles.clearButton, !canStartTally && { opacity: 0.5 }]}
              onPress={handleTallyClear}
              disabled={!canStartTally}
            >
              <Text style={dynamicStyles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                dynamicStyles.actionButton,
                showManualInput ? { backgroundColor: '#3498db' } : styles.enterButton,
                (isSubmitting || !canStartTally) && { opacity: 0.6 }
              ]}
              onPress={handleTallyEnter}
              disabled={isSubmitting || !canStartTally}
            >
              <Text style={dynamicStyles.actionButtonText}>
                {!canStartTally ? 'No Permission' : (isSubmitting ? 'Saving...' : (showManualInput ? 'Enter (Manual)' : 'Enter'))}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );

    return (
      <View style={dynamicStyles.contentContainer}>
        {/* Calculator Section */}
        <View style={dynamicStyles.calculatorSection}>
          {isLandscape ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
            >
              {calculatorContent}
            </ScrollView>
          ) : (
            calculatorContent
          )}
        </View>

        {/* Summary tables */}
        <View style={dynamicStyles.summarySection}>
          <View style={dynamicStyles.summaryContainer}>
            <Text style={dynamicStyles.summaryTitle}>Allocations Summary</Text>
            
            {/* Dressed Allocations Table */}
            {(() => {
              const dressedAllocations = filteredAllocations.filter((allocation) => {
                const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                return wc && wc.category === 'Dressed';
              });
              
              if (dressedAllocations.length > 0) {
                return (
                  <View style={{ marginBottom: responsive.spacing.md }}>
                    <Text style={[dynamicStyles.summaryTitle, { fontSize: responsive.fontSize.medium, marginBottom: responsive.spacing.sm, marginTop: 0 }]}>Dressed</Text>
                    <View style={dynamicStyles.summaryTable}>
                      <View style={dynamicStyles.summaryHeader}>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.2 }]}>Class</Text>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.5 }]}>Alloc / Req</Text>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1 }]}>Total Heads</Text>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.3 }]}>Total Weight</Text>
                      </View>
                      {dressedAllocations.map((allocation: AllocationDetails) => {
                        const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                        if (!wc) return null;
                        
                        const hasProgressData = 'allocated_bags_tally' in allocation;
                        const allocatedBags = tallyRole === 'tally' 
                          ? (allocation.allocated_bags_tally ?? 0)
                          : (allocation.allocated_bags_dispatcher ?? 0);
                        
                        const isFulfilled = hasProgressData && allocation.required_bags > 0 && allocatedBags >= allocation.required_bags;
                        const isOverAllocated = hasProgressData && allocation.required_bags > 0 && allocatedBags > allocation.required_bags;
                        const sum = getSumForWeightClassification(allocation.weight_classification_id);
                        const totalHeads = getTotalHeadsForWeightClassification(allocation.weight_classification_id);
                        
                        return (
                          <View key={allocation.id} style={dynamicStyles.summaryRow}>
                            <Text style={[dynamicStyles.summaryCell, { flex: 1.2 }]} numberOfLines={1}>
                              {wc.classification}
                            </Text>
                            <Text style={[
                              dynamicStyles.summaryCell, 
                              { flex: 1.5 },
                              isOverAllocated 
                                ? { color: '#e67e22', fontWeight: '600' } 
                                : isFulfilled 
                                  ? { color: '#27ae60', fontWeight: '600' } 
                                  : {}
                            ]}>
                              {hasProgressData ? `${allocatedBags} / ${(allocation as AllocationDetails).required_bags}` : `${(allocation as AllocationDetails).required_bags} req`}
                            </Text>
                            <Text style={[dynamicStyles.summaryCell, { flex: 1 }]}>
                              {hasProgressData ? totalHeads.toFixed(0) : '-'}
                            </Text>
                            <Text style={[dynamicStyles.summaryCell, { flex: 1.3 }]}>
                              {hasProgressData ? sum.toFixed(2) : '-'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              }
              return null;
            })()}
            
            {/* Byproduct Allocations Table */}
            {(() => {
              const byproductAllocations = filteredAllocations.filter((allocation) => {
                const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                return wc && wc.category === 'Byproduct';
              });
              
              if (byproductAllocations.length > 0) {
                return (
                  <View>
                    <Text style={[dynamicStyles.summaryTitle, { fontSize: responsive.fontSize.medium, marginBottom: responsive.spacing.sm, marginTop: 0 }]}>Byproduct</Text>
                    <View style={dynamicStyles.summaryTable}>
                      <View style={dynamicStyles.summaryHeader}>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.2 }]}>Class</Text>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.5 }]}>Alloc / Req</Text>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1 }]}>Total Heads</Text>
                        <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.3 }]}>Total Weight</Text>
                      </View>
                      {byproductAllocations.map((allocation: AllocationDetails) => {
                        const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                        if (!wc) return null;
                        
                        const hasProgressData = 'allocated_bags_tally' in allocation;
                        const allocatedBags = tallyRole === 'tally' 
                          ? (allocation.allocated_bags_tally ?? 0)
                          : (allocation.allocated_bags_dispatcher ?? 0);
                        
                        const isFulfilled = hasProgressData && allocation.required_bags > 0 && allocatedBags >= allocation.required_bags;
                        const isOverAllocated = hasProgressData && allocation.required_bags > 0 && allocatedBags > allocation.required_bags;
                        const sum = getSumForWeightClassification(allocation.weight_classification_id);
                        const totalHeads = getTotalHeadsForWeightClassification(allocation.weight_classification_id);
                        
                        return (
                          <View key={allocation.id} style={dynamicStyles.summaryRow}>
                            <Text style={[dynamicStyles.summaryCell, { flex: 1.2 }]} numberOfLines={1}>
                              {wc.classification}
                            </Text>
                            <Text style={[
                              dynamicStyles.summaryCell, 
                              { flex: 1.5 },
                              isOverAllocated 
                                ? { color: '#e67e22', fontWeight: '600' } 
                                : isFulfilled 
                                  ? { color: '#27ae60', fontWeight: '600' } 
                                  : {}
                            ]}>
                              {hasProgressData ? `${allocatedBags} / ${(allocation as AllocationDetails).required_bags}` : `${(allocation as AllocationDetails).required_bags} req`}
                            </Text>
                            <Text style={[dynamicStyles.summaryCell, { flex: 1 }]}>
                              {hasProgressData ? totalHeads.toFixed(0) : '-'}
                            </Text>
                            <Text style={[dynamicStyles.summaryCell, { flex: 1.3 }]}>
                              {hasProgressData ? sum.toFixed(2) : '-'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              }
              return null;
            })()}
            
            {filteredAllocations.length === 0 && (
              <View style={dynamicStyles.summaryRow}>
                <Text style={[dynamicStyles.summaryCell, { flex: 1, textAlign: 'center' }]}>
                  No allocations yet
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const content = tallyMode === 'byproduct' ? renderByproductMode() : renderDressedMode();

  const mainContent = (
    <>
      {isLandscape ? (
        content
      ) : (
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >
          {content}
        </ScrollView>
      )}

      {/* Quantity Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showQuantityModal}
        onRequestClose={() => {
          setShowQuantityModal(false);
          setSelectedByproductId(null);
          setQuantityInput('1');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: responsive.isTablet ? 400 : '90%', padding: responsive.padding.large }]}>
            <Text style={[styles.modalTitle, { fontSize: responsive.fontSize.large, marginBottom: responsive.spacing.md }]}>
              Add Quantity
            </Text>

            <Text style={[styles.modalLabel, { fontSize: responsive.fontSize.small, marginBottom: responsive.spacing.xs }]}>
              Select Byproduct:
            </Text>
            <ScrollView style={{ maxHeight: 200, marginBottom: responsive.spacing.md }}>
              {filteredAllocations.map((allocation) => {
                const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                if (!wc) return null;
                return (
                  <TouchableOpacity
                    key={allocation.id}
                    style={[
                      styles.modalOption,
                      selectedByproductId === wc.id && styles.modalOptionSelected,
                      { padding: responsive.padding.medium }
                    ]}
                    onPress={() => setSelectedByproductId(wc.id)}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      selectedByproductId === wc.id && styles.modalOptionTextSelected,
                      { fontSize: responsive.fontSize.small }
                    ]}>
                      {wc.classification} {wc.description ? `- ${wc.description}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.modalLabel, { fontSize: responsive.fontSize.small, marginBottom: responsive.spacing.xs }]}>
              Quantity:
            </Text>
            <TextInput
              style={[styles.modalInput, { padding: responsive.padding.medium, fontSize: responsive.fontSize.medium, marginBottom: responsive.spacing.lg }]}
              placeholder="Enter quantity"
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="numeric"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: responsive.spacing.sm }}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { padding: responsive.padding.medium }]}
                onPress={() => {
                  setShowQuantityModal(false);
                  setSelectedByproductId(null);
                  setQuantityInput('1');
                }}
              >
                <Text style={[styles.modalButtonText, { fontSize: responsive.fontSize.small }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalSubmitButton,
                  { padding: responsive.padding.medium },
                  isSubmitting && { opacity: 0.6 }
                ]}
                onPress={handleQuantitySubmit}
                disabled={isSubmitting}
              >
                <Text style={[styles.modalButtonText, { fontSize: responsive.fontSize.small }]}>
                  {isSubmitting ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <View 
              style={[styles.dropdownMenu, { width: responsive.isTablet ? Math.min(responsive.width * 0.6, 500) : '90%' }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={[styles.dropdownHeader, { padding: responsive.padding.medium }]}>
                <Text style={[styles.dropdownTitle, { fontSize: responsive.fontSize.large }]}>Select Weight Classification</Text>
                <TouchableOpacity
                  onPress={() => setShowWeightClassDropdown(false)}
                  style={{ padding: responsive.spacing.xs }}
                >
                  <Text style={[styles.dropdownCloseText, { fontSize: responsive.fontSize.large }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={{ maxHeight: responsive.isTablet ? 400 : 300 }}
                contentContainerStyle={{ paddingBottom: responsive.spacing.md }}
              >
                {dressedWeightClassifications.map((wc, index) => (
                  <TouchableOpacity
                    key={wc.id}
                    style={[
                      styles.dropdownOption,
                      index === dressedWeightClassifications.length - 1 && styles.dropdownOptionLast,
                      selectedWeightClassId === wc.id && styles.dropdownOptionSelected,
                      { padding: responsive.padding.medium }
                    ]}
                    onPress={() => {
                      setSelectedWeightClassId(wc.id);
                      setShowWeightClassDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selectedWeightClassId === wc.id && styles.dropdownOptionTextSelected,
                        { fontSize: responsive.fontSize.small }
                      ]}
                    >
                      {wc.classification} ({formatWeightRange(wc)})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );

  // Wrap with SafeAreaView only if not disabled (when used as child component)
  if (disableSafeArea) {
    return <View style={dynamicStyles.container}>{mainContent}</View>;
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={Platform.OS === 'android' ? ['top'] : []}>
      {mainContent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  displayRow: {
    flexDirection: 'row',
  },
  displayField: {
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  displayLabel: {
    color: '#7f8c8d',
    marginBottom: 4,
  },
  displayValue: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  buttonsContainer: {
    flexDirection: 'row',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  numberButton: {
    flex: 1,
    backgroundColor: '#34495e',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#e67e22',
  },
  enterButton: {
    backgroundColor: '#27ae60',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
  },
  summaryTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    backgroundColor: '#34495e',
    borderBottomWidth: 1,
    borderBottomColor: '#bdc3c7',
  },
  summaryHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  summaryCell: {
    color: '#2c3e50',
    paddingHorizontal: 4,
  },
  incrementButton: {
    backgroundColor: '#3498db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  incrementButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  addQuantityButton: {
    backgroundColor: '#27ae60',
    borderRadius: 6,
  },
  addQuantityButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalLabel: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  modalOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalOptionSelected: {
    backgroundColor: '#3498db',
  },
  modalOptionText: {
    color: '#2c3e50',
  },
  modalOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    backgroundColor: '#f9f9f9',
  },
  modalButton: {
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#95a5a6',
  },
  modalSubmitButton: {
    backgroundColor: '#3498db',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownTitle: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  dropdownCloseText: {
    fontSize: 20,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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

export default TallyScreen;

