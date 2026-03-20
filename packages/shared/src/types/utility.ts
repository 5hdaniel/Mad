/**
 * Shared Utility Types
 *
 * Generic utility types used across portals and electron app.
 */

/**
 * Makes a type nullable (T or null).
 */
export type Nullable<T> = T | null;

/**
 * Recursively makes all properties of T optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
