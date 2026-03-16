'use client';

/**
 * TicketForm - Customer Ticket Submission
 *
 * Form for submitting a new support ticket with file attachments.
 * Auto-fills name/email if user is authenticated.
 * Works for both authenticated and unauthenticated users.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createTicket, getCategories, buildCategoryTree, uploadAttachment } from '@/lib/support-queries';
import type { TicketPriority, SupportCategory } from '@/lib/support-types';
import { PRIORITY_LABELS } from '@/lib/support-types';
import { FileUpload } from './FileUpload';
import type { PendingFile } from './FileUpload';
import { useBrowserDiagnostics, BrowserDiagnostics } from './BrowserDiagnostics';

export function TicketForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Browser diagnostics (best-effort)
  const diagnostics = useBrowserDiagnostics();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);

  const validFiles = files.filter((f) => !f.error);

  // Load categories and check auth
  useEffect(() => {
    getCategories().then((cats) => setCategories(buildCategoryTree(cats)));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsAuthenticated(true);
        setEmail(user.email || '');
        setName(
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          ''
        );
      }
    });
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const disclaimer = selectedCategory?.metadata?.disclaimer as string | undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Guard against double submission (React state is async)
    if (submittingRef.current) return;

    if (subject.length < 3) {
      setError('Subject must be at least 3 characters');
      return;
    }
    if (description.length < 3) {
      setError('Description must be at least 3 characters');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setUploadProgress(null);

    try {
      const result = await createTicket({
        subject,
        description,
        priority,
        requester_email: email,
        requester_name: name,
        category_id: categoryId || undefined,
        subcategory_id: subcategoryId || undefined,
      });

      // Upload attachments after ticket is created
      if (validFiles.length > 0) {
        for (let i = 0; i < validFiles.length; i++) {
          setUploadProgress(`Uploading ${i + 1}/${validFiles.length}...`);
          await uploadAttachment(result.id, validFiles[i].file);
        }
      }

      // Upload diagnostics as JSON attachment (best-effort)
      if (diagnostics) {
        try {
          const diagnosticsBlob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
          const diagnosticsFile = new File([diagnosticsBlob], 'browser-diagnostics.json', { type: 'application/json' });
          await uploadAttachment(result.id, diagnosticsFile);
        } catch {
          // Diagnostics upload failure should not block ticket submission
        }
      }

      router.push('/dashboard/support?success=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Name & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={isAuthenticated}
            className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              isAuthenticated ? 'bg-gray-50 text-gray-500' : ''
            }`}
            placeholder="John Doe"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={isAuthenticated}
            className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              isAuthenticated ? 'bg-gray-50 text-gray-500' : ''
            }`}
            placeholder="you@example.com"
          />
        </div>
      </div>

      {/* Category & Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId('');
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {(Object.entries(PRIORITY_LABELS) as [TicketPriority, string][]).map(
              ([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Subcategory */}
      {selectedCategory?.children && selectedCategory.children.length > 0 && (
        <div>
          <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700 mb-1">
            Subcategory
          </label>
          <select
            id="subcategory"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a subcategory...</option>
            {selectedCategory.children.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Compliance disclaimer */}
      {disclaimer && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <p className="text-sm text-amber-800">{disclaimer}</p>
        </div>
      )}

      {/* Subject */}
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          id="subject"
          type="text"
          required
          minLength={3}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Brief summary of your issue"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          required
          minLength={3}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Please describe your issue in detail..."
        />
      </div>

      {/* File Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attachments
        </label>
        <FileUpload files={files} onFilesChange={setFiles} disabled={submitting} />
      </div>

      {/* Browser Diagnostics */}
      <BrowserDiagnostics diagnostics={diagnostics} />

      {uploadProgress && (
        <div className="text-sm text-blue-600">{uploadProgress}</div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (uploadProgress || 'Submitting...') : 'Submit Ticket'}
        </button>
      </div>
    </form>
  );
}
