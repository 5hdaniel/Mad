/**
 * Feature Gate Types
 * SPRINT-122: Plan Admin + Feature Gate Enforcement
 *
 * Canonical type definitions for feature gate access.
 * All feature gate consumers import from this single location.
 */

export interface FeatureAccess {
  allowed: boolean;
  value: string;
  source: "plan" | "override" | "default";
}
