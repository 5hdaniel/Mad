import React, { useState } from 'react';
import { SPECIFIC_ROLES, ROLE_DISPLAY_NAMES, ROLE_TO_CATEGORY, AUDIT_WORKFLOW_STEPS } from '../constants/contactRoles';

/**
 * Audit Transaction Modal
 * Comprehensive transaction creation with address verification and contact assignment
 */
function AuditTransactionModal({ userId, provider, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Address, 2: Client & Agents, 3: Professional Services
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: Address Data
  const [addressData, setAddressData] = useState({
    property_address: '',
    property_street: '',
    property_city: '',
    property_state: '',
    property_zip: '',
    property_coordinates: null,
    transaction_type: 'purchase',
  });

  // Step 2-3: Contact Assignments
  const [contactAssignments, setContactAssignments] = useState({});
  // Structure: { [specific_role]: [{ contactId, isPrimary, notes }] }

  const [showAddressAutocomplete, setShowAddressAutocomplete] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);

  /**
   * Handle address input change with autocomplete
   */
  const handleAddressChange = async (value) => {
    setAddressData({ ...addressData, property_address: value });

    if (value.length > 3) {
      setShowAddressAutocomplete(true);
      // TODO: Fetch address suggestions from Google Places API
      // For now, just hide autocomplete if empty
    } else {
      setShowAddressAutocomplete(false);
      setAddressSuggestions([]);
    }
  };

  /**
   * Select address from autocomplete
   */
  const selectAddress = async (suggestion) => {
    // TODO: Use Google Places API to get full address details
    setAddressData({
      ...addressData,
      property_address: suggestion.formatted_address,
      property_street: suggestion.street,
      property_city: suggestion.city,
      property_state: suggestion.state,
      property_zip: suggestion.zip,
      property_coordinates: suggestion.coordinates,
    });
    setShowAddressAutocomplete(false);
  };

  /**
   * Assign contact to a role
   */
  const assignContact = (role, contactId, isPrimary = false, notes = '') => {
    const existing = contactAssignments[role] || [];

    // Find if this contact is already assigned
    const existingIndex = existing.findIndex((c) => c.contactId === contactId);

    if (existingIndex !== -1) {
      // Update existing assignment
      const updated = [...existing];
      updated[existingIndex] = { contactId, isPrimary, notes };
      setContactAssignments({ ...contactAssignments, [role]: updated });
    } else {
      // Add new assignment
      setContactAssignments({
        ...contactAssignments,
        [role]: [...existing, { contactId, isPrimary, notes }],
      });
    }
  };

  /**
   * Remove contact from a role
   */
  const removeContact = (role, contactId) => {
    const existing = contactAssignments[role] || [];
    const filtered = existing.filter((c) => c.contactId !== contactId);
    setContactAssignments({ ...contactAssignments, [role]: filtered });
  };

  /**
   * Proceed to next step
   */
  const handleNextStep = () => {
    if (step === 1) {
      // Validate address
      if (!addressData.property_address.trim()) {
        setError('Property address is required');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      // Validate required contacts (client is required)
      if (!contactAssignments[SPECIFIC_ROLES.CLIENT] || contactAssignments[SPECIFIC_ROLES.CLIENT].length === 0) {
        setError('Client contact is required');
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      // Create transaction
      handleCreateTransaction();
    }
  };

  /**
   * Go back to previous step
   */
  const handlePreviousStep = () => {
    setError(null);
    setStep(step - 1);
  };

  /**
   * Create the transaction with all contact assignments
   */
  const handleCreateTransaction = async () => {
    setLoading(true);
    setError(null);

    try {
      // Prepare contact assignments for API
      const assignments = Object.entries(contactAssignments).flatMap(([role, contacts]) =>
        contacts.map((contact) => ({
          role: role,
          role_category: ROLE_TO_CATEGORY[role],
          contact_id: contact.contactId,
          is_primary: contact.isPrimary ? 1 : 0,
          notes: contact.notes || null,
        }))
      );

      // Call API to create audited transaction
      const result = await window.api.transactions.createAudited(userId, {
        ...addressData,
        contact_assignments: assignments,
      });

      if (result.success) {
        onSuccess(result.transaction);
      } else {
        setError(result.error || 'Failed to create transaction');
      }
    } catch (err) {
      setError(err.message || 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">Audit New Transaction</h2>
            <p className="text-indigo-100 text-sm">
              {step === 1 && 'Step 1: Verify Property Address'}
              {step === 2 && 'Step 2: Assign Client & Agents'}
              {step === 3 && 'Step 3: Assign Professional Services'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-shrink-0 bg-gray-100 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                    s < step
                      ? 'bg-green-500 text-white'
                      : s === step
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${s < step ? 'bg-green-500' : 'bg-gray-300'}`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <AddressVerificationStep
              addressData={addressData}
              onAddressChange={handleAddressChange}
              onTransactionTypeChange={(type) => setAddressData({ ...addressData, transaction_type: type })}
              showAutocomplete={showAddressAutocomplete}
              suggestions={addressSuggestions}
              onSelectSuggestion={selectAddress}
            />
          )}

          {step === 2 && (
            <ContactAssignmentStep
              stepConfig={AUDIT_WORKFLOW_STEPS[0]}
              contactAssignments={contactAssignments}
              onAssignContact={assignContact}
              onRemoveContact={removeContact}
              userId={userId}
            />
          )}

          {step === 3 && (
            <ContactAssignmentStep
              stepConfig={AUDIT_WORKFLOW_STEPS[1]}
              contactAssignments={contactAssignments}
              onAssignContact={assignContact}
              onRemoveContact={removeContact}
              userId={userId}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={handlePreviousStep}
                disabled={loading}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNextStep}
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </span>
              ) : step === 3 ? (
                'Create Transaction'
              ) : (
                'Continue →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1: Address Verification
 */
function AddressVerificationStep({
  addressData,
  onAddressChange,
  onTransactionTypeChange,
  showAutocomplete,
  suggestions,
  onSelectSuggestion,
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Property Address *
        </label>
        <div className="relative">
          <input
            type="text"
            value={addressData.property_address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Enter property address..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoComplete="off"
          />
          {showAutocomplete && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors"
                >
                  <p className="font-medium text-gray-900">{suggestion.formatted_address}</p>
                  <p className="text-xs text-gray-500">{suggestion.city}, {suggestion.state}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Start typing to see verified addresses from Google Places
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Transaction Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onTransactionTypeChange('purchase')}
            className={`px-4 py-3 rounded-lg font-medium transition-all ${
              addressData.transaction_type === 'purchase'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Purchase
          </button>
          <button
            onClick={() => onTransactionTypeChange('sale')}
            className={`px-4 py-3 rounded-lg font-medium transition-all ${
              addressData.transaction_type === 'sale'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sale
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">Address Verification</p>
            <p className="text-xs text-blue-700 mt-1">
              We'll verify the address using Google Places API to ensure accuracy for reports and exports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Steps 2-3: Contact Assignment
 */
function ContactAssignmentStep({ stepConfig, contactAssignments, onAssignContact, onRemoveContact, userId }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{stepConfig.title}</h3>
        <p className="text-sm text-gray-600 mb-4">{stepConfig.description}</p>
      </div>

      {stepConfig.roles.map((roleConfig) => (
        <RoleAssignment
          key={roleConfig.role}
          role={roleConfig.role}
          required={roleConfig.required}
          multiple={roleConfig.multiple}
          assignments={contactAssignments[roleConfig.role] || []}
          onAssign={onAssignContact}
          onRemove={onRemoveContact}
          userId={userId}
        />
      ))}
    </div>
  );
}

/**
 * Single Role Assignment Component
 */
function RoleAssignment({ role, required, multiple, assignments, onAssign, onRemove, userId }) {
  const [contacts, setContacts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedContactId, setSelectedContactId] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const result = await window.api.contacts.getAll(userId);
      if (result.success) {
        setContacts(result.contacts || []);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = () => {
    if (selectedContactId) {
      const isPrimary = assignments.length === 0; // First contact is primary
      onAssign(role, selectedContactId, isPrimary, notes);
      setSelectedContactId('');
      setNotes('');
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-900">
            {ROLE_DISPLAY_NAMES[role]}
          </label>
          {required && <span className="text-xs text-red-500 font-semibold">*</span>}
          {multiple && <span className="text-xs text-gray-500">(can assign multiple)</span>}
        </div>
      </div>

      {/* Assigned Contacts */}
      {assignments.length > 0 && (
        <div className="mb-3 space-y-2">
          {assignments.map((assignment, index) => {
            const contact = contacts.find((c) => c.id === assignment.contactId);
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{contact?.name || 'Unknown Contact'}</p>
                  {contact?.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                  {assignment.notes && <p className="text-xs text-gray-600 mt-1">{assignment.notes}</p>}
                  {assignment.isPrimary && (
                    <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(role, assignment.contactId)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Contact (if multiple allowed or no contact assigned) */}
      {(multiple || assignments.length === 0) && (
        <div className="flex items-center gap-2">
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">Select contact...</option>
            {contacts
              .filter((c) => !assignments.some((a) => a.contactId === c.id))
              .map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} {contact.email && `(${contact.email})`}
                </option>
              ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedContactId}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-all"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

export default AuditTransactionModal;
