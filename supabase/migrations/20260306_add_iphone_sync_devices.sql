-- TASK-2121: Add iphone_sync_devices table to persist lastSyncTime per device
-- This table is separate from the `devices` table which tracks desktop app installations.
-- iPhone sync times are keyed by user_id + device_udid (iPhone UDID).

CREATE TABLE IF NOT EXISTS iphone_sync_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_udid TEXT NOT NULL,
  device_name TEXT,
  last_sync_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_udid)
);

-- RLS: users can only see/update their own records
ALTER TABLE iphone_sync_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own iPhone sync devices"
  ON iphone_sync_devices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
