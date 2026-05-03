import type {
  ChapterData,
  ContentBlock,
  ParagraphBlock,
  AnnotationBlockType,
  PoetryBlock,
  FootnoteBlock,
  HeadingBlock,
} from '../../types/chapterTypes';
import { InlineSpanRenderer } from './InlineSpanRenderer';
import { cn } from '../../lib/utils';

// ── Block Renderers ─────────────────────────────────────────────────

function HeadingBlockRenderer({ block }: { block: HeadingBlock }) {
  const Tag = block.level === 1 ? 'h1' : 'h2';
  return (
    <Tag className="font-serif text-center text-3xl sm:text-4xl font-bold leading-tight text-xiaoxiang-ink mb-8 mt-4">
      {block.text}
    </Tag>
  );
}

function ParagraphBlockRenderer({ block }: { block: ParagraphBlock }) {
  return (
    <p className={cn("reader-paragraph", block.indent ? "indented" : "")}>
      <InlineSpanRenderer spans={block.spans} />
    </p>
  );
}

function AnnotationBlockRenderer({ block }: { block: AnnotationBlockType }) {
  return (
    <aside className={cn("annotation-block", block.color, block.indent ? "indented" : "")}>
      <InlineSpanRenderer spans={block.spans} />
    </aside>
  );
}

function PoetryBlockRenderer({ block }: { block: PoetryBlock }) {
  return (
    <div className="poetry-block">
      {block.lines.map((lineSpans, i) => (
        <div key={i} className="poetry-line">
          <InlineSpanRenderer spans={lineSpans} />
        </div>
      ))}
    </div>
  );
}

function FootnoteBlockRenderer({ block }: { block: FootnoteBlock }) {
  return (
    <div className="footnote-def" id={`fn-${block.id}`}>
      <span className="footnote-marker">
        {'①②③④⑤⑥⑦⑧⑨⑩'[block.id - 1] || `[${block.id}]`}
      </span>
      <span className="footnote-content">
        <InlineSpanRenderer spans={block.spans} />
      </span>
      <a href={`#fnref-${block.id}`} className="footnote-backref" aria-label="返回">
        ↩
      </a>
    </div>
  );
}

// ── Block Dispatcher ────────────────────────────────────────────────

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlockRenderer block={block} />;
    case 'paragraph':
      return <ParagraphBlockRenderer block={block} />;
    case 'annotation_block':
      return <AnnotationBlockRenderer block={block} />;
    case 'poetry':
      return <PoetryBlockRenderer block={block} />;
    case 'footnote':
      return <FootnoteBlockRenderer block={block} />;
    default:
      return null;
  }
}

// ── Chapter Renderer (top-level) ────────────────────────────────────

interface ChapterRendererProps {
  data: ChapterData;
  fontSizeClass?: string;
}

export function ChapterRenderer({ data, fontSizeClass = 'text-lg' }: ChapterRendererProps) {
  // Separate footnotes from content blocks
  const contentBlocks = data.blocks.filter((b) => b.type !== 'footnote');
  const footnoteBlocks = data.blocks.filter((b) => b.type === 'footnote');

  return (
    <div className={cn('reader-prose font-serif text-xiaoxiang-ink transition-all duration-300', fontSizeClass)}>
      {/* Main content */}
      {contentBlocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}

      {/* Footnotes section */}
      {footnoteBlocks.length > 0 && (
        <footer className="footnotes-section">
          <hr className="footnote-divider" />
          {footnoteBlocks.map((block, i) => (
            <BlockRenderer key={`fn-${i}`} block={block} />
          ))}
        </footer>
      )}
    </div>
  );
}
