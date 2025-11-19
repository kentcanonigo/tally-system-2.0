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

