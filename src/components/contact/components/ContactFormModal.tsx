import React, { useState } from "react";
import { ExtendedContact, ContactFormData } from "../types";

interface ContactFormModalProps {
  userId: string;
  contact: ExtendedContact | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Contact Form Modal
 * Add or edit a contact
 */
function ContactFormModal({
  userId,
  contact,
  onClose,
  onSuccess,
}: ContactFormModalProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: contact?.name || contact?.display_name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    company: contact?.company || "",
    title: contact?.title || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Check if this is an external contact being imported (missing required data)
  const isExternalContact = contact?.id?.startsWith("msg_") || !!contact?.is_message_derived;
  const hasContactInfo = !!(formData.email.trim() || formData.phone.trim());
  const showMissingInfoWarning = isExternalContact && !hasContactInfo;
  const canSave = !!formData.name.trim() && hasContactInfo;

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(undefined);

    try {
      let result;
      if (contact) {
        // Update existing contact
        result = await window.api.contacts.update(
          contact.id,
          formData as unknown as Record<string, unknown>,
        );
      } else {
        // Create new contact
        result = await window.api.contacts.create(
          userId,
          formData as unknown as Record<string, unknown>,
        );
      }

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Failed to save contact");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save contact";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-bold text-white">
            {contact ? "Edit Contact" : "Add New Contact"}
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg
              className="w-5 h-5"
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

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Missing contact info warning */}
          {showMissingInfoWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Missing contact information:</span> Please add an email address or phone number to import this contact.
              </p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="John Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="john@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleChange("company", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="ABC Real Estate"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Real Estate Agent"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              saving || !canSave
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700"
            }`}
          >
            {saving ? "Saving..." : contact ? "Update Contact" : "Add Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContactFormModal;
