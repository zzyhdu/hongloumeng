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
    字号分布分析 → 阈值确定 → 段落边界检测 → 跨页合并
    → resource/zhiping_4color/{001..080}_paras.json
    │
    ▼
[Stage 3: semantic_enricher.py]
    批注前缀解析、诗词检测、脚注解析、校对符号提取
    → resource/zhiping_4color/{001..080}.json  (覆盖现有文件)
    │
    ▼
[JSON → React 渲染]
    JsonReaderPane → ChapterRenderer → InlineSpanRenderer
```

## Stage 1：原始 Span 提取

### 职责
对 PDF 做最忠实的转写，不做任何判断、分类、合并。

### 输入
- `resource/4color_zhiping.pdf`
- 章节页码范围（通过 PDF TOC 获取）

### 输出
每回一个 `{NNN}_raw.json`。Stage 1 不做任何过滤、分类、合并。完整保存 PyMuPDF 的所有原始字段。

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
                  "text": "text content",
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

**Span 字段**（完整保留 PyMuPDF 12 个字段，不做筛选）：
`text`, `size`, `font`, `color`, `flags`, `alpha`, `ascender`, `descender`, `bidi`, `char_flags`, `origin`, `bbox`

**Block 字段**：
- `type`: 0=text, 1=image
- `number`: block 序号
- `bbox`: block 包围盒
- 对于 image block：额外保存 `width`, `height`, `image_index`

**Line 字段**：
- `bbox`, `wmode`, `dir`

### 关键决策
- **不过滤页眉页脚**，所有文本完整保存（过滤留到 Stage 2、3）
- 不做任何文本分类、不做任何 span 归并
- 图片 block 的信息完整保存，以便后续可能提取封面/插图
- `color_name` 不在 Stage 1 计算，由 Stage 2 按需添加

## Stage 2：段落构建

### 职责
把原始 span 序列重建为逻辑段落结构，区分正文段落、批注块、行内批注。

### 步骤

#### 2.1 字号分布分析
- 统计全文字号分布，绘制直方图
- 确定三个区间：
  - **大字号**（标题）：`font_size >= 16`
  - **正文字号**：`10 <= font_size < 16`
  - **小字号**（批注）：`font_size < 10`

#### 2.2 Block 序列展开
- 将每个 page 的 blocks/lines/spans 展平为全局序列
- 每个 span 附带页码和坐标

#### 2.3 段落边界检测
- **新段落开始条件**（正文文本且以下任一成立）：
  1. span 前有大于正常行高的垂直间距
  2. span 起始 x 坐标比前一段落明显偏右（缩进）
  3. 前一个 span 是一段批注（小字号）且当前是正文
  4. 跨越了 PDF 的 block 边界且新 block 有缩进
- **批注块条件**（连续小字号文本构成独立批注）：
  - 起始处有「甲侧：」「庚眉：」等前缀
  - 垂直方向独立成块（前后有间距）
- **行内批注条件**：
  - 小字号 text span 嵌入在正文字号之间

#### 2.4 跨页段落合并
- 如果前一页最后一段正文没有结束（即没有明显段落结束标志），且后一页第一段正文是接续文本，则合并

### 输出
每回一个 `{NNN}_paras.json`：
```json
{
  "chapter": 1,
  "title": "...",
  "paragraphs": [
    {
      "type": "paragraph",
      "indent": true,
      "spans": [
        {
          "type": "text",
          "content": "列位看官，",
          "font_size": 11.5,
          "color_name": "black",
          "bbox": [x0, y0, x1, y1],
          "page": 1
        },
        {
          "type": "annotation_inline",
          "content": "甲侧：自占地步",
          "color_name": "red",
          "font_size": 8.0,
          "bbox": [x0, y0, x1, y1],
          "page": 1
        }
      ]
    },
    {
      "type": "annotation_block",
      "color_name": "green",
      "indent": true,
      "spans": [
        {
          "type": "text",
          "content": "此开卷第一回也...",
          "font_size": 11.5,
          "color_name": "green",
          "bbox": [x0, y0, x1, y1],
          "page": 1
        }
      ]
    },
    {
      "type": "poetry_candidate",
      "indent": true,
      "spans": [...]
    }
  ]
}
```

## Stage 3：语义增强

### 职责
在段落结构上做语义标注：批注来源/位置解析、诗词块标记、脚注提取、校对符号提取。

### 步骤

#### 3.1 批注前缀解析
- 对 annotation_block 的文本匹配正则 `^(甲|己|庚|戚|蒙|列|辰)(眉|侧|夹)?：`
- 提取 source（甲/庚/...）和 position（眉/侧/夹）
- 未匹配到的标注为 unknown

#### 3.2 诗词检测（纯规则）
- 检测关键词：口占、高吟、吟罢、口号、诗云、一绝、一联云
- 检测连续多行的缩进对齐（x 坐标接近且字数相近）
- 检测韵脚规律
- 标记 `poetry` block

#### 3.3 脚注处理
- 检测 ①②③ 等脚注引用标记
- 提取章末脚注定义
- 建立引用-定义关联

#### 3.4 校对符号提取
- 检测 `(某)[某]` 模式 → correction span
- 提取到 span 的 `correction` 字段

### 输出
与现有 `ChapterData` 类型兼容，每个 span 额外携带 `extras` 字段（含 bbox, page, font_size 等元信息）。

## JSON → React 渲染

### 修改策略
- 保持现有组件架构（JsonReaderPane → ChapterRenderer → BlockRenderer → InlineSpanRenderer）
- 扩展 `InlineSpan` 类型增加原始元信息字段
- 增强 CSS 样式以更好地还原原文排版

### 不改变的部分
- ReaderPane 的路由逻辑
- MarkdownReaderPane（其他版本继续用 markdown）
- 目录和章节导航

## 实施计划

### Phase 1：Stage 1 — 原始 Span 提取
1. 分析 PDF 底层结构（TOC、字号分布、颜色分布）
2. 实现 `span_dumper.py`
3. 对第 1 回跑一遍，与预期对比验证
4. 批量处理全部 80 回

### Phase 2：Stage 2 — 段落构建
1. 分析字号/坐标统计规律
2. 实现段落边界检测算法
3. 实现跨页合并逻辑
4. 在第 1 回上验证，逐回测试

### Phase 3：Stage 3 — 语义增强
1. 实现批注前缀解析
2. 实现诗词检测（纯规则）
3. 实现脚注/校对符号提取
4. 输出最终 JSON，覆盖现有文件

### Phase 4：前端适配
1. 更新 TypeScript 类型定义
2. 更新渲染组件
3. 调优 CSS 样式
4. 全文浏览验证
