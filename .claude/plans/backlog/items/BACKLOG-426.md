# BACKLOG-426: License Type Database Schema Support

## Summary

Add database support for different license types (Individual, Team, AI Add-on) with proper schema for easy account upgrades and license-aware feature gating.

## Category

Schema / Infrastructure

## Priority

P0 - Critical (Foundation for license-aware features)

## Description

### Problem

The current schema has basic `subscription_tier` and `subscription_status` fields but lacks:
- Clear license types (Individual vs Team)
- AI Detection add-on tracking
- Easy upgrade path from Individual to Team
- Feature flags tied to license type

### Solution

Extend the database schema to support:

1. **License Types**:
   - `individual` - Single user, local-only features, export capability
   - `team` - B2B, broker review workflow, submit capability
   - `enterprise` - Future expansion

2. **AI Add-on**:
   - Separate boolean flag `ai_detection_enabled`
   - Can be enabled for any license type

3. **Feature Access Matrix**:

   **Base License Features:**
   | Feature | Individual | Team |
   |---------|------------|------|
   | Export button | ✅ Yes | ❌ No |
   | Submit for Review button | ❌ No | ✅ Yes |
   | Manual transaction creation | ✅ Yes | ✅ Yes |

   **AI Add-on Features (can be added to ANY base license):**
   | Feature | Without AI | With AI Add-on |
   |---------|------------|----------------|
   | Auto-detection button | ❌ Hidden | ✅ Shown |
   | AI transaction filters | ❌ Hidden | ✅ Shown |
   | AI section in New Audit | ❌ Hidden | ✅ Shown |

   **Combined Examples:**
   - Individual + No AI: Export, manual transactions only
   - Individual + AI: Export, manual transactions, AI detection features
   - Team + No AI: Submit for review, manual transactions only
   - Team + AI: Submit for review, manual transactions, AI detection features

### Schema Changes

**Supabase `profiles` table:**
```sql
ALTER TABLE profiles
  ADD COLUMN license_type VARCHAR(50) DEFAULT 'individual'
    CHECK (license_type IN ('individual', 'team', 'enterprise')),
  ADD COLUMN ai_detection_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN team_upgraded_at TIMESTAMPTZ,
  ADD COLUMN team_upgraded_from_profile_id UUID;
```

**Local SQLite `users` table:**
```sql
ALTER TABLE users
  ADD COLUMN license_type TEXT DEFAULT 'individual'
    CHECK (license_type IN ('individual', 'team', 'enterprise')),
  ADD COLUMN ai_detection_enabled INTEGER DEFAULT 0,
  ADD COLUMN organization_id TEXT;
```

### Upgrade Flow

When Individual user joins a Team:
1. Set `license_type = 'team'`
2. Set `organization_id` to the org they joined
3. Record `team_upgraded_at` timestamp
4. Keep `team_upgraded_from_profile_id` for audit trail
5. Existing local transactions remain accessible

## Acceptance Criteria

- [ ] Supabase migration adds license_type and ai_detection_enabled columns
- [ ] Local SQLite schema includes license columns
- [ ] TypeScript types updated for new columns
- [ ] Migration preserves existing data (defaults to 'individual')
- [ ] Account upgrade flow works (Individual to Team)
- [ ] AI add-on can be enabled/disabled independently

## Estimated Effort

~20K tokens

## Dependencies

- None (foundation for other license tasks)

## Related Items

- BACKLOG-427: License-Aware UI Components
- BACKLOG-428: License Context Provider
- BACKLOG-419: RLS Policies (update for license checks)
