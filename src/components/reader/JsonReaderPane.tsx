import { useEffect, useState, useRef } from 'react';
import { ArrowRight, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChapterRenderer } from './ChapterRenderer';
import type { ChapterData } from '../../types/chapterTypes';
import type { SearchTarget } from '../../types/searchTypes';

interface JsonReaderPaneProps {
  versionId: string;
  chapterId: string;
  meta: { versionName: string; chapterTitle: string; chapterId: string } | null;
  hasNextChapter: boolean;
  onNextChapter: () => void;
  resourceBase: string;
  fontSizeClass?: string;
  onScrollDirectionChange?: (dir: 'up' | 'down', scrollY: number) => void;
  zenMode?: boolean;
  scrollRequest?: { percentage: number; timestamp: number };
  searchTarget?: SearchTarget;
  onProgressChange?: (percentage: number) => void;
}

export function JsonReaderPane({
  versionId,
  chapterId,
  meta,
  hasNextChapter,
  onNextChapter,
  resourceBase,
  fontSizeClass = 'text-lg',
  onScrollDirectionChange,
  zenMode,
  scrollRequest,
  searchTarget,
  onProgressChange,
}: JsonReaderPaneProps) {
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const lastScrollY = useRef(0);
  const activeSearchTarget =
    searchTarget?.versionId === versionId && searchTarget.chapterId === chapterId
      ? searchTarget
      : undefined;

  // Scroll to search target, requested percentage, or top when content is ready.
  useEffect(() => {
    if (loading || !chapterData || !containerRef.current) return;

    const container = containerRef.current;

    // Use setTimeout to ensure rendering is complete before measuring DOM positions.
    const timer = window.setTimeout(() => {
      if (activeSearchTarget) {
        const target = container.querySelector<HTMLElement>(`[data-search-block="${activeSearchTarget.blockIndex}"]`);
        target?.scrollIntoView({ block: 'center' });
      } else {
        const targetScroll = scrollRequest
          ? scrollRequest.percentage * (container.scrollHeight - container.clientHeight)
          : 0;
        container.scrollTo({ top: targetScroll });
      }

      const currentScrollY = container.scrollTop;
      lastScrollY.current = currentScrollY;
      if (onScrollDirectionChange) {
        onScrollDirectionChange('up', currentScrollY);
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [loading, chapterData, scrollRequest, activeSearchTarget, onScrollDirectionChange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const currentScrollY = container.scrollTop;
    
    // Calculate and report progress
    if (onProgressChange) {
      const scrollHeight = container.scrollHeight - container.clientHeight;
      const percentage = scrollHeight > 0 ? currentScrollY / scrollHeight : 0;
      onProgressChange(percentage);
    }
    
    if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
      const dir = currentScrollY > lastScrollY.current ? 'down' : 'up';
      if (onScrollDirectionChange) {
        onScrollDirectionChange(dir, currentScrollY);
      }
      lastScrollY.current = currentScrollY;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError('');
    setChapterData(null);

    const contentPath = `${resourceBase}/${versionId}/${chapterId}.json`;
    fetch(contentPath, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`加载失败：${res.status}`);
        return res.json() as Promise<ChapterData>;
      })
      .then((data) => {
        if (cancelled) return;
        setChapterData(data);
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        console.error(err);
        setChapterData(null);
        setError('加载章节失败，请检查网络或资源路径。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [versionId, chapterId, resourceBase]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-xiaoxiang-rose">
        <div className="rounded-2xl border border-xiaoxiang-rose/20 bg-xiaoxiang-rose/5 p-6 text-center">
          <p className="font-serif">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-xiaoxiang-celadon">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="font-serif tracking-widest text-sm text-xiaoxiang-bamboo">研墨铺纸中...</p>
        </div>
      </div>
    );
  }

  if (!chapterData) return null;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        "relative h-full overflow-y-auto px-4 pb-8 sm:px-12 sm:pb-16 md:px-24 lg:px-32 custom-scrollbar bg-white/40 backdrop-blur-sm",
        zenMode ? "pt-8 sm:pt-16" : "pt-[80px] lg:pt-16"
      )}
    >
      <article className="mx-auto max-w-3xl">

        <ChapterRenderer data={chapterData} fontSizeClass={fontSizeClass} searchTarget={activeSearchTarget} />

        {hasNextChapter && (
          <div className="mt-24 mb-12 flex justify-center">
            <button
              onClick={onNextChapter}
              className="group flex items-center gap-3 rounded-full border border-xiaoxiang-celadon/40 bg-white/60 px-8 py-3 font-serif text-lg text-xiaoxiang-bamboo shadow-sm transition-all hover:bg-xiaoxiang-celadon hover:text-white"
            >
              <span>翻阅下一回</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}
      </article>

    </div>
  );
}
