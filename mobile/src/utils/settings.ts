import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

const ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY = '@tally_system_acceptable_difference_threshold';
const DEFAULT_THRESHOLD = 0;

export async function getAcceptableDifferenceThreshold(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY);
    if (stored !== null) {
      return parseFloat(stored);
    }
    return DEFAULT_THRESHOLD;
  } catch (error) {
    console.error('Error loading acceptable difference threshold:', error);
    return DEFAULT_THRESHOLD;
  }
}

export function useAcceptableDifference(): number {
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);

  useEffect(() => {
    loadThreshold();
  }, []);

  const loadThreshold = async () => {
    try {
      const stored = await AsyncStorage.getItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY);
      if (stored !== null) {
        setThreshold(parseFloat(stored));
      } else {
        setThreshold(DEFAULT_THRESHOLD);
      }
    } catch (error) {
      console.error('Error loading acceptable difference threshold:', error);
      setThreshold(DEFAULT_THRESHOLD);
    }
  };

  return threshold;
}

