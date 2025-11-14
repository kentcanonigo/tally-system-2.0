# Azure Quick Start - 15 Minute Setup

Quick guide to get your Tally System running on Azure free tier.

## Prerequisites Checklist

- [ ] Azure account (https://azure.microsoft.com/free/)
- [ ] GitHub account
- [ ] Code pushed to GitHub repository

## Step-by-Step (15 minutes)

### 1. Create Resource Group (2 min)

1. Azure Portal → Search "Resource groups" → Create
2. Name: `tally-system-rg`
3. Region: `East US` (or closest)
4. Create

### 2. Create Database (5 min)

1. Search "Azure Database for PostgreSQL" → Create
2. Choose "Flexible server"
3. Fill in:
   - Server name: `tally-system-db-XXXX` (add random numbers for uniqueness)
   - Region: Same as resource group
   - Compute: B1ms (free tier)
   - Admin: `tallyadmin`
   - Password: **Save this password!**
4. Create → Wait 5 minutes

**Get Connection String:**
- Go to database → Connection strings
- Copy PostgreSQL connection string
- Format: `postgresql://tallyadmin:PASSWORD@SERVER.postgres.database.azure.com:5432/postgres`

### 3. Configure Database Firewall (1 min)

1. Database → Networking
2. Enable "Allow Azure services"
3. Add your IP address
4. Save

### 4. Create App Service for Backend (3 min)

1. Search "App Services" → Create
2. Fill in:
   - Name: `tally-system-api-XXXX` (unique)
   - Runtime: Python 3.11
   - OS: Linux
   - Plan: Create new → Free (F1)
3. Create → Wait 2 minutes

**Configure Environment:**
1. App Service → Configuration → Application settings
2. Add:
   ```
   DATABASE_URL = postgresql://tallyadmin:PASSWORD@SERVER.postgres.database.azure.com:5432/postgres
   API_V1_PREFIX = /api/v1
   DEBUG = False
   ```
3. Save

**Deploy Code:**
1. App Service → Deployment Center
2. Source: GitHub
3. Connect your repo: `tally-system-2.0`
4. Branch: `main`
5. Build: GitHub Actions
6. Save

### 5. Create Static Web App for Frontend (3 min)

1. Search "Static Web Apps" → Create
2. Fill in:
   - Name: `tally-system-web`
   - Plan: Free
   - Source: GitHub
   - Repo: `tally-system-2.0`
   - Branch: `main`
   - Build: Custom
   - App location: `/web`
   - Output: `dist`
3. Create

**Configure API URL:**
1. Static Web App → Configuration
2. Add setting:
   ```
   VITE_API_URL = https://YOUR-APP-SERVICE-NAME.azurewebsites.net/api/v1
   ```
3. Save

### 6. Update Backend CORS (1 min)

Edit `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://YOUR-STATIC-WEB-APP.azurestaticapps.net",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit and push to trigger deployment.

### 7. Run Migrations (1 min)

After backend deploys:

1. App Service → SSH (or Console)
2. Run:
   ```bash
   cd /home/site/wwwroot
   alembic upgrade head
   ```

### 8. Test (1 min)

- Backend: `https://YOUR-APP-SERVICE.azurewebsites.net/docs`
- Frontend: `https://YOUR-STATIC-WEB-APP.azurestaticapps.net`

## URLs to Save

- **Backend API**: `https://tally-system-api-XXXX.azurewebsites.net`
- **API Docs**: `https://tally-system-api-XXXX.azurewebsites.net/docs`
- **Web Dashboard**: `https://tally-system-web.azurestaticapps.net`
- **Database**: `tally-system-db-XXXX.postgres.database.azure.com`

## Common Issues

**Backend won't start:**
- Check App Service → Log stream
- Verify DATABASE_URL is correct
- Check if migrations ran

**Frontend can't connect:**
- Verify VITE_API_URL setting
- Check CORS configuration
- Look at browser console

**Database connection fails:**
- Check firewall rules
- Verify connection string
- Ensure "Allow Azure services" is enabled

## Next Steps

1. Set up custom domain (optional)
2. Configure backups
3. Set up monitoring
4. Add authentication if needed

## Cost

All services are on free tier - $0/month as long as you stay within limits.

See `AZURE_DEPLOYMENT.md` for detailed instructions.

