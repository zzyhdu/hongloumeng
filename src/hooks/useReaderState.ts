import { useState, useEffect, useMemo } from 'react';

export type Chapter = {
  id: string;
  title: string;
  file: string;
};

export type VersionMeta = {
  id: string;
  name: string;
  description: string;
  chapters: Chapter[];
  chapterCount: number;
};

export type Catalog = {
  generatedAt: string;
  versions: VersionMeta[];
};

const RESOURCE_BASE = './resource';
const STORAGE_VERSION_KEY = 'hlm_reader_version';
const STORAGE_CHAPTER_PREFIX = 'hlm_reader_chapter_';
const STORAGE_FONT_SIZE_KEY = 'hlm_reader_font_size';

export const FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl'];

const safeStorage = {
  get(key: string) {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, value); } catch {}
  },
};

const getStoredChapterKey = (versionId: string) => `${STORAGE_CHAPTER_PREFIX}${versionId}`;

const fetchJSON = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`加载失败：${response.status}`);
  return response.json();
};

export const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`加载失败：${response.status}`);
  return response.text();
};

export function useReaderState() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapterSearch, setChapterSearch] = useState('');
  const [fontSizeIndex, setFontSizeIndex] = useState<number>(() => {
    const stored = safeStorage.get(STORAGE_FONT_SIZE_KEY);
    return stored ? parseInt(stored, 10) : 1; // Default to 'text-lg'
  });

  // Sync font size to storage
  useEffect(() => {
    safeStorage.set(STORAGE_FONT_SIZE_KEY, fontSizeIndex.toString());
  }, [fontSizeIndex]);

  // Load catalog
  useEffect(() => {
    fetchJSON<Catalog>(`${RESOURCE_BASE}/catalog.json`)
      .then((data) => {
        setCatalog(data);
        if (data.versions?.length) {
          const storedVersionId = safeStorage.get(STORAGE_VERSION_KEY);
          const storedVersion = data.versions.find((v) => v.id === storedVersionId);
          const defaultVersion = storedVersion ?? data.versions[0];
          
          const storedChapterId = safeStorage.get(getStoredChapterKey(defaultVersion.id));
          const fallbackChapterId = 
            storedChapterId && defaultVersion.chapters.some(c => c.id === storedChapterId)
            ? storedChapterId 
            : defaultVersion.chapters[0]?.id || null;
            
          setCurrentVersionId(prev => prev || defaultVersion.id);
          setCurrentChapterId(prev => prev || fallbackChapterId);
        }
      })
      .catch((err) => {
        console.error(err);
        setCatalogError('无法加载章节目录，请确认已生成 resource/catalog.json。');
      });
  }, []);

  // Sync version and chapter changes to local storage and ensure chapter exists in version
  useEffect(() => {
    if (!catalog || !currentVersionId) return;
    safeStorage.set(STORAGE_VERSION_KEY, currentVersionId);
    
    const currentVersion = catalog.versions.find(v => v.id === currentVersionId);
    if (currentVersion && currentVersion.chapters.length) {
      const chapterExists = currentVersion.chapters.some(c => c.id === currentChapterId);
      if (!chapterExists) {
        const storedChapterId = safeStorage.get(getStoredChapterKey(currentVersionId));
        const storedValid = storedChapterId ? currentVersion.chapters.some(c => c.id === storedChapterId) : false;
        const fallbackChapterId = storedValid ? storedChapterId : currentVersion.chapters[0]?.id || null;
        if (fallbackChapterId && fallbackChapterId !== currentChapterId) {
          setCurrentChapterId(fallbackChapterId);
        }
      } else if (currentChapterId) {
        safeStorage.set(getStoredChapterKey(currentVersionId), currentChapterId);
      }
    } else {
      setCurrentChapterId(null);
    }
  }, [catalog, currentVersionId, currentChapterId]);

  const versions = catalog?.versions || [];
  const currentVersion = versions.find((v) => v.id === currentVersionId);
  const currentChapterIndex = currentVersion?.chapters.findIndex((c) => c.id === currentChapterId) ?? -1;
  const currentChapter = currentChapterIndex >= 0 ? currentVersion?.chapters[currentChapterIndex] : undefined;
  const nextChapter = currentChapterIndex >= 0 ? currentVersion?.chapters[currentChapterIndex + 1] : undefined;

  return {
    catalog,
    catalogError,
    versions,
    currentVersionId,
    setCurrentVersionId,
    currentChapterId,
    setCurrentChapterId,
    currentVersion,
    currentChapter,
    nextChapter,
    chapterSearch,
    setChapterSearch,
    fontSizeIndex,
    setFontSizeIndex,
    RESOURCE_BASE
  };
}
