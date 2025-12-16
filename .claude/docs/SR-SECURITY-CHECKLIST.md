# SR Engineer Security & Compliance Checklist

This checklist defines what the SR Engineer must verify for security, compliance, and vulnerability management. These are the questions a senior engineer asks to ensure the system is secure and production-ready.

---

## 1. Security Measures Assessment

### Core Security Questions

Ask yourself:
- What security measures are currently in place?
- What security measures are MISSING?
- Are there gaps that create unacceptable risk?

### Authentication & Authorization

- [ ] User authentication implemented and tested
- [ ] Session management secure (expiration, refresh, invalidation)
- [ ] OAuth tokens encrypted with OS keychain (never exposed to renderer)
- [ ] Keychain availability checks in place (what happens if keychain fails?)
- [ ] Incident playbook exists for token compromise
- [ ] Failed login handling (lockout, delay, alerting)
- [ ] Role-based access controls enforced where applicable

### Input Validation & Injection Prevention

- [ ] All user inputs validated and sanitized
- [ ] SQL injection prevention (parameterized queries only)
- [ ] XSS prevention (React auto-escaping maintained)
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] Linters/tests block reintroducing risky patterns
- [ ] Path traversal prevention on file operations
- [ ] Command injection prevention on shell operations

### Electron-Specific Security

- [ ] `contextIsolation: true` enabled
- [ ] `nodeIntegration: false` in renderer
- [ ] Preload script exposes minimal API surface
- [ ] IPC surface hardened (76+ handlers validated)
- [ ] IPC inputs schema-validated to prevent injection
- [ ] No remote content loaded in main window
- [ ] `webSecurity` not disabled
- [ ] CSP is strict in production
- [ ] Build tooling honors CSP (no dev-only allowances leak)
- [ ] Periodic IPC fuzzing recommended

---

## 2. SOC 2 Compliance Assessment

### SOC 2 Type 1 (Controls Exist)

Ask yourself:
- Do we have the security controls in place?
- Are they documented?
- Can we demonstrate they exist?

**Access Controls**
- [ ] User authentication implemented
- [ ] Access logging in place
- [ ] Session timeout configured
- [ ] Administrative access restricted

**Data Protection Controls**
- [ ] Encryption at rest implemented
- [ ] Encryption in transit implemented
- [ ] Data classification defined
- [ ] PII handling documented

**Audit & Monitoring**
- [ ] User actions logged
- [ ] System events logged
- [ ] Log retention policy defined
- [ ] Logs protected from tampering
- [ ] Logging around auth and export flows defined

### SOC 2 Type 2 (Controls Operating Effectively)

Ask yourself:
- Have controls been tested over time?
- Is there evidence of effectiveness?
- Are monitoring and alerting functional?

**Evidence Requirements**
- [ ] Controls tested over audit period
- [ ] Monitoring alerts functional and tested
- [ ] Incident response procedures tested
- [ ] Access reviews performed periodically

**Gap Documentation**

For any gaps, document:
```markdown
| Control Area | Status | Gap Description | Remediation | Priority |
|--------------|--------|-----------------|-------------|----------|
| [area] | [Implemented/Partial/Missing] | [what's missing] | [BACKLOG-XXX] | [H/M/L] |
```

---

## 3. Data Protection Requirements

### Data in Transit

Ask yourself:
- Is ALL data encrypted in transit?
- Are there any unencrypted channels?
- Are certificates properly validated?

**Verification Checklist**
- [ ] All API calls use HTTPS/TLS 1.2+
- [ ] No `http://` URLs in production code (except localhost)
- [ ] Certificate validation enabled (not bypassed)
- [ ] WebSocket connections use `wss://`
- [ ] No sensitive data in query strings or URLs
- [ ] Supabase connection encrypted
- [ ] Microsoft Graph API calls encrypted
- [ ] Gmail API calls encrypted
- [ ] Certificate pinning considered for sensitive APIs

**Verification Command:**
```bash
grep -rn "http://" src/ --include="*.ts" --include="*.tsx" | grep -v "localhost\|127.0.0.1"
```

### Data at Rest

Ask yourself:
- Is ALL persistent data encrypted?
- Where is the encryption key stored?
- What happens if encryption fails?

**Verification Checklist**
- [ ] SQLite database encrypted (better-sqlite3-multiple-ciphers)
- [ ] Encryption key stored in OS keychain (macOS) / Credential Manager (Windows)
- [ ] Key derivation uses secure algorithm
- [ ] Sensitive fields encrypted before storage
- [ ] Backup files encrypted
- [ ] Temp files cleaned up after use
- [ ] No plaintext sensitive data on disk

---

## 4. Dependency & Vulnerability Management

### Dependency Audit

Ask yourself:
- Have all unused dependencies been removed?
- Are there known vulnerabilities?
- Are dependencies actively maintained?

**Verification Checklist**
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] `npm audit` shows no high vulnerabilities (or documented exceptions)
- [ ] Dependabot alerts addressed (track: X high, Y moderate, Z low)
- [ ] Unused dependencies removed (`npx depcheck`)
- [ ] Dev dependencies correctly categorized
- [ ] All dependencies actively maintained (recent commits)
- [ ] License compatibility verified
- [ ] SBOM (Software Bill of Materials) generated for releases

**Automation**
- [ ] Automated patch releases configured
- [ ] Dependabot or similar scanning enabled
- [ ] Third-party risk monitored over time

### Package Size Assessment

Ask yourself:
- Is the package size reasonable for the functionality?
- Is it too small (missing assets/code)?
- Is it too large (bloat, unused code)?

**Investigation if size is concerning:**
- [ ] Check for duplicate dependencies in bundle
- [ ] Check for unused code not tree-shaken
- [ ] Check for large assets that should be lazy-loaded
- [ ] Verify source maps not included in production
- [ ] Analyze with `npx source-map-explorer` or bundle analyzer

---

## 5. IPC Security (Electron-Specific)

### IPC Surface Hardening

Given 76+ IPC handlers, ask yourself:
- Is each handler's input validated?
- Can malicious input cause harm?
- Are there injection vectors?

**Verification Checklist**
- [ ] Context isolation enabled
- [ ] Preload bridging implemented correctly
- [ ] `nodeIntegration` disabled in renderer
- [ ] Each IPC handler validates input schema
- [ ] No arbitrary code execution from renderer input
- [ ] File paths validated in handlers
- [ ] SQL inputs parameterized
- [ ] Periodic fuzzing of IPC inputs recommended

### Complex IPC Workflows

For multi-step flows (auth, scanning, exports):
- [ ] Timeout handling implemented
- [ ] Retry logic safe (no duplicate operations)
- [ ] Cancellation handled properly
- [ ] Error states don't leak sensitive info
- [ ] Integration tests cover happy and error paths
- [ ] Chaos testing considered for resilience

---

## 6. Operational Security

### Logging & Monitoring

Ask yourself:
- What is logged?
- What SHOULD be logged?
- Is sensitive data redacted?

**Verification Checklist**
- [ ] Auth events logged (login, logout, failures)
- [ ] Export/sync operations logged
- [ ] Errors logged with context (not sensitive data)
- [ ] PII redacted from logs
- [ ] Credentials never logged
- [ ] Log retention policy defined
- [ ] Log review routines established
- [ ] Electron logging configured correctly

### Platform Dependencies

For macOS/Windows specific requirements:
- [ ] macOS Full Disk Access requirement documented
- [ ] Health checks for platform dependencies
- [ ] Installer-time validations reduce friction
- [ ] Native module rebuilds documented
- [ ] Keychain/Credential Manager access tested

---

## 7. Security Review Output Format

When completing security review, document:

```markdown
## Security Assessment: [PR/Release]

### 1. Security Measures
| Area | Status | Notes |
|------|--------|-------|
| Authentication | PASS/FAIL/PARTIAL | |
| Input Validation | PASS/FAIL/PARTIAL | |
| Electron Security | PASS/FAIL/PARTIAL | |
| IPC Hardening | PASS/FAIL/PARTIAL | |

### 2. Compliance
| Control | Status | Gap | Remediation |
|---------|--------|-----|-------------|
| SOC 2 Access | PASS/FAIL | | |
| SOC 2 Data Protection | PASS/FAIL | | |
| SOC 2 Audit Trail | PASS/FAIL | | |

### 3. Data Protection
| Requirement | Status | Notes |
|-------------|--------|-------|
| In Transit Encryption | PASS/FAIL | |
| At Rest Encryption | PASS/FAIL | |

### 4. Dependencies
| Check | Status | Notes |
|-------|--------|-------|
| Security Audit | PASS/FAIL | X critical, Y high |
| Unused Removed | PASS/FAIL | |
| Package Size | OK/REVIEW | X MB |

### 5. Gaps Identified
[List any gaps with BACKLOG-XXX references]

### 6. Risk Assessment
[Overall risk and recommendation]

### 7. Verdict
- [ ] APPROVED - All security requirements met
- [ ] APPROVED WITH CONDITIONS - Document accepted risks
- [ ] BLOCKED - Security issues must be resolved
```

---

## 8. Periodic Security Tasks

### Weekly
- [ ] Review Dependabot alerts
- [ ] Check for new CVEs affecting dependencies

### Monthly
- [ ] Full `npm audit` review
- [ ] IPC handler inventory check
- [ ] Log review for anomalies

### Quarterly
- [ ] Full security assessment against this checklist
- [ ] SOC 2 control effectiveness review
- [ ] Penetration testing / security audit consideration

### Before Each Release
- [ ] Complete this entire checklist
- [ ] Document any exceptions with risk acceptance
- [ ] Ensure no regressions from previous release
