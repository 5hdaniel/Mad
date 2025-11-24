"use strict";
// ============================================
// USER FEEDBACK IPC HANDLERS
// For user corrections and extraction accuracy tracking
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFeedbackHandlers = void 0;
const electron_1 = require("electron");
const databaseService_1 = __importDefault(require("./services/databaseService"));
// Services (still JS - to be migrated)
const feedbackLearningService = require('./services/feedbackLearningService').default;
// Import validation utilities
const validation_1 = require("./utils/validation");
/**
 * Register all feedback-related IPC handlers
 */
const registerFeedbackHandlers = () => {
    // Submit user feedback
    electron_1.ipcMain.handle('feedback:submit', async (event, userId, feedbackData) => {
        try {
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            // Validate feedback data object
            if (!feedbackData || typeof feedbackData !== 'object') {
                throw new validation_1.ValidationError('Feedback data must be an object', 'feedbackData');
            }
            const sanitizedData = (0, validation_1.sanitizeObject)(feedbackData);
            // Validate required fields in feedback data
            if (sanitizedData.field_name) {
                sanitizedData.field_name = (0, validation_1.validateString)(sanitizedData.field_name, 'field_name', {
                    required: false,
                    maxLength: 100,
                });
            }
            const feedback = await databaseService_1.default.saveFeedback({
                user_id: validatedUserId,
                ...sanitizedData,
            });
            // Clear pattern cache for this field so new patterns are detected
            if (sanitizedData.field_name) {
                feedbackLearningService.clearCache(validatedUserId, sanitizedData.field_name);
            }
            return {
                success: true,
                feedbackId: feedback.id,
            };
        }
        catch (error) {
            console.error('[Main] Submit feedback failed:', error);
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
    // Get feedback for a transaction
    electron_1.ipcMain.handle('feedback:get-for-transaction', async (event, transactionId) => {
        try {
            // Validate input
            if (!transactionId) {
                throw new validation_1.ValidationError('Transaction ID is required', 'transactionId');
            }
            const validatedTransactionId = (0, validation_1.validateTransactionId)(transactionId);
            const feedback = await databaseService_1.default.getFeedbackByTransaction(validatedTransactionId);
            return {
                success: true,
                feedback,
            };
        }
        catch (error) {
            console.error('[Main] Get feedback failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                    feedback: [],
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                feedback: [],
            };
        }
    });
    // Get extraction metrics
    electron_1.ipcMain.handle('feedback:get-metrics', async (event, userId, fieldName = null) => {
        try {
            // Validate inputs
            const _validatedUserId = (0, validation_1.validateUserId)(userId);
            // Validate fieldName (optional)
            const _validatedFieldName = fieldName
                ? (0, validation_1.validateString)(fieldName, 'fieldName', {
                    required: false,
                    maxLength: 100,
                })
                : null;
            // TODO: Implement getExtractionMetrics in databaseService
            // For now, return empty metrics
            const metrics = [];
            return {
                success: true,
                metrics,
            };
        }
        catch (error) {
            console.error('[Main] Get extraction metrics failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                    metrics: [],
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                metrics: [],
            };
        }
    });
    // Get smart suggestion based on past patterns
    electron_1.ipcMain.handle('feedback:get-suggestion', async (event, userId, fieldName, extractedValue, confidence) => {
        try {
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const validatedFieldName = (0, validation_1.validateString)(fieldName, 'fieldName', {
                required: true,
                maxLength: 100,
            });
            const validatedExtractedValue = (0, validation_1.validateString)(extractedValue, 'extractedValue', {
                required: false,
                maxLength: 1000,
            });
            // Validate confidence (should be a number between 0 and 1)
            let validatedConfidence = confidence;
            if (confidence !== null && confidence !== undefined) {
                const confNum = Number(confidence);
                if (isNaN(confNum) || confNum < 0 || confNum > 1) {
                    throw new validation_1.ValidationError('Confidence must be a number between 0 and 1', 'confidence');
                }
                validatedConfidence = confNum;
            }
            const suggestion = await feedbackLearningService.generateSuggestion(validatedUserId, validatedFieldName, validatedExtractedValue, validatedConfidence);
            return {
                success: true,
                suggestion,
            };
        }
        catch (error) {
            console.error('[Main] Get suggestion failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                    suggestion: null,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                suggestion: null,
            };
        }
    });
    // Get learning statistics for a field
    electron_1.ipcMain.handle('feedback:get-learning-stats', async (event, userId, fieldName) => {
        try {
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const validatedFieldName = (0, validation_1.validateString)(fieldName, 'fieldName', {
                required: true,
                maxLength: 100,
            });
            const stats = await feedbackLearningService.getLearningStats(validatedUserId, validatedFieldName);
            return {
                success: true,
                stats,
            };
        }
        catch (error) {
            console.error('[Main] Get learning stats failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                    stats: null,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stats: null,
            };
        }
    });
};
exports.registerFeedbackHandlers = registerFeedbackHandlers;
