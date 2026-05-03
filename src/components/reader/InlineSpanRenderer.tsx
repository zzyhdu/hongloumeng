import type { InlineSpan } from '../../types/chapterTypes';

/**
 * Renders an array of InlineSpan into React elements.
 * Shared by ParagraphBlock, AnnotationBlock, PoetryBlock, etc.
 */
export function InlineSpanRenderer({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.type) {
          case 'text':
            return <span key={i}>{span.content}</span>;

          case 'annotation':
            return (
              <span
                key={i}
                className={`annotation-inline ${span.color}`}
                title={`${span.source}${span.position}`}
              >
                {span.content}
              </span>
            );

          case 'correction':
            return (
              <span key={i} className="correction-mark">
                {span.deleted && (
                  <span className="correction-deleted">({span.deleted})</span>
                )}
                {span.inserted && (
                  <span className="correction-inserted">[{span.inserted}]</span>
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
