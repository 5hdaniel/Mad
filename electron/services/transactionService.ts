import type {
  Transaction,
  NewTransaction,
  UpdateTransaction,
  Communication,
  NewCommunication,
  OAuthProvider,
  Contact,
  Message,
} from "../types";

import gmailFetchService from "./gmailFetchService";
import outlookFetchService from "./outlookFetchService";
import transactionExtractorService from "./transactionExtractorService";
import databaseService from "./databaseService";
import logService from "./logService";
import supabaseService from "./supabaseService";
import { getContactNames } from "./contactsService";
import { createCommunicationReference } from "./messageMatchingService";
import { autoLinkCommunicationsForContact, AutoLinkResult } from "./autoLinkService";

// Hybrid extraction imports
import { HybridExtractorService } from "./extraction/hybridExtractorService";
import {
  ExtractionStrategyService,
  ExtractionStrategy,
} from "./extraction/extractionStrategyService";
import { LLMConfigService } from "./llm/llmConfigService";
import type {
  ExtractionMethod,
  DetectedTransaction,
  MessageInput,
} from "./extraction/types";

// ============================================
// TYPES
// ============================================

interface FetchProgress {
  fetched: number;
  total: number;
  estimatedTotal?: number;
  percentage: number;
  hasEstimate?: boolean;
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
 * Result of assigning a contact to a transaction
 * TASK-1031: Now includes auto-link results
 */
interface AssignContactResult {
  success: boolean;
  autoLink?: AutoLinkResult;
}

/**
 * Transaction Service
 * Orchestrates the entire transaction extraction workflow
 * Fetches emails → Analyzes → Extracts data → Saves to database
 */
class TransactionService {
  private scanCancelled: boolean = false;
  private currentScanUserId: string | null = null;

  // Lazy-initialized hybrid extraction services
  private hybridExtractor: HybridExtractorService | null = null;
  private strategyService: ExtractionStrategyService | null = null;
  private llmConfigService: LLMConfigService | null = null;

  constructor() {}

  /**
   * Lazy initialization of hybrid extraction services.
   * Avoids startup cost when LLM features are not used.
   */
  private getHybridServices(): {
    extractor: HybridExtractorService;
    strategy: ExtractionStrategyService;
    config: LLMConfigService;
  } {
    if (!this.llmConfigService) {
      this.llmConfigService = new LLMConfigService();
    }
    if (!this.strategyService) {
      this.strategyService = new ExtractionStrategyService(this.llmConfigService);
    }
    if (!this.hybridExtractor) {
      this.hybridExtractor = new HybridExtractorService(this.llmConfigService);
    }
    return {
      extractor: this.hybridExtractor,
      strategy: this.strategyService,
      config: this.llmConfigService,
    };
  }

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
      const savedLookback = preferences?.scan?.lookbackMonths;
      if (typeof savedLookback === "number" && savedLookback > 0) {
        lookbackMonths = savedLookback;
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
      // Track which providers we successfully fetched from (for updating last_sync_at later)
      const successfulProviders: OAuthProvider[] = [];

      for (let i = 0; i < providers.length; i++) {
        // Check for cancellation before each provider
        this.checkCancelled();

        const provider = providers[i];
        const providerName = provider === "google" ? "Gmail" : "Outlook";
        const providerPrefix =
          providers.length > 1
            ? `[${i + 1}/${providers.length}] ${providerName}: `
            : "";

        // Get last sync time for incremental fetch (TASK-906: Gmail, TASK-907: Outlook)
        let effectiveStartDate = startDate;
        const lastSyncAt = await databaseService.getOAuthTokenSyncTime(userId, provider);
        if (lastSyncAt) {
          // Use last sync time for incremental fetch
          effectiveStartDate = lastSyncAt;
          await logService.info(
            `Incremental sync: fetching emails since ${lastSyncAt.toISOString()}`,
            "TransactionService.scanAndExtractTransactions",
            { userId, provider, lastSyncAt: lastSyncAt.toISOString() },
          );
        } else {
          // First sync: use 90-day lookback (or user preference if shorter)
          const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          effectiveStartDate = startDate > ninetyDaysAgo ? startDate : ninetyDaysAgo;
          await logService.info(
            `First sync: fetching last 90 days of emails`,
            "TransactionService.scanAndExtractTransactions",
            { userId, provider, startDate: effectiveStartDate.toISOString() },
          );
        }

        if (onProgress)
          onProgress({
            step: "fetching",
            message: `${providerPrefix}Fetching emails...`,
          });

        const emails = await this._fetchEmails(userId, provider, {
          query: searchQuery,
          after: effectiveStartDate,
          before: endDate,
          maxResults: Math.floor(maxEmails / providers.length), // Split limit between providers
          onProgress: onProgress
            ? (fetchProgress: FetchProgress) => {
                // Check for cancellation during progress updates
                if (this.scanCancelled) {
                  throw new Error("Scan cancelled by user");
                }
                // Only show count details if we have a real estimate
                const message = fetchProgress.hasEstimate
                  ? `${providerPrefix}Fetching emails... ${fetchProgress.fetched} of ${fetchProgress.total} (${fetchProgress.percentage}%)`
                  : `${providerPrefix}Fetching emails... ${fetchProgress.fetched} found`;
                onProgress({
                  step: "fetching",
                  message,
                  fetchProgress,
                });
              }
            : undefined,
        });

        // Check for cancellation after fetching
        this.checkCancelled();

        allEmails.push(...emails);
        successfulProviders.push(provider);
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

      // Step 2: Determine extraction strategy
      const { strategy: strategyService } = this.getHybridServices();
      const strategy = await strategyService.selectStrategy(userId, {
        messageCount: emails.length,
      });

      await logService.info(
        `Using ${strategy.method} extraction strategy: ${strategy.reason}`,
        "TransactionService.scanAndExtractTransactions",
        {
          userId,
          method: strategy.method,
          provider: strategy.provider,
          budgetRemaining: strategy.budgetRemaining,
          estimatedTokenCost: strategy.estimatedTokenCost,
        },
      );

      // Step 3: Run extraction based on strategy
      let extractionResult: {
        detectedTransactions: (DetectedTransaction & { emails?: AnalyzedEmail[] })[];
        realEstateCount: number;
        extractionMethod: ExtractionMethod;
      };

      if (strategy.method === "pattern") {
        // Use pattern-only extraction path
        extractionResult = await this._patternOnlyExtraction(
          emails,
          userId,
          onProgress,
        );
      } else {
        // Use hybrid extraction (hybrid or llm mode)
        try {
          extractionResult = await this._hybridExtraction(
            emails,
            userId,
            strategy,
            onProgress,
          );
        } catch (hybridError) {
          // If hybrid extraction fails, fall back to pattern-only
          await logService.warn(
            "Hybrid extraction failed, falling back to pattern-only",
            "TransactionService.scanAndExtractTransactions",
            {
              error: hybridError instanceof Error ? hybridError.message : String(hybridError),
              userId,
            },
          );
          extractionResult = await this._patternOnlyExtraction(
            emails,
            userId,
            onProgress,
          );
        }
      }

      await logService.info(
        `Found ${extractionResult.realEstateCount} real estate related emails`,
        "TransactionService.scanAndExtractTransactions",
        {
          realEstateCount: extractionResult.realEstateCount,
          totalEmails: emails.length,
          extractionMethod: extractionResult.extractionMethod,
        },
      );

      // Check for cancellation before saving
      this.checkCancelled();

      // Step 4: Save transactions with detection metadata
      if (onProgress)
        onProgress({ step: "saving", message: "Saving transactions..." });

      const transactions = await this._saveDetectedTransactions(
        userId,
        extractionResult,
        emails,
      );

      await logService.info(
        `Found ${transactions.length} properties`,
        "TransactionService.scanAndExtractTransactions",
        {
          propertyCount: transactions.length,
          extractionMethod: extractionResult.extractionMethod,
        },
      );

      // Step 5: Update last_sync_at for successful providers (TASK-906: Gmail, TASK-907: Outlook)
      // This happens AFTER successful storage to ensure we don't skip emails on next sync
      const syncTime = new Date();
      for (const provider of successfulProviders) {
        await databaseService.updateOAuthTokenSyncTime(userId, provider, syncTime);
        await logService.info(
          `Updated last_sync_at for ${provider}`,
          "TransactionService.scanAndExtractTransactions",
          { userId, provider, syncTime: syncTime.toISOString() },
        );
      }

      // Step 6: Complete
      if (onProgress)
        onProgress({ step: "complete", message: "Scan complete!" });

      return {
        success: true,
        transactionsFound: transactions.length,
        emailsScanned: emails.length,
        realEstateEmailsFound: extractionResult.realEstateCount,
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
   * Skips emails that have been previously ignored/unlinked by the user
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

      // Check if this email was previously ignored by the user
      const isIgnored = await databaseService.isEmailIgnoredByUser(
        userId,
        analyzed.from || "",
        analyzed.subject || "",
        sentAt,
      );

      if (isIgnored) {
        await logService.debug(
          "Skipping previously ignored email",
          "TransactionService._saveCommunications",
          {
            subject: analyzed.subject,
            from: analyzed.from,
            sentAt,
          },
        );
        continue;
      }

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

  // ============================================
  // HYBRID EXTRACTION METHODS
  // ============================================

  /**
   * Hybrid extraction path using AI + pattern matching.
   * Uses HybridExtractorService for combined analysis.
   * @private
   */
  private async _hybridExtraction(
    emails: EmailMessage[],
    userId: string,
    strategy: ExtractionStrategy,
    onProgress: ((progress: ProgressUpdate) => void) | null,
  ): Promise<{
    detectedTransactions: DetectedTransaction[];
    realEstateCount: number;
    extractionMethod: ExtractionMethod;
  }> {
    const { extractor } = this.getHybridServices();

    if (onProgress) {
      onProgress({
        step: "analyzing",
        message: `Analyzing ${emails.length} emails with AI...`,
      });
    }

    // Prepare messages for hybrid extraction
    const messages: MessageInput[] = emails.map((email, i) => ({
      id: `msg_${i}_${Date.now()}`,
      subject: email.subject || "",
      body: email.bodyPlain || email.body || "",
      sender: email.from || "",
      recipients: (email.to || "").split(",").map((e: string) => e.trim()),
      date:
        email.date instanceof Date
          ? email.date.toISOString()
          : String(email.date || new Date().toISOString()),
    }));

    // Get existing transactions for context
    const existingTransactions = await databaseService.getTransactions({
      user_id: userId,
    });
    const txContext = existingTransactions.map((tx) => ({
      id: tx.id,
      propertyAddress: tx.property_address,
      transactionType: tx.transaction_type,
    }));

    // Get known contacts for role matching
    const contacts: Contact[] = await databaseService.getContacts({
      user_id: userId,
    });

    // Check for cancellation before LLM call
    this.checkCancelled();

    // Run hybrid extraction
    const result = await extractor.extract(messages, txContext, contacts, {
      usePatternMatching: true,
      useLLM: strategy.method !== "pattern",
      llmProvider: strategy.provider,
      userId,
    });

    // Check for cancellation after extraction
    this.checkCancelled();

    if (onProgress) {
      onProgress({
        step: "grouping",
        message: `Found ${result.detectedTransactions.length} potential transactions...`,
      });
    }

    const realEstateCount = result.analyzedMessages.filter(
      (m) => m.isRealEstateRelated,
    ).length;

    await logService.info(
      `Hybrid extraction completed`,
      "TransactionService._hybridExtraction",
      {
        userId,
        method: result.extractionMethod,
        llmUsed: result.llmUsed,
        transactionsFound: result.detectedTransactions.length,
        realEstateCount,
        latencyMs: result.latencyMs,
      },
    );

    return {
      detectedTransactions: result.detectedTransactions,
      realEstateCount,
      extractionMethod: result.extractionMethod,
    };
  }

  /**
   * Pattern-only extraction (existing behavior refactored).
   * Uses transactionExtractorService for pattern matching only.
   * @private
   */
  private async _patternOnlyExtraction(
    emails: EmailMessage[],
    _userId: string,
    onProgress: ((progress: ProgressUpdate) => void) | null,
  ): Promise<{
    detectedTransactions: (DetectedTransaction & { emails?: AnalyzedEmail[] })[];
    realEstateCount: number;
    extractionMethod: ExtractionMethod;
  }> {
    if (onProgress) {
      onProgress({
        step: "analyzing",
        message: `Analyzing ${emails.length} emails...`,
      });
    }

    // batchAnalyze expects Email[] with required date field
    // EmailMessage has optional date, so we provide a default
    const emailsWithDate = emails.map((email) => ({
      ...email,
      date: email.date || new Date().toISOString(),
    }));

    // batchAnalyze returns AnalysisResult[] from transactionExtractorService
    const analyzed = transactionExtractorService.batchAnalyze(emailsWithDate);
    const realEstateResults = analyzed.filter((a) => a.isRealEstateRelated);

    // Check for cancellation
    this.checkCancelled();

    if (onProgress) {
      onProgress({ step: "grouping", message: "Grouping by property..." });
    }

    const grouped = transactionExtractorService.groupByProperty(realEstateResults);

    // Convert to DetectedTransaction format for consistency
    const detectedTransactions: (DetectedTransaction & { emails?: AnalyzedEmail[] })[] = Object.entries(grouped)
      .map(([address, emailGroup]) => {
        const summary =
          transactionExtractorService.generateTransactionSummary(emailGroup);
        if (!summary) return null;

        // Convert AnalysisResult[] to AnalyzedEmail[] for communications saving
        // Handle both KeywordMatch[] (from actual service) and string (from test mocks)
        const analyzedEmails: AnalyzedEmail[] = emailGroup.map((result) => {
          // Handle keywords - could be KeywordMatch[] or string (legacy/mocks)
          let keywordsStr: string | undefined;
          if (Array.isArray(result.keywords)) {
            keywordsStr = result.keywords.map((k) => k.keyword).join(", ");
          } else if (typeof result.keywords === "string") {
            keywordsStr = result.keywords;
          }

          // Handle parties - could be Party[] or string (legacy/mocks)
          let partiesStr: string | undefined;
          if (Array.isArray(result.parties)) {
            partiesStr = result.parties.map((p) => p.name || p.email).join(", ");
          } else if (typeof result.parties === "string") {
            partiesStr = result.parties;
          }

          return {
            subject: result.subject,
            from: result.from || "",
            date: result.date,
            isRealEstateRelated: result.isRealEstateRelated,
            keywords: keywordsStr,
            parties: partiesStr,
            confidence: result.confidence,
          };
        });

        return {
          id: `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          propertyAddress: address,
          transactionType: summary.transactionType || null,
          stage: null,
          confidence: (summary.confidence || 0) / 100, // Normalize to 0-1
          extractionMethod: "pattern" as ExtractionMethod,
          communicationIds: [],
          dateRange: {
            start: new Date(summary.firstCommunication).toISOString(),
            end: new Date(summary.lastCommunication).toISOString(),
          },
          suggestedContacts: { assignments: [] },
          summary: `Transaction at ${address}`,
          patternSummary: {
            propertyAddress: summary.propertyAddress,
            transactionType: summary.transactionType,
            salePrice: summary.salePrice,
            closingDate: summary.closingDate
              ? typeof summary.closingDate === "string"
                ? summary.closingDate
                : new Date(summary.closingDate).toISOString()
              : null,
            mlsNumbers: summary.mlsNumbers || [],
            communicationsCount: summary.communicationsCount,
            firstCommunication: summary.firstCommunication,
            lastCommunication: summary.lastCommunication,
            confidence: summary.confidence || 0,
          },
          // Store emails for saving communications later
          emails: analyzedEmails,
        } as DetectedTransaction & { emails: AnalyzedEmail[] };
      })
      .filter((tx): tx is DetectedTransaction & { emails: AnalyzedEmail[] } => tx !== null);

    return {
      detectedTransactions,
      realEstateCount: realEstateResults.length,
      extractionMethod: "pattern",
    };
  }

  /**
   * Save detected transactions with detection metadata.
   * Sets detection_source, detection_status, detection_method, etc.
   * Includes deduplication to skip transactions that already exist (TASK-964).
   * @private
   */
  private async _saveDetectedTransactions(
    userId: string,
    extractionResult: {
      detectedTransactions: (DetectedTransaction & { emails?: AnalyzedEmail[] })[];
      realEstateCount: number;
      extractionMethod: ExtractionMethod;
    },
    originalEmails: EmailMessage[],
  ): Promise<TransactionWithSummary[]> {
    const transactions: TransactionWithSummary[] = [];

    // TASK-964: Batch lookup existing transactions for deduplication (prevents N+1 queries)
    const propertyAddresses = extractionResult.detectedTransactions.map(
      (tx) => tx.propertyAddress
    );
    const existingTransactions = await databaseService.findExistingTransactionsByAddresses(
      userId,
      propertyAddresses,
    );

    let skippedCount = 0;

    for (const detected of extractionResult.detectedTransactions) {
      // Check for cancellation for each transaction save
      this.checkCancelled();

      // TASK-964: Check for existing transaction (deduplication)
      const normalizedAddress = detected.propertyAddress.toLowerCase().trim();
      const existingTxId = existingTransactions.get(normalizedAddress);
      if (existingTxId) {
        skippedCount++;
        await logService.debug(
          "Skipping duplicate transaction import",
          "TransactionService._saveDetectedTransactions",
          {
            propertyAddress: detected.propertyAddress,
            existingTransactionId: existingTxId,
            userId,
          },
        );
        continue;
      }

      // Parse address components
      const addressParts = this._parseAddress(detected.propertyAddress);

      // Helper to convert date to ISO string safely
      const toISOString = (date: string | Date | number | undefined | null): string | undefined => {
        if (!date) return undefined;
        if (date instanceof Date) return date.toISOString();
        if (typeof date === "string") return date;
        if (typeof date === "number") return new Date(date).toISOString();
        return undefined;
      };

      // Map extraction method to detection_source
      // 'pattern' | 'llm' -> 'auto', 'hybrid' -> 'hybrid'
      const detectionSource: "manual" | "auto" | "hybrid" =
        extractionResult.extractionMethod === "hybrid" ? "hybrid" : "auto";

      // Map DetectedTransaction.transactionType to Transaction.transaction_type
      // DetectedTransaction uses 'purchase' | 'sale' | 'lease' | null
      // Transaction uses 'purchase' | 'sale' | 'other'
      let txType: "purchase" | "sale" | "other" | undefined;
      if (detected.transactionType === "purchase" || detected.transactionType === "sale") {
        txType = detected.transactionType;
      } else if (detected.transactionType === "lease") {
        txType = "other"; // Map lease to other
      } else {
        txType = undefined;
      }

      const transactionData: Partial<NewTransaction> = {
        user_id: userId,
        property_address: detected.propertyAddress,
        property_street: addressParts.street || undefined,
        property_city: addressParts.city || undefined,
        property_state: addressParts.state || undefined,
        property_zip: addressParts.zip || undefined,
        transaction_type: txType,
        transaction_status: "pending", // New from AI detection
        status: "active",
        closing_date: toISOString(detected.dateRange?.end),
        closing_date_verified: false,
        extraction_confidence: Math.round(detected.confidence * 100),
        first_communication_date: toISOString(detected.dateRange?.start),
        last_communication_date: toISOString(detected.dateRange?.end),
        total_communications_count: detected.communicationIds?.length || 0,
        export_status: "not_exported",
        export_count: 0,
        offer_count: 0,
        failed_offers_count: 0,
        // New AI detection fields
        detection_source: detectionSource,
        detection_status: "pending", // Awaiting user confirmation
        detection_confidence: detected.confidence,
        detection_method: extractionResult.extractionMethod,
        suggested_contacts: detected.suggestedContacts
          ? JSON.stringify(detected.suggestedContacts)
          : undefined,
      };

      const transaction = await databaseService.createTransaction(
        transactionData as NewTransaction,
      );

      // Save communications if available
      // For pattern extraction, emails are attached to detected transaction
      // For hybrid extraction, we need to find matching emails
      const emailsToSave = detected.emails || [];
      if (emailsToSave.length > 0) {
        await this._saveCommunications(
          userId,
          transaction.id,
          emailsToSave,
          originalEmails,
        );
      }

      // Create result - use transaction.id and omit detected.id to avoid duplication
      const { id: _detectedId, ...detectedWithoutId } = detected;
      transactions.push({
        id: transaction.id,
        ...detectedWithoutId,
      } as TransactionWithSummary);
    }

    // TASK-964: Log import summary including skipped duplicates
    if (skippedCount > 0 || transactions.length > 0) {
      await logService.info(
        "Transaction import completed",
        "TransactionService._saveDetectedTransactions",
        {
          userId,
          totalDetected: extractionResult.detectedTransactions.length,
          created: transactions.length,
          skippedDuplicates: skippedCount,
        },
      );
    }

    return transactions;
  }

  /**
   * Get all transactions for a user
   */
  async getTransactions(userId: string): Promise<Transaction[]> {
    return await databaseService.getTransactions({ user_id: userId });
  }

  /**
   * Get transaction by ID with communications and contact assignments
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
    // Use getTransactionContactsWithRoles to include contact_name, contact_phone, specific_role, etc.
    const contact_assignments =
      await databaseService.getTransactionContactsWithRoles(transactionId);

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
   * TASK-1031: Now auto-links communications for each assigned contact
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

      // Assign all contacts (skip auto-link during bulk assignment)
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

        // TASK-1031: Auto-link communications for all assigned contacts
        // Run after all contacts are assigned to avoid duplicate queries
        let totalEmailsLinked = 0;
        let totalMessagesLinked = 0;

        for (const assignment of contact_assignments) {
          try {
            const autoLinkResult = await autoLinkCommunicationsForContact({
              contactId: assignment.contact_id,
              transactionId,
            });
            totalEmailsLinked += autoLinkResult.emailsLinked;
            totalMessagesLinked += autoLinkResult.messagesLinked;
          } catch (error) {
            // Log but don't fail transaction creation if auto-link fails
            await logService.warn(
              `Auto-link failed for contact ${assignment.contact_id}: ${error instanceof Error ? error.message : "Unknown"}`,
              "TransactionService.createAuditedTransaction",
            );
          }
        }

        if (totalEmailsLinked > 0 || totalMessagesLinked > 0) {
          await logService.info(
            `Auto-linked ${totalEmailsLinked} emails and ${totalMessagesLinked} messages for new transaction`,
            "TransactionService.createAuditedTransaction",
            { transactionId, contactCount: contact_assignments.length },
          );
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

    // Get all contact assignments with role details (includes contact_name, contact_phone, specific_role, etc.)
    const contactAssignments =
      await databaseService.getTransactionContactsWithRoles(transactionId);

    return {
      ...transaction,
      contact_assignments: contactAssignments,
    } as any;
  }

  /**
   * Assign contact to transaction role
   * TASK-1031: Now auto-links existing communications (emails and texts)
   * from the contact to the transaction.
   *
   * @param transactionId - Transaction ID
   * @param contactId - Contact ID to assign
   * @param role - Role in the transaction
   * @param roleCategory - Role category
   * @param isPrimary - Whether this is the primary contact for this role
   * @param notes - Optional notes
   * @param skipAutoLink - If true, skip auto-linking (for bulk operations)
   * @returns Assignment result including auto-link counts
   */
  async assignContactToTransaction(
    transactionId: string,
    contactId: string,
    role: string,
    roleCategory: string,
    isPrimary: boolean = false,
    notes: string | null = null,
    skipAutoLink: boolean = false,
  ): Promise<AssignContactResult> {
    // 1. Save the contact assignment (existing behavior)
    await databaseService.assignContactToTransaction(transactionId, {
      contact_id: contactId,
      role: role,
      role_category: roleCategory,
      specific_role: role,
      is_primary: isPrimary ? 1 : 0,
      notes: notes || undefined,
    });

    // 2. Auto-link communications for this contact (TASK-1031)
    // Skip for bulk operations to avoid performance issues
    if (skipAutoLink) {
      return { success: true };
    }

    try {
      const autoLinkResult = await autoLinkCommunicationsForContact({
        contactId,
        transactionId,
      });

      return {
        success: true,
        autoLink: autoLinkResult,
      };
    } catch (error) {
      // Log but don't fail the assignment if auto-link fails
      await logService.warn(
        `Auto-link failed after contact assignment: ${error instanceof Error ? error.message : "Unknown"}`,
        "TransactionService.assignContactToTransaction",
        { transactionId, contactId },
      );

      return { success: true };
    }
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
   * Batch update contact assignments for a transaction
   * Performs multiple add/remove operations in a single atomic transaction
   */
  async batchUpdateContactAssignments(
    transactionId: string,
    operations: Array<{
      action: "add" | "remove";
      contactId: string;
      role?: string;
      roleCategory?: string;
      specificRole?: string;
      isPrimary?: boolean;
      notes?: string;
    }>,
  ): Promise<void> {
    return await databaseService.batchUpdateContactAssignments(
      transactionId,
      operations,
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
   * Unlink a communication (email) from a transaction
   * This adds the email to the ignored list and removes it from the transaction
   */
  async unlinkCommunication(
    communicationId: string,
    reason?: string,
  ): Promise<void> {
    // Get the communication details first
    const communication =
      await databaseService.getCommunicationById(communicationId);

    if (!communication) {
      throw new Error("Communication not found");
    }

    if (!communication.transaction_id) {
      throw new Error("Communication is not linked to a transaction");
    }

    // Add to ignored communications list
    await databaseService.addIgnoredCommunication({
      user_id: communication.user_id,
      transaction_id: communication.transaction_id,
      email_subject: communication.subject,
      email_sender: communication.sender,
      email_sent_at:
        communication.sent_at instanceof Date
          ? communication.sent_at.toISOString()
          : communication.sent_at,
      email_thread_id: communication.email_thread_id,
      original_communication_id: communicationId,
      reason: reason || "Manually unlinked by user",
    });

    // Delete the communication from the database
    await databaseService.deleteCommunication(communicationId);

    // Update the transaction's communication count
    const transaction = await databaseService.getTransactionById(
      communication.transaction_id,
    );
    if (transaction) {
      const newCount = Math.max(0, (transaction.total_communications_count || 0) - 1);
      await databaseService.updateTransaction(communication.transaction_id, {
        total_communications_count: newCount,
      });
    }

    await logService.info(
      "Communication unlinked from transaction",
      "TransactionService.unlinkCommunication",
      {
        communicationId,
        transactionId: communication.transaction_id,
        reason,
      },
    );
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

  /**
   * Get unlinked messages for a user (messages not attached to any transaction)
   * Queries the messages table directly for SMS/iMessage channels
   */
  async getUnlinkedMessages(userId: string): Promise<Message[]> {
    // Query messages table directly - much cleaner than filtering communications
    const messages = await databaseService.getUnlinkedTextMessages(userId);

    await logService.info(
      "Retrieved unlinked messages",
      "TransactionService.getUnlinkedMessages",
      {
        userId,
        count: messages.length,
      },
    );

    return messages;
  }

  /**
   * Get unlinked emails for a user
   */
  async getUnlinkedEmails(userId: string): Promise<Message[]> {
    const emails = await databaseService.getUnlinkedEmails(userId);

    await logService.info(
      "Retrieved unlinked emails",
      "TransactionService.getUnlinkedEmails",
      {
        userId,
        count: emails.length,
      },
    );

    return emails;
  }

  /**
   * Get distinct contacts with unlinked message counts
   * Returns a list of phone numbers/contacts with their message counts
   */
  async getMessageContacts(userId: string): Promise<{ contact: string; contactName: string | null; messageCount: number; lastMessageAt: string }[]> {
    const contacts = await databaseService.getMessageContacts(userId);

    // Resolve contact names from the macOS Contacts database
    let contactNameMap: Record<string, string> = {};
    try {
      const { contactMap } = await getContactNames();
      contactNameMap = contactMap;
    } catch (err) {
      await logService.warn(
        "Failed to load contact names, will use phone numbers only",
        "TransactionService.getMessageContacts",
        { error: err instanceof Error ? err.message : String(err) },
      );
    }

    // Enrich contacts with names
    const enrichedContacts = contacts.map((c) => {
      // Try to find name by phone number (normalized and raw)
      const name = contactNameMap[c.contact] || contactNameMap[c.contact.replace(/\D/g, '')] || null;
      return {
        ...c,
        contactName: name,
      };
    });

    await logService.info(
      "Retrieved message contacts",
      "TransactionService.getMessageContacts",
      {
        userId,
        contactCount: contacts.length,
        withNames: enrichedContacts.filter(c => c.contactName).length,
      },
    );

    return enrichedContacts;
  }

  /**
   * Get unlinked messages for a specific contact
   * Used after user selects a contact from the contact list
   */
  async getMessagesByContact(userId: string, contact: string): Promise<Message[]> {
    const messages = await databaseService.getMessagesByContact(userId, contact);

    await logService.info(
      "Retrieved messages for contact",
      "TransactionService.getMessagesByContact",
      {
        userId,
        contact,
        count: messages.length,
      },
    );

    return messages;
  }

  /**
   * Link messages to a transaction
   * Sets transaction_id on the specified messages in the messages table
   */
  async linkMessages(messageIds: string[], transactionId: string): Promise<void> {
    // Verify transaction exists
    const transaction = await this.getTransactionDetails(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    let linkedCount = 0;

    // Update each message and create communication reference
    for (const messageId of messageIds) {
      // Update messages table
      await databaseService.linkMessageToTransaction(messageId, transactionId);

      // Create communication reference so it shows in getDetails
      const refId = await createCommunicationReference(
        messageId,
        transactionId,
        transaction.user_id,
        "manual", // Manual link from UI
        1.0 // Full confidence for manual links
      );

      if (refId) {
        linkedCount++;
      }
    }

    // Update transaction message count
    const newCount = (transaction.message_count || 0) + linkedCount;
    await databaseService.updateTransaction(transactionId, {
      message_count: newCount,
    });

    await logService.info(
      "Messages linked to transaction",
      "TransactionService.linkMessages",
      {
        messageIds,
        transactionId,
        linkedCount,
      },
    );
  }

  /**
   * Unlink messages from a transaction (sets transaction_id to null)
   * Does NOT add to ignored communications - simply removes the link
   */
  async unlinkMessages(messageIds: string[]): Promise<void> {
    // Get transaction IDs for updating counts later
    const transactionCounts = new Map<string, number>();

    for (const messageId of messageIds) {
      const message = await databaseService.getMessageById(messageId);
      if (message?.transaction_id) {
        const count = transactionCounts.get(message.transaction_id) || 0;
        transactionCounts.set(message.transaction_id, count + 1);
      }

      // Remove the transaction link from messages table
      await databaseService.unlinkMessageFromTransaction(messageId);
    }

    // Update transaction message counts
    for (const [transactionId, unlinkedCount] of transactionCounts) {
      const transaction = await this.getTransactionDetails(transactionId);
      if (transaction) {
        const newCount = Math.max(0, (transaction.message_count || 0) - unlinkedCount);
        await databaseService.updateTransaction(transactionId, {
          message_count: newCount,
        });
      }
    }

    await logService.info(
      "Messages unlinked from transaction",
      "TransactionService.unlinkMessages",
      {
        messageIds,
        unlinkedCount: messageIds.length,
      },
    );
  }
}

export default new TransactionService();
