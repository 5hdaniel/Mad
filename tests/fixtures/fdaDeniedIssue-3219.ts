/**
 * BACKLOG-3219 / BACKLOG-3210 (part 2) — the Full Disk Access denial, as the
 * producers actually emit it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS RATHER THAN A LITERAL IN EACH SUITE
 * ---------------------------------------------------------------------------
 * Three suites on both sides of the IPC boundary assert on this object:
 * the main-process transcription
 * (`electron/services/__tests__/permissionService.fdaDeniedShape-3219.test.ts`),
 * the health-check handler
 * (`electron/handlers/__tests__/diagnosticHandlers.fdaIssueAction-3219.test.ts`)
 * and the renderer banner
 * (`src/components/__tests__/SystemHealthMonitor.test.tsx`). If each wrote its
 * own literal, a producer change would move the real object while every suite
 * went on asserting the old one — green for the wrong reason, which is the
 * failure this repo has hit twice.
 *
 * The transcription suite asserts that `DENIED` below equals what the REAL
 * `permissionService.checkFullDiskAccess()` returns. Drift the constant and
 * that suite reds FIRST, then everything fed from it.
 *
 * These are TEST FIXTURES ONLY. Nothing in `src/` or `electron/` imports this
 * file, so it never crosses the main/renderer boundary at runtime.
 */

/**
 * `permissionService.checkFullDiskAccess()` on a Mac that cannot read
 * `~/Library/Messages/chat.db`, minus `error` — that field carries the raw
 * errno message including an absolute path, which differs per machine and is
 * asserted as "a non-empty string" rather than pinned.
 *
 * NOTE WHAT IS ABSENT, because the whole of item 2 rests on it: there is no
 * `actionHandler`, no `title` and no `severity`. `SystemHealthMonitor` keys its
 * button entirely off `actionHandler`, so before BACKLOG-3219 this row's button
 * hit the `default:` branch and did nothing. The transcription suite asserts
 * the absence directly, so "the button was dead" is measured rather than read.
 */
export const FDA_DENIED_PERMISSION_RESULT = {
  hasPermission: false,
  errorCode: "FULL_DISK_ACCESS_DENIED",
  userMessage: "Full Disk Access permission is required to read iMessages.",
  action:
    "Please grant Full Disk Access in System Settings > Privacy & Security > Full Disk Access",
} as const;

/**
 * `permissionService.checkContactsPermission()` when macOS refuses the address
 * book. Same denial, second row — `~/Library/Application Support/AddressBook`
 * is behind the same permission, so a denied Mac raises both.
 */
export const CONTACTS_DENIED_PERMISSION_RESULT = {
  hasPermission: false,
  errorCode: "CONTACTS_ACCESS_DENIED",
  userMessage:
    "Contacts permission is required to match phone numbers to names.",
  action:
    "Full Disk Access in System Settings > Privacy & Security > Full Disk Access will grant access to Contacts",
} as const;

/**
 * BACKLOG-3210 part 1's third outcome: the address book is not on this Mac at
 * all. Deliberately NOT decorated with an explainer action — sending this user
 * to grant a permission she may already hold is the BACKLOG-2392 bug.
 */
export const CONTACTS_STORE_NOT_FOUND_PERMISSION_RESULT = {
  hasPermission: false,
  errorCode: "CONTACTS_STORE_NOT_FOUND",
  userMessage:
    "Contacts permission is required to match phone numbers to names.",
  action:
    "Full Disk Access in System Settings > Privacy & Security > Full Disk Access will grant access to Contacts",
} as const;

/** The button label the health banner must show for an FDA denial. */
export const FDA_EXPLAINER_ACTION_LABEL = "Show me how";

/** The handler `SystemHealthMonitor` must recognise for an FDA denial. */
export const FDA_EXPLAINER_ACTION_HANDLER = "open-fda-explainer";

/**
 * What the renderer actually receives for an FDA denial after
 * `diagnosticHandlers` decorates it: the producer's object, with a button
 * label short enough to be a button and a handler that goes somewhere.
 */
export const FDA_DENIED_BANNER_ISSUE = {
  ...FDA_DENIED_PERMISSION_RESULT,
  error: "EPERM: operation not permitted",
  action: FDA_EXPLAINER_ACTION_LABEL,
  actionHandler: FDA_EXPLAINER_ACTION_HANDLER,
} as const;
