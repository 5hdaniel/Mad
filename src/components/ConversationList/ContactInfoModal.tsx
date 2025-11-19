/**
 * ContactInfoModal Component
 * Displays detailed contact information in a modal
 */
import React from 'react';

interface ContactInfo {
  name: string;
  phones?: string[];
  emails?: string[];
}

interface ContactInfoModalProps {
  contact: ContactInfo | null;
  onClose: () => void;
}

export function ContactInfoModal({ contact, onClose }: ContactInfoModalProps) {
  if (!contact) return null;

  const handleOverlayClick = (): void => {
    onClose();
  };

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{contact.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Phone Numbers */}
          {contact.phones && contact.phones.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Phone Numbers ({contact.phones.length})
              </h3>
              <div className="space-y-2">
                {contact.phones.map((phone, index) => (
                  <div key={index} className="flex items-center bg-gray-50 px-3 py-2 rounded">
                    <svg
                      className="w-4 h-4 text-gray-400 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <span className="text-sm text-gray-900">{phone}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Addresses */}
          {contact.emails && contact.emails.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Email Addresses ({contact.emails.length})
              </h3>
              <div className="space-y-2">
                {contact.emails.map((email, index) => (
                  <div key={index} className="flex items-center bg-gray-50 px-3 py-2 rounded">
                    <svg
                      className="w-4 h-4 text-gray-400 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-sm text-gray-900 break-all">{email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full bg-primary text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
