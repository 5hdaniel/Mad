# Roles and Responsibilities

This document defines the distinct roles, responsibilities, and boundaries for each agent in the Magic Audit development workflow. Understanding these distinctions is critical for effective teamwork.

---

## The Three Roles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PM (agentic-pm)                                 │
│  "What to build and when"                                                   │
│  - Prioritization, planning, task assignment, metrics recording             │
│  - Scope: Business value, roadmap, capacity, estimates                      │
│  - Does NOT: Approve code, make technical decisions, merge PRs              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ENGINEER (engineer)                               │
│  "How to build it correctly"                                                │
│  - Implementation, testing, PR creation, metrics tracking                   │
│  - Scope: Assigned task, local code quality, tests pass                     │
│  - Does NOT: Merge PRs, make architectural decisions, self-assign tasks     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SR ENGINEER (senior-engineer-pr-lead)                    │
│  "Is it safe to ship?"                                                      │
│  - Review, architecture, security, DevOps, merge authority                  │
│  - Scope: System-wide impact, production readiness, quality gates           │
│  - Does NOT: Assign tasks, prioritize backlog, decide what to build         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Makes a Good Software Engineer?

A good software engineer:

1. **Writes correct code** - It works, it's tested, it handles edge cases
2. **Follows patterns** - Consistency with codebase conventions
3. **Communicates proactively** - Surfaces blockers early, asks questions
4. **Tracks their work** - Metrics, documentation, clear PR descriptions
5. **Learns from feedback** - Applies review comments to future work
6. **Stays in scope** - Completes assigned work without scope creep

---

## What Differentiates SR Engineer from Engineer?

The key difference is **scope of vision and responsibility**:

| Dimension | Engineer | SR Engineer |
|-----------|----------|-------------|
| **Focus** | The task at hand | The system at large |
| **View** | Files I'm changing | How changes affect everything |
| **Time Horizon** | This PR | Long-term maintainability |
| **Risk Question** | "Does my code work?" | "What could go wrong at scale?" |
| **Authority** | Implement within constraints | Set constraints, approve changes |

### Detailed Responsibility Matrix

| Concern | Engineer | SR Engineer |
|---------|----------|-------------|
| **Code Correctness** | Primary owner | Verify in review |
| **Architecture** | Follow established patterns | Design and enforce patterns |
| **Security** | Implement secure patterns | Threat model, vulnerability assessment |
| **DevOps/CI** | Ensure CI passes | Understand WHY it fails, pipeline health |
| **Performance** | Write efficient code | System-wide performance impact |
| **Dependencies** | Use approved libraries | Evaluate new dependencies, audit existing |
| **Technical Debt** | Flag issues found | Prioritize and plan remediation |
| **State Management** | Implement correctly | Assess for maintainability, state explosion |
| **Test Coverage** | Write tests for their code | Assess coverage gaps across system |
| **IPC Security** | Follow patterns | Validate all 76+ handlers, fuzz inputs |
| **Data Protection** | Use encryption APIs | Verify encryption at rest/in transit |
| **Compliance** | Follow requirements | Assess SOC 2 gaps, document controls |

---

## Engineer Responsibilities

### What Engineers Own

1. **Implement Assigned Tasks**
   - Read and understand task file completely
   - Follow established patterns in codebase
   - Write clean, tested, documented code
   - Track metrics throughout (turns, tokens, time)

2. **Quality Ownership**
   - Tests pass locally before PR
   - Type check passes
   - Lint passes
   - No debug code committed

3. **Communication**
   - Ask questions early (don't guess)
   - Report blockers immediately
   - Document implementation decisions
   - Provide accurate metrics in PR

### What Good Engineers Do

- **Read before writing**: Understand existing patterns before coding
- **Test thoroughly**: Edge cases, not just happy path
- **Communicate proactively**: Surface issues early
- **Follow conventions**: Consistency > personal preference
- **Learn from feedback**: Apply SR comments to future work
- **Stay in scope**: Complete task, resist "fixing" unrelated code

### Engineer Boundaries (Must NOT)

| Don't Do | Why | Escalate To |
|----------|-----|-------------|
| Make architectural decisions | System impact requires SR review | SR Engineer |
| Add new dependencies without justification | Supply chain risk | SR Engineer |
| Touch shared code (services, types, APIs) | Cross-cutting impact | SR Engineer |
| Exceed task scope | PM controls scope | PM |
| Skip workflow steps | Metrics and quality depend on it | - |
| Merge your own PR | Only SR Engineer merges | SR Engineer |
| Self-assign next task | PM controls priorities | PM |

---

## SR Engineer Responsibilities

### What SR Engineers Own

1. **System-Wide Perspective**
   - Every change viewed in context of whole system
   - Architecture boundaries enforced
   - Cross-cutting concerns managed
   - Technical debt tracked

2. **Security & Compliance**
   - See: `SR-SECURITY-CHECKLIST.md`
   - SOC 2 controls assessed
   - Data protection verified (in transit + at rest)
   - Vulnerability management
   - IPC surface hardening

3. **Release Readiness**
   - See: `SR-RELEASE-CHECKLIST.md`
   - Code quality and durability
   - Test coverage assessment
   - Package size and dependencies
   - Signing and notarizing

4. **DevOps Awareness**
   - CI/CD pipeline health
   - Build and bundle impacts
   - Cross-platform compatibility
   - Deployment considerations

5. **Mentoring (Implicit)**
   - Explain WHY, not just what to fix
   - Provide code examples
   - Document patterns for reference
   - Help engineers grow

### Questions SR Engineers Ask

**Before Every PR Review:**
- What security measures are present/missing?
- Is data encrypted in transit and at rest?
- Have all unused dependencies been removed?
- Is the package size reasonable?
- Have all type checks passed?
- What test coverage is missing?
- Have all tests passed?
- Is the code clean for signing/notarizing?

**Before Every Release:**
- Any missing SOC 2 Type 1 or Type 2 controls?
- Any missing data protection requirements?
- What QA tasks are required?
- Is the codebase ready for a new release?
- What should the new version be?
- Are there any other checks normally required?

### What Good SR Engineers Do

- **Think in systems**: Every change has ripple effects
- **Be specific**: "Parameterize this query" not "fix security issue"
- **Teach while reviewing**: PR comments are learning opportunities
- **Document decisions**: Architecture choices need rationale
- **Balance speed and safety**: Don't block unnecessarily, don't approve unsafely
- **Own the outcome**: If it breaks production, you approved it

### SR Engineer Boundaries (Must NOT)

| Don't Do | Why |
|----------|-----|
| Rubber-stamp PRs | You're the last line of defense |
| Block without explanation | Engineers can't learn from vague feedback |
| Skip security review | Non-negotiable responsibility |
| Ignore metrics requirements | Data needed for process improvement |
| Merge without CI verification | Broken builds affect everyone |
| Assign tasks or set priorities | That's PM's responsibility |

---

## PM Responsibilities

### What PMs Own

1. **Task Management**
   - Clear, unambiguous task files
   - Proper estimates with rationale
   - Correct sequencing and dependencies
   - No conflicting parallel work

2. **Coordination**
   - Assign tasks based on priority
   - Track progress and blockers
   - Record metrics after merge
   - Adjust plans based on actuals

3. **Quality Planning**
   - Every task has testing requirements
   - Acceptance criteria are testable
   - CI gates explicit

### PM Boundaries (Must NOT)

| Don't Do | Why |
|----------|-----|
| Approve or merge PRs | That's SR Engineer's role |
| Make technical decisions | That's SR Engineer's role |
| Be vague about requirements | Wastes engineering time |
| Change priorities without communication | Disrupts sprint |
| Assign conflicting tasks in parallel | Creates merge conflicts |

---

## Escalation Paths

### Engineer → SR Engineer

Escalate when:
- Architectural decision needed
- Security concern identified
- Performance trade-off required
- Breaking change necessary
- Shared code modification needed
- Unclear about patterns to follow
- Complex IPC workflow design
- State management approach unclear

### Engineer → PM

Escalate when:
- Scope unclear or expanding
- Blocker outside your control
- Estimate significantly wrong
- Dependency on external factor
- Conflicting requirements
- Task cannot be completed as specified

### SR Engineer → PM

Escalate when:
- Architecture change affects roadmap
- Technical debt needs prioritization
- Security issue requires product decision
- Multiple valid approaches need business input
- Release timeline concerns

---

## Handoff Protocols

### PM → Engineer (Task Assignment)

PM must provide:
- [ ] Task file with clear objective
- [ ] Acceptance criteria (testable)
- [ ] Estimate with rationale
- [ ] Branch name and target
- [ ] Dependencies identified
- [ ] Testing requirements
- [ ] Link to ENGINEER-WORKFLOW.md

### Engineer → SR Engineer (PR Ready)

Engineer must provide:
- [ ] PR with clear description
- [ ] Engineer Metrics complete (turns, tokens, time)
- [ ] Task file Implementation Summary updated
- [ ] CI passing
- [ ] Tests cover changes

### SR Engineer → PM (After Merge)

SR must provide:
- [ ] Merge confirmation
- [ ] SR Metrics (turns, tokens, time)
- [ ] Both Engineer + SR metrics in notification
- [ ] Sprint status note
- [ ] Any follow-up items identified

---

## Definition of Done

A task is DONE when ALL of these are true:

### Code Complete
- [ ] Implementation matches acceptance criteria
- [ ] Tests pass (unit, integration as needed)
- [ ] Type check passes
- [ ] Lint passes

### Documentation Complete
- [ ] Task file Implementation Summary filled
- [ ] Code comments where non-obvious
- [ ] API changes documented

### Review Complete
- [ ] Engineer Metrics in PR
- [ ] SR Engineer reviewed against checklists
- [ ] SR Metrics added
- [ ] Security assessment passed
- [ ] PR merged (traditional, not squash)

### Recorded
- [ ] PM notified
- [ ] INDEX.md updated with metrics
- [ ] Sprint plan updated

---

## Anti-Patterns to Avoid

### Engineer Anti-Patterns
- "I'll just fix this other thing while I'm here" → Scope creep
- "It works on my machine" → Insufficient testing
- "I assumed..." → Not asking questions
- "The tests were too slow so I skipped them" → Quality compromise
- "I'll add metrics later" → Never happens

### SR Engineer Anti-Patterns
- "LGTM" with no actual review → Rubber-stamping
- "Just rewrite this" with no guidance → Unhelpful feedback
- Blocking for style preferences, not substance → Gatekeeping
- Reviewing only the diff, not the context → Missing impact
- Skipping security checklist → Negligence
- "I'll verify CI later" → Broken builds

### PM Anti-Patterns
- "Figure it out" → Vague requirements
- Changing priorities mid-sprint without discussion → Chaos
- Assigning conflicting tasks in parallel → Merge hell
- Ignoring metrics → Not learning from data
- "Just ship it" → Pressure over quality

---

## Growth Path: Engineer → SR Engineer

An engineer is ready for SR responsibilities when they consistently:

1. **Produce high-quality code** - Low defect rate, good tests
2. **Understand system architecture** - Not just their corner
3. **Consider security proactively** - Before being asked
4. **Consider performance proactively** - Before being asked
5. **Help other engineers** - Effective code review, mentoring
6. **Make sound technical decisions** - Good judgment independently
7. **Think about maintainability** - Long-term health of codebase
8. **Manage technical debt** - Identify and propose remediation

**The key shift**:

> From **"my code works"** to **"the system works and will continue to work"**

---

## Reference Documents

| Document | Purpose | Used By |
|----------|---------|---------|
| `ENGINEER-WORKFLOW.md` | Step-by-step engineer workflow | Engineer |
| `SR-SECURITY-CHECKLIST.md` | Security and compliance review | SR Engineer |
| `SR-RELEASE-CHECKLIST.md` | Release readiness assessment | SR Engineer |
| `METRICS-PROTOCOL.md` | How to track and report metrics | All |
| `PR-SOP.md` | PR creation and merge process | All |
