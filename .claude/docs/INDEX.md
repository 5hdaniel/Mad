# Documentation Index

**Last Updated:** 2024-12-24

This is the master index for all Claude agent documentation in Magic Audit.

---

## Quick Navigation

| Need To... | Go To |
|------------|-------|
| Implement a task | [Engineer Workflow](#engineer-workflow) |
| Review a PR | [SR Engineer](#sr-engineer) |
| Plan a sprint | [PM / Agentic PM](#pm--agentic-pm) |
| Create a PR | [PR-SOP](#process-documents) |
| Fix native module issues | [Native Module Fixes](#shared-reference-documents) |
| Understand architecture rules | [Architecture Guardrails](#shared-reference-documents) |

---

## Agent Configurations

| Agent | File | When to Use |
|-------|------|-------------|
| **Engineer** | `.claude/agents/engineer.md` | Task implementation, branch creation, PR submission |
| **SR Engineer** | `.claude/agents/senior-engineer-pr-lead.md` | PR review, architecture decisions, merge approval |
| **PM** | `.claude/agents/agentic-pm.md` | Sprint planning, backlog management, task assignment |

---

## Process Documents

| Document | Location | Purpose |
|----------|----------|---------|
| **PR-SOP** | `.claude/docs/PR-SOP.md` | Complete 9-phase PR checklist |
| **Engineer Workflow** | `.claude/docs/ENGINEER-WORKFLOW.md` | 8-step task implementation checklist |
| **LLM Integration Testing** | `.claude/docs/LLM-INTEGRATION-TESTING.md` | AI feature testing checklist |

---

## Shared Reference Documents

These are the **canonical sources** for content that was previously duplicated across multiple files. Always reference these instead of duplicating content.

| Document | Location | Content |
|----------|----------|---------|
| **Plan-First Protocol** | `.claude/docs/shared/plan-first-protocol.md` | Mandatory planning steps for all agents |
| **Metrics Templates** | `.claude/docs/shared/metrics-templates.md` | Engineer, SR, and PM metrics formats |
| **Architecture Guardrails** | `.claude/docs/shared/architecture-guardrails.md` | Entry file budgets, state machine patterns |
| **Effect Safety Patterns** | `.claude/docs/shared/effect-safety-patterns.md` | React effect patterns to prevent bugs |
| **Git Branching** | `.claude/docs/shared/git-branching.md` | Branching strategy, merge policy |
| **Native Module Fixes** | `.claude/docs/shared/native-module-fixes.md` | SQLite rebuild troubleshooting |

---

## PM Skill & Modules

The PM skill uses progressive disclosure - load only what you need.

| Module | Location | Purpose |
|--------|----------|---------|
| **Skill Definition** | `.claude/skills/agentic-pm/SKILL.md` | Main PM skill configuration |
| **Backlog Prioritization** | `.claude/skills/agentic-pm/modules/backlog-prioritization.md` | MoSCoW, RICE frameworks |
| **Sprint Selection** | `.claude/skills/agentic-pm/modules/sprint-selection.md` | Phase planning |
| **Task File Authoring** | `.claude/skills/agentic-pm/modules/task-file-authoring.md` | Creating task files |
| **Dependency Graph** | `.claude/skills/agentic-pm/modules/dependency-graph.md` | Task dependencies |
| **Testing & Quality** | `.claude/skills/agentic-pm/modules/testing-quality-planning.md` | Test planning |

**Templates:** `.claude/skills/agentic-pm/templates/`

---

## Project Artifacts

| Artifact | Location | Naming Pattern |
|----------|----------|----------------|
| Sprint plans | `.claude/plans/sprints/` | `SPRINT-NNN-slug.md` |
| Task files | `.claude/plans/tasks/` | `TASK-NNN-slug.md` |
| Archived tasks | `.claude/plans/tasks/archive/` | `TASK-NNN-slug.md` |
| Backlog items | `.claude/plans/backlog/` | `BACKLOG-NNN.md` |
| Backlog index | `.claude/plans/backlog/INDEX.md` | Single file |
| Decision log | `.claude/plans/decision-log.md` | Single file |
| Risk register | `.claude/plans/risk-register.md` | Single file |

---

## Main Project Guide

| Document | Location | Purpose |
|----------|----------|---------|
| **CLAUDE.md** | `CLAUDE.md` (project root) | Main development guide, agent workflow, code standards |

---

## Document Maintenance

When updating documentation:

1. **Shared content** → Update in `.claude/docs/shared/`, not in individual files
2. **Process changes** → Update the relevant process doc AND notify agents
3. **New shared patterns** → Create in `.claude/docs/shared/` and reference from agents
4. **Deprecating content** → Add deprecation notice, then remove after one sprint

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Created shared docs structure, consolidated duplicates | Claude |
