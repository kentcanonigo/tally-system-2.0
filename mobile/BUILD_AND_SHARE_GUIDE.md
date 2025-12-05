# Building and Sharing Your App for Remote Testing

This guide will help you build your Expo app so anyone can test it remotely without needing Expo Go or a development server.

## Prerequisites

1. **Expo Account** (free)
   - Sign up at https://expo.dev/signup
   - Or login if you already have one

2. **EAS CLI** (Expo Application Services)
   ```bash
   npm install -g eas-cli
   eas login
   ```

## Quick Start: Build for Testing

### For Android (APK - Easy to Share)

1. **Navigate to mobile directory:**
   ```bash
   cd mobile
   ```

2. **Build Android APK:**
   ```bash
   eas build --platform android --profile preview
   ```

3. **Share the build:**
   - After the build completes, EAS will provide a download link
   - Share this link with testers
   - They can download and install the APK directly on Android devices
   - **Note:** Testers may need to enable "Install from Unknown Sources" in Android settings

### For iOS (Requires Apple Developer Account)

**Option 1: iOS Simulator Build (Free, but only works on Mac simulators)**
```bash
eas build --platform ios --profile preview --local
```

**Option 2: iOS Device Build (Requires paid Apple Developer account - $99/year)**
```bash
eas build --platform ios --profile preview
```

For iOS device builds, you'll need to:
- Have a paid Apple Developer account
- Configure signing credentials (EAS can help with this)
- Distribute via TestFlight (recommended) or direct download

## Build Profiles Explained

I've set up three build profiles in `eas.json`:

1. **`preview`** - Best for sharing with testers
   - Creates installable APK/IPA files
   - No development server needed
   - Perfect for remote testing

2. **`development`** - For development builds
   - Requires development server running
   - Good for active development

3. **`production`** - For app store submission
   - Optimized builds
   - Ready for Google Play / App Store

## Sharing Your Build

### Android APK Sharing

1. After building, EAS provides a download URL
2. Share this URL with testers via:
   - Email
   - Messaging apps
   - QR code (EAS dashboard can generate one)
3. Testers download and install directly

### iOS Sharing Options

**TestFlight (Recommended):**
1. Build with production profile
2. Submit to App Store Connect
3. Add testers via TestFlight
4. Testers get email invitation

**Direct Distribution (Ad Hoc):**
1. Build with preview profile
2. Add device UDIDs to your Apple Developer account
3. Share download link (limited to registered devices)

## Building Both Platforms

To build for both Android and iOS:

```bash
# Build both at once
eas build --platform all --profile preview

# Or build separately
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

## Viewing Your Builds

- **EAS Dashboard:** https://expo.dev/accounts/[your-username]/projects/tally-system/builds
- **CLI:** `eas build:list`

## Important Notes

### For Remote Testing:
- ✅ Use **`preview`** profile (not `development`)
- ✅ Preview builds are standalone - no Expo Go needed
- ✅ Testers can install directly from download link
- ✅ Works offline after installation

### API Configuration:
If your app connects to a backend API, make sure:
- The API URL in your app points to a publicly accessible server (not `localhost`)
- For testing, you might need to:
  - Deploy your backend to a cloud service (Azure, AWS, etc.)
  - Or use a tunneling service like ngrok for local testing

### Updating the App:
- Each build is a new version
- To update, rebuild and share the new download link
- For easier updates, consider using EAS Update (over-the-air updates)

## Troubleshooting

**"EAS CLI not found"**
```bash
npm install -g eas-cli
```

**"Not logged in"**
```bash
eas login
```

**"Build failed"**
- Check the build logs in the EAS dashboard
- Ensure all dependencies are in `package.json`
- Verify `app.json` configuration is correct

**"Can't install APK on Android"**
- Enable "Install from Unknown Sources" in Android settings
- Or use Google Play Internal Testing

## Next Steps

1. **Install EAS CLI:** `npm install -g eas-cli && eas login`
2. **Build Android APK:** `cd mobile && eas build --platform android --profile preview`
3. **Share the download link** with your testers
4. **For iOS:** Set up Apple Developer account and build with `eas build --platform ios --profile preview`

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Build Tutorial](https://docs.expo.dev/build/introduction/)
- [Sharing Builds Guide](https://docs.expo.dev/build/sharing-builds/)

