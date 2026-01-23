/**
 * Contact Bridge
 * Manages contacts, imports, and contact-transaction associations
 */

import { ipcRenderer } from "electron";
import type { NewContact, Contact } from "../types/models";

export const contactBridge = {
  /**
   * Retrieves all contacts for a user
   * @param userId - User ID to get contacts for
   * @returns All user contacts
   */
  getAll: (userId: string) => ipcRenderer.invoke("contacts:get-all", userId),

  /**
   * Gets contacts available for assignment (not deleted/archived)
   * @param userId - User ID to get available contacts for
   * @returns Available contacts
   */
  getAvailable: (userId: string) =>
    ipcRenderer.invoke("contacts:get-available", userId),

  /**
   * Imports contacts from system address book or external source
   * @param userId - User ID importing contacts
   * @param contactsToImport - Array of contact objects to import
   * @returns Import results
   */
  import: (userId: string, contactsToImport: NewContact[]) =>
    ipcRenderer.invoke("contacts:import", userId, contactsToImport),

  /**
   * Gets contacts sorted by activity/relevance for a property
   * @param userId - User ID
   * @param propertyAddress - Property address to find relevant contacts for
   * @returns Sorted contacts
   */
  getSortedByActivity: (userId: string, propertyAddress?: string) =>
    ipcRenderer.invoke(
      "contacts:get-sorted-by-activity",
      userId,
      propertyAddress,
    ),

  /**
   * Creates a new contact
   * @param userId - User ID creating the contact
   * @param contactData - Contact details (name, email, phone, company, etc.)
   * @returns Created contact
   */
  create: (userId: string, contactData: NewContact) =>
    ipcRenderer.invoke("contacts:create", userId, contactData),

  /**
   * Updates contact details
   * @param contactId - Contact ID to update
   * @param updates - Fields to update (name, email, phone, etc.)
   * @returns Updated contact
   */
  update: (contactId: string, updates: Partial<Contact>) =>
    ipcRenderer.invoke("contacts:update", contactId, updates),

  /**
   * Updates contact email (for testing multi-email scenarios)
   * @param contactId - Contact ID to update
   * @param newEmail - New email address
   * @returns Update result
   */
  updateEmail: (contactId: string, newEmail: string) =>
    ipcRenderer.invoke("contacts:updateEmail", contactId, newEmail),

  /**
   * Checks if a contact can be deleted (not assigned to transactions)
   * @param contactId - Contact ID to check
   * @returns Deletion eligibility
   */
  checkCanDelete: (contactId: string) =>
    ipcRenderer.invoke("contacts:checkCanDelete", contactId),

  /**
   * Deletes a contact (only if not assigned to transactions)
   * @param contactId - Contact ID to delete
   * @returns Deletion result
   */
  delete: (contactId: string) =>
    ipcRenderer.invoke("contacts:delete", contactId),

  /**
   * Removes a contact (soft delete/archive)
   * @param contactId - Contact ID to remove
   * @returns Removal result
   */
  remove: (contactId: string) =>
    ipcRenderer.invoke("contacts:remove", contactId),

  /**
   * Look up contact names by phone numbers (batch)
   * @param phones - Array of phone numbers to look up
   * @returns Map of phone -> contact name
   */
  getNamesByPhones: (phones: string[]): Promise<{ success: boolean; names: Record<string, string>; error?: string }> =>
    ipcRenderer.invoke("contacts:get-names-by-phones", phones),

  /**
   * Search contacts at database level (for selection modal)
   * This enables searching beyond the initial LIMIT 200 contacts.
   * @param userId - User ID to search contacts for
   * @param query - Search query (name, email, phone, company)
   * @returns Matching contacts sorted by relevance
   */
  searchContacts: (userId: string, query: string): Promise<{
    success: boolean;
    contacts?: Contact[];
    error?: string;
  }> => ipcRenderer.invoke("contacts:search", userId, query),

  /**
   * Listen for import progress updates
   * @param callback - Called with progress updates during contact import
   * @returns Cleanup function to remove listener
   */
  onImportProgress: (
    callback: (progress: { current: number; total: number; percent: number }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { current: number; total: number; percent: number }
    ) => {
      callback(progress);
    };
    ipcRenderer.on("contacts:import-progress", handler);
    return () => {
      ipcRenderer.removeListener("contacts:import-progress", handler);
    };
  },
};

/**
 * Address Verification Bridge
 * Integrates with Google Places API for address validation and geocoding
 */
export const addressBridge = {
  /**
   * Initializes Google Places API with API key
   * @param apiKey - Google Places API key
   * @returns Initialization result
   */
  initialize: (apiKey: string) =>
    ipcRenderer.invoke("address:initialize", apiKey),

  /**
   * Gets address autocomplete suggestions
   * @param input - Partial address input
   * @param sessionToken - Session token for request batching
   * @returns Address suggestions
   */
  getSuggestions: (input: string, sessionToken: string) =>
    ipcRenderer.invoke("address:get-suggestions", input, sessionToken),

  /**
   * Gets detailed information for a specific place
   * @param placeId - Google Place ID
   * @returns Place details
   */
  getDetails: (placeId: string) =>
    ipcRenderer.invoke("address:get-details", placeId),

  /**
   * Geocodes an address to coordinates
   * @param address - Address to geocode
   * @returns Geocoding result
   */
  geocode: (address: string) =>
    ipcRenderer.invoke("address:geocode", address),

  /**
   * Validates and standardizes an address
   * @param address - Address to validate
   * @returns Validation result
   */
  validate: (address: string) =>
    ipcRenderer.invoke("address:validate", address),
};
