/**
 * GemmaModelSelector Component
 * Reusable model picker for Gemma 4 local AI models.
 * Used in both onboarding (LocalAIStep) and settings (LLMSettings).
 *
 * Features:
 * - System specs detection (RAM, recommended model)
 * - Model cards with download/delete/active states
 * - Download progress bar
 * - "Data stays on your device" badge
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import logger from "../../utils/logger";

interface GemmaModelSelectorProps {
  userId: string;
  onModelReady?: () => void;
  onSkip?: () => void;
  compact?: boolean;
}

interface SystemCapabilities {
  totalRAM: number;
  availableRAM: number;
  cpuCores: number;
  gpuDetected: boolean;
  platform: string;
}

interface DownloadedModelInfo {
  modelId: string;
  path: string;
  sizeBytes: number;
  downloadedAt: string;
}

interface DownloadProgress {
  modelId: string;
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
}

interface LocalStatus {
  systemCapabilities: SystemCapabilities;
  recommendedModel: string;
  downloadedModels: DownloadedModelInfo[];
  modelLoaded: boolean;
  currentModel: string | null;
}

const GEMMA_MODELS = [
  {
    id: "gemma-4-e2b-it-q4",
    label: "Gemma 4 E2B",
    subtitle: "Lightweight",
    description: "Basic tasks, runs on any machine",
    ramRequired: 1536,
    downloadSize: "~1.4 GB",
    quality: "Good",
  },
  {
    id: "gemma-4-e4b-it-q4",
    label: "Gemma 4 E4B",
    subtitle: "Recommended",
    description: "Best balance of quality and speed",
    ramRequired: 5120,
    downloadSize: "~4.8 GB",
    quality: "Great",
  },
  {
    id: "gemma-4-26b-a4b-it-q4",
    label: "Gemma 4 26B MoE",
    subtitle: "Power",
    description: "Highest quality for power users",
    ramRequired: 18432,
    downloadSize: "~17 GB",
    quality: "Excellent",
  },
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRAM(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function GemmaModelSelector({
  userId,
  onModelReady,
  onSkip,
  compact = false,
}: GemmaModelSelectorProps): React.ReactElement {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressListenerRef = useRef<((...args: unknown[]) => void) | null>(null);

  // Load local AI status
  const loadStatus = useCallback(async () => {
    try {
      const result = await window.api.llm.getLocalStatus();
      if (result.success && result.data) {
        const data = result.data as LocalStatus;
        setStatus(data);
        if (!selectedModel) {
          setSelectedModel(data.recommendedModel);
        }
      }
    } catch (err) {
      logger.error("[GemmaModelSelector] Failed to load status", err);
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Set up download progress listener
  useEffect(() => {
    const handler = (_event: unknown, prog: DownloadProgress) => {
      setProgress(prog);
    };
    progressListenerRef.current = handler as (...args: unknown[]) => void;
    window.api.llm.onDownloadProgress(handler);

    return () => {
      if (progressListenerRef.current) {
        window.api.llm.offDownloadProgress(progressListenerRef.current);
      }
    };
  }, []);

  const handleDownload = useCallback(async (modelId: string) => {
    setDownloading(modelId);
    setError(null);
    setProgress(null);

    try {
      const result = await window.api.llm.downloadModel(modelId);
      if (result.success) {
        // Update preferences to use this model
        await window.api.llm.updatePreferences(userId, {
          preferredProvider: "local",
          localModel: modelId,
        });
        await loadStatus();
        onModelReady?.();
      } else {
        setError(result.error?.message || "Download failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
      setProgress(null);
    }
  }, [userId, loadStatus, onModelReady]);

  const handleCancelDownload = useCallback(async () => {
    try {
      await window.api.llm.cancelDownload();
    } catch {
      // ignore
    }
    setDownloading(null);
    setProgress(null);
  }, []);

  const handleDelete = useCallback(async (modelId: string) => {
    try {
      await window.api.llm.deleteLocalModel(modelId);
      await loadStatus();
    } catch (err) {
      logger.error("[GemmaModelSelector] Delete failed", err);
    }
  }, [loadStatus]);

  const handleSelectAsActive = useCallback(async (modelId: string) => {
    try {
      await window.api.llm.updatePreferences(userId, {
        preferredProvider: "local",
        localModel: modelId,
      });
      await loadStatus();
    } catch (err) {
      logger.error("[GemmaModelSelector] Select failed", err);
    }
  }, [userId, loadStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  const downloadedIds = new Set(status?.downloadedModels.map(m => m.modelId) ?? []);
  const systemRAM = status?.systemCapabilities.totalRAM ?? 0;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Privacy Badge */}
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Your data stays on this device. No internet required for AI features.</span>
      </div>

      {/* System Info */}
      {!compact && (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>System RAM: <strong>{formatRAM(systemRAM)}</strong></span>
          <span>CPU Cores: <strong>{status?.systemCapabilities.cpuCores ?? "?"}</strong></span>
          {status?.recommendedModel && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              Recommended: {GEMMA_MODELS.find(m => m.id === status.recommendedModel)?.label}
            </span>
          )}
        </div>
      )}

      {/* Model Cards */}
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {GEMMA_MODELS.map((model) => {
          const isDownloaded = downloadedIds.has(model.id);
          const isDownloading = downloading === model.id;
          const isActive = status?.currentModel === model.id;
          const isRecommended = status?.recommendedModel === model.id;
          const canRun = systemRAM >= model.ramRequired;
          const isSelected = selectedModel === model.id;

          return (
            <div
              key={model.id}
              onClick={() => !isDownloading && setSelectedModel(model.id)}
              className={`
                relative border rounded-lg p-4 transition-all cursor-pointer
                ${isSelected ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400" : "border-gray-200 hover:border-gray-300"}
                ${!canRun ? "opacity-60" : ""}
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{model.label}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    model.subtitle === "Recommended"
                      ? "bg-purple-100 text-purple-700"
                      : model.subtitle === "Power"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {model.subtitle}
                  </span>
                  {isRecommended && !compact && (
                    <span className="text-xs text-purple-600 font-medium">
                      Best for your system
                    </span>
                  )}
                </div>

                {/* Status / Action */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                      Active
                    </span>
                  )}
                  {isDownloaded && !isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSelectAsActive(model.id); }}
                      className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      Use This
                    </button>
                  )}
                  {isDownloaded && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete to free disk space"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                <span>{model.description}</span>
                <span>RAM: {formatRAM(model.ramRequired)}</span>
                <span>Download: {model.downloadSize}</span>
                <span>Quality: {model.quality}</span>
              </div>

              {!canRun && (
                <p className="mt-2 text-xs text-amber-600">
                  Your system has {formatRAM(systemRAM)} RAM. This model requires {formatRAM(model.ramRequired)}.
                </p>
              )}

              {/* Download button / progress */}
              {!isDownloaded && !isDownloading && isSelected && canRun && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(model.id); }}
                  className="mt-3 w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  Download {model.label} ({model.downloadSize})
                </button>
              )}

              {isDownloading && progress && (
                <div className="mt-3 space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{progress.percent}% — {formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}</span>
                    {progress.speed > 0 && <span>{formatBytes(progress.speed)}/s</span>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCancelDownload(); }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Skip button (onboarding only) */}
      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          Skip for now — you can set this up later in Settings
        </button>
      )}
    </div>
  );
}

export default GemmaModelSelector;
