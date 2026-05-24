import type { InlineSpan } from '../../types/chapterTypes';
import { splitHighlightedText } from '../../lib/searchText';

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

/**
 * Renders an array of InlineSpan into React elements.
 * Shared by ParagraphBlock, AnnotationBlock, PoetryBlock, etc.
 */
export function InlineSpanRenderer({ spans, highlightKeywords }: { spans: InlineSpan[]; highlightKeywords?: string[] }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.type) {
          case 'text':
            return <span key={i}><HighlightedText text={span.content} keywords={highlightKeywords} /></span>;

          case 'annotation':
            return (
              <span
                key={i}
                className={`annotation-inline ${span.color}`}
                title={`${span.source}${span.position}`}
              >
                <HighlightedText text={span.content} keywords={highlightKeywords} />
              </span>
            );

          case 'correction':
            return (
              <span key={i} className="correction-mark">
                {span.deleted && (
                  <span className="correction-deleted">(<HighlightedText text={span.deleted} keywords={highlightKeywords} />)</span>
                )}
                {span.inserted && (
                  <span className="correction-inserted">[<HighlightedText text={span.inserted} keywords={highlightKeywords} />]</span>
                )}
              </span>
            );

          case 'footnote_ref':
            return (
              <sup
                key={i}
                className="footnote-ref"
                id={`fnref-${span.id}`}
              >
                <a href={`#fn-${span.id}`}>
                  {'①②③④⑤⑥⑦⑧⑨⑩'[span.id - 1] || `[${span.id}]`}
                </a>
              </sup>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
