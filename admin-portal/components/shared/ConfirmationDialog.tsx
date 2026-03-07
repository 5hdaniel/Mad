'use client';

/**
 * ConfirmationDialog - Shared reusable confirmation dialog component.
 *
 * Provides a consistent modal dialog with:
 * - Full ARIA support (role="alertdialog", aria-modal, aria-labelledby)
 * - Escape key to close (disabled while loading)
 * - Backdrop click to close (disabled while loading)
 * - Focus management (auto-focuses on mount)
 * - Optional destructive (red) styling for dangerous actions
 * - Optional custom content via children
 */

import { useEffect, useRef, useId, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmationDialogProps {
  /** Dialog title text */
  title: string;
  /** Dialog description/body text */
  description: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Called when the user confirms the action */
  onConfirm: () => void;
  /** Called when the user cancels (Escape, backdrop click, or Cancel button) */
  onCancel: () => void;
  /** Whether this is a destructive action (renders red confirm button + warning icon) */
  isDestructive?: boolean;
  /** Whether the action is in progress (disables buttons and dismissal) */
  isLoading?: boolean;
  /** Optional custom content rendered between description and buttons */
  children?: ReactNode;
}

export function ConfirmationDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
  isLoading = false,
  children,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus the dialog container on mount for accessibility
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape key handler — only when not loading
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isLoading ? onCancel : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 outline-none"
      >
        <div className="flex items-start gap-4">
          {isDestructive && (
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 id={titleId} className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
            {children}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
