/**
 * AudioPlayer Component
 * Reusable audio player for voice messages and other audio content.
 * Designed to be portable for use in broker portal and other contexts.
 *
 * Features:
 * - Native HTML5 audio controls
 * - Graceful error handling for missing/invalid files
 * - Support for common audio formats (m4a, mp3, caf)
 * - Electron file:// protocol support
 */
import React, { useState } from "react";

export interface AudioPlayerProps {
  /** File path or URL to the audio file */
  src: string;
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Convert a file path to a properly formatted file:// URL for Electron.
 * Handles Windows backslashes and special characters.
 */
function formatFileUrl(path: string): string {
  // If already a URL, return as-is
  if (path.startsWith("file://") || path.startsWith("http")) {
    return path;
  }

  // Convert Windows backslashes to forward slashes
  const normalizedPath = path.replace(/\\/g, "/");

  // Ensure proper file:// prefix
  return `file://${normalizedPath}`;
}

/**
 * AudioPlayer component for playing audio files.
 * Uses native HTML5 audio element with fallback error state.
 */
export function AudioPlayer({ src, className }: AudioPlayerProps): React.ReactElement {
  const [hasError, setHasError] = useState(false);

  const audioUrl = formatFileUrl(src);

  if (hasError) {
    return (
      <div
        className={className}
        data-testid="audio-player-error"
        role="alert"
        aria-label="Audio unavailable"
      >
        <div className="text-sm text-gray-500 italic">
          Audio unavailable
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="audio-player">
      <audio
        controls
        preload="metadata"
        className="w-full h-10"
        onError={() => setHasError(true)}
        data-testid="audio-element"
      >
        {/* Try multiple formats for maximum compatibility */}
        <source src={audioUrl} type="audio/mp4" />
        <source src={audioUrl} type="audio/mpeg" />
        <source src={audioUrl} type="audio/x-caf" />
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

export default AudioPlayer;
