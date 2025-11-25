"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const gmailFetchService_1 = __importDefault(require("./gmailFetchService"));
const outlookFetchService_1 = __importDefault(require("./outlookFetchService"));
const transactionExtractorService_1 = __importDefault(require("./transactionExtractorService"));
const databaseService_1 = __importDefault(require("./databaseService"));
const logService_1 = __importDefault(require("./logService"));
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
            await logService_1.default.info(`Fetched ${emails.length} emails`, 'TransactionService.scanAndExtractTransactions', { emailCount: emails.length, userId, provider });
            // Step 2: Analyze emails
            if (onProgress)
                onProgress({ step: 'analyzing', message: `Analyzing ${emails.length} emails...` });
            const analyzed = transactionExtractorService_1.default.batchAnalyze(emails);
            // Filter to only real estate related emails
            const realEstateEmails = analyzed.filter((a) => a.isRealEstateRelated);
            await logService_1.default.info(`Found ${realEstateEmails.length} real estate related emails`, 'TransactionService.scanAndExtractTransactions', { realEstateCount: realEstateEmails.length, totalEmails: emails.length });
            // Step 3: Group by property
            if (onProgress)
                onProgress({ step: 'grouping', message: 'Grouping by property...' });
            const grouped = transactionExtractorService_1.default.groupByProperty(realEstateEmails);
            const propertyAddresses = Object.keys(grouped);
            await logService_1.default.info(`Found ${propertyAddresses.length} properties`, 'TransactionService.scanAndExtractTransactions', { propertyCount: propertyAddresses.length });
            // Step 4: Create transactions and save communications
            if (onProgress)
                onProgress({ step: 'saving', message: 'Saving transactions...' });
            const transactions = [];
            for (const address of propertyAddresses) {
                const emailGroup = grouped[address];
                const summary = transactionExtractorService_1.default.generateTransactionSummary(emailGroup);
                // Create transaction in database if summary is valid
                if (!summary)
                    continue;
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
            await logService_1.default.error('Transaction scan failed', 'TransactionService.scanAndExtractTransactions', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                provider,
            });
            throw error;
        }
    }
    /**
     * Fetch emails from provider
     * @private
     */
    async _fetchEmails(userId, provider, options) {
        if (provider === 'google') {
            await gmailFetchService_1.default.initialize(userId);
            return await gmailFetchService_1.default.searchEmails(options);
        }
        else if (provider === 'microsoft') {
            await outlookFetchService_1.default.initialize(userId);
            return await outlookFetchService_1.default.searchEmails(options);
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
            user_id: userId,
            property_address: summary.propertyAddress,
            property_street: addressParts.street || undefined,
            property_city: addressParts.city || undefined,
            property_state: addressParts.state || undefined,
            property_zip: addressParts.zip || undefined,
            transaction_type: summary.transactionType,
            transaction_status: 'completed',
            status: 'active',
            closing_date: summary.closingDate || undefined,
            closing_date_verified: false,
            communications_scanned: summary.communicationsCount || 0,
            extraction_confidence: summary.confidence,
            first_communication_date: new Date(summary.firstCommunication).toISOString(),
            last_communication_date: new Date(summary.lastCommunication).toISOString(),
            total_communications_count: summary.communicationsCount || 0,
            sale_price: summary.salePrice,
            export_status: 'not_exported',
            export_count: 0,
            offer_count: 0,
            failed_offers_count: 0,
        };
        const transaction = await databaseService_1.default.createTransaction(transactionData);
        return transaction.id;
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
                user_id: userId,
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
                has_attachments: originalEmail.hasAttachments || false,
                attachment_count: originalEmail.attachmentCount || 0,
                attachment_metadata: originalEmail.attachments,
                keywords_detected: analyzed.keywords,
                parties_involved: analyzed.parties,
                relevance_score: analyzed.confidence,
                flagged_for_review: false,
                is_compliance_related: analyzed.isRealEstateRelated || false,
            };
            await databaseService_1.default.createCommunication(commData);
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
        return await databaseService_1.default.getTransactions({ user_id: userId });
    }
    /**
     * Get transaction by ID with communications
     */
    async getTransactionDetails(transactionId) {
        const transaction = await databaseService_1.default.getTransactionById(transactionId);
        if (!transaction) {
            return null;
        }
        const communications = await databaseService_1.default.getCommunicationsByTransaction(transactionId);
        const contact_assignments = await databaseService_1.default.getTransactionContacts(transactionId);
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
        const transaction = await databaseService_1.default.createTransaction({
            user_id: userId,
            property_address: transactionData.property_address,
            property_street: transactionData.property_street,
            property_city: transactionData.property_city,
            property_state: transactionData.property_state,
            property_zip: transactionData.property_zip,
            transaction_type: transactionData.transaction_type,
            transaction_status: 'pending',
            status: transactionData.status || 'active',
            representation_start_date: transactionData.representation_start_date,
            closing_date: transactionData.closing_date,
            closing_date_verified: false,
            representation_start_confidence: undefined,
            closing_date_confidence: undefined,
            export_status: 'not_exported',
            export_count: 0,
            communications_scanned: 0,
            total_communications_count: 0,
            offer_count: 0,
            failed_offers_count: 0,
        });
        return transaction;
    }
    /**
     * Create audited transaction with contact assignments
     * Used for the "Audit New Transaction" feature
     */
    async createAuditedTransaction(userId, data) {
        try {
            const { property_address, property_street, property_city, property_state, property_zip, property_coordinates, transaction_type, contact_assignments, } = data;
            // Create the transaction
            const transaction = await databaseService_1.default.createTransaction({
                user_id: userId,
                property_address,
                property_street,
                property_city,
                property_state,
                property_zip,
                property_coordinates,
                transaction_type,
                transaction_status: 'pending',
                status: 'active',
                closing_date_verified: property_coordinates ? true : false,
                export_status: 'not_exported',
                export_count: 0,
                communications_scanned: 0,
                total_communications_count: 0,
                offer_count: 0,
                failed_offers_count: 0,
            });
            const transactionId = transaction.id;
            // Assign all contacts
            if (contact_assignments && contact_assignments.length > 0) {
                for (const assignment of contact_assignments) {
                    await databaseService_1.default.assignContactToTransaction(transactionId, {
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
            await logService_1.default.error('Failed to create audited transaction', 'TransactionService.createAuditedTransaction', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                propertyAddress: data.property_address,
            });
            throw error;
        }
    }
    /**
     * Get transaction with all assigned contacts
     */
    async getTransactionWithContacts(transactionId) {
        const transaction = await databaseService_1.default.getTransactionById(transactionId);
        if (!transaction) {
            return null;
        }
        // Get all contact assignments
        const contactAssignments = await databaseService_1.default.getTransactionContacts(transactionId);
        return {
            ...transaction,
            contact_assignments: contactAssignments,
        };
    }
    /**
     * Assign contact to transaction role
     */
    async assignContactToTransaction(transactionId, contactId, role, roleCategory, isPrimary = false, notes = null) {
        return await databaseService_1.default.assignContactToTransaction(transactionId, {
            contact_id: contactId,
            role: role,
            role_category: roleCategory,
            specific_role: role,
            is_primary: isPrimary ? 1 : 0,
            notes: notes || undefined,
        });
    }
    /**
     * Remove contact from transaction
     */
    async removeContactFromTransaction(transactionId, contactId) {
        return await databaseService_1.default.unlinkContactFromTransaction(transactionId, contactId);
    }
    /**
     * Update contact role in transaction
     */
    async updateContactRole(transactionId, contactId, updates) {
        return await databaseService_1.default.updateContactRole(transactionId, contactId, {
            ...updates,
            role: updates.role || undefined,
        });
    }
    /**
     * Update transaction
     */
    async updateTransaction(transactionId, updates) {
        return await databaseService_1.default.updateTransaction(transactionId, updates);
    }
    /**
     * Delete transaction
     */
    async deleteTransaction(transactionId) {
        await databaseService_1.default.deleteTransaction(transactionId);
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
        const analyzed = transactionExtractorService_1.default.batchAnalyze(emails);
        const realEstateEmails = analyzed.filter((a) => a.isRealEstateRelated);
        return {
            emailsFound: emails.length,
            realEstateEmailsFound: realEstateEmails.length,
            analyzed: realEstateEmails,
        };
    }
}
exports.default = new TransactionService();
