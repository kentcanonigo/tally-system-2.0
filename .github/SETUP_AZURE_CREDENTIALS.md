# Setting Up Azure Credentials for GitHub Actions

This guide will help you set up authentication so GitHub Actions can deploy to Azure.

## Method 1: Azure Service Principal (Recommended)

### Step 1: Install Azure CLI

**Windows:**
- Download from: https://aka.ms/installazurecliwindows
- Or use: `winget install -e --id Microsoft.AzureCLI`

**Mac:**
```bash
brew install azure-cli
```

**Linux:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Step 2: Login to Azure

```bash
az login
```

This will open a browser window for authentication.

### Step 3: Get Your Subscription ID

```bash
az account list --output table
```

Copy the Subscription ID (it's a GUID like `12345678-1234-1234-1234-123456789012`)

### Step 4: Create Service Principal

Replace `YOUR_SUBSCRIPTION_ID` and `tally-system-rg` with your actual values:

```bash
az ad sp create-for-rbac --name "tally-system-github-actions" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/tally-system-rg \
  --sdk-auth
```

**Example:**
```bash
az ad sp create-for-rbac --name "tally-system-github-actions" \
  --role contributor \
  --scopes /subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/tally-system-rg \
  --sdk-auth
```

This will output JSON like:
```json
{
  "clientId": "xxxx-xxxx-xxxx-xxxx",
  "clientSecret": "xxxx-xxxx-xxxx-xxxx",
  "subscriptionId": "xxxx-xxxx-xxxx-xxxx",
  "tenantId": "xxxx-xxxx-xxxx-xxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### Step 5: Add to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Value: Paste the **entire JSON output** from Step 4
6. Click **Add secret**

### Step 6: Verify

Push a change to trigger the workflow:
```bash
git commit --allow-empty -m "Test Azure deployment"
git push origin main
```

Check GitHub Actions tab to see if deployment succeeds.

## Method 2: Using Publish Profile (Alternative)

If you prefer using publish profile instead:

1. Go to Azure Portal → Your App Service
2. Click **Get publish profile** (downloads `.PublishSettings` file)
3. Open the file and copy its contents
4. Go to GitHub → Settings → Secrets → Actions
5. Create secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
6. Paste the publish profile content

Then update `.github/workflows/backend.yml` to use:
```yaml
- name: Deploy to Azure App Service
  uses: azure/webapps-deploy@v2
  with:
    app-name: 'tally-system-backend'
    publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
    package: ./backend
```

## Troubleshooting

### "No credentials found"
- Ensure `AZURE_CREDENTIALS` secret is set correctly
- Verify the JSON is valid (no extra characters)
- Check that the service principal has Contributor role

### "Authorization failed"
- Verify subscription ID is correct
- Check resource group name matches
- Ensure service principal has proper permissions

### "Resource group not found"
- Verify resource group exists
- Check spelling of resource group name
- Ensure you're using the correct subscription

## Security Notes

- Never commit credentials to your repository
- Use GitHub Secrets for all sensitive information
- Rotate credentials periodically
- Use least privilege principle (only grant necessary permissions)

