/**
 * The macOS Messages import progress phase — ONE definition (BACKLOG-2832).
 *
 * This file has NO imports on purpose. It is the leaf that both the main side
 * (the producer's `ImportProgressCallback`, the preload bridge, the IPC
 * contract) and the renderer (`messageService`, `ImportProgressModal`,
 * `MacOSMessagesImportSettings`, `useAuditCoverageCheck`) derive from, so the
 * declared union cannot drift from the one the producer emits.
 *
 * WHY THIS EXISTS: `window-api-messages.ts` declared `onImportProgress` with a
 * hand-written three-member union that omitted `"querying"` — a phase the
 * producer has always emitted (`macOSMessagesImportService.ts:763`, `:915`).
 * Six copies of the same union existed in production code; three of them were
 * missing that member. Nothing caught it because the preload bridge object
 * carries no contract-type annotation, so the contract's union and the
 * preload's were unrelated declarations with nothing comparing them. The
 * renderer survived by widening away from the declared type.
 *
 * DELIBERATELY NOT IN THE `./index.ts` BARREL. `src/types/index.ts` does
 * `export * from "../../electron/types/ipc"`, which is the one path by which a
 * runtime `const` could ride into the renderer bundle. `communicationLifecycle.ts`
 * (BACKLOG-2818) is kept out for the same reason. Renderer consumers import
 * `ImportPhase` from this path with `import type`, which erases at compile time.
 *
 * Pinned by `__tests__/importPhase-2832.test.ts`, which asserts the contract,
 * the producer and the preload all resolve to THIS type — the assertion that
 * makes re-forking any one of them a compile error rather than a silent drift.
 */

/**
 * Every phase the import progress stream can report.
 *
 * NOTE ON `"deleting"`: declared but emitted by nothing since `01b521eab`
 * (stage-and-swap Force Re-import, BACKLOG-2790) removed the delete-then-insert
 * pass. It stays because `SyncOrchestratorService.ts` still branches on it to
 * choose a four-phase vs three-phase progress weighting, and the Settings panel
 * still renders a label for it — removing the member is a renderer compile
 * error and a change to progress weighting, neither of which belongs in a
 * type-correctness fix. Tracked by BACKLOG-3122.
 */
export type ImportPhase = "querying" | "deleting" | "importing" | "attachments";

/**
 * Every phase, once, as data — for iteration and for the compile-time coverage
 * check below. Order is the order the phases actually run, which
 * `SyncOrchestratorService` relies on for `indexOf`-based progress weighting.
 */
export const IMPORT_PHASES = [
  "querying",
  "deleting",
  "importing",
  "attachments",
] as const;

/**
 * Compile-time proof that `IMPORT_PHASES` lists every member of the union and
 * nothing else.
 *
 * `Tuple extends readonly Union[]` rejects an EXTRA member; the `Exclude` arm
 * rejects a MISSING one. Add a fifth phase to the union without adding it here
 * and `tsc` fails on this line with the missing name in the error text.
 *
 * This lives in the shipped module rather than only in the test file so that
 * `npm run type-check` catches it too — that config does not cover test files.
 */
type AssertTupleCoversUnion<
  Union extends string,
  Tuple extends readonly Union[],
> = Exclude<Union, Tuple[number]> extends never
  ? true
  : { readonly missingFromImportPhases: Exclude<Union, Tuple[number]> };

const _IMPORT_PHASES_COVER_THE_UNION: AssertTupleCoversUnion<
  ImportPhase,
  typeof IMPORT_PHASES
> = true;
void _IMPORT_PHASES_COVER_THE_UNION;
