"use strict";
// ============================================
// TRANSACTION IPC HANDLERS
// This file contains transaction handlers to be registered in main.js
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTransactionHandlers = void 0;
const electron_1 = require("electron");
const transactionService_1 = __importDefault(require("./services/transactionService"));
// Services (still JS - to be migrated)
const pdfExportService = require('./services/pdfExportService').default;
const enhancedExportService = require('./services/enhancedExportService').default;
// Import validation utilities
const validation_1 = require("./utils/validation");
/**
 * Register all transaction-related IPC handlers
 * @param mainWindow - Main window instance
 */
const registerTransactionHandlers = (mainWindow) => {
    // Scan and extract transactions from emails
    electron_1.ipcMain.handle('transactions:scan', async (event, userId, options) => {
        try {
            console.log('[Main] Starting transaction scan for user:', userId);
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            const sanitizedOptions = (0, validation_1.sanitizeObject)(options || {});
            const result = await transactionService_1.default.scanAndExtractTransactions(validatedUserId, {
                ...sanitizedOptions,
                onProgress: (progress) => {
                    // Send progress updates to renderer
                    if (mainWindow) {
                        mainWindow.webContents.send('transactions:scan-progress', progress);
                    }
                },
            });
            console.log('[Main] Transaction scan complete:', result);
            return {
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Transaction scan failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Get all transactions for a user
    electron_1.ipcMain.handle('transactions:get-all', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            const transactions = await transactionService_1.default.getTransactions(validatedUserId);
            return {
                success: true,
                transactions,
            };
        }
        catch (error) {
            console.error('[Main] Get transactions failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Create manual transaction
    electron_1.ipcMain.handle('transactions:create', async (event, userId, transactionData) => {
        try {
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            if (!validatedUserId) {
                throw new validation_1.ValidationError('User ID validation failed', 'userId');
            }
            const validatedData = (0, validation_1.validateTransactionData)(transactionData, false);
            const transaction = await transactionService_1.default.createManualTransaction(validatedUserId, validatedData);
            return {
                success: true,
                transaction,
            };
        }
        catch (error) {
            console.error('[Main] Create transaction failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Get transaction details with communications
    electron_1.ipcMain.handle('transactions:get-details', async (event, transactionId) => {
        try {
            // Validate input
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const details = await transactionService_1.default.getTransactionDetails(validatedTransactionId);
            if (!details) {
                return {
                    success: false,
                    error: 'Transaction not found',
                };
            }
            return {
                success: true,
                transaction: details,
            };
        }
        catch (error) {
            console.error('[Main] Get transaction details failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Update transaction
    electron_1.ipcMain.handle('transactions:update', async (event, transactionId, updates) => {
        try {
            // Validate inputs
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const validatedUpdates = (0, validation_1.validateTransactionData)((0, validation_1.sanitizeObject)(updates || {}), true);
            const updated = await transactionService_1.default.updateTransaction(validatedTransactionId, validatedUpdates);
            return {
                success: true,
                transaction: updated,
            };
        }
        catch (error) {
            console.error('[Main] Update transaction failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Delete transaction
    electron_1.ipcMain.handle('transactions:delete', async (event, transactionId) => {
        try {
            // Validate input
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            await transactionService_1.default.deleteTransaction(validatedTransactionId);
            return {
                success: true,
            };
        }
        catch (error) {
            console.error('[Main] Delete transaction failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Create audited transaction with contact assignments
    electron_1.ipcMain.handle('transactions:create-audited', async (event, userId, transactionData) => {
        try {
            console.log('[Main] Creating audited transaction for user:', userId);
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const validatedData = (0, validation_1.validateTransactionData)((0, validation_1.sanitizeObject)(transactionData || {}), false);
            const transaction = await transactionService_1.default.createAuditedTransaction(validatedUserId, validatedData);
            return {
                success: true,
                transaction,
            };
        }
        catch (error) {
            console.error('[Main] Create audited transaction failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Get transaction with contacts
    electron_1.ipcMain.handle('transactions:get-with-contacts', async (event, transactionId) => {
        try {
            // Validate input
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const transaction = await transactionService_1.default.getTransactionWithContacts(validatedTransactionId);
            if (!transaction) {
                return {
                    success: false,
                    error: 'Transaction not found',
                };
            }
            return {
                success: true,
                transaction,
            };
        }
        catch (error) {
            console.error('[Main] Get transaction with contacts failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Assign contact to transaction
    electron_1.ipcMain.handle('transactions:assign-contact', async (event, transactionId, contactId, role, roleCategory, isPrimary, notes) => {
        try {
            // Validate inputs
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const validatedContactId = (0, validation_1.validateContactId)(contactId);
            // Validate role and roleCategory as strings
            if (!role || typeof role !== 'string' || role.trim().length === 0) {
                throw new validation_1.ValidationError('Role is required and must be a non-empty string', 'role');
            }
            if (!roleCategory || typeof roleCategory !== 'string' || roleCategory.trim().length === 0) {
                throw new validation_1.ValidationError('Role category is required and must be a non-empty string', 'roleCategory');
            }
            // Validate isPrimary as boolean
            if (typeof isPrimary !== 'boolean') {
                throw new validation_1.ValidationError('isPrimary must be a boolean', 'isPrimary');
            }
            // Validate notes (optional)
            const validatedNotes = notes && typeof notes === 'string' ? notes.trim() : null;
            await transactionService_1.default.assignContactToTransaction(validatedTransactionId, validatedContactId, role.trim(), roleCategory.trim(), isPrimary, validatedNotes ?? undefined);
            return {
                success: true,
            };
        }
        catch (error) {
            console.error('[Main] Assign contact to transaction failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Remove contact from transaction
    electron_1.ipcMain.handle('transactions:remove-contact', async (event, transactionId, contactId) => {
        try {
            // Validate inputs
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const validatedContactId = (0, validation_1.validateContactId)(contactId);
            await transactionService_1.default.removeContactFromTransaction(validatedTransactionId, validatedContactId);
            return {
                success: true,
            };
        }
        catch (error) {
            console.error('[Main] Remove contact from transaction failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Re-analyze property (rescan emails for specific address)
    electron_1.ipcMain.handle('transactions:reanalyze', async (event, userId, provider, propertyAddress, dateRange) => {
        try {
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const validatedProvider = (0, validation_1.validateProvider)(provider);
            // Validate property address
            if (!propertyAddress || typeof propertyAddress !== 'string' || propertyAddress.trim().length < 5) {
                throw new validation_1.ValidationError('Property address is required and must be at least 5 characters', 'propertyAddress');
            }
            // Validate dateRange (optional object with start/end)
            const sanitizedDateRange = (0, validation_1.sanitizeObject)(dateRange || {});
            const result = await transactionService_1.default.reanalyzeProperty(validatedUserId, validatedProvider, propertyAddress.trim(), sanitizedDateRange);
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Reanalyze property failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Export transaction to PDF
    electron_1.ipcMain.handle('transactions:export-pdf', async (event, transactionId, outputPath) => {
        try {
            console.log('[Main] Exporting transaction to PDF:', transactionId);
            // Validate inputs
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const validatedPath = outputPath ? (0, validation_1.validateFilePath)(outputPath) : null;
            // Get transaction details with communications
            const details = await transactionService_1.default.getTransactionDetails(validatedTransactionId);
            if (!details) {
                return {
                    success: false,
                    error: 'Transaction not found',
                };
            }
            // Use provided output path or generate default one
            const pdfPath = validatedPath || pdfExportService.getDefaultExportPath(details);
            // Generate PDF
            const generatedPath = await pdfExportService.generateTransactionPDF(details, details.communications || [], pdfPath);
            console.log('[Main] PDF exported successfully:', generatedPath);
            return {
                success: true,
                path: generatedPath,
            };
        }
        catch (error) {
            console.error('[Main] PDF export failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Enhanced export with options
    electron_1.ipcMain.handle('transactions:export-enhanced', async (event, transactionId, options) => {
        try {
            console.log('[Main] Enhanced export for transaction:', transactionId, options);
            // Validate inputs
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            if (!validatedTransactionId) {
                throw new validation_1.ValidationError('Transaction ID validation failed', 'transactionId');
            }
            const sanitizedOptions = (0, validation_1.sanitizeObject)(options || {});
            // Get transaction details with communications
            const details = await transactionService_1.default.getTransactionDetails(validatedTransactionId);
            if (!details) {
                return {
                    success: false,
                    error: 'Transaction not found',
                };
            }
            // Export with options
            const exportPath = await enhancedExportService.exportTransaction(details, details.communications || [], sanitizedOptions);
            console.log('[Main] Enhanced export successful:', exportPath);
            // Update export tracking in database
            const { databaseService: db } = require('./services/databaseService').default;
            await db.updateTransaction(validatedTransactionId, {
                export_status: 'exported',
                export_format: sanitizedOptions.exportFormat || 'pdf',
                last_exported_on: new Date().toISOString(),
                export_count: (details.export_count || 0) + 1,
            });
            return {
                success: true,
                path: exportPath,
            };
        }
        catch (error) {
            console.error('[Main] Enhanced export failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
};
exports.registerTransactionHandlers = registerTransactionHandlers;
