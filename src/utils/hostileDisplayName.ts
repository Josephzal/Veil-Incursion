/**
 * Player-facing hostile names — never emit underscore registry IDs.
 */
export function formatHostileDisplayName(designation: string): string {
  const trimmed = designation.trim();
  if (!trimmed) return 'UNKNOWN HOSTILE';
  if (/\s/.test(trimmed) && !/_/.test(trimmed)) {
    return trimmed.toUpperCase().replace(/\s+/g, ' ');
  }
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
