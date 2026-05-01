import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ArrowRight, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchText, type ReaderMeta } from '../../hooks/useReaderState';

interface ReaderPaneProps {
  versionId: string | null;
  chapterId: string | null;
  meta: { versionName: string; chapterTitle: string; chapterId: string } | null;
  hasNextChapter: boolean;
  onNextChapter: () => void;
  resourceBase: string;
}

export function ReaderPane({
  versionId,
  chapterId,
  meta,
  hasNextChapter,
  onNextChapter,
  resourceBase,
}: ReaderPaneProps) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!versionId || !chapterId) {
      setHtml('');
      return;
    }
    setLoading(true);
    setError('');

    const contentPath = `${resourceBase}/${versionId}/${chapterId}.md`;
    fetchText(contentPath)
      .then((text) => {
        // Pre-process markdown to clean up raw HTML <p> tags often found in EPUB conversions
        // We'll replace <p> tags with standard markdown paragraphs or handle annotations.
        let processedText = text;
        
        // Convert 〔一〕 style annotations to span
        processedText = processedText.replace(/〔([一二三四五六七八九十百]+)〕/g, '<span class="annotation">〔$1〕</span>');
        
        // Optionally detect poetry by looking for short lines and wrapping in blockquote if not already
        // This is a simple heuristic: lines that are short and follow each other.
        // For now, we rely on the custom CSS applied to the prose block.

        const parsedHtml = DOMPurify.sanitize(marked.parse(processedText, { breaks: true }) as string);
        setHtml(parsedHtml);
        
        // Scroll to top on new chapter
        if (containerRef.current) {
          containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      })
      .catch((err) => {
        console.error(err);
        setHtml('');
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

  if (!html) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center font-serif text-lg text-xiaoxiang-bamboo/50">
          请于左侧择一回目品读
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative h-full overflow-y-auto px-4 py-8 sm:px-12 sm:py-16 md:px-24 lg:px-32 custom-scrollbar bg-white/40 backdrop-blur-sm"
    >
      <article className="mx-auto max-w-3xl">
        {meta && (
          <header className="mb-16 border-b border-xiaoxiang-celadon/20 pb-12 text-center">
            <div className="mb-6 flex items-center justify-center">
              <span className="rounded bg-xiaoxiang-rose px-2 py-0.5 text-xs tracking-widest text-white shadow-sm">
                {meta.versionName}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold leading-tight text-xiaoxiang-ink sm:text-4xl">
              {meta.chapterTitle}
            </h1>
            <p className="mt-4 font-serif text-sm tracking-widest text-xiaoxiang-celadon">
              第 {meta.chapterId} 回
            </p>
          </header>
        )}

        <div 
          className="prose prose-slate max-w-none reader-prose font-serif text-lg sm:text-xl text-xiaoxiang-ink"
          dangerouslySetInnerHTML={{ __html: html }} 
        />

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

      {/* Scroll to top FAB */}
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
