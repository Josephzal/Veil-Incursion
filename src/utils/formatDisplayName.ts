/** Converts snake_case / kebab-case identifiers into Title Case display labels. */
export function formatSnakeCaseToTitleCase(value: string): string {
  const normalized = value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** True when the string looks like a raw machine id rather than human copy. */
export function looksLikeRawItemId(value: string): boolean {
  return /[-_]/.test(value) || value === value.toLowerCase();
}

export function formatItemDisplayName(primary: string, fallbackId?: string): string {
  const source = primary.trim() || fallbackId?.trim() || '';
  if (!source) return 'Unknown Item';
  if (looksLikeRawItemId(source)) {
    return formatSnakeCaseToTitleCase(source);
  }
  if (source === source.toUpperCase()) {
    return formatSnakeCaseToTitleCase(source.toLowerCase());
  }
  return source;
}
