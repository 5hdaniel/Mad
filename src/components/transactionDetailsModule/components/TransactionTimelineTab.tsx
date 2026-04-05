/**
 * TransactionTimelineTab Component
 * AI-powered transaction timeline showing key milestones
 * with links back to source emails and attachments.
 *
 * Feature-gated by local_ai.
 */

import React, { useState, useEffect, useCallback } from "react";
import logger from "../../../utils/logger";

interface TimelineSource {
  type: "email" | "attachment";
  id: string;
  label: string;
  date?: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  category: string;
  confidence: number;
  sources: TimelineSource[];
}

interface CachedTimeline {
  events: TimelineEvent[];
  generatedAt: string;
  modelUsed: string;
}

interface TransactionTimelineTabProps {
  transactionId: string;
  userId: string;
  onOpenEmail?: (emailId: string) => void;
  onOpenAttachment?: (attachmentId: string) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  agreement: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  offer: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  inspection: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  appraisal: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  financing: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  title: { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  escrow: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  closing: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  communication: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" },
  other: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function TransactionTimelineTab({
  transactionId,
  userId,
  onOpenEmail,
  onOpenAttachment,
}: TransactionTimelineTabProps): React.ReactElement {
  const [timeline, setTimeline] = useState<CachedTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached timeline
  const loadTimeline = useCallback(async () => {
    try {
      const result = await window.api.llm.getTimeline(transactionId);
      if (result.success && result.data) {
        setTimeline(result.data as CachedTimeline);
      }
    } catch (err) {
      logger.error("[Timeline] Load failed", err);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await window.api.llm.generateTimeline(transactionId, userId);
      if (result.success && result.data) {
        setTimeline(result.data as CachedTimeline);
      } else {
        setError(result.error?.message || "Failed to generate timeline");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate timeline");
    } finally {
      setGenerating(false);
    }
  }, [transactionId, userId]);

  const handleSourceClick = (source: TimelineSource) => {
    if (source.type === "email" && onOpenEmail) {
      onOpenEmail(source.id);
    } else if (source.type === "attachment" && onOpenAttachment) {
      onOpenAttachment(source.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  // No timeline yet — show generate button
  if (!timeline || timeline.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Transaction Timeline</h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Generate an AI-powered timeline of key milestones from this transaction's emails and documents.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Analyzing emails...
            </span>
          ) : (
            "Generate Timeline"
          )}
        </button>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }

  // Render timeline
  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            {timeline.events.length} milestone{timeline.events.length !== 1 ? "s" : ""} detected
          </h3>
          <p className="text-xs text-gray-500">
            Generated {formatDate(timeline.generatedAt)} using {timeline.modelUsed}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {generating ? "Regenerating..." : "Regenerate"}
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {timeline.events.map((event) => {
            const colors = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other;

            return (
              <div key={event.id} className="relative pl-10">
                {/* Dot */}
                <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full ${colors.dot} ring-2 ring-white`} />

                {/* Card */}
                <div className={`${colors.bg} rounded-lg p-3 border border-gray-100`}>
                  {/* Date + Category */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">
                      {formatDate(event.date)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors.text} bg-white/60`}>
                      {event.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>

                  {/* Description */}
                  {event.description && (
                    <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                  )}

                  {/* Sources */}
                  {event.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {event.sources.map((source, i) => (
                        <button
                          key={`${source.id}-${i}`}
                          onClick={() => handleSourceClick(source)}
                          className="text-[11px] px-2 py-0.5 bg-white rounded border border-gray-200 hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center gap-1"
                          title={`Open ${source.type}`}
                        >
                          {source.type === "email" ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                          <span className="truncate max-w-[150px]">{source.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TransactionTimelineTab;
