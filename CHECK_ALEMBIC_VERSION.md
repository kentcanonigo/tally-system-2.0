# How to Check Alembic Version in Azure SQL Database

## Method 1: Azure Portal Query Editor (Easiest - No Tools Needed)

1. **Go to Azure Portal** (https://portal.azure.com)
2. **Navigate to your SQL Database**:
   - Search for "SQL databases" in the top search bar
   - Click on your database (e.g., `tally-system-db`)
3. **Open Query Editor**:
   - In the left menu, click **"Query editor (preview)"**
   - You may need to sign in with your database credentials:
     - **SQL authentication**: Use your database admin username and password
     - Server: `tally-system-sql.database.windows.net` (or your server name)
     - Database: `tally-system-db`
     - Username: `tallyadmin` (or your admin username)
     - Password: Your database password
4. **Run the query**:
   ```sql
   SELECT version_num FROM alembic_version;
   ```
5. **Check the result**:
   - It should show something like: `020_add_frozen_category`
   - If it shows `021_add_tally_log_entry_permissions` (or truncated), the migration partially applied

**Also check if permissions were created (indicating partial migration):**
```sql
SELECT code FROM permissions 
WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries');
```

If this returns rows, the migration partially applied and you'll need to clean it up.

---

## Method 2: Azure Data Studio (Free GUI Tool)

1. **Download Azure Data Studio**: https://aka.ms/azuredatastudio
2. **Install and open Azure Data Studio**
3. **Connect to your database**:
   - Click "New Connection"
   - **Server**: `tally-system-sql.database.windows.net` (or your server name)
   - **Authentication type**: SQL Login
   - **User name**: `tallyadmin` (or your admin username)
   - **Password**: Your database password
   - **Database**: `tally-system-db`
   - Click "Connect"
4. **Run the query**:
   - Click "New Query"
   - Paste: `SELECT version_num FROM alembic_version;`
   - Press F5 or click "Run"

---

## Method 3: SQL Server Management Studio (SSMS)

1. **Download SSMS**: https://aka.ms/ssmsfullsetup
2. **Connect to your database**:
   - Server name: `tally-system-sql.database.windows.net,1433`
   - Authentication: SQL Server Authentication
   - Login: `tallyadmin` (or your admin username)
   - Password: Your database password
3. **Run the query**:
   - Right-click your database → "New Query"
   - Paste: `SELECT version_num FROM alembic_version;`
   - Execute

---

## Method 4: Azure Cloud Shell (Command Line)

1. **Open Azure Cloud Shell**:
   - Go to Azure Portal
   - Click the Cloud Shell icon (top right: `>_`)
2. **Install sqlcmd** (if not already installed):
   ```bash
   # Usually already available in Cloud Shell
   ```
3. **Connect and query**:
   ```bash
   sqlcmd -S tally-system-sql.database.windows.net -d tally-system-db -U tallyadmin -P 'YOUR_PASSWORD' -Q "SELECT version_num FROM alembic_version;"
   ```

---

## Method 5: Via Azure App Service SSH/Console

1. **Go to your App Service** in Azure Portal
2. **Open SSH**:
   - In the left menu, click **"SSH"** (under Development Tools)
   - Or go to **"Console"** (under Development Tools)
3. **Run Python script**:
   ```bash
   cd /home/site/wwwroot
   python3 -c "
   import os
   from sqlalchemy import create_engine, text
   from app.config import settings
   
   engine = create_engine(settings.database_url)
   with engine.connect() as conn:
       result = conn.execute(text('SELECT version_num FROM alembic_version'))
       print('Current version:', result.scalar())
   "
   ```

---

## What to Do Based on Results

### If version shows `020_add_frozen_category`:
✅ **Good!** The migration rolled back properly. Just deploy the fixed code and it should work.

### If version shows `021_add_tally_log_entry_permissions` (or truncated):
❌ **Problem!** The version was partially updated. You need to:
1. Manually update the version:
   ```sql
   UPDATE alembic_version SET version_num = '020_add_frozen_category';
   ```
2. Check if permissions were created and delete them if they exist:
   ```sql
   -- Check if they exist
   SELECT code FROM permissions 
   WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries');
   
   -- If they exist, delete them (and their role_permissions)
   DELETE FROM role_permissions 
   WHERE permission_id IN (
       SELECT id FROM permissions 
       WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries')
   );
   
   DELETE FROM permissions 
   WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries');
   ```
3. Then deploy the fixed code.

### If permissions exist but version is `020_add_frozen_category`:
⚠️ **Partial migration!** The upgrade() ran but the version update failed. Clean up:
```sql
-- Delete role_permissions first (foreign key constraint)
DELETE FROM role_permissions 
WHERE permission_id IN (
    SELECT id FROM permissions 
    WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries')
);

-- Then delete permissions
DELETE FROM permissions 
WHERE code IN ('can_edit_tally_log_entries', 'can_delete_tally_log_entries', 'can_transfer_tally_log_entries');
```

Then deploy the fixed code.


