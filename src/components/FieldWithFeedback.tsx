import React, { useState } from 'react';

interface Suggestion {
  value: string;
  reason: string;
}

interface FieldWithFeedbackProps {
  label: string;
  value: string;
  confidence?: number;
  onChange: (value: string) => void;
  onFeedback?: (feedback: {
    field_name: string;
    original_value: string;
    corrected_value: string;
    original_confidence?: number;
    feedback_type: string;
    user_notes?: string;
  }) => void;
  fieldName: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  suggestion?: Suggestion | null;
}

/**
 * Field with Feedback Component
 * Shows extracted field with confidence score and allows user to confirm/edit
 * Automatically records feedback on any change
 */
function FieldWithFeedback({
  label,
  value,
  confidence,
  onChange,
  onFeedback,
  fieldName,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  suggestion = null,
}: FieldWithFeedbackProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [originalValue] = useState(value);
  const [localValue, setLocalValue] = useState(value);
  const [showSuggestion, setShowSuggestion] = useState(!!suggestion);

  // Determine confidence badge color
  const getConfidenceBadge = () => {
    if (!confidence && confidence !== 0) return null;

    let color, text;
    if (confidence >= 80) {
      color = 'bg-green-100 text-green-700';
      text = 'High';
    } else if (confidence >= 50) {
      color = 'bg-yellow-100 text-yellow-700';
      text = 'Medium';
    } else {
      color = 'bg-orange-100 text-orange-700';
      text = 'Low';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {text} ({confidence}%)
      </span>
    );
  };

  const handleBlur = () => {
    setIsEditing(false);

    // If value changed, record as correction feedback
    if (localValue !== originalValue) {
      onChange(localValue);

      // Automatically record feedback
      if (onFeedback) {
        onFeedback({
          field_name: fieldName,
          original_value: originalValue,
          corrected_value: localValue,
          original_confidence: confidence,
          feedback_type: 'correction',
        });
      }
    }
  };

  const handleConfirm = () => {
    // User confirms extraction is correct
    if (onFeedback) {
      onFeedback({
        field_name: fieldName,
        original_value: value,
        corrected_value: value,
        original_confidence: confidence,
        feedback_type: 'confirmation',
      });
    }

    // Visual feedback
    const badge = document.getElementById(`feedback-badge-${fieldName}`);
    if (badge) {
      badge.classList.add('animate-pulse');
      setTimeout(() => badge.classList.remove('animate-pulse'), 1000);
    }
  };

  const handleUseSuggestion = () => {
    if (!suggestion) return;

    setLocalValue(suggestion.value);
    onChange(suggestion.value);
    setShowSuggestion(false);

    // Record that user accepted suggestion
    if (onFeedback) {
      onFeedback({
        field_name: fieldName,
        original_value: originalValue,
        corrected_value: suggestion.value,
        original_confidence: confidence,
        feedback_type: 'correction',
        user_notes: `Used suggestion: ${suggestion.reason}`,
      });
    }
  };

  return (
    <div className="space-y-2">
      {/* Label and confidence */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div id={`feedback-badge-${fieldName}`} className="flex items-center gap-2">
          {getConfidenceBadge()}
        </div>
      </div>

      {/* Smart suggestion banner */}
      {showSuggestion && suggestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">Smart Suggestion</p>
            <p className="text-xs text-blue-700 mt-1">{suggestion.reason}</p>
            <p className="text-sm text-blue-800 mt-2 font-semibold">
              Suggested: <span className="text-blue-900">{suggestion.value}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUseSuggestion}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Use This
            </button>
            <button
              onClick={() => setShowSuggestion(false)}
              className="px-3 py-1 bg-white text-blue-600 text-xs rounded border border-blue-300 hover:bg-blue-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input field */}
      <div className="relative">
        <input
          type={type}
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
            confidence && confidence < 50
              ? 'border-orange-300 bg-orange-50'
              : confidence && confidence < 80
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-gray-300 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />

        {/* Confirm button (only show for auto-extracted fields with confidence) */}
        {!isEditing && confidence && localValue === originalValue && (
          <button
            onClick={handleConfirm}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors"
            title="Confirm this value is correct"
          >
            ✓ Correct
          </button>
        )}
      </div>

      {/* Help text */}
      {confidence && confidence < 50 && (
        <p className="text-xs text-orange-600">
          ⚠️ Low confidence - please verify this value
        </p>
      )}
    </div>
  );
}

export default FieldWithFeedback;
