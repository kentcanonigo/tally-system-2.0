import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

const ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY = '@tally_system_acceptable_difference_threshold';
const DEFAULT_THRESHOLD = 0;
const DEFAULT_HEADS_AMOUNT_KEY = '@tally_system_default_heads_amount';
const DEFAULT_HEADS_AMOUNT = 15;

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

export async function getDefaultHeadsAmount(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(DEFAULT_HEADS_AMOUNT_KEY);
    if (stored !== null) {
      return parseFloat(stored);
    }
    return DEFAULT_HEADS_AMOUNT;
  } catch (error) {
    console.error('Error loading default heads amount:', error);
    return DEFAULT_HEADS_AMOUNT;
  }
}

export function useDefaultHeadsAmount(): number {
  const [headsAmount, setHeadsAmount] = useState<number>(DEFAULT_HEADS_AMOUNT);

  useEffect(() => {
    loadHeadsAmount();
  }, []);

  const loadHeadsAmount = async () => {
    try {
      const stored = await AsyncStorage.getItem(DEFAULT_HEADS_AMOUNT_KEY);
      if (stored !== null) {
        setHeadsAmount(parseFloat(stored));
      } else {
        setHeadsAmount(DEFAULT_HEADS_AMOUNT);
      }
    } catch (error) {
      console.error('Error loading default heads amount:', error);
      setHeadsAmount(DEFAULT_HEADS_AMOUNT);
    }
  };

  return headsAmount;
}

