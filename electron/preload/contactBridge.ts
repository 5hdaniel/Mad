/**
 * Contact Bridge
 * Manages contacts, imports, and contact-transaction associations
 */

import { ipcRenderer } from "electron";

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
  import: (userId: string, contactsToImport: unknown[]) =>
    ipcRenderer.invoke("contacts:import", userId, contactsToImport),

  /**
   * Gets contacts sorted by activity/relevance for a property
   * @param userId - User ID
   * @param propertyAddress - Property address to find relevant contacts for
   * @returns Sorted contacts
   */
  getSortedByActivity: (userId: string, propertyAddress: string) =>
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
  create: (userId: string, contactData: unknown) =>
    ipcRenderer.invoke("contacts:create", userId, contactData),

  /**
   * Updates contact details
   * @param contactId - Contact ID to update
   * @param updates - Fields to update (name, email, phone, etc.)
   * @returns Updated contact
   */
  update: (contactId: string, updates: unknown) =>
    ipcRenderer.invoke("contacts:update", contactId, updates),

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
