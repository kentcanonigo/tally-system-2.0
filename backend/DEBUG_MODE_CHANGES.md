# Debug Mode Changes

This document describes what changes in the Tally System API when `DEBUG=False` (production mode) versus `DEBUG=True` (development mode).

## Configuration

The debug mode is controlled by the `DEBUG` environment variable in the `.env` file or as an environment variable.

**Default**: `DEBUG=True` (development mode)

**Location**: `app/config.py`

```python
debug: bool = True  # Set via DEBUG environment variable
```

---

## Changes When `DEBUG=False`

### 1. FastAPI Application Initialization

**Location**: `app/main.py:22`

```python
app = FastAPI(
    title="Tally System API",
    description="Backend API for Tally System - Chicken Parts Inventory Management",
    version="2.0.0",
    debug=settings.debug  # ← Affects FastAPI's internal debug behavior
)
```

**What Changes**:
- FastAPI's internal debug features are disabled
- Automatic reloading is disabled (if using uvicorn with `--reload`)
- More optimized error handling internally

---

### 2. Global Exception Handler

**Location**: `app/main.py:95-125`

#### When `DEBUG=True` (Development):
```json
{
  "detail": "Full error message string",
  "type": "ValueError",
  "traceback": "Full Python traceback with file paths and line numbers"
}
```

#### When `DEBUG=False` (Production):
```json
{
  "detail": "Internal server error. Please check logs for details.",
  "type": "ValueError"
}
```

**What Changes**:
- ❌ **No traceback** exposed to clients
- ❌ **No detailed error message** exposed to clients
- ✅ **Generic error message** returned to prevent information leakage
- ✅ **Full details still logged** server-side (see logging section below)

**Security Impact**: Prevents exposure of:
- File system paths
- Internal code structure
- Stack traces
- Sensitive error details

---

### 3. SQLAlchemy Database Error Handler

**Location**: `app/main.py:128-147`

#### When `DEBUG=True` (Development):
```json
{
  "detail": "Database error occurred. Please check database connection and configuration.",
  "type": "IntegrityError",
  "error": "Full SQLAlchemy error message with details"
}
```

#### When `DEBUG=False` (Production):
```json
{
  "detail": "Database error occurred. Please check database connection and configuration.",
  "type": "IntegrityError",
  "error": "Database error"
}
```

**What Changes**:
- ❌ **No detailed database error message** exposed
- ✅ **Generic "Database error" message** returned
- ✅ **Full error details still logged** server-side

**Security Impact**: Prevents exposure of:
- Database schema details
- Table/column names
- SQL query fragments
- Connection string information

---

### 4. Logging Behavior

**Location**: `app/main.py:98-106, 131-138`

**Important**: Logging behavior **does NOT change** based on debug mode.

**What Stays the Same**:
- ✅ **Full tracebacks are always logged** to server logs
- ✅ **Error details are always logged** with `exc_info=True`
- ✅ **Request path and method** are logged
- ✅ **Exception type and message** are logged

**Example Log Output** (same in both modes):
```
2024-01-15 10:30:45 - app.main - ERROR - Unhandled exception: ValueError: Invalid input
Traceback (most recent call last):
  File "app/api/routes/customers.py", line 45, in create_customer
    ...
```

**Why**: Server-side logs need full details for debugging, but clients should not receive this information.

---

## Summary Table

| Feature | `DEBUG=True` | `DEBUG=False` |
|---------|--------------|---------------|
| **FastAPI Debug Mode** | Enabled | Disabled |
| **Global Exception Traceback** | ✅ Exposed to client | ❌ Hidden from client |
| **Global Exception Detail** | ✅ Full error message | ❌ Generic message |
| **Database Error Detail** | ✅ Full SQLAlchemy error | ❌ Generic "Database error" |
| **Server-Side Logging** | ✅ Full details | ✅ Full details (unchanged) |
| **Information Leakage Risk** | ⚠️ High | ✅ Low |

---

## Best Practices

### Development (`DEBUG=True`)
- ✅ Use for local development
- ✅ Helps with debugging
- ✅ Provides detailed error information
- ⚠️ **Never use in production**

### Production (`DEBUG=False`)
- ✅ **Always use in production**
- ✅ Protects sensitive information
- ✅ Prevents information leakage
- ✅ More secure error responses
- ✅ Still logs full details server-side for debugging

---

## Setting Debug Mode

### Via Environment Variable
```bash
export DEBUG=False
```

### Via `.env` File
```env
DEBUG=False
```

### In Azure App Service
Set as an Application Setting:
- **Name**: `DEBUG`
- **Value**: `False`

---

## Validation Error Handler

**Note**: The `RequestValidationError` handler (`app/main.py:150-167`) does **NOT** change based on debug mode. It always returns:
- Full validation error details
- Request body (if available)

This is intentional because validation errors are not security-sensitive and help clients fix their requests.

---

## Testing Debug Mode

To verify debug mode is working correctly:

1. **Set `DEBUG=False`** in your environment
2. **Trigger an error** (e.g., divide by zero in an endpoint)
3. **Check the API response** - should return generic error message
4. **Check server logs** - should contain full traceback

Example test endpoint:
```python
@app.get("/test-error")
async def test_error():
    raise ValueError("This is a test error")
```

**Expected Response** (`DEBUG=False`):
```json
{
  "detail": "Internal server error. Please check logs for details.",
  "type": "ValueError"
}
```

**Expected Logs** (both modes):
```
ERROR - Unhandled exception: ValueError: This is a test error
Traceback (most recent call last):
  ...
```

---

## Related Files

- `app/config.py` - Debug setting configuration
- `app/main.py` - Exception handlers and FastAPI initialization
- `.env` - Environment variable configuration

---

## Security Considerations

When `DEBUG=False`:
- ✅ No file paths exposed
- ✅ No stack traces exposed
- ✅ No internal error details exposed
- ✅ Generic error messages prevent information gathering
- ✅ Full details still available in logs for legitimate debugging

**Remember**: Always set `DEBUG=False` in production environments!









