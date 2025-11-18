# Analytics Setup Guide

This guide explains how to configure and use Microsoft Clarity and Google Analytics tracking in the MagicAudit application.

## Overview

The application includes integrated telemetry using two analytics platforms:

1. **Microsoft Clarity** - Session recording and heatmap analytics
2. **Google Analytics** - User behavior and event tracking

## Setup Instructions

### 1. Microsoft Clarity Setup

1. Go to [Microsoft Clarity](https://clarity.microsoft.com/)
2. Sign in with your Microsoft account
3. Click **Add new project**
4. Enter your project details:
   - Project name: "MagicAudit" (or your preferred name)
   - Website URL: Leave empty or use a placeholder (this is an Electron app)
5. Copy the **Project ID** (format: `XXXXXXXXXX`)
6. Add it to your `.env.local` file:
   ```
   VITE_CLARITY_PROJECT_ID=your_project_id_here
   ```

### 2. Google Analytics Setup

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. Create a new property:
   - Click **Admin** (bottom left)
   - Under Property column, click **Create Property**
   - Enter property name: "MagicAudit"
   - Choose your timezone and currency
   - Click **Next**
4. Skip the business information if desired
5. Select **Web** as the platform
6. For Stream details:
   - Website URL: Use a placeholder or your website
   - Stream name: "MagicAudit Desktop App"
7. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)
8. Add it to your `.env.local` file:
   ```
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

### 3. Environment Configuration

Create or update your `.env.local` file in the project root:

```bash
# Analytics Configuration
VITE_CLARITY_PROJECT_ID=your_clarity_project_id
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Note:** The `.env.local` file is ignored by git and will not be committed to version control.

## Usage

### Automatic Tracking

Analytics are automatically initialized when the app starts. The following are tracked automatically:

- Page views
- User sessions
- Basic user interactions

### Custom Event Tracking

Use the analytics utility to track custom events in your components:

```javascript
import { trackEvent, trackPageView, setUserProperties } from '../utils/analytics';

// Track a custom event
trackEvent('export_started', {
  export_type: 'pdf',
  conversation_count: 5
});

// Track a page view
trackPageView('/dashboard', 'Dashboard');

// Set user properties
setUserProperties({
  user_type: 'premium',
  subscription_status: 'active'
});
```

### Available Functions

#### `initializeAnalytics()`
Automatically called on app startup. Initializes both Microsoft Clarity and Google Analytics.

#### `trackEvent(eventName, eventData)`
Track custom events with optional data.

**Parameters:**
- `eventName` (string): Name of the event (e.g., 'export_complete', 'user_signup')
- `eventData` (object): Additional data to track with the event

**Example:**
```javascript
trackEvent('conversation_exported', {
  format: 'pdf',
  count: 3,
  source: 'imessage'
});
```

#### `trackPageView(pagePath, pageTitle)`
Track page navigation within the app.

**Parameters:**
- `pagePath` (string): The page path or identifier
- `pageTitle` (string): The page title

**Example:**
```javascript
trackPageView('/settings', 'Settings');
```

#### `setUserProperties(properties)`
Set custom user properties for analytics segmentation.

**Parameters:**
- `properties` (object): Key-value pairs of user properties

**Example:**
```javascript
setUserProperties({
  plan: 'pro',
  signup_date: '2024-01-15',
  platform: 'mac'
});
```

## Privacy Considerations

Since this is a desktop Electron application:

1. **User Consent**: Consider adding a privacy notice and opt-in mechanism for analytics
2. **Data Collection**: Both services collect user interaction data
3. **PII**: Avoid tracking personally identifiable information (PII)
4. **Compliance**: Ensure compliance with GDPR, CCPA, and other privacy regulations

### Recommended Privacy Implementation

Consider adding a settings option to allow users to opt-out of analytics:

```javascript
// Example: Check user preference before initializing
const analyticsEnabled = localStorage.getItem('analytics_enabled') !== 'false';

if (analyticsEnabled) {
  initializeAnalytics();
}
```

## Viewing Analytics Data

### Microsoft Clarity
1. Visit [clarity.microsoft.com](https://clarity.microsoft.com/)
2. Select your project
3. View:
   - **Dashboard**: Overview of sessions and user behavior
   - **Recordings**: Watch user session recordings
   - **Heatmaps**: See where users click and scroll
   - **Insights**: AI-powered insights about user frustration

### Google Analytics
1. Visit [analytics.google.com](https://analytics.google.com/)
2. Select your property
3. View:
   - **Reports**: Real-time and historical data
   - **Events**: Custom events you've tracked
   - **User**: Demographics and technology
   - **Engagement**: Session duration and page views

## Troubleshooting

### Analytics Not Working

1. **Check Environment Variables**: Ensure `.env.local` has the correct IDs
2. **Check Console**: Open DevTools and look for initialization messages
3. **Verify IDs**: Ensure the format is correct:
   - Clarity: Alphanumeric string
   - Google Analytics: Starts with `G-`

### Console Messages

The analytics utility logs helpful messages:
- ✅ `Microsoft Clarity initialized successfully`
- ✅ `Google Analytics initialized successfully`
- ℹ️ `Analytics: No tracking IDs configured`
- ⚠️ `Failed to initialize [service]`

### Testing in Development

To test analytics in development:

1. Add your tracking IDs to `.env.local`
2. Run the app: `npm run dev`
3. Open DevTools Console
4. Look for initialization messages
5. Check the Network tab for analytics requests:
   - Clarity: Requests to `clarity.ms`
   - Google Analytics: Requests to `google-analytics.com`

## Best Practices

1. **Don't Track Sensitive Data**: Never track passwords, emails, or private messages
2. **Use Descriptive Event Names**: Use clear, consistent naming for events
3. **Add Context**: Include relevant metadata with events
4. **Test Before Deployment**: Verify analytics work in development
5. **Monitor Regularly**: Check analytics dashboards weekly for insights

## References

- [Microsoft Clarity Documentation](https://docs.microsoft.com/en-us/clarity/)
- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Electron Privacy Best Practices](https://www.electronjs.org/docs/latest/tutorial/security#privacy-best-practices)
