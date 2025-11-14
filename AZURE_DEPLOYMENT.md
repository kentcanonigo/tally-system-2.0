# Azure Free Tier Deployment Guide

This guide will help you deploy the Tally System to Azure using free tier services.

## Prerequisites

- Azure account (sign up at https://azure.microsoft.com/free/)
- GitHub account (for CI/CD)
- Git installed locally

## Azure Free Tier Services We'll Use

1. **Azure App Service (Free Tier)** - Backend API
2. **Azure Static Web Apps (Free Tier)** - Web Dashboard
3. **Azure Database for PostgreSQL (Free Tier)** - Database (or Azure SQL Database)

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

## Step 3: Create Database (PostgreSQL)

### Option A: Azure Database for PostgreSQL (Free Tier)

1. In Azure Portal, search for "Azure Database for PostgreSQL"
2. Click "Create"
3. Choose "Flexible server" (free tier available)
4. Fill in:
   - **Server name**: `tally-system-db` (must be unique globally)
   - **Region**: Same as resource group
   - **PostgreSQL version**: 15
   - **Compute + storage**: Click "Configure server"
     - **Compute tier**: Burstable
     - **Compute size**: B1ms (1 vCore, 2GB RAM) - Free eligible
     - **Storage**: 32 GB (minimum)
   - **Admin username**: `tallyadmin` (remember this!)
   - **Password**: Create a strong password (save it!)
5. Click "Review + create" then "Create"
6. Wait for deployment (5-10 minutes)

### Option B: Azure SQL Database (Free Tier Alternative)

If PostgreSQL free tier isn't available in your region:

1. Search for "SQL databases"
2. Click "Create"
3. Fill in:
   - **Database name**: `tally-system-db`
   - **Server**: Create new
     - **Server name**: `tally-system-sql` (unique globally)
     - **Location**: Same as resource group
     - **Authentication method**: SQL authentication
     - **Admin username**: `tallyadmin`
     - **Password**: Strong password
   - **Compute + storage**: Basic tier (free eligible)
4. Click "Review + create" then "Create"

**Note**: If using SQL Database, you'll need to update the backend to use `pyodbc` instead of `psycopg2`.

## Step 4: Configure Database Firewall

1. Go to your database server
2. Click "Networking" in left menu
3. Under "Firewall rules":
   - Click "Add current client IP address"
   - Click "Allow Azure services and resources" (enable this)
   - Click "Save"

## Step 5: Get Database Connection String

### For PostgreSQL:

1. Go to your PostgreSQL server
2. Click "Connection strings" in left menu
3. Copy the "psycopg2" connection string
4. It will look like:
   ```
   postgresql://tallyadmin:YOUR_PASSWORD@tally-system-db.postgres.database.azure.com:5432/postgres
   ```

### For SQL Database:

1. Go to your SQL database
2. Click "Connection strings" in left menu
3. Copy the "ADO.NET" connection string
4. Format it for SQLAlchemy:
   ```
   mssql+pyodbc://tallyadmin:YOUR_PASSWORD@tally-system-sql.database.windows.net:1433/tally-system-db?driver=ODBC+Driver+17+for+SQL+Server
   ```

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
   DATABASE_URL = postgresql://tallyadmin:PASSWORD@tally-system-db.postgres.database.azure.com:5432/postgres
   API_V1_PREFIX = /api/v1
   DEBUG = False
   ```

   (Replace PASSWORD with your actual database password)

5. Click "Save"
6. Click "Continue" when prompted

### 6.3 Enable PostgreSQL Driver

1. In App Service, go to "SSH" in left menu
2. Click "Go" to open SSH terminal
3. Run:
   ```bash
   pip install psycopg2-binary
   ```

   Or add it to requirements.txt before deploying.

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
- Verify connection string is correct
- Check App Service logs: App Service → Log stream

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

- **PostgreSQL Free Tier**:
  - 32 GB storage
  - 750 hours/month
  - Basic performance tier

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

