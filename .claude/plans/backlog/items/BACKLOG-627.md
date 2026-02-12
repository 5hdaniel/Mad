# BACKLOG-627: Fix Login Callback - Replace Auto-Provision with JIT Join

**Priority:** Critical
**Category:** service
**Status:** Pending
**Sprint:** SPRINT-074

## Description

Replace the `autoProvisionITAdmin()` call in the login callback with JIT join logic. Azure users from a known tenant should auto-join the existing org; users from an unknown tenant should see an "org not set up" error instead of creating a duplicate org.

## Acceptance Criteria

- [ ] Azure user from unknown tenant -> org_not_setup error
- [ ] Azure user from known tenant -> JIT-joined as default role
- [ ] Existing member/invite flows preserved
- [ ] Error message displayed on login page

## Task File

`.claude/plans/tasks/TASK-1926-callback-jit-join.md`

## Related

- Depends on: BACKLOG-626 (JIT Join RPC)
- Incident: Madison Del Vigo (madison.delvigo@cbolympia.com)
