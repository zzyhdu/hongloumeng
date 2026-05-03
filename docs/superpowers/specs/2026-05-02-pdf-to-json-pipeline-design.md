# PDF → JSON → HTML：脂评汇校本转写管线

## 目标

将四色脂评汇校本 PDF（80 回）转写为结构化数据，并在 Web 端渲染阅读。

核心原则：**先从 PDF 完整保留所有信息到 JSON，再从 JSON 渲染到 HTML。** 不使用 AI 做文本分类或语义判断。

## 管线总览

```
resource/4color_zhiping.pdf (80回)
    │
    ▼
[Stage 1: span_dumper.py]
    逐页提取所有 text span 的原始信息
    → resource/zhiping_4color/{001..080}_raw.json
    │
    ▼
[Stage 2: paragraph_builder.py]
    展平 → 分类 → 行内/块级批注区分 → 段落分组
    → resource/zhiping_4color/{001..080}_paras.json
    │
    ▼
[Stage 3: semantic_enricher.py]
    批注前缀解析、诗词检测（纯缩进）、脚注解析、校对符号提取、跨页合并
    → resource/zhiping_4color/{001..080}.json  (覆盖现有文件)
    │
    ▼
[JSON → React 渲染]
    JsonReaderPane → ChapterRenderer → InlineSpanRenderer
```

**实施状态：全部完成**（2026-05-02）。

## Stage 1：原始 Span 提取

### 职责
对 PDF 做最忠实的转写，不做任何判断、分类、合并。

### 输入
- `resource/4color_zhiping.pdf`
- 章节页码范围（通过 PDF TOC 获取，解析中文数字）

### 输出
每回一个 `{NNN}_raw.json`。完整保存 PyMuPDF 的所有原始字段（12 个 span 字段 + block/line 结构）。

```json
{
  "chapter": 1,
  "title": "第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀",
  "pages": [
    {
      "page": 1,
      "width": 595.0,
      "height": 841.0,
      "blocks": [
        {
          "type": 0,
          "number": 0,
          "bbox": [x0, y0, x1, y1],
          "lines": [
            {
              "bbox": [x0, y0, x1, y1],
              "wmode": 0,
              "dir": [1.0, 0.0],
              "spans": [
                {
                  "text": "...",
                  "size": 11.5,
                  "font": "KaiTi",
                  "color": 16711680,
                  "flags": 4,
                  "alpha": 255,
                  "ascender": 0.89,
                  "descender": -0.21,
                  "bidi": 0,
                  "char_flags": 16,
                  "origin": [x0, y0],
                  "bbox": [x0, y0, x1, y1]
                }
              ]
            }
          ]
        },
        {
          "type": 1,
          "number": 1,
          "bbox": [x0, y0, x1, y1],
          "width": 999,
          "height": 1411,
          "image_index": 0
        }
      ]
    }
  ]
}
```

### 关键决策
- 不过滤页眉页脚，所有文本完整保存（过滤在 Stage 2）
- 不做任何文本分类、不做任何 span 归并
- 图片 block 信息完整保存

## Stage 2：段落构建

### 职责
将原始 span 序列重建为逻辑段落结构：正文段落、批注块、行内批注、标题。

### 关键阈值（校准自 analyze_spans.py）

| 参数 | 值 | 说明 |
|------|-----|------|
| `HEADING_SIZE_MIN` | 16.0 pt | 大于等于此值为标题 |
| `INVISIBLE_SIZE_MAX` | 2.0 pt | 小于此值为不可见标记 |
| `BODY_MARGIN_X` | 74.0 pt | 正文左边界 x 坐标 |
| `INDENT_THRESHOLD_X` | 86.0 pt | 缩进阈值（74 + ~12pt 字符宽度） |
| `PARAGRAPH_BREAK_Y_GAP` | 14.0 pt | 段落间垂直间距阈值 |

### 颜色映射

| sRGB | color_name | 含义 |
|------|------------|------|
| `0x000000` | black | 正文 |
| `0xff0000` | red | 脂批（红色） |
| `0x00008b` | blue | 脂批（蓝色） |
| `0x00442b` | green | 脂批（绿色） |
| `0xffffff` | white | 不可见 |

### 处理步骤

#### 2.1 Span 展平与分类

将每个 page 的 blocks/lines/spans 按阅读顺序展平。每个 span 分类为：

- **`body`**：黑色文本，size ≥ 2pt（不含标题尺寸）
- **`annotation`**：非黑色非白色的彩色文本
- **`heading`**：size ≥ 16pt
- **`invisible`**：size < 2pt 或白色或空文本（排除缩进标记）
- **`indent`**：body margin 处的双空格（缩进标记，用于后续缩进检测）

#### 2.2 页眉页脚过滤

**页眉**（`_is_page_header`）：逐行过滤。当一行中任意 span 匹配以下条件时，整行跳过：
- 包含已知页眉文字（"抚琴居红楼梦脂评汇校本"、"红楼梦脂评汇校本"）
- 小字号（≤10.5pt）含"第X回"模式的标题文字（位于页面顶部 15%）

**页码**（`_is_page_number`）：过滤页面底部居中（x: 200-300）、小字号（≤11pt）的纯数字。

#### 2.3 行内 vs 块级批注判定

批注 span 按同色分组后，判断是行内还是块级（`_is_inline_annotation`）：

**行内条件**（满足任一）：
1. 与前一正文 span 同一行（ymid 差 < 5pt）
2. 与后一正文 span 同一行（仅 ≤2 span 的短批注）
3. 短批注（≤3 span）夹在同类 block span 之间，且垂直间距 < 28pt
4. 极短批注（1 span）紧贴前文（gap -3~5pt）

**块级条件**：前有缩进标记（indent span）或上述条件均不满足。

#### 2.4 段落边界检测

段落边界判定（`_is_paragraph_break`）：
- 垂直间距 > 14pt
- 物理缩进 x ≥ 86pt 且间距 > 2pt
- body margin 处的双空格缩进
- 跨页且有足够缩进

#### 2.5 缩进检测

三层次缩进检测（`_get_indent`）：
1. 显式 indent span（双空格在 body margin）
2. 物理 x 偏移 ≥ 86pt（诗词等）
3. 首段正文以双空格开头（CSS text-indent 处理，需 strip）

### 输出

每回一个 `{NNN}_paras.json`：

```json
{
  "chapter": 1,
  "title": "...",
  "paragraphs": [
    {
      "type": "heading",
      "level": 1,
      "text": "第 一 回 ...",
      "color": "black",
      "indent": false,
      "spans": [...]
    },
    {
      "type": "paragraph",
      "indent": true,
      "color_name": "black",
      "spans": [
        {
          "text": "列位看官，",
          "size": 11.5,
          "font": "...",
          "color": 0,
          "color_name": "black",
          "page": 1,
          "page_height": 729,
          "bbox": [...],
          "origin": [...],
          "class": "body"
        },
        {
          "text": "甲侧：自占地步。",
          "size": 8.0,
          "font": "...",
          "color": 16711680,
          "color_name": "red",
          "page": 1,
          "page_height": 729,
          "bbox": [...],
          "origin": [...],
          "class": "annotation",
          "_inline": true
        }
      ]
    },
    {
      "type": "annotation_block",
      "color_name": "green",
      "indent": true,
      "spans": [...]
    },
    {
      "type": "poetry",
      "indent": true,
      "lines": [[...], [...]]
    }
  ]
}
```

**Span 字段**：`text`, `size`, `font`, `color`, `color_name`, `page`, `page_height`, `bbox`, `origin`, `class`, `_inline`（仅 annotation）

## Stage 3：语义增强

### 职责
在段落结构上做语义标注：批注来源/位置解析、诗词块检测、脚注提取、校对符号提取、跨页合并、InlineSpan 转换。

### 处理步骤（process_chapter）

```
Step 0: 学习 color→source 映射
    ↓  从显式前缀（如"庚："）推断颜色对应的版本
Step 1: 批注前缀解析
    ↓  正则: ^(甲|己|庚|戚|蒙|列|辰)(本(后人批语)?)?(眉|侧|夹)?(总[评批])?[：:]\s*
Step 2: 校对符号提取 → correction span
    ↓  检测 (deleted)[inserted] 模式
Step 3: 诗词检测（纯缩进，无关键词）
    ↓
Step 4: 脚注提取
    ↓  章末 ①②③ 标记段落 → footnote block
    ↓  正文中的 ①②③ → footnote_ref span
Step 5: 跨页段落合并
    ↓  同类型相邻页段落合并
Step 6: InlineSpan 转换
    ↓  将 raw span dict 转为 typed InlineSpan
```

### 3.1 批注前缀解析

正则模式：
```
^([甲己庚戚蒙列辰])          # source version
(?:本(?:后人批语)?)?         # optional 本/本后人批语
([眉侧夹])?                   # optional position
(?:总[评批])?                 # optional 总评/总批
(?:：|:)\s*                   # colon
```

### 3.2 诗词检测（纯缩进规则）

**不使用任何关键词、句式分析、长度判断。** 只靠缩进：

- **诗词缩进**：4+ 个前导空格，或 x ≥ 86pt + 2+ 空格
- **正文缩进**：2 空格在 body margin（x ≈ 74pt）

流程：
1. 扫描 paragraph blocks
2. `_starts_as_poetry(block)` 检查是否有诗词级缩进
3. 连续的诗词缩进 block 归入同一诗歌块（需 ≥ 2 行才建诗歌块）
4. `_split_poetry_prose(block)` 在诗词转正文边界处切分混合 block

### 3.3 脚注处理

- 章末以 ①②③ 开头的段落 → `footnote` block（移除前导标记）
- 正文中的 ①②③ 字符 → `footnote_ref` span（按字符边界 split）

### 3.4 校对符号提取

检测 `(deleted)[inserted]` 和 `（deleted）［inserted］` 模式，在括号边界处 split span。

### 3.5 跨页段落合并

- 同类型（paragraph / annotation_block）的连续 block
- 下一页的第一个 block 无缩进时合并到上一页末尾
- 页面差 ≤ 1

### 3.6 InlineSpan 转换

将 `_paras.json` 中的 raw span dict 转为类型化的 InlineSpan：

| 条件 | 输出 type |
|------|-----------|
| 已有 type（correction / footnote_ref） | 保持 |
| `_inline` + color_name ∈ {red, blue, green} | `annotation` |
| 其他 | `text` |

行内 annotation 的 source 映射：
- 有显式前缀 → 解析得到 source, position
- 无前缀 → 继承同色批注块的 source（通过 Step 0 学习的 color_source_map）

### 输出

与 `src/types/chapterTypes.ts` 的 `ChapterData` 类型兼容：

```json
{
  "id": "001",
  "chapterNumber": 1,
  "title": "第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀",
  "blocks": [
    {
      "type": "heading",
      "level": 1,
      "text": "第 一 回 ..."
    },
    {
      "type": "annotation_block",
      "source": "庚",
      "position": "",
      "color": "green",
      "indent": true,
      "spans": [
        {"type": "text", "content": "庚：此开卷第一回也..."},
        {"type": "annotation", "source": "蒙", "position": "侧", "color": "blue", "content": "蒙侧：何非梦幻..."},
        {"type": "text", "content": "实愧则有馀..."}
      ]
    },
    {
      "type": "paragraph",
      "indent": true,
      "spans": [
        {"type": "text", "content": "列位看官，..."},
        {"type": "annotation", "source": "甲", "position": "侧", "color": "red", "content": "甲侧：自占地步。"}
      ]
    },
    {
      "type": "poetry",
      "lines": [
        [{"type": "text", "content": "无材可去补苍天，"}],
        [{"type": "text", "content": "枉入红尘若许年。"}]
      ]
    },
    {
      "type": "footnote",
      "id": 1,
      "spans": [{"type": "text", "content": "按：..."}]
    }
  ]
}
```

## JSON → React 渲染

### 组件架构

```
ReaderPane
  ├─ MarkdownReaderPane (versionId ∉ JSON_VERSIONS)
  │    渲染 .md 文件 → marked → DOMPurify → dangerouslySetInnerHTML
  │
  ├─ JsonReaderPane (versionId ∈ JSON_VERSIONS: ['zp80', 'zhiping_4color'])
  │    fetch .json → ChapterRenderer
  │      ├─ HeadingBlockRenderer → <h1>
  │      ├─ ParagraphBlockRenderer → <p> + InlineSpanRenderer
  │      ├─ AnnotationBlockRenderer → <aside> + InlineSpanRenderer
  │      ├─ PoetryBlockRenderer → <div.poetry-block>
  │      ├─ FootnoteBlockRenderer → <div.footnote-def>
  │      └─ BlockRenderer (dispatcher)
  │
  └─ ReferenceViewer (PDF/EPUB)
       iframe 预览或下载链接
```

### 样式要点

- `annotation-block.red|green|blue` — 各色批注块（KaiTi 字体，彩色边框）
- `annotation-inline.red|green|blue` — 行内批注（KaiTi，0.85em）
- `correction-deleted` — 删除线
- `correction-inserted` — 粗体
- `footnote-ref` — 上标链接
- `footnotes-section` — 章末脚注区域
- `poetry-block` — 居中、缩进、左边框

### 动态字体

`useReaderState` 提供 4 档字体大小：`text-base` / `text-lg` / `text-xl` / `text-2xl`，通过 `fontSizeClass` prop 传入 ReaderPane → JsonReaderPane → ChapterRenderer。

## 关键设计决策

1. **诗词检测纯靠缩进**：不依赖关键词、句式长度、对话检测等启发式规则。诗词用 4 空格或 x≥86+2 空格缩进，正文用 2 空格缩进。这条规则可靠且简单。

2. **页眉逐行过滤**：从 per-span 改为 per-line 过滤，防止拆分页眉（如"第七十八回"被过滤但"姽婳"残留）污染数据。

3. **缩进标记**：PDF 中双空格在不同字体下被 PyMuPDF 拆分为独立 span。Stage 2 将这些 indent span 纳入缩进检测逻辑（`_get_indent`）。

4. **行内批注检测**：四级判定（同行/近后/夹心/紧贴），不依赖 AI 分类。

5. **资源双份部署**：Python 管线写 `resource/`，前端从 `public/resource/`（dev）或 `dist/resource/`（build）读取。通过 `scripts/syncResources.cjs` 同步。
