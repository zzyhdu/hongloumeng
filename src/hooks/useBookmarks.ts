import { useState, useEffect, useCallback } from 'react';

export interface Bookmark {
  id: string;
  versionId: string;
  versionName: string;
  chapterId: string;
  chapterTitle: string;
  percentage: number;
  excerpt: string;
  createdAt: number;
}

const STORAGE_BOOKMARKS_KEY = 'hlm_reader_bookmarks';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_BOOKMARKS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage whenever bookmarks change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks', e);
    }
  }, [bookmarks]);

  const addBookmark = useCallback((bookmarkData: Omit<Bookmark, 'id' | 'createdAt'>) => {
    const newBookmark: Bookmark = {
      ...bookmarkData,
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt: Date.now(),
    };
    setBookmarks((prev) => [newBookmark, ...prev]);
    return newBookmark;
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  // Check if current chapter has any bookmarks (for UI toggle state)
  const isChapterBookmarked = useCallback(
    (versionId: string, chapterId: string) => {
      return bookmarks.some((b) => b.versionId === versionId && b.chapterId === chapterId);
    },
    [bookmarks]
  );

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    clearBookmarks,
    isChapterBookmarked,
  };
}
