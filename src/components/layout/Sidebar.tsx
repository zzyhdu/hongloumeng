import { useMemo, useEffect, useRef, useState } from 'react';
import { Search, Trash2, Bookmark as BookmarkIcon, ListTree } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Chapter, VersionMeta } from '../../hooks/useReaderState';
import type { Bookmark } from '../../hooks/useBookmarks';

interface SidebarProps {
  currentVersion?: VersionMeta;
  currentChapterId: string | null;
  onSelectChapter: (id: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  catalogError: string;
  bookmarks?: Bookmark[];
  onSelectBookmark?: (bookmark: Bookmark) => void;
  onDeleteBookmark?: (id: string) => void;
}

export function Sidebar({
  currentVersion,
  currentChapterId,
  onSelectChapter,
  search,
  onSearchChange,
  catalogError,
  bookmarks = [],
  onSelectBookmark,
  onDeleteBookmark,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'bookmarks'>('catalog');
  const filteredChapters = useMemo(() => {
    if (!currentVersion) return [];
    if (!search) return currentVersion.chapters;
    return currentVersion.chapters.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  }, [currentVersion, search]);

  const activeChapterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeChapterRef.current) {
      activeChapterRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentVersion?.id, currentChapterId]);

  if (!currentVersion) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-xiaoxiang-bamboo/70">
        {catalogError || '正在加载浩瀚卷帙...'}
      </div>
    );
  }

  return (
    <div className="font-sans flex flex-col h-full">
      {/* Tabs Header */}
      <div className="flex border-b border-xiaoxiang-celadon/20 mb-4 px-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={cn(
            "flex-1 pb-2 flex items-center justify-center gap-2 text-sm transition-colors border-b-2",
            activeTab === 'catalog' 
              ? "border-xiaoxiang-celadon text-xiaoxiang-ink font-medium" 
              : "border-transparent text-xiaoxiang-bamboo/70 hover:text-xiaoxiang-ink"
          )}
        >
          <ListTree size={16} />
          目录
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={cn(
            "flex-1 pb-2 flex items-center justify-center gap-2 text-sm transition-colors border-b-2",
            activeTab === 'bookmarks' 
              ? "border-xiaoxiang-celadon text-xiaoxiang-ink font-medium" 
              : "border-transparent text-xiaoxiang-bamboo/70 hover:text-xiaoxiang-ink"
          )}
        >
          <BookmarkIcon size={16} />
          书签 ({bookmarks.length})
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Version Header */}
      <div className="mb-6 px-2">
        <h2 className="font-serif text-lg font-medium text-xiaoxiang-ink">{currentVersion.name}</h2>
        <p className="mt-1 text-xs text-xiaoxiang-bamboo/70">{currentVersion.description}</p>
        <p className="mt-2 text-xs font-medium text-xiaoxiang-celadon">共 {currentVersion.chapterCount} 回</p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4 px-2">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-xiaoxiang-bamboo/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="寻章摘句..."
          className="w-full rounded-full border border-xiaoxiang-celadon/30 bg-white/50 py-2 pl-10 pr-4 text-sm text-xiaoxiang-ink placeholder:text-xiaoxiang-bamboo/40 focus:border-xiaoxiang-celadon focus:outline-none focus:ring-1 focus:ring-xiaoxiang-celadon transition-all"
        />
      </div>

      {/* Chapter List */}
      <div className="px-2 pb-6">
        <div className="space-y-1">
          {filteredChapters.map((chapter) => {
            const isActive = chapter.id === currentChapterId;
            return (
              <button
                key={chapter.id}
                ref={isActive ? activeChapterRef : null}
                onClick={() => onSelectChapter(chapter.id)}
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-left transition-all duration-300',
                  isActive 
                    ? 'bg-xiaoxiang-celadon/15 text-xiaoxiang-ink shadow-sm' 
                    : 'text-xiaoxiang-bamboo/80 hover:bg-white/60 hover:text-xiaoxiang-ink'
                )}
              >
                <div className={cn('text-[13px] font-serif leading-snug', isActive && 'font-medium')}>{chapter.title}</div>
              </button>
            );
          })}
          {!filteredChapters.length && (
            <div className="py-8 text-center text-sm text-xiaoxiang-bamboo/50">
              未觅得相关章节
            </div>
          )}
        </div>
      </div>
        </>
      ) : (
        <div className="px-2 pb-6 overflow-y-auto">
          {bookmarks.length === 0 ? (
            <div className="py-8 text-center text-sm text-xiaoxiang-bamboo/50">
              暂无书签
            </div>
          ) : (
            <div className="space-y-2">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group relative rounded-lg border border-xiaoxiang-celadon/20 bg-white/50 p-3 shadow-sm transition-all hover:border-xiaoxiang-celadon/50 hover:bg-white"
                >
                  <button
                    onClick={() => onSelectBookmark?.(bookmark)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-xiaoxiang-bamboo/70 mb-1">
                          {bookmark.versionName}
                        </div>
                        <div className="font-serif text-[14px] font-medium text-xiaoxiang-ink">
                          {bookmark.chapterTitle}
                        </div>
                      </div>
                      <div className="text-xs text-xiaoxiang-celadon font-medium">
                        {Math.round(bookmark.percentage * 100)}%
                      </div>
                    </div>
                  </button>
                  {onDeleteBookmark && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBookmark(bookmark.id);
                      }}
                      className="absolute bottom-2 right-2 p-1.5 rounded-full text-xiaoxiang-rose/70 opacity-0 transition-opacity hover:bg-xiaoxiang-rose/10 group-hover:opacity-100"
                      title="删除书签"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
