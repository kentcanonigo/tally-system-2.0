# GitHub Actions Workflow Troubleshooting

## Workflow Not Triggering?

### Common Issues and Solutions:

#### 1. **Path Filter Too Restrictive**

The workflow only triggers when files in `backend/**` change. If you only added secrets or changed other files, it won't trigger.

**Solution**: Make a change to a backend file:
```bash
# Touch a file in backend to trigger workflow
echo "# Trigger workflow" >> backend/README.md
git add backend/README.md
git commit -m "Trigger workflow"
git push origin main
```

Or manually trigger the workflow:
- Go to GitHub → Actions tab
- Select "Backend CI/CD" workflow
- Click "Run workflow" button (if `workflow_dispatch` is enabled)

#### 2. **Wrong Branch**

The workflow only triggers on `main` branch pushes.

**Check your current branch:**
```bash
git branch
```

**Switch to main if needed:**
```bash
git checkout main
```

#### 3. **Workflow File Not Committed**

Make sure `.github/workflows/backend.yml` is committed and pushed:
```bash
git add .github/workflows/backend.yml
git commit -m "Add workflow file"
git push origin main
```

#### 4. **GitHub Actions Disabled**

Check if GitHub Actions is enabled:
- Go to repository Settings → Actions → General
- Ensure "Allow all actions and reusable workflows" is selected
- Check "Workflow permissions" settings

#### 5. **Secret Not Set Correctly**

Verify the secret exists:
- Go to Settings → Secrets and variables → Actions
- Check that `AZURE_CREDENTIALS` exists
- Ensure it's the full JSON (not just part of it)

#### 6. **Manual Trigger**

To manually trigger the workflow:

**Option A: Via GitHub UI**
1. Go to Actions tab
2. Click on "Backend CI/CD" workflow
3. Click "Run workflow" button (top right)
4. Select branch: `main`
5. Click "Run workflow"

**Option B: Add workflow_dispatch** (already added to workflow)
- This allows manual triggering from GitHub UI

**Option C: Make a dummy commit**
```bash
# Create empty commit to trigger workflow
git commit --allow-empty -m "Trigger workflow"
git push origin main
```

## Workflow Running But Failing?

### Check Logs:
1. Go to Actions tab
2. Click on the failed workflow run
3. Expand the failed step to see error details

### Common Errors:

**"No credentials found"**
- Secret `AZURE_CREDENTIALS` not set
- Secret name doesn't match exactly
- JSON format is incorrect

**"Resource group not found"**
- Check resource group name in Azure
- Verify subscription ID is correct
- Ensure service principal has access

**"App service not found"**
- Verify app service name matches exactly
- Check it exists in the correct resource group
- Ensure service principal has Contributor role

## Testing Workflow Locally

You can't run GitHub Actions locally, but you can test the commands:

```bash
# Test Python setup
python --version  # Should be 3.11+

# Test dependencies
cd backend
pip install -r requirements.txt

# Test Docker build (if Docker installed)
docker build -t tally-backend:latest .

# Test Azure login (if Azure CLI installed)
az login
az account show
```

## Quick Fix: Force Trigger

To immediately trigger the workflow:

```bash
# Make a small change to backend
echo "" >> backend/app/main.py
git add backend/app/main.py
git commit -m "Trigger deployment"
git push origin main
```

Or use the manual trigger button in GitHub Actions UI.

