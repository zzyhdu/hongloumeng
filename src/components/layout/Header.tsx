import { Menu, X, BookOpen, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { VersionMeta } from '../../hooks/useReaderState';

interface HeaderProps {
  versions: VersionMeta[];
  currentVersionId: string | null;
  onVersionChange: (id: string) => void;
  isMobileSidebarOpen: boolean;
  onToggleSidebar: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  catalogError: string;
  fontSizeIndex: number;
  setFontSizeIndex: (index: number) => void;
}

export function Header({
  versions,
  currentVersionId,
  onVersionChange,
  isMobileSidebarOpen,
  onToggleSidebar,
  zenMode,
  onToggleZenMode,
  catalogError,
  fontSizeIndex,
  setFontSizeIndex,
}: HeaderProps) {
  if (zenMode) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-xiaoxiang-celadon/20 bg-xiaoxiang-paper/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Branding & Mobile Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-md p-2 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/10 lg:hidden"
          >
            {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-xiaoxiang-rose" />
            <h1 className="font-serif text-xl font-semibold tracking-widest text-xiaoxiang-ink">
              红楼梦
            </h1>
          </div>
        </div>

        {/* Center: Version Tabs (Hidden on small screens) */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          {versions.length > 0 && (
            <div className="flex rounded-full border border-xiaoxiang-celadon/30 bg-white/40 p-1 backdrop-blur">
              {versions.map((v) => {
                const isActive = v.id === currentVersionId;
                return (
                  <button
                    key={v.id}
                    onClick={() => onVersionChange(v.id)}
                    className={cn(
                      'rounded-full px-5 py-1.5 text-sm transition-all',
                      isActive
                        ? 'bg-xiaoxiang-celadon text-white shadow-sm'
                        : 'text-xiaoxiang-bamboo hover:text-xiaoxiang-ink'
                    )}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center rounded-full border border-xiaoxiang-celadon/30 bg-white/40 p-1 backdrop-blur">
            <button
              onClick={() => setFontSizeIndex(Math.max(0, fontSizeIndex - 1))}
              disabled={fontSizeIndex === 0}
              className="px-3 py-1 text-sm font-serif text-xiaoxiang-bamboo hover:text-xiaoxiang-ink disabled:opacity-30 disabled:hover:text-xiaoxiang-bamboo transition-colors"
              title="缩小字体"
            >
              A-
            </button>
            <div className="w-px h-3 bg-xiaoxiang-celadon/30"></div>
            <button
              onClick={() => setFontSizeIndex(Math.min(3, fontSizeIndex + 1))}
              disabled={fontSizeIndex === 3}
              className="px-3 py-1 text-sm font-serif text-xiaoxiang-bamboo hover:text-xiaoxiang-ink disabled:opacity-30 disabled:hover:text-xiaoxiang-bamboo transition-colors"
              title="放大字体"
            >
              A+
            </button>
          </div>
          
          <button
            onClick={onToggleZenMode}
            className="flex items-center gap-2 rounded-full border border-xiaoxiang-celadon/30 px-4 py-1.5 text-sm text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 hover:text-xiaoxiang-ink"
            title="沉浸阅读"
          >
            <Settings2 size={16} />
            <span className="hidden sm:inline">禅意模式</span>
          </button>
        </div>
      </div>
      
      {/* Mobile Version Tabs */}
      <div className="md:hidden border-t border-xiaoxiang-celadon/10 px-4 py-2 flex overflow-x-auto custom-scrollbar">
        <div className="flex gap-2">
          {versions.map((v) => {
            const isActive = v.id === currentVersionId;
            return (
              <button
                key={v.id}
                onClick={() => onVersionChange(v.id)}
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-1 text-xs transition-all border',
                  isActive
                    ? 'bg-xiaoxiang-celadon border-xiaoxiang-celadon text-white shadow-sm'
                    : 'border-xiaoxiang-celadon/30 text-xiaoxiang-bamboo bg-white/40'
                )}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
