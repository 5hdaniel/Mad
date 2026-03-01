# BACKLOG-819: Allow deselecting contacts in New Audit contact selection step

**Type:** Feature
**Area:** UI
**Priority:** Medium
**Status:** Pending
**Created:** 2026-02-27

## Description

In the "Audit New Transaction" flow, Step 2 (Select Contacts) currently does not allow users to deselect contacts once selected. Users should be able to toggle contacts off if they accidentally selected the wrong one or changed their mind.

Standard multi-select UX pattern: click to select, click again to deselect.

## Acceptance Criteria

- [ ] Users can click a selected contact to deselect it
- [ ] Visual feedback clearly distinguishes selected vs unselected contacts
- [ ] Deselecting updates the contact count / selection state immediately
- [ ] No regression in the existing select flow

## Notes

- Reported from the "Audit New Transaction > Step 2: Select Contacts" screen
- This is a standard toggle-select UX improvement
