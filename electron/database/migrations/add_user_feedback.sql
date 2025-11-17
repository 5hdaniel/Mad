-- ============================================
-- USER FEEDBACK & CORRECTIONS TABLE
-- ============================================
-- Purpose: Store user corrections to improve extraction accuracy over time
-- This data can be used for ML training or improving heuristics

CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,

  -- What was corrected
  field_name TEXT NOT NULL, -- e.g., 'closing_date', 'sale_price', 'transaction_type'
  original_value TEXT,      -- What the system extracted
  corrected_value TEXT,     -- What the user corrected it to
  original_confidence INTEGER, -- Original confidence score

  -- Feedback metadata
  feedback_type TEXT CHECK (feedback_type IN ('correction', 'confirmation', 'rejection')),
  -- correction: User changed the value
  -- confirmation: User confirmed auto-extracted value is correct
  -- rejection: User marked extraction as completely wrong

  source_communication_id TEXT, -- Which email was the source

  -- User notes
  user_notes TEXT,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_communication_id) REFERENCES communications(id) ON DELETE SET NULL
);

-- ============================================
-- EXTRACTION ACCURACY METRICS
-- ============================================
-- Track accuracy of extraction algorithms over time

CREATE TABLE IF NOT EXISTS extraction_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Accuracy tracking
  field_name TEXT NOT NULL,
  total_extractions INTEGER DEFAULT 0,
  confirmed_correct INTEGER DEFAULT 0,
  user_corrected INTEGER DEFAULT 0,
  completely_wrong INTEGER DEFAULT 0,

  -- Confidence distribution
  avg_confidence INTEGER,
  high_confidence_count INTEGER DEFAULT 0,  -- 80-100%
  medium_confidence_count INTEGER DEFAULT 0, -- 50-79%
  low_confidence_count INTEGER DEFAULT 0,    -- 0-49%

  -- Time period
  period_start DATETIME,
  period_end DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  UNIQUE(user_id, field_name, period_start)
);

-- ============================================
-- INDEXES FOR FEEDBACK SYSTEM
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_transaction_id ON user_feedback(transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_field_name ON user_feedback(field_name);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_extraction_metrics_user_id ON extraction_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_metrics_field ON extraction_metrics(field_name);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_extraction_metrics_timestamp
AFTER UPDATE ON extraction_metrics
BEGIN
  UPDATE extraction_metrics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
