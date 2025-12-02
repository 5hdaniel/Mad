/**
 * IPhoneConnect Component
 * Main component for connecting to iPhone via USB and extracting data
 *
 * Flow:
 * 1. Discover available iPhone backups
 * 2. Select a backup to use
 * 3. Load contacts from the backup
 * 4. Select contacts to import
 * 5. Stream messages for selected contacts
 * 6. Export data to files
 */
import React, { useState, useEffect, useCallback } from 'react';

// Types
interface iPhoneBackup {
  id: string;
  udid: string;
  deviceName: string;
  productVersion?: string;
  lastBackupDate: string;
  backupPath: string;
  isEncrypted: boolean;
  size?: number;
}

interface iPhoneContact {
  id: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  displayName: string;
  phoneNumbers: { label?: string; value: string }[];
  emailAddresses: { label?: string; value: string }[];
}

interface SyncProgress {
  status: string;
  stage?: string;
  current?: number;
  total?: number;
  message?: string;
  error?: string;
}

interface ExportResult {
  success: boolean;
  exportPath?: string;
  contactCount?: number;
  messageCount?: number;
  error?: string;
  canceled?: boolean;
}

interface IPhoneConnectProps {
  onComplete: (result: ExportResult | null) => void;
  onCancel: () => void;
}

type Step = 'discover' | 'select-backup' | 'loading-contacts' | 'select-contacts' | 'exporting' | 'complete';

function IPhoneConnect({ onComplete, onCancel }: IPhoneConnectProps) {
  // State
  const [step, setStep] = useState<Step>('discover');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backup state
  const [backups, setBackups] = useState<iPhoneBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<iPhoneBackup | null>(null);

  // Contact state
  const [contacts, setContacts] = useState<iPhoneContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Progress state
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  // Export options
  const [includeMessages, setIncludeMessages] = useState(true);
  const [exportFormat, setExportFormat] = useState<'txt' | 'json'>('txt');

  // Discover backups on mount
  useEffect(() => {
    discoverBackups();

    // Listen for sync progress
    let cleanup: (() => void) | undefined;
    if (window.electron.onIphoneSyncProgress) {
      cleanup = window.electron.onIphoneSyncProgress((prog: SyncProgress) => {
        setProgress(prog);
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const discoverBackups = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.iphoneDiscoverBackups();

      if (result.success) {
        setBackups(result.backups || []);

        if (result.backups && result.backups.length > 0) {
          setStep('select-backup');
        } else {
          setError('No iPhone backups found. Please create a backup using iTunes or Finder first.');
        }
      } else {
        setError(result.error || 'Failed to discover backups');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectBackup = async (backup: iPhoneBackup) => {
    if (backup.isEncrypted) {
      setError('This backup is encrypted. Please disable backup encryption in iTunes/Finder and create a new backup.');
      return;
    }

    setSelectedBackup(backup);
    setStep('loading-contacts');
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.iphoneGetContacts(backup.id);

      if (result.success) {
        setContacts(result.contacts || []);
        setStep('select-contacts');
      } else {
        setError(result.error || 'Failed to load contacts');
        setStep('select-backup');
      }
    } catch (err) {
      setError((err as Error).message);
      setStep('select-backup');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const selectAllContacts = () => {
    setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
  };

  const deselectAllContacts = () => {
    setSelectedContactIds(new Set());
  };

  const handleExport = async () => {
    if (selectedContactIds.size === 0 || !selectedBackup) {
      setError('Please select at least one contact');
      return;
    }

    setStep('exporting');
    setError(null);

    try {
      const result = await window.electron.iphoneExportData(
        selectedBackup.id,
        Array.from(selectedContactIds),
        { includeMessages, format: exportFormat }
      );

      if (result.success) {
        setExportResult(result);
        setStep('complete');
      } else if (result.canceled) {
        setStep('select-contacts');
      } else {
        setError(result.error || 'Export failed');
        setStep('select-contacts');
      }
    } catch (err) {
      setError((err as Error).message);
      setStep('select-contacts');
    }
  };

  const handleOpenFolder = () => {
    if (exportResult?.exportPath) {
      window.electron.openFolder(exportResult.exportPath);
    }
  };

  const handleOpenBackupLocation = async () => {
    await window.electron.iphoneOpenBackupLocation();
  };

  // Filter contacts by search
  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.displayName.toLowerCase().includes(searchLower) ||
      contact.phoneNumbers.some((p) => p.value.includes(searchTerm)) ||
      contact.emailAddresses.some((e) => e.value.toLowerCase().includes(searchLower))
    );
  });

  // Render loading state
  if (isLoading && step === 'discover') {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Searching for iPhone backups...</p>
        </div>
      </div>
    );
  }

  // Render no backups found
  if (step === 'discover' && backups.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No iPhone Backups Found</h2>
          <p className="text-gray-600 mb-6">
            {error || 'To import contacts and messages from your iPhone, please create a local backup using iTunes or Finder first.'}
          </p>
          <div className="space-y-3">
            <div className="bg-blue-50 p-4 rounded-lg text-left">
              <h3 className="font-semibold text-blue-900 mb-2">How to create a backup:</h3>
              <ol className="text-sm text-blue-800 space-y-2">
                <li>1. Connect your iPhone to your computer with a USB cable</li>
                <li>2. Open iTunes (Windows) or Finder (Mac)</li>
                <li>3. Select your iPhone</li>
                <li>4. Choose &quot;Back up to this computer&quot;</li>
                <li>5. Make sure &quot;Encrypt backup&quot; is <strong>unchecked</strong></li>
                <li>6. Click &quot;Back Up Now&quot;</li>
              </ol>
            </div>
            <button
              onClick={handleOpenBackupLocation}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Open Backup Location
            </button>
            <button
              onClick={discoverBackups}
              className="w-full bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render backup selection
  if (step === 'select-backup') {
    return (
      <div className="flex flex-col min-h-full">
        <div className="bg-white border-b border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select iPhone Backup</h1>
          <p className="text-gray-600">Choose a backup to import contacts and messages from.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {backups.map((backup) => (
              <div
                key={backup.id}
                className={`p-4 bg-white border-2 rounded-lg cursor-pointer transition-colors ${
                  backup.isEncrypted
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-gray-200 hover:border-primary'
                }`}
                onClick={() => selectBackup(backup)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{backup.deviceName}</h3>
                      <p className="text-sm text-gray-600">
                        iOS {backup.productVersion || 'Unknown'} • Last backup:{' '}
                        {new Date(backup.lastBackupDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {backup.isEncrypted ? (
                    <span className="text-xs font-medium text-yellow-800 bg-yellow-100 px-2 py-1 rounded">
                      Encrypted
                    </span>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={onCancel}
                className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render loading contacts
  if (step === 'loading-contacts') {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading contacts from backup...</p>
          {progress?.stage && <p className="text-sm text-gray-500 mt-2">{progress.stage}</p>}
        </div>
      </div>
    );
  }

  // Render contact selection
  if (step === 'select-contacts') {
    return (
      <div className="flex flex-col min-h-full">
        <div className="bg-white border-b border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Select Contacts to Import
          </h1>
          <p className="text-gray-600 mb-4">
            Found {contacts.length} contacts in {selectedBackup?.deviceName}
          </p>

          {/* Search and Selection Controls */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              onClick={selectAllContacts}
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-blue-50 rounded-lg transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAllContacts}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Deselect All
            </button>
          </div>

          {/* Export Options */}
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeMessages}
                onChange={(e) => setIncludeMessages(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Include messages</span>
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'txt' | 'json')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="txt">Text format (.txt)</option>
              <option value="json">JSON format (.json)</option>
            </select>
          </div>
        </div>

        {/* Selection Count */}
        <div className="bg-gray-100 border-b border-gray-200 py-3">
          <p className="text-sm text-gray-600 text-center font-medium">
            {selectedContactIds.size} of {filteredContacts.length} contacts selected
          </p>
        </div>

        {error && (
          <div className="p-4 mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-gray-500">No contacts found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`p-4 bg-white border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedContactIds.has(contact.id)
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleContactSelection(contact.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedContactIds.has(contact.id)
                          ? 'border-primary bg-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedContactIds.has(contact.id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-semibold">
                        {contact.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{contact.displayName}</h3>
                      <div className="text-sm text-gray-600 truncate">
                        {contact.phoneNumbers[0]?.value || contact.emailAddresses[0]?.value || 'No contact info'}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {contact.phoneNumbers.length > 0 && (
                        <div>{contact.phoneNumbers.length} phone{contact.phoneNumbers.length !== 1 ? 's' : ''}</div>
                      )}
                      {contact.emailAddresses.length > 0 && (
                        <div>{contact.emailAddresses.length} email{contact.emailAddresses.length !== 1 ? 's' : ''}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white border-t border-gray-200 p-6">
          <div className="flex gap-3">
            <button
              onClick={() => setStep('select-backup')}
              className="px-6 py-3 border-2 border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-semibold text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={handleExport}
              disabled={selectedContactIds.size === 0}
              className="flex-1 bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export {selectedContactIds.size} Contact{selectedContactIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render exporting
  if (step === 'exporting') {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Exporting Data...</h2>
          {progress && (
            <>
              <p className="text-gray-600 mb-4">{progress.stage || 'Processing...'}</p>
              {progress.total && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${((progress.current || 0) / progress.total) * 100}%` }}
                  ></div>
                </div>
              )}
              {progress.message && <p className="text-sm text-gray-500">{progress.message}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  // Render complete
  if (step === 'complete' && exportResult) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Export Complete!</h2>
          <p className="text-gray-600 mb-6">
            Successfully exported {exportResult.contactCount || 0} contact{exportResult.contactCount !== 1 ? 's' : ''} with{' '}
            {exportResult.messageCount || 0} message{exportResult.messageCount !== 1 ? 's' : ''}.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleOpenFolder}
              className="w-full bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Open Export Folder
            </button>
            <button
              onClick={() => {
                setStep('select-contacts');
                setExportResult(null);
              }}
              className="w-full bg-green-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Export More
            </button>
            <button
              onClick={() => onComplete(exportResult)}
              className="w-full bg-gray-200 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

export default IPhoneConnect;
