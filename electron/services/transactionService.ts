import type {
  Transaction,
  NewTransaction,
  UpdateTransaction,
  OAuthProvider,
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
  subject: string;
  from: string;
  date: string | Date;
  isRealEstateRelated: boolean;
  keywords?: string;
  parties?: string;
  confidence?: number;
}

interface EmailMessage {
  subject: string;
  from: string;
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
      const realEstateEmails = analyzed.filter((a: AnalyzedEmail) => a.isRealEstateRelated);

      await logService.info(`Found ${realEstateEmails.length} real estate related emails`, 'TransactionService.scanAndExtractTransactions', { realEstateCount: realEstateEmails.length, totalEmails: emails.length });

      // Step 3: Group by property
      if (onProgress) onProgress({ step: 'grouping', message: 'Grouping by property...' });

      const grouped = transactionExtractorService.groupByProperty(realEstateEmails);
      const propertyAddresses = Object.keys(grouped);

      await logService.info(`Found ${propertyAddresses.length} properties`, 'TransactionService.scanAndExtractTransactions', { propertyCount: propertyAddresses.length });

      // Step 4: Create transactions and save communications
      if (onProgress) onProgress({ step: 'saving', message: 'Saving transactions...' });

      const transactions: TransactionWithSummary[] = [];

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
  ): Promise<EmailMessage[]> {
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
    summary: TransactionSummary
  ): Promise<string> {
    // Parse address into components
    const addressParts = this._parseAddress(summary.propertyAddress);

    const transactionData = {
      user_id: userId,
      property_address: summary.propertyAddress,
      property_street: addressParts.street,
      property_city: addressParts.city,
      property_state: addressParts.state,
      property_zip: addressParts.zip,
      transaction_type: summary.transactionType,
      transaction_status: 'completed' as const,
      closing_date: summary.closingDate,
      communications_scanned: summary.communicationsCount,
      extraction_confidence: summary.confidence,
      first_communication_date: new Date(summary.firstCommunication).toISOString(),
      last_communication_date: new Date(summary.lastCommunication).toISOString(),
      total_communications_count: summary.communicationsCount,
      sale_price: summary.salePrice,
    };

    const transaction = await databaseService.createTransaction(transactionData);
    return transaction.id;
  }

  /**
   * Save communications to database and link to transaction
   * @private
   */
  private async _saveCommunications(
    userId: string,
    transactionId: string,
    analyzedEmails: AnalyzedEmail[],
    originalEmails: EmailMessage[]
  ): Promise<void> {
    for (const analyzed of analyzedEmails) {
      // Find original email
      const originalEmail = originalEmails.find(
        (e) => e.subject === analyzed.subject && e.from === analyzed.from
      );

      if (!originalEmail) continue;

      const commData = {
        user_id: userId,
        transaction_id: transactionId,
        communication_type: 'email' as const,
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

      await databaseService.createCommunication(commData);
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
    };
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
      property_address: transactionData.property_address,
      transaction_type: transactionData.transaction_type || null,
      status: transactionData.status || 'active',
      representation_start_date: transactionData.representation_start_date || null,
      closing_date: transactionData.closing_date || null,
      closing_date_verified: 0,
      representation_start_confidence: null,
      closing_date_confidence: null,
    });

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
        status: 'active',
        closing_date_verified: property_coordinates ? 1 : 0, // Mark as verified if coordinates exist
      });
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
    };
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
      notes,
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
    return await databaseService.updateContactRole(transactionId, contactId, updates);
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
    const realEstateEmails = analyzed.filter((a: AnalyzedEmail) => a.isRealEstateRelated);

    return {
      emailsFound: emails.length,
      realEstateEmailsFound: realEstateEmails.length,
      analyzed: realEstateEmails,
    };
  }
}

export default new TransactionService();
