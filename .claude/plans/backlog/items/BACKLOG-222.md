# BACKLOG-222: Contact Changes Not Saving When Editing Transaction

## Type
Bug / Data Persistence

## Priority
High

## Description
When editing a transaction and adding/modifying contacts, the changes do not persist after saving. The contacts pre-populate correctly (TASK-1038 fix works), but any modifications made during editing are lost.

## Symptoms
1. Open existing transaction with 1 contact
2. Click Edit Contacts
3. Add another contact
4. Save
5. Changes are lost - still shows only 1 contact

## Likely Cause
- Save handler may not be collecting updated contact state
- State not being passed correctly to save function
- Database update may be silently failing

## Acceptance Criteria
- [ ] Adding contacts during edit persists after save
- [ ] Removing contacts during edit persists after save
- [ ] Modifying contact roles persists after save

## Related
- TASK-1038 (Contacts Pre-Pop) - Found during verification
- SPRINT-034

## Created
2025-01-12
