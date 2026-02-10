# BACKLOG-624: Add Microsoft Clarity Analytics to Broker Portal

**Status:** backlog
**Priority:** P3 - Should Have
**Category:** feature
**Effort:** ~2-3K tokens
**Created:** 2026-02-06

## Overview

Integrate Microsoft Clarity analytics into the broker-portal Next.js app to gain insights into user behavior through session recordings, heatmaps, and analytics.

## Business Value

- **User Behavior Insights**: Understand how brokers interact with the portal
- **UX Improvements**: Identify friction points and optimize workflows
- **Free Tool**: Microsoft Clarity provides enterprise-grade analytics at no cost
- **Privacy-Friendly**: GDPR/CCPA compliant analytics

## Requirements

1. **NPM Package Installation**
   - Install `@microsoft/clarity` or `clarity-js` package
   - Add to `broker-portal/package.json`

2. **Initialization**
   - Initialize Clarity in Next.js root layout (`app/layout.tsx`) or using `next/script`
   - Use Next.js Script component with appropriate loading strategy

3. **Configuration**
   - Store Clarity project ID as environment variable: `NEXT_PUBLIC_CLARITY_PROJECT_ID`
   - **Never hardcode** the project ID
   - Only load Clarity in production (not dev/preview environments)

4. **Deployment**
   - Add environment variable to Vercel project settings
   - Verify tracking works after deployment

## Acceptance Criteria

- [ ] Clarity package installed via NPM
- [ ] Initialization code added to Next.js app layout
- [ ] Project ID stored as `NEXT_PUBLIC_CLARITY_PROJECT_ID`
- [ ] Only loads in production environment
- [ ] No console errors related to Clarity
- [ ] Session recordings appear in Clarity dashboard after deployment

## Technical Considerations

- Use `next/script` component with `afterInteractive` strategy for optimal loading
- Check `process.env.NODE_ENV === 'production'` before initializing
- Consider also checking Vercel environment: `process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'`

## References

- Microsoft Clarity: https://clarity.microsoft.com/
- Next.js Script optimization: https://nextjs.org/docs/app/api-reference/components/script
- Broker portal location: `broker-portal/`

## Related Items

- None

## Notes

User has already created a Clarity project and has the project ID ready. This is a straightforward integration task.
