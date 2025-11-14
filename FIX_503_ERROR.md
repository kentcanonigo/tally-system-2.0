# Fix 503 Error - "alembic: Permission denied"

## The Problem

The error `alembic: Permission denied` means Azure App Service hasn't installed your Python dependencies yet. Azure needs to build/install dependencies from `requirements.txt` before running your startup command.

## Solution Steps

### Step 1: Enable Build During Deployment

1. Go to Azure Portal → Your App Service (`tally-system-api`)
2. Click **Configuration** → **General settings**
3. Find **SCM_DO_BUILD_DURING_DEPLOYMENT** (or search for it)
4. Set it to **True** (should already be enabled, but verify)
5. Click **Save**

### Step 2: Set Python Version

1. In the same **Configuration** → **General settings** page
2. Verify **Stack** is set to **Python 3.11** (not 3.13)
3. If it shows 3.13, change it to **3.11**
4. Click **Save**

### Step 3: Verify Requirements.txt Location

Azure needs `requirements.txt` in the root of your deployment:
- Should be at: `/home/site/wwwroot/requirements.txt`

**Check via Kudu:**
1. Go to: `https://tally-system-api.scm.azurewebsites.net`
2. Click **Debug console** → **CMD**
3. Navigate to `site/wwwroot`
4. Verify `requirements.txt` exists

### Step 4: Trigger a New Deployment

Azure needs to rebuild with dependencies. Options:

**Option A: Redeploy via GitHub Actions**
1. Make a small change to trigger deployment:
   ```bash
   echo "" >> backend/app/main.py
   git add backend/app/main.py
   git commit -m "Trigger rebuild"
   git push origin main
   ```

**Option B: Use Deployment Center**
1. Go to App Service → **Deployment Center**
2. Click **Sync** or **Redeploy**
3. Wait for deployment to complete

**Option C: Manual Build via SSH**
1. Go to App Service → **SSH**
2. Run:
   ```bash
   cd /home/site/wwwroot
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

### Step 5: Update Startup Command

1. Go to **Configuration** → **General settings**
2. Set **Startup Command** to:
   ```
   source antenv/bin/activate && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   
   Or if virtual env doesn't exist:
   ```
   python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. Click **Save**
4. **Restart** the app service

### Step 6: Check Deployment Logs

1. Go to **Deployment Center** → **Logs**
2. Look for build output
3. Verify you see:
   - "Detected Python app"
   - "Installing dependencies from requirements.txt"
   - "Successfully installed..."

## Alternative: Use Python Module Syntax

If alembic still isn't found, use Python module syntax in startup command:

```
python -m alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Quick Fix Summary

1. **Set Python version to 3.11** (not 3.13)
2. **Enable SCM_DO_BUILD_DURING_DEPLOYMENT = True**
3. **Redeploy** to trigger build
4. **Update startup command** to use `python -m` prefix
5. **Restart** app service

## Verify It Works

After fixing, check:
- `https://tally-system-api.azurewebsites.net/health` - Should return `{"status": "healthy"}`
- `https://tally-system-api.azurewebsites.net/docs` - Should show Swagger UI

