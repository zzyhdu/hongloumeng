import type {
  ChapterData,
  ContentBlock,
  ParagraphBlock,
  AnnotationBlockType,
  PoetryBlock,
  FootnoteBlock,
  HeadingBlock,
} from '../../types/chapterTypes';
import type { ReactNode } from 'react';
import { InlineSpanRenderer } from './InlineSpanRenderer';
import { cn } from '../../lib/utils';
import { splitHighlightedText } from '../../lib/searchText';
import type { SearchTarget } from '../../types/searchTypes';

// ── Block Renderers ─────────────────────────────────────────────────

function HighlightedText({ text, keywords }: { text: string; keywords?: string[] }) {
  if (!keywords?.length) return <>{text}</>;

  return (
    <>
      {splitHighlightedText(text, keywords).map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="search-highlight">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

function HeadingBlockRenderer({ block, highlightKeywords }: { block: HeadingBlock; highlightKeywords?: string[] }) {
  const Tag = block.level === 1 ? 'h1' : 'h2';
  return (
    <Tag className="font-serif text-center text-3xl sm:text-4xl font-bold leading-tight text-xiaoxiang-ink mb-8 mt-4">
      <HighlightedText text={block.text} keywords={highlightKeywords} />
    </Tag>
  );
}

function ParagraphBlockRenderer({ block, highlightKeywords }: { block: ParagraphBlock; highlightKeywords?: string[] }) {
  return (
    <p className={cn("reader-paragraph", block.indent ? "indented" : "")}>
      <InlineSpanRenderer spans={block.spans} highlightKeywords={highlightKeywords} />
    </p>
  );
}

function AnnotationBlockRenderer({ block, highlightKeywords }: { block: AnnotationBlockType; highlightKeywords?: string[] }) {
  return (
    <aside className={cn("annotation-block", block.color, block.indent ? "indented" : "")}>
      <InlineSpanRenderer spans={block.spans} highlightKeywords={highlightKeywords} />
    </aside>
  );
}

function PoetryBlockRenderer({ block, highlightKeywords }: { block: PoetryBlock; highlightKeywords?: string[] }) {
  return (
    <div className="poetry-block">
      {block.lines.map((lineSpans, i) => (
        <div key={i} className="poetry-line">
          <InlineSpanRenderer spans={lineSpans} highlightKeywords={highlightKeywords} />
        </div>
      ))}
    </div>
  );
}

function FootnoteBlockRenderer({ block, highlightKeywords }: { block: FootnoteBlock; highlightKeywords?: string[] }) {
  return (
    <div className="footnote-def" id={`fn-${block.id}`}>
      <span className="footnote-marker">
        {'①②③④⑤⑥⑦⑧⑨⑩'[block.id - 1] || `[${block.id}]`}
      </span>
      <span className="footnote-content">
        <InlineSpanRenderer spans={block.spans} highlightKeywords={highlightKeywords} />
      </span>
      <a href={`#fnref-${block.id}`} className="footnote-backref" aria-label="返回">
        ↩
      </a>
    </div>
  );
}

// ── Block Dispatcher ────────────────────────────────────────────────

function BlockRenderer({ block, highlightKeywords }: { block: ContentBlock; highlightKeywords?: string[] }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlockRenderer block={block} highlightKeywords={highlightKeywords} />;
    case 'paragraph':
      return <ParagraphBlockRenderer block={block} highlightKeywords={highlightKeywords} />;
    case 'annotation_block':
      return <AnnotationBlockRenderer block={block} highlightKeywords={highlightKeywords} />;
    case 'poetry':
      return <PoetryBlockRenderer block={block} highlightKeywords={highlightKeywords} />;
    case 'footnote':
      return <FootnoteBlockRenderer block={block} highlightKeywords={highlightKeywords} />;
    default:
      return null;
  }
}

function SearchBlockWrapper({
  children,
  chapterId,
  blockIndex,
  searchTarget,
}: {
  children: ReactNode;
  chapterId: string;
  blockIndex: number;
  searchTarget?: SearchTarget;
}) {
  const isTarget = searchTarget?.chapterId === chapterId && searchTarget.blockIndex === blockIndex;

  return (
    <div
      id={`chapter-block-${chapterId}-${blockIndex}`}
      data-search-block={blockIndex}
      className={cn('search-block', isTarget && 'search-target-block')}
    >
      {children}
    </div>
  );
}

// ── Chapter Renderer (top-level) ────────────────────────────────────

interface ChapterRendererProps {
  data: ChapterData;
  fontSizeClass?: string;
  searchTarget?: SearchTarget;
}

export function ChapterRenderer({ data, fontSizeClass = 'text-lg', searchTarget }: ChapterRendererProps) {
  // Separate footnotes from content blocks
  const indexedBlocks = data.blocks.map((block, blockIndex) => ({ block, blockIndex }));
  const contentBlocks = indexedBlocks.filter(({ block }) => block.type !== 'footnote');
  const footnoteBlocks = indexedBlocks.filter(({ block }) => block.type === 'footnote');

  return (
    <div className={cn('reader-prose font-serif text-xiaoxiang-ink transition-all duration-300', fontSizeClass)}>
      {/* Main content */}
      {contentBlocks.map(({ block, blockIndex }) => (
        <SearchBlockWrapper key={blockIndex} chapterId={data.id} blockIndex={blockIndex} searchTarget={searchTarget}>
          <BlockRenderer
            block={block}
            highlightKeywords={
              searchTarget?.chapterId === data.id && searchTarget.blockIndex === blockIndex
                ? searchTarget.keywords
                : undefined
            }
          />
        </SearchBlockWrapper>
      ))}

      {/* Footnotes section */}
      {footnoteBlocks.length > 0 && (
        <footer className="footnotes-section">
          <hr className="footnote-divider" />
          {footnoteBlocks.map(({ block, blockIndex }) => (
            <SearchBlockWrapper key={`fn-${blockIndex}`} chapterId={data.id} blockIndex={blockIndex} searchTarget={searchTarget}>
              <BlockRenderer
                block={block}
                highlightKeywords={
                  searchTarget?.chapterId === data.id && searchTarget.blockIndex === blockIndex
                    ? searchTarget.keywords
                    : undefined
                }
              />
            </SearchBlockWrapper>
          ))}
        </footer>
      )}
    </div>
  );
}
