import React from "react";
import { ExtendedContact, getSourceBadge } from "../types";

interface ContactCardProps {
  contact: ExtendedContact;
  onClick: (contact: ExtendedContact) => void;
}

/**
 * ContactCard Component
 * Displays a single contact in a card format with avatar, name, and contact info
 */
function ContactCard({ contact, onClick }: ContactCardProps) {
  const sourceBadge = getSourceBadge(contact.source);

  return (
    <div
      onClick={() => onClick(contact)}
      className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-purple-400 hover:shadow-xl transition-all flex flex-col h-full cursor-pointer"
    >
      {/* Contact Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {contact.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{contact.name}</h3>
            <span
              className={`text-xs px-2 py-1 rounded-full ${sourceBadge.color}`}
            >
              {sourceBadge.text}
            </span>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="space-y-2 mb-4 text-sm flex-1">
        {/* Show all emails for Contacts app contacts, or just primary email for manual contacts */}
        {contact.source === "contacts_app" &&
        contact.allEmails &&
        contact.allEmails.length > 0 ? (
          contact.allEmails.map((email: string, idx: number) => (
            <div
              key={`email-${idx}`}
              className="flex items-center gap-2 text-gray-600"
            >
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
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
              <span className="truncate">{email}</span>
            </div>
          ))
        ) : contact.email ? (
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
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
            <span className="truncate">{contact.email}</span>
          </div>
        ) : null}

        {/* Show all phones for Contacts app contacts, or just primary phone for manual contacts */}
        {contact.source === "contacts_app" &&
        contact.allPhones &&
        contact.allPhones.length > 0 ? (
          contact.allPhones.map((phone: string, idx: number) => (
            <div
              key={`phone-${idx}`}
              className="flex items-center gap-2 text-gray-600"
            >
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
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
              <span>{phone}</span>
            </div>
          ))
        ) : contact.phone ? (
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
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
            <span>{contact.phone}</span>
          </div>
        ) : null}

        {contact.company && (
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span className="truncate">{contact.company}</span>
          </div>
        )}
        {contact.title && (
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="truncate">{contact.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContactCard;
