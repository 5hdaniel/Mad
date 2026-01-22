# Security Patterns

**Status:** Reference documentation for security practices
**Last Updated:** 2024-12-27

---

## Overview

Magic Audit implements defense-in-depth security with multiple layers of protection.

**Current Security Rating:** 8.5/10

---

## SQL Injection Protection

### Layer 1: Parameterized Queries (100% Coverage)

All database operations use parameterized queries via better-sqlite3 prepared statements.

**Location:** electron/services/db/core/dbConnection.ts

Helper functions:
- dbGet - Single row queries
- dbAll - Multi-row queries
- dbRun - INSERT/UPDATE/DELETE

### Layer 2: SQL Field Whitelist

Dynamic field names validated against whitelist.

**Location:** electron/utils/sqlFieldWhitelist.ts

Tables: users_local, oauth_tokens, contacts, transactions, communications, transaction_contacts

### Layer 3: Input Validation

All IPC inputs validated before database layer.

**Location:** electron/utils/validation.ts

### Layer 4: Query Timeout

busy_timeout = 5000 prevents query hangs.

---

## XSS Protection

### Layer 1: React Auto-Escaping

React escapes JSX content automatically.

### Layer 2: Content Security Policy

**Location:** electron/main.ts - setupContentSecurityPolicy()

Key protections: script-src self, object-src none, frame-ancestors none

### Layer 3: Electron Context Isolation

contextIsolation: true, nodeIntegration: false

---

## Command Injection Protection

### Layer 1: UDID Validation

Device UDIDs validated before spawn/exec.

Formats: Traditional (40 hex), Modern (8-4-16), Simulator (UUID)

### Layer 2: Path Validation

Blocks: path traversal (.., ~), shell metacharacters

### Layer 3: Spawn Argument Arrays

Use spawn() with arrays, not shell strings.

---

## Authentication Protection

### Token Storage

SQLCipher AES-256 encryption.

### Session Validation

All IPC handlers validate session tokens.

---

## Data Validation Patterns

### String Length Limits

| Field | Max |
|-------|-----|
| Email | 254 |
| File path | 4096 |
| Name | 200 |
| Notes | 10000 |
| Auth code | 1000 |

### Prototype Pollution Prevention

Removes __proto__, constructor, prototype keys.

---

## Security Checklist for New Features

### Database Operations
- Parameterized statements only
- Field names in whitelist
- UUIDs validated
- Typed results

### IPC Handlers
- Validate all inputs
- Length limits on strings
- Sanitize objects
- No stack traces to renderer

### File Operations
- validateFilePath()
- No traversal sequences
- Max 4096 chars
- Expected directories only

### External Commands
- validateDeviceUdid()
- validateExecutablePath()
- spawn() with arrays
- No shell concatenation

### Renderer Content
- React JSX rendering
- No dangerouslySetInnerHTML
- Validate external URLs
- No eval()

### Secrets
- Never log secrets
- Never send to renderer
- Use environment variables
- Secure key derivation

---

## Adding New Validation

1. Add to electron/utils/validation.ts
2. Use ValidationError pattern
3. Add tests
4. Document here

---

## References

- Validation: electron/utils/validation.ts
- Field whitelist: electron/utils/sqlFieldWhitelist.ts
- DB connection: electron/services/db/core/dbConnection.ts
- CSP: electron/main.ts
- Preload: electron/preload/*.ts
