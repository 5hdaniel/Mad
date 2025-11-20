"use strict";
/**
 * Logging Service for application-wide logging
 * Provides structured logging with different severity levels
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logService = exports.LogService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Logging Service Class
 * Manages application logging with support for different levels and outputs
 */
class LogService {
    constructor(config = {}) {
        this.LOG_LEVELS = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        this.config = {
            logToFile: false,
            logToConsole: true,
            minLevel: 'info',
            maxLogFiles: 10,
            ...config,
        };
        if (this.config.logToFile && this.config.logDirectory) {
            this.initializeLogFile();
        }
    }
    /**
     * Initialize log file path
     */
    initializeLogFile() {
        if (!this.config.logDirectory) {
            return;
        }
        try {
            // Ensure log directory exists
            if (!fs.existsSync(this.config.logDirectory)) {
                fs.mkdirSync(this.config.logDirectory, { recursive: true });
            }
            // Create log file with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.logFilePath = path.join(this.config.logDirectory, `app-${timestamp}.log`);
            // Rotate old log files if needed
            this.rotateLogFiles();
        }
        catch (error) {
            console.error('Failed to initialize log file:', error);
        }
    }
    /**
     * Rotate old log files to maintain max count
     */
    rotateLogFiles() {
        if (!this.config.logDirectory || !this.config.maxLogFiles) {
            return;
        }
        try {
            const files = fs
                .readdirSync(this.config.logDirectory)
                .filter((file) => file.startsWith('app-') && file.endsWith('.log'))
                .map((file) => ({
                name: file,
                path: path.join(this.config.logDirectory, file),
                time: fs.statSync(path.join(this.config.logDirectory, file)).mtime.getTime(),
            }))
                .sort((a, b) => b.time - a.time);
            // Remove old files beyond max count
            if (files.length >= this.config.maxLogFiles) {
                files.slice(this.config.maxLogFiles - 1).forEach((file) => {
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch (error) {
                        console.error(`Failed to delete old log file ${file.name}:`, error);
                    }
                });
            }
        }
        catch (error) {
            console.error('Failed to rotate log files:', error);
        }
    }
    /**
     * Check if a log level should be logged based on configuration
     */
    shouldLog(level) {
        const minLevel = this.config.minLevel || 'info';
        return this.LOG_LEVELS[level] >= this.LOG_LEVELS[minLevel];
    }
    /**
     * Format log entry for output
     */
    formatLogEntry(entry) {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        const context = entry.context ? `[${entry.context}]` : '';
        const metadata = entry.metadata
            ? `\n${JSON.stringify(entry.metadata, null, 2)}`
            : '';
        return `${timestamp} ${level} ${context} ${entry.message}${metadata}`;
    }
    /**
     * Write log entry to file
     */
    async writeToFile(formattedEntry) {
        if (!this.logFilePath) {
            return;
        }
        return new Promise((resolve, reject) => {
            fs.appendFile(this.logFilePath, formattedEntry + '\n', (error) => {
                if (error) {
                    console.error('Failed to write to log file:', error);
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Write log entry to console
     */
    writeToConsole(level, formattedEntry) {
        switch (level) {
            case 'debug':
                console.debug(formattedEntry);
                break;
            case 'info':
                console.info(formattedEntry);
                break;
            case 'warn':
                console.warn(formattedEntry);
                break;
            case 'error':
                console.error(formattedEntry);
                break;
        }
    }
    /**
     * Core logging method
     */
    async log(level, message, context, metadata) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
            timestamp: new Date(),
            level,
            message,
            context,
            metadata,
        };
        const formattedEntry = this.formatLogEntry(entry);
        if (this.config.logToConsole) {
            this.writeToConsole(level, formattedEntry);
        }
        if (this.config.logToFile) {
            await this.writeToFile(formattedEntry);
        }
    }
    /**
     * Log debug message
     */
    async debug(message, context, metadata) {
        await this.log('debug', message, context, metadata);
    }
    /**
     * Log info message
     */
    async info(message, context, metadata) {
        await this.log('info', message, context, metadata);
    }
    /**
     * Log warning message
     */
    async warn(message, context, metadata) {
        await this.log('warn', message, context, metadata);
    }
    /**
     * Log error message
     */
    async error(message, context, metadata) {
        await this.log('error', message, context, metadata);
    }
    /**
     * Update logging configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        // Reinitialize log file if directory changed
        if (newConfig.logDirectory && this.config.logToFile) {
            this.initializeLogFile();
        }
    }
    /**
     * Get current configuration
     */
    async getConfig() {
        return { ...this.config };
    }
    /**
     * Clear log file
     */
    async clearLogs() {
        if (!this.logFilePath) {
            return;
        }
        return new Promise((resolve, reject) => {
            fs.writeFile(this.logFilePath, '', (error) => {
                if (error) {
                    console.error('Failed to clear log file:', error);
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
exports.LogService = LogService;
/**
 * Singleton instance of LogService
 */
exports.logService = new LogService();
exports.default = exports.logService;
