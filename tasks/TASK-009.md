# TASK-009: Sync Progress UI

## Task Info
- **Task ID:** TASK-009
- **Phase:** 3 - UI/UX
- **Dependencies:** None (can use mock progress data)
- **Can Start:** Immediately
- **Estimated Effort:** 2-3 days

## Goal

Create React components to display backup/sync progress with visual feedback including progress bar, current status, and estimated time.

## Background

When syncing messages from iPhone, the backup process can take 2-10+ minutes. Users need clear visual feedback showing progress, what's happening, and how much longer it might take.

## Deliverables

1. Progress bar component with percentage
2. Sync status display component
3. Sync complete/error summary component
4. Cancel sync confirmation

## Technical Requirements

### 1. Create Progress Bar Component

Create `src/components/sync/SyncProgressBar.tsx`:

```typescript
import React from 'react';

interface SyncProgressBarProps {
  percent: number;          // 0-100
  phase: string;           // e.g., "Preparing", "Transferring", "Processing"
  animated?: boolean;
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({
  percent,
  phase,
  animated = true
}) => {
  return (
    <div className="sync-progress">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{phase}</span>
        <span className="text-sm text-gray-500">{Math.round(percent)}%</span>
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
```

### 2. Create Sync Status Component

Create `src/components/sync/SyncStatus.tsx`:

```typescript
import React from 'react';
import { SyncProgressBar } from './SyncProgressBar';

interface SyncStatusProps {
  progress: BackupProgress;
  onCancel: () => void;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ progress, onCancel }) => {
  const phaseLabels = {
    preparing: 'Preparing sync...',
    transferring: 'Transferring data...',
    finishing: 'Almost done...'
  };

  return (
    <div className="sync-status">
      <div className="sync-icon-container">
        <SyncIcon className="animate-spin" />
      </div>

      <h3 className="text-lg font-medium mb-2">
        Syncing Your iPhone
      </h3>

      <SyncProgressBar
        percent={progress.percentComplete}
        phase={phaseLabels[progress.phase]}
      />

      {progress.currentFile && (
        <p className="text-sm text-gray-500 mt-2 truncate">
          {progress.currentFile}
        </p>
      )}

      {progress.filesTransferred && progress.totalFiles && (
        <p className="text-sm text-gray-500">
          {progress.filesTransferred} of {progress.totalFiles} files
        </p>
      )}

      <button
        onClick={onCancel}
        className="btn-secondary mt-4"
      >
        Cancel Sync
      </button>

      <p className="text-xs text-gray-400 mt-4">
        Keep your iPhone connected and unlocked
      </p>
    </div>
  );
};
```

### 3. Create Sync Complete Component

Create `src/components/sync/SyncComplete.tsx`:

```typescript
import React from 'react';

interface SyncCompleteProps {
  result: {
    messagesCount: number;
    contactsCount: number;
    duration: number;
  };
  onContinue: () => void;
}

export const SyncComplete: React.FC<SyncCompleteProps> = ({
  result,
  onContinue
}) => {
  const durationMinutes = Math.round(result.duration / 60000);

  return (
    <div className="sync-complete">
      <div className="success-icon-container">
        <CheckCircleIcon className="text-green-500" />
      </div>

      <h3 className="text-lg font-medium mb-2">
        Sync Complete!
      </h3>

      <div className="sync-summary">
        <div className="summary-row">
          <MessageIcon />
          <span>{result.messagesCount.toLocaleString()} messages</span>
        </div>
        <div className="summary-row">
          <ContactIcon />
          <span>{result.contactsCount.toLocaleString()} contacts</span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Completed in {durationMinutes} minute{durationMinutes !== 1 ? 's' : ''}
      </p>

      <button onClick={onContinue} className="btn-primary mt-4">
        View Messages
      </button>
    </div>
  );
};
```

### 4. Create Sync Error Component

Create `src/components/sync/SyncError.tsx`:

```typescript
import React from 'react';

interface SyncErrorProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}

export const SyncError: React.FC<SyncErrorProps> = ({
  error,
  onRetry,
  onCancel
}) => {
  const friendlyErrors: Record<string, string> = {
    'DEVICE_DISCONNECTED': 'Your iPhone was disconnected. Please reconnect and try again.',
    'DEVICE_LOCKED': 'Please unlock your iPhone and try again.',
    'BACKUP_FAILED': 'The sync could not be completed. Please try again.',
    'PASSWORD_INCORRECT': 'The backup password was incorrect. Please try again.',
  };

  const message = friendlyErrors[error] || 'An unexpected error occurred. Please try again.';

  return (
    <div className="sync-error">
      <div className="error-icon-container">
        <ExclamationCircleIcon className="text-red-500" />
      </div>

      <h3 className="text-lg font-medium mb-2">
        Sync Failed
      </h3>

      <p className="text-gray-600 mb-4">{message}</p>

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button onClick={onRetry} className="btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
};
```

### 5. Create Cancel Confirmation Modal

Create `src/components/sync/CancelSyncModal.tsx`:

```typescript
import React from 'react';

interface CancelSyncModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CancelSyncModal: React.FC<CancelSyncModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Cancel Sync?</h2>
        <p>
          The sync is still in progress. If you cancel now, no data
          will be saved and you'll need to start over.
        </p>
        <div className="modal-actions">
          <button onClick={onCancel} className="btn-secondary">
            Continue Sync
          </button>
          <button onClick={onConfirm} className="btn-danger">
            Cancel Sync
          </button>
        </div>
      </div>
    </div>
  );
};
```

## Files to Create

- `src/components/sync/SyncProgressBar.tsx`
- `src/components/sync/SyncStatus.tsx`
- `src/components/sync/SyncComplete.tsx`
- `src/components/sync/SyncError.tsx`
- `src/components/sync/CancelSyncModal.tsx`
- `src/components/sync/index.ts` (exports)

## Styling Requirements

Add to existing CSS or create `src/components/sync/sync.css`:

```css
.progress-track {
  @apply w-full h-2 bg-gray-200 rounded-full overflow-hidden;
}

.progress-fill {
  @apply h-full bg-blue-500 rounded-full transition-all duration-300;
}

.sync-status,
.sync-complete,
.sync-error {
  @apply flex flex-col items-center text-center p-6;
}
```

## Dos

- ✅ Follow existing component patterns
- ✅ Use meaningful animations (not distracting)
- ✅ Show user-friendly error messages
- ✅ Confirm before canceling an in-progress sync
- ✅ Handle all edge cases (0%, 100%, unknown total)

## Don'ts

- ❌ Don't show raw error codes to users
- ❌ Don't make the cancel button too easy to accidentally click
- ❌ Don't show decimal percentages (round to whole numbers)
- ❌ Don't freeze the UI during sync

## Testing Instructions

1. Test progress bar at 0%, 50%, 100%
2. Test with mock progress updates
3. Test cancel flow with confirmation
4. Test error display with different error codes
5. Test completion summary display

## Mock Progress Data

```typescript
const mockProgress: BackupProgress = {
  phase: 'transferring',
  percentComplete: 45,
  currentFile: 'Library/SMS/sms.db',
  filesTransferred: 450,
  totalFiles: 1000,
  bytesTransferred: 50000000,
  totalBytes: 100000000
};
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Components tested with mock data
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added for components
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
[FILL IN YOUR BRANCH NAME HERE]
```

### Changes Made
```
[LIST THE FILES YOU MODIFIED AND WHAT YOU CHANGED]
```

### Testing Done
```
[DESCRIBE WHAT TESTING YOU PERFORMED]
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
