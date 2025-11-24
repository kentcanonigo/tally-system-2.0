# User Preferences System - Implementation Guide

## Overview

The Tally System now supports **user-specific preferences** that are saved to each user's account. These preferences sync across sessions and devices, providing a personalized experience for each user.

---

## Implemented Features

### 1. **User-Specific Settings (Backend)**

**New Database Fields** (`users` table):
- `timezone` (String, default: 'UTC') - User's preferred timezone
- `active_plant_id` (Integer, nullable) - Currently selected plant
- `acceptable_difference_threshold` (Integer, default: 0) - Threshold for tally/dispatcher weight differences
- `visible_tabs` (JSON, nullable) - List of visible navigation tabs

**Migration**: `014_add_user_preferences.py`

### 2. **API Endpoint**

**`PUT /api/v1/auth/me/preferences`**

Updates the current user's preferences.

**Request Body** (UserPreferencesUpdate):
```json
{
  "timezone": "Asia/Manila",
  "active_plant_id": 1,
  "acceptable_difference_threshold": 5,
  "visible_tabs": ["Home", "Sessions", "Tally", "Settings"]
}
```

**Response**: Updated user object with all preferences

**Validation**:
- `acceptable_difference_threshold` must be ≥ 0
- `visible_tabs` must be a valid array of tab names

### 3. **Mobile App Settings Screen**

**Enhanced Settings Sections**:

#### **Active Plant**
- Dropdown selector for available plants
- Saved to user account (replaces device-local storage)

#### **Timezone**
- Dropdown selector for available timezones
- Saved to user account (replaces device-local storage)

#### **Difference Threshold**
- Text input for acceptable weight difference
- Saved to user account (replaces AsyncStorage)

#### **Visible Tabs** (NEW)
- Toggle switches for each available tab
- Customize which tabs appear in the navigation bar
- Settings tab is always visible (non-hideable)
- Must have at least one other tab visible

#### **Save All Settings** Button
- Single button to save all preferences at once
- Only visible when there are unsaved changes
- Shows loading indicator while saving
- Success/error alerts on completion

---

## Available Tabs

Users can customize visibility of these tabs:
1. **Home** - Dashboard/overview
2. **Sessions** - Tally session list
3. **Tally** - Quick tally interface
4. **Customers** - Customer management
5. **Weight Classifications** - Weight class management
6. **Calculator** - Bag calculator tool
7. **Export** - PDF export functionality
8. **Settings** - Always visible (cannot be hidden)

---

## User Experience

### **Before Changes:**
- Settings were stored locally on each device (AsyncStorage)
- Users had to reconfigure settings on each device
- No way to customize tab visibility
- Individual save buttons for each setting

### **After Changes:**
- Settings are saved to user's account in the database
- Settings sync automatically across all devices
- Users can show/hide navigation tabs based on their role/needs
- Single "Save All Settings" button for better UX
- Changes are indicated visually (green save button appears)

---

## Migration Path

### **For Existing Users:**

1. **First Login After Update:**
   - User's existing device settings (if any) will not automatically migrate
   - Default values will be used:
     - Timezone: 'UTC'
     - Active Plant: User's first accessible plant
     - Threshold: 0
     - Visible Tabs: All tabs visible

2. **User Action Required:**
   - Users should go to Settings and reconfigure their preferences
   - Click "Save All Settings" to persist to their account

3. **Backward Compatibility:**
   - The app still reads from PlantContext and TimezoneContext for fallback
   - If user preferences are null, defaults from contexts are used

---

## Technical Implementation

### **Backend Changes:**

1. **Models** (`backend/app/models/user.py`):
   - Added preference columns with JSON support for `visible_tabs`

2. **Schemas** (`backend/app/schemas/user.py`):
   - Added `UserPreferencesUpdate` schema
   - Updated `UserResponse` to include preferences

3. **Routes** (`backend/app/api/routes/auth.py`):
   - Added `PUT /auth/me/preferences` endpoint
   - Updated `/auth/me` to return preferences

### **Mobile Changes:**

1. **Types** (`mobile/src/types/index.ts`):
   - Updated `User` interface with preference fields
   - Added `UserPreferencesUpdate` interface

2. **API Service** (`mobile/src/services/api.ts`):
   - Added `userPreferencesApi.update()` function

3. **Auth Context** (`mobile/src/contexts/AuthContext.tsx`):
   - Added `updatePreferences()` function
   - Integrated with authentication flow

4. **Settings Screen** (`mobile/src/screens/SettingsScreen.tsx`):
   - Replaced AsyncStorage with API calls
   - Added tab visibility toggles
   - Implemented unified save functionality
   - Added change detection

5. **App Navigator** (`mobile/src/navigation/AppNavigator.tsx`):
   - Conditionally renders tabs based on user preferences
   - Always shows Settings tab
   - Defaults to showing all tabs if no preferences set

---

## Testing Checklist

### **Backend API Testing:**
- [ ] `PUT /auth/me/preferences` updates all fields correctly
- [ ] `GET /auth/me` returns updated preferences
- [ ] Validation works for invalid threshold values
- [ ] Validation works for invalid visible_tabs format
- [ ] Migration `014` runs successfully on existing database

### **Mobile App Testing:**

#### **Settings Screen:**
- [ ] All sections load current user preferences
- [ ] Active Plant dropdown shows correct selection
- [ ] Timezone dropdown shows correct selection
- [ ] Threshold input shows current value
- [ ] Tab toggles reflect current visibility settings
- [ ] "Save All Settings" button only appears when changes are made
- [ ] "Save All Settings" button is disabled while saving
- [ ] Success alert shows after saving
- [ ] Error alert shows if save fails
- [ ] Changes persist after app restart
- [ ] Settings sync across multiple devices for same user

#### **Tab Visibility:**
- [ ] Unchecking a tab hides it from navigation bar
- [ ] Checking a tab shows it in navigation bar
- [ ] Cannot hide all tabs (must have at least one visible)
- [ ] Settings tab is always visible (cannot be hidden)
- [ ] Tab visibility persists after save and reload
- [ ] Tab order remains consistent

#### **Navigation:**
- [ ] Hidden tabs don't appear in tab bar
- [ ] Visible tabs appear and function normally
- [ ] App doesn't crash if user is on a tab that gets hidden

---

## Security Considerations

1. **User-Scoped:** All preferences are scoped to the authenticated user
2. **Validation:** Server-side validation prevents invalid data
3. **Plant Access:** Active plant selection still respects plant permissions
4. **No Impact on Authorization:** Tab visibility is cosmetic; backend still enforces permissions

---

## Future Enhancements

Potential improvements for future versions:

1. **Default Role Preferences:**
   - Set default visible tabs based on user role
   - Example: Tally Operators only see Home, Tally, Settings by default

2. **Admin Configuration:**
   - Allow admins to set organization-wide defaults
   - Force certain tabs to be always visible/hidden based on role

3. **Import/Export Settings:**
   - Allow users to export their preferences
   - Import preferences to quickly set up new devices

4. **Theme Preferences:**
   - Dark mode / light mode selection
   - Custom color schemes

5. **Notification Preferences:**
   - Enable/disable push notifications
   - Configure notification types

---

## Support

For issues or questions:
1. Check the mobile app console for error messages
2. Verify migration `014` ran successfully in the database
3. Test API endpoint directly using Postman/curl
4. Check user's `visible_tabs` field in database for valid JSON

---

## Summary

This update provides a modern, user-centric preferences system that:
- ✅ Saves settings to user accounts (not devices)
- ✅ Syncs across all user's devices
- ✅ Allows tab customization for cleaner UI
- ✅ Improves UX with unified save functionality
- ✅ Maintains backward compatibility
- ✅ Follows security best practices

**Next Steps:**
1. Run database migration: `alembic upgrade head`
2. Test the new settings screen in the mobile app
3. Customize your tab visibility
4. Save and enjoy your personalized experience!

