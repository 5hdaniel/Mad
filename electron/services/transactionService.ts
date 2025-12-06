import type {
  Transaction,
  NewTransaction,
  UpdateTransaction,
  NewCommunication,
  OAuthProvider,
} from "../types";

import gmailFetchService from "./gmailFetchService";
import outlookFetchService from "./outlookFetchService";
import transactionExtractorService from "./transactionExtractorService";
import databaseService from "./databaseService";
import logService from "./logService";
import supabaseService from "./supabaseService";

// ============================================
// TYPES
// ============================================

interface FetchProgress {
  fetched: number;
  total: number;
  estimatedTotal?: number;
  percentage: number;
}

interface ProgressUpdate {
  step: "fetching" | "analyzing" | "grouping" | "saving" | "complete";
  message: string;
  fetchProgress?: FetchProgress;
}

interface ScanOptions {
  provider?: OAuthProvider;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  maxEmails?: number;
  onProgress?: (progress: ProgressUpdate) => void;
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
  maxResults?: number;
  onProgress?: (progress: FetchProgress) => void;
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
  transactionType?: "purchase" | "sale";
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
  transaction_type?: "purchase" | "sale";
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
  private scanCancelled: boolean = false;
  private currentScanUserId: string | null = null;

  constructor() {}

  /**
   * Cancel the current scan for a user
   */
  cancelScan(userId: string): boolean {
    if (this.currentScanUserId === userId) {
      this.scanCancelled = true;
      logService.info("Scan cancelled", "TransactionService.cancelScan", {
        userId,
      });
      return true;
    }
    return false;
  }

  /**
   * Check if scan was cancelled and throw if so
   */
  private checkCancelled(): void {
    if (this.scanCancelled) {
      throw new Error("Scan cancelled by user");
    }
  }

  /**
   * Scan user's emails and extract transactions
   */
  async scanAndExtractTransactions(
    userId: string,
    options: ScanOptions = {},
  ): Promise<ScanResult> {
    // Reset cancellation state and track current scan
    this.scanCancelled = false;
    this.currentScanUserId = userId;

    // Fetch user preferences for scan lookback
    let lookbackMonths = 9; // Default 9 months
    try {
      const preferences = await supabaseService.getPreferences(userId);
      if (preferences?.scan?.lookbackMonths) {
        lookbackMonths = preferences.scan.lookbackMonths;
      }
    } catch {
      // Use default if preferences unavailable
    }

    const defaultStartDate = new Date(
      Date.now() - lookbackMonths * 30 * 24 * 60 * 60 * 1000,
    );

    const {
      provider: requestedProvider,
      startDate = defaultStartDate,
      endDate = new Date(),
      searchQuery = "",
      maxEmails = 70000, // Default to fetching up to 70,000 emails
      onProgress = null,
    } = options;

    // Auto-detect providers if not specified
    const providers: OAuthProvider[] = [];
    if (requestedProvider) {
      providers.push(requestedProvider);
    } else {
      // Check which mailbox tokens exist for this user
      const googleToken = await databaseService.getOAuthToken(
        userId,
        "google",
        "mailbox",
      );
      const microsoftToken = await databaseService.getOAuthToken(
        userId,
        "microsoft",
        "mailbox",
      );

      if (googleToken?.access_token) {
        providers.push("google");
      }
      if (microsoftToken?.access_token) {
        providers.push("microsoft");
      }

      await logService.info(
        "Auto-detected email providers",
        "TransactionService.scanAndExtractTransactions",
        {
          userId,
          providers,
          googleConnected: !!googleToken?.access_token,
          microsoftConnected: !!microsoftToken?.access_token,
        },
      );

      if (providers.length === 0) {
        throw new Error(
          "No email provider connected. Please connect Gmail or Outlook first.",
        );
      }
    }

    try {
      // Step 1: Fetch emails from all connected providers
      const allEmails: any[] = [];

      for (let i = 0; i < providers.length; i++) {
        // Check for cancellation before each provider
        this.checkCancelled();

        const provider = providers[i];
        const providerName = provider === "google" ? "Gmail" : "Outlook";
        const providerPrefix =
          providers.length > 1
            ? `[${i + 1}/${providers.length}] ${providerName}: `
            : "";

        if (onProgress)
          onProgress({
            step: "fetching",
            message: `${providerPrefix}Fetching emails...`,
          });

        const emails = await this._fetchEmails(userId, provider, {
          query: searchQuery,
          after: startDate,
          before: endDate,
          maxResults: Math.floor(maxEmails / providers.length), // Split limit between providers
          onProgress: onProgress
            ? (fetchProgress: FetchProgress) => {
                // Check for cancellation during progress updates
                if (this.scanCancelled) {
                  throw new Error("Scan cancelled by user");
                }
                onProgress({
                  step: "fetching",
                  message: `${providerPrefix}Fetching emails... ${fetchProgress.fetched} of ${fetchProgress.total} (${fetchProgress.percentage}%)`,
                  fetchProgress,
                });
              }
            : undefined,
        });

        // Check for cancellation after fetching
        this.checkCancelled();

        allEmails.push(...emails);
        await logService.info(
          `Fetched ${emails.length} emails from ${providerName}`,
          "TransactionService.scanAndExtractTransactions",
          { emailCount: emails.length, userId, provider },
        );
      }

      const emails = allEmails;
      await logService.info(
        `Fetched ${emails.length} total emails from ${providers.length} provider(s)`,
        "TransactionService.scanAndExtractTransactions",
        { emailCount: emails.length, userId, providers },
      );

      // Check for cancellation before analysis
      this.checkCancelled();

      // Step 2: Analyze emails
      if (onProgress)
        onProgress({
          step: "analyzing",
          message: `Analyzing ${emails.length} emails...`,
        });

      const analyzed = transactionExtractorService.batchAnalyze(emails);

      // Filter to only real estate related emails
      const realEstateEmails = analyzed.filter(
        (a: any) => a.isRealEstateRelated,
      );

      await logService.info(
        `Found ${realEstateEmails.length} real estate related emails`,
        "TransactionService.scanAndExtractTransactions",
        {
          realEstateCount: realEstateEmails.length,
          totalEmails: emails.length,
        },
      );

      // Check for cancellation before grouping
      this.checkCancelled();

      // Step 3: Group by property
      if (onProgress)
        onProgress({ step: "grouping", message: "Grouping by property..." });

      const grouped =
        transactionExtractorService.groupByProperty(realEstateEmails);
      const propertyAddresses = Object.keys(grouped);

      await logService.info(
        `Found ${propertyAddresses.length} properties`,
        "TransactionService.scanAndExtractTransactions",
        { propertyCount: propertyAddresses.length },
      );

      // Check for cancellation before saving
      this.checkCancelled();

      // Step 4: Create transactions and save communications
      if (onProgress)
        onProgress({ step: "saving", message: "Saving transactions..." });

      const transactions: TransactionWithSummary[] = [];

      for (const address of propertyAddresses) {
        // Check for cancellation for each property save
        this.checkCancelled();

        const emailGroup = grouped[address];
        const summary =
          transactionExtractorService.generateTransactionSummary(emailGroup);

        // Create transaction in database if summary is valid
        if (!summary) continue;
        const transactionId = await this._createTransactionFromSummary(
          userId,
          summary,
        );

        // Save communications
        await this._saveCommunications(
          userId,
          transactionId,
          emailGroup as any,
          emails as any,
        );

        transactions.push({
          id: transactionId,
          ...summary,
        });
      }

      // Step 5: Complete
      if (onProgress)
        onProgress({ step: "complete", message: "Scan complete!" });

      return {
        success: true,
        transactionsFound: transactions.length,
        emailsScanned: emails.length,
        realEstateEmailsFound: realEstateEmails.length,
        transactions,
      };
    } catch (error) {
      // Check if this was a cancellation
      const isCancelled = this.scanCancelled;

      if (!isCancelled) {
        await logService.error(
          "Transaction scan failed",
          "TransactionService.scanAndExtractTransactions",
          {
            error: error instanceof Error ? error.message : String(error),
            userId,
            providers,
          },
        );
      }
      throw error;
    } finally {
      // Clear scan state
      this.currentScanUserId = null;
    }
  }

  /**
   * Fetch emails from provider
   * @private
   */
  private async _fetchEmails(
    userId: string,
    provider: OAuthProvider | undefined,
    options: EmailFetchOptions,
  ): Promise<any[]> {
    if (provider === "google") {
      await gmailFetchService.initialize(userId);
      return await gmailFetchService.searchEmails(options);
    } else if (provider === "microsoft") {
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
    summary: any,
  ): Promise<string> {
    // Parse address into components
    const addressParts = this._parseAddress(summary.propertyAddress);

    // Helper to convert date to ISO string safely
    const toISOString = (date: any): string | undefined => {
      if (!date) return undefined;
      if (date instanceof Date) return date.toISOString();
      if (typeof date === "string") return date;
      if (typeof date === "number") return new Date(date).toISOString();
      return undefined;
    };

    const transactionData: Partial<NewTransaction> = {
      user_id: userId,
      property_address: summary.propertyAddress,
      property_street: addressParts.street || undefined,
      property_city: addressParts.city || undefined,
      property_state: addressParts.state || undefined,
      property_zip: addressParts.zip || undefined,
      transaction_type: summary.transactionType,
      transaction_status: "completed",
      status: "active",
      closing_date: toISOString(summary.closingDate),
      closing_date_verified: false,
      communications_scanned: summary.communicationsCount || 0,
      extraction_confidence: summary.confidence,
      first_communication_date: toISOString(summary.firstCommunication),
      last_communication_date: toISOString(summary.lastCommunication),
      total_communications_count: summary.communicationsCount || 0,
      sale_price:
        typeof summary.salePrice === "number" ? summary.salePrice : undefined,
      export_status: "not_exported",
      export_count: 0,
      offer_count: 0,
      failed_offers_count: 0,
    };

    const transaction = await databaseService.createTransaction(
      transactionData as NewTransaction,
    );
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
    originalEmails: any[],
  ): Promise<void> {
    for (const analyzed of analyzedEmails) {
      // Find original email
      const originalEmail = originalEmails.find(
        (e: any) => e.subject === analyzed.subject && e.from === analyzed.from,
      );

      if (!originalEmail) continue;

      // Ensure dates are ISO strings
      const sentAt =
        analyzed.date instanceof Date
          ? analyzed.date.toISOString()
          : typeof analyzed.date === "string"
            ? analyzed.date
            : new Date().toISOString();

      const commData: Partial<NewCommunication> = {
        user_id: userId,
        transaction_id: transactionId,
        communication_type: "email",
        source: analyzed.from.includes("@gmail") ? "gmail" : "outlook",
        email_thread_id: originalEmail.threadId,
        sender: analyzed.from,
        recipients: originalEmail.to,
        cc: originalEmail.cc,
        bcc: originalEmail.bcc,
        subject: analyzed.subject,
        body: originalEmail.body,
        body_plain: originalEmail.bodyPlain,
        sent_at: sentAt,
        received_at: sentAt,
        has_attachments: originalEmail.hasAttachments || false,
        attachment_count: originalEmail.attachmentCount || 0,
        // Serialize arrays/objects for SQLite
        attachment_metadata: originalEmail.attachments
          ? JSON.stringify(originalEmail.attachments)
          : undefined,
        keywords_detected: Array.isArray(analyzed.keywords)
          ? JSON.stringify(analyzed.keywords)
          : analyzed.keywords,
        parties_involved: Array.isArray(analyzed.parties)
          ? JSON.stringify(analyzed.parties)
          : analyzed.parties,
        relevance_score: analyzed.confidence,
        flagged_for_review: false,
        is_compliance_related: analyzed.isRealEstateRelated || false,
      };

      await databaseService.createCommunication(commData as NewCommunication);
    }
  }

  /**
   * Parse address string into components
   * @private
   */
  private _parseAddress(addressString: string): AddressComponents {
    // Simple parsing - could be improved
    const parts = addressString.split(",").map((p) => p.trim());

    return {
      street: parts[0] || null,
      city: parts[1] || null,
      state: parts[2] ? parts[2].split(" ")[0] : null,
      zip: parts[2] ? parts[2].split(" ")[1] : null,
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
  async getTransactionDetails(
    transactionId: string,
  ): Promise<Transaction | null> {
    const transaction = await databaseService.getTransactionById(transactionId);

    if (!transaction) {
      return null;
    }

    const communications =
      await databaseService.getCommunicationsByTransaction(transactionId);
    const contact_assignments =
      await databaseService.getTransactionContacts(transactionId);

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
    transactionData: Partial<NewTransaction>,
  ): Promise<Transaction> {
    const transaction = await databaseService.createTransaction({
      user_id: userId,
      property_address: transactionData.property_address!,
      property_street: transactionData.property_street,
      property_city: transactionData.property_city,
      property_state: transactionData.property_state,
      property_zip: transactionData.property_zip,
      transaction_type: transactionData.transaction_type,
      transaction_status: "pending",
      status: transactionData.status || "active",
      representation_start_date: transactionData.representation_start_date,
      closing_date: transactionData.closing_date,
      closing_date_verified: false,
      representation_start_confidence: undefined,
      closing_date_confidence: undefined,
      export_status: "not_exported",
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
    data: AuditedTransactionData,
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
        transaction_status: "pending",
        status: "active",
        closing_date_verified: property_coordinates ? true : false,
        export_status: "not_exported",
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
      await logService.error(
        "Failed to create audited transaction",
        "TransactionService.createAuditedTransaction",
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          propertyAddress: data.property_address,
        },
      );
      throw error;
    }
  }

  /**
   * Get transaction with all assigned contacts
   */
  async getTransactionWithContacts(
    transactionId: string,
  ): Promise<Transaction | null> {
    const transaction = await databaseService.getTransactionById(transactionId);

    if (!transaction) {
      return null;
    }

    // Get all contact assignments
    const contactAssignments =
      await databaseService.getTransactionContacts(transactionId);

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
    notes: string | null = null,
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
  async removeContactFromTransaction(
    transactionId: string,
    contactId: string,
  ): Promise<void> {
    return await databaseService.unlinkContactFromTransaction(
      transactionId,
      contactId,
    );
  }

  /**
   * Update contact role in transaction
   */
  async updateContactRole(
    transactionId: string,
    contactId: string,
    updates: ContactRoleUpdate,
  ): Promise<any> {
    return await databaseService.updateContactRole(transactionId, contactId, {
      ...updates,
      role: updates.role || undefined,
    });
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    transactionId: string,
    updates: Partial<UpdateTransaction>,
  ): Promise<any> {
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
    dateRange: DateRange = {},
  ): Promise<ReanalysisResult> {
    const emails = await this._fetchEmails(userId, provider, {
      query: propertyAddress,
      after:
        dateRange.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
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
}

export default new TransactionService();
