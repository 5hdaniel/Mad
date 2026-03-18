/**
 * @deprecated Use FeatureGate from "./FeatureGate" instead.
 * BACKLOG-1113: Renamed to FeatureGate to avoid confusion with license/LicenseGate.
 * This file re-exports for backward compatibility.
 */
export {
  FeatureGate as LicenseGate,
  FeatureGate as default,
  type FeatureGateProps as LicenseGateProps,
  type FeatureRequirement as LicenseRequirement,
} from "./FeatureGate";
