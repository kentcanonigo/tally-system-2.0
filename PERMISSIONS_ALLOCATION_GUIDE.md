# Allocation Details Permission Separation Guide

## Overview

The allocation details endpoints now return **different data** based on the user's permissions to properly separate concerns between tally operators and managers/auditors.

## Permission-Based Response Behavior

### 🔧 `can_start_tally` Permission (Tally Operators)

**Purpose**: Allow operators to see **ONLY what they need to tally**, without progress tracking or historical completion data.

**Returned Fields (Minimal Response)**:
```json
{
  "id": 1,
  "tally_session_id": 5,
  "weight_classification_id": 3,
  "required_bags": 100.0,
  "heads": 50.0,
  "created_at": "2025-11-24T10:00:00Z"
}
```

**Fields Excluded** (to prevent confusion):
- ❌ `allocated_bags_tally` - No progress tracking
- ❌ `allocated_bags_dispatcher` - No progress tracking
- ❌ `updated_at` - Not relevant for active work

**Rationale**: Tally operators focus on **what needs to be done**, not what's already been completed. This prevents confusion when looking at allocations with partial completion.

---

### 📊 `can_view_tally_logs` Permission (Managers/Auditors)

**Purpose**: Allow managers to see **full historical and progress data** for reporting, auditing, and monitoring.

**Returned Fields (Full Response)**:
```json
{
  "id": 1,
  "tally_session_id": 5,
  "weight_classification_id": 3,
  "required_bags": 100.0,
  "allocated_bags_tally": 45.0,
  "allocated_bags_dispatcher": 55.0,
  "heads": 50.0,
  "created_at": "2025-11-24T10:00:00Z",
  "updated_at": "2025-11-24T14:30:00Z"
}
```

**All fields included** to support:
- ✅ Progress monitoring
- ✅ Completion tracking
- ✅ Historical reporting
- ✅ Audit trails

---

## Affected Endpoints

### 1. `GET /api/v1/tally-sessions/{session_id}/allocations`

**Authorization**: Requires `can_start_tally` OR `can_view_tally_logs`

**Response**:
- If user has `can_view_tally_logs` → Returns **Full Response** (with progress)
- If user has only `can_start_tally` → Returns **Minimal Response** (requirements only)

### 2. `GET /api/v1/allocations/{allocation_id}`

**Authorization**: Requires `can_start_tally` OR `can_view_tally_logs`

**Response**:
- If user has `can_view_tally_logs` → Returns **Full Response** (with progress)
- If user has only `can_start_tally` → Returns **Minimal Response** (requirements only)

---

## Log Entries Access

### `GET /api/v1/tally-sessions/{session_id}/log-entries`

**Authorization**: Requires `can_view_tally_logs` ONLY

**Rationale**: 
- Log entries are **historical data** for reporting and auditing
- Tally operators don't need to see detailed log history to perform their work
- They only need to know **what to tally next** (from allocation requirements)

---

## Frontend Implementation Considerations

### TypeScript Type Definitions

```typescript
// Minimal response for tally operators
interface AllocationDetailsMinimal {
  id: number;
  tally_session_id: number;
  weight_classification_id: number;
  required_bags: number;
  heads: number | null;
  created_at: string;
}

// Full response for managers/auditors
interface AllocationDetailsFull extends AllocationDetailsMinimal {
  allocated_bags_tally: number;
  allocated_bags_dispatcher: number;
  updated_at: string;
}

// Union type for endpoints that vary by permission
type AllocationDetailsResponse = AllocationDetailsFull | AllocationDetailsMinimal;
```

### Checking Which Response Type You Received

```typescript
// Type guard to check if full response
function isFullAllocationResponse(
  alloc: AllocationDetailsResponse
): alloc is AllocationDetailsFull {
  return 'allocated_bags_tally' in alloc;
}

// Usage in components
if (isFullAllocationResponse(allocation)) {
  // Show progress bars, completion percentages
  console.log(`Progress: ${allocation.allocated_bags_tally}/${allocation.required_bags}`);
} else {
  // Show only requirements
  console.log(`To tally: ${allocation.required_bags} bags`);
}
```

### Recommended UI Patterns

**For Tally Operators** (`can_start_tally` only):
```
📦 Weight Class: 10-15kg
📊 Required: 100 bags
🐔 Heads: 50
```

**For Managers** (`can_view_tally_logs`):
```
📦 Weight Class: 10-15kg
📊 Required: 100 bags
✅ Tallied: 45 bags (45%)
✅ Dispatched: 55 bags (55%)
🐔 Heads: 50
📅 Last Updated: 2025-11-24 14:30
```

---

## Permission Hierarchy

```
SUPERADMIN
  ↓ (bypasses all checks)
  ├─ Full access to everything
  └─ Always receives Full Response

can_view_tally_logs
  ↓
  ├─ View allocation details (Full Response with progress)
  ├─ View log entries (historical data)
  └─ View reports and audits

can_start_tally
  ↓
  ├─ View allocation details (Minimal Response, requirements only)
  ├─ Create tally log entries
  └─ Create/update tally sessions
```

---

## Security & Data Isolation

### Plant-Based Access Control (Still Enforced)

Even with the appropriate permissions, users MUST have plant access:
- `can_start_tally` users: Can only access sessions for **their assigned plants**
- `can_view_tally_logs` users: Can only view logs for **their assigned plants**
- SUPERADMIN: Automatic access to **all plants**

### Example Combined Authorization Check

```python
# Backend example
def get_allocations(session_id: int, current_user: User):
    # 1. Check permission (can_start_tally OR can_view_tally_logs)
    # 2. Check plant access (session's plant must be in user's accessible plants)
    # 3. Return appropriate response based on permission level
```

---

## Migration Notes

### Backward Compatibility

Existing API clients will **continue to work** because:
- The endpoints still accept the same requests
- The minimal response is a **subset** of the full response
- Clients that don't check for optional fields won't break

### Recommended Updates

For frontends currently displaying progress:
1. Check user permissions in the UI
2. Conditionally render progress bars only if user has `can_view_tally_logs`
3. Use type guards to safely access progress fields

---

## Testing Scenarios

### Test Case 1: Tally Operator Access
```bash
# User with only can_start_tally
GET /api/v1/tally-sessions/1/allocations
Authorization: Bearer <tally_operator_token>

# Expected: Minimal response (no progress fields)
# Status: 200 OK
```

### Test Case 2: Manager Access
```bash
# User with can_view_tally_logs
GET /api/v1/tally-sessions/1/allocations
Authorization: Bearer <manager_token>

# Expected: Full response (with progress fields)
# Status: 200 OK
```

### Test Case 3: Tally Operator Cannot View Log Entries
```bash
# User with only can_start_tally
GET /api/v1/tally-sessions/1/log-entries
Authorization: Bearer <tally_operator_token>

# Expected: 403 Forbidden
# Detail: "Permission 'can_view_tally_logs' required"
```

### Test Case 4: Manager Can View Log Entries
```bash
# User with can_view_tally_logs
GET /api/v1/tally-sessions/1/log-entries
Authorization: Bearer <manager_token>

# Expected: List of log entries
# Status: 200 OK
```

---

## Summary

| Permission | Allocation Details | Log Entries | Progress Data |
|------------|-------------------|-------------|---------------|
| `can_start_tally` | ✅ Minimal (requirements only) | ❌ No access | ❌ Hidden |
| `can_view_tally_logs` | ✅ Full (with progress) | ✅ Full access | ✅ Visible |
| SUPERADMIN | ✅ Full (with progress) | ✅ Full access | ✅ Visible |

This separation ensures:
- 🎯 **Clarity**: Tally operators see only what they need
- 🔒 **Security**: Historical data is restricted to authorized personnel
- 📊 **Flexibility**: Managers get full reporting capabilities
- 🚀 **Performance**: Minimal responses are lighter for mobile operators

