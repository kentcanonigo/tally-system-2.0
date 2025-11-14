# Azure Free Tier Deployment Guide

This guide will help you deploy the Tally System to Azure using free tier services.

## Prerequisites

- Azure account (sign up at https://azure.microsoft.com/free/)
- GitHub account (for CI/CD)
- Git installed locally

## Azure Free Tier Services We'll Use

1. **Azure App Service (Free Tier)** - Backend API
2. **Azure Static Web Apps (Free Tier)** - Web Dashboard
3. **Azure SQL Database (Free Tier)** - Database

## Step 1: Azure Account Setup

1. Go to https://azure.microsoft.com/free/
2. Sign up for a free account (requires credit card, but won't be charged for free tier)
3. Verify your account
4. Go to Azure Portal: https://portal.azure.com

## Step 2: Create Resource Group

1. In Azure Portal, search for "Resource groups"
2. Click "Create"
3. Name: `tally-system-rg`
4. Region: Choose closest to you (e.g., `East US`, `West Europe`)
5. Click "Review + create" then "Create"

## Step 3: Create Database (Azure SQL Database)

1. In Azure Portal, search for "SQL databases"
2. Click "Create"
3. Fill in:
   - **Database name**: `tally-system-db`
   - **Subscription**: Your subscription
   - **Resource group**: `tally-system-rg` (created in Step 2)
   - **Server**: Click "Create new"
     - **Server name**: `tally-system-sql-XXXX` (must be unique globally, add random numbers)
     - **Location**: Same as resource group
     - **Authentication method**: Use SQL authentication
     - **Server admin login**: `tallyadmin` (remember this!)
     - **Password**: Create a strong password (save it!)
     - **Confirm password**: Re-enter password
     - Click "OK"
   - **Want to use SQL elastic pool?**: No
   - **Compute + storage**: Click "Configure database"
     - **Service tier**: Basic (free tier eligible)
     - **Compute size**: Basic (5 DTU)
     - Click "Apply"
4. Click "Review + create" then "Create"
5. Wait for deployment (2-3 minutes)

## Step 4: Configure Database Firewall

1. Go to your database server
2. Click "Networking" in left menu
3. Under "Firewall rules":
   - Click "Add current client IP address"
   - Click "Allow Azure services and resources" (enable this)
   - Click "Save"

## Step 5: Get Database Connection String

1. Go to your SQL database in Azure Portal
2. Click "Connection strings" in left menu
3. Copy the "ADO.NET (SQL authentication)" connection string
4. It will look like this:
   ```
   Server=tcp:tally-system-sql.database.windows.net,1433;Initial Catalog=tally-system-db;Persist Security Info=False;User ID=tallyadmin;Password={your_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
   ```

5. Convert it to SQLAlchemy format:
   
   **From ADO.NET format:**
   ```
   Server=tcp:SERVER_NAME.database.windows.net,1433;Initial Catalog=DATABASE_NAME;User ID=USERNAME;Password=PASSWORD;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
   ```
   
   **To SQLAlchemy format:**
   ```
   mssql+pyodbc://USERNAME:PASSWORD@SERVER_NAME.database.windows.net:1433/DATABASE_NAME?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30
   ```
   
   **Example conversion:**
   - ADO.NET: `Server=tcp:tally-system-sql.database.windows.net,1433;Initial Catalog=tally-system-db;User ID=tallyadmin;Password=MyPass123!;...`
   - SQLAlchemy: `mssql+pyodbc://tallyadmin:MyPass123!@tally-system-sql.database.windows.net:1433/tally-system-db?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30`
   
   **Quick conversion steps:**
   1. Extract values from ADO.NET string:
      - `Server=tcp:...` → Server name (remove `tcp:` and `,1433`)
      - `Initial Catalog=...` → Database name
      - `User ID=...` → Username
      - `Password=...` → Password (replace `{your_password}` with actual password)
   2. Format as: `mssql+pyodbc://USERNAME:PASSWORD@SERVER:1433/DATABASE?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30`
   
   **Note**: If your password contains special characters, URL encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`
   - `%` → `%25`
   - `&` → `%26`
   - `+` → `%2B`
   - `=` → `%3D`
   
   **Or use the helper script**: Run `python backend/convert_connection_string.py` to automatically convert your ADO.NET string.

## Step 6: Deploy Backend (Azure App Service)

### 6.1 Create App Service

1. In Azure Portal, search for "App Services"
2. Click "Create"
3. Fill in:
   - **Name**: `tally-system-api` (must be unique globally)
   - **Publish**: Code
   - **Runtime stack**: Python 3.11
   - **Operating System**: Linux
   - **Region**: Same as resource group
   - **App Service Plan**: Click "Create new"
     - **Name**: `tally-system-plan`
     - **Sku and size**: Free F1 (if available) or Basic B1
4. Click "Review + create" then "Create"
5. Wait for deployment (2-3 minutes)

### 6.2 Configure Environment Variables

1. Go to your App Service
2. Click "Configuration" in left menu
3. Click "+ New application setting"
4. Add these settings:

   ```
   DATABASE_URL = mssql+pyodbc://tallyadmin:PASSWORD@tally-system-sql-XXXX.database.windows.net:1433/tally-system-db?driver=ODBC+Driver+17+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30
   API_V1_PREFIX = /api/v1
   DEBUG = False
   ```

   (Replace PASSWORD with your actual database password and tally-system-sql-XXXX with your server name)

5. Click "Save"
6. Click "Continue" when prompted

### 6.3 Install SQL Server Driver

The backend needs `pyodbc` and ODBC Driver for SQL Server. These are already included in the updated requirements.txt.

**Note**: Azure App Service Linux comes with ODBC Driver 17 for SQL Server pre-installed, so you don't need to install it separately.

### 6.4 Deploy Backend Code

**Option A: Using GitHub Actions (Recommended)**

1. Push your code to GitHub (if not already):
   ```bash
   git add .
   git commit -m "Ready for Azure deployment"
   git push origin main
   ```

2. In Azure Portal, go to your App Service
3. Click "Deployment Center" in left menu
4. Choose:
   - **Source**: GitHub
   - **Organization**: Your GitHub username
   - **Repository**: tally-system-2.0
   - **Branch**: main
   - **Build provider**: GitHub Actions
5. Click "Save"
6. Azure will create a GitHub Actions workflow
7. Go to GitHub → Actions tab to see deployment progress

**Option B: Using Azure CLI**

```bash
# Install Azure CLI: https://aka.ms/installazurecliwindows

# Login
az login

# Deploy
cd backend
az webapp up --name tally-system-api --resource-group tally-system-rg --runtime "PYTHON:3.11"
```

**Option C: Using VS Code Azure Extension**

1. Install "Azure App Service" extension in VS Code
2. Right-click backend folder → "Deploy to Web App"
3. Select your App Service

### 6.5 Run Database Migrations

After deployment, run migrations:

1. Go to App Service → "SSH" or "Console"
2. Run:
   ```bash
   cd /home/site/wwwroot
   alembic upgrade head
   ```

Or add to startup command in App Service → Configuration → General settings:
```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Step 7: Deploy Web Dashboard (Azure Static Web Apps)

### 7.1 Create Static Web App

1. In Azure Portal, search for "Static Web Apps"
2. Click "Create"
3. Fill in:
   - **Name**: `tally-system-web`
   - **Plan type**: Free
   - **Region**: Same as resource group
   - **Deployment details**: GitHub
   - **GitHub account**: Sign in and authorize
   - **Organization**: Your username
   - **Repository**: tally-system-2.0
   - **Branch**: main
   - **Build Presets**: Custom
   - **App location**: `/web`
   - **Api location**: (leave empty)
   - **Output location**: `dist`
4. Click "Review + create" then "Create"
5. Azure will create a GitHub Actions workflow automatically

### 7.2 Configure Environment Variables

1. Go to your Static Web App
2. Click "Configuration" in left menu
3. Click "+ Add" under "Application settings"
4. Add:
   ```
   VITE_API_URL = https://tally-system-api.azurewebsites.net/api/v1
   ```
   (Replace with your actual App Service URL)

5. Click "OK" then "Save"

### 7.3 Update Web Build Configuration

The GitHub Actions workflow will be created automatically. Check `.github/workflows/azure-static-web-apps-*.yml` and ensure it builds correctly.

## Step 8: Update Mobile App API URL

Update `mobile/src/services/api.ts`:

```typescript
const API_BASE_URL = 'https://tally-system-api.azurewebsites.net/api/v1';
```

## Step 9: Configure CORS

The backend already has CORS configured to allow all origins. For production, update `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tally-system-web.azurestaticapps.net",  # Your Static Web App URL
        "http://localhost:3000",  # For local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Step 10: Test Deployment

1. **Backend API**:
   - Go to: `https://tally-system-api.azurewebsites.net/docs`
   - Test endpoints

2. **Web Dashboard**:
   - Go to: `https://tally-system-web.azurestaticapps.net`
   - Should load and connect to API

3. **Database**:
   - Create a customer via API
   - Verify it appears in dashboard

## Step 11: Set Up Custom Domains (Optional)

### For App Service:
1. Go to App Service → Custom domains
2. Add your domain
3. Follow DNS configuration instructions

### For Static Web Apps:
1. Go to Static Web App → Custom domains
2. Add your domain
3. Configure DNS records

## Troubleshooting

### Backend Issues

**Database connection errors:**
- Check firewall rules allow Azure services
- Verify connection string format (must use `mssql+pyodbc://` prefix)
- Ensure ODBC Driver 17 is available (pre-installed on Azure App Service Linux)
- Check App Service logs: App Service → Log stream
- Verify server name and database name are correct

**Migration errors:**
- SSH into App Service
- Run: `alembic upgrade head` manually
- Check logs: `alembic current`

**Module not found:**
- Ensure all dependencies in requirements.txt
- Check App Service → Deployment Center → Logs

### Frontend Issues

**API connection errors:**
- Verify VITE_API_URL is set correctly
- Check browser console for CORS errors
- Verify backend is running

**Build failures:**
- Check GitHub Actions logs
- Verify build configuration in workflow file

### Database Issues

**Connection timeout:**
- Check firewall rules
- Verify server is running
- Check connection string format

## Cost Monitoring

1. Go to Azure Portal → Cost Management + Billing
2. Set up budget alerts
3. Monitor usage to stay within free tier limits

## Free Tier Limits

- **App Service Free (F1)**: 
  - 1 GB storage
  - 60 minutes compute/day
  - No custom domains
  - No SSL certificates

- **Static Web Apps Free**:
  - 100 GB bandwidth/month
  - Unlimited sites

- **Azure SQL Database Free Tier**:
  - Basic tier (5 DTU)
  - 2 GB storage
  - Free for 12 months (then pay-as-you-go)
  - Note: Free tier may have limited availability in some regions

## Next Steps

1. Set up monitoring and alerts
2. Configure backup for database
3. Set up staging environment
4. Implement authentication (if needed)
5. Set up CI/CD pipelines

## Useful Commands

```bash
# Azure CLI login
az login

# List resource groups
az group list

# List app services
az webapp list

# View app service logs
az webapp log tail --name tally-system-api --resource-group tally-system-rg

# Restart app service
az webapp restart --name tally-system-api --resource-group tally-system-rg
```

## Support Resources

- Azure Documentation: https://docs.microsoft.com/azure
- Azure Free Account FAQ: https://azure.microsoft.com/free/free-account-faq/
- Azure Status: https://status.azure.com/

