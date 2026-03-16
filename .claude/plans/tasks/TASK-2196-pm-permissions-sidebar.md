# Task TASK-2196: Add PM Permissions + Sidebar Nav

**Status:** Pending
**Backlog ID:** BACKLOG-959
**Sprint:** SPRINT-135
**Phase:** Phase 1 — Supabase Schema
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2196-pm-permissions-sidebar`
**Estimated Tokens:** ~8K
**Depends On:** TASK-2194 (RBAC seed — permission keys should match)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Objective

Add PM permission constants to the admin portal TypeScript permissions file and add a collapsible "Projects" section to the admin portal sidebar. This wires up the frontend to recognize PM permissions and provides navigation to PM pages (which will be built in Sprint B).

---

## Context

The admin portal has an RBAC permission system defined in `admin-portal/lib/permissions.ts` and a sidebar with collapsible sections (Support, Settings) in `admin-portal/components/layout/Sidebar.tsx`. This task adds the PM equivalent.

**Current state:**
- `permissions.ts` has `SUPPORT_VIEW`, `SUPPORT_RESPOND`, etc. constants
- `Sidebar.tsx` has `supportSubItems` array and collapsible Support section
- We need to add `PM_VIEW`, `PM_EDIT`, etc. and a "Projects" sidebar section

**The PM pages don't exist yet** (Sprint B creates them). The sidebar links will point to routes that will 404 until Sprint B. This is fine — the sidebar nav needs to exist before the pages so we can iterate.

---

## Requirements

### Must Do:

1. **Update `admin-portal/lib/permissions.ts`:**

   Add PM permission constants to the `PERMISSIONS` object:
   ```typescript
   PM_VIEW: 'pm.view',
   PM_EDIT: 'pm.edit',
   PM_ASSIGN: 'pm.assign',
   PM_MANAGE: 'pm.manage',
   PM_ADMIN: 'pm.admin',
   ```

   Add `pm` category to `PERMISSION_CATEGORIES`:
   ```typescript
   { key: 'pm', label: 'Projects' },
   ```

   **CRITICAL:** Permission keys MUST match exactly what TASK-2194 seeds into Supabase (`pm.view`, `pm.edit`, `pm.assign`, `pm.manage`, `pm.admin`).

2. **Update `admin-portal/components/layout/Sidebar.tsx`:**

   Add a collapsible "Projects" section following the exact same pattern as the Support section.

   **a. Add imports** (at the top, in the lucide-react import):
   ```typescript
   import { ..., KanbanSquare, ListChecks, FolderKanban, UserCheck, Calendar } from 'lucide-react';
   ```
   Note: Some of these icons may already be imported. Only add what's missing. Check which icons are available in the lucide-react version used.

   **b. Add PM sub-items array** (after `supportSubItems`):
   ```typescript
   /** Sub-items under the collapsible "Projects" section */
   const pmSubItems: NavItem[] = [
     { label: 'Dashboard', href: '/dashboard/pm', icon: LayoutDashboard, permission: PERMISSIONS.PM_VIEW },
     { label: 'Backlog', href: '/dashboard/pm/backlog', icon: ListChecks, permission: PERMISSIONS.PM_VIEW },
     { label: 'Board', href: '/dashboard/pm/board', icon: KanbanSquare, permission: PERMISSIONS.PM_VIEW },
     { label: 'My Tasks', href: '/dashboard/pm/my-tasks', icon: UserCheck, permission: PERMISSIONS.PM_VIEW },
     { label: 'Sprints', href: '/dashboard/pm/sprints', icon: Calendar, permission: PERMISSIONS.PM_VIEW },
     { label: 'Projects', href: '/dashboard/pm/projects', icon: FolderKanban, permission: PERMISSIONS.PM_MANAGE },
     { label: 'Settings', href: '/dashboard/pm/settings', icon: Settings, permission: PERMISSIONS.PM_ADMIN },
   ];
   ```

   **c. Add PM section permissions:**
   ```typescript
   /** Permissions that grant visibility to the Projects section */
   const pmSectionPermissions: PermissionKey[] = [
     PERMISSIONS.PM_VIEW,
     PERMISSIONS.PM_MANAGE,
   ];
   ```

   **d. Add state for PM section** (in the component, after `supportExpanded` state):
   ```typescript
   const isPmActive = pathname.startsWith('/dashboard/pm');
   const [pmExpanded, setPmExpanded] = useState(isPmActive);
   ```

   **e. Add useEffect** for PM auto-expand (after support useEffect):
   ```typescript
   useEffect(() => {
     if (isPmActive) {
       setPmExpanded(true);
     }
   }, [isPmActive]);
   ```

   **f. Add canSeePm** check:
   ```typescript
   const canSeePm = loading || pmSectionPermissions.some((p) => hasPermission(p));
   ```

   **g. Add the collapsible PM section** in the JSX, between the Support section and the Settings section. Follow the EXACT same pattern as the Support section (`{canSeeSupport && (<div>...`), just change:
   - `canSeeSupport` -> `canSeePm`
   - `supportExpanded` -> `pmExpanded`
   - `setSupportExpanded` -> `setPmExpanded`
   - `isSupportActive` -> `isPmActive`
   - `supportSubItems` -> `pmSubItems`
   - Icon: `Headphones` -> `KanbanSquare`
   - Label: `'Support'` -> `'Projects'`

   **h. Add `/dashboard/pm` to `exactMatchPaths`:**
   ```typescript
   const exactMatchPaths = new Set(['/dashboard', '/dashboard/support', '/dashboard/pm']);
   ```

### Must NOT Do:
- Do NOT create PM pages/routes (Sprint B)
- Do NOT modify the Support section or Settings section
- Do NOT change existing permission constants
- Do NOT add any new dependencies
- Do NOT rename icons that are already working
- Do NOT restructure the Sidebar component

---

## Acceptance Criteria

- [ ] `admin-portal/lib/permissions.ts` exports `PM_VIEW`, `PM_EDIT`, `PM_ASSIGN`, `PM_MANAGE`, `PM_ADMIN` constants
- [ ] Permission keys match RBAC seed values exactly: `pm.view`, `pm.edit`, `pm.assign`, `pm.manage`, `pm.admin`
- [ ] `PERMISSION_CATEGORIES` includes `{ key: 'pm', label: 'Projects' }`
- [ ] Sidebar shows "Projects" collapsible section between Support and Settings
- [ ] Projects section has 7 sub-items: Dashboard, Backlog, Board, My Tasks, Sprints, Projects, Settings
- [ ] Projects section auto-expands when URL starts with `/dashboard/pm`
- [ ] Projects section is permission-gated (only visible with `pm.view` or `pm.manage`)
- [ ] `npx tsc --noEmit` passes (from `admin-portal/`)
- [ ] `npm run build` passes (from `admin-portal/`)
- [ ] Existing Support and Settings sections are unchanged

---

## Files to Modify

- `admin-portal/lib/permissions.ts` — add PM permission constants + category
- `admin-portal/components/layout/Sidebar.tsx` — add collapsible Projects section

## Files to Read (for context)

- `admin-portal/lib/permissions.ts` — current permission constants (to see exact format)
- `admin-portal/components/layout/Sidebar.tsx` — current sidebar (to follow Support section pattern exactly)
- `supabase/migrations/20260313_support_rbac_seed.sql` — verify support permission key format for consistency

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI change, verified via type-check + visual inspection)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(pm): add PM permissions constants and sidebar navigation`
- **Branch:** `feature/TASK-2196-pm-permissions-sidebar`
- **Target:** `feature/pm-module`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-16*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from feature/pm-module
- [x] Noted start time: 2026-03-16
- [x] Read task file completely
- [x] Read current permissions.ts and Sidebar.tsx

Implementation:
- [x] Permissions constants added
- [x] Permission category added
- [x] Sidebar PM section added
- [x] Type check passes (npx tsc --noEmit)
- [x] Lint passes (npm run lint)
- [x] Build passes (npm run build)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No PM permissions or sidebar nav
- **After**: PM permissions constants (PM_VIEW, PM_EDIT, PM_ASSIGN, PM_MANAGE, PM_ADMIN) + Projects sidebar section with 7 nav items
- **Actual Tokens**: auto-captured (Est: ~8K)
- **PR**: https://github.com/5hdaniel/Mad/pull/1172

**Issues/Blockers:** None

---

## Guardrails

**STOP and ask PM if:**
- Any lucide-react icon (`KanbanSquare`, `ListChecks`, `FolderKanban`) is not available in the installed version
- The Sidebar component structure has changed significantly from what's documented
- Type check fails for reasons unrelated to this task
- You need to modify the `NavItem` interface or `renderNavItem` function
- You encounter blockers not covered in the task file
