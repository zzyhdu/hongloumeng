import { useEffect, useState } from 'react';
import type { SearchIndexFile } from '../types/searchTypes';

const indexCache = new Map<string, SearchIndexFile>();

export function useSearchIndex(resourceBase: string, versionId: string | null) {
  const [indexFile, setIndexFile] = useState<SearchIndexFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!versionId) {
      setIndexFile(null);
      setLoading(false);
      setError('');
      return;
    }

    const cached = indexCache.get(versionId);
    if (cached) {
      setIndexFile(cached);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setIndexFile(null);

    fetch(`${resourceBase}/search-index/${versionId}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`加载失败：${response.status}`);
        return response.json() as Promise<SearchIndexFile>;
      })
      .then((data) => {
        if (cancelled) return;
        indexCache.set(versionId, data);
        setIndexFile(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setIndexFile(null);
        setError('无法加载搜索索引，请重新生成资源。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resourceBase, versionId]);

  return { indexFile, loading, error };
}
