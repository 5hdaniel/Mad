"use strict";
// ============================================
// CONTACT IPC HANDLERS
// This file contains contact handlers to be registered in main.js
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContactHandlers = registerContactHandlers;
const electron_1 = require("electron");
const databaseService_1 = __importDefault(require("./services/databaseService"));
const contactsService_1 = require("./services/contactsService");
// Import validation utilities
const validation_1 = require("./utils/validation");
/**
 * Register all contact-related IPC handlers
 */
function registerContactHandlers() {
    // Get all imported contacts for a user (local database only)
    electron_1.ipcMain.handle('contacts:get-all', async (event, userId) => {
        try {
            console.log('[Main] Getting all imported contacts for user:', userId);
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId); // Validated, will throw if invalid
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            // Get only imported contacts from database
            const importedContacts = await databaseService_1.default.getImportedContactsByUserId(validatedUserId);
            console.log(`[Main] Found ${importedContacts.length} imported contacts`);
            return {
                success: true,
                contacts: importedContacts,
            };
        }
        catch (error) {
            console.error('[Main] Get contacts failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Get available contacts for import (from external sources)
    electron_1.ipcMain.handle('contacts:get-available', async (event, userId) => {
        try {
            console.log('[Main] Getting available contacts for import for user:', userId);
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId); // Validated, will throw if invalid
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            // Get contacts from macOS Contacts app
            const { phoneToContactInfo, status } = await (0, contactsService_1.getContactNames)();
            // Get already imported contact names/emails to filter them out
            const importedContacts = await databaseService_1.default.getImportedContactsByUserId(validatedUserId);
            const importedNames = new Set(importedContacts.map(c => c.name?.toLowerCase()));
            const importedEmails = new Set(importedContacts.map(c => c.email?.toLowerCase()).filter(Boolean));
            // Convert Contacts app data to contact objects
            const availableContacts = [];
            const seenContacts = new Set();
            if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
                for (const [_phone, contactInfo] of Object.entries(phoneToContactInfo)) {
                    // Use the contact name as unique key to avoid duplicates
                    // (same contact may have multiple phone numbers)
                    const nameLower = contactInfo.name?.toLowerCase();
                    const primaryEmail = contactInfo.emails?.[0]?.toLowerCase();
                    // Skip if already imported (by name or email)
                    if (importedNames.has(nameLower) || (primaryEmail && importedEmails.has(primaryEmail))) {
                        continue;
                    }
                    if (!seenContacts.has(contactInfo.name)) {
                        seenContacts.add(contactInfo.name);
                        availableContacts.push({
                            id: `contacts-app-${contactInfo.name}`, // Temporary ID for UI
                            name: contactInfo.name,
                            phone: contactInfo.phones?.[0] || null, // Primary phone
                            email: contactInfo.emails?.[0] || null, // Primary email
                            source: 'contacts_app',
                            allPhones: contactInfo.phones || [],
                            allEmails: contactInfo.emails || [],
                        });
                    }
                }
            }
            console.log(`[Main] Found ${availableContacts.length} available contacts for import`);
            return {
                success: true,
                contacts: availableContacts,
                contactsStatus: status, // Include loading status
            };
        }
        catch (error) {
            console.error('[Main] Get available contacts failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Import contacts from external sources
    electron_1.ipcMain.handle('contacts:import', async (event, userId, contactsToImport) => {
        try {
            console.log('[Main] Importing contacts for user:', userId, 'count:', contactsToImport.length);
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId); // Validated, will throw if invalid
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            // Validate contacts array
            if (!Array.isArray(contactsToImport)) {
                throw new validation_1.ValidationError('Contacts to import must be an array', 'contactsToImport');
            }
            if (contactsToImport.length === 0) {
                throw new validation_1.ValidationError('No contacts provided for import', 'contactsToImport');
            }
            if (contactsToImport.length > 1000) {
                throw new validation_1.ValidationError('Cannot import more than 1000 contacts at once', 'contactsToImport');
            }
            const importedContacts = [];
            for (const contact of contactsToImport) {
                // Validate each contact's data (basic validation)
                const sanitizedContact = (0, validation_1.sanitizeObject)(contact);
                const validatedData = (0, validation_1.validateContactData)(sanitizedContact, false);
                const importedContact = await databaseService_1.default.createContact({
                    user_id: validatedUserId,
                    name: validatedData.name || 'Unknown',
                    email: validatedData.email ?? undefined,
                    phone: validatedData.phone ?? undefined,
                    company: validatedData.company ?? undefined,
                    title: validatedData.title ?? undefined,
                    source: sanitizedContact.source || 'contacts_app',
                    is_imported: true,
                });
                importedContacts.push(importedContact);
            }
            console.log(`[Main] Successfully imported ${importedContacts.length} contacts`);
            return {
                success: true,
                contacts: importedContacts,
            };
        }
        catch (error) {
            console.error('[Main] Import contacts failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Get contacts sorted by recent activity and address relevance
    electron_1.ipcMain.handle('contacts:get-sorted-by-activity', async (event, userId, propertyAddress = null) => {
        try {
            console.log('[Main] Getting contacts sorted by activity for user:', userId, 'address:', propertyAddress);
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId); // Validated, will throw if invalid
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            // Validate propertyAddress (optional)
            const validatedAddress = propertyAddress
                ? (0, validation_1.validateString)(propertyAddress, 'propertyAddress', { required: false, maxLength: 500 })
                : undefined;
            // Get only imported contacts sorted by activity
            const importedContacts = await databaseService_1.default.getContactsSortedByActivity(validatedUserId, validatedAddress ?? undefined);
            console.log(`[Main] Returning ${importedContacts.length} imported contacts sorted by activity`);
            return {
                success: true,
                contacts: importedContacts,
            };
        }
        catch (error) {
            console.error('[Main] Get sorted contacts failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Create new contact
    electron_1.ipcMain.handle('contacts:create', async (event, userId, contactData) => {
        try {
            console.log('[Main] Creating contact:', contactData);
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId); // Validated, will throw if invalid
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            const validatedData = (0, validation_1.validateContactData)(contactData, false);
            const contact = await databaseService_1.default.createContact({
                user_id: validatedUserId,
                name: validatedData.name || 'Unknown',
                email: validatedData.email ?? undefined,
                phone: validatedData.phone ?? undefined,
                company: validatedData.company ?? undefined,
                title: validatedData.title ?? undefined,
                source: 'manual',
                is_imported: false,
            });
            return {
                success: true,
                contact,
            };
        }
        catch (error) {
            console.error('[Main] Create contact failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Update contact
    electron_1.ipcMain.handle('contacts:update', async (event, contactId, updates) => {
        try {
            console.log('[Main] Updating contact:', contactId, updates);
            // Validate inputs
            const validatedContactId = (0, validation_1.validateContactId)(contactId); // Validated, will throw if invalid
            if (!validatedContactId) {
                throw new validation_1.ValidationError('Contact ID validation failed', 'contactId');
            }
            const validatedUpdates = (0, validation_1.validateContactData)((0, validation_1.sanitizeObject)(updates || {}), true);
            // Convert null to undefined for TypeScript strict mode
            const updatesData = {
                ...validatedUpdates,
                name: validatedUpdates.name ?? undefined,
                email: validatedUpdates.email ?? undefined,
                phone: validatedUpdates.phone ?? undefined,
                company: validatedUpdates.company ?? undefined,
                title: validatedUpdates.title ?? undefined,
            };
            await databaseService_1.default.updateContact(validatedContactId, updatesData);
            const contact = await databaseService_1.default.getContactById(validatedContactId);
            return {
                success: true,
                contact: contact || undefined,
            };
        }
        catch (error) {
            console.error('[Main] Update contact failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Check if contact can be deleted (get associated transactions)
    electron_1.ipcMain.handle('contacts:checkCanDelete', async (event, contactId) => {
        try {
            console.log('[Main] Checking if contact can be deleted:', contactId);
            // Validate input
            const validatedContactId = (0, validation_1.validateContactId)(contactId); // Validated, will throw if invalid
            if (!validatedContactId) {
                throw new validation_1.ValidationError('Contact ID validation failed', 'contactId');
            }
            const transactions = await databaseService_1.default.getTransactionsByContact(validatedContactId);
            return {
                success: true,
                canDelete: transactions.length === 0,
                transactions: transactions,
                count: transactions.length
            };
        }
        catch (error) {
            console.error('[Main] Check can delete contact failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Delete contact
    electron_1.ipcMain.handle('contacts:delete', async (event, contactId) => {
        try {
            console.log('[Main] Deleting contact:', contactId);
            // Validate input
            const validatedContactId = (0, validation_1.validateContactId)(contactId); // Validated, will throw if invalid
            if (!validatedContactId) {
                throw new validation_1.ValidationError('Contact ID validation failed', 'contactId');
            }
            // Check if contact has associated transactions
            const check = await databaseService_1.default.getTransactionsByContact(validatedContactId);
            if (check.length > 0) {
                return {
                    success: false,
                    error: 'Cannot delete contact with associated transactions',
                    canDelete: false,
                    transactions: check,
                    count: check.length
                };
            }
            await databaseService_1.default.deleteContact(validatedContactId);
            return {
                success: true,
            };
        }
        catch (error) {
            console.error('[Main] Delete contact failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Remove contact from local database (un-import)
    electron_1.ipcMain.handle('contacts:remove', async (event, contactId) => {
        try {
            console.log('[Main] Removing contact from local database:', contactId);
            // Validate input
            const validatedContactId = (0, validation_1.validateContactId)(contactId); // Validated, will throw if invalid
            if (!validatedContactId) {
                throw new validation_1.ValidationError('Contact ID validation failed', 'contactId');
            }
            // Check if contact has associated transactions
            const check = await databaseService_1.default.getTransactionsByContact(validatedContactId);
            if (check.length > 0) {
                return {
                    success: false,
                    error: 'Cannot remove contact with associated transactions',
                    canDelete: false,
                    transactions: check,
                    count: check.length
                };
            }
            await databaseService_1.default.removeContact(validatedContactId);
            return {
                success: true,
            };
        }
        catch (error) {
            console.error('[Main] Remove contact failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
}
