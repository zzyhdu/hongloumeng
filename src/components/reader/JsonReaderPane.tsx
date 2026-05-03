import { useEffect, useState, useRef } from 'react';
import { ArrowRight, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChapterRenderer } from './ChapterRenderer';
import type { ChapterData } from '../../types/chapterTypes';

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
}: JsonReaderPaneProps) {
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const lastScrollY = useRef(0);

  // Scroll to top when content is ready
  useEffect(() => {
    if (!loading && chapterData && containerRef.current) {
      containerRef.current.scrollTo({ top: 0 });
      lastScrollY.current = 0;
      if (onScrollDirectionChange) {
        onScrollDirectionChange('up', 0);
      }
    }
  }, [chapterId, loading, chapterData, onScrollDirectionChange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
      const dir = currentScrollY > lastScrollY.current ? 'down' : 'up';
      if (onScrollDirectionChange) {
        onScrollDirectionChange(dir, currentScrollY);
      }
      lastScrollY.current = currentScrollY;
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');

    const contentPath = `${resourceBase}/${versionId}/${chapterId}.json`;
    fetch(contentPath)
      .then((res) => {
        if (!res.ok) throw new Error(`加载失败：${res.status}`);
        return res.json() as Promise<ChapterData>;
      })
      .then((data) => {
        setChapterData(data);
      })
      .catch((err) => {
        console.error(err);
        setChapterData(null);
        setError('加载章节失败，请检查网络或资源路径。');
      })
      .finally(() => setLoading(false));
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
        zenMode ? "pt-8 sm:pt-16" : "pt-[120px] lg:pt-16"
      )}
    >
      <article className="mx-auto max-w-3xl">

        <ChapterRenderer data={chapterData} fontSizeClass={fontSizeClass} />

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

      <button
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-white/80 border border-xiaoxiang-celadon/30 text-xiaoxiang-celadon shadow-sm backdrop-blur transition-all hover:bg-xiaoxiang-celadon hover:text-white focus:outline-none focus:ring-2 focus:ring-xiaoxiang-celadon focus:ring-offset-2"
        aria-label="回顶部"
      >
        <ChevronUp className="h-6 w-6" />
      </button>
    </div>
  );
}
