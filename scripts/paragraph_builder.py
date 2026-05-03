"""paragraph_builder.py - Stage 2: Build logical paragraphs from raw PDF spans.

Pipeline: flatten_spans → build_paragraphs → group_poetry → _paras.json

flatten_spans(): classify each span (body/annotation/heading), detect indent
markers, set _block_start on first content span of each block, mark poetry class.

build_paragraphs(): group spans by _line_id, flush blocks at _block_start
boundaries. Outputs heading / paragraph / annotation_block.

group_poetry(): merge consecutive poetry-indented paragraphs into poetry blocks
(with line structure). Single poetry lines stay as paragraphs.

Key thresholds:
  Body left margin: x ≈ 74 pt  |  Heading: size >= 16 pt
  Annotation: non-black, non-white color  |  Invisible: size < 2 pt or color == white
"""

import json
import os
import sys
from collections import Counter

RAW_DIR = "resource/zhiping_4color"
OUTPUT_DIR = RAW_DIR

# ── Thresholds ──
HEADING_SIZE_MIN = 16.0
INVISIBLE_SIZE_MAX = 2.0
BODY_MARGIN_X = 74.0

BLACK = 0x000000
WHITE = 0xffffff

COLOR_NAMES = {
    0x000000: 'black',
    0xff0000: 'red',
    0x00008b: 'blue',
    0x00442b: 'green',
    0xffffff: 'white',
}

# ── Helpers ──


def _is_page_number(span):
    """Filter out centered page numbers at page bottom."""
    bbox = span['bbox']
    page_h = span.get('page_height', 729)
    # Near page bottom (bottom 8%)
    if bbox[3] < page_h * 0.93:
        return False
    # Centered horizontally
    if bbox[0] < 200 or bbox[0] > 300:
        return False
    # Small font
    if span['size'] > 11:
        return False
    text = span['text'].strip()
    if not text or not text.replace(' ', '').isdigit():
        return False
    return True


# Known page-header / chapter-header patterns to filter out
_PAGE_HEADER_PATTERNS = [
    '抚琴居红楼梦脂评汇校本',
    '红楼梦脂评汇校本',
    'www.hlmbbs.com',
    'redactor: kolistan',
]

def _is_page_header(span):
    """Filter out running headers at page top (site name, chapter title repeats)."""
    text = span['text'].strip()
    # Page top area (top 12% of page)
    bbox = span['bbox']
    page_h = span.get('page_height', 729)
    if bbox[3] > page_h * 0.15:  # below top 15%
        return False
    # Known header text
    for pat in _PAGE_HEADER_PATTERNS:
        if pat in text:
            return True
    # Chapter running header: "第X回 ..." at very top of page
    # These are small-ish (9-10pt) at x ≈ 163 or x ≈ 208
    if span['size'] <= 10.5 and ('回' in text and '第' in text):
        return True
    return False


# ── Span Classification ──

def is_invisible(span):
    if span['size'] < INVISIBLE_SIZE_MAX:
        return True
    if span['color'] == WHITE:
        return True
    if not span['text'].strip():
        # Double-space (2+) at body margin → indent marker, not invisible.
        # Single spaces and spaces at other x positions are formatting noise.
        if (len(span['text']) >= 2
            and span['color'] == BLACK
            and abs(span['bbox'][0] - BODY_MARGIN_X) < 2):
            return False
        return True
    return False

def classify_span(span):
    if is_invisible(span):
        return 'invisible'
    sz = span['size']
    clr = span['color']
    if sz >= HEADING_SIZE_MIN:
        return 'heading'
    if clr not in (BLACK, WHITE):
        return 'annotation'
    return 'body'


# ── Flattening ──

def flatten_spans(raw_data):
    """Flatten raw PDF spans into a chronological sequence.

    Each span is classified (body/annotation/heading/poetry) and assigned
    a _line_id to preserve PDF line grouping.

    Block-boundary detection (per line's first span):
      - Pure-whitespace first span → delete it, set _block_start on the next
        span. If 4+ spaces or x >= 86, mark next span as poetry class.
      - Content span with leading spaces → strip spaces, set _block_start.
        Same poetry detection rules apply.
      - Neither → no _block_start (continuation line).
    Poetry→body transitions also set _block_start on the first body line.
    """
    flat = []
    _line_id = 0
    _in_poetry = False  # True while we're inside a poetry block
    for page_data in raw_data['pages']:
        page_num = page_data['page']
        page_h = page_data.get('height', 729)
        for block in page_data['blocks']:
            if block['type'] != 0:
                continue
            for line in block['lines']:
                _line_id += 1
                # Build all spans for this line first, so we can filter
                # the entire line if any span is a page header.
                line_spans = []
                has_header = False
                for span in line['spans']:
                    cls = classify_span(span)
                    if cls == 'invisible':
                        continue
                    s = {
                        'text': span['text'],
                        'size': round(span['size'], 1),
                        'font': span['font'],
                        'color': span['color'],
                        'color_name': COLOR_NAMES.get(span['color']),
                        'page': page_num,
                        'page_height': page_h,
                        'bbox': span['bbox'],
                        'origin': span['origin'],
                        'class': cls,
                        '_line_id': _line_id,
                    }
                    if cls == 'body' and _is_page_header(s):
                        has_header = True
                    line_spans.append(s)

                if has_header:
                    continue  # skip entire running-header line

                # ── Indent detection on first span ──
                if line_spans:
                    first = line_spans[0]
                    text = first.get('text', '')

                    if text and not text.strip():
                        # Pure-whitespace indent marker (e.g. '  ' or '    ')
                        n_spaces = len(text)
                        is_block = n_spaces >= 2
                        line_spans.pop(0)
                        if line_spans and is_block:
                            line_spans[0]['_block_start'] = True
                            if line_spans[0]['class'] == 'body':
                                stripped = line_spans[0]['text'].lstrip(' ')
                                if stripped and stripped[0] not in '①②③④⑤⑥⑦⑧⑨⑩':
                                    nxt_x = line_spans[0]['bbox'][0]
                                    if n_spaces >= 4 or nxt_x >= 86:
                                        line_spans[0]['class'] = 'poetry'
                    elif text and text != text.lstrip(' '):
                        # Content span with leading spaces (body text indent)
                        n_spaces = len(text) - len(text.lstrip(' '))
                        if n_spaces >= 2:
                            first['text'] = text.lstrip(' ')
                            first['_block_start'] = True
                            if first['class'] == 'body':
                                stripped = first['text'].lstrip(' ')
                                if stripped and stripped[0] not in '①②③④⑤⑥⑦⑧⑨⑩':
                                    if n_spaces >= 4 or first['bbox'][0] >= 86:
                                        first['class'] = 'poetry'

                if not line_spans:
                    continue

                # ── Poetry → body transition: if we're inside a poetry
                #     block, body at body margin starts a new block ──
                if _in_poetry:
                    first_s = line_spans[0]
                    fc = first_s.get('class')
                    fc_x = first_s['bbox'][0]
                    if (not first_s.get('_block_start')
                            and fc == 'body'
                            and abs(fc_x - BODY_MARGIN_X) < 3):
                        first_s['_block_start'] = True

                # Track whether we're inside a poetry block
                first_s = line_spans[0]
                if first_s.get('_block_start'):
                    _in_poetry = (first_s.get('class') == 'poetry')

                # ── Reclassifications based on line context ──

                # Standalone * markers on annotation lines → annotation.
                # On heading lines → heading.
                for s in line_spans:
                    if (s['class'] == 'body'
                            and s['text'].strip() == '*'
                            and s['color_name'] == 'black'):
                        for other in line_spans:
                            if other['class'] == 'annotation':
                                s['class'] = 'annotation'
                                s['color_name'] = other['color_name']
                                s['color'] = other['color']
                                break
                            elif other['class'] == 'heading':
                                s['class'] = 'heading'
                                break

                for s in line_spans:
                    if s['class'] == 'body' and _is_page_number(s):
                        continue
                    flat.append(s)
    return flat


# ── Paragraph Building ──

def _get_indent_level(run):
    """Return indent level from first span's class and _block_start.

    Returns 'poetry', 'prose', or None (continuation).
    """
    if not run:
        return None
    first = run[0]
    if not first.get('_block_start'):
        return None
    if first['class'] == 'poetry':
        return 'poetry'
    return 'prose'


def build_paragraphs(flat_spans):
    """Group spans into blocks using _block_start markers set by flatten_spans.

    Lines are grouped by _line_id. Block boundaries are at _block_start spans.
    Block type is determined by the line's content class:
      annotation → annotation_block, body/poetry → paragraph, heading → heading.
    Heading lines include all spans on the line (markers, body text, etc.).
    """
    if not flat_spans:
        return []

    # Group spans by _line_id into ordered lines
    lines = []
    current_lid = None
    current_line = []
    for s in flat_spans:
        lid = s['_line_id']
        if lid != current_lid:
            if current_line:
                lines.append(current_line)
            current_line = [s]
            current_lid = lid
        else:
            current_line.append(s)
    if current_line:
        lines.append(current_line)

    blocks = []
    current_type = None       # 'paragraph' | 'annotation_block' | None
    current_color = None      # color_name for annotation_blocks
    current_spans = []        # accumulated spans for the current block

    def flush():
        nonlocal current_type, current_color, current_spans
        if not current_spans:
            return
        if current_type == 'annotation_block':
            # annotation_block: indent if first content span is at x ≥ 86
            indent = False
            for s in current_spans:
                if s['class'] == 'annotation' and s['text'].strip():
                    indent = s['bbox'][0] >= 86
                    break
        elif current_type == 'heading':
            indent = False
        else:
            # paragraph: prose indent (x≈74), poetry indent (x ≥ 86)
            indent = _get_indent_level(current_spans)
        blocks.append({
            'type': current_type,
            'indent': indent,
            'color_name': current_color or 'black',
            'spans': list(current_spans),
        })
        current_spans = []
        current_type = None
        current_color = None

    for line_spans in lines:
        # Skip lines that are entirely page numbers
        body_spans = [s for s in line_spans if s['class'] == 'body']
        if body_spans and all(_is_page_number(s) for s in body_spans):
            continue

        # ── Heading lines → always start/merge a heading block ──
        heading_spans = [s for s in line_spans if s['class'] == 'heading']
        if heading_spans:
            # Include ALL spans on the heading line (body markers like *)
            if blocks and blocks[-1]['type'] == 'heading':
                blocks[-1]['spans'].extend(line_spans)
                blocks[-1]['text'] = ''.join(s['text'] for s in blocks[-1]['spans']).strip()
            else:
                flush()
                text = ''.join(s['text'] for s in line_spans).strip()
                if text:
                    blocks.append({
                        'type': 'heading',
                        'level': 1,
                        'text': text,
                        'color': heading_spans[0]['color_name'],
                        'indent': False,
                        'spans': list(line_spans),
                    })
            continue

        # ── Determine line's content class ──
        line_class = None
        for s in line_spans:
            if s['class'] in ('body', 'annotation', 'poetry') and s['text'].strip():
                line_class = s['class']
                break

        if line_class is None:
            if current_type is not None:
                current_spans.extend(line_spans)
            continue

        # ── Block boundary: _block_start present → new block; absent → continuation ──
        is_new = current_type is None or line_spans[0].get('_block_start')

        if is_new:
            flush()
            if line_class == 'annotation':
                current_type = 'annotation_block'
                for s in line_spans:
                    if s['class'] == 'annotation':
                        current_color = s['color_name']
                        break
            elif line_class == 'poetry':
                current_type = 'paragraph'
                current_color = 'black'
            else:
                current_type = 'paragraph'
                current_color = 'black'

        current_spans.extend(line_spans)

    flush()
    return blocks


# ── Poetry Grouping (Stage 2 post-processing) ──

def _split_poetry_prose(block):
    """Split a block that starts with poetry indentation but contains
    trailing prose at body margin.

    Returns (poetry_block, prose_block_or_None).
    """
    spans = block.get('spans', [])

    # Find where poetry ends: first body span at body margin with no spaces
    split_idx = None
    for idx, s in enumerate(spans):
        if s.get('class') not in ('body', 'poetry'):
            continue
        x = s['bbox'][0]
        text = s.get('text', '')
        # Body margin, no leading spaces → prose starts here
        if abs(x - BODY_MARGIN_X) < 3 and not text.startswith('  '):
            split_idx = idx
            break

    if split_idx is None or split_idx == 0:
        return (block, None)

    poetry_spans = spans[:split_idx]
    prose_spans = spans[split_idx:]

    # Verify poetry part has actual body content
    has_poetry_body = any(
        s.get('class') in ('body', 'poetry')
        for s in poetry_spans
    )
    if not has_poetry_body:
        return (block, None)

    poetry_block = {
        'type': 'paragraph',
        'indent': 'poetry',
        'color_name': block.get('color_name', 'black'),
        'spans': poetry_spans,
    }

    prose_block = {
        'type': 'paragraph',
        'indent': None,
        'color_name': block.get('color_name', 'black'),
        'spans': prose_spans,
    }

    return (poetry_block, prose_block)


def _make_poetry_block(blocks):
    """Convert a list of poetry-indented paragraph blocks into a single
    poetry block with line structure.
    """
    lines = []
    for b in blocks:
        lines.append(list(b.get('spans', [])))
    return {
        'type': 'poetry',
        'indent': True,
        'lines': lines,
    }


def group_poetry(blocks):
    """Group consecutive poetry-indented paragraphs into poetry blocks.

    Poetry detection is purely indentation-based:
      - indent == 'poetry' → part of a poetry group
      - indent == 'prose' or None → not poetry

    Consecutive poetry-indented blocks are grouped. Blocks that start with
    poetry indentation but contain trailing body-margin prose are split.
    Groups with fewer than 2 lines are kept as regular paragraphs.
    """
    result = []
    i = 0
    n = len(blocks)

    while i < n:
        block = blocks[i]

        if block['type'] != 'paragraph' or block.get('indent') != 'poetry':
            result.append(block)
            i += 1
            continue

        # Found start of potential poetry group
        poetry_part, prose_part = _split_poetry_prose(block)
        poetry_paragraphs = [poetry_part]
        pending_prose = prose_part
        j = i + 1
        while j < n and j < i + 30:
            nb = blocks[j]
            if nb['type'] != 'paragraph':
                break
            if nb.get('indent') == 'poetry':
                poetry_part, prose_part = _split_poetry_prose(nb)
                poetry_paragraphs.append(poetry_part)
                pending_prose = prose_part
                j += 1
            else:
                break

        if len(poetry_paragraphs) >= 2:
            result.append(_make_poetry_block(poetry_paragraphs))
            if pending_prose:
                result.append(pending_prose)
        else:
            # Single poetry-indented line — keep as regular paragraph
            block['indent'] = 'prose'
            result.append(block)

        i = j

    return result


# ── Main ──

def main():
    target_chapter = None
    if len(sys.argv) > 1:
        target_chapter = int(sys.argv[1])

    for fname in sorted(os.listdir(RAW_DIR)):
        if not fname.endswith('_raw.json'):
            continue
        num = int(fname[:3])
        if target_chapter and num != target_chapter:
            continue

        path = os.path.join(RAW_DIR, fname)
        print(f"Building paragraphs for chapter {num}...")

        with open(path) as f:
            raw = json.load(f)

        flat = flatten_spans(raw)
        paragraphs = build_paragraphs(flat)
        paragraphs = group_poetry(paragraphs)

        output = {
            'chapter': num,
            'title': raw['title'],
            'paragraphs': paragraphs,
        }

        out_path = os.path.join(OUTPUT_DIR, f"{num:03d}_paras.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        type_counts = Counter(p['type'] for p in paragraphs)
        print(f"  → {out_path}: {len(paragraphs)} blocks {dict(type_counts)}")

    print("Done.")


if __name__ == '__main__':
    main()
