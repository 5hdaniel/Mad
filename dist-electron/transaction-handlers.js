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
const auditService_1 = __importDefault(require("./services/auditService"));
const logService_1 = __importDefault(require("./services/logService"));
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
            logService_1.default.info('Starting transaction scan', 'Transactions', { userId });
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
            logService_1.default.info('Transaction scan complete', 'Transactions', { userId: validatedUserId, result });
            return {
                ...result,
            };
        }
        catch (error) {
            logService_1.default.error('Transaction scan failed', 'Transactions', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.error('Get transactions failed', 'Transactions', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            // Audit log transaction creation
            await auditService_1.default.log({
                userId: validatedUserId,
                action: 'TRANSACTION_CREATE',
                resourceType: 'TRANSACTION',
                resourceId: transaction.id,
                metadata: { propertyAddress: transaction.property_address },
                success: true,
            });
            logService_1.default.info('Transaction created', 'Transactions', {
                userId: validatedUserId,
                transactionId: transaction.id,
            });
            return {
                success: true,
                transaction,
            };
        }
        catch (error) {
            logService_1.default.error('Create transaction failed', 'Transactions', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.error('Get transaction details failed', 'Transactions', {
                transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            // Get transaction before update for audit logging (to get user_id)
            const existingTransaction = await transactionService_1.default.getTransactionDetails(validatedTransactionId);
            const userId = existingTransaction?.user_id || 'unknown';
            const updated = await transactionService_1.default.updateTransaction(validatedTransactionId, validatedUpdates);
            // Audit log transaction update
            await auditService_1.default.log({
                userId,
                action: 'TRANSACTION_UPDATE',
                resourceType: 'TRANSACTION',
                resourceId: validatedTransactionId,
                metadata: { updatedFields: Object.keys(validatedUpdates) },
                success: true,
            });
            logService_1.default.info('Transaction updated', 'Transactions', {
                userId,
                transactionId: validatedTransactionId,
            });
            return {
                success: true,
                transaction: updated,
            };
        }
        catch (error) {
            logService_1.default.error('Update transaction failed', 'Transactions', {
                transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            // Get transaction before delete for audit logging
            const existingTransaction = await transactionService_1.default.getTransactionDetails(validatedTransactionId);
            const userId = existingTransaction?.user_id || 'unknown';
            const propertyAddress = existingTransaction?.property_address || 'unknown';
            await transactionService_1.default.deleteTransaction(validatedTransactionId);
            // Audit log transaction deletion
            await auditService_1.default.log({
                userId,
                action: 'TRANSACTION_DELETE',
                resourceType: 'TRANSACTION',
                resourceId: validatedTransactionId,
                metadata: { propertyAddress },
                success: true,
            });
            logService_1.default.info('Transaction deleted', 'Transactions', {
                userId,
                transactionId: validatedTransactionId,
            });
            return {
                success: true,
            };
        }
        catch (error) {
            logService_1.default.error('Delete transaction failed', 'Transactions', {
                transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.info('Creating audited transaction', 'Transactions', { userId });
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
            logService_1.default.error('Create audited transaction failed', 'Transactions', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.error('Get transaction with contacts failed', 'Transactions', {
                transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.error('Assign contact to transaction failed', 'Transactions', {
                transactionId,
                contactId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.error('Remove contact from transaction failed', 'Transactions', {
                transactionId,
                contactId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.error('Reanalyze property failed', 'Transactions', {
                userId,
                propertyAddress,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.info('Exporting transaction to PDF', 'Transactions', { transactionId });
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
            // Audit log data export
            await auditService_1.default.log({
                userId: details.user_id,
                action: 'DATA_EXPORT',
                resourceType: 'EXPORT',
                resourceId: validatedTransactionId,
                metadata: { format: 'pdf', propertyAddress: details.property_address },
                success: true,
            });
            logService_1.default.info('PDF exported successfully', 'Transactions', {
                transactionId: validatedTransactionId,
                path: generatedPath,
            });
            return {
                success: true,
                path: generatedPath,
            };
        }
        catch (error) {
            logService_1.default.error('PDF export failed', 'Transactions', {
                transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            logService_1.default.info('Starting enhanced export', 'Transactions', { transactionId });
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
            // Update export tracking in database
            const { databaseService: db } = require('./services/databaseService').default;
            await db.updateTransaction(validatedTransactionId, {
                export_status: 'exported',
                export_format: sanitizedOptions.exportFormat || 'pdf',
                last_exported_on: new Date().toISOString(),
                export_count: (details.export_count || 0) + 1,
            });
            // Audit log data export
            await auditService_1.default.log({
                userId: details.user_id,
                action: 'DATA_EXPORT',
                resourceType: 'EXPORT',
                resourceId: validatedTransactionId,
                metadata: {
                    format: sanitizedOptions.exportFormat || 'pdf',
                    propertyAddress: details.property_address,
                },
                success: true,
            });
            logService_1.default.info('Enhanced export successful', 'Transactions', {
                transactionId: validatedTransactionId,
                format: sanitizedOptions.exportFormat || 'pdf',
                path: exportPath,
            });
            return {
                success: true,
                path: exportPath,
            };
        }
        catch (error) {
            logService_1.default.error('Enhanced export failed', 'Transactions', {
                transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
