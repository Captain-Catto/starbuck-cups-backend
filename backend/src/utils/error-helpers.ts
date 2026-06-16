/**
 * Helpers for narrowing `unknown` errors in catch blocks
 * (used instead of `catch (error: any)`).
 */

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Reads a property like `code` or `status` off provider errors (Google API, Meilisearch...). */
export const getErrorProperty = <T = unknown>(
  error: unknown,
  property: string
): T | undefined => {
  if (typeof error === "object" && error !== null && property in error) {
    return (error as Record<string, T>)[property];
  }
  return undefined;
};
