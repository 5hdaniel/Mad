# BACKLOG-580: Attachments Tab Show Downloaded Files

**Priority:** Medium
**Category:** Feature
**Source:** SPRINT-067 QA feedback

## Problem

The Attachments tab currently parses attachment metadata from email JSON (`attachment_metadata` field in communications). This may show "0 files" if metadata wasn't synced, and doesn't reflect what's actually downloaded to disk.

## Solution

Wire the Attachments tab to query the `attachments` table directly (using the IPC infrastructure added in TASK-1781) and add click-to-open functionality.

## Deliverables

1. Update `useTransactionAttachments` hook to fetch from `attachments` table
2. Add click handler to open files with system viewer (using `shell.openPath`)
3. Show both text message and email attachments grouped appropriately

## Estimate

~30-45 min (infrastructure already exists from TASK-1781/1783)
