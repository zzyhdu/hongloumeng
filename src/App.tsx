import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import './index.css';

const RESOURCE_BASE = '/resource';

type Chapter = {
  id: string;
  title: string;
  file: string;
};

type VersionMeta = {
  id: string;
  name: string;
  description: string;
  chapters: Chapter[];
  chapterCount: number;
};

type Catalog = {
  generatedAt: string;
  versions: VersionMeta[];
};

type ReaderMeta = {
  versionName: string;
  chapterTitle: string;
  chapterId: string;
};

const fetchJSON = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载失败：${response.status}`);
  }
  return response.json();
};

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载失败：${response.status}`);
  }
  return response.text();
};

function VersionTabs({
  versions,
  currentId,
  onChange,
}: {
  versions: VersionMeta[];
  currentId: string | null;
  onChange: (versionId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {versions.map((version) => {
        const isActive = version.id === currentId;
        return (
          <button
            key={version.id}
            onClick={() => onChange(version.id)}
            className={`rounded-full border px-4 py-1 text-sm transition ${
              isActive
                ? 'border-rose-500 bg-rose-500 text-white shadow'
                : 'border-slate-300 bg-white text-slate-700 hover:border-rose-300'
            }`}
          >
            {version.name}
          </button>
        );
      })}
    </div>
  );
}

function ChapterList({
  chapters,
  currentId,
  onSelect,
  search,
  onSearchChange,
}: {
  chapters: Chapter[];
  currentId: string | null;
  onSelect: (chapterId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!search) return chapters;
    return chapters.filter((chapter) =>
      chapter.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [chapters, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索章节或关键词..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {filtered.map((chapter) => {
          const isActive = chapter.id === currentId;
          return (
            <button
              key={chapter.id}
              onClick={() => onSelect(chapter.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                isActive
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="font-medium">{chapter.title}</div>
              <div className="text-xs text-slate-500">第 {chapter.id} 回</div>
            </button>
          );
        })}
        {!filtered.length && (
          <div className="rounded-lg bg-white px-3 py-6 text-center text-sm text-slate-500">
            没有匹配的章节
          </div>
        )}
      </div>
    </div>
  );
}

function ReaderPane({
  html,
  loading,
  error,
  meta,
}: {
  html: string;
  loading: boolean;
  error: string;
  meta?: ReaderMeta | null;
}) {
  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-white p-6 text-rose-600">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-white p-6 text-slate-500">
        正在加载章节内容...
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-white p-6 text-slate-500">
        选择左侧的章节开始阅读
      </div>
    );
  }

  return (
    <article className="prose max-w-none prose-slate h-full overflow-y-auto rounded-2xl bg-white px-6 py-8 shadow">
      {meta && (
        <header className="mb-8 border-b border-slate-100 pb-6">
          <p className="text-sm uppercase tracking-widest text-rose-500">{meta.versionName}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{meta.chapterTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">第 {meta.chapterId} 回</p>
        </header>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapterSearch, setChapterSearch] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentError, setContentError] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [isMobileChaptersOpen, setMobileChaptersOpen] = useState(false);

  useEffect(() => {
    fetchJSON<Catalog>(`${RESOURCE_BASE}/catalog.json`)
      .then((data) => {
        setCatalog(data);
        if (data.versions?.length) {
          const firstVersion = data.versions[0];
          setCurrentVersionId((prev) => prev || firstVersion.id);
          setCurrentChapterId((prev) => prev || firstVersion.chapters?.[0]?.id || null);
        }
      })
      .catch((error) => {
        console.error(error);
        setCatalogError('无法加载章节目录，请确认已生成 resource/catalog.json。');
      });
  }, []);

  useEffect(() => {
    if (!catalog || !currentVersionId) return;
    const currentVersion = catalog.versions.find((version) => version.id === currentVersionId);
    if (currentVersion && currentVersion.chapters.length) {
      if (!currentChapterId || !currentVersion.chapters.some((ch) => ch.id === currentChapterId)) {
        setCurrentChapterId(currentVersion.chapters[0].id);
      }
    } else {
      setCurrentChapterId(null);
    }
  }, [catalog, currentVersionId, currentChapterId]);

  useEffect(() => {
    if (!currentVersionId || !currentChapterId) {
      setContentHtml('');
      return;
    }
    setLoadingContent(true);
    setContentError('');

    const contentPath = `${RESOURCE_BASE}/${currentVersionId}/${currentChapterId}.md`;
    fetchText(contentPath)
      .then((text) => {
        const html = DOMPurify.sanitize(marked.parse(text, { breaks: true }) as string);
        setContentHtml(html);
      })
      .catch((error) => {
        console.error(error);
        setContentHtml('');
        setContentError('加载章节失败，请检查资源路径。');
      })
      .finally(() => setLoadingContent(false));
  }, [currentVersionId, currentChapterId]);

  const versions = catalog?.versions || [];
  const currentVersion = versions.find((version) => version.id === currentVersionId);
  const currentChapter = currentVersion?.chapters.find((chapter) => chapter.id === currentChapterId);

  const renderChapterPanel = () => {
    if (!currentVersion) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          {catalogError || '正在读取章节目录...'}
        </div>
      );
    }

    return (
      <>
        <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <p className="font-semibold">{currentVersion.name}</p>
          <p className="mt-1 text-rose-600">{currentVersion.description}</p>
          <p className="mt-1 text-xs text-rose-500">共 {currentVersion.chapterCount} 回</p>
        </div>
        <ChapterList
          chapters={currentVersion.chapters}
          currentId={currentChapterId}
          onSelect={(chapterId) => {
            setCurrentChapterId(chapterId);
            setMobileChaptersOpen(false);
          }}
          search={chapterSearch}
          onSearchChange={setChapterSearch}
        />
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 px-8 py-5 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-900">红楼梦阅读器</h1>
        <p className="mt-2 text-sm text-slate-500">
          阅读不同版本的《红楼梦》，支持章节快速切换与版本比较。
        </p>
        {catalogError && <p className="mt-2 text-sm text-rose-600">{catalogError}</p>}
        {!!versions.length && (
          <div className="mt-4">
            <VersionTabs
              versions={versions}
              currentId={currentVersionId}
              onChange={(versionId) => {
                setCurrentVersionId(versionId);
                setChapterSearch('');
              }}
            />
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!!versions.length && (
            <div className="w-full sm:flex-1">
              <VersionTabs
                versions={versions}
                currentId={currentVersionId}
                onChange={(versionId) => {
                  setCurrentVersionId(versionId);
                  setChapterSearch('');
                }}
              />
            </div>
          )}
          <div className="flex justify-end sm:justify-center lg:hidden">
            <button
              type="button"
              onClick={() => setMobileChaptersOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
            >
              <span className="inline-block h-1 w-4 rounded-full bg-slate-400" />
              打开章节目录
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-stretch lg:px-8">
        <section className="hidden lg:block lg:w-1/3 xl:w-1/4">
          <div className="flex h-[70vh] flex-col rounded-2xl bg-white p-4 shadow">{renderChapterPanel()}</div>
        </section>
        <section className="flex-1">
          <ReaderPane
            html={contentHtml}
            loading={loadingContent}
            error={contentError}
            meta={
              currentVersion && currentChapter
                ? {
                    versionName: currentVersion.name,
                    chapterTitle: currentChapter.title,
                    chapterId: currentChapter.id,
                  }
                : null
            }
          />
        </section>
      </main>

      {!isMobileChaptersOpen && (
        <button
          type="button"
          onClick={() => setMobileChaptersOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:hidden"
        >
          <span className="inline-block h-1 w-5 rounded-full bg-white/70" />
          章节目录
        </button>
      )}

      {isMobileChaptersOpen && (
        <div className="fixed inset-0 z-50 flex justify-start lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setMobileChaptersOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-11/12 max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">章节目录</p>
              <button
                type="button"
                onClick={() => setMobileChaptersOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:border-rose-300 hover:text-rose-500"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col">{renderChapterPanel()}</div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white px-8 py-4 text-center text-xs text-slate-500">
        数据来源：resource/zp80 与 resource/cg120。若新增章节后运行{' '}
        <code>node scripts/generateCatalog.js</code> 并执行 <code>yarnpkg sync:resources</code>{' '}
        更新静态资源。
      </footer>
    </div>
  );
}
