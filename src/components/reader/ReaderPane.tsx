import { JsonReaderPane } from './JsonReaderPane';

interface ReaderPaneProps {
  versionId: string | null;
  chapterId: string | null;
  meta: { versionName: string; chapterTitle: string; chapterId: string } | null;
  hasNextChapter: boolean;
  onNextChapter: () => void;
  resourceBase: string;
  fontSizeClass?: string;
  onScrollDirectionChange?: (dir: 'up' | 'down', scrollY: number) => void;
  zenMode?: boolean;
}

export function ReaderPane({
  versionId,
  chapterId,
  meta,
  hasNextChapter,
  onNextChapter,
  resourceBase,
  fontSizeClass = 'text-lg',
  onScrollDirectionChange,
  zenMode,
}: ReaderPaneProps) {
  // ── No content selected ──
  if (!versionId || !chapterId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center font-serif text-lg text-xiaoxiang-bamboo/50">
          请于左侧择一回目品读
        </div>
      </div>
    );
  }

  // ── All versions now use structured JSON ──
  return <JsonReaderPane versionId={versionId} chapterId={chapterId} meta={meta} hasNextChapter={hasNextChapter} onNextChapter={onNextChapter} resourceBase={resourceBase} fontSizeClass={fontSizeClass} onScrollDirectionChange={onScrollDirectionChange} zenMode={zenMode} />;
}
