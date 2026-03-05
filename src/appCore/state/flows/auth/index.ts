/**
 * Auth Sub-Hooks Barrel Export
 *
 * Re-exports all auth sub-hooks extracted from useAuthFlow.
 */

export { useLoginHandlers } from "./useLoginHandlers";
export type { UseLoginHandlersOptions } from "./useLoginHandlers";

export { useLogoutHandler } from "./useLogoutHandler";
export type { UseLogoutHandlerOptions } from "./useLogoutHandler";

export { useTermsHandlers } from "./useTermsHandlers";
export type { UseTermsHandlersOptions } from "./useTermsHandlers";

export { DEFAULT_PENDING_ONBOARDING } from "./types";
export type { UseAuthFlowOptions, UseAuthFlowReturn } from "./types";
