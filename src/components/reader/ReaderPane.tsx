import { MarkdownReaderPane } from './MarkdownReaderPane';
import { JsonReaderPane } from './JsonReaderPane';

/** Versions that use structured JSON data */
const JSON_VERSIONS = new Set(['zhiping_4color']);

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

  // ── Dispatch to the correct reader ──
  const sharedProps = { versionId, chapterId, meta, hasNextChapter, onNextChapter, resourceBase, fontSizeClass };

  if (JSON_VERSIONS.has(versionId)) {
    return <JsonReaderPane {...sharedProps} />;
  }

  return <MarkdownReaderPane {...sharedProps} />;
}
