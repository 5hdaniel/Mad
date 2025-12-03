"use strict";
/**
 * Rate Limit Service
 * Provides brute-force protection for authentication endpoints
 * Tracks failed login attempts and implements account lockout
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logService_1 = __importDefault(require("./logService"));
/**
 * Rate Limit Service Class
 * Implements in-memory rate limiting with configurable thresholds
 */
class RateLimitService {
    constructor() {
        this.attempts = new Map();
        // Configuration constants
        this.MAX_ATTEMPTS = 5;
        this.WINDOW_MS = 15 * 60 * 1000; // 15 minutes
        this.LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
    }
    /**
     * Hash an identifier to avoid storing plaintext emails
     * @param identifier - The identifier to hash (e.g., email)
     * @returns Hashed identifier
     */
    hashIdentifier(identifier) {
        return crypto_1.default.createHash('sha256').update(identifier.toLowerCase()).digest('hex');
    }
    /**
     * Check if an identifier is rate limited
     * @param identifier - The identifier to check (e.g., email)
     * @returns Rate limit check result
     */
    async checkRateLimit(identifier) {
        const hashedId = this.hashIdentifier(identifier);
        const entry = this.attempts.get(hashedId);
        const now = Date.now();
        // Check if account is locked
        if (entry?.lockedUntil && now < entry.lockedUntil) {
            const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
            await logService_1.default.warn('Rate limit: Account locked', 'RateLimitService', {
                identifier: hashedId.substring(0, 8) + '...', // Log only partial hash
                lockedUntil: new Date(entry.lockedUntil).toISOString(),
                retryAfterSeconds
            });
            return {
                allowed: false,
                remainingAttempts: 0,
                lockedUntil: new Date(entry.lockedUntil),
                retryAfterSeconds,
            };
        }
        // Reset if window expired or lockout expired
        if (entry) {
            const windowExpired = now - entry.firstAttempt > this.WINDOW_MS;
            const lockoutExpired = entry.lockedUntil && now >= entry.lockedUntil;
            if (windowExpired || lockoutExpired) {
                this.attempts.delete(hashedId);
                return {
                    allowed: true,
                    remainingAttempts: this.MAX_ATTEMPTS,
                };
            }
        }
        const currentAttempts = entry?.attempts || 0;
        const remainingAttempts = Math.max(0, this.MAX_ATTEMPTS - currentAttempts);
        return {
            allowed: true,
            remainingAttempts,
        };
    }
    /**
     * Record an authentication attempt
     * @param identifier - The identifier to track (e.g., email)
     * @param success - Whether the attempt was successful
     */
    async recordAttempt(identifier, success) {
        const hashedId = this.hashIdentifier(identifier);
        if (success) {
            // Clear attempts on successful authentication
            this.attempts.delete(hashedId);
            await logService_1.default.info('Rate limit: Cleared after successful authentication', 'RateLimitService', { identifier: hashedId.substring(0, 8) + '...' });
            return;
        }
        // Record failed attempt
        const now = Date.now();
        const entry = this.attempts.get(hashedId) || {
            attempts: 0,
            firstAttempt: now,
            lockedUntil: null,
        };
        entry.attempts++;
        // Check if lockout threshold reached
        if (entry.attempts >= this.MAX_ATTEMPTS) {
            entry.lockedUntil = now + this.LOCKOUT_MS;
            await logService_1.default.error('Rate limit: Account locked due to too many failed attempts', 'RateLimitService', {
                identifier: hashedId.substring(0, 8) + '...',
                attempts: entry.attempts,
                lockedUntil: new Date(entry.lockedUntil).toISOString()
            });
        }
        else {
            await logService_1.default.warn('Rate limit: Failed authentication attempt recorded', 'RateLimitService', {
                identifier: hashedId.substring(0, 8) + '...',
                attempts: entry.attempts,
                remainingAttempts: this.MAX_ATTEMPTS - entry.attempts
            });
        }
        this.attempts.set(hashedId, entry);
    }
    /**
     * Get remaining attempts for an identifier
     * @param identifier - The identifier to check
     * @returns Number of remaining attempts
     */
    async getRemainingAttempts(identifier) {
        const result = await this.checkRateLimit(identifier);
        return result.remainingAttempts;
    }
    /**
     * Check if an identifier is currently locked out
     * @param identifier - The identifier to check
     * @returns Whether the identifier is locked
     */
    async isLocked(identifier) {
        const result = await this.checkRateLimit(identifier);
        return !result.allowed;
    }
    /**
     * Manually unlock an identifier (admin function)
     * @param identifier - The identifier to unlock
     */
    async unlock(identifier) {
        const hashedId = this.hashIdentifier(identifier);
        this.attempts.delete(hashedId);
        await logService_1.default.info('Rate limit: Account manually unlocked', 'RateLimitService', { identifier: hashedId.substring(0, 8) + '...' });
    }
    /**
     * Clear all rate limit entries (for testing or admin purposes)
     */
    async clearAll() {
        this.attempts.clear();
        await logService_1.default.info('Rate limit: All entries cleared', 'RateLimitService');
    }
    /**
     * Get current configuration values
     */
    getConfig() {
        return {
            maxAttempts: this.MAX_ATTEMPTS,
            windowMs: this.WINDOW_MS,
            lockoutMs: this.LOCKOUT_MS,
        };
    }
}
// Export singleton instance
exports.rateLimitService = new RateLimitService();
exports.default = exports.rateLimitService;
