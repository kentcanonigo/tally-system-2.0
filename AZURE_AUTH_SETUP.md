# Azure Authentication Setup - Quick Reference

This is a quick checklist for setting up authentication when deploying to Azure.

## Prerequisites

✅ Backend code updated (authentication system implemented)
✅ `.env` file configured locally with SECRET_KEY
✅ Default admin user tested locally

## Step 1: Generate Production SECRET_KEY

**Run this command locally:**

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Example output:** `wXK9x3_vJmQ4hR2nP8fL5aY1bZ0cM7tU6iN4oE9wS2k`

⚠️ **Save this key securely!** You'll need it for Azure configuration.

⚠️ **Use a DIFFERENT key for production than your local development!**

---

## Step 2: Configure Azure App Service

### Go to Azure Portal:

1. Navigate to your App Service (e.g., `tally-system-api`)
2. Click **Configuration** in the left menu
3. Click **Application settings** tab
4. Click **+ New application setting**

### Add these settings (one at a time):

| Name | Value | Notes |
|------|-------|-------|
| `SECRET_KEY` | `<your-generated-key>` | From Step 1 - REQUIRED |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | 8 hours token lifetime |
| `CORS_ORIGINS` | `https://your-static-web-app.azurestaticapps.net` | Optional but recommended |
| `DEBUG` | `False` | Set to False for production (security) |

### Save and Restart:

5. Click **Save** at the top
6. Click **Continue** when prompted (this will restart your app)

---

## Step 3: Deploy Your Code

Your GitHub Actions workflow (`.github/workflows/backend.yml`) is already configured to:
1. Run database migrations (`alembic upgrade head`)
2. Create/update default admin user (`python seed_admin.py`)
3. Start the server

**Just push your code:**

```bash
git add .
git commit -m "Add authentication system"
git push origin main
```

GitHub Actions will automatically deploy to Azure.

---

## Step 4: Verify Deployment

### Test the API health:

```bash
curl https://your-app.azurewebsites.net/
```

### Test authentication:

```bash
curl -X POST https://your-app.azurewebsites.net/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Expected response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Test with the token:

```bash
curl https://your-app.azurewebsites.net/api/v1/auth/me \
  -H "Authorization: Bearer <token-from-previous-response>"
```

---

## Step 5: Login and Change Password

1. Go to your web dashboard: `https://your-static-web-app.azurestaticapps.net`
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. **IMMEDIATELY** go to Users page and change the admin password
4. Create additional admin users if needed

---

## Troubleshooting

### Issue: 401 Unauthorized after login

**Cause:** SECRET_KEY not set or different from when token was created

**Fix:**
1. Verify SECRET_KEY is set in Azure Configuration
2. Restart the App Service
3. Clear browser localStorage and login again

### Issue: "Module not found: email-validator"

**Cause:** Dependencies not installed properly

**Fix:**
1. Check Deployment Center → Logs to see if build succeeded
2. Verify `requirements.txt` includes `email-validator>=2.0.0`
3. Redeploy

### Issue: No admin user exists

**Cause:** `seed_admin.py` didn't run

**Fix:**
1. Go to App Service → SSH
2. Run: `cd /home/site/wwwroot && python seed_admin.py`

### Issue: CORS errors in browser console

**Cause:** Frontend URL not in CORS_ORIGINS

**Fix:**
1. Add `CORS_ORIGINS` environment variable with your Static Web App URL
2. Restart App Service

---

## Security Checklist

- [ ] Different SECRET_KEY for production vs development
- [ ] SECRET_KEY is at least 32 characters and randomly generated
- [ ] Default admin password changed after first login
- [ ] CORS_ORIGINS set to specific domains (not `*`)
- [ ] DEBUG set to `False` in production
- [ ] HTTPS enabled (Azure does this automatically)

---

## Environment Variables Summary

**Required:**
- `DATABASE_URL` - Azure SQL connection string
- `SECRET_KEY` - JWT signing key (keep secret!)

**Recommended:**
- `ALGORITHM` - `HS256` (default)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - `480` (8 hours)
- `CORS_ORIGINS` - Your frontend URL
- `DEBUG` - `False` for production

**Optional:**
- `API_V1_PREFIX` - `/api/v1` (default)

---

## Need Help?

- See **[AUTH_GUIDE.md](backend/AUTH_GUIDE.md)** for detailed authentication documentation
- See **[AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)** for full Azure deployment guide
- See **[BACKEND_DEVELOPER_GUIDE.md](backend/BACKEND_DEVELOPER_GUIDE.md)** for API documentation

---

*Quick reference guide for Azure authentication setup*
*Last updated: Based on current implementation*

