import type {
  Transaction,
  NewTransaction,
  UpdateTransaction,
  NewCommunication,
  OAuthProvider,
  SuggestedTransaction,
  NewSuggestedTransaction,
  DetectedParty,
} from '../types';

import gmailFetchService from './gmailFetchService';
import outlookFetchService from './outlookFetchService';
import transactionExtractorService from './transactionExtractorService';
import databaseService from './databaseService';
import logService from './logService';

// ============================================
// TYPES
// ============================================

interface ScanOptions {
  provider?: OAuthProvider;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  onProgress?: (progress: ProgressUpdate) => void;
}

interface ProgressUpdate {
  step: 'fetching' | 'analyzing' | 'grouping' | 'saving' | 'complete';
  message: string;
}

interface ScanResult {
  success: boolean;
  transactionsFound: number;
  emailsScanned: number;
  realEstateEmailsFound: number;
  transactions: TransactionWithSummary[];
}

interface TransactionWithSummary extends Partial<Transaction> {
  id: string;
}

interface EmailFetchOptions {
  query?: string;
  after?: Date;
  before?: Date;
}

interface AnalyzedEmail {
  subject?: string;
  from: string;
  date: string | Date;
  isRealEstateRelated: boolean;
  keywords?: string;
  parties?: string;
  confidence?: number;
}

interface EmailMessage {
  subject?: string;
  from: string;
  date?: string | Date;
  to?: string;
  cc?: string;
  bcc?: string;
  body?: string;
  bodyPlain?: string;
  threadId?: string;
  hasAttachments?: boolean;
  attachmentCount?: number;
  attachments?: string;
}

interface TransactionSummary {
  propertyAddress: string;
  transactionType?: 'purchase' | 'sale';
  closingDate?: Date | string;
  communicationsCount: number;
  confidence?: number;
  firstCommunication: Date | string;
  lastCommunication: Date | string;
  salePrice?: number;
}

interface AddressComponents {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface ContactAssignment {
  contact_id: string;
  role: string;
  role_category: string;
  is_primary: boolean;
  notes?: string;
}

interface AuditedTransactionData {
  property_address: string;
  property_street?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  property_coordinates?: string;
  transaction_type?: 'purchase' | 'sale';
  contact_assignments?: ContactAssignment[];
}

interface ContactRoleUpdate {
  role?: string;
  role_category?: string;
  is_primary?: boolean;
  notes?: string;
}

interface DateRange {
  start?: Date;
  end?: Date;
}

interface ReanalysisResult {
  emailsFound: number;
  realEstateEmailsFound: number;
  analyzed: AnalyzedEmail[];
}

/**
 * Transaction Service
 * Orchestrates the entire transaction extraction workflow
 * Fetches emails → Analyzes → Extracts data → Saves to database
 */
class TransactionService {
  constructor() {}

  /**
   * Scan user's emails and extract transactions
   */
  async scanAndExtractTransactions(
    userId: string,
    options: ScanOptions = {}
  ): Promise<ScanResult> {
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

      await logService.info(`Fetched ${emails.length} emails`, 'TransactionService.scanAndExtractTransactions', { emailCount: emails.length, userId, provider });

      // Step 2: Analyze emails
      if (onProgress) onProgress({ step: 'analyzing', message: `Analyzing ${emails.length} emails...` });

      const analyzed = transactionExtractorService.batchAnalyze(emails);

      // Filter to only real estate related emails
      const realEstateEmails = analyzed.filter((a: any) => a.isRealEstateRelated);

      await logService.info(`Found ${realEstateEmails.length} real estate related emails`, 'TransactionService.scanAndExtractTransactions', { realEstateCount: realEstateEmails.length, totalEmails: emails.length });

      // Step 3: Group by property
      if (onProgress) onProgress({ step: 'grouping', message: 'Grouping by property...' });

      const grouped = transactionExtractorService.groupByProperty(realEstateEmails);
      const propertyAddresses = Object.keys(grouped);

      await logService.info(`Found ${propertyAddresses.length} properties`, 'TransactionService.scanAndExtractTransactions', { propertyCount: propertyAddresses.length });

      // Step 4: Create transactions and save communications
      if (onProgress) onProgress({ step: 'saving', message: 'Saving transactions...' });

      const transactions: TransactionWithSummary[] = [];
      const processedEmailIds = new Set<string>();

      // Create transactions from grouped emails
      for (const address of propertyAddresses) {
        const emailGroup = grouped[address];
        const summary = transactionExtractorService.generateTransactionSummary(emailGroup);

        // Create transaction in database if summary is valid
        if (!summary) continue;
        const transactionId = await this._createTransactionFromSummary(userId, summary);

        // Save communications and track them
        const savedCommIds = await this._saveCommunications(userId, transactionId, emailGroup as any, emails as any);
        savedCommIds.forEach(id => processedEmailIds.add(id));

        transactions.push({
          id: transactionId,
          ...summary,
        });
      }

      // Create suggested transactions for real estate emails that weren't grouped
      const ungroupedRealEstateEmails = realEstateEmails.filter(
        (email: any) => !processedEmailIds.has(email.subject + email.from) // Simple tracking
      );

      if (ungroupedRealEstateEmails.length > 0) {
        for (const email of ungroupedRealEstateEmails) {
          await this._createSuggestedTransaction(userId, email, emails as any);
        }
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
      await logService.error('Transaction scan failed', 'TransactionService.scanAndExtractTransactions', {
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
  private async _fetchEmails(
    userId: string,
    provider: OAuthProvider | undefined,
    options: EmailFetchOptions
  ): Promise<any[]> {
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
  private async _createTransactionFromSummary(
    userId: string,
    summary: any
  ): Promise<string> {
    // Parse address into components
    const addressParts = this._parseAddress(summary.propertyAddress);

    const transactionData: Partial<NewTransaction> = {
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

    const transaction = await databaseService.createTransaction(transactionData as NewTransaction);
    return transaction.id;
  }

  /**
   * Save communications to database and link to transaction
   * @private
   */
  private async _saveCommunications(
    userId: string,
    transactionId: string,
    analyzedEmails: any[],
    originalEmails: any[]
  ): Promise<string[]> {
    const savedIds: string[] = [];

    for (const analyzed of analyzedEmails) {
      // Find original email
      const originalEmail = originalEmails.find(
        (e: any) => e.subject === analyzed.subject && e.from === analyzed.from
      );

      if (!originalEmail) continue;

      const commData: Partial<NewCommunication> = {
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
        keywords_detected: JSON.stringify(analyzed.keywords || []),
        parties_involved: JSON.stringify(analyzed.parties || []),
        relevance_score: analyzed.confidence,
        flagged_for_review: false,
        is_compliance_related: analyzed.isRealEstateRelated || false,
      };

      const comm = await databaseService.createCommunication(commData as NewCommunication);
      savedIds.push(comm.id);
    }

    return savedIds;
  }

  /**
   * Create a suggested transaction from a real estate email
   * @private
   */
  private async _createSuggestedTransaction(
    userId: string,
    analyzedEmail: any,
    originalEmails: any[]
  ): Promise<void> {
    try {
      // Find original email data
      const originalEmail = originalEmails.find(
        (e: any) => e.subject === analyzedEmail.subject && e.from === analyzedEmail.from
      );

      if (!originalEmail) return;

      // Parse address if available
      const addresses = analyzedEmail.addresses || [];
      const addressParts = addresses.length > 0 ? this._parseAddress(addresses[0]) : { street: null, city: null, state: null, zip: null };

      // Extract parties
      const detectedParties: DetectedParty[] = (analyzedEmail.parties || []).map((party: any) => ({
        name: party.name || party.email || 'Unknown',
        email: party.email,
        role: party.role,
      }));

      // Prepare suggested transaction data
      const suggestedData: NewSuggestedTransaction = {
        user_id: userId,
        property_address: addresses.length > 0 ? addresses[0] : undefined,
        property_street: addressParts.street || undefined,
        property_city: addressParts.city || undefined,
        property_state: addressParts.state || undefined,
        property_zip: addressParts.zip || undefined,
        transaction_type: analyzedEmail.transactionType || undefined,
        first_communication_date: new Date(analyzedEmail.date).toISOString(),
        last_communication_date: new Date(analyzedEmail.date).toISOString(),
        communications_count: 1,
        extraction_confidence: analyzedEmail.confidence,
        sale_price: analyzedEmail.amounts && analyzedEmail.amounts.length > 0 ? Math.max(...analyzedEmail.amounts) : undefined,
        closing_date: analyzedEmail.dates && analyzedEmail.dates.length > 0 ? analyzedEmail.dates[0] : undefined,
        other_parties: detectedParties,
        detected_contacts: detectedParties,
        source_communication_ids: [originalEmail.id || (analyzedEmail.subject + analyzedEmail.from)],
        status: 'pending',
        reviewed_by_user: false,
      };

      await databaseService.createSuggestedTransaction(suggestedData);

      await logService.info(`Created suggested transaction from email`, 'TransactionService._createSuggestedTransaction', {
        userId,
        hasAddress: !!suggestedData.property_address,
        confidence: suggestedData.extraction_confidence,
      });
    } catch (error) {
      await logService.error(`Failed to create suggested transaction`, 'TransactionService._createSuggestedTransaction', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      // Don't throw - we want to continue scanning other emails
    }
  }

  /**
   * Parse address string into components
   * @private
   */
  private _parseAddress(addressString: string): AddressComponents {
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
  async getTransactions(userId: string): Promise<Transaction[]> {
    return await databaseService.getTransactions({ user_id: userId });
  }

  /**
   * Get transaction by ID with communications
   */
  async getTransactionDetails(transactionId: string): Promise<Transaction | null> {
    const transaction = await databaseService.getTransactionById(transactionId);

    if (!transaction) {
      return null;
    }

    const communications = await databaseService.getCommunicationsByTransaction(transactionId);
    const contact_assignments = await databaseService.getTransactionContacts(transactionId);

    return {
      ...transaction,
      communications,
      contact_assignments,
    } as any;
  }

  /**
   * Create manual transaction (user-entered)
   */
  async createManualTransaction(
    userId: string,
    transactionData: Partial<NewTransaction>
  ): Promise<Transaction> {
    const transaction = await databaseService.createTransaction({
      user_id: userId,
      property_address: transactionData.property_address!,
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
    } as NewTransaction);

    return transaction;
  }

  /**
   * Create audited transaction with contact assignments
   * Used for the "Audit New Transaction" feature
   */
  async createAuditedTransaction(
    userId: string,
    data: AuditedTransactionData
  ): Promise<Transaction | null> {
    try {
      const {
        property_address,
        property_street,
        property_city,
        property_state,
        property_zip,
        property_coordinates,
        transaction_type,
        contact_assignments,
      } = data;

      // Create the transaction
      const transaction = await databaseService.createTransaction({
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
      } as NewTransaction);
      const transactionId = transaction.id;

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
    } catch (error) {
      await logService.error('Failed to create audited transaction', 'TransactionService.createAuditedTransaction', {
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
  async getTransactionWithContacts(transactionId: string): Promise<Transaction | null> {
    const transaction = await databaseService.getTransactionById(transactionId);

    if (!transaction) {
      return null;
    }

    // Get all contact assignments
    const contactAssignments = await databaseService.getTransactionContacts(transactionId);

    return {
      ...transaction,
      contact_assignments: contactAssignments,
    } as any;
  }

  /**
   * Assign contact to transaction role
   */
  async assignContactToTransaction(
    transactionId: string,
    contactId: string,
    role: string,
    roleCategory: string,
    isPrimary: boolean = false,
    notes: string | null = null
  ): Promise<any> {
    return await databaseService.assignContactToTransaction(transactionId, {
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
  async removeContactFromTransaction(transactionId: string, contactId: string): Promise<void> {
    return await databaseService.unlinkContactFromTransaction(transactionId, contactId);
  }

  /**
   * Update contact role in transaction
   */
  async updateContactRole(
    transactionId: string,
    contactId: string,
    updates: ContactRoleUpdate
  ): Promise<any> {
    return await databaseService.updateContactRole(transactionId, contactId, {
      ...updates,
      role: updates.role || undefined,
    });
  }

  /**
   * Update transaction
   */
  async updateTransaction(transactionId: string, updates: Partial<UpdateTransaction>): Promise<any> {
    return await databaseService.updateTransaction(transactionId, updates);
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    await databaseService.deleteTransaction(transactionId);
  }

  /**
   * Re-analyze a specific property (rescan emails for that address)
   */
  async reanalyzeProperty(
    userId: string,
    provider: OAuthProvider,
    propertyAddress: string,
    dateRange: DateRange = {}
  ): Promise<ReanalysisResult> {
    const emails = await this._fetchEmails(userId, provider, {
      query: propertyAddress,
      after: dateRange.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      before: dateRange.end || new Date(),
    });

    const analyzed = transactionExtractorService.batchAnalyze(emails);
    const realEstateEmails = analyzed.filter((a: any) => a.isRealEstateRelated);

    return {
      emailsFound: emails.length,
      realEstateEmailsFound: realEstateEmails.length,
      analyzed: realEstateEmails as any,
    };
  }

  /**
   * Get all pending suggested transactions for a user
   */
  async getSuggestedTransactions(userId: string): Promise<SuggestedTransaction[]> {
    return await databaseService.getSuggestedTransactions(userId, 'pending');
  }

  /**
   * Get a specific suggested transaction
   */
  async getSuggestedTransactionById(id: string): Promise<SuggestedTransaction | null> {
    return await databaseService.getSuggestedTransactionById(id);
  }

  /**
   * Update a suggested transaction with user edits
   */
  async updateSuggestedTransaction(id: string, updates: Partial<SuggestedTransaction>): Promise<SuggestedTransaction> {
    return await databaseService.updateSuggestedTransaction(id, updates);
  }

  /**
   * Approve a suggested transaction and create a confirmed transaction
   */
  async approveSuggestedTransaction(suggestedId: string, transactionData: Partial<NewTransaction>): Promise<Transaction> {
    const suggestedTx = await this.getSuggestedTransactionById(suggestedId);
    if (!suggestedTx) {
      throw new Error(`Suggested transaction ${suggestedId} not found`);
    }

    // Merge suggested transaction data with user-provided updates
    const finalTransactionData: NewTransaction = {
      user_id: suggestedTx.user_id,
      property_address: transactionData.property_address || suggestedTx.property_address!,
      property_street: transactionData.property_street || suggestedTx.property_street,
      property_city: transactionData.property_city || suggestedTx.property_city,
      property_state: transactionData.property_state || suggestedTx.property_state,
      property_zip: transactionData.property_zip || suggestedTx.property_zip,
      transaction_type: transactionData.transaction_type || suggestedTx.transaction_type,
      transaction_status: transactionData.transaction_status || 'pending',
      status: transactionData.status || 'active',
      closing_date: transactionData.closing_date || suggestedTx.closing_date,
      closing_date_verified: false,
      communications_scanned: suggestedTx.communications_count || 0,
      extraction_confidence: suggestedTx.extraction_confidence,
      first_communication_date: suggestedTx.first_communication_date,
      last_communication_date: suggestedTx.last_communication_date,
      total_communications_count: suggestedTx.communications_count || 0,
      sale_price: transactionData.sale_price || suggestedTx.sale_price,
      other_parties: transactionData.other_parties || JSON.stringify(suggestedTx.other_parties || []),
      export_status: 'not_exported',
      export_count: 0,
      offer_count: 0,
      failed_offers_count: 0,
    };

    // Approve the suggested transaction and create the confirmed one
    return await databaseService.approveSuggestedTransaction(suggestedId, finalTransactionData);
  }

  /**
   * Reject a suggested transaction
   */
  async rejectSuggestedTransaction(id: string, reason?: string): Promise<void> {
    await databaseService.rejectSuggestedTransaction(id, reason);
  }
}

export default new TransactionService();
