# BACKLOG-401: Portal - Message & Attachment Viewer

**Priority:** P1 (Should Have)
**Category:** ui / portal
**Created:** 2026-01-22
**Status:** Completed
**Sprint:** SPRINT-050
**Estimated Tokens:** ~30K

---

## Summary

Create modal components for viewing full message content and downloading/previewing attachments in the broker portal.

---

## Problem Statement

In the submission detail view, messages show only a preview. Brokers need to:
1. View full message content (especially long emails)
2. See complete participant lists
3. View attachment previews (images, PDFs)
4. Download attachments for offline review

---

## Proposed Solution

### MessageViewerModal

Create `broker-portal/components/submission/MessageViewerModal.tsx`:

```tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Mail, MessageSquare, ArrowUp, ArrowDown, Paperclip } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Message {
  id: string
  channel: 'email' | 'sms' | 'imessage'
  direction: 'inbound' | 'outbound'
  subject: string | null
  body_text: string | null
  participants: {
    from?: string
    to?: string[]
    cc?: string[]
    bcc?: string[]
  }
  sent_at: string | null
  has_attachments: boolean
  attachment_count: number
}

interface MessageViewerModalProps {
  message: Message | null
  open: boolean
  onClose: () => void
  attachments?: Array<{
    id: string
    filename: string
    mime_type: string
    storage_path: string
  }>
}

export function MessageViewerModal({ message, open, onClose, attachments }: MessageViewerModalProps) {
  if (!message) return null
  
  const isEmail = message.channel === 'email'
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isEmail ? 'bg-blue-100' : 'bg-green-100'}`}>
              {isEmail ? (
                <Mail className={`h-5 w-5 text-blue-600`} />
              ) : (
                <MessageSquare className={`h-5 w-5 text-green-600`} />
              )}
            </div>
            <div>
              <DialogTitle className="text-left">
                {isEmail ? (message.subject || 'No Subject') : 'Text Message'}
              </DialogTitle>
              <p className="text-sm text-gray-500">
                {formatDateTime(message.sent_at)}
              </p>
            </div>
          </div>
        </DialogHeader>
        
        {/* Participants */}
        {isEmail && (
          <div className="border-y py-3 space-y-1 text-sm">
            <ParticipantRow label="From" value={message.participants?.from} />
            <ParticipantRow label="To" value={message.participants?.to?.join(', ')} />
            {message.participants?.cc?.length > 0 && (
              <ParticipantRow label="Cc" value={message.participants.cc.join(', ')} />
            )}
          </div>
        )}
        
        {/* For text messages, show participant */}
        {!isEmail && (
          <div className="border-y py-3 text-sm">
            <div className="flex items-center gap-2">
              {message.direction === 'outbound' ? (
                <ArrowUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ArrowDown className="h-4 w-4 text-gray-400" />
              )}
              <span>
                {message.direction === 'outbound' ? 'To: ' : 'From: '}
                {message.participants?.from || message.participants?.to?.[0]}
              </span>
            </div>
          </div>
        )}
        
        {/* Message Body */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className={`whitespace-pre-wrap ${isEmail ? 'text-sm' : 'text-base'}`}>
            {message.body_text || 'No content'}
          </div>
        </div>
        
        {/* Attachments */}
        {message.has_attachments && attachments && attachments.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Paperclip className="h-4 w-4" />
              Attachments ({attachments.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {attachments.map(att => (
                <AttachmentChip key={att.id} attachment={att} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ParticipantRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex">
      <span className="w-12 text-gray-500">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}

function AttachmentChip({ attachment }) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
    >
      <Paperclip className="h-3 w-3" />
      {attachment.filename}
    </button>
  )
}
```

### AttachmentViewerModal

Create `broker-portal/components/submission/AttachmentViewerModal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Download, FileText, Image, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Attachment {
  id: string
  filename: string
  mime_type: string | null
  file_size_bytes: number | null
  storage_path: string
}

interface AttachmentViewerModalProps {
  attachment: Attachment | null
  open: boolean
  onClose: () => void
}

export function AttachmentViewerModal({ attachment, open, onClose }: AttachmentViewerModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  
  useEffect(() => {
    if (!attachment || !open) return
    
    const fetchUrl = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const { data, error } = await supabase.storage
          .from('submission-attachments')
          .createSignedUrl(attachment.storage_path, 3600) // 1 hour
        
        if (error) throw error
        setSignedUrl(data.signedUrl)
      } catch (e) {
        setError('Failed to load attachment')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    fetchUrl()
  }, [attachment, open])
  
  if (!attachment) return null
  
  const isImage = attachment.mime_type?.startsWith('image/')
  const isPdf = attachment.mime_type === 'application/pdf'
  const canPreview = isImage || isPdf
  
  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank')
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            {isImage ? (
              <Image className="h-5 w-5 text-blue-600" />
            ) : (
              <FileText className="h-5 w-5 text-gray-600" />
            )}
            <DialogTitle>{attachment.filename}</DialogTitle>
          </div>
          <button
            onClick={handleDownload}
            disabled={!signedUrl}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-gray-100 rounded-lg">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-64 text-red-500">
              {error}
            </div>
          )}
          
          {signedUrl && !loading && (
            <>
              {isImage && (
                <img
                  src={signedUrl}
                  alt={attachment.filename}
                  className="max-w-full h-auto mx-auto"
                />
              )}
              
              {isPdf && (
                <iframe
                  src={signedUrl}
                  className="w-full h-[70vh]"
                  title={attachment.filename}
                />
              )}
              
              {!canPreview && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FileText className="h-16 w-16 mb-4" />
                  <p>Preview not available for this file type</p>
                  <p className="text-sm">{attachment.mime_type}</p>
                  <button
                    onClick={handleDownload}
                    className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Download to view
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* File info */}
        <div className="text-sm text-gray-500 pt-2">
          {attachment.mime_type} | {formatFileSize(attachment.file_size_bytes)}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

### AttachmentList Component

Create `broker-portal/components/submission/AttachmentList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { FileText, Image, File, Download } from 'lucide-react'
import { AttachmentViewerModal } from './AttachmentViewerModal'
import { formatFileSize } from '@/lib/utils'

interface Attachment {
  id: string
  filename: string
  mime_type: string | null
  file_size_bytes: number | null
  storage_path: string
  document_type: string | null
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null)
  
  const getIcon = (mimeType: string | null) => {
    if (mimeType?.startsWith('image/')) return Image
    if (mimeType?.includes('pdf')) return FileText
    return File
  }
  
  if (attachments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No attachments
      </div>
    )
  }
  
  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Attachments ({attachments.length})
          </h2>
        </div>
        
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          {attachments.map(attachment => {
            const Icon = getIcon(attachment.mime_type)
            
            return (
              <button
                key={attachment.id}
                onClick={() => setSelectedAttachment(attachment)}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="p-2 bg-gray-100 rounded">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.file_size_bytes)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      
      <AttachmentViewerModal
        attachment={selectedAttachment}
        open={!!selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />
    </>
  )
}
```

### Integration with MessageCard

Update MessageCard to open viewer:

```tsx
// In MessageCard.tsx
const [showViewer, setShowViewer] = useState(false)

return (
  <>
    <div 
      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
      onClick={() => setShowViewer(true)}
    >
      {/* ... existing content ... */}
    </div>
    
    <MessageViewerModal
      message={message}
      open={showViewer}
      onClose={() => setShowViewer(false)}
      attachments={attachments}
    />
  </>
)
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `broker-portal/components/submission/MessageViewerModal.tsx` | Full message viewer |
| `broker-portal/components/submission/AttachmentViewerModal.tsx` | Attachment preview |
| `broker-portal/components/submission/AttachmentList.tsx` | Attachment grid |
| `broker-portal/components/submission/MessageCard.tsx` | Add click to expand |
| `broker-portal/components/submission/MessageList.tsx` | Pass attachments context |

---

## Dependencies

- BACKLOG-396: Next.js setup
- BACKLOG-399: Submission Detail (uses these components)
- BACKLOG-393: Attachment upload (created storage paths)

---

## Acceptance Criteria

- [ ] Clicking message opens full viewer modal
- [ ] Full message shows complete body text
- [ ] Email shows From, To, Cc fields
- [ ] Text messages show direction indicator
- [ ] Modal shows message attachments if any
- [ ] Clicking attachment opens preview modal
- [ ] Images display inline in preview
- [ ] PDFs display in iframe preview
- [ ] Other files show download prompt
- [ ] Download button works for all file types
- [ ] File size displayed correctly
- [ ] Loading states while fetching signed URLs
- [ ] Error handling for failed loads

---

## Technical Notes

### Signed URLs

Supabase Storage files are private. Generate signed URLs with expiry:

```typescript
const { data, error } = await supabase.storage
  .from('submission-attachments')
  .createSignedUrl(storagePath, 3600) // 1 hour expiry
```

### PDF Preview

Modern browsers support PDF in iframe. For older browsers, fall back to download.

### Image Optimization

For demo, load images directly. Post-demo, consider:
- Thumbnail generation (Supabase Storage Transformations)
- Lazy loading for large attachment lists
- Image compression

### Content Security

Signed URLs include auth token. Don't expose in logs. URLs expire after 1 hour.

### Mobile Responsiveness

Modals should be:
- Full-screen on mobile
- Max-width constrained on desktop
- Scrollable for long content

---

## Testing Plan

1. Click message card, verify modal opens
2. Verify email shows all participant fields
3. Verify text shows direction
4. View long message, verify scrolling
5. Click attachment from message
6. View image attachment preview
7. View PDF attachment preview
8. Try downloading non-previewable file
9. Test download button
10. Test modal close (X, escape, backdrop)
11. Test error state (invalid storage path)

---

## Related Items

- BACKLOG-399: Submission Detail (uses these)
- BACKLOG-393: Attachment Upload (creates files)
- SPRINT-050: B2B Broker Portal Demo
