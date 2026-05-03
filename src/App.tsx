import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReaderState, FONT_SIZES } from './hooks/useReaderState';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ReaderPane } from './components/reader/ReaderPane';
import { cn } from './lib/utils';
import { X } from 'lucide-react';

export default function App() {
  const {
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
    RESOURCE_BASE,
  } = useReaderState();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  const handleScrollDirection = useCallback((dir: 'up' | 'down', scrollY: number) => {
    if (scrollY < 50) {
      setIsHeaderHidden(false);
    } else {
      setIsHeaderHidden(dir === 'down');
    }
  }, []);

  // Close mobile sidebar when changing chapters
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [currentChapterId]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-xiaoxiang-paper selection:bg-xiaoxiang-celadon/30 selection:text-xiaoxiang-ink">
      <div className={cn(
        "z-40 shrink-0 transition-transform duration-300 ease-in-out w-full",
        "absolute top-0 left-0 right-0 lg:relative",
        isHeaderHidden && !zenMode ? "-translate-y-full lg:translate-y-0" : "translate-y-0"
      )}>
        <Header
          versions={versions}
          currentVersionId={currentVersionId}
          onVersionChange={setCurrentVersionId}
          isMobileSidebarOpen={isMobileSidebarOpen}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          zenMode={zenMode}
          onToggleZenMode={() => setZenMode(!zenMode)}
          catalogError={catalogError}
          fontSizeIndex={fontSizeIndex}
          setFontSizeIndex={setFontSizeIndex}
        />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <AnimatePresence initial={false}>
          {!zenMode && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="hidden border-r border-xiaoxiang-celadon/20 bg-white/40 backdrop-blur-sm lg:block"
            >
              <div className="h-full w-[320px] pt-6">
                <Sidebar
                  currentVersion={currentVersion}
                  currentChapterId={currentChapterId}
                  onSelectChapter={setCurrentChapterId}
                  search={chapterSearch}
                  onSearchChange={setChapterSearch}
                  catalogError={catalogError}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isMobileSidebarOpen && !zenMode && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-xiaoxiang-ink/20 backdrop-blur-sm lg:hidden"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] bg-xiaoxiang-paper shadow-2xl lg:hidden"
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-xiaoxiang-celadon/20 p-4">
                    <span className="font-serif font-medium text-xiaoxiang-ink">目录卷帙</span>
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="rounded-full p-2 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/10"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden pt-4">
                    <Sidebar
                      currentVersion={currentVersion}
                      currentChapterId={currentChapterId}
                      onSelectChapter={setCurrentChapterId}
                      search={chapterSearch}
                      onSearchChange={setChapterSearch}
                      catalogError={catalogError}
                    />
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main
          className={cn(
            'relative flex-1 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
            zenMode && 'bg-xiaoxiang-paper'
          )}
        >
          {/* Zen Mode Exit Button */}
          <AnimatePresence>
            {zenMode && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setZenMode(false)}
                className="fixed top-6 right-6 sm:right-8 lg:right-12 z-50 rounded-full border border-xiaoxiang-celadon/30 bg-white/80 px-5 py-2 text-sm font-serif text-xiaoxiang-bamboo shadow-sm backdrop-blur transition-colors hover:bg-xiaoxiang-celadon hover:text-white"
              >
                退出沉浸阅读
              </motion.button>
            )}
          </AnimatePresence>

          <ReaderPane
            versionId={currentVersionId}
            chapterId={currentChapterId}
            fontSizeClass={FONT_SIZES[fontSizeIndex]}
            meta={
              currentVersion && currentChapter
                ? {
                    versionName: currentVersion.name,
                    chapterTitle: currentChapter.title,
                    chapterId: currentChapter.id,
                  }
                : null
            }
            hasNextChapter={Boolean(nextChapter)}
            onNextChapter={
              nextChapter
                ? () => setCurrentChapterId(nextChapter.id)
                : () => {}
            }
            resourceBase={RESOURCE_BASE}
            onScrollDirectionChange={handleScrollDirection}
            zenMode={zenMode}
          />
        </main>
      </div>
    </div>
  );
}
