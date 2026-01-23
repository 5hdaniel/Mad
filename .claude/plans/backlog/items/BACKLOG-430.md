# BACKLOG-430: Default Representation Start Date to 6 Months Ago

## Summary

The "Representation Start Date" field should default to 6 months before today's date instead of the current default.

## Category

Enhancement / UX

## Priority

P3 - Low (Quality of life improvement)

## Description

### Problem

When creating a new transaction or audit, the "Representation Start Date" field requires manual entry. Real estate representation periods typically span several months, so a sensible default of 6 months ago would save users time and reduce data entry friction.

### Proposed Solution

Set the default value of the "Representation Start Date" field to `today - 6 months`.

Example: If today is January 23, 2026, the default would be July 23, 2025.

### Implementation Notes

- Find the date picker/input for "Representation Start Date"
- Calculate default as: `new Date().setMonth(new Date().getMonth() - 6)`
- Ensure edge cases are handled (e.g., January -> July of previous year)
- User can still override the default

## Acceptance Criteria

- [ ] Representation Start Date defaults to 6 months before current date
- [ ] Default is applied in new transaction/audit creation
- [ ] User can modify the defaulted value
- [ ] Edge cases handled (year rollover, month length differences)

## Estimated Effort

~5K tokens

## Dependencies

None

## Related Items

- Transaction creation flow
- Audit period settings
