import React, { useState, useEffect, useCallback } from "react";
import type {
  CallLog,
  CallLogWithContacts,
  CallDirection,
  CallType,
  CallOutcome,
} from "@/types";

interface CallLogsHistoryProps {
  userId: string;
  transactionId?: string;
  onClose?: () => void;
}

interface CallLogStats {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  totalDuration: number;
  transactionRelatedCalls: number;
}

/**
 * Format duration in seconds to human readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format date to localized string
 */
function formatDate(date: string | Date | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Get direction icon and color
 */
function getDirectionDisplay(direction?: CallDirection): {
  icon: string;
  color: string;
  label: string;
} {
  switch (direction) {
    case "inbound":
      return { icon: "↓", color: "text-green-600", label: "Incoming" };
    case "outbound":
      return { icon: "↑", color: "text-blue-600", label: "Outgoing" };
    case "missed":
      return { icon: "✕", color: "text-red-600", label: "Missed" };
    default:
      return { icon: "?", color: "text-gray-500", label: "Unknown" };
  }
}

/**
 * Get call type icon
 */
function getCallTypeIcon(callType: CallType): string {
  switch (callType) {
    case "voice":
      return "📞";
    case "video":
      return "📹";
    case "voicemail":
      return "📬";
    default:
      return "📞";
  }
}

/**
 * Get outcome badge style
 */
function getOutcomeBadge(outcome?: CallOutcome): {
  bg: string;
  text: string;
  label: string;
} {
  switch (outcome) {
    case "completed":
      return { bg: "bg-green-100", text: "text-green-800", label: "Completed" };
    case "missed":
      return { bg: "bg-red-100", text: "text-red-800", label: "Missed" };
    case "declined":
      return { bg: "bg-orange-100", text: "text-orange-800", label: "Declined" };
    case "voicemail":
      return { bg: "bg-purple-100", text: "text-purple-800", label: "Voicemail" };
    case "failed":
      return { bg: "bg-gray-100", text: "text-gray-800", label: "Failed" };
    case "cancelled":
      return { bg: "bg-yellow-100", text: "text-yellow-800", label: "Cancelled" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-600", label: "Unknown" };
  }
}

/**
 * CallLogsHistory Component
 * Displays phone call history for compliance audit packages
 */
function CallLogsHistory({
  userId,
  transactionId,
  onClose,
}: CallLogsHistoryProps) {
  const [callLogs, setCallLogs] = useState<CallLogWithContacts[]>([]);
  const [stats, setStats] = useState<CallLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<CallLogWithContacts | null>(null);
  const [filter, setFilter] = useState<{
    direction?: CallDirection;
    callType?: CallType;
    transactionRelated?: boolean;
  }>({});

  // Load call logs
  const loadCallLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let result;
      if (transactionId) {
        result = await window.api.callLogs.getByTransaction(transactionId);
      } else {
        result = await window.api.callLogs.getWithContacts(userId);
      }

      if (result.success) {
        setCallLogs(result.callLogs || []);
      } else {
        setError(result.error || "Failed to load call logs");
      }

      // Load stats
      const statsResult = await window.api.callLogs.getStats(userId);
      if (statsResult.success) {
        setStats(statsResult.stats || null);
      }
    } catch (err) {
      console.error("Failed to load call logs:", err);
      setError(err instanceof Error ? err.message : "Failed to load call logs");
    } finally {
      setLoading(false);
    }
  }, [userId, transactionId]);

  useEffect(() => {
    loadCallLogs();
  }, [loadCallLogs]);

  // Filter call logs
  const filteredLogs = callLogs.filter((log) => {
    if (filter.direction && log.direction !== filter.direction) return false;
    if (filter.callType && log.call_type !== filter.callType) return false;
    if (
      filter.transactionRelated !== undefined &&
      log.is_transaction_related !== filter.transactionRelated
    )
      return false;
    return true;
  });

  // Handle link to transaction
  const handleLinkToTransaction = async (
    callLogId: string,
    txnId: string,
  ) => {
    try {
      const result = await window.api.callLogs.linkToTransaction(callLogId, txnId);
      if (result.success) {
        await loadCallLogs();
      }
    } catch (err) {
      console.error("Failed to link call log:", err);
    }
  };

  // Handle unlink from transaction
  const handleUnlinkFromTransaction = async (callLogId: string) => {
    try {
      const result = await window.api.callLogs.unlinkFromTransaction(callLogId);
      if (result.success) {
        await loadCallLogs();
      }
    } catch (err) {
      console.error("Failed to unlink call log:", err);
    }
  };

  // Handle delete
  const handleDelete = async (callLogId: string) => {
    if (!confirm("Are you sure you want to delete this call log?")) return;

    try {
      const result = await window.api.callLogs.delete(callLogId);
      if (result.success) {
        setSelectedLog(null);
        await loadCallLogs();
      }
    } catch (err) {
      console.error("Failed to delete call log:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        <span className="ml-3 text-gray-600">Loading call logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={loadCallLogs}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📞 Call History
            </h2>
            <p className="text-green-100 text-sm mt-1">
              {transactionId
                ? "Calls related to this transaction"
                : "Complete call log history for compliance"}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:text-green-100 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-gray-50 px-6 py-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 border-b">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">
              {stats.totalCalls}
            </div>
            <div className="text-xs text-gray-500">Total Calls</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.inboundCalls}
            </div>
            <div className="text-xs text-gray-500">Incoming</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.outboundCalls}
            </div>
            <div className="text-xs text-gray-500">Outgoing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.missedCalls}
            </div>
            <div className="text-xs text-gray-500">Missed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatDuration(stats.totalDuration)}
            </div>
            <div className="text-xs text-gray-500">Total Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">
              {stats.transactionRelatedCalls}
            </div>
            <div className="text-xs text-gray-500">Transaction Calls</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b flex flex-wrap gap-3 items-center">
        <span className="text-sm text-gray-500">Filter:</span>
        <select
          value={filter.direction || ""}
          onChange={(e) =>
            setFilter({
              ...filter,
              direction: (e.target.value as CallDirection) || undefined,
            })
          }
          className="px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Directions</option>
          <option value="inbound">Incoming</option>
          <option value="outbound">Outgoing</option>
          <option value="missed">Missed</option>
        </select>
        <select
          value={filter.callType || ""}
          onChange={(e) =>
            setFilter({
              ...filter,
              callType: (e.target.value as CallType) || undefined,
            })
          }
          className="px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Types</option>
          <option value="voice">Voice</option>
          <option value="video">Video</option>
          <option value="voicemail">Voicemail</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filter.transactionRelated === true}
            onChange={(e) =>
              setFilter({
                ...filter,
                transactionRelated: e.target.checked ? true : undefined,
              })
            }
            className="rounded text-green-500 focus:ring-green-500"
          />
          Transaction Related Only
        </label>
        {(filter.direction || filter.callType || filter.transactionRelated) && (
          <button
            onClick={() => setFilter({})}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Call Logs List */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-3">📞</div>
            <p>No call logs found</p>
            {Object.keys(filter).length > 0 && (
              <p className="text-sm mt-2">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => {
              const direction = getDirectionDisplay(log.direction);
              const outcome = getOutcomeBadge(log.outcome);

              return (
                <div
                  key={log.id}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-start gap-4">
                    {/* Direction & Type Icon */}
                    <div className="flex-shrink-0 text-2xl">
                      <span className={direction.color}>{direction.icon}</span>
                      <span className="ml-1">{getCallTypeIcon(log.call_type)}</span>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Contact Name or Phone */}
                        <span className="font-medium text-gray-900">
                          {log.direction === "inbound"
                            ? log.caller_name ||
                              log.caller_phone_display ||
                              log.caller_phone_e164 ||
                              "Unknown"
                            : log.recipient_name ||
                              log.recipient_phone_display ||
                              log.recipient_phone_e164 ||
                              "Unknown"}
                        </span>

                        {/* Outcome Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${outcome.bg} ${outcome.text}`}
                        >
                          {outcome.label}
                        </span>

                        {/* Transaction Related Badge */}
                        {log.is_transaction_related && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                            Transaction
                          </span>
                        )}
                      </div>

                      {/* Contact Details */}
                      <div className="text-sm text-gray-500 mt-1">
                        {log.direction === "inbound" ? (
                          <>
                            From:{" "}
                            {log.caller_phone_display ||
                              log.caller_phone_e164 ||
                              "Unknown"}
                            {log.caller_contact?.company && (
                              <span className="ml-2 text-gray-400">
                                ({log.caller_contact.company})
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            To:{" "}
                            {log.recipient_phone_display ||
                              log.recipient_phone_e164 ||
                              "Unknown"}
                            {log.recipient_contact?.company && (
                              <span className="ml-2 text-gray-400">
                                ({log.recipient_contact.company})
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Notes Preview */}
                      {log.notes && (
                        <div className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {log.notes}
                        </div>
                      )}
                    </div>

                    {/* Right Side Info */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm text-gray-500">
                        {formatDate(log.started_at)}
                      </div>
                      <div className="text-sm font-medium text-gray-700 mt-1">
                        {formatDuration(log.duration_seconds)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-lg font-bold text-white">Call Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-white hover:text-green-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Direction & Type */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {getCallTypeIcon(selectedLog.call_type)}
                </span>
                <div>
                  <div
                    className={`font-medium ${getDirectionDisplay(selectedLog.direction).color}`}
                  >
                    {getDirectionDisplay(selectedLog.direction).label} Call
                  </div>
                  <div className="text-sm text-gray-500 capitalize">
                    {selectedLog.call_type}
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Caller</div>
                  <div className="font-medium">
                    {selectedLog.caller_name ||
                      selectedLog.caller_phone_display ||
                      selectedLog.caller_phone_e164 ||
                      "Unknown"}
                  </div>
                  {selectedLog.caller_phone_display && (
                    <div className="text-sm text-gray-500">
                      {selectedLog.caller_phone_display}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Recipient</div>
                  <div className="font-medium">
                    {selectedLog.recipient_name ||
                      selectedLog.recipient_phone_display ||
                      selectedLog.recipient_phone_e164 ||
                      "Unknown"}
                  </div>
                  {selectedLog.recipient_phone_display && (
                    <div className="text-sm text-gray-500">
                      {selectedLog.recipient_phone_display}
                    </div>
                  )}
                </div>
              </div>

              {/* Call Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Started At</div>
                  <div className="text-sm">{formatDate(selectedLog.started_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Duration</div>
                  <div className="text-sm font-medium">
                    {formatDuration(selectedLog.duration_seconds)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Outcome</div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getOutcomeBadge(selectedLog.outcome).bg} ${getOutcomeBadge(selectedLog.outcome).text}`}
                  >
                    {getOutcomeBadge(selectedLog.outcome).label}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Answered</div>
                  <div className="text-sm">
                    {selectedLog.answered ? "Yes" : "No"}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedLog.notes && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Notes</div>
                  <div className="text-sm bg-gray-50 rounded-lg p-3">
                    {selectedLog.notes}
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedLog.summary && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Summary</div>
                  <div className="text-sm bg-gray-50 rounded-lg p-3">
                    {selectedLog.summary}
                  </div>
                </div>
              )}

              {/* Transaction Link */}
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                  Transaction
                </div>
                {selectedLog.transaction_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-teal-100 text-teal-800 px-2 py-1 rounded">
                      Linked
                    </span>
                    <button
                      onClick={() =>
                        handleUnlinkFromTransaction(selectedLog.id)
                      }
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Unlink
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Not linked</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => handleDelete(selectedLog.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CallLogsHistory;
