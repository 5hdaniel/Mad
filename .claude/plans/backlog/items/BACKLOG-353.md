# BACKLOG-353: PDF Authenticity Hash Verification via Supabase

**Created**: 2026-01-21
**Priority**: Medium
**Category**: Feature
**Status**: Pending

---

## Description

Create a system to verify the authenticity of exported audit PDFs. When a PDF is generated, compute a cryptographic hash and store it in Supabase. Later, if someone wants to verify a PDF hasn't been tampered with, they can check the hash against the stored record.

## Technical Approach

1. **On Export**:
   - Generate PDF
   - Compute SHA-256 hash of the PDF file
   - Store in Supabase: `{ transaction_id, hash, exported_at, file_name }`

2. **Verification** (future feature):
   - User uploads or selects a PDF
   - App computes hash
   - Compares against Supabase record
   - Shows "Verified" or "Hash mismatch - file may have been modified"

## Database Schema

```sql
CREATE TABLE audit_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  file_hash VARCHAR(64) NOT NULL,  -- SHA-256 hex
  file_name VARCHAR(255),
  exported_at TIMESTAMP DEFAULT NOW(),
  exported_by UUID REFERENCES users(id)
);
```

## Acceptance Criteria

- [ ] Hash computed on PDF export
- [ ] Hash stored in Supabase with transaction reference
- [ ] (Future) Verification endpoint/UI to check hash

## Notes

This provides a way to certify authenticity of audit documents - important for legal/compliance purposes in real estate transactions.
