import type { SearchIndexEntry, SearchResult, SearchScope } from '../types/searchTypes';

const NOTE_SCOPES = new Set<SearchScope>(['annotation', 'footnote']);

export interface HighlightPart {
  text: string;
  highlighted: boolean;
}

export function normalizeSearchText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function parseKeywords(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map(normalizeSearchText)
    .filter(Boolean);
}

export function isNoteScope(scope: SearchScope): boolean {
  return NOTE_SCOPES.has(scope);
}

export function buildExcerpt(text: string, keywords: string[], radius = 42): string {
  const normalizedText = text.toLowerCase();
  const hitIndex = keywords.reduce((best, keyword) => {
    const index = normalizedText.indexOf(keyword.toLowerCase());
    if (index < 0) return best;
    return best < 0 ? index : Math.min(best, index);
  }, -1);

  if (hitIndex < 0) {
    return text.length > radius * 2 ? `${text.slice(0, radius * 2)}...` : text;
  }

  const start = Math.max(0, hitIndex - radius);
  const end = Math.min(text.length, hitIndex + radius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export function searchEntries(
  entries: SearchIndexEntry[],
  query: string,
  options: { includeNotes: boolean; limit?: number }
): SearchResult[] {
  const keywords = parseKeywords(query);
  if (!keywords.length) return [];

  const limit = options.limit ?? 200;
  const results: SearchResult[] = [];

  for (const entry of entries) {
    if (!options.includeNotes && isNoteScope(entry.scope)) continue;
    if (!keywords.every((keyword) => entry.normalizedText.includes(keyword))) continue;

    results.push({
      ...entry,
      excerpt: buildExcerpt(entry.text, keywords),
      keywords,
    });

    if (results.length >= limit) break;
  }

  return results;
}

export function splitHighlightedText(text: string, keywords: string[]): HighlightPart[] {
  const normalizedKeywords = [...new Set(keywords.map(normalizeSearchText).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  if (!text || !normalizedKeywords.length) {
    return [{ text, highlighted: false }];
  }

  const lowerText = text.toLowerCase();
  const parts: HighlightPart[] = [];
  let index = 0;

  while (index < text.length) {
    const matched = normalizedKeywords.find((keyword) => lowerText.startsWith(keyword, index));

    if (!matched) {
      const nextHit = normalizedKeywords.reduce((best, keyword) => {
        const hit = lowerText.indexOf(keyword, index + 1);
        if (hit < 0) return best;
        return best < 0 ? hit : Math.min(best, hit);
      }, -1);
      const end = nextHit < 0 ? text.length : nextHit;
      parts.push({ text: text.slice(index, end), highlighted: false });
      index = end;
      continue;
    }

    parts.push({ text: text.slice(index, index + matched.length), highlighted: true });
    index += matched.length;
  }

  return parts.filter((part) => part.text.length > 0);
}
