## Session Details Screen
- Show error message when adding allocation that already exists (400 bad request)

## Azure Deployment - Authentication Setup

### Before Deploying:
- [ ] Generate production SECRET_KEY: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
- [ ] Save the generated SECRET_KEY securely (you'll need it for Azure configuration)

### In Azure Portal (App Service Configuration):
1. [ ] Go to Azure Portal → Your App Service → Configuration → Application settings
2. [ ] Click "+ New application setting" and add:
   - [ ] Name: `SECRET_KEY`, Value: `<your-generated-secret-key>`
   - [ ] Name: `ALGORITHM`, Value: `HS256`
   - [ ] Name: `ACCESS_TOKEN_EXPIRE_MINUTES`, Value: `480`
   - [ ] (Optional) Name: `CORS_ORIGINS`, Value: `https://your-static-web-app-url.azurestaticapps.net`
3. [ ] Click "Save" at the top
4. [ ] Click "Continue" when prompted to restart the app service

### After First Deployment:
- [ ] Test backend health: Visit `https://your-app.azurewebsites.net/`
- [ ] Test login endpoint: `curl -X POST https://your-app.azurewebsites.net/api/v1/auth/login -H "Content-Type: application/json" -d '{"username": "admin", "password": "admin123"}'`
- [ ] Log in to web dashboard and change admin password immediately
- [ ] Create additional admin users if needed via Users page

### Important Notes:
- ⚠️ Use a DIFFERENT SECRET_KEY for production than local development
- ⚠️ Never commit SECRET_KEY to git
- ⚠️ Change default admin password (admin123) immediately after first login
- 📖 See `backend/AUTH_GUIDE.md` for detailed authentication documentation

