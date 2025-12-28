import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_SESSIONS_KEY = 'activeSessions';
const SELECTED_SESSION_KEY = 'selectedSessionId';
// No limit on active sessions
const MAX_ACTIVE_SESSIONS = Number.MAX_SAFE_INTEGER;

/**
 * Get all active session IDs from storage
 */
export const getActiveSessions = async (): Promise<number[]> => {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_SESSIONS_KEY);
    if (stored) {
      const sessionIds = JSON.parse(stored);
      // Ensure we return an array of numbers
      return Array.isArray(sessionIds) ? sessionIds.map(id => Number(id)) : [];
    }
    return [];
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
};

/**
 * Set active session IDs (replaces all existing)
 */
export const setActiveSessions = async (sessionIds: number[]): Promise<void> => {
  try {
    // No limit - save all session IDs
    await AsyncStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(sessionIds));
  } catch (error) {
    console.error('Error setting active sessions:', error);
    throw error;
  }
};

/**
 * Add a session to active sessions (if not already active)
 * Returns true if added, false if not (already active)
 */
export const addActiveSession = async (sessionId: number): Promise<boolean> => {
  try {
    const activeSessions = await getActiveSessions();
    
    // Check if already active
    if (activeSessions.includes(sessionId)) {
      return false;
    }
    
    // Add the session (no limit check)
    activeSessions.push(sessionId);
    await setActiveSessions(activeSessions);
    return true;
  } catch (error) {
    console.error('Error adding active session:', error);
    throw error;
  }
};

/**
 * Remove a session from active sessions
 * Returns true if removed, false if not found
 */
export const removeActiveSession = async (sessionId: number): Promise<boolean> => {
  try {
    const activeSessions = await getActiveSessions();
    const index = activeSessions.indexOf(sessionId);
    
    if (index === -1) {
      return false;
    }
    
    activeSessions.splice(index, 1);
    await setActiveSessions(activeSessions);
    return true;
  } catch (error) {
    console.error('Error removing active session:', error);
    throw error;
  }
};

/**
 * Check if a session is active
 */
export const isActiveSession = async (sessionId: number): Promise<boolean> => {
  try {
    const activeSessions = await getActiveSessions();
    return activeSessions.includes(sessionId);
  } catch (error) {
    console.error('Error checking active session:', error);
    return false;
  }
};

/**
 * Toggle a session's active status
 * Returns the new active status (true if now active, false if now inactive)
 */
export const toggleActiveSession = async (sessionId: number): Promise<boolean> => {
  try {
    const isActive = await isActiveSession(sessionId);
    
    if (isActive) {
      await removeActiveSession(sessionId);
      return false;
    } else {
      const added = await addActiveSession(sessionId);
      return added;
    }
  } catch (error) {
    console.error('Error toggling active session:', error);
    throw error;
  }
};

/**
 * Reorder active sessions by moving an item from one index to another
 * @param fromIndex The index of the item to move
 * @param toIndex The index where the item should be moved to
 * @returns The new ordered array of session IDs
 */
export const reorderActiveSessions = async (fromIndex: number, toIndex: number): Promise<number[]> => {
  try {
    const activeSessions = await getActiveSessions();
    
    if (fromIndex < 0 || fromIndex >= activeSessions.length || toIndex < 0 || toIndex >= activeSessions.length) {
      console.error('Invalid indices for reordering:', { fromIndex, toIndex, length: activeSessions.length });
      return activeSessions;
    }
    
    // Create a new array with the reordered items
    const reordered = [...activeSessions];
    const [movedItem] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedItem);
    
    // Save the new order
    await setActiveSessions(reordered);
    return reordered;
  } catch (error) {
    console.error('Error reordering active sessions:', error);
    throw error;
  }
};

/**
 * Get the maximum number of active sessions allowed
 */
export const getMaxActiveSessions = (): number => {
  return MAX_ACTIVE_SESSIONS;
};

/**
 * Get the selected session ID from storage
 */
export const getSelectedSessionId = async (): Promise<number | null> => {
  try {
    const stored = await AsyncStorage.getItem(SELECTED_SESSION_KEY);
    if (stored) {
      const sessionId = Number(stored);
      return isNaN(sessionId) ? null : sessionId;
    }
    return null;
  } catch (error) {
    console.error('Error getting selected session ID:', error);
    return null;
  }
};

/**
 * Set the selected session ID in storage
 */
export const setSelectedSessionId = async (sessionId: number | null): Promise<void> => {
  try {
    if (sessionId === null) {
      await AsyncStorage.removeItem(SELECTED_SESSION_KEY);
    } else {
      await AsyncStorage.setItem(SELECTED_SESSION_KEY, String(sessionId));
    }
  } catch (error) {
    console.error('Error setting selected session ID:', error);
    throw error;
  }
};

