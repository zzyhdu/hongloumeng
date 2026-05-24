export type SearchScope = 'title' | 'body' | 'poetry' | 'annotation' | 'footnote';

export interface SearchIndexEntry {
  id: string;
  versionId: string;
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  blockIndex: number;
  blockType: string;
  scope: SearchScope;
  text: string;
  normalizedText: string;
}

export interface SearchIndexFile {
  generatedAt: string;
  versionId: string;
  versionName: string;
  chapterCount: number;
  entries: SearchIndexEntry[];
}

export interface SearchResult extends SearchIndexEntry {
  excerpt: string;
  keywords: string[];
}

export interface SearchTarget {
  versionId: string;
  chapterId: string;
  blockIndex: number;
  keywords: string[];
  timestamp: number;
}
