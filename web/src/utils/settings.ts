const ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY = 'tally_system_acceptable_difference_threshold';
const DEFAULT_THRESHOLD = 0;

export function getAcceptableDifferenceThreshold(): number {
  try {
    const stored = localStorage.getItem(ACCEPTABLE_DIFFERENCE_THRESHOLD_KEY);
    if (stored !== null) {
      return parseFloat(stored);
    }
    return DEFAULT_THRESHOLD;
  } catch (error) {
    console.error('Error loading acceptable difference threshold:', error);
    return DEFAULT_THRESHOLD;
  }
}

const DEFAULT_HEADS_AMOUNT_KEY = 'tally_system_default_heads_amount';
const DEFAULT_HEADS_AMOUNT = 15;

export function getDefaultHeadsAmount(): number {
  try {
    const stored = localStorage.getItem(DEFAULT_HEADS_AMOUNT_KEY);
    if (stored !== null) {
      return parseFloat(stored);
    }
    return DEFAULT_HEADS_AMOUNT;
  } catch (error) {
    console.error('Error loading default heads amount:', error);
    return DEFAULT_HEADS_AMOUNT;
  }
}

