import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

interface PlantContextType {
  activePlantId: number | null;
  setActivePlantId: (id: number | null) => Promise<void>;
  isLoading: boolean;
}

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export const PlantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [activePlantId, setActivePlantIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastSyncedUserPlantIdRef = useRef<number | null | undefined>(undefined);

  // Load from AsyncStorage on mount (for backward compatibility)
  useEffect(() => {
    const loadActivePlant = async () => {
      try {
        const savedPlantId = await AsyncStorage.getItem('activePlantId');
        if (savedPlantId) {
          setActivePlantIdState(Number(savedPlantId));
        }
      } catch (error) {
        console.error('Failed to load active plant:', error);
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    loadActivePlant();
  }, []);

  // Sync with user's active_plant_id when user data is available
  useEffect(() => {
    if (!isInitialized) return; // Wait for initial load from AsyncStorage

    const syncWithUserPreferences = async () => {
      // If user logged out, clear the plant context
      if (user === null) {
        if (activePlantId !== null) {
          console.log('[PlantContext] User logged out, clearing plant context');
          try {
            await AsyncStorage.removeItem('activePlantId');
            setActivePlantIdState(null);
            lastSyncedUserPlantIdRef.current = undefined;
          } catch (error) {
            console.error('[PlantContext] Failed to clear plant on logout:', error);
          }
        }
        return;
      }

      const userPlantId = user?.active_plant_id;

      // Only sync if the user's plant ID has changed since last sync
      if (lastSyncedUserPlantIdRef.current !== userPlantId) {
        if (userPlantId !== null && userPlantId !== undefined) {
          // User has a plant preference set - sync it
          if (activePlantId !== userPlantId) {
            console.log('[PlantContext] Syncing plant from user preferences:', userPlantId);
            try {
              await AsyncStorage.setItem('activePlantId', userPlantId.toString());
              setActivePlantIdState(userPlantId);
              lastSyncedUserPlantIdRef.current = userPlantId;
            } catch (error) {
              console.error('[PlantContext] Failed to sync plant from user preferences:', error);
            }
          } else {
            // Context already matches, just update the ref
            lastSyncedUserPlantIdRef.current = userPlantId;
          }
        } else if (userPlantId === null) {
          // User has explicitly set plant to null
          if (activePlantId !== null) {
            console.log('[PlantContext] Syncing plant to null from user preferences');
            try {
              await AsyncStorage.removeItem('activePlantId');
              setActivePlantIdState(null);
              lastSyncedUserPlantIdRef.current = null;
            } catch (error) {
              console.error('[PlantContext] Failed to sync plant to null:', error);
            }
          } else {
            lastSyncedUserPlantIdRef.current = null;
          }
        }
      }
    };

    syncWithUserPreferences();
  }, [user?.active_plant_id, isInitialized, activePlantId]);

  const setActivePlantId = async (id: number | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem('activePlantId', id.toString());
      } else {
        await AsyncStorage.removeItem('activePlantId');
      }
      setActivePlantIdState(id);
      // Update the ref when manually setting to prevent immediate overwrite
      // The user preference update should happen right after this call (e.g., in Settings screen)
      // and will then update the ref on the next sync
      lastSyncedUserPlantIdRef.current = id;
    } catch (error) {
      console.error('Failed to save active plant:', error);
      throw error;
    }
  };

  return (
    <PlantContext.Provider value={{ activePlantId, setActivePlantId, isLoading }}>
      {children}
    </PlantContext.Provider>
  );
};

export const usePlant = () => {
  const context = useContext(PlantContext);
  if (context === undefined) {
    throw new Error('usePlant must be used within a PlantProvider');
  }
  return context;
};

