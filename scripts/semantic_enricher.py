"""semantic_enricher.py - Stage 3: Semantic annotation and final JSON output.

Reads {NNN}_paras.json, applies:
  1. Annotation prefix parsing (甲侧：→ source=甲, position=侧)
  2. Poetry block detection (keyword + indent pattern)
  3. Footnote extraction (①②③ marker at chapter end)
  4. Correction mark extraction ((删)[补] → correction span)
  5. Cross-page paragraph merging
  6. Outputs ChapterData-compatible {NNN}.json

Output format matches src/types/chapterTypes.ts → ChapterData.
"""

import json
import os
import re
import sys
from collections import Counter

RAW_DIR = "resource/zhiping_4color"
OUTPUT_DIR = RAW_DIR

# ── Constants ──

SOURCE_VERSIONS = {'甲', '己', '庚', '戚', '蒙', '列', '辰'}
POSITIONS = {'眉', '侧', '夹'}
# Prefix patterns seen in the PDF:
#   甲侧：, 甲夹：, 甲眉：, 甲：, 甲总评：
#   庚：, 庚眉：, 庚侧：, 庚夹：
#   蒙侧：, 蒙眉：, 蒙：, 蒙本后人批语：
#   戚夹：, 戚总评：, 戚总批：, 戚：
#   列：, 列本：, 己：, 辰：
ANNOT_PREFIX_RE = re.compile(
    r'^([甲己庚戚蒙列辰])'          # source version
    r'(?:本(?:后人批语)?)?'         # optional 本/本后人批语
    r'([眉侧夹])?'                   # optional position
    r'(?:总[评批])?'                 # optional 总评/总批
    r'(?:：|:)\s*'                    # colon
)

FOOTNOTE_CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩'
FOOTNOTE_REF_RE = re.compile(r'[①②③④⑤⑥⑦⑧⑨⑩]')



# ── Step 1: Annotation prefix parsing ──

def parse_annotation_prefix(text):
    """Extract (source, position, rest) from annotation prefix.

    Examples:
      '甲侧：自占地步。' → ('甲', '侧', '自占地步。')
      '庚：此开卷第一回也。' → ('庚', '', '此开卷第一回也。')
      '蒙侧：何非梦幻' → ('蒙', '侧', '何非梦幻')
    """
    m = ANNOT_PREFIX_RE.match(text)
    if m:
        source = m.group(1)
        position = m.group(2) or ''
        rest = text[m.end():].strip()
        return source, position, rest
    return None, '', text


# ── Helpers ──

def _span_text(s):
    """Get text content from a span dict, regardless of its type."""
    return s.get('text', s.get('content', ''))


# ── Step 3: Footnote extraction ──

def extract_footnotes(blocks):
    """Extract footnote definitions (①②③...) from end-of-chapter blocks.

    Scans the LAST few blocks of the chapter for footnote markers.
    Footnotes typically appear at the very end, after the main content.
    Also detects inline footnote refs in paragraphs and marks them.
    """
    result = []

    for block in blocks:
        if block['type'] != 'paragraph':
            result.append(block)
            continue

        spans = block.get('spans', [])
        if not spans:
            result.append(block)
            continue

        first_text = _span_text(spans[0]).strip() if spans else ''

        # Check if this paragraph starts with a footnote marker
        fn_match = re.match(r'^\s*([①②③④⑤⑥⑦⑧⑨⑩])', first_text)
        if fn_match:
            fn_char = fn_match.group(1)
            fn_id = FOOTNOTE_CIRCLED.index(fn_char) + 1

            # Build footnote content — strip the leading marker from first span
            cleaned_spans = []
            for idx, s in enumerate(spans):
                if idx == 0:
                    # Remove the leading footnote marker character
                    text = _span_text(s)
                    cleaned = re.sub(r'^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*', '', text)
                    if not cleaned:
                        continue
                    new_s = dict(s)
                    new_s['text'] = cleaned  # footnote span — always has 'text' key
                    cleaned_spans.append(new_s)
                else:
                    cleaned_spans.append(dict(s))

            if cleaned_spans:
                result.append({
                    'type': 'footnote',
                    'id': fn_id,
                    'spans': cleaned_spans,
                })
            continue

        # Check for inline footnote refs and mark them
        has_fn_ref = False
        for s in spans:
            if s.get('type') not in ('correction',) and FOOTNOTE_REF_RE.search(_span_text(s)):
                has_fn_ref = True
                break

        if has_fn_ref:
            # Split spans at footnote ref boundaries
            new_spans = []
            for s in spans:
                if s.get('type') in ('correction',):
                    new_spans.append(s)
                    continue
                text = _span_text(s)
                parts = re.split(r'([①②③④⑤⑥⑦⑧⑨⑩])', text)
                for part in parts:
                    if not part:
                        continue
                    if part in FOOTNOTE_CIRCLED:
                        fn_id = FOOTNOTE_CIRCLED.index(part) + 1
                        new_spans.append({
                            'type': 'footnote_ref',
                            'id': fn_id,
                            'content': part,
                        })
                    else:
                        new_s = dict(s)
                        new_s['text'] = part  # raw span — always has 'text'
                        new_spans.append(new_s)
            block = dict(block)
            block['spans'] = new_spans

        result.append(block)

    return result


# ── Step 4: Correction mark extraction ──

CORRECTION_RE = re.compile(r'(?:\(([^)]*)\)|（([^）]*)）)\s*(?:\[([^\]]*)\]|［([^］]*)］)')

def extract_corrections(block):
    """Scan spans for (deleted)[inserted] patterns → correction marks."""
    if block['type'] not in ('paragraph', 'annotation_block'):
        return block

    new_spans = []
    for s in block.get('spans', []):
        if isinstance(s, dict) and s.get('type') == 'footnote_ref':
            new_spans.append(s)
            continue

        text = s.get('text', s.get('content', ''))
        m = CORRECTION_RE.search(text)
        if m:
            deleted = m.group(1) or m.group(2)
            inserted = m.group(3) or m.group(4)

            # Split around correction
            before = text[:m.start()]
            after = text[m.end():]

            if before:
                new_s = dict(s)
                new_s['text'] = before  # raw span
                new_spans.append(new_s)

            correction_span = {
                'type': 'correction',
                'deleted': deleted,
                'inserted': inserted,
            }
            new_spans.append(correction_span)

            if after:
                new_s = dict(s)
                new_s['text'] = after  # raw span
                new_spans.append(new_s)
        else:
            new_spans.append(s)

    block = dict(block)
    block['spans'] = new_spans
    return block


# ── Step 5: Cross-page paragraph merging ──

def merge_cross_page_paragraphs(blocks):
    """Merge body paragraphs that were split across page boundaries.

    A paragraph continues if:
      - Both blocks are body paragraphs
      - No indent on the continuation
      - Close vertical proximity (spans on adjacent pages)
    """
    if len(blocks) < 2:
        return blocks

    result = [blocks[0]]

    for block in blocks[1:]:
        prev = result[-1]

        if (block['type'] == 'paragraph' and prev['type'] == 'paragraph'
            and not block.get('indent') and prev.get('indent')):

            # Merge: continuation of previous paragraph
            # But check: don't merge if there's a large page gap
            prev_spans = prev.get('spans', [])
            curr_spans = block.get('spans', [])
            if prev_spans and curr_spans:
                prev_page = prev_spans[-1].get('page', 0)
                curr_page = curr_spans[0].get('page', 0)
                # Only merge if adjacent pages (gap ≤ 1)
                if curr_page - prev_page <= 1:
                    prev['spans'].extend(curr_spans)
                    # Update indent: if second block is not indented, keep merge
                    continue

        # Check for annotation_block merge (same color, adjacent)
        if (block['type'] == 'annotation_block' and prev['type'] == 'annotation_block'
            and block.get('color') == prev.get('color')):
            prev_spans = prev.get('spans', [])
            curr_spans = block.get('spans', [])
            if prev_spans and curr_spans:
                prev_page = prev_spans[-1].get('page', 0)
                curr_page = curr_spans[0].get('page', 0)
                if curr_page - prev_page == 1:
                    prev['spans'].extend(curr_spans)
                    continue

        result.append(block)

    return result


# ── InlineSpan Conversion ──

def _make_inline_span(span_dict, color_source_map=None):
    """Convert a raw span dict to an InlineSpan-compatible dict.

    Handles: text, annotation (if inline), correction, footnote_ref.
    """
    # Already converted by extract_corrections/footnotes
    if span_dict.get('type') in ('correction', 'footnote_ref'):
        return span_dict

    text = span_dict.get('text', '')
    color_name = span_dict.get('color_name')

    # Annotation span — block-level (annotation_block) or inline (paragraph)
    if span_dict.get('class') == 'annotation' and color_name in ('red', 'blue', 'green') and text.strip():
        source, position, _ = parse_annotation_prefix(text)
        if source is None:
            # No explicit prefix — inherit from same-color annotations in this chapter
            position = ''
            if color_source_map:
                source = color_source_map.get(color_name, '')
        return {
            'type': 'annotation',
            'source': source or '',
            'position': position,
            'color': color_name,
            'content': text,  # keep original text, prefix and all
        }

    return {
        'type': 'text',
        'content': text,
    }


# ── Main Processing ──

def process_chapter(data):
    """Run all Stage 3 steps on a chapter's _paras.json data."""
    blocks = data['paragraphs']

    # Step 0: Learn color→source mapping from explicit annotation prefixes
    # e.g. a green annotation with "庚：" prefix tells us green=庚 in this chapter.
    color_source_map = {}
    for block in blocks:
        if block['type'] == 'annotation_block':
            full_text = ''.join(_span_text(s) for s in block.get('spans', [])).strip()
            source, _, __ = parse_annotation_prefix(full_text)
            if source is not None:
                color_name = block.get('color_name', '')
                if color_name and color_name not in color_source_map:
                    color_source_map[color_name] = source

    # Step 1: Parse annotation block prefixes
    processed = []
    for block in blocks:
        if block['type'] == 'annotation_block':
            full_text = ''.join(_span_text(s) for s in block.get('spans', [])).strip()
            # Parse prefix from first content span in the block.
            first_span = None
            for s in block.get('spans', []):
                if s.get('class') == 'annotation' and s.get('text', '').strip():
                    first_span = s
                    break
            if first_span is None:
                first_span = block['spans'][0] if block.get('spans') else None
            first_text = _span_text(first_span).strip() if first_span else ''
            source, position, rest = parse_annotation_prefix(first_text)
            if source is not None:
                # Prefix detected — keep original text intact (frontend uses color,
                # not text labels, to distinguish sources)
                pass
            else:
                # Prefix not in first span — try full text to detect block source/position
                # (e.g. continuation blocks may not have a prefix, or it spans multiple lines)
                source, position, _ = parse_annotation_prefix(full_text)
            if source is None:
                # No explicit prefix — inherit from same-color annotations in this chapter
                color_name = block.get('color_name', '')
                source = color_source_map.get(color_name, '')
                position = ''
            processed.append({
                'type': 'annotation_block',
                'source': source,
                'position': position,
                'color': block.get('color_name', 'green'),
                'indent': block.get('indent', False),
                'spans': block.get('spans', []),
            })
        elif block['type'] == 'heading':
            full_text = ''.join(_span_text(s) for s in block.get('spans', [])).strip()
            processed.append({
                'type': 'heading',
                'level': 1,
                'text': full_text,
            })
        else:
            # Paragraph — extract corrections inline
            processed.append(block)

    # Step 2: Extract corrections from paragraphs
    processed = [extract_corrections(b) for b in processed]

    # Step 3: Extract footnotes
    processed = extract_footnotes(processed)

    # Step 5: Merge cross-page paragraphs
    processed = merge_cross_page_paragraphs(processed)

    # Step 5: Convert spans to InlineSpan format
    cmap = color_source_map  # captured from Step 0
    _cvt = lambda s: _make_inline_span(s, cmap)
    final_blocks = []
    for block in processed:
        if block['type'] == 'heading':
            final_blocks.append(block)
        elif block['type'] == 'poetry':
            # Convert each line's spans to InlineSpan
            converted_lines = []
            for line_spans in block['lines']:
                converted_lines.append([_cvt(s) for s in line_spans])
            final_blocks.append({
                'type': 'poetry',
                'lines': converted_lines,
            })
        elif block['type'] == 'footnote':
            converted_spans = [_cvt(s) for s in block.get('spans', [])]
            final_blocks.append({
                'type': 'footnote',
                'id': block['id'],
                'spans': converted_spans,
            })
        else:
            # paragraph / annotation_block
            converted_spans = [_cvt(s) for s in block.get('spans', [])]

            if block['type'] == 'annotation_block':
                final_blocks.append({
                    'type': 'annotation_block',
                    'source': block.get('source', ''),
                    'position': block.get('position', ''),
                    'color': block.get('color', 'green'),
                    'indent': block.get('indent', False),
                    'spans': converted_spans,
                })
            else:
                # paragraph: indent string ('prose') → boolean for frontend
                final_blocks.append({
                    'type': 'paragraph',
                    'indent': block.get('indent') == 'prose',
                    'spans': converted_spans,
                })

    return final_blocks


# ── Main ──

def main():
    target_chapter = None
    if len(sys.argv) > 1:
        target_chapter = int(sys.argv[1])

    for fname in sorted(os.listdir(RAW_DIR)):
        if not fname.endswith('_paras.json'):
            continue
        num = int(fname[:3])
        if target_chapter and num != target_chapter:
            continue

        path = os.path.join(RAW_DIR, fname)
        print(f"Enriching chapter {num}...")

        with open(path) as f:
            data = json.load(f)

        final_blocks = process_chapter(data)

        chapter_data = {
            'id': f'{num:03d}',
            'chapterNumber': num,
            'title': data['title'],
            'blocks': final_blocks,
        }

        out_path = os.path.join(OUTPUT_DIR, f"{num:03d}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)

        type_counts = Counter(b['type'] for b in final_blocks)
        print(f"  → {out_path}: {len(final_blocks)} blocks {dict(type_counts)}")

    print("Done.")


if __name__ == '__main__':
    main()
