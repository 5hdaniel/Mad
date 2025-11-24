"use strict";
const gmailFetchService = require('./gmailFetchService');
const outlookFetchService = require('./outlookFetchService');
const transactionExtractorService = require('./transactionExtractorService');
const databaseService = require('./databaseService');
/**
 * Transaction Service
 * Orchestrates the entire transaction extraction workflow
 * Fetches emails → Analyzes → Extracts data → Saves to database
 */
class TransactionService {
    constructor() { }
    /**
     * Scan user's emails and extract transactions
     */
    async scanAndExtractTransactions(userId, options = {}) {
        const { provider, startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Default 1 year back
        endDate = new Date(), searchQuery = '', onProgress = null, } = options;
        try {
            // Step 1: Fetch emails
            if (onProgress)
                onProgress({ step: 'fetching', message: 'Fetching emails...' });
            const emails = await this._fetchEmails(userId, provider, {
                query: searchQuery,
                after: startDate,
                before: endDate,
            });
            console.log(`[TransactionService] Fetched ${emails.length} emails`);
            // Step 2: Analyze emails
            if (onProgress)
                onProgress({ step: 'analyzing', message: `Analyzing ${emails.length} emails...` });
            const analyzed = transactionExtractorService.batchAnalyze(emails);
            // Filter to only real estate related emails
            const realEstateEmails = analyzed.filter((a) => a.isRealEstateRelated);
            console.log(`[TransactionService] Found ${realEstateEmails.length} real estate related emails`);
            // Step 3: Group by property
            if (onProgress)
                onProgress({ step: 'grouping', message: 'Grouping by property...' });
            const grouped = transactionExtractorService.groupByProperty(realEstateEmails);
            const propertyAddresses = Object.keys(grouped);
            console.log(`[TransactionService] Found ${propertyAddresses.length} properties`);
            // Step 4: Create transactions and save communications
            if (onProgress)
                onProgress({ step: 'saving', message: 'Saving transactions...' });
            const transactions = [];
            for (const address of propertyAddresses) {
                const emailGroup = grouped[address];
                const summary = transactionExtractorService.generateTransactionSummary(emailGroup);
                // Create transaction in database
                const transactionId = await this._createTransactionFromSummary(userId, summary);
                // Save communications
                await this._saveCommunications(userId, transactionId, emailGroup, emails);
                transactions.push({
                    id: transactionId,
                    ...summary,
                });
            }
            // Step 5: Complete
            if (onProgress)
                onProgress({ step: 'complete', message: 'Scan complete!' });
            return {
                success: true,
                transactionsFound: transactions.length,
                emailsScanned: emails.length,
                realEstateEmailsFound: realEstateEmails.length,
                transactions,
            };
        }
        catch (error) {
            console.error('[TransactionService] Scan failed:', error);
            throw error;
        }
    }
    /**
     * Fetch emails from provider
     * @private
     */
    async _fetchEmails(userId, provider, options) {
        if (provider === 'google') {
            await gmailFetchService.initialize(userId);
            return await gmailFetchService.searchEmails(options);
        }
        else if (provider === 'microsoft') {
            await outlookFetchService.initialize(userId);
            return await outlookFetchService.searchEmails(options);
        }
        else {
            throw new Error(`Unknown provider: ${provider}`);
        }
    }
    /**
     * Create transaction from extracted summary
     * @private
     */
    async _createTransactionFromSummary(userId, summary) {
        // Parse address into components
        const addressParts = this._parseAddress(summary.propertyAddress);
        const transactionData = {
            property_address: summary.propertyAddress,
            property_street: addressParts.street,
            property_city: addressParts.city,
            property_state: addressParts.state,
            property_zip: addressParts.zip,
            transaction_type: summary.transactionType,
            transaction_status: 'completed',
            closing_date: summary.closingDate,
            communications_scanned: summary.communicationsCount,
            extraction_confidence: summary.confidence,
            first_communication_date: new Date(summary.firstCommunication).toISOString(),
            last_communication_date: new Date(summary.lastCommunication).toISOString(),
            total_communications_count: summary.communicationsCount,
            sale_price: summary.salePrice,
        };
        return await databaseService.createTransaction(userId, transactionData);
    }
    /**
     * Save communications to database and link to transaction
     * @private
     */
    async _saveCommunications(userId, transactionId, analyzedEmails, originalEmails) {
        for (const analyzed of analyzedEmails) {
            // Find original email
            const originalEmail = originalEmails.find((e) => e.subject === analyzed.subject && e.from === analyzed.from);
            if (!originalEmail)
                continue;
            const commData = {
                transaction_id: transactionId,
                communication_type: 'email',
                source: analyzed.from.includes('@gmail') ? 'gmail' : 'outlook',
                email_thread_id: originalEmail.threadId,
                sender: analyzed.from,
                recipients: originalEmail.to,
                cc: originalEmail.cc,
                bcc: originalEmail.bcc,
                subject: analyzed.subject,
                body: originalEmail.body,
                body_plain: originalEmail.bodyPlain,
                sent_at: analyzed.date,
                received_at: analyzed.date,
                has_attachments: originalEmail.hasAttachments,
                attachment_count: originalEmail.attachmentCount,
                attachment_metadata: originalEmail.attachments,
                keywords_detected: analyzed.keywords,
                parties_involved: analyzed.parties,
                relevance_score: analyzed.confidence,
                is_compliance_related: analyzed.isRealEstateRelated,
            };
            await databaseService.saveCommunication(userId, commData);
        }
    }
    /**
     * Parse address string into components
     * @private
     */
    _parseAddress(addressString) {
        // Simple parsing - could be improved
        const parts = addressString.split(',').map((p) => p.trim());
        return {
            street: parts[0] || null,
            city: parts[1] || null,
            state: parts[2] ? parts[2].split(' ')[0] : null,
            zip: parts[2] ? parts[2].split(' ')[1] : null,
        };
    }
    /**
     * Get all transactions for a user
     */
    async getTransactions(userId) {
        return await databaseService.getTransactionsByUserId(userId);
    }
    /**
     * Get transaction by ID with communications
     */
    async getTransactionDetails(transactionId) {
        const transaction = await databaseService.getTransactionById(transactionId);
        if (!transaction) {
            return null;
        }
        const communications = await databaseService.getCommunicationsByTransactionId(transactionId);
        const contact_assignments = await databaseService.getTransactionContacts(transactionId);
        return {
            ...transaction,
            communications,
            contact_assignments,
        };
    }
    /**
     * Create manual transaction (user-entered)
     */
    async createManualTransaction(userId, transactionData) {
        const transactionId = await databaseService.createTransaction(userId, {
            property_address: transactionData.property_address,
            transaction_type: transactionData.transaction_type || null,
            status: transactionData.status || 'active',
            representation_start_date: transactionData.representation_start_date || null,
            closing_date: transactionData.closing_date || null,
            closing_date_verified: 0,
            representation_start_confidence: null,
            closing_date_confidence: null,
        });
        return await databaseService.getTransactionById(transactionId);
    }
    /**
     * Create audited transaction with contact assignments
     * Used for the "Audit New Transaction" feature
     */
    async createAuditedTransaction(userId, data) {
        try {
            const { property_address, property_street, property_city, property_state, property_zip, property_coordinates, transaction_type, contact_assignments, } = data;
            // Create the transaction
            const transactionId = await databaseService.createTransaction(userId, {
                property_address,
                property_street,
                property_city,
                property_state,
                property_zip,
                property_coordinates,
                transaction_type,
                status: 'active',
                closing_date_verified: property_coordinates ? 1 : 0, // Mark as verified if coordinates exist
            });
            // Assign all contacts
            if (contact_assignments && contact_assignments.length > 0) {
                for (const assignment of contact_assignments) {
                    await databaseService.assignContactToTransaction(transactionId, {
                        contact_id: assignment.contact_id,
                        role: assignment.role,
                        role_category: assignment.role_category,
                        specific_role: assignment.role,
                        is_primary: assignment.is_primary,
                        notes: assignment.notes,
                    });
                }
            }
            // Fetch the complete transaction with contacts
            return await this.getTransactionWithContacts(transactionId);
        }
        catch (error) {
            console.error('[TransactionService] Failed to create audited transaction:', error);
            throw error;
        }
    }
    /**
     * Get transaction with all assigned contacts
     */
    async getTransactionWithContacts(transactionId) {
        const transaction = await databaseService.getTransactionById(transactionId);
        if (!transaction) {
            return null;
        }
        // Get all contact assignments
        const contactAssignments = await databaseService.getTransactionContacts(transactionId);
        return {
            ...transaction,
            contact_assignments: contactAssignments,
        };
    }
    /**
     * Assign contact to transaction role
     */
    async assignContactToTransaction(transactionId, contactId, role, roleCategory, isPrimary = false, notes = null) {
        return await databaseService.assignContactToTransaction(transactionId, {
            contact_id: contactId,
            role: role,
            role_category: roleCategory,
            specific_role: role,
            is_primary: isPrimary ? 1 : 0,
            notes,
        });
    }
    /**
     * Remove contact from transaction
     */
    async removeContactFromTransaction(transactionId, contactId) {
        return await databaseService.removeContactFromTransaction(transactionId, contactId);
    }
    /**
     * Update contact role in transaction
     */
    async updateContactRole(transactionId, contactId, updates) {
        return await databaseService.updateContactRole(transactionId, contactId, updates);
    }
    /**
     * Update transaction
     */
    async updateTransaction(transactionId, updates) {
        return await databaseService.updateTransaction(transactionId, updates);
    }
    /**
     * Delete transaction
     */
    async deleteTransaction(transactionId) {
        await databaseService.deleteTransaction(transactionId);
    }
    /**
     * Re-analyze a specific property (rescan emails for that address)
     */
    async reanalyzeProperty(userId, provider, propertyAddress, dateRange = {}) {
        const emails = await this._fetchEmails(userId, provider, {
            query: propertyAddress,
            after: dateRange.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            before: dateRange.end || new Date(),
        });
        const analyzed = transactionExtractorService.batchAnalyze(emails);
        const realEstateEmails = analyzed.filter((a) => a.isRealEstateRelated);
        return {
            emailsFound: emails.length,
            realEstateEmailsFound: realEstateEmails.length,
            analyzed: realEstateEmails,
        };
    }
}
module.exports = new TransactionService();
