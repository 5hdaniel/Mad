# PC Release - Task Management

This folder contains task specifications for the Windows/PC release of Magic Audit.

## Overview

The PC release enables iPhone message and contact extraction via USB cable using libimobiledevice.

## Phase Structure

```
Phase 1: Foundation (Run in Parallel)
├── TASK-001: Windows Build Configuration
├── TASK-002: Bundle libimobiledevice Binaries
└── TASK-003: Device Detection Service

Phase 2: Core Services
├── TASK-004: Messages Database Parser (No dependencies - can start early)
├── TASK-005: Contacts Database Parser (No dependencies - can start early)
├── TASK-006: Backup Service (Depends on: TASK-002, TASK-003)
└── TASK-007: Encrypted Backup Handler (Depends on: TASK-006)

Phase 3: UI/UX (Can run parallel with Phase 2)
├── TASK-008: iPhone Connection UI
├── TASK-009: Sync Progress UI
└── TASK-010: Platform Feature Toggle

Phase 4: Integration (Depends on Phase 2 & 3)
└── TASK-011: Integration & E2E Testing
```

## Dependency Graph

```
TASK-001 ─────────────────────────────────────────┐
TASK-002 ──────┬──────────────────────────────────┤
TASK-003 ──────┤                                  │
               ▼                                  │
           TASK-006 ────► TASK-007                │
               │              │                   │
TASK-004 ──────┼──────────────┼───────────────────┤
TASK-005 ──────┼──────────────┼───────────────────┤
               │              │                   │
TASK-008 ──────┼──────────────┼───────────────────┤
TASK-009 ──────┼──────────────┼───────────────────┤
TASK-010 ──────┼──────────────┼───────────────────┤
               │              │                   │
               ▼              ▼                   ▼
           ┌──────────────────────────────────────┐
           │           TASK-011                   │
           │     Integration & E2E Testing        │
           └──────────────────────────────────────┘
```

## Parallel Execution Groups

### Group A (Start Immediately)
- TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-008, TASK-009, TASK-010

### Group B (After TASK-002 & TASK-003 Complete)
- TASK-006

### Group C (After TASK-006 Complete)
- TASK-007

### Group D (After All Above Complete)
- TASK-011

## Base Branch

All tasks should branch from: `claude/pc-release-planning-014DsWKZbyJf9JtN5kjer4LF`

## Task Status

| Task | Title | Status | Assignee Branch |
|------|-------|--------|-----------------|
| TASK-001 | Windows Build Configuration | ✅ Complete | claude/complete-task-001-01WBurUNhB9dfyLi3c5a4jrn |
| TASK-002 | Bundle libimobiledevice | 🔴 Not Started | - |
| TASK-003 | Device Detection Service | ✅ Complete | claude/complete-task-00-01PhsgWpuf2fzhxQkZtpAhuy |
| TASK-004 | Messages Database Parser | ✅ Complete | claude/complete-task-xx-01AMrjeWWdUcKjnreM16zSPZ |
| TASK-005 | Contacts Database Parser | ✅ Complete | claude/complete-task-005-01VC8mqRf2XeV5WmG2cYW6ZV |
| TASK-006 | Backup Service | 🟡 Blocked (needs 002) | - |
| TASK-007 | Encrypted Backup Handler | 🔴 Blocked (needs 006) | - |
| TASK-008 | iPhone Connection UI | 🔴 Not Started | - |
| TASK-009 | Sync Progress UI | 🔴 Not Started | - |
| TASK-010 | Platform Feature Toggle | 🔴 Not Started | - |
| TASK-011 | Integration & E2E Testing | 🔴 Blocked (needs all) | - |

## Workflow for Each Claude Instance

1. Read your assigned TASK-XXX.md file
2. Branch from `claude/pc-release-planning-014DsWKZbyJf9JtN5kjer4LF`
3. Complete the task following the specification
4. Complete PR preparation checklist
5. Update the "Work Summary" section in your task file
6. Push your branch and update the task file with your branch name
