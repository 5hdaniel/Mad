/**
 * BACKLOG-3275 — PROOF OF THE DEFECT.
 *
 * These assertions describe the CURRENT (wrong) behaviour and are written to
 * PASS. They are the "before" state. A fix whose before-state was never made to
 * fail is unverified.
 *
 * COMMIT 1 (refactor) translates them to the Full Disk Access union and they
 * STAY GREEN — that is the control proving the refactor changed nothing.
 * COMMIT 2 (fix) is where they go red and are rewritten to assert the correct
 * behaviour.
 *
 * Fixture provenance: identical in shape to `reducer.fdaSkip.test.ts`'s
 * `declinedFdaWithMailbox`, which documents its own provenance back to
 * `LoadingOrchestrator` Phase 4 and `preferenceHandlers.onboardingSkip.test.ts`.
 * Here `hasEmailConnected` is false because that is what keeps the user in
 * onboarding long enough to dispatch a step completion.
 */
import { appStateReducer } from "./reducer";
import { isFdaGranted } from "./fdaState";
import { selectSetupIncomplete } from "./selectors";
import type { AppState, LoadingState, PlatformInfo, User, UserData } from "./types";

const mockUser: User = { id: "user-123", email: "test@example.com", displayName: "Test User" };
const macOS: PlatformInfo = { isMacOS: true, isWindows: false, hasIPhone: true };

/** A macOS user who DECLINED Full Disk Access and has no mailbox yet. */
const declinedFdaNoMailbox: UserData = {
  phoneType: "iphone",
  hasCompletedEmailOnboarding: true,
  hasEmailConnected: false,
  needsDriverSetup: false,
  fda: "declined",
};

const loading: LoadingState = { status: "loading", phase: "loading-user-data" };

function load(data: UserData): AppState {
  return appStateReducer(loading, { type: "USER_DATA_LOADED", data, user: mockUser, platform: macOS });
}

describe("BACKLOG-3275 — declined Full Disk Access is reported as granted", () => {
  it("PRECONDITION: the declined user is routed to onboarding with `permissions` already answered", () => {
    const onboarding = load(declinedFdaNoMailbox);
    expect(onboarding.status).toBe("onboarding");
    if (onboarding.status !== "onboarding") return;
    expect(onboarding.completedSteps).toContain("permissions");
    expect(onboarding.fda).toBe("declined");
    expect(isFdaGranted(onboarding.fda!)).toBe(false);
  });

  it("DEFECT 1 (inversion): completing any OTHER step reports the capability as granted", () => {
    const onboarding = load(declinedFdaNoMailbox);
    const after = appStateReducer(onboarding, { type: "ONBOARDING_STEP_COMPLETE", step: "email-connect" });

    expect(after.status).toBe("ready");
    if (after.status !== "ready") return;
    // WRONG, and this is the point: the user declined.
    expect(isFdaGranted(after.userData.fda)).toBe(true);
  });

  it("DEFECT 2 (erasure): the same transition destroys the recorded decline", () => {
    const onboarding = load(declinedFdaNoMailbox);
    const after = appStateReducer(onboarding, { type: "ONBOARDING_STEP_COMPLETE", step: "email-connect" });
    if (after.status !== "ready") throw new Error("expected ready");
    // WRONG: `"declined"` went in, and the fact that the user was ASKED is gone.
    //
    // Before the union this was visibly a SECOND defect — `fdaSkipped: true`
    // went in and `undefined` came out, independent of the `hasPermissions`
    // inversion above (SR's mutation control: deleting the inversion left this
    // assertion green). One named state makes them one defect, which is the
    // structural argument for this item.
    expect(after.userData.fda).not.toBe("declined");
  });

  it("DEFECT 3 (masking): re-entering email setup carries the lie in and the decline out", () => {
    const onboarding = load(declinedFdaNoMailbox);
    const ready = appStateReducer(onboarding, { type: "ONBOARDING_STEP_COMPLETE", step: "email-connect" });
    if (ready.status !== "ready") throw new Error("expected ready");

    const back = appStateReducer(ready, { type: "START_EMAIL_SETUP" });
    expect(back.status).toBe("onboarding");
    if (back.status !== "onboarding") return;
    // OnboardingFlow seeds `permissions` as manually-complete off a recorded
    // decline (BACKLOG-3212). It is gone, so that seeding no longer happens...
    expect(back.fda).not.toBe("declined");
    // ...and the only reason the user is not re-asked is that the inverted
    // value hides the step instead. Fixing either defect alone re-opens 3212.
    expect(isFdaGranted(back.fda!)).toBe(true);
  });

  it("DEFECT 4 (live): the corrupted value suppresses the Resume-Setup banner for a zero-source user", () => {
    // Chain: declined -> ready (corrupted) -> the Resume/Email affordance
    // dispatches START_EMAIL_SETUP (useNavigationFlow.ts:121) -> the user does
    // not connect a mailbox -> the queue reports done (OnboardingFlow.tsx:474)
    // -> ready again, now with NO data source at all.
    //
    // Narrowed per SR review: this requires the ONBOARDING_QUEUE_DONE exit
    // specifically. Exiting via ONBOARDING_STEP_COMPLETE recovers `phoneType`
    // from `platform.hasIPhone`, and the floor then passes on the phone
    // regardless of Full Disk Access.
    const onboarding = load(declinedFdaNoMailbox);
    const ready1 = appStateReducer(onboarding, { type: "ONBOARDING_STEP_COMPLETE", step: "email-connect" });
    if (ready1.status !== "ready") throw new Error("expected ready");

    const back = appStateReducer(ready1, { type: "START_EMAIL_SETUP" });
    const ready2 = appStateReducer(back, { type: "ONBOARDING_QUEUE_DONE" });
    expect(ready2.status).toBe("ready");
    if (ready2.status !== "ready") return;

    // Zero real sources: no mailbox, no phone selection carried across
    // (BACKLOG-3276, a separate defect), and Full Disk Access was declined.
    expect(ready2.userData.hasEmailConnected).toBe(false);
    expect(ready2.userData.phoneType).toBeNull();
    expect(isFdaGranted(ready2.userData.fda)).toBe(true); // the lie

    // BACKLOG-1821 floor via BACKLOG-1709/1711: the banner is suppressed.
    expect(selectSetupIncomplete(ready2)).toBe(false);

    // DISCRIMINATING CONTROL: the identical state with an HONEST value raises
    // the banner. The corruption is the only difference.
    const honest = { ...ready2, userData: { ...ready2.userData, fda: "declined" as const } };
    expect(selectSetupIncomplete(honest)).toBe(true);
  });

  it("CONTROL: a user who NEVER answered is indistinguishable from the declined user after the same transition", () => {
    const neverAsked: UserData = { ...declinedFdaNoMailbox, fda: "not-asked" };
    const onboarding = load(neverAsked);
    expect(onboarding.status).toBe("onboarding");
    if (onboarding.status !== "onboarding") return;
    // Never-asked correctly does NOT pre-complete the step here...
    expect(onboarding.completedSteps).not.toContain("permissions");

    const after = appStateReducer(onboarding, { type: "ONBOARDING_STEP_COMPLETE", step: "permissions" });
    if (after.status !== "ready") throw new Error("expected ready");
    // ...but completing the permissions step WITHOUT granting anything also
    // reports granted. Declined and never-asked converge on the same lie.
    expect(isFdaGranted(after.userData.fda)).toBe(true);
    expect(after.userData.fda).not.toBe("declined");
  });
});
