const { PublicClientApplication, InteractionRequiredAuthError } = require('@azure/msal-node');
const { FilePersistence } = require('@azure/msal-node-extensions');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const os = require('os');

class OutlookService {
  constructor() {
    this.msalInstance = null;
    this.graphClient = null;
    this.authWindow = null;
    this.accessToken = null;
    this.cacheLocation = null;
  }

  /**
   * Initialize MSAL with configuration from environment variables
   * Includes persistent token caching so users don't have to re-authenticate every time
   */
  async initialize(clientId, tenantId = 'common') {
    // Set up cache location in app's user data directory
    const userDataPath = app.getPath('userData');
    this.cacheLocation = path.join(userDataPath, 'msal-cache.json');

    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
      cache: {
        cachePlugin: {
          beforeCacheAccess: async (cacheContext) => {
            // Read cache from disk
            if (fs.existsSync(this.cacheLocation)) {
              const cacheData = fs.readFileSync(this.cacheLocation, 'utf8');
              cacheContext.tokenCache.deserialize(cacheData);
            }
          },
          afterCacheAccess: async (cacheContext) => {
            // Write cache to disk if it changed
            if (cacheContext.cacheHasChanged) {
              fs.writeFileSync(this.cacheLocation, cacheContext.tokenCache.serialize());
            }
          },
        },
      },
      system: {
        loggerOptions: {
          loggerCallback(loglevel, message) {
            console.log(message);
          },
          piiLoggingEnabled: false,
          logLevel: 3,
        },
      },
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  /**
   * Authenticate user using device code flow (best for desktop apps)
   * Returns user account info on success
   */
  async authenticate(parentWindow) {
    if (!this.msalInstance) {
      throw new Error('OutlookService not initialized. Call initialize() first.');
    }

    const scopes = ['User.Read', 'Mail.Read'];
    const { shell } = require('electron');

    try {
      // Try to get token silently from cache first
      const accounts = await this.msalInstance.getTokenCache().getAllAccounts();

      if (accounts.length > 0) {
        const silentRequest = {
          account: accounts[0],
          scopes: scopes,
        };

        try {
          const response = await this.msalInstance.acquireTokenSilent(silentRequest);
          this.accessToken = response.accessToken;
          this.initializeGraphClient();
          return { success: true, account: response.account };
        } catch (error) {
          if (error instanceof InteractionRequiredAuthError) {
            // Need interactive auth
          } else {
            throw error;
          }
        }
      }

      // Interactive authentication using device code flow
      const deviceCodeRequest = {
        scopes: scopes,
        deviceCodeCallback: (response) => {
          // Automatically open the browser for the user
          console.log('\nDevice Code Authentication:');
          console.log(`Please visit: ${response.verificationUri}`);
          console.log(`And enter code: ${response.userCode}`);
          console.log(`Message: ${response.message}\n`);

          // Open browser automatically
          shell.openExternal(response.verificationUri).catch(err => {
            console.error('Failed to open browser:', err);
          });

          // Send to renderer if parentWindow is available
          if (parentWindow && !parentWindow.isDestroyed()) {
            parentWindow.webContents.send('device-code-received', {
              verificationUri: response.verificationUri,
              userCode: response.userCode,
              message: response.message
            });
          }

          return response;
        },
      };

      const response = await this.msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);
      this.accessToken = response.accessToken;
      this.initializeGraphClient();

      return {
        success: true,
        account: response.account,
        userInfo: {
          username: response.account.username,
          name: response.account.name,
        }
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initialize Microsoft Graph client with access token
   */
  initializeGraphClient() {
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, this.accessToken);
      },
    });
  }

  /**
   * Get user's email address
   */
  async getUserEmail() {
    if (!this.graphClient) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const user = await this.graphClient.api('/me').get();
      return user.mail || user.userPrincipalName;
    } catch (error) {
      console.error('Error getting user email:', error);
      throw error;
    }
  }

  /**
   * Get email count for a specific contact (optimized for speed)
   * @param {string} contactEmail - Email address to search for
   */
  async getEmailCount(contactEmail) {
    if (!this.graphClient) {
      return 0;
    }

    try {
      // Use smaller page size (50) and metadata only for fast counting
      const emailLower = contactEmail.toLowerCase();
      let totalCount = 0;
      let nextLink = null;
      let pageCount = 0;
      const maxPages = 20; // Limit to prevent infinite loops

      // Fetch first page - metadata only, no body
      let response = await this.graphClient
        .api('/me/messages')
        .select('from,toRecipients,ccRecipients')
        .top(50)
        .get();

      do {
        const emails = response.value || [];

        // Filter emails that involve this contact
        const matching = emails.filter(email => {
          const fromEmail = email.from?.emailAddress?.address?.toLowerCase();
          const toEmails = (email.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());
          const ccEmails = (email.ccRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());

          return fromEmail === emailLower ||
                 toEmails.includes(emailLower) ||
                 ccEmails.includes(emailLower);
        });

        totalCount += matching.length;

        nextLink = response['@odata.nextLink'];
        pageCount++;

        // Fetch next page if exists and under limit
        if (nextLink && pageCount < maxPages) {
          response = await this.graphClient.api(nextLink).get();
        } else {
          break;
        }
      } while (nextLink && pageCount < maxPages);

      return totalCount;
    } catch (error) {
      console.error('Error getting email count:', error);
      return 0;
    }
  }

  /**
   * Bulk fetch all emails and count per contact (MUCH faster than individual queries)
   * Returns a map of email address -> count
   * @param {Array<string>} contactEmails - Array of email addresses to count for
   * @param {Function} onProgress - Optional callback for progress updates
   */
  async bulkGetEmailCounts(contactEmails, onProgress = null) {
    if (!this.graphClient) {
      return {};
    }

    try {
      console.log('\n=== Bulk Email Count (Optimized Architecture) ===');
      console.log(`Fetching ALL emails once and building index for ${contactEmails.length} contacts...`);

      const startTime = Date.now();
      const counts = {};

      // Initialize all counts to 0
      contactEmails.forEach(email => {
        counts[email.toLowerCase()] = 0;
      });

      // Fetch ALL emails in bulk (metadata only)
      let totalEmailsFetched = 0;
      let nextLink = null;
      let pageCount = 0;
      const maxPages = 200; // Allow more pages since we're doing this once

      // Progress tracking
      let lastProgressUpdate = Date.now();

      // Fetch first page
      let response = await this.graphClient
        .api('/me/messages')
        .select('from,toRecipients,ccRecipients')
        .top(500) // Larger page size for bulk fetch
        .get();

      do {
        const emails = response.value || [];
        totalEmailsFetched += emails.length;

        // Index each email by all participants
        emails.forEach(email => {
          const fromEmail = email.from?.emailAddress?.address?.toLowerCase();
          const toEmails = (email.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());
          const ccEmails = (email.ccRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());

          // Count for sender
          if (fromEmail && counts.hasOwnProperty(fromEmail)) {
            counts[fromEmail]++;
          }

          // Count for recipients
          [...toEmails, ...ccEmails].forEach(recipientEmail => {
            if (recipientEmail && counts.hasOwnProperty(recipientEmail)) {
              counts[recipientEmail]++;
            }
          });
        });

        nextLink = response['@odata.nextLink'];
        pageCount++;

        // Progress update every 2 seconds
        const now = Date.now();
        if (onProgress && (now - lastProgressUpdate > 2000)) {
          const elapsed = now - startTime;
          const avgTimePerPage = elapsed / pageCount;
          const estimatedTotalPages = Math.min(maxPages, pageCount * 2); // Rough estimate
          const etaMs = avgTimePerPage * (estimatedTotalPages - pageCount);
          const etaSeconds = Math.round(etaMs / 1000);

          onProgress({
            emailsFetched: totalEmailsFetched,
            pagesLoaded: pageCount,
            eta: etaSeconds
          });

          lastProgressUpdate = now;
        }

        // Fetch next page if exists and under limit
        if (nextLink && pageCount < maxPages) {
          response = await this.graphClient.api(nextLink).get();
        } else {
          if (nextLink) {
            console.log(`Reached page limit (${maxPages} pages = ${totalEmailsFetched} emails)`);
          }
          break;
        }
      } while (nextLink && pageCount < maxPages);

      const totalTime = Date.now() - startTime;
      const timePerEmail = totalEmailsFetched > 0 ? (totalTime / totalEmailsFetched).toFixed(2) : 0;

      console.log('\n=== Bulk Fetch Complete ===');
      console.log(`Total emails fetched: ${totalEmailsFetched}`);
      console.log(`Total pages: ${pageCount}`);
      console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`Avg time per email: ${timePerEmail}ms`);
      console.log(`Contacts with emails: ${Object.values(counts).filter(c => c > 0).length}`);

      return counts;
    } catch (error) {
      console.error('Error in bulk email count:', error);
      return {};
    }
  }

  /**
   * Search for emails with a specific contact
   * @param {string} contactEmail - Email address to search for
   * @param {number} maxResults - Maximum number of emails to retrieve (default: 100)
   */
  async getEmailsWithContact(contactEmail, maxResults = 100) {
    if (!this.graphClient) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      // Fetch messages and filter in memory since Graph API search/filter is problematic
      const emailLower = contactEmail.toLowerCase();
      let matchingEmails = [];
      let nextLink = null;
      let pageCount = 0;
      const maxPages = 20; // Limit to prevent infinite loops

      console.log(`[Email Fetch] Starting fetch for ${contactEmail}, maxResults: ${maxResults}`);

      // Helper function to add timeout to promises
      const withTimeout = (promise, timeoutMs = 60000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);
      };

      // PHASE 1: Fetch email metadata (without body) to find matching emails
      // Using smaller page size (50 instead of 500) and excluding body for speed
      console.log(`[Email Fetch] Phase 1: Fetching metadata (top 50 per page)...`);
      let response = await withTimeout(
        this.graphClient
          .api('/me/messages')
          .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,importance')
          .orderby('receivedDateTime DESC')
          .top(50)
          .get(),
        60000 // 60 second timeout
      );
      console.log(`[Email Fetch] Page 1 fetched: ${response.value?.length || 0} emails`);

      const matchingEmailIds = [];
      let consecutivePagesWithNoMatches = 0;
      const maxConsecutivePagesWithNoMatches = 5; // Stop if 5 pages in a row have 0 matches

      do {
        const emails = response.value || [];

        // Filter emails that involve this contact
        const matching = emails.filter(email => {
          const fromEmail = email.from?.emailAddress?.address?.toLowerCase();
          const toEmails = (email.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());
          const ccEmails = (email.ccRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());

          return fromEmail === emailLower ||
                 toEmails.includes(emailLower) ||
                 ccEmails.includes(emailLower);
        });

        console.log(`[Email Fetch] Page ${pageCount + 1}: Found ${matching.length} matching emails out of ${emails.length} total`);
        matchingEmailIds.push(...matching);

        // Track consecutive pages with no matches
        if (matching.length === 0) {
          consecutivePagesWithNoMatches++;
          if (consecutivePagesWithNoMatches >= maxConsecutivePagesWithNoMatches) {
            console.log(`[Email Fetch] No matches found in ${maxConsecutivePagesWithNoMatches} consecutive pages, stopping search`);
            break;
          }
        } else {
          consecutivePagesWithNoMatches = 0; // Reset counter when we find matches
        }

        // Stop if we have enough
        if (matchingEmailIds.length >= maxResults) {
          console.log(`[Email Fetch] Reached maxResults (${maxResults}), stopping`);
          break;
        }

        nextLink = response['@odata.nextLink'];
        pageCount++;

        // Fetch next page if exists and under limit
        if (nextLink && pageCount < maxPages) {
          console.log(`[Email Fetch] Fetching page ${pageCount + 1}...`);
          response = await withTimeout(
            this.graphClient.api(nextLink).get(),
            60000 // 60 second timeout
          );
          console.log(`[Email Fetch] Page ${pageCount + 1} fetched: ${response.value?.length || 0} emails`);
        } else {
          if (pageCount >= maxPages) {
            console.log(`[Email Fetch] Reached max pages (${maxPages}), stopping`);
          }
          break;
        }
      } while (nextLink && pageCount < maxPages);

      // Trim to maxResults
      const emailsToFetch = matchingEmailIds.slice(0, maxResults);
      console.log(`[Email Fetch] Phase 1 complete: Found ${emailsToFetch.length} matching emails`);

      // PHASE 2: Fetch full body content for matching emails only
      console.log(`[Email Fetch] Phase 2: Fetching body content for ${emailsToFetch.length} emails...`);
      for (let i = 0; i < emailsToFetch.length; i++) {
        const email = emailsToFetch[i];
        try {
          // Fetch full email details including body
          const fullEmail = await withTimeout(
            this.graphClient
              .api(`/me/messages/${email.id}`)
              .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,hasAttachments,importance')
              .get(),
            30000 // 30 second timeout per email
          );

          // Merge the body into the email object
          matchingEmails.push(fullEmail);

          if ((i + 1) % 10 === 0) {
            console.log(`[Email Fetch] Fetched ${i + 1}/${emailsToFetch.length} email bodies`);
          }
        } catch (error) {
          console.error(`[Email Fetch] Error fetching body for email ${email.id}:`, error.message);
          // Still include the email but without body
          matchingEmails.push(email);
        }
      }

      console.log(`[Email Fetch] Phase 2 complete: Fetched ${matchingEmails.length} emails with body content`);
      return matchingEmails;
    } catch (error) {
      console.error('[Email Fetch] Error fetching emails:', error);
      console.error('[Email Fetch] Error details:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Export emails to audit folder
   * @param {string} contactName - Name of the contact
   * @param {string} contactEmail - Email address of the contact
   * @param {string} exportPath - Path to export folder
   * @param {Function} onProgress - Optional callback for progress updates
   */
  async exportEmailsToAudit(contactName, contactEmail, exportPath, onProgress = null) {
    try {
      if (onProgress) onProgress({ stage: 'fetching', message: `Fetching emails for ${contactName}...` });

      const emails = await this.getEmailsWithContact(contactEmail);

      if (emails.length === 0) {
        if (onProgress) onProgress({ stage: 'complete', message: 'No emails found' });
        return {
          success: true,
          message: 'No emails found for this contact',
          emailCount: 0,
        };
      }

      if (onProgress) onProgress({
        stage: 'processing',
        message: `Processing ${emails.length} emails for ${contactName}...`,
        current: 0,
        total: emails.length
      });

      // Create contact folder inside the export path
      const sanitizedName = contactName.replace(/[^a-z0-9 ]/gi, '_');
      const contactFolder = path.join(exportPath, sanitizedName);

      if (!fs.existsSync(contactFolder)) {
        fs.mkdirSync(contactFolder, { recursive: true });
      }

      // Export as text file
      const fileName = `emails.txt`;
      const filePath = path.join(contactFolder, fileName);

      let content = `EMAIL AUDIT REPORT\n`;
      content += `===================\n\n`;
      content += `Contact: ${contactName}\n`;
      content += `Email: ${contactEmail}\n`;
      content += `Export Date: ${new Date().toLocaleString()}\n`;
      content += `Total Emails: ${emails.length}\n`;
      content += `\n${'='.repeat(80)}\n\n`;

      // Sort emails by date (oldest first)
      emails.sort((a, b) => new Date(a.receivedDateTime) - new Date(b.receivedDateTime));

      emails.forEach((email, index) => {
        content += `EMAIL ${index + 1}\n`;
        content += `${'-'.repeat(80)}\n`;
        content += `Date: ${new Date(email.receivedDateTime).toLocaleString()}\n`;

        // Handle from field safely
        if (email.from && email.from.emailAddress) {
          const fromName = email.from.emailAddress.name || 'Unknown';
          const fromAddress = email.from.emailAddress.address || 'unknown@unknown.com';
          content += `From: ${fromName} <${fromAddress}>\n`;
        } else {
          content += `From: Unknown\n`;
        }

        if (email.toRecipients && email.toRecipients.length > 0) {
          const recipients = email.toRecipients
            .filter(r => r.emailAddress)
            .map(r => `${r.emailAddress.name || 'Unknown'} <${r.emailAddress.address || 'unknown@unknown.com'}>`)
            .join(', ');
          if (recipients) {
            content += `To: ${recipients}\n`;
          }
        }

        if (email.ccRecipients && email.ccRecipients.length > 0) {
          const cc = email.ccRecipients
            .filter(r => r.emailAddress)
            .map(r => `${r.emailAddress.name || 'Unknown'} <${r.emailAddress.address || 'unknown@unknown.com'}>`)
            .join(', ');
          if (cc) {
            content += `CC: ${cc}\n`;
          }
        }

        content += `Subject: ${email.subject || '(No Subject)'}\n`;
        content += `Importance: ${email.importance || 'normal'}\n`;

        if (email.hasAttachments) {
          content += `Attachments: Yes\n`;
        }

        content += `\n`;

        // Add email body (plain text or HTML stripped)
        if (email.body) {
          let bodyText = email.body.content;

          // If HTML, strip basic tags for readability
          if (email.body.contentType === 'html') {
            bodyText = bodyText
              .replace(/<style[^>]*>.*?<\/style>/gs, '')
              .replace(/<script[^>]*>.*?<\/script>/gs, '')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .trim();
          }

          content += bodyText.trim();
        }

        content += `\n\n${'='.repeat(80)}\n\n`;
      });

      // Write to file
      fs.writeFileSync(filePath, content, 'utf8');

      // Also export as JSON for potential future use
      const jsonFileName = `emails.json`;
      const jsonFilePath = path.join(contactFolder, jsonFileName);
      fs.writeFileSync(jsonFilePath, JSON.stringify(emails, null, 2), 'utf8');

      return {
        success: true,
        emailCount: emails.length,
        exportPath: contactFolder,
        files: [fileName, jsonFileName],
      };

    } catch (error) {
      console.error('Error exporting emails:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.accessToken !== null && this.graphClient !== null;
  }

  /**
   * Sign out and clear cached tokens
   */
  async signOut() {
    if (this.msalInstance) {
      const accounts = await this.msalInstance.getTokenCache().getAllAccounts();
      for (const account of accounts) {
        await this.msalInstance.getTokenCache().removeAccount(account);
      }
    }

    // Delete cache file from disk
    if (this.cacheLocation && fs.existsSync(this.cacheLocation)) {
      fs.unlinkSync(this.cacheLocation);
    }

    this.accessToken = null;
    this.graphClient = null;
  }
}

module.exports = OutlookService;
