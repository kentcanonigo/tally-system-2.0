import React, { useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
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

function TallyScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const sessionId = (route.params as any)?.sessionId;
  const tallyRole = (route.params as any)?.tallyRole as 'tally' | 'dispatcher';
  const tallyMode = (route.params as any)?.tallyMode as 'dressed' | 'byproduct' || 'dressed';
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

  // Determine if we should use landscape layout (side by side)
  // Use landscape layout if width > height (landscape orientation) or if width >= 900 (large tablet)
  const isLandscape = responsive.width > responsive.height || responsive.width >= 900;

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);

  // Update navigation title when data is loaded
  useLayoutEffect(() => {
    if (plant && customer && session) {
      const titleParts = [plant.name, customer.name, `Session #${session.id}`];
      const modeText = tallyMode === 'byproduct' ? 'Byproduct' : 'Dressed';
      const roleText = tallyRole === 'tally' ? 'Tally-er' : 'Dispatcher';
      const titleText = `${titleParts.join(' - ')} (${modeText} - ${roleText})`;
      navigation.setOptions({ title: titleText });
    } else {
      const modeText = tallyMode === 'byproduct' ? 'Byproduct' : 'Dressed';
      navigation.setOptions({ title: `Tally - ${modeText} - ${tallyRole === 'tally' ? 'Tally-er' : 'Dispatcher'}` });
    }
  }, [plant, customer, session, tallyRole, tallyMode, navigation]);

  const fetchData = async () => {
    try {
      // First fetch the session to get plant_id and customer_id
      const sessionRes = await tallySessionsApi.getById(sessionId);
      const sessionData = sessionRes.data;
      setSession(sessionData);
      
      // Then fetch customer, plant, allocations, weight classifications, and log entries
      const [customerRes, plantRes, allocationsRes, wcRes, logEntriesRes] = await Promise.all([
        customersApi.getById(sessionData.customer_id),
        plantsApi.getById(sessionData.plant_id),
        allocationDetailsApi.getBySession(sessionId),
        weightClassificationsApi.getByPlant(sessionData.plant_id),
        tallyLogEntriesApi.getBySession(sessionId),
      ]);
      
      setCustomer(customerRes.data);
      setPlant(plantRes.data);
      setAllocations(allocationsRes.data);
      setWeightClassifications(wcRes.data);
      setLogEntries(logEntriesRes.data);
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

  const handleTallyNumberPress = (num: string) => {
    setTallyInput((prev) => {
      if (prev === '0') {
        return num;
      }
      return prev + num;
    });
  };

  const handleTallyDecimal = () => {
    if (tallyInput.indexOf('.') === -1) {
      setTallyInput((prev) => prev + '.');
    }
  };

  const handleTallyClear = () => {
    setTallyInput('0');
  };

  const handleTallyBackspace = () => {
    setTallyInput((prev) => {
      if (prev.length > 1) {
        return prev.slice(0, -1);
      }
      return '0';
    });
  };

  const handleTallyEnter = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

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
    createLogEntry();

    async function createLogEntry() {
      setIsSubmitting(true);
      try {
        console.log('Creating tally log entry:', {
          sessionId,
          weight_classification_id: matchedWC.id,
          role: tallyRole,
          weight,
        });

        // Create log entry - this will also increment the allocation
        const response = await tallyLogEntriesApi.create(sessionId, {
          weight_classification_id: matchedWC.id,
          role: tallyRole as TallyLogEntryRole,
          weight: weight,
          notes: null,
        });

        console.log('Tally log entry created successfully:', response.data);

        // Reset input
        setTallyInput('0');

        // Refresh allocations and log entries to show updated counts
        const [allocationsRes, logEntriesRes] = await Promise.all([
          allocationDetailsApi.getBySession(sessionId),
          tallyLogEntriesApi.getBySession(sessionId),
        ]);
        setAllocations(allocationsRes.data);
        setLogEntries(logEntriesRes.data);

        // Show success feedback (optional - you can remove this if it's too much)
        // Alert.alert('Success', `Logged ${weight} for ${matchedWC.classification}`);
      } catch (error: any) {
        console.error('Error creating tally log entry:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        
        const errorMessage = error.response?.data?.detail 
          || error.message 
          || 'Failed to log tally entry. Please try again.';
        
        Alert.alert('Error', errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Filter allocations to only byproducts when in byproduct mode
  const filteredAllocations = useMemo(() => {
    if (tallyMode === 'byproduct') {
      return allocations.filter((allocation) => {
        const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
        return wc && wc.category === 'Byproduct';
      });
    }
    return allocations;
  }, [tallyMode, allocations, weightClassifications]);

  const currentWeight = parseFloat(tallyInput) || 0;
  const matchedWC = currentWeight > 0 ? findWeightClassification(currentWeight) : null;
  const currentAllocation = matchedWC ? getCurrentAllocation(matchedWC.id) : null;

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
        const [allocationsRes, logEntriesRes] = await Promise.all([
          allocationDetailsApi.getBySession(sessionId),
          tallyLogEntriesApi.getBySession(sessionId),
        ]);
        setAllocations(allocationsRes.data);
        setLogEntries(logEntriesRes.data);
      } catch (error: any) {
        console.error('Error creating byproduct log entry:', error);
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
        const [allocationsRes, logEntriesRes] = await Promise.all([
          allocationDetailsApi.getBySession(sessionId),
          tallyLogEntriesApi.getBySession(sessionId),
        ]);
        
        // Update state first
        setAllocations(allocationsRes.data);
        setLogEntries(logEntriesRes.data);

        // Close modal and reset after state updates
        // Use setTimeout to ensure state updates are processed before closing modal
        setTimeout(() => {
          setShowQuantityModal(false);
          setSelectedByproductId(null);
          setQuantityInput('1');
        }, 0);
      } catch (error: any) {
        console.error('Error creating byproduct log entries:', error);
        const errorMessage = error.response?.data?.detail
          || error.message
          || 'Failed to log tally entries. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

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
      padding: responsive.padding.medium,
    },
    displayLabel: {
      ...styles.displayLabel,
      fontSize: responsive.fontSize.small,
    },
    displayValue: {
      ...styles.displayValue,
      fontSize: responsive.fontSize.medium,
    },
    weightDisplayValue: {
      ...styles.displayValue,
      fontSize: responsive.isTablet ? 28 : 24,
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
              style={[styles.addQuantityButton, { padding: responsive.padding.small }]}
              onPress={() => setShowQuantityModal(true)}
            >
              <Text style={[styles.addQuantityButtonText, { fontSize: responsive.fontSize.small }]}>+ Add Quantity</Text>
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
              filteredAllocations.map((allocation) => {
                const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                if (!wc) return null;

                const allocatedBags = tallyRole === 'tally'
                  ? allocation.allocated_bags_tally
                  : allocation.allocated_bags_dispatcher;

                const isFulfilled = allocation.required_bags > 0 && allocatedBags >= allocation.required_bags;

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
                      {allocatedBags} / {allocation.required_bags}
                    </Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[styles.incrementButton, isSubmitting && { opacity: 0.6 }]}
                        onPress={() => handleByproductIncrement(wc.id)}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.incrementButtonText}>+1</Text>
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
  const renderDressedMode = () => (
    <View style={dynamicStyles.contentContainer}>
        {/* Calculator Section */}
        <View style={dynamicStyles.calculatorSection}>
          {/* Three display fields in a row */}
            <View style={dynamicStyles.displayRow}>
            <View style={[dynamicStyles.displayField, { flex: 2 }]}>
              <Text style={dynamicStyles.displayLabel}>Classification</Text>
              <Text style={dynamicStyles.displayValue} numberOfLines={1}>
                {matchedWC ? matchedWC.classification : '-'}
              </Text>
            </View>
            <View style={[dynamicStyles.displayField, { flex: 2 }]}>
              <Text style={dynamicStyles.displayLabel}>Allocated / Required</Text>
              <Text style={[
                dynamicStyles.displayValue,
                currentAllocation && 
                (tallyRole === 'tally' 
                  ? currentAllocation.allocated_bags_tally >= currentAllocation.required_bags
                  : currentAllocation.allocated_bags_dispatcher >= currentAllocation.required_bags) &&
                currentAllocation.required_bags > 0
                  ? { color: '#27ae60' }
                  : {}
              ]}>
                {currentAllocation
                  ? `${tallyRole === 'tally' ? currentAllocation.allocated_bags_tally : currentAllocation.allocated_bags_dispatcher} / ${currentAllocation.required_bags}`
                  : '- / -'}
              </Text>
            </View>
            <View style={[dynamicStyles.displayField, { flex: 1.5 }]}>
              <Text style={dynamicStyles.displayLabel}>Weight</Text>
              <Text style={dynamicStyles.weightDisplayValue}>
                {tallyInput}
              </Text>
            </View>
          </View>

          {/* Calculator buttons */}
          <View style={dynamicStyles.buttonsContainer}>
            {/* Number pad */}
            <View style={dynamicStyles.numberPad}>
              <View style={dynamicStyles.buttonRow}>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('7')}>
                  <Text style={dynamicStyles.buttonText}>7</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('8')}>
                  <Text style={dynamicStyles.buttonText}>8</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('9')}>
                  <Text style={dynamicStyles.buttonText}>9</Text>
                </TouchableOpacity>
              </View>
              <View style={dynamicStyles.buttonRow}>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('4')}>
                  <Text style={dynamicStyles.buttonText}>4</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('5')}>
                  <Text style={dynamicStyles.buttonText}>5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('6')}>
                  <Text style={dynamicStyles.buttonText}>6</Text>
                </TouchableOpacity>
              </View>
              <View style={dynamicStyles.buttonRow}>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('1')}>
                  <Text style={dynamicStyles.buttonText}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('2')}>
                  <Text style={dynamicStyles.buttonText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('3')}>
                  <Text style={dynamicStyles.buttonText}>3</Text>
                </TouchableOpacity>
              </View>
              <View style={dynamicStyles.buttonRow}>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={() => handleTallyNumberPress('0')}>
                  <Text style={dynamicStyles.buttonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={handleTallyDecimal}>
                  <Text style={dynamicStyles.buttonText}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.numberButton} onPress={handleTallyBackspace}>
                  <Text style={dynamicStyles.buttonText}>⌫</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action buttons */}
            <View style={dynamicStyles.actionButtons}>
              <TouchableOpacity
                style={[dynamicStyles.actionButton, styles.clearButton]}
                onPress={handleTallyClear}
              >
                <Text style={dynamicStyles.actionButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.actionButton,
                  styles.enterButton,
                  isSubmitting && { opacity: 0.6 }
                ]}
                onPress={handleTallyEnter}
                disabled={isSubmitting}
              >
                <Text style={dynamicStyles.actionButtonText}>
                  {isSubmitting ? 'Saving...' : 'Enter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Summary table */}
        <View style={dynamicStyles.summarySection}>
          <View style={dynamicStyles.summaryContainer}>
            <Text style={dynamicStyles.summaryTitle}>Allocations Summary</Text>
            <View style={dynamicStyles.summaryTable}>
              <View style={dynamicStyles.summaryHeader}>
                <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.5 }]}>Label</Text>
                <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.5 }]}>Weight Range</Text>
                <Text style={[dynamicStyles.summaryHeaderText, { flex: 1.5 }]}>Allocated / Required</Text>
                <Text style={[dynamicStyles.summaryHeaderText, { flex: 1 }]}>Sum</Text>
              </View>
              {filteredAllocations.map((allocation) => {
                const wc = weightClassifications.find((wc) => wc.id === allocation.weight_classification_id);
                if (!wc) return null;
                
                const allocatedBags = tallyRole === 'tally' 
                  ? allocation.allocated_bags_tally 
                  : allocation.allocated_bags_dispatcher;
                
                const isFulfilled = allocation.required_bags > 0 && allocatedBags >= allocation.required_bags;
                const sum = getSumForWeightClassification(allocation.weight_classification_id);
                
                return (
                  <View key={allocation.id} style={dynamicStyles.summaryRow}>
                    <Text style={[dynamicStyles.summaryCell, { flex: 1.5 }]} numberOfLines={1}>
                      {wc.classification}
                    </Text>
                    <Text style={[dynamicStyles.summaryCell, { flex: 1.5 }]} numberOfLines={1}>
                      {formatWeightRange(wc)}
                    </Text>
                    <Text style={[
                      dynamicStyles.summaryCell, 
                      { flex: 1.5 },
                      isFulfilled ? { color: '#27ae60', fontWeight: '600' } : {}
                    ]}>
                      {allocatedBags} / {allocation.required_bags}
                    </Text>
                    <Text style={[dynamicStyles.summaryCell, { flex: 1 }]}>
                      {sum.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
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
      </View>
  );

  const content = tallyMode === 'byproduct' ? renderByproductMode() : renderDressedMode();

  return (
    <View style={dynamicStyles.container}>
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
    </View>
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
});

export default TallyScreen;

