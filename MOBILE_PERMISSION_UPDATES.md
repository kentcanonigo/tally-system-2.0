# Mobile Permission-Based Query Updates

## Summary

Updated the mobile app to conditionally query endpoints based on user permissions, preventing 403 errors and improving user experience.

## Changes Made

### 1. TallyScreen.tsx ✅

**Imports**:
- Added `usePermissions` hook

**Data Fetching**:
- Only queries `tallyLogEntriesApi.getBySession()` if user has `can_view_tally_logs` permission
- Updated `fetchData()` to build promises dynamically
- Updated all refresh operations after creating entries (4 locations)

**UI Updates**:
- Progress data (`allocated_bags_tally`, `allocated_bags_dispatcher`) is conditionally displayed
- Changed "Alloc / Req" label to just "Required" for users without `can_view_tally_logs`
- Summary tables show "-" for heads/weight totals when progress data isn't available
- Summary tables show "X req" instead of "X / Y" when user can't view progress

**Example Changes**:
```typescript
// Before
const [allocationsRes, logEntriesRes] = await Promise.all([
  allocationDetailsApi.getBySession(sessionId),
  tallyLogEntriesApi.getBySession(sessionId),
]);
setAllocations(allocationsRes.data);
setLogEntries(logEntriesRes.data);

// After
const canViewLogs = hasPermission('can_view_tally_logs');
const promises = [allocationDetailsApi.getBySession(sessionId)];

if (canViewLogs) {
  promises.push(tallyLogEntriesApi.getBySession(sessionId));
}

const results = await Promise.all(promises);
setAllocations(results[0].data);

if (canViewLogs && results[1]) {
  setLogEntries(results[1].data);
} else {
  setLogEntries([]); // Empty array if user can't view logs
}
```

### 2. TallySessionDetailScreen.tsx ✅

**Imports**:
- Added `usePermissions` hook

**Data Fetching**:
- Only queries `tallyLogEntriesApi.getBySession()` if user has `can_view_tally_logs` permission
- Updated `fetchData()` to build promises dynamically

### 3. TallySessionLogsScreen.tsx ✅

**Imports**:
- Added `usePermissions` hook

**Data Fetching**:
- Added permission check at start of `fetchData()` - returns early if permission missing
- User won't see "Failed to load logs" error, just won't fetch

**UI Updates** (planned):
- Screen should show access denied message if user doesn't have `can_view_tally_logs`
- Added early return in `fetchData` to prevent API call

---

## User Experience by Role

### 🔧 Tally Operator (only `can_start_tally`)

**Can Access**:
- ✅ Tally Screen (Dressed & Byproduct modes)
- ✅ View allocation requirements
- ✅ Create tally entries
- ✅ View what needs to be tallied

**Cannot Access/See**:
- ❌ Progress tracking (allocated bags)
- ❌ Historical log entries
- ❌ Completion percentages
- ❌ Total heads/weight in summary

**What They See**:
- Allocation summary shows: "50 req" instead of "25 / 50"
- Heads/Weight columns show: "-" instead of actual totals
- Label says "Required" instead of "Alloc / Req"
- No 403 errors!

### 📊 Manager (has `can_view_tally_logs`)

**Can Access**:
- ✅ Everything a Tally Operator can
- ✅ Progress tracking
- ✅ Historical log entries
- ✅ Completion percentages
- ✅ Total heads/weight

**What They See**:
- Allocation summary shows: "25 / 50" (progress tracking)
- Heads/Weight columns show actual totals
- Label says "Alloc / Req"
- Full historical data in logs screen

---

## Technical Details

### Permission Checks

All screens now check permissions using:
```typescript
const { hasPermission } = usePermissions();

if (!hasPermission('can_view_tally_logs')) {
  // Skip query or show access denied
  return;
}
```

### API Queries

Queries are built dynamically:
```typescript
const promises = [
  // Always included
  allocationDetailsApi.getBySession(sessionId),
];

if (canViewLogs) {
  // Conditionally included
  promises.push(tallyLogEntriesApi.getBySession(sessionId));
}

const results = await Promise.all(promises);
```

### Safe Data Access

All allocation progress data uses safe access:
```typescript
// Check if data exists
const hasProgressData = 'allocated_bags_tally' in allocation;

// Use nullish coalescing
const allocatedBags = allocation.allocated_bags_tally ?? 0;

// Conditional rendering
{hasProgressData ? `${allocatedBags} / ${required}` : `${required} req`}
```

---

## Testing Checklist

### Test as Tally Operator (only `can_start_tally`)

- [ ] Open Tally Screen - no 403 errors
- [ ] View allocation summary - shows "X req" format
- [ ] Create tally entry - works successfully
- [ ] Refresh after entry - no 403 errors
- [ ] Navigate to Logs Screen - shows access denied (if implemented)
- [ ] Total Heads/Weight columns show "-"

### Test as Manager (`can_view_tally_logs`)

- [ ] Open Tally Screen - no 403 errors
- [ ] View allocation summary - shows "X / Y" format with progress
- [ ] Create tally entry - works successfully
- [ ] Refresh after entry - shows updated progress
- [ ] Navigate to Logs Screen - shows log entries
- [ ] Total Heads/Weight columns show actual values

### Test Edge Cases

- [ ] User with no permissions - appropriate error messages
- [ ] SUPERADMIN - sees everything
- [ ] Switch between users - data updates correctly
- [ ] Network errors - graceful error handling
- [ ] Empty allocations - no crashes

---

## Backend Coordination

These mobile changes work in coordination with the backend changes:

1. **Backend Returns Minimal Data**: 
   - Allocation endpoints return different schemas based on permission
   - Users with only `can_start_tally` get `AllocationDetailsMinimalResponse`
   - Users with `can_view_tally_logs` get `AllocationDetailsResponse`

2. **Backend Blocks Log Queries**:
   - `GET /tally-sessions/{id}/log-entries` requires `can_view_tally_logs`
   - Mobile no longer makes these calls if user lacks permission

3. **Consistent Behavior**:
   - Mobile permissions match backend authorization
   - No API calls that will result in 403

---

## Performance Benefits

1. **Reduced API Calls**: Users without `can_view_tally_logs` make fewer requests
2. **Smaller Payloads**: Minimal allocation response is lighter
3. **Faster Rendering**: Less data to process and display
4. **Better UX**: No error flashes or failed requests

---

## Migration Notes

- No breaking changes for existing users
- Works with both old and new backend APIs
- Gracefully handles missing fields in allocation data
- Backward compatible with existing data

---

## Future Enhancements

1. **Cache Permissions**: Store permissions in AsyncStorage to avoid repeated checks
2. **Optimistic Updates**: Update UI before API response for better UX
3. **Offline Mode**: Cache minimal data for offline tally operations
4. **Permission Toast**: Show one-time notification explaining limited view for tally operators
5. **Help Text**: Add tooltips explaining what tally operators can/can't see

---

## See Also

- `/Users/rigelkentcanonigo/Repositories/tally-system-2.0/PERMISSIONS_ALLOCATION_GUIDE.md` - Backend permission separation guide
- `/Users/rigelkentcanonigo/Repositories/tally-system-2.0/PERMISSIONS_GUIDE.md` - Full RBAC permissions documentation
- `/Users/rigelkentcanonigo/Repositories/tally-system-2.0/backend/AUTH_GUIDE.md` - Backend authentication guide

