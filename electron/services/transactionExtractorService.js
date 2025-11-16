const crypto = require('crypto');

/**
 * Transaction Extractor Service
 * Analyzes emails and extracts real estate transaction data
 * Uses pattern matching and keyword detection
 */
class TransactionExtractorService {
  constructor() {
    // Real estate keywords for classification
    this.keywords = {
      transaction: [
        'closing', 'escrow', 'earnest money', 'offer', 'acceptance',
        'mutual acceptance', 'purchase agreement', 'sale agreement',
        'mls', 'listing', 'buyer', 'seller', 'real estate',
        'property', 'contract', 'addendum', 'inspection',
      ],
      purchase: [
        'buying', 'buyer', 'purchase', 'offer to purchase', 'buying agent',
        'purchase price', 'down payment',
      ],
      sale: [
        'selling', 'seller', 'listing', 'list price', 'selling agent',
        'sale price', 'listing agreement',
      ],
      parties: [
        'buyer', 'seller', 'agent', 'broker', 'escrow officer',
        'title company', 'lender', 'inspector', 'appraiser',
      ],
    };

    // Regex patterns for extraction
    this.patterns = {
      // Address patterns
      address: /\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Boulevard|Blvd|Place|Pl|Circle|Cir)[,\s]+[A-Z][a-z]+[,\s]+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/gi,

      // Money amounts
      money: /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      largeAmount: /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/g, // For property prices

      // Dates
      date: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]+\d{1,2}[,\s]+\d{4}\b/gi,
      dateNumeric: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,

      // Email addresses
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

      // Phone numbers
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

      // MLS numbers
      mls: /\bMLS[#\s]*(\d+)\b/gi,
    };
  }

  /**
   * Analyze an email and extract transaction data
   * @param {Object} email - Email object from Gmail/Outlook
   * @returns {Object} Extracted transaction data
   */
  analyzeEmail(email) {
    const text = this._getEmailText(email);

    return {
      // Classification
      isRealEstateRelated: this._isRealEstateRelated(text),
      transactionType: this._detectTransactionType(text),
      confidence: this._calculateConfidence(text),

      // Extracted data
      addresses: this._extractAddresses(text),
      amounts: this._extractAmounts(text),
      dates: this._extractDates(text),
      parties: this._extractParties(email, text),
      mlsNumbers: this._extractMLSNumbers(text),

      // Keywords found
      keywords: this._extractKeywords(text),

      // Email metadata
      subject: email.subject,
      from: email.from,
      date: email.date,
      snippet: email.snippet || email.bodyPreview,
    };
  }

  /**
   * Get searchable text from email
   * @private
   */
  _getEmailText(email) {
    const parts = [
      email.subject || '',
      email.bodyPlain || email.body || '',
      email.snippet || '',
    ];
    return parts.join(' ').toLowerCase();
  }

  /**
   * Check if email is real estate related
   * @private
   */
  _isRealEstateRelated(text) {
    const keywordCount = this.keywords.transaction.filter(keyword =>
      text.includes(keyword.toLowerCase())
    ).length;

    return keywordCount >= 2; // At least 2 keywords must match
  }

  /**
   * Detect transaction type (purchase or sale)
   * @private
   */
  _detectTransactionType(text) {
    const purchaseScore = this.keywords.purchase.filter(keyword =>
      text.includes(keyword.toLowerCase())
    ).length;

    const saleScore = this.keywords.sale.filter(keyword =>
      text.includes(keyword.toLowerCase())
    ).length;

    if (purchaseScore > saleScore) return 'purchase';
    if (saleScore > purchaseScore) return 'sale';
    return null; // Unknown
  }

  /**
   * Calculate confidence score (0-100) - Enhanced Algorithm
   * @private
   */
  _calculateConfidence(text) {
    let score = 0;
    let bonusMultiplier = 1.0;

    // 1. Keywords present (max 40 points)
    const keywordMatches = this.keywords.transaction.filter(keyword =>
      text.includes(keyword.toLowerCase())
    ).length;
    const keywordScore = Math.min(keywordMatches * 5, 40);
    score += keywordScore;

    // Bonus: Many keywords = higher multiplier
    if (keywordMatches >= 5) bonusMultiplier += 0.1;
    if (keywordMatches >= 8) bonusMultiplier += 0.1;

    // 2. Has valid address (20 points)
    const hasAddress = this.patterns.address.test(text);
    if (hasAddress) {
      score += 20;
      // Bonus: If address appears multiple times (thread discussion)
      const addressMatches = (text.match(this.patterns.address) || []).length;
      if (addressMatches > 2) score += 5;
    }

    // 3. Has money amounts (up to 20 points)
    const moneyMatches = (text.match(this.patterns.largeAmount) || []).length;
    if (moneyMatches > 0) {
      // More amounts = more likely real transaction
      score += Math.min(10 + (moneyMatches * 3), 20);
    }

    // 4. Has dates (up to 15 points)
    const dateMatches = [
      ...(text.match(this.patterns.date) || []),
      ...(text.match(this.patterns.dateNumeric) || [])
    ];
    if (dateMatches.length > 0) {
      // Multiple dates = timeline discussion
      score += Math.min(10 + (dateMatches.length * 2), 15);
    }

    // 5. Has MLS number (15 points - strong indicator)
    if (this.patterns.mls.test(text)) {
      score += 15;
      bonusMultiplier += 0.1; // MLS = professional listing
    }

    // 6. Context analysis bonuses
    // Check for common real estate phrases
    const contextPhrases = [
      'mutual acceptance', 'purchase agreement', 'closing disclosure',
      'earnest money', 'inspection contingency', 'title report',
      'escrow instructions', 'final walkthrough', 'loan approval'
    ];
    const contextMatches = contextPhrases.filter(phrase =>
      text.includes(phrase.toLowerCase())
    ).length;
    if (contextMatches > 0) {
      score += Math.min(contextMatches * 3, 10);
    }

    // 7. Email pattern analysis
    // If subject contains key transaction terms = higher confidence
    const subjectBonus = this._analyzeSubjectLine(text);
    score += subjectBonus;

    // Apply multiplier and cap at 100
    const finalScore = Math.min(Math.round(score * bonusMultiplier), 100);

    return finalScore;
  }

  /**
   * Analyze email subject line for transaction indicators
   * @private
   */
  _analyzeSubjectLine(text) {
    // Extract likely subject (first line or text before body)
    const firstLine = text.split('\n')[0].toLowerCase();

    let bonus = 0;

    // Subject contains address
    if (this.patterns.address.test(firstLine)) bonus += 5;

    // Subject contains transaction keywords
    const subjectKeywords = ['closing', 'offer', 'accepted', 'pending', 'sold', 'contract'];
    const subjectMatches = subjectKeywords.filter(kw => firstLine.includes(kw)).length;
    bonus += subjectMatches * 2;

    return Math.min(bonus, 10);
  }

  /**
   * Calculate field-specific confidence
   * Used for individual field extractions (closing_date, sale_price, etc.)
   */
  calculateFieldConfidence(fieldName, extractedValue, text, allMatches = []) {
    let confidence = 0;

    switch (fieldName) {
      case 'closing_date':
        // Higher confidence if:
        // - Appears near "closing" keyword
        // - Format is consistent (MM/DD/YYYY)
        // - Date is in reasonable range (not too far in past/future)
        if (text.includes('closing') && text.indexOf(extractedValue) - text.indexOf('closing') < 100) {
          confidence += 30;
        }
        if (allMatches.length === 1) confidence += 20; // Only one date = likely correct
        if (allMatches.length <= 3) confidence += 10;
        if (this._isReasonableClosingDate(extractedValue)) confidence += 40;
        break;

      case 'sale_price':
        // Higher confidence if:
        // - Amount is in reasonable range ($50k - $50M)
        // - Appears near "price" or "sale" keywords
        // - Is the largest amount mentioned
        const price = parseFloat(extractedValue.replace(/[^0-9.]/g, ''));
        if (price >= 50000 && price <= 50000000) confidence += 40;
        if (allMatches.length > 0 && Math.max(...allMatches) === price) confidence += 20;
        if (text.includes('sale price') || text.includes('purchase price')) confidence += 30;
        if (text.indexOf(extractedValue) - text.lastIndexOf('price') < 50) confidence += 10;
        break;

      case 'transaction_type':
        // Higher confidence if:
        // - Clear buyer/seller language
        // - Listing agreement vs purchase agreement mentioned
        const purchaseKeywords = ['buying', 'buyer', 'purchase agreement'];
        const saleKeywords = ['selling', 'seller', 'listing agreement'];
        const pCount = purchaseKeywords.filter(kw => text.includes(kw)).length;
        const sCount = saleKeywords.filter(kw => text.includes(kw)).length;
        const diff = Math.abs(pCount - sCount);
        confidence += Math.min(diff * 20, 80);
        if (text.includes('representing buyer') || text.includes('representing seller')) confidence += 20;
        break;

      case 'property_address':
        // Higher confidence if:
        // - Well-formatted US address
        // - Appears multiple times
        // - Has zip code
        if (this.patterns.address.test(extractedValue)) confidence += 50;
        if (extractedValue.match(/\d{5}(-\d{4})?/)) confidence += 20; // Has zip
        const occurrences = (text.match(new RegExp(extractedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        confidence += Math.min(occurrences * 5, 30);
        break;

      default:
        confidence = 50; // Default medium confidence
    }

    return Math.min(confidence, 100);
  }

  /**
   * Check if date is reasonable for a closing date
   * @private
   */
  _isReasonableClosingDate(dateStr) {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      // Reasonable if within 2 years past to 1 year future
      return date >= twoYearsAgo && date <= oneYearAhead;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract property addresses
   * @private
   */
  _extractAddresses(text) {
    const matches = text.match(this.patterns.address) || [];
    // Remove duplicates and return
    return [...new Set(matches)].map(addr => addr.trim());
  }

  /**
   * Extract monetary amounts
   * @private
   */
  _extractAmounts(text) {
    const matches = text.match(this.patterns.money) || [];
    return matches.map(amount => {
      // Remove $ and commas, convert to number
      const cleaned = amount.replace(/[\$,]/g, '');
      return parseFloat(cleaned);
    }).filter(amount => amount > 0);
  }

  /**
   * Extract dates
   * @private
   */
  _extractDates(text) {
    const textDates = text.match(this.patterns.date) || [];
    const numericDates = text.match(this.patterns.dateNumeric) || [];

    const allDates = [...textDates, ...numericDates];

    // Try to parse and validate dates
    return allDates.map(dateStr => {
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        }
      } catch (e) {
        // Invalid date, skip
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Extract parties involved
   * @private
   */
  _extractParties(email, text) {
    const parties = [];

    // Extract from email participants
    if (email.from) parties.push({ email: email.from, role: 'sender' });
    if (email.to) {
      email.to.split(',').forEach(addr => {
        parties.push({ email: addr.trim(), role: 'recipient' });
      });
    }

    // Detect roles from keywords
    this.keywords.parties.forEach(role => {
      const rolePattern = new RegExp(`\\b${role}\\b[:\\s]*([A-Z][a-z]+\\s+[A-Z][a-z]+)`, 'gi');
      const matches = text.match(rolePattern);
      if (matches) {
        matches.forEach(match => {
          parties.push({ role: role, name: match });
        });
      }
    });

    return parties;
  }

  /**
   * Extract MLS numbers
   * @private
   */
  _extractMLSNumbers(text) {
    const matches = text.match(this.patterns.mls) || [];
    return matches.map(match => {
      const number = match.replace(/[^0-9]/g, '');
      return number;
    });
  }

  /**
   * Extract keywords found
   * @private
   */
  _extractKeywords(text) {
    const found = [];

    Object.entries(this.keywords).forEach(([category, words]) => {
      words.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
          found.push({ category, keyword });
        }
      });
    });

    return found;
  }

  /**
   * Batch analyze multiple emails
   * @param {Array} emails - Array of email objects
   * @returns {Array} Array of analysis results
   */
  batchAnalyze(emails) {
    return emails.map(email => this.analyzeEmail(email));
  }

  /**
   * Group emails by property address
   * @param {Array} analyzedEmails - Array of analyzed email results
   * @returns {Object} Emails grouped by address
   */
  groupByProperty(analyzedEmails) {
    const groups = {};

    analyzedEmails.forEach(analysis => {
      if (analysis.addresses.length > 0) {
        const primaryAddress = analysis.addresses[0];

        if (!groups[primaryAddress]) {
          groups[primaryAddress] = [];
        }

        groups[primaryAddress].push(analysis);
      }
    });

    return groups;
  }

  /**
   * Generate transaction summary from grouped emails
   * @param {Array} emailGroup - Group of emails for same property
   * @returns {Object} Transaction summary
   */
  generateTransactionSummary(emailGroup) {
    if (emailGroup.length === 0) return null;

    // Get primary address
    const address = emailGroup[0].addresses[0];

    // Aggregate all amounts
    const allAmounts = emailGroup.flatMap(e => e.amounts);

    // Get all dates
    const allDates = emailGroup.flatMap(e => e.dates).filter(Boolean);

    // Get all MLS numbers
    const mlsNumbers = [...new Set(emailGroup.flatMap(e => e.mlsNumbers))];

    // Determine transaction type (most common)
    const types = emailGroup.map(e => e.transactionType).filter(Boolean);
    const transactionType = types.length > 0 ? types[0] : null;

    // Calculate average confidence
    const avgConfidence = Math.round(
      emailGroup.reduce((sum, e) => sum + e.confidence, 0) / emailGroup.length
    );

    // Find likely sale price (largest amount)
    const salePrice = allAmounts.length > 0 ? Math.max(...allAmounts) : null;

    // Find closing date (last date mentioned)
    const closingDate = allDates.length > 0
      ? allDates.sort().reverse()[0]
      : null;

    return {
      propertyAddress: address,
      transactionType,
      salePrice,
      closingDate,
      mlsNumbers,
      communicationsCount: emailGroup.length,
      firstCommunication: Math.min(...emailGroup.map(e => new Date(e.date).getTime())),
      lastCommunication: Math.max(...emailGroup.map(e => new Date(e.date).getTime())),
      confidence: avgConfidence,
      emails: emailGroup,
    };
  }
}

module.exports = new TransactionExtractorService();
