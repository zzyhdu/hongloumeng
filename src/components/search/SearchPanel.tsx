import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, MessageSquareText, Search, ScrollText, X } from 'lucide-react';
import { useSearchIndex } from '../../hooks/useSearchIndex';
import { cn } from '../../lib/utils';
import { searchEntries, splitHighlightedText } from '../../lib/searchText';
import type { SearchResult, SearchScope } from '../../types/searchTypes';

const RESULT_LIMIT = 200;

const SCOPE_LABELS: Record<SearchScope, string> = {
  title: '标题',
  body: '正文',
  poetry: '诗词',
  annotation: '批注',
  footnote: '脚注',
};

const SCOPE_ICONS: Record<SearchScope, typeof FileText> = {
  title: ScrollText,
  body: FileText,
  poetry: ScrollText,
  annotation: MessageSquareText,
  footnote: MessageSquareText,
};

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  versionId: string | null;
  versionName?: string;
  resourceBase: string;
  onSelectResult: (result: SearchResult) => void;
}

function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  return (
    <>
      {splitHighlightedText(text, keywords).map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="search-highlight">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

export function SearchPanel({
  open,
  onClose,
  versionId,
  versionName,
  resourceBase,
  onSelectResult,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [includeNotes, setIncludeNotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { indexFile, loading, error } = useSearchIndex(resourceBase, open ? versionId : null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!indexFile) return [];
    return searchEntries(indexFile.entries, query, { includeNotes, limit: RESULT_LIMIT });
  }, [includeNotes, indexFile, query]);

  if (!open) return null;

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const capped = results.length >= RESULT_LIMIT;

  return (
    <div className="fixed inset-0 z-[70] bg-xiaoxiang-ink/25 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="关闭搜索"
        onClick={onClose}
      />

      <section className="relative mx-auto flex h-full max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-xiaoxiang-celadon/25 bg-xiaoxiang-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-xiaoxiang-celadon/20 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-medium text-xiaoxiang-ink">全文搜索</h2>
            <p className="mt-0.5 truncate text-xs text-xiaoxiang-bamboo/65">
              {versionName || '当前版本'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 hover:text-xiaoxiang-ink"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-xiaoxiang-celadon/15 px-4 py-4 sm:px-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-xiaoxiang-bamboo/45" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索正文、标题或诗词"
              className="h-11 w-full rounded-full border border-xiaoxiang-celadon/30 bg-white/65 pl-10 pr-4 text-[15px] text-xiaoxiang-ink outline-none transition-all placeholder:text-xiaoxiang-bamboo/40 focus:border-xiaoxiang-celadon focus:ring-1 focus:ring-xiaoxiang-celadon"
            />
          </div>

          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-xiaoxiang-bamboo">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(event) => setIncludeNotes(event.target.checked)}
              className="h-4 w-4 rounded border-xiaoxiang-celadon/40 accent-xiaoxiang-celadon"
            />
            包含批注/脚注
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 custom-scrollbar">
          {loading && (
            <div className="flex h-full min-h-56 items-center justify-center text-xiaoxiang-celadon">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-serif text-sm">加载搜索索引...</span>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full min-h-56 items-center justify-center text-center text-sm text-xiaoxiang-rose">
              {error}
            </div>
          )}

          {!loading && !error && !hasQuery && (
            <div className="flex h-full min-h-56 items-center justify-center text-center text-sm text-xiaoxiang-bamboo/55">
              输入关键词后开始检索当前版本
            </div>
          )}

          {!loading && !error && hasQuery && results.length === 0 && (
            <div className="flex h-full min-h-56 items-center justify-center text-center text-sm text-xiaoxiang-bamboo/55">
              未找到相关内容
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 text-xs text-xiaoxiang-bamboo/60">
                <span>找到 {results.length} 条结果</span>
                {capped && <span>仅展示前 {RESULT_LIMIT} 条</span>}
              </div>

              {results.map((result) => {
                const Icon = SCOPE_ICONS[result.scope];
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => onSelectResult(result)}
                    className="group w-full rounded-lg border border-xiaoxiang-celadon/15 bg-white/55 px-3 py-3 text-left transition-all hover:border-xiaoxiang-celadon/45 hover:bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-xiaoxiang-celadon/10 text-xiaoxiang-celadon">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-serif text-sm font-medium text-xiaoxiang-ink">
                            {result.chapterTitle}
                          </span>
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px]',
                              result.scope === 'annotation' || result.scope === 'footnote'
                                ? 'border-xiaoxiang-rose/20 text-xiaoxiang-rose/80'
                                : 'border-xiaoxiang-celadon/25 text-xiaoxiang-bamboo/70'
                            )}
                          >
                            {SCOPE_LABELS[result.scope]}
                          </span>
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-xiaoxiang-bamboo/85">
                          <HighlightedText text={result.excerpt} keywords={result.keywords} />
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
