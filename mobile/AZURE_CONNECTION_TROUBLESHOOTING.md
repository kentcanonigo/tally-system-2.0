# Azure Connection Troubleshooting Guide

## Understanding 401 and 403 Errors

### 401 Unauthorized
- **Meaning**: Authentication failed
- **Causes**:
  - Missing or invalid JWT token
  - Token expired
  - Token signed with different SECRET_KEY
  - User doesn't exist in database

### 403 Forbidden
- **Meaning**: Authorization failed (you're authenticated but don't have permission)
- **Causes**:
  - User account is inactive
  - User doesn't have access to the requested plant
  - User doesn't have required permissions

---

## Common Issues and Solutions

### Issue 1: Token Signed with Different SECRET_KEY

**Problem**: You logged in locally (or on a different backend), but the Azure backend uses a different `SECRET_KEY`, so it can't validate your token.

**Solution**:
1. **Log out** from your mobile app (clear the stored token)
2. **Log in again** using the Azure API URL
3. This will generate a new token signed with Azure's SECRET_KEY

**How to verify**: Check if you can log in fresh with the Azure URL.

---

### Issue 2: User Doesn't Exist in Azure Database

**Problem**: Your local database has users, but Azure database is empty or different.

**Solution**:
1. **Check Azure database** has users:
   - SSH into Azure App Service
   - Or use Azure Portal → App Service → Console
   - Run: `python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); print([u.username for u in db.query(User).all()])"`

2. **Create admin user in Azure**:
   ```bash
   # SSH into Azure App Service
   cd /home/site/wwwroot
   python seed_admin.py
   ```

3. **Or run migrations** (if users table doesn't exist):
   ```bash
   alembic upgrade head
   ```

---

### Issue 3: Token Expired

**Problem**: Your token expired (default: 8 hours / 480 minutes).

**Solution**:
- **Log out and log in again** to get a fresh token
- The app should handle token refresh automatically, but if it doesn't, manually log out/in

---

### Issue 4: User Account Inactive

**Problem**: Your user account exists but is marked as inactive.

**Solution**:
1. Check user status in database:
   ```python
   # In Azure console or locally
   from app.database import SessionLocal
   from app.models import User
   db = SessionLocal()
   user = db.query(User).filter(User.username == "your_username").first()
   print(f"Active: {user.is_active}")
   ```

2. Activate the user:
   ```python
   user.is_active = True
   db.commit()
   ```

---

### Issue 5: Wrong API URL Format

**Problem**: The API URL might be missing `/api/v1` or have incorrect format.

**Correct Format**:
```
https://tally-system-api-awdvavfdgtexhyhu.southeastasia-01.azurewebsites.net/api/v1
```

**Check**:
1. Open Settings in mobile app
2. Go to "API URL (Testing)" section
3. Verify the URL ends with `/api/v1`
4. Make sure it starts with `https://` (not `http://`)

---

### Issue 6: Azure App Service Not Running

**Problem**: The Azure backend might be stopped or having issues.

**Solution**:
1. **Check Azure Portal**:
   - Go to your App Service
   - Check "Overview" → Status should be "Running"
   - Check "Log stream" for errors

2. **Test the API directly**:
   ```bash
   # Test health endpoint (no auth required)
   curl https://your-app.azurewebsites.net/health
   
   # Test login endpoint
   curl -X POST https://your-app.azurewebsites.net/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "admin123"}'
   ```

---

## Step-by-Step Debugging

### Step 1: Test Login Endpoint Directly

Use curl or Postman to test if login works:

```bash
curl -X POST https://your-azure-url.azurewebsites.net/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Expected Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**If this fails**:
- Check Azure App Service is running
- Check database connection
- Check user exists in database
- Check SECRET_KEY is set in Azure

---

### Step 2: Test with Mobile App

1. **Clear stored token**:
   - Log out from the app
   - Or clear app data (Settings → Apps → Tally System → Clear Data)

2. **Set Azure URL in Settings**:
   - Open Settings
   - Go to "API URL (Testing)"
   - Enter: `https://your-azure-url.azurewebsites.net/api/v1`
   - Tap "Save URL"

3. **Try to log in**:
   - Use credentials that exist in Azure database
   - Check for error messages

---

### Step 3: Check Network Tab

In your mobile app development tools (React Native Debugger or Expo DevTools):

1. **Check request URL**: Verify it's using the Azure URL
2. **Check request headers**: Should include `Content-Type: application/json`
3. **Check response**: Look at the actual error message

**Common errors**:
- `401 Unauthorized` → Authentication issue (see Issue 1-3)
- `403 Forbidden` → Authorization issue (see Issue 4)
- `Network Error` → Connection issue (check URL, check Azure is running)
- `CORS Error` → Shouldn't happen in mobile apps, but if it does, check CORS_ORIGINS setting

---

### Step 4: Check Azure Logs

1. **Go to Azure Portal** → Your App Service
2. **Click "Log stream"** in left menu
3. **Try to log in** from mobile app
4. **Watch the logs** for errors

**Look for**:
- Database connection errors
- Authentication errors
- Missing SECRET_KEY warnings
- User not found errors

---

## Quick Fixes

### Fix 1: Fresh Login with Azure URL

1. Clear app data or log out
2. Set Azure URL in Settings
3. Log in with Azure credentials
4. Should work now ✅

### Fix 2: Verify Azure Configuration

Check Azure App Service → Configuration → Application settings:

- ✅ `SECRET_KEY` is set (not empty)
- ✅ `DATABASE_URL` is correct
- ✅ `DEBUG` is set (True or False, doesn't matter for auth)
- ✅ `CORS_ORIGINS` is set (can be `*` for testing)

### Fix 3: Verify Database Has Users

SSH into Azure and check:
```bash
cd /home/site/wwwroot
python -c "
from app.database import SessionLocal
from app.models import User
db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f'{u.username} - Active: {u.is_active}')
"
```

If no users, create one:
```bash
python seed_admin.py
```

---

## CORS vs Authentication

**Important**: CORS (Cross-Origin Resource Sharing) is a **browser security feature**. Mobile apps (React Native/Expo) don't have the same CORS restrictions because they're not making requests from a browser.

**If you're getting 401/403 errors**, it's **NOT a CORS issue**. It's an authentication/authorization issue.

**CORS errors** would show up as:
- Network errors in browser console
- "CORS policy" error messages
- Requests being blocked before reaching the server

**401/403 errors** mean:
- ✅ Request reached the server
- ✅ Server processed the request
- ❌ Authentication/authorization failed

---

## Still Having Issues?

1. **Check Azure App Service logs** for detailed error messages
2. **Test the API directly** with curl/Postman to isolate the issue
3. **Verify database connection** in Azure
4. **Verify SECRET_KEY** is set correctly in Azure
5. **Try logging in with a fresh token** (log out and log in again)

---

## Testing Checklist

- [ ] Azure App Service is running
- [ ] API URL is correct (ends with `/api/v1`)
- [ ] Can access `/health` endpoint (no auth)
- [ ] Can login via curl/Postman
- [ ] User exists in Azure database
- [ ] User account is active
- [ ] SECRET_KEY is set in Azure
- [ ] Mobile app has correct API URL set
- [ ] Logged out and logged in fresh with Azure URL
- [ ] Checked Azure logs for errors









