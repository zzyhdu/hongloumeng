# JSON Generation Pipeline

## 概述

`resource/zhiping_4color/*.json` 是生成产物，**不提交到 Git**。通过脚本从 PDF 提取、结构化、语义标注生成。

## 流水线三阶段

```
4color_zhiping.pdf
  │  Stage 1: span_dumper.py（一次性，PDF 变更时运行）
  ▼
{NNN}_raw.json       ← PyMuPDF 原始 span，保留所有字段
  │  Stage 2: paragraph_builder.py
  ▼
{NNN}_paras.json      ← 结构化 block（heading / paragraph / poetry / annotation_block）
  │  Stage 3: semantic_enricher.py
  ▼
{NNN}.json            ← 最终输出（InlineSpan 格式、脚注、评注前缀）
```

### Stage 1：原始提取

```bash
python3 scripts/span_dumper.py [chapter_number]
```

从 PDF 逐页提取 span，保留 PyMuPDF 全部元数据（bbox、origin、font、color 等），不做任何过滤或分类。

- 输入：`resource/4color_zhiping.pdf`
- 输出：`resource/zhiping_4color/{NNN}_raw.json`
- 频率：**仅在 PDF 文件更新时运行一次**

### Stage 2：结构化

```bash
python3 scripts/paragraph_builder.py [chapter_number]
```

- `flatten_spans()` — 分类 span（body/annotation/heading/poetry），检测缩进标记，设置 `_block_start`
- `build_paragraphs()` — 按 `_block_start` 分割为 block
- `group_poetry()` — 合并连续诗歌行为 poetry block

### Stage 3：语义标注

```bash
python3 scripts/semantic_enricher.py [chapter_number]
```

- 评注前缀解析（甲侧：、庚眉： 等）
- 脚注提取（①②③...）
- 校对标记提取（(删)[补]）
- 跨页段落合并
- 转换为前端 InlineSpan 格式

## npm scripts

生成步骤已集成到 `dev` / `build`：

```
"dev":    "npm run generate:json && npm run catalog && node scripts/syncResources.cjs && vite"
"build":  "npm run generate:json && npm run catalog && node scripts/syncResources.cjs && tsc -b && vite build"
```

- `generate:json` — 运行 Stage 2 + Stage 3（所有回目）
- `catalog` — 生成章节目录
- `sync:resources` — 将 `resource/` 复制到 Vite 的 `public/resource/`
- 单独运行：`npm run generate:json`

## 调试

```bash
# 单回目详细输出（_flat.json + _blocks.json）
python3 scripts/debug_stage2.py <chapter_number>
```

## 文件说明

| 文件 | 用途 | 提交 |
|------|------|------|
| `resource/4color_zhiping.pdf` | 源 PDF | 是 |
| `resource/zhiping_4color/*_raw.json` | Stage 1 原始提取 | 否 |
| `resource/zhiping_4color/*_paras.json` | Stage 2 结构化 | 否 |
| `resource/zhiping_4color/*.json` | Stage 3 最终输出 | 否 |
| `resource/zhiping_4color/*_flat.json` | 调试中间产物 | 否 |
| `resource/zhiping_4color/*_blocks.json` | 调试中间产物 | 否 |
| `resource/catalog.json` | 章节目录（生成） | 否 |
| `public/resource/` | Vite public 镜像 | 否 |
