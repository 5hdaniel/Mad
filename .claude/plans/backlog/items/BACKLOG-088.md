# BACKLOG-088: Per-User Local ML Model with Progressive Graduation

## Priority: HIGH

## Summary

Implement a per-user local ML model that learns from each user's email data. The model handles transaction detection, progressively taking over from the cloud LLM as it gains accuracy. Uses a tiered graduation system combining data count AND performance metrics to prevent overfitting and premature graduation.

## The Vision

```
User starts app
    │
    ▼
Stage 1: Learning (0-99 examples)
    → LLM only, collect training data passively
    │
    ▼
Stage 2: Validating (100-299 examples)
    → LLM primary, train local model, track metrics silently
    │
    ▼
Stage 3: Assisting (300-499 examples, accuracy >90%)
    → Show local prediction if agrees with LLM
    │
    ▼
Stage 4: Primary (500-999 examples, accuracy >93%)
    → Local primary, LLM fallback on low confidence
    │
    ▼
Stage 5: Graduated (1000+ examples, accuracy >95%, F1 >92%)
    → Local only, zero API cost
```

## Existing Infrastructure (Already Built)

The database schema is **~80% ready**. These tables already exist:

### Training Data Collection (DONE)
- **`classification_feedback`** - User corrections for message relevance, transaction links, document types
- **`user_feedback`** - Field-level corrections with original/corrected values
- **`extraction_metrics`** - Accuracy tracking per field per user

### Classification Tracking (DONE)
- **`messages.is_transaction_related`** - Binary classification target
- **`messages.classification_confidence`** - Confidence score
- **`messages.classification_method`** - 'pattern', 'llm', 'user'
- **`messages.is_false_positive`** - False positive tracking

## What Needs to Be Built

### 1. Model Storage Table

```sql
CREATE TABLE user_models (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Model info
  model_type TEXT NOT NULL,  -- 'transaction_detection', 'transaction_type'
  model_version INTEGER DEFAULT 1,

  -- Serialized model (JSON for Logistic Regression weights)
  model_data TEXT NOT NULL,
  vocabulary TEXT,           -- TF-IDF vocabulary

  -- Training info
  training_examples INTEGER DEFAULT 0,
  last_trained_at DATETIME,
  training_duration_ms INTEGER,

  -- Current tier
  graduation_tier INTEGER DEFAULT 1,  -- 1-5

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  UNIQUE(user_id, model_type)
);
```

### 2. Model Metrics Tracking Table

```sql
CREATE TABLE model_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model_type TEXT NOT NULL,

  -- Metrics (rolling window of last 100 predictions)
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,

  -- Confusion matrix
  true_positives INTEGER DEFAULT 0,
  true_negatives INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  false_negatives INTEGER DEFAULT 0,

  -- Calculated metrics
  accuracy REAL,
  precision_score REAL,
  recall REAL,
  f1_score REAL,

  -- Agreement tracking
  local_llm_agreement_rate REAL,

  -- Window tracking
  window_start_at DATETIME,
  last_updated_at DATETIME,

  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  UNIQUE(user_id, model_type)
);
```

### 3. Supabase Model Backup

```sql
-- Supabase Storage bucket: 'user-models'
-- Path: /models/{user_id}/model_v{version}.json
-- Size: ~1-5MB per user

-- Sync tracking in local DB
ALTER TABLE user_models ADD COLUMN
  supabase_synced_at DATETIME,
  supabase_version INTEGER;
```

## Model Recommendation

### Task 1: Transaction Detection

**Model: Logistic Regression + TF-IDF**

| Factor | Why |
|--------|-----|
| Works with ~100 examples | Users don't have thousands of emails |
| Fast training | <1 second to retrain |
| Fast inference | <10ms |
| Tiny size | ~100KB - 1MB |
| Interpretable | Can see which words triggered classification |
| Incrementally trainable | Add new examples without full retrain |

**Library: `ml.js`** - scikit-learn-like API for Node.js

```typescript
import { LogisticRegression } from 'ml-logistic-regression';
import { TfIdf } from 'natural';

// Feature extraction
const tfidf = new TfIdf();
emails.forEach(email => tfidf.addDocument(email.subject + ' ' + email.body));

// Train
const classifier = new LogisticRegression({ numSteps: 1000 });
classifier.train(features, labels);

// Predict
const prediction = classifier.predict(newEmailFeatures);
// Returns: { class: 'transaction', confidence: 0.92 }

// Serialize for storage (~100KB)
const modelJson = JSON.stringify(classifier.toJSON());
```

### Task 2: Transaction Type

**Model: Multi-class Logistic Regression**
- Same approach, 4 classes: purchase, sale, lease, other
- Only runs on emails classified as transactions

### Task 3: Extraction (Addresses, Contacts, Dates)

**Keep pattern matching + LLM fallback**
- Regex for addresses works well
- Date parsing is deterministic
- Contact/role extraction needs context → LLM is better here
- Not worth the complexity for ML extraction

## Tiered Graduation System

### Why Hybrid (Count + Metrics)?

- **Data count alone**: Could graduate by luck with small sample
- **Metrics alone**: 95% on 20 examples is meaningless
- **Both together**: Statistical significance + proven performance

### Graduation Tiers

```typescript
interface GraduationTier {
  tier: number;
  name: string;
  minExamples: number;
  minAccuracy: number;
  minPrecision: number;
  minRecall: number;
  minF1: number;
  behavior: 'llm_only' | 'compare' | 'hybrid' | 'local_primary' | 'local_only';
}

const GRADUATION_TIERS: GraduationTier[] = [
  {
    tier: 1,
    name: 'Learning',
    minExamples: 0,
    minAccuracy: 0,
    minPrecision: 0,
    minRecall: 0,
    minF1: 0,
    behavior: 'llm_only'
  },
  {
    tier: 2,
    name: 'Validating',
    minExamples: 100,
    minAccuracy: 0,      // Just tracking, no requirements yet
    minPrecision: 0,
    minRecall: 0,
    minF1: 0,
    behavior: 'compare'  // Run both silently, collect metrics
  },
  {
    tier: 3,
    name: 'Assisting',
    minExamples: 300,
    minAccuracy: 0.90,
    minPrecision: 0.85,
    minRecall: 0.90,
    minF1: 0.87,
    behavior: 'hybrid'   // Show local if agrees with LLM
  },
  {
    tier: 4,
    name: 'Primary',
    minExamples: 500,
    minAccuracy: 0.93,
    minPrecision: 0.88,
    minRecall: 0.93,
    minF1: 0.90,
    behavior: 'local_primary'  // Local first, LLM on low confidence
  },
  {
    tier: 5,
    name: 'Graduated',
    minExamples: 1000,
    minAccuracy: 0.95,
    minPrecision: 0.90,
    minRecall: 0.95,
    minF1: 0.92,
    behavior: 'local_only'  // LLM only for edge cases
  }
];
```

### Graduation Logic

```typescript
function getCurrentTier(metrics: ModelMetrics): GraduationTier {
  // Find highest tier where ALL requirements are met
  for (let i = GRADUATION_TIERS.length - 1; i >= 0; i--) {
    const tier = GRADUATION_TIERS[i];
    if (
      metrics.totalExamples >= tier.minExamples &&
      metrics.accuracy >= tier.minAccuracy &&
      metrics.precision >= tier.minPrecision &&
      metrics.recall >= tier.minRecall &&
      metrics.f1 >= tier.minF1
    ) {
      return tier;
    }
  }
  return GRADUATION_TIERS[0]; // Default to Learning
}

function shouldUseLocalModel(
  tier: GraduationTier,
  localPrediction: Prediction,
  confidenceThreshold: number = 0.80
): 'local' | 'llm' | 'both' {
  switch (tier.behavior) {
    case 'llm_only':
      return 'llm';

    case 'compare':
      return 'both';  // Run both, use LLM, track local accuracy

    case 'hybrid':
      return 'both';  // Run both, show local if they agree

    case 'local_primary':
      return localPrediction.confidence >= confidenceThreshold
        ? 'local'
        : 'llm';

    case 'local_only':
      return localPrediction.confidence >= confidenceThreshold * 0.9
        ? 'local'
        : 'llm';  // Still fallback on very low confidence
  }
}
```

### Why Recall > Precision for Thresholds

Missing a real transaction (false negative) is worse than showing a non-transaction (false positive):
- User can dismiss a false positive easily
- Missing a transaction could mean missing compliance deadlines

So: `minRecall: 0.95` vs `minPrecision: 0.90`

## Supabase Model Backup

### Storage Structure

```
Supabase Storage Bucket: 'user-models'
├── {user_id}/
│   ├── transaction_detection_v1.json  (~500KB)
│   ├── transaction_detection_v2.json
│   ├── transaction_type_v1.json       (~200KB)
│   └── metadata.json                  (~1KB)
```

### Sync Logic

```typescript
async function syncModelToSupabase(userId: string, model: UserModel) {
  const modelJson = JSON.stringify({
    type: model.type,
    version: model.version,
    weights: model.toJSON(),
    vocabulary: model.vocabulary,
    metrics: model.metrics,
    trainedAt: model.lastTrainedAt
  });

  await supabase.storage
    .from('user-models')
    .upload(
      `${userId}/${model.type}_v${model.version}.json`,
      modelJson
    );
}

async function restoreModelFromSupabase(userId: string, modelType: string) {
  const { data } = await supabase.storage
    .from('user-models')
    .download(`${userId}/${modelType}_latest.json`);

  return deserializeModel(data);
}
```

### Storage Costs

| Users | Model Size | Total Storage | Supabase Tier |
|-------|------------|---------------|---------------|
| 100 | ~2MB each | ~200MB | Free (1GB) |
| 500 | ~2MB each | ~1GB | Free (1GB) |
| 1000+ | ~2MB each | ~2GB+ | Pro ($25/mo, 100GB) |

## Benefits

| Metric | LLM Only | After Graduation |
|--------|----------|------------------|
| Cost per 600 emails | ~$0.10 | $0.00 |
| Latency | 2-5 seconds | <10ms |
| Works offline | No | Yes |
| Privacy | Data sent to API | Fully local |
| Accuracy | Good baseline | Personalized to user |

## Implementation Phases

### Phase 1: Infrastructure (~1 sprint)
- [ ] Add `user_models` table
- [ ] Add `model_metrics` table
- [ ] Feature extraction service (TF-IDF)
- [ ] Model training service (Logistic Regression)
- [ ] Model persistence (save/load)

### Phase 2: Training Pipeline (~1 sprint)
- [ ] Collect training data from existing `classification_feedback`
- [ ] Background training worker
- [ ] Metrics calculation (accuracy, precision, recall, F1)
- [ ] Tier calculation and storage

### Phase 3: Inference Integration (~1 sprint)
- [ ] Hook into extraction pipeline
- [ ] Implement tier-based behavior switching
- [ ] Confidence threshold handling
- [ ] LLM fallback logic

### Phase 4: Supabase Backup (~0.5 sprint)
- [ ] Create storage bucket
- [ ] Sync on model update
- [ ] Restore on new device login

### Phase 5: Dashboard & Monitoring (~0.5 sprint)
- [ ] User-facing graduation progress
- [ ] Accuracy trends visualization
- [ ] Admin metrics dashboard

## Dependencies

- [x] SPRINT-007 cost optimization (completed) - provides fallback
- [x] Database schema for feedback collection (exists)
- [ ] User feedback UI (for corrections) - partially exists
- [ ] Background processing infrastructure

## Estimated Effort

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1 | 1 sprint | Schema already 80% done |
| Phase 2 | 1 sprint | |
| Phase 3 | 1 sprint | |
| Phase 4 | 0.5 sprint | |
| Phase 5 | 0.5 sprint | |
| **Total** | **4 sprints** | Down from 5-6 due to existing schema |

## Success Metrics

- 80% of active users reach Tier 3 (Assisting) within 2 months
- 50% of active users reach Tier 5 (Graduated) within 6 months
- Average API cost per user drops 90% after Tier 4
- No accuracy regression when switching to local model
- User corrections decrease over time (model is learning)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Model overfits to user's data | Tiered system requires high example count + metrics |
| Accuracy drops over time | Track rolling window, auto-demote tier if metrics drop |
| Model file corruption | Versioned backups on Supabase, can restore previous |
| User has unusual email patterns | LLM fallback always available on low confidence |
