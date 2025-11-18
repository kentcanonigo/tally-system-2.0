import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMEZONE_STORAGE_KEY = '@tally_system_timezone';
const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface TimezoneContextType {
  timezone: string;
  setTimezone: (tz: string) => Promise<void>;
  availableTimezones: string[];
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

// Common timezones list
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
];

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIMEZONE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadTimezone();
  }, []);

  const loadTimezone = async () => {
    try {
      const stored = await AsyncStorage.getItem(TIMEZONE_STORAGE_KEY);
      if (stored) {
        setTimezoneState(stored);
      }
    } catch (error) {
      console.error('Error loading timezone:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setTimezone = async (tz: string) => {
    try {
      await AsyncStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
      setTimezoneState(tz);
    } catch (error) {
      console.error('Error saving timezone:', error);
      throw error;
    }
  };

  // Don't render children until timezone is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        setTimezone,
        availableTimezones: COMMON_TIMEZONES,
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}

