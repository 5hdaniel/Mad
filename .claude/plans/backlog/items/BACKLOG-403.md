# BACKLOG-403: Malware Scanning on Upload

**Priority:** P1 (Security - Pre-Production)
**Category:** security / storage
**Created:** 2026-01-22
**Status:** Backlog
**Sprint:** TBD

---

## Summary

Scan all uploaded attachments for malware before storing them. Quarantine or reject infected files.

---

## Problem Statement

Agents upload files from various sources (email attachments, client documents, third-party portals). These could contain:
- Viruses/trojans
- Ransomware
- Malicious macros in Office documents
- Embedded scripts in PDFs

Without scanning, infected files could:
- Spread to brokers who download them
- Compromise broker workstations
- Create liability for the organization
- Damage trust with enterprise customers

---

## Proposed Solution

### Architecture Options

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **ClamAV on Supabase Edge Function** | Open source, self-hosted | Latency, maintenance | ~$0 + compute |
| **VirusTotal API** | Comprehensive, easy | Rate limits, privacy concerns | Free tier limited |
| **AWS/Azure/GCP native scanning** | Integrated, scalable | Vendor lock-in | ~$0.01/GB |
| **Cloudflare R2 + scanning** | Fast, integrated | Requires R2 migration | ~$0.015/GB |

### Recommended: Supabase Edge Function + ClamAV

```typescript
// Supabase Edge Function: scan-attachment
import { ClamScan } from 'clamscan';

Deno.serve(async (req) => {
  const { bucket, path } = await req.json();

  // Download file from storage
  const file = await supabase.storage.from(bucket).download(path);

  // Scan with ClamAV
  const scanner = new ClamScan();
  const result = await scanner.scanBuffer(await file.arrayBuffer());

  if (result.isInfected) {
    // Move to quarantine bucket
    await supabase.storage.from('quarantine').upload(path, file);
    await supabase.storage.from(bucket).remove([path]);

    // Log incident
    await supabase.from('security_incidents').insert({
      type: 'malware_detected',
      file_path: path,
      threat_name: result.viruses.join(', '),
      action: 'quarantined'
    });

    return new Response(JSON.stringify({
      safe: false,
      threat: result.viruses
    }));
  }

  return new Response(JSON.stringify({ safe: true }));
});
```

### Upload Flow

```
User uploads file
       │
       ▼
┌─────────────────┐
│ Supabase Storage│ (temp location)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Edge Function   │ (scan-attachment)
│ ClamAV scan     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Clean     Infected
    │         │
    ▼         ▼
 Move to   Quarantine
 final     + Alert
 location
```

### Alternative: Async Scanning

For better UX, scan asynchronously:
1. Upload immediately with `scan_status: 'pending'`
2. Trigger Edge Function via webhook
3. Update status to `clean` or `infected`
4. Broker sees warning badge until scanned
5. Block download of infected files

---

## Database Changes

```sql
-- Add scan status to attachments
ALTER TABLE submission_attachments
ADD COLUMN scan_status VARCHAR(20) DEFAULT 'pending'
CHECK (scan_status IN ('pending', 'scanning', 'clean', 'infected', 'error'));

ALTER TABLE submission_attachments
ADD COLUMN scan_result JSONB;

-- Quarantine tracking
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  file_path TEXT,
  threat_name TEXT,
  action VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/functions/scan-attachment/index.ts` | New Edge Function |
| `supabase/migrations/XXXX_add_scan_status.sql` | Add scan columns |
| `electron/services/submissionService.ts` | Handle scan status |
| `broker-portal/components/AttachmentCard.tsx` | Show scan badge |

---

## Acceptance Criteria

- [ ] All uploads trigger malware scan
- [ ] Infected files moved to quarantine bucket
- [ ] Users cannot download infected files
- [ ] Security incident logged with threat details
- [ ] Admin notification on detection
- [ ] Scan completes within 30 seconds for files < 50MB
- [ ] UI shows scan status (pending/clean/infected)

---

## Testing Plan

1. Upload EICAR test file (standard AV test file)
2. Verify detection and quarantine
3. Verify clean files pass through
4. Test large file scanning (100MB+)
5. Test timeout handling

---

## Related Items

- BACKLOG-402: File Size Limits
- SPRINT-050: B2B Broker Portal (parent feature)

---

## Security Notes

- ClamAV database must be updated regularly (daily cron)
- Consider additional scanning for Office macros (oletools)
- PDF scanning for JavaScript/embedded objects
- Log all scan results for audit trail
