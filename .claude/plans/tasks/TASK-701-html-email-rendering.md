# Task TASK-701: HTML Email Rendering

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Update the EmailViewModal to properly render HTML emails. Currently, the modal displays `body_plain` (plain text) only, but emails often have rich HTML content stored in `body_html` that should be displayed properly.

## Non-Goals

- Do NOT add email editing capabilities
- Do NOT change email storage or parsing
- Do NOT modify the email sync process
- Do NOT add attachment preview functionality

## Deliverables

1. Update `EmailViewModal.tsx` to render HTML content with proper sanitization
2. Add toggle between HTML and plain text views
3. Ensure secure rendering (prevent XSS attacks)

## Current State

```typescript
// Current EmailViewModal.tsx (line 77-88)
{email.body_plain ? (
  <div className="prose prose-sm max-w-none">
    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
      {email.body_plain}
    </pre>
  </div>
) : (
  <p className="text-gray-500 italic text-center py-8">
    No email content available
  </p>
)}
```

The `email` object has `body_html` available but it's not being rendered.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx` | Add HTML rendering with sanitization |
| `src/components/transactionDetailsModule/types.ts` | Ensure `body_html` is in Communication type (verify) |

## Acceptance Criteria

- [ ] HTML emails render with proper formatting
- [ ] Plain text fallback when no HTML available
- [ ] Toggle to switch between HTML and plain text views
- [ ] HTML is sanitized to prevent XSS attacks
- [ ] Links open in external browser (not in app)
- [ ] Images render properly (or show placeholder)
- [ ] Styling is consistent with app design
- [ ] No security vulnerabilities introduced
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Security-First HTML Rendering

**Option A: Sandboxed iframe (Recommended)**

```typescript
// Safe HTML rendering with iframe sandbox
<iframe
  srcDoc={sanitizedHtml}
  sandbox="allow-same-origin"
  className="w-full h-full border-0"
  title="Email content"
/>
```

**Option B: DOMPurify (Alternative)**

```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML before rendering
const sanitizedHtml = DOMPurify.sanitize(email.body_html, {
  ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'a', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'table', 'tr', 'td', 'th', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style'],
  ALLOW_DATA_ATTR: false,
});

// Then use dangerouslySetInnerHTML with sanitized content
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

### Toggle UI Pattern

```typescript
const [viewMode, setViewMode] = useState<'html' | 'plain'>('html');

// Toggle button
<div className="flex items-center gap-2">
  <button
    onClick={() => setViewMode('html')}
    className={viewMode === 'html' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    Rich
  </button>
  <button
    onClick={() => setViewMode('plain')}
    className={viewMode === 'plain' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    Plain
  </button>
</div>
```

### External Link Handling

```typescript
// Ensure links open in external browser
const handleLinkClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A') {
    e.preventDefault();
    const href = (target as HTMLAnchorElement).href;
    window.api.shell.openExternal(href);
  }
};
```

## Do / Don't

### Do:

- Sanitize ALL HTML content before rendering
- Use sandboxed iframe or DOMPurify for security
- Provide plain text fallback
- Test with various email formats (newsletters, text-only, rich HTML)
- Handle missing `body_html` gracefully

### Don't:

- Don't use `dangerouslySetInnerHTML` without sanitization
- Don't allow scripts to execute in email content
- Don't trust external image sources without consideration
- Don't break existing plain text display

## When to Stop and Ask

- If security concerns arise that aren't addressed by sanitization
- If significant new dependencies are needed
- If the iframe approach causes CSP issues
- If email rendering looks broken for common email formats

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test HTML rendering with sanitization
  - Test plain text fallback
  - Test toggle between views
  - Test malicious HTML is stripped
- Existing tests to update:
  - EmailViewModal tests (if any exist)

### Coverage

- Coverage impact: Should improve (new functionality tested)

### Integration / Feature Tests

- Required scenarios:
  - Open email with HTML content -> renders properly
  - Open email with only plain text -> falls back gracefully
  - Toggle between views -> content updates
  - Malicious HTML in email -> sanitized (XSS test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(email): add HTML email rendering with sanitization`
- **Labels**: `enhancement`, `email`, `security`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 6-10
- **Tokens:** ~35K-55K
- **Time:** ~1-2h

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 1-2 files | +2-3 |
| Code volume | ~100-150 lines | +2-3 |
| Security implementation | DOMPurify or iframe | +1-2 |
| Test complexity | Medium (security tests) | +2-3 |

**Confidence:** High (clear scope, similar patterns exist)

**Risk factors:**
- CSP issues with iframe in Electron
- DOMPurify may need to be added as dependency

**Similar past tasks:** UI component updates typically 4-8 turns

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] (none expected)

Files modified:
- [ ] EmailViewModal.tsx

Features implemented:
- [ ] HTML rendering with sanitization
- [ ] View mode toggle
- [ ] External link handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document sanitization approach chosen and why>

**Issues encountered:**
<Document any challenges>

**Reviewer notes:**
<Security implementation details for review>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 1-2 | X | +/- X | <reason> |
| Code volume | ~100-150 lines | ~X lines | +/- X | <reason> |
| Security impl | Medium | Low/Med/High | - | <reason> |
| Test complexity | Medium | Low/Med/High | - | <reason> |

**Total Variance:** Est 6-10 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL (CRITICAL for this task)
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Security review is mandatory - verify sanitization approach>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
