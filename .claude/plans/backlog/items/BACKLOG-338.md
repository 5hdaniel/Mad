# BACKLOG-338: Google Profile Image Display Issue

## Summary

Google profile images not displaying correctly in circular avatar frames when user logs in with Google OAuth.

## Problem

The circular profile picture placeholder has display issues when showing Google profile images:
- Images may appear broken or improperly cropped
- The `rounded-full` class may not be properly containing the image
- Potential CORS or loading issues with Google's image URLs

## Current Implementation

```html
<!-- Large avatar in profile section -->
<img src="https://lh3.googleusercontent.com/a/..."
     alt="Username"
     class="w-16 h-16 rounded-full border-2 border-gray-200">

<!-- Small avatar in header button -->
<button class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500...">
  <img src="https://lh3.googleusercontent.com/a/..."
       alt="Profile"
       class="w-8 h-8 rounded-full">
</button>
```

## Potential Fixes

1. **Add `object-cover` class** to ensure image fills the circular frame properly:
   ```html
   <img src="..." class="w-8 h-8 rounded-full object-cover">
   ```

2. **Add fallback for failed image loads** - show initials or default avatar if Google image fails

3. **Check for CORS issues** - Google images may need referrer policy adjustments

4. **Add loading state** - show placeholder while image loads

## Files Likely Affected

- `src/components/layout/AppHeader.tsx` or similar header component
- `src/components/profile/` - profile-related components
- Any component rendering user avatars

## Priority

LOW - Visual polish, not blocking functionality

## Category

UI
