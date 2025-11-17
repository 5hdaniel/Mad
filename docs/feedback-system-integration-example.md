# Feedback System Integration Guide

## Overview

This guide shows you how to integrate the smart feedback and learning system into your transaction edit views.

## Key Features

1. **Automatic Feedback** - Any field edit = automatic feedback recording
2. **Smart Suggestions** - System suggests corrections based on past patterns
3. **Confidence Indicators** - Visual cues show which fields need review
4. **Pattern Learning** - Detects patterns like "user always adds 30 days to closing date"

---

## Example Integration

### 1. Transaction Edit Component with Feedback

```jsx
import React, { useState, useEffect } from 'react';
import FieldWithFeedback from './FieldWithFeedback';

function TransactionEditModal({ transaction, userId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    property_address: transaction.property_address,
    closing_date: transaction.closing_date,
    sale_price: transaction.sale_price,
    transaction_type: transaction.transaction_type,
  });

  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(true);

  // Load smart suggestions on mount
  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      // Load suggestions for each auto-extracted field
      const fields = [
        { name: 'closing_date', value: transaction.closing_date, confidence: transaction.closing_date_confidence },
        { name: 'sale_price', value: transaction.sale_price, confidence: transaction.extraction_confidence },
        { name: 'transaction_type', value: transaction.transaction_type, confidence: transaction.extraction_confidence },
      ];

      const suggestionsObj = {};

      for (const field of fields) {
        if (field.value && field.confidence < 85) {
          const result = await window.api.feedback.getSuggestion(
            userId,
            field.name,
            field.value,
            field.confidence
          );

          if (result.success && result.suggestion) {
            suggestionsObj[field.name] = result.suggestion;
          }
        }
      }

      setSuggestions(suggestionsObj);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName, newValue) => {
    setFormData({ ...formData, [fieldName]: newValue });
  };

  const handleFeedback = async (feedbackData) => {
    try {
      await window.api.feedback.submit(userId, {
        transaction_id: transaction.id,
        ...feedbackData,
      });

      console.log('Feedback recorded:', feedbackData);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleSave = async () => {
    // Save transaction
    await onSave(formData);
  };

  if (loading) {
    return <div>Loading smart suggestions...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Edit Transaction</h2>

      {/* Property Address - Usually manual entry, no feedback needed */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Property Address
        </label>
        <input
          type="text"
          value={formData.property_address}
          onChange={(e) => handleFieldChange('property_address', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Closing Date - With feedback and suggestions */}
      <FieldWithFeedback
        label="Closing Date"
        value={formData.closing_date}
        confidence={transaction.closing_date_confidence}
        onChange={(value) => handleFieldChange('closing_date', value)}
        onFeedback={handleFeedback}
        fieldName="closing_date"
        type="date"
        suggestion={suggestions.closing_date}
      />

      {/* Sale Price - With feedback and suggestions */}
      <FieldWithFeedback
        label="Sale Price"
        value={formData.sale_price}
        confidence={transaction.extraction_confidence}
        onChange={(value) => handleFieldChange('sale_price', value)}
        onFeedback={handleFeedback}
        fieldName="sale_price"
        type="text"
        placeholder="$0.00"
        suggestion={suggestions.sale_price}
      />

      {/* Transaction Type - With feedback */}
      <FieldWithFeedback
        label="Transaction Type"
        value={formData.transaction_type}
        confidence={transaction.extraction_confidence}
        onChange={(value) => handleFieldChange('transaction_type', value)}
        onFeedback={handleFeedback}
        fieldName="transaction_type"
        type="text"
        placeholder="purchase or sale"
        suggestion={suggestions.transaction_type}
      />

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Save Changes
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default TransactionEditModal;
```

---

## 2. Review Indicator for Low-Confidence Fields

```jsx
function TransactionListItem({ transaction }) {
  // Count fields that need review (confidence < 50)
  const needsReview = [
    transaction.closing_date_confidence,
    transaction.extraction_confidence,
  ].filter(c => c && c < 50).length;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{transaction.property_address}</h3>
          <p className="text-sm text-gray-600">
            Closing: {transaction.closing_date || 'Not set'}
          </p>
        </div>

        {/* Review Badge */}
        {needsReview > 0 && (
          <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
            ⚠️ {needsReview} field{needsReview > 1 ? 's' : ''} need review
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## 3. Learning Statistics View (Optional Dashboard)

```jsx
function LearningStatsView({ userId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const result = await window.api.feedback.getLearningStats(userId, 'closing_date');
    if (result.success) {
      setStats(result.stats);
    }
  };

  if (!stats) return null;

  const accuracy = stats.total_feedback > 0
    ? ((stats.confirmations / stats.total_feedback) * 100).toFixed(1)
    : 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="font-semibold text-blue-900 mb-2">
        Extraction Learning Stats: Closing Date
      </h4>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-blue-700">Total Extractions</p>
          <p className="text-2xl font-bold text-blue-900">{stats.total_feedback}</p>
        </div>
        <div>
          <p className="text-blue-700">Accuracy</p>
          <p className="text-2xl font-bold text-green-600">{accuracy}%</p>
        </div>
        <div>
          <p className="text-blue-700">Corrections Needed</p>
          <p className="text-xl font-semibold text-orange-600">{stats.corrections}</p>
        </div>
        <div>
          <p className="text-blue-700">Patterns Detected</p>
          <p className="text-xl font-semibold text-indigo-600">{stats.patterns_detected}</p>
        </div>
      </div>

      {/* Show detected patterns */}
      {stats.patterns && stats.patterns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-2">Learned Patterns:</p>
          {stats.patterns.map((pattern, i) => (
            <div key={i} className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1 mb-1">
              {pattern.type === 'date_adjustment' && (
                `You typically adjust dates by ${pattern.adjustment_days > 0 ? '+' : ''}${pattern.adjustment_days} days`
              )}
              {pattern.type === 'number_adjustment' && (
                `You typically adjust amounts by ${pattern.percent_adjustment.toFixed(1)}%`
              )}
              {pattern.type === 'substitution' && (
                `You often change "${pattern.from_value}" to "${pattern.to_value}"`
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 4. Automatic Feedback on Manual Edits

For fields that DON'T use `FieldWithFeedback` component, you can still record feedback:

```jsx
function SimpleTransactionEdit({ transaction, userId }) {
  const [closingDate, setClosingDate] = useState(transaction.closing_date);
  const originalClosingDate = React.useRef(transaction.closing_date);

  const handleSave = async () => {
    // Check if value changed
    if (closingDate !== originalClosingDate.current) {
      // Automatically record feedback
      await window.api.feedback.submit(userId, {
        transaction_id: transaction.id,
        field_name: 'closing_date',
        original_value: originalClosingDate.current,
        corrected_value: closingDate,
        original_confidence: transaction.closing_date_confidence,
        feedback_type: 'correction',
        user_notes: 'User manually edited field',
      });
    }

    // Save transaction...
  };

  return (
    <div>
      <label>Closing Date</label>
      <input
        type="date"
        value={closingDate}
        onChange={(e) => setClosingDate(e.target.value)}
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

---

## Pattern Examples

The system detects these patterns automatically:

### 1. Date Adjustment Pattern
**User behavior:** Always adds 30 days to extracted closing date

**System learns:**
```json
{
  "type": "date_adjustment",
  "adjustment_days": 30,
  "confidence": 92
}
```

**Suggestion shown:**
> "Based on 5 past corrections, you typically adjust dates by +30 days"

---

### 2. Number Adjustment Pattern
**User behavior:** Sale price is always 3% lower (removing earnest money)

**System learns:**
```json
{
  "type": "number_adjustment",
  "percent_adjustment": -3.0,
  "confidence": 88
}
```

**Suggestion shown:**
> "Based on 8 past corrections, you typically adjust by -3.0%"

---

### 3. Substitution Pattern
**User behavior:** Always changes "purchase" to "buy"

**System learns:**
```json
{
  "type": "substitution",
  "from_value": "purchase",
  "to_value": "buy",
  "frequency": 0.85
}
```

**Suggestion shown:**
> "You've changed 'purchase' to 'buy' in 85% of past cases"

---

## API Reference

### Submit Feedback
```javascript
await window.api.feedback.submit(userId, {
  transaction_id: 'transaction-123',
  field_name: 'closing_date',
  original_value: '2024-12-15',
  corrected_value: '2025-01-15',
  original_confidence: 75,
  feedback_type: 'correction', // or 'confirmation' or 'rejection'
  user_notes: 'Optional note',
});
```

### Get Suggestion
```javascript
const result = await window.api.feedback.getSuggestion(
  userId,
  'closing_date',
  '2024-12-15',
  75 // confidence
);

if (result.suggestion) {
  console.log(result.suggestion.value);  // "2025-01-15"
  console.log(result.suggestion.reason); // "Based on 5 past corrections..."
}
```

### Get Learning Stats
```javascript
const result = await window.api.feedback.getLearningStats(userId, 'closing_date');
console.log(result.stats.patterns); // Array of detected patterns
```

---

## Best Practices

1. **Always load suggestions** for low-confidence fields (<85%)
2. **Show visual indicators** for fields needing review (<50% confidence)
3. **Record feedback automatically** when user edits any auto-extracted field
4. **Don't show suggestions** for high-confidence extractions (>85%)
5. **Let users dismiss** suggestions they don't want to use

---

## Benefits for Users

### For Real Estate Agents:
- ✅ **Less manual work** - System learns their preferences
- ✅ **Faster corrections** - Smart suggestions based on past edits
- ✅ **Visual indicators** - Know which fields need attention
- ✅ **Confidence** - See how sure the system is about extractions

### For You (Developer):
- ✅ **Better accuracy** - System improves over time
- ✅ **Data for ML** - Collect training data for future models
- ✅ **User trust** - Transparent confidence scores
- ✅ **Pattern detection** - Automatic learning without manual configuration
