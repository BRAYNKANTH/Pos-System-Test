// No framework imports here (no next/server, no Prisma) — this file is
// safe to import from client components as well as server code. See
// lib/api-response.ts, which re-exports this for server-side callers that
// already import from there.

/** Safely pulls a display message out of a caught value. `catch` bindings
 * are `unknown` by default in this project's TS config — this replaces
 * the common (and unsafe) `catch (err: any) { ... err.message ... }`
 * pattern, which only ever worked by accident when the thrown value
 * happened to be an Error. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
