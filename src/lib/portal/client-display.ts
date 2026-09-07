/**
 * Safe display-name formatting for admin-facing person records (clients, portal
 * users, staff). Defensive by design: this exists specifically so that a shape
 * mismatch between an API/RPC response and the frontend's expected fields (for
 * example a backend returning `first_name` while the UI reads `firstName`) never
 * surfaces as the literal text "undefined undefined" or "null null" — it degrades
 * to a safe fallback instead.
 *
 * Fallback order: firstName + lastName -> fallback (typically the record's email).
 */
export function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string | null | undefined = 'Unknown',
): string {
  const parts = [firstName, lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0)
  if (parts.length > 0) return parts.join(' ')
  const trimmedFallback = fallback?.trim()
  return trimmedFallback && trimmedFallback.length > 0 ? trimmedFallback : 'Unknown'
}
