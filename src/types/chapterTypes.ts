/**
 * Structured data types for 脂评汇校本 chapter content.
 *
 * Design: Two-layer Block → InlineSpan model, similar to ProseMirror / Slate.
 * Each chapter is a list of ContentBlocks; each block contains InlineSpans.
 */

// ── Source & Position Metadata ──────────────────────────────────────

/** 批语来源版本（脂本简称） */
export type SourceVersion = '甲' | '己' | '庚' | '戚' | '蒙' | '列' | '辰';

/** 批语位置类型 */
export type AnnotationPosition = '眉' | '侧' | '夹';

/** 批语墨色 → CSS 颜色映射 */
export type AnnotationColor = 'red' | 'green' | 'blue';

// ── Inline Spans ────────────────────────────────────────────────────

/** 纯正文文本 */
export interface TextSpan {
  type: 'text';
  content: string;
}

/** 行内批语（侧批/夹批/眉批穿插在正文中） */
export interface AnnotationSpan {
  type: 'annotation';
  source: SourceVersion;
  position: AnnotationPosition;
  color: AnnotationColor;
  content: string;
}

/** 校勘记号：(删)[补] */
export interface CorrectionSpan {
  type: 'correction';
  deleted?: string;
  inserted?: string;
}

/** 脚注引用 ①② */
export interface FootnoteRefSpan {
  type: 'footnote_ref';
  id: number;
}

export type InlineSpan = TextSpan | AnnotationSpan | CorrectionSpan | FootnoteRefSpan;

// ── Content Blocks ──────────────────────────────────────────────────

/** 正文段落 */
export interface ParagraphBlock {
  type: 'paragraph';
  spans: InlineSpan[];
  /** 是否首行缩进（默认 true） */
  indent?: boolean;
}

/** 独立批注块（眉批、回前总批等） */
export interface AnnotationBlockType {
  type: 'annotation_block';
  source: SourceVersion;
  position: AnnotationPosition;
  color: AnnotationColor;
  spans: InlineSpan[];
  /** 是否首行缩进 */
  indent?: boolean;
}

/** 诗词块 */
export interface PoetryBlock {
  type: 'poetry';
  lines: InlineSpan[][];
}

/** 脚注定义 */
export interface FootnoteBlock {
  type: 'footnote';
  id: number;
  spans: InlineSpan[];
}

/** 章回标题 */
export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2;
  text: string;
}

export type ContentBlock =
  | ParagraphBlock
  | AnnotationBlockType
  | PoetryBlock
  | FootnoteBlock
  | HeadingBlock;

// ── Chapter Top-Level ───────────────────────────────────────────────

/** 一个完整章回的结构化数据 */
export interface ChapterData {
  id: string;
  chapterNumber: number;
  title: string;
  blocks: ContentBlock[];
}
