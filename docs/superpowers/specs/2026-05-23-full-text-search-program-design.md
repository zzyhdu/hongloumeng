# Full Text Search Program Design

## 背景

当前阅读器基于 Vite + React + TypeScript 实现，章节内容已经结构化为 JSON：

- 目录入口：`resource/catalog.json`
- 章节文件：`resource/{versionId}/{chapterId}.json`
- 前端类型：`src/types/chapterTypes.ts`
- 阅读渲染：`src/components/reader/ChapterRenderer.tsx`

全文搜索 V1 采用静态索引方案：构建时从章节 JSON 生成搜索索引，前端按当前版本加载索引并在浏览器内完成匹配、展示、跳转与高亮。

## 目标

- 支持当前版本内全文搜索。
- 支持标题、正文、诗词搜索。
- 支持可选纳入批注和脚注。
- 支持多关键词“同时包含”匹配。
- 支持点击结果跳转到原文 block，并高亮命中位置。
- 不引入后端服务和数据库。

## 非目标

- 不做跨版本搜索。
- 不做语义搜索。
- 不做拼音搜索。
- 不做正则搜索。
- 不做复杂分词和相关度排序。

## 总体架构

```
resource/{versionId}/{chapterId}.json
            │
            │ scripts/generateSearchIndex.cjs
            ▼
resource/search-index/{versionId}.json
            │
            │ fetch by currentVersionId
            ▼
src/hooks/useSearchIndex.ts
            │
            ▼
src/components/search/SearchPanel.tsx
            │
            │ result click
            ▼
App searchNavigation state
            │
            ▼
ReaderPane / JsonReaderPane / ChapterRenderer
            │
            ▼
scroll target block + highlight matched text
```

## 与按章节加载的关系

当前阅读器正文是按章节加载的：`JsonReaderPane` 只会 fetch 当前 `versionId/chapterId.json`，切换章节后再加载新章节。全文搜索设计必须保留这个模式。

V1 的处理方式：

- 搜索时不加载所有章节正文。
- 搜索面板只加载当前版本的静态索引文件 `resource/search-index/{versionId}.json`。
- 索引里保存用于检索和展示片段的纯文本，以及跳转所需的 `chapterId`、`blockIndex` 等定位信息。
- 点击搜索结果后，先把阅读器切到目标章节。
- 目标章节 JSON 加载完成、React 完成渲染后，再根据 `blockIndex` 查找 DOM 并滚动。
- 如果目标章节就是当前章节，则不重新加载章节，只更新搜索目标并滚动高亮。

这样搜索能力不会改变正文的按章节加载模型，也不会在运行时批量 fetch 100 多个章节 JSON。

## 文件规划

新增文件：

| 文件 | 用途 |
|------|------|
| `scripts/generateSearchIndex.cjs` | 生成每个版本的静态全文搜索索引 |
| `src/types/searchTypes.ts` | 搜索索引、搜索结果、跳转请求类型 |
| `src/lib/searchText.ts` | 前端搜索匹配、片段生成、高亮切分等纯函数 |
| `src/hooks/useSearchIndex.ts` | 按当前版本加载和缓存搜索索引 |
| `src/components/search/SearchPanel.tsx` | 全文搜索面板 |

修改文件：

| 文件 | 修改点 |
|------|--------|
| `package.json` | 增加或串联 `search:index` 脚本 |
| `src/App.tsx` | 管理搜索面板开关、搜索跳转请求 |
| `src/components/layout/Header.tsx` | 增加搜索按钮 |
| `src/components/reader/ReaderPane.tsx` | 透传搜索跳转请求 |
| `src/components/reader/JsonReaderPane.tsx` | 章节加载后滚动到搜索目标 |
| `src/components/reader/ChapterRenderer.tsx` | 为 block 添加稳定 DOM 标识并支持高亮 |
| `src/components/reader/InlineSpanRenderer.tsx` | 支持关键词高亮渲染 |
| `src/index.css` | 添加搜索面板与高亮样式 |

## 搜索索引结构

索引文件路径：

```
resource/search-index/{versionId}.json
```

索引文件结构：

```ts
export interface SearchIndexFile {
  generatedAt: string;
  versionId: string;
  versionName: string;
  chapterCount: number;
  entries: SearchIndexEntry[];
}
```

索引条目结构：

```ts
export type SearchScope = 'title' | 'body' | 'poetry' | 'annotation' | 'footnote';

export interface SearchIndexEntry {
  id: string;
  versionId: string;
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  blockIndex: number;
  blockType: string;
  scope: SearchScope;
  text: string;
  normalizedText: string;
}
```

`id` 生成规则：

```text
{versionId}:{chapterId}:{blockIndex}:{scope}
```

诗词 block 如果按整块索引，`blockIndex` 仍指向原始 block。V1 不拆到单行，避免跳转定位过细导致渲染层复杂化。

## 索引生成规则

脚本读取 `resource/catalog.json`，遍历所有版本和章节。

不同 block 的处理方式：

| block 类型 | scope | text 来源 |
|------------|-------|-----------|
| `heading` | `title` | `block.text` |
| `paragraph` | `body` | `spans` 中正文和校勘文本 |
| `poetry` | `poetry` | 所有诗句 `lines` 合并 |
| `annotation_block` | `annotation` | `spans` 按原始顺序合并 |
| `footnote` | `footnote` | `spans` 按原始顺序合并 |

InlineSpan 转文本规则：

| span 类型 | 处理方式 |
|-----------|----------|
| `text` | 使用 `content` |
| `annotation` | 在批注 scope 中使用 `content`；在正文 scope 中跳过 |
| `correction` | 优先使用 `inserted`，没有 `inserted` 时使用 `deleted` |
| `footnote_ref` | 跳过，不参与搜索 |

同一段落、同一诗句或同一注释块内部的相邻 span 直接拼接，不额外插入空格。这样可以避免原文短语被 PDF/JSON 切 span 后变成“全 部之名”一类不可搜索文本。诗词多行之间可以用空格分隔，作为展示和片段边界。

文本归一化：

- `trim()`
- 合并连续空白为单个空格
- 英文统一转小写
- 中文不分词、不转繁简

空文本不写入索引。

## npm 脚本

建议脚本：

```json
{
  "scripts": {
    "search:index": "node scripts/generateSearchIndex.cjs",
    "catalog": "node scripts/generateCatalog.cjs && node scripts/generateSearchIndex.cjs"
  }
}
```

由于当前 `dev` 和 `build` 都会执行 `npm run catalog`，把索引生成串入 `catalog` 后可以保持现有入口不变。

## 前端类型

```ts
export interface SearchResult extends SearchIndexEntry {
  excerpt: string;
  keywords: string[];
}

export interface SearchTarget {
  versionId: string;
  chapterId: string;
  blockIndex: number;
  keywords: string[];
  timestamp: number;
}
```

`timestamp` 用于同一结果重复点击时仍能触发滚动和高亮。

## useSearchIndex

职责：

- 接收 `resourceBase` 和 `versionId`。
- 加载 `resource/search-index/{versionId}.json`。
- 维护 `loading`、`error`、`indexFile`。
- 对已加载版本做内存缓存，避免重复 fetch。

接口：

```ts
export function useSearchIndex(resourceBase: string, versionId: string | null): {
  indexFile: SearchIndexFile | null;
  loading: boolean;
  error: string;
}
```

## 搜索匹配函数

位置：`src/lib/searchText.ts`

核心函数：

```ts
export function parseKeywords(query: string): string[];

export function searchEntries(
  entries: SearchIndexEntry[],
  query: string,
  options: { includeNotes: boolean; limit: number }
): SearchResult[];

export function buildExcerpt(text: string, keywords: string[], radius?: number): string;
```

匹配规则：

- `parseKeywords` 以空白拆分关键词。
- 所有关键词都必须出现在 `normalizedText` 中。
- `includeNotes === false` 时过滤 `annotation` 和 `footnote`。
- 排序直接沿用索引顺序。
- 达到 `limit` 后停止遍历。

## SearchPanel

职责：

- 展示搜索输入、包含批注/脚注开关、版本提示、结果列表。
- 调用 `useSearchIndex` 和 `searchEntries`。
- 点击结果时调用 `onSelectResult(result)`。

关键 props：

```ts
interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  versionId: string | null;
  versionName?: string;
  resourceBase: string;
  onSelectResult: (result: SearchResult) => void;
}
```

交互细节：

- 面板打开后自动聚焦搜索框。
- `Esc` 关闭面板。
- 查询为空时显示空状态，不执行搜索。
- 加载失败时展示错误状态。
- 结果超过 200 条时显示“仅展示前 200 条”提示。

## App 状态流

`App.tsx` 新增状态：

```ts
const [isSearchOpen, setIsSearchOpen] = useState(false);
const [searchTarget, setSearchTarget] = useState<SearchTarget | undefined>();
```

点击搜索结果：

```ts
const handleSelectSearchResult = (result: SearchResult) => {
  setCurrentVersionId(result.versionId);
  setCurrentChapterId(result.chapterId);
  setSearchTarget({
    versionId: result.versionId,
    chapterId: result.chapterId,
    blockIndex: result.blockIndex,
    keywords: result.keywords,
    timestamp: Date.now(),
  });
  setIsSearchOpen(false);
};
```

注意：搜索跳转和书签跳转都可能触发滚动。V1 中二者分别使用 `scrollRequest` 和 `searchTarget`，由 `JsonReaderPane` 按优先级处理：

1. 如果有新的 `searchTarget` 且目标版本、目标章节都匹配当前阅读器，滚动到 block。
2. 否则按 `scrollRequest` 百分比滚动。
3. 否则滚动到顶部。

## 原文定位与高亮

`ChapterRenderer` 渲染 block 时添加属性：

```tsx
data-search-block={i}
id={`chapter-block-${data.id}-${i}`}
```

`JsonReaderPane` 在章节加载完成后：

```ts
const selector = `[data-search-block="${searchTarget.blockIndex}"]`;
const target = container.querySelector(selector);
target?.scrollIntoView({ block: 'center' });
```

高亮分两层：

- block 背景高亮：目标 block 添加 `search-target-block` 样式。
- 关键词高亮：`InlineSpanRenderer` 根据 `keywords` 将文本切片，用 `<mark>` 包裹命中部分。

高亮只对当前 `searchTarget.blockIndex` 生效，避免整章所有相同关键词都被高亮。

## 样式设计

新增 CSS class：

```css
.search-highlight {
  background: rgba(211, 47, 47, 0.18);
  color: inherit;
  border-radius: 0.2em;
  padding: 0 0.08em;
}

.search-target-block {
  background: rgba(122, 147, 125, 0.10);
  box-shadow: 0 0 0 1px rgba(122, 147, 125, 0.18);
  border-radius: 6px;
}
```

搜索面板优先使用现有 Tailwind 色彩变量，保持与阅读器视觉一致。

## 性能考虑

- 索引构建时预先提取纯文本，前端不解析章节结构。
- 前端只加载当前版本索引。
- 搜索遍历达到 200 条后停止。
- 查询为空不执行搜索。
- 面板内部使用 `useMemo` 按 `query`、`includeNotes`、`indexFile` 计算结果。
- V1 不引入第三方搜索库，减少包体和调试复杂度。

## 错误处理

- 索引文件缺失：搜索面板显示“无法加载搜索索引，请重新生成资源”。
- 单条章节 JSON 生成失败：构建脚本记录错误并以非零状态退出。
- 空索引：搜索面板显示空状态。
- 切换版本时：清空当前搜索结果或基于新版本索引重新计算。

## 测试与验收

建议人工验收：

- 搜索“黛玉”，确认返回多个章回。
- 搜索“葬花”，点击结果能进入对应章节并高亮。
- 搜索“宝玉 黛玉”，确认结果同时包含两个关键词。
- 关闭“包含批注/脚注”时，批注和脚注结果不展示。
- 切换版本后，结果来自当前版本。
- 原目录搜索仍然只过滤章回标题。

命令验收：

```bash
npm run catalog
npm run build
```

## 实施顺序

1. 新增搜索类型和索引生成脚本。
2. 将索引生成串入 `catalog`。
3. 新增前端搜索纯函数和 `useSearchIndex`。
4. 新增 `SearchPanel`。
5. Header 增加搜索入口，App 接入搜索面板。
6. 阅读器接入 block 定位与关键词高亮。
7. 运行构建并完成验收用例。
