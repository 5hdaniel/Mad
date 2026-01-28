# TASK-1158: Add "Back to Email Threads" Link in Full Audit PDF

**Backlog ID:** BACKLOG-355
**Sprint:** SPRINT-048
**Phase:** 1 (Track B - PDF Services, Parallel)
**Branch:** `feature/task-1158-back-to-emails-link`
**Estimated Turns:** 5-8
**Estimated Tokens:** 12K-18K

---

## Objective

Add a "Back to Email Threads" navigation link to email thread pages in the full audit PDF, similar to the existing "Back to Text Conversations" link for text threads.

---

## Context

In the full audit PDF (not audit package), text conversations have a "Back to Text Conversations" link that navigates back to the index. Email threads are missing this functionality.

**Current State:**
- Text threads have: "Back to Text Conversations" link (working)
- Email threads: No back link

**Expected State:**
- Text threads: "Back to Text Conversations" (existing)
- Email threads: "Back to Email Threads" (new)

Both should use PDF internal links (anchor tags) to navigate to their respective index sections.

---

## Requirements

### Must Do:
1. Add "Back to Email Threads" link to email thread appendix items
2. Use PDF internal links (anchor tags) like text threads
3. Style consistently with existing "Back to Text Conversations" link
4. Link should navigate to the Email Threads index section

### Must NOT Do:
- Change the audit package PDF generation (different service)
- Modify text thread link implementation
- Add links in summary-only exports

---

## Acceptance Criteria

- [ ] Email thread pages have "Back to Email Threads" link
- [ ] Link navigates to Email Threads index section in PDF
- [ ] Styling consistent with text conversation back link
- [ ] Works in full audit PDF export

---

## Files to Modify

- `electron/services/pdfExportService.ts` - Add back link to email appendix items (lines 848-888)

## Files to Read (for context)

- `electron/services/pdfExportService.ts` - Current implementation
  - Email appendix items: lines 853-888
  - Text thread back link: line 957 (reference)

---

## Technical Notes

### Text Thread Back Link (line 957)
```html
<a href="#text-conversations" class="back-to-top">&larr; Back to Text Conversations</a>
```

### Email Appendix Items (lines 853-888)
Currently missing the back link. Need to add anchor for email threads section and back links.

### Email Threads Section Header (lines 777-797)
Need to add anchor name:
```html
html += '<a name="email-threads"></a>';
html += '<h3>Email Threads (' + sortedEmails.length + ')</h3>';
```

### Email Appendix Back Link
Add after line 886:
```html
html += '<a href="#email-threads" class="back-to-top">&larr; Back to Email Threads</a>';
```

### CSS Class (already defined, lines 477-486)
```css
.back-to-top {
  color: #667eea;
  text-decoration: none;
  font-size: 12px;
  display: inline-block;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  width: 100%;
}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (PDF generation, test manually)
- **Existing tests to update:** None expected

### Manual Testing
- [ ] Export full PDF with emails and texts
- [ ] Navigate to an email in appendix
- [ ] Click "Back to Email Threads" link
- [ ] Verify navigation to Email Threads index section
- [ ] Verify styling matches text thread back link

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(pdf): add back to email threads link in appendix`
- **Branch:** `feature/task-1158-back-to-emails-link`
- **Target:** `int/sprint-ui-export-and-details`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/sprint-ui-export-and-details
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Email threads in PDF appendix have no back link
- **After**: Email threads have "Back to Email Threads" link
- **Actual Turns**: X (Est: 5-8)
- **Actual Tokens**: ~XK (Est: 12-18K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The PDF structure differs from expected
- Anchor navigation doesn't work in PDF
- You encounter blockers not covered in the task file
