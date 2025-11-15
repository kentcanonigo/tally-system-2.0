# Web App White Screen Troubleshooting Guide

## Common Causes of White Screen

### 1. Missing Routing Configuration ✅ FIXED
**Issue**: Azure Static Web Apps needs `staticwebapp.config.json` for React Router to work.

**Solution**: Created `web/staticwebapp.config.json` with proper fallback routing.

### 2. API URL Not Configured
**Issue**: The app tries to connect to the API but `VITE_API_URL` is not set.

**Check**:
1. Go to GitHub → Your Repo → Settings → Secrets and variables → Actions
2. Verify `VITE_API_URL` secret exists
3. Value should be: `https://tally-system-api.azurewebsites.net/api/v1`

**Fix**:
```bash
# In GitHub Secrets, add:
VITE_API_URL = https://tally-system-api.azurewebsites.net/api/v1
```

### 3. CORS Issues
**Issue**: Backend is blocking requests from the web app.

**Check Backend CORS Settings**:
- Go to `backend/app/main.py`
- Verify CORS middleware allows your static web app domain

**Current setting** (should work):
```python
allow_origins=["*"]  # Allows all origins
```

### 4. JavaScript Errors
**How to Debug**:
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for red error messages
4. Go to **Network** tab
5. Check if API requests are failing

### 5. Build Output Location
**Issue**: Azure Static Web Apps can't find the built files.

**Check**:
- GitHub Actions workflow should have:
  ```yaml
  output_location: "dist"
  ```
- Verify `web/dist` folder exists after build

### 6. Environment Variables Not Available at Runtime
**Issue**: Vite environment variables need to be prefixed with `VITE_` and available at build time.

**Check**:
- Variables must be set in GitHub Secrets **before** building
- They're baked into the build, not available at runtime
- Check build logs in GitHub Actions to verify they're being used

## Step-by-Step Debugging

### Step 1: Check Browser Console
1. Open your static web app URL
2. Press F12 to open DevTools
3. Check **Console** for errors
4. Check **Network** tab for failed requests

### Step 2: Verify API URL
1. In browser console, run:
   ```javascript
   console.log(import.meta.env.VITE_API_URL)
   ```
2. Should show: `https://tally-system-api.azurewebsites.net/api/v1`
3. If `undefined`, the secret wasn't set during build

### Step 3: Test API Connection
1. In browser console, run:
   ```javascript
   fetch('https://tally-system-api.azurewebsites.net/api/v1/health')
     .then(r => r.json())
     .then(console.log)
   ```
2. Should return: `{status: "healthy"}`
3. If it fails, check CORS or backend status

### Step 4: Check GitHub Actions Build Logs
1. Go to GitHub → Actions
2. Find the latest workflow run for frontend
3. Check build logs for:
   - `VITE_API_URL` being set
   - Build completing successfully
   - Files being deployed

### Step 5: Verify Static Web App Configuration
1. Go to Azure Portal → Static Web App
2. Check **Configuration** → **Application settings**
3. Verify no conflicting settings

## Quick Fixes

### Fix 1: Rebuild with Correct API URL
1. Add/update `VITE_API_URL` in GitHub Secrets
2. Push a commit to trigger rebuild:
   ```bash
   git commit --allow-empty -m "Trigger rebuild"
   git push origin main
   ```

### Fix 2: Check Backend is Running
1. Visit: `https://tally-system-api.azurewebsites.net/health`
2. Should return: `{"status":"healthy"}`
3. If not, check backend logs

### Fix 3: Verify Routing Config
1. Ensure `web/staticwebapp.config.json` exists
2. Content should match what was created
3. File should be in the `web/` directory (not `web/dist/`)

### Fix 4: Clear Browser Cache
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or clear cache and reload

## Expected Behavior

After fixes, you should see:
1. ✅ Sidebar with navigation menu
2. ✅ Dashboard page loads
3. ✅ API calls succeed (check Network tab)
4. ✅ No console errors

## Still Not Working?

1. **Check GitHub Actions logs** - Look for build errors
2. **Check Azure Static Web App logs** - Go to Azure Portal → Log stream
3. **Test API directly** - Use Postman or curl
4. **Verify all secrets are set** - Check GitHub Secrets
5. **Check browser compatibility** - Try different browser

## Common Error Messages

### "Failed to fetch"
- **Cause**: CORS issue or API not accessible
- **Fix**: Check backend CORS settings and API URL

### "Cannot read property of undefined"
- **Cause**: API response not in expected format
- **Fix**: Check API response structure matches frontend types

### "404 Not Found" on routes
- **Cause**: Missing `staticwebapp.config.json`
- **Fix**: Ensure file exists and is committed

### Blank page with no errors
- **Cause**: JavaScript bundle not loading
- **Fix**: Check build output, verify `dist` folder structure

