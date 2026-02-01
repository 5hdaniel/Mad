# BACKLOG-499: Test User License with Data Usage Clause

**Category**: Feature / Legal
**Priority**: Medium
**Sprint**: Unassigned
**Estimated Tokens**: ~25K
**Status**: Open
**Created**: 2026-01-25

---

## Summary

Add a "Test User" license type that includes Terms & Conditions allowing the use of user data for testing and AI model training purposes. This enables beta testers and early adopters to contribute their data to improve the product.

## Requirements

### License Type
- New license type: `test` (in addition to `individual` and `team`)
- Test users get full feature access (equivalent to team + AI add-on)
- Test license is free / complimentary

### Terms & Conditions Clause
The T&C for test users must include explicit consent for:
1. **Data Usage for Testing**: User data may be used to test application features and bug fixes
2. **AI Training**: User data may be used to train and improve AI models
3. **Data Anonymization**: Clarify whether data is anonymized before training use
4. **Opt-out**: Whether test users can opt-out of data usage while keeping test license

### Suggested T&C Language (Draft)
```
TEST USER DATA USAGE

By accepting a Test User license, you agree that:

1. Your data (including transaction records, communications, and audit information)
   may be used by Magic Audit to:
   - Test and validate application features
   - Debug and fix issues
   - Train and improve AI models for transaction detection

2. Data used for AI training will be anonymized to remove personally identifiable
   information before processing.

3. You may request deletion of your data at any time by contacting support,
   which will also terminate your Test User license.

4. Test User licenses are provided at no cost and may be revoked at any time.
```

## Implementation Approach

### Database/Schema
1. Add `test` to license type enum in Supabase
2. Update `licenses` table to support test license records
3. Add `data_consent_version` field to track T&C acceptance

### Frontend
1. Update `LicenseContext` to recognize `test` license type
2. Test users should have same UI as team + AI add-on
3. Add T&C acceptance flow during test license activation
4. Show "Test User" badge in UI (Settings, etc.)

### Backend/Supabase
1. Add RLS policies for test users
2. Function to grant test licenses
3. Track T&C acceptance timestamp

## Acceptance Criteria

- [ ] Test license type recognized in application
- [ ] Test users have full feature access
- [ ] T&C with data usage clause presented during activation
- [ ] T&C acceptance tracked in database
- [ ] "Test User" indicator visible in UI
- [ ] Admin can grant/revoke test licenses

## Related Items

- BACKLOG-081: Consolidate AI Consent into T&C (related legal work)
- SPRINT-051: License system foundation

## Notes

- Legal review of T&C language recommended before production use
- Consider GDPR/privacy implications for EU users
- May need separate data processing agreement for enterprise test users
