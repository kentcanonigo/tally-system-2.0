/**
 * Utility functions for formatting dates with timezone support
 */

/**
 * Format a date string to a localized date string in the specified timezone
 */
export function formatDate(dateString: string, timezone: string): string {
  try {
    let date: Date;
    
    // Check if it's a date-only string (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Date-only string - treat as local date at midnight in the target timezone
      // Parse as UTC first, then convert to target timezone
      date = new Date(dateString + 'T00:00:00Z');
    } else if (dateString.includes('Z') || dateString.includes('+') || (dateString.includes('-') && dateString.includes('T'))) {
      // Already has timezone info or is ISO datetime format
      date = new Date(dateString);
    } else if (dateString.includes('T')) {
      // ISO datetime without timezone - assume UTC
      date = new Date(dateString + 'Z');
    } else {
      // Fallback: try parsing as-is
      date = new Date(dateString);
    }
    
    // Verify date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateString);
      return new Date(dateString).toLocaleDateString();
    }
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error, 'dateString:', dateString, 'timezone:', timezone);
    return new Date(dateString).toLocaleDateString();
  }
}

/**
 * Format a date string to a localized time string in the specified timezone
 */
export function formatTime(dateString: string, timezone: string): string {
  try {
    let date: Date;
    
    // Check if it's a date-only string (YYYY-MM-DD format with no time component)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Date-only string - this shouldn't be used for time formatting, but handle gracefully
      date = new Date(dateString + 'T00:00:00Z');
    } else if (dateString.includes('Z')) {
      // Has UTC timezone indicator - parse directly
      date = new Date(dateString);
    } else if (dateString.includes('+') || /-\d{2}:\d{2}$/.test(dateString)) {
      // Has timezone offset (e.g., +08:00 or -05:00) - parse directly
      date = new Date(dateString);
    } else if (dateString.includes('T')) {
      // ISO datetime without timezone indicator - backend stores in UTC, so treat as UTC
      date = new Date(dateString + 'Z');
    } else {
      // Fallback: try parsing as-is (might be in local timezone, but we'll convert)
      date = new Date(dateString);
    }
    
    // Verify date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateString);
      return new Date(dateString).toLocaleTimeString();
    }
    
    // Use Intl.DateTimeFormat to convert to the specified timezone
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch (error) {
    console.error('Error formatting time:', error, 'dateString:', dateString, 'timezone:', timezone);
    return new Date(dateString).toLocaleTimeString();
  }
}

/**
 * Format a date string to a localized date and time string in the specified timezone
 */
export function formatDateTime(dateString: string, timezone: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return new Date(dateString).toLocaleString();
  }
}

/**
 * Get timezone abbreviation (e.g., EST, PST) for a given timezone
 */
export function getTimezoneAbbreviation(timezone: string): string {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((part) => part.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error);
    return timezone;
  }
}

