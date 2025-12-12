# Enterprise User Management - Task Specifications

This folder contains task specifications for building enterprise user management features including SSO, admin portal, and SCIM provisioning.

## Overview

Enable team/enterprise clients to:
- Authenticate via SSO (Microsoft Entra ID, Google Workspace)
- Manage their organization and team members
- Configure automatic user provisioning via SCIM

## Stack

- **Database**: Supabase PostgreSQL
- **SSO**: Microsoft Entra ID (`@azure/msal-node`), Google Workspace (`googleapis`)
- **SCIM**: Supabase Edge Functions
- **Frontend**: React + TypeScript + Tailwind
- **Not Using**: WorkOS, Auth0, Okta, generic SAML

## Phase Structure

```
Phase 1: Foundation (Run in Parallel)
├── EUM-001: Database Schema - Organizations & Members
├── EUM-002: Organization Service
├── EUM-003: Audit Logging Service
├── EUM-004: RBAC Service
└── EUM-005: Phase 1 Integration & Testing [MERGE]

Phase 2: SSO Implementation (Run in Parallel)
├── EUM-006: Microsoft Entra ID SSO Service
├── EUM-007: Google Workspace SSO Service
├── EUM-008: SSO Core Service
├── EUM-009: JIT User Provisioning Service
└── EUM-010: SSO Integration & E2E Testing [MERGE]

Phase 3: Admin Portal (Run in Parallel)
├── EUM-011: Organization Settings UI
├── EUM-012: Team Members Management UI
├── EUM-013: SSO Configuration Wizard
├── EUM-014: Audit Logs Viewer
└── EUM-015: Portal Integration & QA [MERGE]

Phase 4: Automated Provisioning (Run in Parallel)
├── EUM-016: SCIM 2.0 Server
├── EUM-017: SCIM Token Management UI
├── EUM-018: Provisioning Status UI
├── EUM-019: Directory Sync Service
└── EUM-020: Final Integration, QA & Release [MERGE]
```

## Dependency Graph

```
                                    PHASE 1: FOUNDATION
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│EUM-001│     │EUM-002│       │EUM-003│       │EUM-004│           │
│Schema │     │ Org   │       │ Audit │       │ RBAC  │           │
│       │     │Service│       │Service│       │Service│           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                    ┌───────────┐                                 │
                    │  EUM-005  │                                 │
                    │Integration│                                 │
                    │  & Tests  │                                 │
                    └─────┬─────┘                                 │
                          │                                       │
                    └─────┼───────────────────────────────────────┘
                          │
                          ▼
                                     PHASE 2: SSO
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│EUM-006│     │EUM-007│       │EUM-008│       │EUM-009│           │
│EntraID│     │Google │       │  SSO  │       │  JIT  │           │
│  SSO  │     │Worksp.│       │ Core  │       │Provis.│           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                   ┌────────────┐                                 │
                   │  EUM-010   │                                 │
                   │SSO Integr. │                                 │
                   │  & E2E     │                                 │
                   └─────┬──────┘                                 │
                         │                                        │
                    └────┼────────────────────────────────────────┘
                         │
                         ▼
                                   PHASE 3: ADMIN PORTAL
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│EUM-011│     │EUM-012│       │EUM-013│       │EUM-014│           │
│ Org   │     │ Team  │       │  SSO  │       │ Audit │           │
│ UI    │     │Members│       │Config │       │  UI   │           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                   ┌────────────┐                                 │
                   │  EUM-015   │                                 │
                   │Portal Intg.│                                 │
                   │  & QA      │                                 │
                   └─────┬──────┘                                 │
                         │                                        │
                    └────┼────────────────────────────────────────┘
                         │
                         ▼
                                  PHASE 4: PROVISIONING
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│EUM-016│     │EUM-017│       │EUM-018│       │EUM-019│           │
│ SCIM  │     │ SCIM  │       │Provis.│       │ Sync  │           │
│Server │     │  UI   │       │ UI    │       │Service│           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                   ┌────────────┐                                 │
                   │  EUM-020   │                                 │
                   │ Final QA   │                                 │
                   │ & Release  │                                 │
                   └────────────┘                                 │
                    └─────────────────────────────────────────────┘
```

## Text Dependency Graph

```
LEGEND:
  ──► Sequential dependency (must complete before)
  ═══► Phase boundary (all tasks in phase must complete)

START
  │
  ├──► EUM-001 (Schema) ───────────────────────────┐
  │                                                │
  ├──► EUM-002 (Org Service) ──────────────────────┤
  │                                                │──► EUM-005 (Phase 1 Merge)
  ├──► EUM-003 (Audit Service) ────────────────────┤         │
  │                                                │         │
  └──► EUM-004 (RBAC Service) ─────────────────────┘         │
                                                             │
  ═══════════════════════════════════════════════════════════╪═══
                                                             │
                                                             ▼
  ┌──────────────────────────────────────────────────────────┤
  │                                                          │
  ├──► EUM-006 (Entra ID SSO) ─────────────────────┐         │
  │                                                │         │
  ├──► EUM-007 (Google Workspace SSO) ─────────────┤         │
  │                                                │──► EUM-010 (Phase 2 Merge)
  ├──► EUM-008 (SSO Core) ─────────────────────────┤         │
  │                                                │         │
  └──► EUM-009 (JIT Provisioning) ─────────────────┘         │
                                                             │
  ═══════════════════════════════════════════════════════════╪═══
                                                             │
                                                             ▼
  ┌──────────────────────────────────────────────────────────┤
  │                                                          │
  ├──► EUM-011 (Org Settings UI) ──────────────────┐         │
  │                                                │         │
  ├──► EUM-012 (Team Members UI) ──────────────────┤         │
  │                                                │──► EUM-015 (Phase 3 Merge)
  ├──► EUM-013 (SSO Config UI) ────────────────────┤         │
  │                                                │         │
  └──► EUM-014 (Audit Logs UI) ────────────────────┘         │
                                                             │
  ═══════════════════════════════════════════════════════════╪═══
                                                             │
                                                             ▼
  ┌──────────────────────────────────────────────────────────┤
  │                                                          │
  ├──► EUM-016 (SCIM Server) ──────────────────────┐         │
  │                                                │         │
  ├──► EUM-017 (SCIM Token UI) ────────────────────┤         │
  │                                                │──► EUM-020 (Phase 4 Merge/Release)
  ├──► EUM-018 (Provisioning UI) ──────────────────┤
  │                                                │
  └──► EUM-019 (Directory Sync) ───────────────────┘

                                                             │
                                                             ▼
                                                           DONE
```

## Parallel Execution Groups

### Group A - Phase 1 (Start Immediately)
- EUM-001, EUM-002, EUM-003, EUM-004

### Group B - Phase 1 Merge (After Group A)
- EUM-005

### Group C - Phase 2 (After EUM-005)
- EUM-006, EUM-007, EUM-008, EUM-009

### Group D - Phase 2 Merge (After Group C)
- EUM-010

### Group E - Phase 3 (After EUM-010)
- EUM-011, EUM-012, EUM-013, EUM-014

### Group F - Phase 3 Merge (After Group E)
- EUM-015

### Group G - Phase 4 (After EUM-015)
- EUM-016, EUM-017, EUM-018, EUM-019

### Group H - Phase 4 Merge/Release (After Group G)
- EUM-020

## Base Branch

All tasks should branch from: `claude/enterprise-user-management-01K9LtV4dLAPHbnGTSvG6Cms`

## Task Status

| Task | Title | Phase | Status | Assignee Branch |
|------|-------|-------|--------|-----------------|
| EUM-001 | Database Schema | 1 | 🔴 Not Started | - |
| EUM-002 | Organization Service | 1 | 🔴 Not Started | - |
| EUM-003 | Audit Logging Service | 1 | 🔴 Not Started | - |
| EUM-004 | RBAC Service | 1 | 🔴 Not Started | - |
| EUM-005 | Phase 1 Integration | 1 | 🔴 Blocked (needs 001-004) | - |
| EUM-006 | Entra ID SSO | 2 | 🔴 Blocked (needs 005) | - |
| EUM-007 | Google Workspace SSO | 2 | 🔴 Blocked (needs 005) | - |
| EUM-008 | SSO Core Service | 2 | 🔴 Blocked (needs 005) | - |
| EUM-009 | JIT Provisioning | 2 | 🔴 Blocked (needs 005) | - |
| EUM-010 | SSO Integration | 2 | 🔴 Blocked (needs 006-009) | - |
| EUM-011 | Org Settings UI | 3 | 🔴 Blocked (needs 010) | - |
| EUM-012 | Team Members UI | 3 | 🔴 Blocked (needs 010) | - |
| EUM-013 | SSO Config Wizard | 3 | 🔴 Blocked (needs 010) | - |
| EUM-014 | Audit Logs Viewer | 3 | 🔴 Blocked (needs 010) | - |
| EUM-015 | Portal Integration | 3 | 🔴 Blocked (needs 011-014) | - |
| EUM-016 | SCIM Server | 4 | 🔴 Blocked (needs 015) | - |
| EUM-017 | SCIM Token UI | 4 | 🔴 Blocked (needs 015) | - |
| EUM-018 | Provisioning Status UI | 4 | 🔴 Blocked (needs 015) | - |
| EUM-019 | Directory Sync | 4 | 🔴 Blocked (needs 015) | - |
| EUM-020 | Final QA & Release | 4 | 🔴 Blocked (needs 016-019) | - |

## Workflow for Each Claude Instance

1. Read your assigned `EUM-XXX.md` file completely
2. Branch from `claude/enterprise-user-management-01K9LtV4dLAPHbnGTSvG6Cms`
3. Complete the task following the specification exactly
4. Run all checks: `npm run type-check && npm run lint && npm test`
5. Update the "Work Summary" section in your task file
6. Push your branch and create a PR
7. Update this README with your branch name

## Important Notes

- **Existing Auth**: We already have Microsoft and Google OAuth - you're extending these for enterprise SSO
- **Supabase**: All cloud data goes to Supabase PostgreSQL with RLS
- **No External Vendors**: Do NOT use WorkOS, Auth0, Okta, or similar
- **Type Safety**: All code must be TypeScript strict mode compliant
- **Testing**: Minimum 80% coverage for services

## Quick Reference

| Phase | Parallel Tasks | Merge Task | Blocked Until |
|-------|---------------|------------|---------------|
| **1** | EUM-001, EUM-002, EUM-003, EUM-004 | EUM-005 | - |
| **2** | EUM-006, EUM-007, EUM-008, EUM-009 | EUM-010 | EUM-005 |
| **3** | EUM-011, EUM-012, EUM-013, EUM-014 | EUM-015 | EUM-010 |
| **4** | EUM-016, EUM-017, EUM-018, EUM-019 | EUM-020 | EUM-015 |
