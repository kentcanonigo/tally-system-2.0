import { useAuth } from '../contexts/AuthContext';

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Hook to get the user's timezone preference from AuthContext
 * Falls back to the browser's default timezone if not set
 */
export function useTimezone(): string {
  const { user } = useAuth();
  return user?.timezone || DEFAULT_TIMEZONE;
}

