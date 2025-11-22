import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PlantContextType {
  activePlantId: number | null;
  setActivePlantId: (id: number | null) => Promise<void>;
  isLoading: boolean;
}

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export const PlantProvider = ({ children }: { children: ReactNode }) => {
  const [activePlantId, setActivePlantIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivePlant();
  }, []);

  const loadActivePlant = async () => {
    try {
      const savedPlantId = await AsyncStorage.getItem('activePlantId');
      if (savedPlantId) {
        setActivePlantIdState(Number(savedPlantId));
      }
    } catch (error) {
      console.error('Failed to load active plant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setActivePlantId = async (id: number | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem('activePlantId', id.toString());
      } else {
        await AsyncStorage.removeItem('activePlantId');
      }
      setActivePlantIdState(id);
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

