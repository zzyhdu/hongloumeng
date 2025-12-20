import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import './index.css';
const RESOURCE_BASE = '/resource';
const fetchJSON = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`加载失败：${response.status}`);
    }
    return response.json();
};
const fetchText = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`加载失败：${response.status}`);
    }
    return response.text();
};
function VersionTabs({ versions, currentId, onChange, }) {
    return (_jsx("div", { className: "flex flex-wrap gap-3", children: versions.map((version) => {
            const isActive = version.id === currentId;
            return (_jsx("button", { onClick: () => onChange(version.id), className: `rounded-full border px-4 py-1 text-sm transition ${isActive
                    ? 'border-rose-500 bg-rose-500 text-white shadow'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-rose-300'}`, children: version.name }, version.id));
        }) }));
}
function ChapterList({ chapters, currentId, onSelect, search, onSearchChange, }) {
    const filtered = useMemo(() => {
        if (!search)
            return chapters;
        return chapters.filter((chapter) => chapter.title.toLowerCase().includes(search.toLowerCase()));
    }, [chapters, search]);
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsx("div", { className: "mb-3", children: _jsx("input", { type: "text", value: search, onChange: (event) => onSearchChange(event.target.value), placeholder: "\u641C\u7D22\u7AE0\u8282\u6216\u5173\u952E\u8BCD...", className: "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500" }) }), _jsxs("div", { className: "flex-1 space-y-1 overflow-y-auto", children: [filtered.map((chapter) => {
                        const isActive = chapter.id === currentId;
                        return (_jsxs("button", { onClick: () => onSelect(chapter.id), className: `w-full rounded-lg px-3 py-2 text-left text-sm transition ${isActive
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-white text-slate-700 hover:bg-slate-100'}`, children: [_jsx("div", { className: "font-medium", children: chapter.title }), _jsxs("div", { className: "text-xs text-slate-500", children: ["\u7B2C ", chapter.id, " \u56DE"] })] }, chapter.id));
                    }), !filtered.length && (_jsx("div", { className: "rounded-lg bg-white px-3 py-6 text-center text-sm text-slate-500", children: "\u6CA1\u6709\u5339\u914D\u7684\u7AE0\u8282" }))] })] }));
}
function ReaderPane({ html, loading, error, meta, }) {
    if (error) {
        return (_jsx("div", { className: "flex h-full items-center justify-center rounded-2xl bg-white p-6 text-rose-600", children: error }));
    }
    if (loading) {
        return (_jsx("div", { className: "flex h-full items-center justify-center rounded-2xl bg-white p-6 text-slate-500", children: "\u6B63\u5728\u52A0\u8F7D\u7AE0\u8282\u5185\u5BB9..." }));
    }
    if (!html) {
        return (_jsx("div", { className: "flex h-full items-center justify-center rounded-2xl bg-white p-6 text-slate-500", children: "\u9009\u62E9\u5DE6\u4FA7\u7684\u7AE0\u8282\u5F00\u59CB\u9605\u8BFB" }));
    }
    return (_jsxs("article", { className: "prose max-w-none prose-slate h-full overflow-y-auto rounded-2xl bg-white px-6 py-8 shadow", children: [meta && (_jsxs("header", { className: "mb-8 border-b border-slate-100 pb-6", children: [_jsx("p", { className: "text-sm uppercase tracking-widest text-rose-500", children: meta.versionName }), _jsx("h1", { className: "mt-2 text-2xl font-semibold text-slate-900", children: meta.chapterTitle }), _jsxs("p", { className: "mt-1 text-sm text-slate-500", children: ["\u7B2C ", meta.chapterId, " \u56DE"] })] })), _jsx("div", { dangerouslySetInnerHTML: { __html: html } })] }));
}
export default function App() {
    const [catalog, setCatalog] = useState(null);
    const [catalogError, setCatalogError] = useState('');
    const [currentVersionId, setCurrentVersionId] = useState(null);
    const [currentChapterId, setCurrentChapterId] = useState(null);
    const [chapterSearch, setChapterSearch] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const [contentError, setContentError] = useState('');
    const [loadingContent, setLoadingContent] = useState(false);
    useEffect(() => {
        fetchJSON(`${RESOURCE_BASE}/catalog.json`)
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
        if (!catalog || !currentVersionId)
            return;
        const currentVersion = catalog.versions.find((version) => version.id === currentVersionId);
        if (currentVersion && currentVersion.chapters.length) {
            if (!currentChapterId || !currentVersion.chapters.some((ch) => ch.id === currentChapterId)) {
                setCurrentChapterId(currentVersion.chapters[0].id);
            }
        }
        else {
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
            const html = DOMPurify.sanitize(marked.parse(text, { breaks: true }));
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
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-slate-100 text-slate-900", children: [_jsxs("header", { className: "border-b border-slate-200 bg-white/90 px-8 py-5 shadow-sm backdrop-blur", children: [_jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: "\u7EA2\u697C\u68A6\u9605\u8BFB\u5668" }), _jsx("p", { className: "mt-2 text-sm text-slate-500", children: "\u9605\u8BFB\u4E0D\u540C\u7248\u672C\u7684\u300A\u7EA2\u697C\u68A6\u300B\uFF0C\u652F\u6301\u7AE0\u8282\u5FEB\u901F\u5207\u6362\u4E0E\u7248\u672C\u6BD4\u8F83\u3002" }), catalogError && _jsx("p", { className: "mt-2 text-sm text-rose-600", children: catalogError }), !!versions.length && (_jsx("div", { className: "mt-4", children: _jsx(VersionTabs, { versions: versions, currentId: currentVersionId, onChange: (versionId) => {
                                setCurrentVersionId(versionId);
                                setChapterSearch('');
                            } }) }))] }), _jsxs("main", { className: "flex flex-1 flex-col gap-6 px-6 py-6 lg:flex-row lg:items-stretch lg:px-8", children: [_jsx("section", { className: "lg:w-1/3 xl:w-1/4", children: _jsx("div", { className: "flex h-[70vh] flex-col rounded-2xl bg-white p-4 shadow", children: currentVersion ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700", children: [_jsx("p", { className: "font-semibold", children: currentVersion.name }), _jsx("p", { className: "mt-1 text-rose-600", children: currentVersion.description }), _jsxs("p", { className: "mt-1 text-xs text-rose-500", children: ["\u5171 ", currentVersion.chapterCount, " \u56DE"] })] }), _jsx(ChapterList, { chapters: currentVersion.chapters, currentId: currentChapterId, onSelect: (chapterId) => setCurrentChapterId(chapterId), search: chapterSearch, onSearchChange: setChapterSearch })] })) : (_jsx("div", { className: "flex flex-1 items-center justify-center text-sm text-slate-500", children: catalogError || '正在读取章节目录...' })) }) }), _jsx("section", { className: "flex-1", children: _jsx(ReaderPane, { html: contentHtml, loading: loadingContent, error: contentError, meta: currentVersion && currentChapter
                                ? {
                                    versionName: currentVersion.name,
                                    chapterTitle: currentChapter.title,
                                    chapterId: currentChapter.id,
                                }
                                : null }) })] }), _jsxs("footer", { className: "border-t border-slate-200 bg-white px-8 py-4 text-center text-xs text-slate-500", children: ["\u6570\u636E\u6765\u6E90\uFF1Aresource/zp80 \u4E0E resource/cg120\u3002\u82E5\u65B0\u589E\u7AE0\u8282\u540E\u8FD0\u884C", ' ', _jsx("code", { children: "node scripts/generateCatalog.js" }), " \u5E76\u6267\u884C ", _jsx("code", { children: "yarnpkg sync:resources" }), ' ', "\u66F4\u65B0\u9759\u6001\u8D44\u6E90\u3002"] })] }));
}
