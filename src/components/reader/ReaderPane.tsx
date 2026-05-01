import { useEffect, useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ArrowRight, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchText } from '../../hooks/useReaderState';

interface ReaderPaneProps {
  versionId: string | null;
  chapterId: string | null;
  meta: { versionName: string; chapterTitle: string; chapterId: string } | null;
  hasNextChapter: boolean;
  onNextChapter: () => void;
  resourceBase: string;
  fontSizeClass?: string;
}

export function ReaderPane({
  versionId,
  chapterId,
  meta,
  hasNextChapter,
  onNextChapter,
  resourceBase,
  fontSizeClass = 'text-lg',
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
    if (versionId === 'reference') {
      setHtml('');
      setLoading(false);
      setError('');
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

        // Process poetry lines: group consecutive short paragraphs without dialogue into a blockquote
        const paragraphs = processedText.split('\n\n');
        const newParagraphs: string[] = [];
        let currentPoetryLines: string[] = [];

        const isPoetryLine = (p: string) => {
          if (!p.startsWith('<p>') || !p.endsWith('</p>')) return false;
          const raw = p.replace(/<\/?p>/g, '').trim();
          
          if (
            raw.length === 0 || 
            raw.length >= 45 || 
            raw.includes('“') || 
            raw.includes('”') || 
            raw.includes('：') || 
            raw.startsWith('[') || 
            raw.startsWith('〔') ||
            raw.startsWith('<span')
          ) {
            return false;
          }

          // Check rhythmic structure: poetry clauses are usually short (<= 7 chars).
          // We allow up to 12 chars to be safe for longer Ci/Qu sentences.
          // Prose sentences without commas tend to have much longer clauses.
          const clauses = raw.split(/[，。？！；、]/).filter(c => c.trim().length > 0);
          const maxClauseLength = Math.max(...clauses.map(c => c.trim().length));
          return maxClauseLength <= 12;
        };

        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i].trim();
          if (!p) continue;

          if (isPoetryLine(p)) {
            currentPoetryLines.push(p.replace(/<\/?p>/g, ''));
          } else {
            if (currentPoetryLines.length > 0) {
              newParagraphs.push(`<div class="poetry-block">${currentPoetryLines.join('<br/>')}</div>`);
              currentPoetryLines = [];
            }
            newParagraphs.push(p);
          }
        }
        if (currentPoetryLines.length > 0) {
          newParagraphs.push(`<div class="poetry-block">${currentPoetryLines.join('<br/>')}</div>`);
        }

        processedText = newParagraphs.join('\n\n');

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

  if (versionId === 'reference' && chapterId) {
    const isEpub = chapterId.endsWith('.epub');
    // Note: Most modern browsers can native render PDFs in an iframe.
    // EPUBs cannot be rendered natively in an iframe without a JS reader, so we provide a link to download.
    return (
      <div className="flex h-full flex-col p-4 sm:p-8">
         <header className="mb-4 border-b border-xiaoxiang-celadon/20 pb-4 text-center">
            <h1 className="font-serif text-xl font-medium text-xiaoxiang-ink">
              {meta?.chapterTitle}
            </h1>
         </header>
         <div className="flex-1 w-full h-full rounded-xl overflow-hidden border border-xiaoxiang-celadon/30 shadow-inner bg-white">
           {isEpub ? (
             <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-xiaoxiang-paper/50">
               <div className="w-16 h-16 mb-4 rounded-full bg-xiaoxiang-celadon/10 flex items-center justify-center text-xiaoxiang-celadon">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
               </div>
               <h3 className="font-serif text-xl mb-2 text-xiaoxiang-ink">EPUB 电子书阅读</h3>
               <p className="text-xiaoxiang-bamboo/80 mb-6 max-w-md">
                 浏览器无法直接预览 EPUB 格式文件。您可以下载此文件并使用 Apple Books 或其他阅读器软件打开。
               </p>
               <a 
                 href={`${resourceBase}/${chapterId}`} 
                 download
                 className="px-6 py-2 bg-xiaoxiang-celadon text-white rounded-full font-serif shadow hover:bg-xiaoxiang-celadon/90 transition-colors"
               >
                 下载 EPUB 文件
               </a>
             </div>
           ) : (
             <iframe 
               src={`${resourceBase}/${chapterId}`} 
               title="PDF Viewer"
               className="w-full h-full border-0"
             />
           )}
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
          </header>
        )}

        <div
          className={cn("prose prose-slate max-w-none reader-prose font-serif text-xiaoxiang-ink transition-all duration-300", fontSizeClass)}
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
