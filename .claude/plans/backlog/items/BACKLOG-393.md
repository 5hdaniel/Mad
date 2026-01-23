# BACKLOG-393: Desktop - Attachment Upload Service

**Priority:** P0 (Critical)
**Category:** service / desktop
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~30K

---

## Summary

Create a service to upload transaction attachments from the local filesystem to Supabase Storage, with progress tracking, retry logic, and proper path organization.

---

## Problem Statement

When submitting transactions for broker review, all attachments must be uploaded to Supabase Storage so the broker can view them in the web portal. This requires:
1. Reading local files from disk
2. Uploading to Supabase Storage
3. Organizing files by org/submission/filename
4. Handling large files and network issues
5. Tracking upload progress for UI

---

## Proposed Solution

### Service Architecture

Create `electron/services/supabaseStorageService.ts`:

```typescript
interface UploadProgress {
  filename: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'complete' | 'failed';
  error?: string;
}

interface AttachmentUploadResult {
  localId: string;
  storagePath: string;
  publicUrl?: string;
  success: boolean;
  error?: string;
}

class SupabaseStorageService {
  /**
   * Upload a single attachment to Supabase Storage
   */
  async uploadAttachment(
    orgId: string,
    submissionId: string,
    localPath: string,
    filename: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<AttachmentUploadResult>;

  /**
   * Upload multiple attachments for a submission
   */
  async uploadAttachments(
    orgId: string,
    submissionId: string,
    attachments: LocalAttachment[],
    onProgress?: (overall: number, current: UploadProgress) => void
  ): Promise<AttachmentUploadResult[]>;

  /**
   * Get signed URL for viewing (broker portal use)
   */
  async getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;

  /**
   * Delete attachment from storage (cleanup on failure)
   */
  async deleteAttachment(storagePath: string): Promise<void>;
}
```

### Storage Path Convention

```
submission-attachments/
  {org_id}/
    {submission_id}/
      {original_filename}
```

Example:
```
submission-attachments/
  org-demo-001/
    sub-abc-123/
      inspection_report.pdf
      property_photo_1.jpg
      contract_signed.pdf
```

### File Reading

Read files from local paths stored in the attachments table:

```typescript
async function readLocalFile(localPath: string): Promise<Buffer> {
  // Handle different attachment sources:
  // 1. Email attachments (stored path)
  // 2. iMessage attachments (~/Library/Messages/...)
  // 3. Manually added files
  
  const absolutePath = resolveAttachmentPath(localPath);
  return fs.promises.readFile(absolutePath);
}
```

### Upload Implementation

```typescript
async uploadAttachment(
  orgId: string,
  submissionId: string,
  localPath: string,
  filename: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<AttachmentUploadResult> {
  const storagePath = `${orgId}/${submissionId}/${sanitizeFilename(filename)}`;
  
  try {
    // Read local file
    const fileBuffer = await readLocalFile(localPath);
    const mimeType = getMimeType(filename);
    
    // Report starting
    onProgress?.({
      filename,
      bytesUploaded: 0,
      totalBytes: fileBuffer.length,
      percentage: 0,
      status: 'uploading'
    });
    
    // Upload to Supabase
    // Note: Supabase JS client doesn't support progress for small files
    // For large files, consider chunked upload (post-demo)
    const { data, error } = await supabase.storage
      .from('submission-attachments')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false // Don't overwrite
      });
    
    if (error) throw error;
    
    // Report complete
    onProgress?.({
      filename,
      bytesUploaded: fileBuffer.length,
      totalBytes: fileBuffer.length,
      percentage: 100,
      status: 'complete'
    });
    
    return {
      localId: localPath,
      storagePath: data.path,
      success: true
    };
    
  } catch (error) {
    onProgress?.({
      filename,
      bytesUploaded: 0,
      totalBytes: 0,
      percentage: 0,
      status: 'failed',
      error: error.message
    });
    
    return {
      localId: localPath,
      storagePath: '',
      success: false,
      error: error.message
    };
  }
}
```

### Retry Logic

```typescript
async uploadWithRetry(
  ...args: Parameters<typeof uploadAttachment>,
  maxRetries = 3
): Promise<AttachmentUploadResult> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.uploadAttachment(...args);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }
  
  throw lastError;
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/services/supabaseStorageService.ts` | New service file |
| `electron/services/supabaseService.ts` | Export storage client |
| `electron/preload/preload.ts` | Expose upload IPC |
| `src/services/attachmentUploadService.ts` | Renderer-side wrapper |
| `electron/utils/fileUtils.ts` | Path resolution helpers |

---

## Dependencies

- BACKLOG-388: Storage bucket must exist with proper policies
- BACKLOG-390: Local schema (to read attachment records)

---

## Acceptance Criteria

- [ ] Can upload single attachment to Supabase Storage
- [ ] Can upload multiple attachments with progress
- [ ] Proper path organization (org/submission/file)
- [ ] Handles missing local files gracefully
- [ ] Retry logic for transient failures
- [ ] Progress callbacks work correctly
- [ ] Cleanup on partial failure
- [ ] MIME types set correctly
- [ ] Filename sanitization (no special chars)

---

## Technical Notes

### Auth Context

For demo, use service key for uploads (bypasses RLS):

```typescript
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Service key, not anon key
);
```

**Production Migration:** Must authenticate user and use their JWT.

### File Size Limits

Supabase Storage default limits:
- Max file size: 50MB (configured in bucket)
- Max request size: 6MB (needs chunked upload for larger)

For demo, 50MB per file is acceptable. Chunked uploads are post-demo.

### MIME Type Detection

```typescript
import mime from 'mime-types';

function getMimeType(filename: string): string {
  return mime.lookup(filename) || 'application/octet-stream';
}
```

### Filename Sanitization

```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars
    .replace(/__+/g, '_')               // Collapse multiple underscores
    .substring(0, 255);                 // Limit length
}
```

### Deduplication

If same file is submitted multiple times, use `upsert: false` to error on duplicate. Alternatively, add timestamp or UUID to path.

---

## Testing Plan

1. Upload single small file (~100KB)
2. Upload single large file (~10MB)
3. Upload multiple files in batch
4. Test progress callback accuracy
5. Test retry on network failure
6. Test missing local file handling
7. Test filename sanitization
8. Test MIME type detection
9. Verify files accessible via signed URL

---

## Related Items

- BACKLOG-388: RLS Policies + Storage (dependency)
- BACKLOG-394: Transaction Push Service (uses this)
- BACKLOG-401: Attachment Viewer (consumes uploaded files)
- SPRINT-050: B2B Broker Portal Demo
