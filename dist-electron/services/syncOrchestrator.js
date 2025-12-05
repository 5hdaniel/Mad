"use strict";
/**
 * Sync Orchestrator Service
 *
 * Orchestrates the complete iPhone sync flow on Windows:
 * 1. Device detection
 * 2. iPhone backup creation
 * 3. Backup decryption (if encrypted)
 * 4. Messages and contacts extraction
 * 5. Contact name resolution
 * 6. Cleanup
 *
 * This is the main integration point for all iPhone-related services.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOrchestrator = exports.SyncOrchestrator = void 0;
const events_1 = require("events");
const electron_log_1 = __importDefault(require("electron-log"));
const deviceDetectionService_1 = require("./deviceDetectionService");
const backupService_1 = require("./backupService");
const backupDecryptionService_1 = require("./backupDecryptionService");
const iosMessagesParser_1 = require("./iosMessagesParser");
const iosContactsParser_1 = require("./iosContactsParser");
/**
 * SyncOrchestrator - Main integration service for iPhone sync on Windows
 *
 * Events:
 * - 'progress': SyncProgress - Progress updates during sync
 * - 'phase': SyncPhase - Phase changes
 * - 'device-connected': iOSDevice - Device connected
 * - 'device-disconnected': iOSDevice - Device disconnected
 * - 'password-required': void - Encrypted backup needs password
 * - 'error': Error - Error during sync
 * - 'complete': SyncResult - Sync completed
 *
 * @example
 * ```typescript
 * const orchestrator = new SyncOrchestrator();
 * orchestrator.on('progress', (progress) => console.log(progress));
 * const result = await orchestrator.sync({ udid: '...' });
 * ```
 */
class SyncOrchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.isCancelled = false;
        this.currentPhase = 'idle';
        this.startTime = 0;
        this.deviceService = deviceDetectionService_1.deviceDetectionService;
        this.backupService = new backupService_1.BackupService();
        this.decryptionService = new backupDecryptionService_1.BackupDecryptionService();
        this.messagesParser = new iosMessagesParser_1.iOSMessagesParser();
        this.contactsParser = new iosContactsParser_1.iOSContactsParser();
        this.setupEventForwarding();
    }
    /**
     * Set up event forwarding from child services
     */
    setupEventForwarding() {
        // Forward backup progress events
        this.backupService.on('progress', (progress) => {
            this.emitProgress({
                phase: 'backup',
                phaseProgress: progress.percentComplete,
                overallProgress: this.calculateOverallProgress('backup', progress.percentComplete),
                message: this.getBackupProgressMessage(progress),
                backupProgress: progress,
            });
        });
        // Forward password required events
        this.backupService.on('password-required', () => {
            this.emit('password-required');
        });
        // Forward device events
        this.deviceService.on('device-connected', (device) => {
            this.emit('device-connected', device);
        });
        this.deviceService.on('device-disconnected', (device) => {
            this.emit('device-disconnected', device);
        });
    }
    /**
     * Start the sync process
     */
    async sync(options) {
        if (this.isRunning) {
            return this.errorResult('Sync already in progress');
        }
        this.isRunning = true;
        this.isCancelled = false;
        this.startTime = Date.now();
        electron_log_1.default.info('[SyncOrchestrator] Starting sync', { udid: options.udid });
        try {
            // Step 1: Create backup
            this.setPhase('backup');
            const backupResult = await this.backupService.startBackup({
                udid: options.udid,
                password: options.password,
                forceFullBackup: options.forceFullBackup,
                skipApps: true, // Always skip apps to reduce backup size
            });
            if (this.isCancelled) {
                return this.errorResult('Sync cancelled by user');
            }
            if (!backupResult.success || !backupResult.backupPath) {
                return this.errorResult(backupResult.error || 'Backup failed');
            }
            let backupPath = backupResult.backupPath;
            // Step 2: Decrypt if needed
            if (backupResult.isEncrypted) {
                if (!options.password) {
                    this.emit('password-required');
                    return this.errorResult('Password required for encrypted backup');
                }
                this.setPhase('decrypting');
                this.emitProgress({
                    phase: 'decrypting',
                    phaseProgress: 0,
                    overallProgress: this.calculateOverallProgress('decrypting', 0),
                    message: 'Decrypting backup...',
                });
                const decryptResult = await this.decryptionService.decryptBackup(backupPath, options.password);
                if (this.isCancelled) {
                    return this.errorResult('Sync cancelled by user');
                }
                if (!decryptResult.success || !decryptResult.decryptedPath) {
                    return this.errorResult(decryptResult.error || 'Decryption failed');
                }
                backupPath = decryptResult.decryptedPath;
            }
            // Step 3: Parse contacts
            this.setPhase('parsing-contacts');
            this.emitProgress({
                phase: 'parsing-contacts',
                phaseProgress: 0,
                overallProgress: this.calculateOverallProgress('parsing-contacts', 0),
                message: 'Reading contacts...',
            });
            this.contactsParser.open(backupPath);
            const contacts = this.contactsParser.getAllContacts();
            this.emitProgress({
                phase: 'parsing-contacts',
                phaseProgress: 100,
                overallProgress: this.calculateOverallProgress('parsing-contacts', 100),
                message: `Found ${contacts.length} contacts`,
            });
            if (this.isCancelled) {
                this.contactsParser.close();
                return this.errorResult('Sync cancelled by user');
            }
            // Step 4: Parse messages
            this.setPhase('parsing-messages');
            this.emitProgress({
                phase: 'parsing-messages',
                phaseProgress: 0,
                overallProgress: this.calculateOverallProgress('parsing-messages', 0),
                message: 'Reading messages...',
            });
            this.messagesParser.open(backupPath);
            const conversations = this.messagesParser.getConversations();
            // Load messages for each conversation
            let loadedCount = 0;
            for (const conv of conversations) {
                if (this.isCancelled) {
                    break;
                }
                conv.messages = this.messagesParser.getMessages(conv.chatId);
                loadedCount++;
                if (loadedCount % 10 === 0) {
                    const progress = (loadedCount / conversations.length) * 100;
                    this.emitProgress({
                        phase: 'parsing-messages',
                        phaseProgress: progress,
                        overallProgress: this.calculateOverallProgress('parsing-messages', progress),
                        message: `Loading conversations: ${loadedCount}/${conversations.length}`,
                    });
                }
            }
            if (this.isCancelled) {
                this.messagesParser.close();
                this.contactsParser.close();
                return this.errorResult('Sync cancelled by user');
            }
            // Step 5: Resolve contact names
            this.setPhase('resolving');
            this.emitProgress({
                phase: 'resolving',
                phaseProgress: 0,
                overallProgress: this.calculateOverallProgress('resolving', 0),
                message: 'Resolving contact names...',
            });
            const resolvedConversations = this.resolveContactNames(conversations, contacts);
            // Step 6: Cleanup
            this.setPhase('cleanup');
            this.emitProgress({
                phase: 'cleanup',
                phaseProgress: 0,
                overallProgress: this.calculateOverallProgress('cleanup', 0),
                message: 'Cleaning up...',
            });
            this.messagesParser.close();
            this.contactsParser.close();
            // Cleanup decrypted files if we decrypted
            if (backupResult.isEncrypted && backupPath !== backupResult.backupPath) {
                await this.decryptionService.cleanup(backupPath);
            }
            // Calculate all messages from conversations
            const allMessages = resolvedConversations.flatMap((c) => c.messages);
            const duration = Date.now() - this.startTime;
            this.isRunning = false;
            this.setPhase('complete');
            electron_log_1.default.info('[SyncOrchestrator] Sync complete', {
                conversations: resolvedConversations.length,
                messages: allMessages.length,
                contacts: contacts.length,
                duration,
            });
            const result = {
                success: true,
                messages: allMessages,
                contacts,
                conversations: resolvedConversations,
                error: null,
                duration,
            };
            this.emit('complete', result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            electron_log_1.default.error('[SyncOrchestrator] Sync failed', { error: errorMessage });
            // Cleanup on error
            try {
                this.messagesParser.close();
                this.contactsParser.close();
            }
            catch {
                // Ignore cleanup errors
            }
            this.isRunning = false;
            this.setPhase('error');
            this.emit('error', error);
            return this.errorResult(errorMessage);
        }
    }
    /**
     * Cancel the current sync operation
     */
    cancel() {
        if (!this.isRunning) {
            return;
        }
        electron_log_1.default.info('[SyncOrchestrator] Cancelling sync');
        this.isCancelled = true;
        this.backupService.cancelBackup();
    }
    /**
     * Get current sync status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            phase: this.currentPhase,
        };
    }
    /**
     * Get connected devices
     */
    getConnectedDevices() {
        return this.deviceService.getConnectedDevices();
    }
    /**
     * Start device detection polling
     */
    startDeviceDetection(intervalMs = 2000) {
        this.deviceService.start(intervalMs);
    }
    /**
     * Stop device detection polling
     */
    stopDeviceDetection() {
        this.deviceService.stop();
    }
    /**
     * Resolve contact names in conversations
     */
    resolveContactNames(conversations, _contacts) {
        return conversations.map((conv) => {
            // Resolve participants to display names
            const resolvedParticipants = conv.participants.map((handle) => {
                const lookup = this.contactsParser.lookupByHandle(handle);
                return lookup.contact?.displayName || handle;
            });
            // Update conversation with resolved names
            return {
                ...conv,
                participants: resolvedParticipants,
                // Optionally resolve sender names in messages
                messages: conv.messages.map((msg) => {
                    if (!msg.isFromMe && msg.handle) {
                        const lookup = this.contactsParser.lookupByHandle(msg.handle);
                        // We don't modify the message handle, but the UI can use contacts for display
                    }
                    return msg;
                }),
            };
        });
    }
    /**
     * Set the current phase and emit event
     */
    setPhase(phase) {
        this.currentPhase = phase;
        this.emit('phase', phase);
    }
    /**
     * Emit a progress event
     */
    emitProgress(progress) {
        this.emit('progress', progress);
    }
    /**
     * Calculate overall progress based on phase weights
     */
    calculateOverallProgress(phase, phaseProgress) {
        const phaseWeights = {
            idle: { start: 0, weight: 0 },
            backup: { start: 0, weight: 60 }, // Backup is the longest phase
            decrypting: { start: 60, weight: 10 },
            'parsing-contacts': { start: 70, weight: 5 },
            'parsing-messages': { start: 75, weight: 15 },
            resolving: { start: 90, weight: 5 },
            cleanup: { start: 95, weight: 5 },
            complete: { start: 100, weight: 0 },
            error: { start: 0, weight: 0 },
        };
        const config = phaseWeights[phase];
        return config.start + (phaseProgress / 100) * config.weight;
    }
    /**
     * Get a human-readable backup progress message
     */
    getBackupProgressMessage(progress) {
        switch (progress.phase) {
            case 'preparing':
                return 'Preparing backup...';
            case 'transferring':
                if (progress.filesTransferred && progress.totalFiles) {
                    return `Transferring files: ${progress.filesTransferred}/${progress.totalFiles}`;
                }
                return `Transferring... ${Math.round(progress.percentComplete)}%`;
            case 'finishing':
                return 'Finalizing backup...';
            case 'extracting':
                return 'Extracting data...';
            case 'decrypting':
                return 'Decrypting...';
            default:
                return `Backing up... ${Math.round(progress.percentComplete)}%`;
        }
    }
    /**
     * Create an error result
     */
    errorResult(error) {
        return {
            success: false,
            messages: [],
            contacts: [],
            conversations: [],
            error,
            duration: Date.now() - this.startTime,
        };
    }
}
exports.SyncOrchestrator = SyncOrchestrator;
// Export singleton instance
exports.syncOrchestrator = new SyncOrchestrator();
exports.default = exports.syncOrchestrator;
