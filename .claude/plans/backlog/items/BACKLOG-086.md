# BACKLOG-086: Local ML Model with Hybrid Training

## Status
- **Priority:** Medium
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-19
- **Type:** Enhancement / AI / Cost Optimization
- **Depends On:** BACKLOG-084, BACKLOG-085

## Summary

Implement a hybrid ML system that combines a centralized base model (shipped with app updates) with local fine-tuning on user's emails. This progressively reduces LLM dependency from 100% to <5% over time while maintaining high accuracy.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                  Software Update                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Base Model v1.0 (generic RE patterns)           │  │
│  │  - Common keywords, email structures             │  │
│  │  - Standard sender patterns                      │  │
│  │  - 60-70% accuracy out of box                    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                    User's Device                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Base Model + Local Fine-tuning Layer            │  │
│  │  - Learns user's contacts, brokerages            │  │
│  │  - Adapts to regional patterns                   │  │
│  │  - 90%+ accuracy after training                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## Feature Signals for Local Model

### High-Weight Signals

| Signal | Logic | Example |
|--------|-------|---------|
| **Thread length** | 5+ emails = likely transaction | Long negotiation threads |
| **Reply presence** | No replies = likely newsletter | One-way marketing emails |
| **Signature keywords** | Role detection | "Realtor", "Title Officer", "Escrow Agent" |
| **Attachment types** | Contract indicators | PDF, DOCX (purchase agreements) |

### Medium-Weight Signals

| Signal | Logic | Example |
|--------|-------|---------|
| **Sender domain** | Known RE domains | @titleco.com, @remax.com |
| **Reply velocity** | Quick back-and-forth | Active deal negotiation |
| **CC recipients** | Multiple parties | Buyers, sellers, agents |
| **Subject patterns** | Address mentions | "RE: 123 Main St" |

### Low-Weight Signals

| Signal | Logic | Example |
|--------|-------|---------|
| **Email length** | Very short = less likely | One-line confirmations |
| **Time of day** | Business hours | 9am-5pm more likely business |
| **Day of week** | Weekdays | Business activity |

## Transaction Discovery Flow (Invisible Training)

### Philosophy
Magic Audit finds transactions automatically - but the user decides what gets added. Every accept/dismiss action trains the model invisibly.

### Discovery Celebration Screen

When new transactions are found, celebrate the magic:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                      ✨                             │
│                                                     │
│         We found 3 new transactions!                │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  🏠 123 Main Street, Austin TX                │ │
│  │     Purchase · $425,000 · Closing Jan 15      │ │
│  │     12 related emails                         │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  🏠 456 Oak Avenue, Austin TX                 │ │
│  │     Listing · $550,000 · Active               │ │
│  │     8 related emails                          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  🏠 789 Pine Road, Austin TX                  │ │
│  │     Purchase · $380,000 · Under Contract      │ │
│  │     5 related emails                          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│           [Review & Accept Transactions]            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Accept/Dismiss Flow (Training Source)

Each transaction requires explicit action:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  🏠 123 Main Street, Austin TX                      │
│                                                     │
│  Type: Purchase                                     │
│  Price: $425,000                                    │
│  Status: Under Contract                             │
│  Closing: January 15, 2025                          │
│                                                     │
│  Related Emails (12)                                │
│  ├─ Contract signed - Dec 10                        │
│  ├─ Inspection scheduled - Dec 12                   │
│  ├─ Title search complete - Dec 14                  │
│  └─ [View all emails...]                            │
│                                                     │
│  Parties Detected:                                  │
│  • John Smith (Buyer's Agent)                       │
│  • Jane Doe (Seller's Agent)                        │
│  • First American Title                             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         [Review Details]  (optional)        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│      [Dismiss]                    [Accept] ✓        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Training Signals

| User Action | Training Signal | What We Learn |
|-------------|-----------------|---------------|
| **Accept** | Strong positive | These email patterns = transaction |
| **Dismiss** | Strong negative | These email patterns = NOT transaction |
| **Review + Accept** | Strong positive + validated details | High-quality training data |
| **Review + Edit + Accept** | Positive + corrections | Learn from mistakes |

### Optional Review Window

For thorough users who click "Review Details":

```
┌─────────────────────────────────────────────────────┐
│  Review: 123 Main Street                            │
│                                                     │
│  ┌─ Transaction Details ─────────────────────────┐ │
│  │ Address: [123 Main Street, Austin TX    ]     │ │
│  │ Type:    [Purchase           ▼]              │ │
│  │ Price:   [$425,000                     ]     │ │
│  │ Status:  [Under Contract     ▼]              │ │
│  │ Closing: [2025-01-15                   ]     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Parties ─────────────────────────────────────┐ │
│  │ • John Smith        [Buyer's Agent  ▼] [x]   │ │
│  │ • Jane Doe          [Seller's Agent ▼] [x]   │ │
│  │ • First American    [Title Company  ▼] [x]   │ │
│  │ [+ Add party]                                 │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│            [Cancel]              [Save & Accept]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Passive Training (Ongoing)

After initial acceptance, continue learning from:

| Action | Signal |
|--------|--------|
| User edits transaction later | Correction data |
| User deletes transaction | Was wrong, strong negative |
| User links more emails | Pattern expansion |
| User adds transaction manually | We missed this (false negative) |

## Signature Parsing

### Extraction Targets

```typescript
interface ParsedSignature {
  name: string;
  title: string;           // "Realtor", "Broker", "Escrow Officer"
  company: string;         // "ABC Realty", "First American Title"
  phone: string;
  email: string;
  license: string;         // "DRE# 12345678"
  isRealEstateRelated: boolean;
}
```

### Role Keywords

```typescript
const RE_ROLES = [
  // Agents
  'realtor', 'real estate agent', 'broker', 'associate broker',
  'listing agent', 'buyer agent', 'selling agent',

  // Title & Escrow
  'escrow officer', 'title officer', 'closing coordinator',
  'settlement agent', 'escrow assistant',

  // Lenders
  'loan officer', 'mortgage broker', 'lender', 'underwriter',

  // Legal
  'real estate attorney', 'closing attorney',

  // Other
  'transaction coordinator', 'tc', 'home inspector'
];
```

## No-Reply Detection

Emails without replies are likely not transactions:

```typescript
interface ThreadAnalysis {
  thread_id: string;
  email_count: number;
  has_user_reply: boolean;      // Did user ever reply?
  has_any_reply: boolean;       // Any replies in thread?
  reply_velocity: number;       // Avg hours between replies
  last_activity: Date;
}

// Scoring adjustment
if (!thread.has_any_reply && thread.email_count === 1) {
  confidence *= 0.3;  // Likely newsletter/promotion
}
```

## Model Training Pipeline

### Data Collection (Already Happening)

```typescript
// From existing tables:
- llm_analysis_results     // LLM predictions
- llm_extraction_feedback  // User corrections
- communications           // Email metadata
- messages                 // Thread info
```

### Training Data Schema

```typescript
interface TrainingExample {
  // Features
  subject: string;
  body_preview: string;
  sender_domain: string;
  signature_role: string | null;
  thread_length: number;
  has_reply: boolean;
  has_attachments: boolean;
  attachment_types: string[];

  // Labels
  is_transaction: boolean;
  transaction_type?: string;
  confidence_source: 'llm' | 'user' | 'rule';
}
```

### Local Training

```typescript
// Periodic retraining (e.g., weekly or after 50 new examples)
async function retrainLocalModel() {
  const examples = await getTrainingExamples();

  if (examples.length < 100) {
    // Not enough data, rely on base model
    return;
  }

  // Fine-tune on local data
  const updatedWeights = await fineTune(baseModel, examples);
  await saveLocalWeights(updatedWeights);

  // Update confidence thresholds
  await recalibrateThresholds();
}
```

## Confidence Cascade

```
Prediction Flow:

Input Email
     │
     ▼
┌─────────────┐
│ Rule-based  │ ─── High confidence ──→ Return (no LLM)
│ Classifier  │     (>95%)
└─────────────┘
     │ Medium
     ▼
┌─────────────┐
│ Base Model  │ ─── High confidence ──→ Return (no LLM)
│             │     (>90%)
└─────────────┘
     │ Medium
     ▼
┌─────────────┐
│ Local Model │ ─── High confidence ──→ Return (no LLM)
│             │     (>85%)
└─────────────┘
     │ Low
     ▼
┌─────────────┐
│ LLM (Haiku) │ ──→ Return + Train local model
└─────────────┘
```

## Implementation Phases

### Phase 1: Enhanced Data Collection (Low effort)
- [ ] Store all LLM results with features
- [ ] Parse and store signatures
- [ ] Track thread reply status
- [ ] Calculate thread-level features

### Phase 2: Rule-Based Classifier (Low effort)
- [ ] Implement keyword matching
- [ ] Signature role detection
- [ ] Thread length scoring
- [ ] No-reply penalty
- [ ] **Impact: -50% LLM calls**

### Phase 3: Tinder Training Game (Medium effort)
- [ ] Build swipe UI component
- [ ] Integrate into onboarding flow
- [ ] Add periodic training prompts
- [ ] Store user feedback efficiently

### Phase 4: Base Model v1 (Medium effort)
- [ ] Choose ML framework (TensorFlow.js / ONNX)
- [ ] Train on synthetic + pattern data
- [ ] Package with app
- [ ] **Impact: -70% LLM calls for new users**

### Phase 5: Local Fine-tuning (Medium effort)
- [ ] Implement local training pipeline
- [ ] Periodic retraining trigger
- [ ] Confidence calibration
- [ ] **Impact: -90% LLM calls after training**

### Phase 6: Feedback Loop for v2 (Low effort)
- [ ] Opt-in anonymized pattern sharing
- [ ] Aggregate feedback for base model
- [ ] Push improved base model in updates

## Cost Reduction Timeline

| Phase | New User | Trained User | LLM Cost |
|-------|----------|--------------|----------|
| Current | 100% LLM | 100% LLM | $6/600 emails |
| Phase 2 (rules) | 50% LLM | 50% LLM | $3/600 emails |
| Phase 4 (base) | 30% LLM | 30% LLM | $1.80/600 emails |
| Phase 5 (local) | 30% LLM | 10% LLM | $0.60/600 emails |
| + Thread optimization | 5% LLM | 2% LLM | $0.12/600 emails |

## Privacy Model

```
Never leaves device:           Optional (opt-in):
────────────────────           ──────────────────
- User's emails                - Pattern frequency stats
- User's feedback              - Anonymized role detection rates
- Local model weights          - Confidence calibration data
- Training examples
```

## Acceptance Criteria

### Data Collection
- [ ] Signatures parsed and stored
- [ ] Thread reply status tracked
- [ ] Thread length calculated
- [ ] Training examples schema implemented

### Rule-Based Classifier
- [ ] Keyword matching functional
- [ ] Signature role detection working
- [ ] 50% reduction in LLM calls demonstrated

### Tinder Game
- [ ] Swipe UI implemented
- [ ] Undo/rewind working
- [ ] Progress tracking functional
- [ ] Integrated into onboarding
- [ ] Feedback stored for training

### Local Model
- [ ] Base model loads in Electron
- [ ] Local fine-tuning works
- [ ] Confidence cascade implemented
- [ ] 90% reduction demonstrated for trained users

## Technical Considerations

### ML Framework Options

| Framework | Bundle Size | Performance | Ease |
|-----------|-------------|-------------|------|
| TensorFlow.js | ~2MB | Good | Medium |
| ONNX Runtime | ~1MB | Excellent | Medium |
| Transformers.js | ~5MB+ | Best NLP | Complex |
| ml5.js | ~3MB | Moderate | Easy |

**Recommendation:** Start with ONNX Runtime for production, TensorFlow.js for prototyping.

### Model Architecture

For transaction classification:
- Input: TF-IDF or embeddings of email text + features
- Architecture: Small feedforward network or gradient boosting
- Output: is_transaction probability

For entity extraction:
- Could use small NER model for addresses, names
- Or rely on regex + LLM for complex cases

## Dependencies

- BACKLOG-084: Thread-Based Transaction Detection
- BACKLOG-085: Testing framework for accuracy validation
- BACKLOG-077: Feedback Loop (data collection)

## Related Items

- Existing tables: `llm_analysis_results`, `llm_extraction_feedback`
- Pattern matching: `electron/services/llm/patternMatcher.ts`
- LLM tools: `electron/services/llm/tools/`

## Notes

- Start with rule-based + data collection (quick wins)
- Tinder game makes training feel like onboarding, not work
- Local training ensures privacy while maximizing personalization
- Base model updates via app releases improve everyone over time
