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
  constructor() {}

  /**
   * Scan user's emails and extract transactions
   * @param {string} userId - User ID
   * @param {Object} options - Scan options
   * @param {string} options.provider - 'google' or 'microsoft'
   * @param {Date} options.startDate - Start date for email search
   * @param {Date} options.endDate - End date for email search
   * @param {string} options.searchQuery - Additional search query
   * @param {function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Scan results
   */
  async scanAndExtractTransactions(userId, options = {}) {
    const {
      provider,
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Default 1 year back
      endDate = new Date(),
      searchQuery = '',
      onProgress = null,
    } = options;

    try {
      // Step 1: Fetch emails
      if (onProgress) onProgress({ step: 'fetching', message: 'Fetching emails...' });

      const emails = await this._fetchEmails(userId, provider, {
        query: searchQuery,
        after: startDate,
        before: endDate,
      });

      console.log(`[TransactionService] Fetched ${emails.length} emails`);

      // Step 2: Analyze emails
      if (onProgress) onProgress({ step: 'analyzing', message: `Analyzing ${emails.length} emails...` });

      const analyzed = transactionExtractorService.batchAnalyze(emails);

      // Filter to only real estate related emails
      const realEstateEmails = analyzed.filter(a => a.isRealEstateRelated);

      console.log(`[TransactionService] Found ${realEstateEmails.length} real estate related emails`);

      // Step 3: Group by property
      if (onProgress) onProgress({ step: 'grouping', message: 'Grouping by property...' });

      const grouped = transactionExtractorService.groupByProperty(realEstateEmails);
      const propertyAddresses = Object.keys(grouped);

      console.log(`[TransactionService] Found ${propertyAddresses.length} properties`);

      // Step 4: Create transactions and save communications
      if (onProgress) onProgress({ step: 'saving', message: 'Saving transactions...' });

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
      if (onProgress) onProgress({ step: 'complete', message: 'Scan complete!' });

      return {
        success: true,
        transactionsFound: transactions.length,
        emailsScanned: emails.length,
        realEstateEmailsFound: realEstateEmails.length,
        transactions,
      };
    } catch (error) {
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
    } else if (provider === 'microsoft') {
      await outlookFetchService.initialize(userId);
      return await outlookFetchService.searchEmails(options);
    } else {
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
      const originalEmail = originalEmails.find(e => e.subject === analyzed.subject && e.from === analyzed.from);

      if (!originalEmail) continue;

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
    const parts = addressString.split(',').map(p => p.trim());

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

    return {
      ...transaction,
      communications,
    };
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
    const realEstateEmails = analyzed.filter(a => a.isRealEstateRelated);

    return {
      emailsFound: emails.length,
      realEstateEmailsFound: realEstateEmails.length,
      analyzed: realEstateEmails,
    };
  }
}

module.exports = new TransactionService();
