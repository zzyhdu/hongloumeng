"""debug_stage2.py - Run Stage 2 with detailed intermediate output for one chapter.

Usage: python3 scripts/debug_stage2.py <chapter_number>

Outputs:
  resource/zhiping_4color/{NNN}_flat.json   — spans after flatten_spans
  resource/zhiping_4color/{NNN}_blocks.json — blocks after build_paragraphs (before group_poetry)
"""

import json
import sys

# Import from paragraph_builder
from paragraph_builder import flatten_spans, build_paragraphs, group_poetry, RAW_DIR, OUTPUT_DIR


def summarize_spans(flat_spans):
    """Return a summary version of flat spans for inspectability."""
    result = []
    for i, s in enumerate(flat_spans):
        result.append({
            'idx': i,
            'line': s.get('_line_id'),
            'class': s['class'],
            'color': s.get('color_name'),
            'page': s['page'],
            'x': round(s['bbox'][0], 1),
            'y': round(s['bbox'][1], 1),
            'size': s['size'],
            '_block_start': s.get('_block_start'),
            'text': s.get('text', '') if s.get('text') else '',
        })
    return result


def summarize_blocks(blocks):
    """Return a summary version of blocks for inspectability."""
    result = []
    for bi, block in enumerate(blocks):
        info = {
            'block_idx': bi,
            'type': block['type'],
            'indent': block.get('indent'),
            'color_name': block.get('color_name'),
            'spans_count': len(block.get('spans', [])),
        }
        # First few spans for context
        spans = block.get('spans', [])
        info['first_span'] = summarize_spans(spans[:1])[0] if spans else None
        info['last_span'] = summarize_spans(spans[-1:])[0] if spans else None
        # Class breakdown
        from collections import Counter
        info['class_counts'] = dict(Counter(s['class'] for s in spans))
        # Full text (for readability)
        info['text'] = ''.join(s.get('text', '') for s in spans)[:200]
        result.append(info)
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/debug_stage2.py <chapter_number>")
        sys.exit(1)

    chapter = int(sys.argv[1])
    fname = f"{chapter:03d}_raw.json"
    path = f"{RAW_DIR}/{fname}"

    with open(path) as f:
        raw = json.load(f)

    # ── Step 1: flatten_spans ──
    flat = flatten_spans(raw)
    flat_out = f"{OUTPUT_DIR}/{chapter:03d}_flat.json"
    with open(flat_out, 'w', encoding='utf-8') as f:
        json.dump(summarize_spans(flat), f, ensure_ascii=False, indent=2)
    print(f"  flat spans: {len(flat)} → {flat_out}")

    # ── Step 2: build_paragraphs (full data, no summarization) ──
    blocks = build_paragraphs(flat)
    blocks_out = f"{OUTPUT_DIR}/{chapter:03d}_blocks.json"
    with open(blocks_out, 'w', encoding='utf-8') as f:
        json.dump(blocks, f, ensure_ascii=False, indent=2)
    print(f"  blocks (pre-poetry): {len(blocks)} → {blocks_out}")

    # ── Step 3: group_poetry ──
    final = group_poetry(blocks)
    from collections import Counter
    type_counts = dict(Counter(b['type'] for b in final))
    print(f"  final (post-poetry): {len(final)} blocks {type_counts}")


if __name__ == '__main__':
    main()
