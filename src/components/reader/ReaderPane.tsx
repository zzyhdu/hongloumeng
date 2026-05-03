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

  // ── Reference viewer (PDF / EPUB) ──
  if (versionId === 'reference') {
    return <ReferenceViewer chapterId={chapterId} meta={meta} resourceBase={resourceBase} />;
  }

  // ── Dispatch to the correct reader ──
  const sharedProps = { versionId, chapterId, meta, hasNextChapter, onNextChapter, resourceBase, fontSizeClass };

  if (JSON_VERSIONS.has(versionId)) {
    return <JsonReaderPane {...sharedProps} />;
  }

  return <MarkdownReaderPane {...sharedProps} />;
}

// ── Reference Viewer (PDF / EPUB) ───────────────────────────────────

function ReferenceViewer({
  chapterId,
  meta,
  resourceBase,
}: {
  chapterId: string;
  meta: { chapterTitle: string } | null;
  resourceBase: string;
}) {
  const isEpub = chapterId.endsWith('.epub');

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
