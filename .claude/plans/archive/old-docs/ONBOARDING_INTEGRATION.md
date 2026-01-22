# Onboarding Wizard Integration Guide

## Overview

The Onboarding Wizard provides a beautiful, guided experience for new users to grant required macOS permissions. Instead of confusing error messages, users get step-by-step instructions with automatic detection.

## Features

✅ **Automated Flow**: Guides users through both Contacts and Full Disk Access permissions
✅ **Auto-Detection**: Polls every 2 seconds to detect when permissions are granted
✅ **Beautiful UI**: Modern gradient design with progress bar and animations
✅ **Error Handling**: Gracefully handles failures and allows users to continue
✅ **Skip Option**: Users can skip setup if they want to configure later

## Quick Integration

### 1. Add to your main App component

```jsx
import React, { useState, useEffect } from 'react';
import OnboardingWizard from './components/OnboardingWizard';

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    checkIfFirstRun();
  }, []);

  const checkIfFirstRun = async () => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');

    if (!hasCompletedOnboarding) {
      // Check if permissions are already granted
      const result = await window.api.system.checkFullDiskAccessStatus();

      if (!result.granted) {
        setShowOnboarding(true);
      } else {
        // Permissions already granted, mark as complete
        localStorage.setItem('onboarding_completed', 'true');
      }
    }

    setCheckingSetup(false);
  };

  const handleOnboardingComplete = (result) => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);

    if (!result?.skipped) {
      // User completed setup successfully
      console.log('Onboarding completed successfully!');
    } else {
      // User skipped setup
      console.log('User skipped onboarding');
    }
  };

  if (checkingSetup) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

      {/* Your app content */}
      <div>
        <h1>Magic Audit</h1>
        {/* ... */}
      </div>
    </>
  );
}

export default App;
```

### 2. Add a "Setup Permissions" button in Settings

For users who skipped initial setup:

```jsx
import React from 'react';

function Settings() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleSetupPermissions = () => {
    setShowOnboarding(true);
  };

  return (
    <div>
      <h2>Settings</h2>

      <div className="permissions-section">
        <h3>Permissions</h3>
        <p>Grant permissions to enable all features</p>

        <button onClick={handleSetupPermissions}>
          Setup Permissions
        </button>
      </div>

      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
```

## API Reference

### OnboardingWizard Component

```jsx
<OnboardingWizard
  onComplete={(result) => {
    // result.skipped = true if user clicked "Skip Setup"
    // result undefined if user completed successfully
  }}
/>
```

### Backend APIs

All available via `window.api.system`:

#### Run Complete Setup Flow
```javascript
const result = await window.api.system.runPermissionSetup();

// Returns:
// {
//   success: true/false,
//   contacts: { success: true, message: '...' },
//   fullDiskAccess: { success: true, message: '...' },
//   overallSuccess: true/false
// }
```

#### Request Contacts Permission Only
```javascript
const result = await window.api.system.requestContactsPermission();

// Opens Contacts app to trigger permission dialog
// Returns: { success: true/false, message: '...' }
```

#### Setup Full Disk Access
```javascript
const result = await window.api.system.setupFullDiskAccess();

// Opens System Preferences to Full Disk Access pane
// Returns: {
//   success: true,
//   message: '...',
//   appPath: '/path/to/app',
//   nextStep: 'User needs to toggle it on'
// }
```

#### Check Permission Status
```javascript
const result = await window.api.system.checkFullDiskAccessStatus();

// Tests by trying to read Messages database
// Returns: {
//   granted: true/false,
//   message: 'Full Disk Access is enabled/not enabled'
// }
```

#### Open Privacy Pane
```javascript
await window.api.system.openPrivacyPane('fullDiskAccess');

// Options: 'fullDiskAccess', 'contacts', 'calendar', 'accessibility'
// Or use raw pane ID: 'Privacy_AllFiles'
```

## Wizard Flow Details

### Step 1: Welcome (step = 1)
- Friendly introduction
- Lists what permissions are needed and why
- "Skip Setup" or "Let's Go" buttons

### Step 2: Contacts Permission (step = 2)
- Explains Contacts permission
- Triggers macOS permission dialog when user clicks
- Shows success/error feedback
- Auto-advances to step 3 after 1.5 seconds

### Step 3: Full Disk Access Instructions (step = 3)
- Clear numbered instructions (1-4)
- Explains System Preferences will open
- "Open System Settings" button

### Step 4: Waiting for Permission (step = 4)
- Auto-checks every 2 seconds if permission granted
- Shows spinner animation
- "Re-open System Settings" link if needed
- **Automatically advances to step 5 when permission detected!**

### Step 5: Completion (step = 5)
- Success celebration with animations
- Lists what user can now do
- "Start Using Magic Audit" button

## Customization

### Change Colors

The wizard uses Tailwind gradients. To customize:

```jsx
// Change the main gradient background
className="from-indigo-50 via-purple-50 to-pink-50"

// Change button gradients
className="from-indigo-500 to-purple-600"
```

### Change Polling Interval

Default: 2 seconds

```jsx
// In OnboardingWizard.jsx, find:
const interval = setInterval(async () => {
  // ...
}, 2000); // ← Change this value (milliseconds)
```

### Customize Messages

All text is in the component. Search for specific strings to customize.

## Troubleshooting

### "System Preferences doesn't show my app"

This is rare but can happen. The app should appear automatically when you try to access Full Disk Access. If not:

1. User needs to manually add the app:
   - Click the "+" button in Full Disk Access
   - Navigate to Applications
   - Select MagicAudit
   - Toggle it ON

2. You can add a help message in the wizard explaining this.

### "Permission not detected after enabling"

Ensure the polling is working:

```javascript
// Check in browser console
setInterval(async () => {
  const result = await window.api.system.checkFullDiskAccessStatus();
  console.log('Permission check:', result);
}, 2000);
```

If `result.granted` is `true` but wizard doesn't advance, there may be a state issue.

### "Contacts permission request doesn't show"

The Contacts trigger uses a simple AppleScript to open Contacts briefly. If it fails:

1. Check console for errors
2. Verify user has Contacts app installed
3. Try opening Contacts manually first

## Best Practices

### 1. Show onboarding only to new users

```javascript
// Don't show if:
// - User already completed onboarding
// - Permissions are already granted
// - User explicitly skipped setup

const shouldShowOnboarding =
  !localStorage.getItem('onboarding_completed') &&
  !(await checkPermissionsGranted());
```

### 2. Allow re-running setup

Provide a way for users to re-run setup from Settings if they accidentally revoke permissions.

### 3. Handle app updates gracefully

Don't show onboarding again after updates:

```javascript
const version = '1.0.0';
const lastOnboardingVersion = localStorage.getItem('onboarding_version');

if (lastOnboardingVersion !== version) {
  // Check if new permissions are needed
}
```

### 4. Provide fallback instructions

If the automated flow fails, show manual instructions:

```markdown
1. Open System Settings
2. Go to Privacy & Security
3. Select Full Disk Access
4. Click the lock to make changes
5. Click the "+" button
6. Select MagicAudit
7. Toggle it ON
```

## Advanced Usage

### Trigger specific steps only

```jsx
// Just request Contacts permission
await window.api.system.requestContactsPermission();

// Just setup Full Disk Access
await window.api.system.setupFullDiskAccess();
```

### Custom permission flow

Create your own wizard using the backend APIs:

```jsx
function CustomSetup() {
  const setupPermissions = async () => {
    // Step 1: Contacts
    await window.api.system.requestContactsPermission();

    // Step 2: Full Disk Access
    await window.api.system.setupFullDiskAccess();

    // Step 3: Wait for permission
    const checkInterval = setInterval(async () => {
      const result = await window.api.system.checkFullDiskAccessStatus();

      if (result.granted) {
        clearInterval(checkInterval);
        alert('Setup complete!');
      }
    }, 2000);
  };

  return <button onClick={setupPermissions}>Start Setup</button>;
}
```

## Testing

### Test the wizard flow

1. **First run**: Delete `onboarding_completed` from localStorage
2. **Revoke permissions**: System Settings → Privacy → Full Disk Access → Remove app
3. **Re-run**: Click "Setup Permissions" in settings

### Test auto-detection

1. Open wizard to step 4
2. Open System Preferences manually
3. Toggle permission on
4. Watch wizard auto-advance after ~2 seconds

### Test error handling

1. Deny Contacts permission → Should move to step 3 anyway
2. Don't grant Full Disk Access → Should stay on step 4 until granted

## Related Files

- `electron/services/macOSPermissionHelper.js` - Backend service
- `electron/system-handlers.js` - IPC handlers
- `electron/preload.js` - API exposure
- `src/components/OnboardingWizard.jsx` - UI component

## Support

If users encounter issues:

1. Check console logs for errors
2. Verify macOS version compatibility (10.14+)
3. Ensure app is properly code-signed
4. Try manual permission grant as fallback

---

## Quick Checklist

- [ ] Add OnboardingWizard to App.jsx
- [ ] Implement first-run detection
- [ ] Store completion in localStorage
- [ ] Add "Setup Permissions" button in Settings
- [ ] Test full flow on clean install
- [ ] Test skip functionality
- [ ] Test error cases
- [ ] Test auto-detection
- [ ] Provide fallback manual instructions

🎉 Your users now have a delightful onboarding experience!
