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
   * Get email count for a specific contact
   * @param {string} contactEmail - Email address to search for
   */
  async getEmailCount(contactEmail) {
    if (!this.graphClient) {
      return 0;
    }

    try {
      const result = await this.graphClient
        .api('/me/messages')
        .filter(`(from/emailAddress/address eq '${contactEmail}' or toRecipients/any(r: r/emailAddress/address eq '${contactEmail}'))`)
        .select('id')
        .top(999)
        .count(true)
        .get();

      return result['@odata.count'] || result.value.length || 0;
    } catch (error) {
      console.error('Error getting email count:', error);
      return 0;
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
      // Search for emails where the contact is either sender or recipient
      const searchQuery = `participants:${contactEmail}`;

      const emails = await this.graphClient
        .api('/me/messages')
        .filter(`(from/emailAddress/address eq '${contactEmail}' or toRecipients/any(r: r/emailAddress/address eq '${contactEmail}'))`)
        .select('subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments,importance')
        .orderby('receivedDateTime DESC')
        .top(maxResults)
        .get();

      return emails.value || [];
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  /**
   * Export emails to audit folder
   * @param {string} contactName - Name of the contact
   * @param {string} contactEmail - Email address of the contact
   * @param {string} exportPath - Path to export folder
   */
  async exportEmailsToAudit(contactName, contactEmail, exportPath) {
    try {
      const emails = await this.getEmailsWithContact(contactEmail);

      if (emails.length === 0) {
        return {
          success: true,
          message: 'No emails found for this contact',
          emailCount: 0,
        };
      }

      // Create audit folder
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sanitizedName = contactName.replace(/[^a-z0-9]/gi, '_');
      const folderName = `${sanitizedName}_emails_${timestamp}`;
      const fullPath = path.join(exportPath, folderName);

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      // Export as text file
      const fileName = `${sanitizedName}_email_audit.txt`;
      const filePath = path.join(fullPath, fileName);

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
        content += `From: ${email.from.emailAddress.name} <${email.from.emailAddress.address}>\n`;

        if (email.toRecipients && email.toRecipients.length > 0) {
          const recipients = email.toRecipients
            .map(r => `${r.emailAddress.name} <${r.emailAddress.address}>`)
            .join(', ');
          content += `To: ${recipients}\n`;
        }

        if (email.ccRecipients && email.ccRecipients.length > 0) {
          const cc = email.ccRecipients
            .map(r => `${r.emailAddress.name} <${r.emailAddress.address}>`)
            .join(', ');
          content += `CC: ${cc}\n`;
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
      const jsonFileName = `${sanitizedName}_email_audit.json`;
      const jsonFilePath = path.join(fullPath, jsonFileName);
      fs.writeFileSync(jsonFilePath, JSON.stringify(emails, null, 2), 'utf8');

      return {
        success: true,
        emailCount: emails.length,
        exportPath: fullPath,
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
