# BACKLOG-375: SSO (Single Sign-On) for Enterprise Authentication

## User Story

Enterprise customers need to authenticate users through their corporate identity provider instead of individual email/password accounts.

## Category

feature

## Priority

High (enterprise requirement)

## Status

Pending

## Feature Requirements

### 1. SAML 2.0 Support
- Integrate with enterprise identity providers (Okta, Azure AD, OneLogin, etc.)
- Implement SAML assertion parsing and validation
- Support IdP-initiated and SP-initiated SSO flows
- Handle SAML metadata exchange for configuration

### 2. OIDC Support
- OpenID Connect for modern identity providers
- Support authorization code flow with PKCE
- Implement token refresh and revocation
- Handle ID token validation and claims extraction

### 3. SSO Configuration
- Admin portal to configure SSO settings
- Support for multiple SSO providers per organization
- Configuration import from IdP metadata URL
- Test connection functionality before enabling

### 4. Just-in-Time Provisioning
- Create user accounts on first SSO login
- Map IdP attributes to user profile fields
- Support group/role claims from IdP
- Handle provisioning errors gracefully

### 5. Session Management
- Proper session handling with SSO logout
- Support for Single Logout (SLO)
- Session timeout aligned with IdP policies
- Handle concurrent sessions across devices

## Acceptance Criteria

- [ ] Users can log in via corporate SSO
- [ ] Support for major identity providers (Okta, Azure AD, Google Workspace)
- [ ] SSO configuration UI for admins
- [ ] Proper session/token handling
- [ ] JIT provisioning creates users on first login
- [ ] Single Logout (SLO) works correctly
- [ ] Error handling for SSO failures with user-friendly messages

## Technical Considerations

- Evaluate passport.js SAML/OIDC strategies vs custom implementation
- Consider electron-specific OAuth flow handling (custom protocol handlers)
- Plan for secure storage of SSO configuration (encryption at rest)
- Design database schema for SSO provider configurations
- Consider offline access scenarios when IdP is unreachable

## Dependencies

- BACKLOG-376 (SCIM User Provisioning) - related but can be implemented independently
- Existing authentication system refactoring may be required

## Estimated Tokens

~150K (large feature with multiple integrations)

## Notes

- Related to BACKLOG-070 (Enterprise User Management - Deferred)
- This is part of enterprise tier features
- May require Supabase Auth enterprise features or self-hosted auth solution
