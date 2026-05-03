# PDF → JSON → HTML Pipeline Implementation Plan

> **Status: ALL TASKS COMPLETE (2026-05-02)**

**Goal:** Build a 3-stage Python pipeline to faithfully extract all PDF text information into JSON, then update the React frontend to render it.

**Architecture:** Three independent Python scripts form the extraction pipeline. Each reads structured JSON from the previous stage, applies analysis, and outputs the next stage. The React frontend consumes the final JSON via `JsonReaderPane` → `ChapterRenderer` → `InlineSpanRenderer`.

**Tech Stack:** Python 3 + PyMuPDF (PDF extraction), TypeScript + React (frontend), existing project uses Vite + Tailwind CSS.

**Key Data:** 1039-page PDF, 80 chapters (pages 12–1039, 0-indexed), ~516×729 pts page size. TOC available via `doc.get_toc()`.

## Implementation Deviations from Plan

The actual implementation differs from the code sketches below in these key ways:

1. **paragraph_builder.py**: Much more sophisticated than the skeleton below. Includes per-line page header filtering, indent span markers, four-condition inline annotation detection, three-level indent detection (explicit markers / physical x-offset / leading spaces), and footnote ref detection.

2. **semantic_enricher.py poetry detection**: Simplified from keyword+indent+clause-length heuristics (~120 lines) to **pure indentation-based detection** (~35 lines). Poetry uses 4+ leading spaces or x≥86+2 spaces; prose uses 2 spaces at body margin (x≈74). No keywords, no clause analysis, no dialogue detection.

3. **Color→source mapping**: Added learning phase (Step 0) that infers source version from explicit annotation prefixes (e.g. green block with "庚：" prefix teaches green=庚).

4. **Cross-page paragraph merging**: Added in Stage 3 (not Stage 2 as originally planned), merging adjacent-page paragraphs of the same type.

5. **Frontend types**: `chapterTypes.ts` uses a simplified InlineSpan model (text/annotation/correction/footnote_ref) without per-span source_info. The Python output omits raw bbox/page data from InlineSpan (reduces JSON size ~70%).

---

### Task 1: Implement span_dumper.py (Stage 1)

**Files:**
- Create: `scripts/span_dumper.py`
- Create: `scripts/analyze_pdf.py` (helper: PDF structure analysis)

- [x] **Step 1: Write analyze_pdf.py to understand the PDF structure**

Analyze the PDF before writing the dumper. This script gathers:
- TOC structure (chapter page ranges)
- Font size distribution across the whole document
- Color distribution
- Image block locations
- Page dimension consistency

```python
"""analyze_pdf.py - Gather statistics about the PDF structure."""
import fitz
from collections import Counter
import json

PDF_PATH = "resource/4color_zhiping.pdf"

doc = fitz.open(PDF_PATH)
print(f"Total pages: {len(doc)}")

# TOC
toc = doc.get_toc()
chapters = []
for entry in toc:
    level, title, page = entry
    if '回' in title and level == 2:
        chapters.append({'title': title.strip(), 'start_page': page - 1})

for i in range(len(chapters) - 1):
    chapters[i]['end_page'] = chapters[i+1]['start_page']
if chapters:
    chapters[-1]['end_page'] = len(doc)

# Font size distribution
font_sizes = Counter()
colors = Counter()
fonts = Counter()
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if block.get("type") == 1:
            continue
        for line in block.get("lines", []):
            for span in line["spans"]:
                font_sizes[round(span["size"], 1)] += 1
                colors[span["color"]] += 1
                fonts[span["font"]] += 1

print(f"\nChapters: {len(chapters)}")
print(f"Chapter 1: page {chapters[0]['start_page']}-{chapters[0]['end_page']}")
print(f"Last chapter: {chapters[-1]['start_page']}-{chapters[-1]['end_page']}")

print(f"\nTop 20 font sizes:")
for sz, cnt in font_sizes.most_common(20):
    print(f"  {sz}: {cnt}")

print(f"\nTop 10 colors (decimal):")
for c, cnt in colors.most_common(10):
    print(f"  0x{c:06x} ({c}): {cnt}")

print(f"\nFonts:")
for f, cnt in fonts.most_common(10):
    print(f"  {f}: {cnt}")
```

- [x] **Step 2: Run analyze_pdf.py and collect output**

Run: `source .venv/bin/activate && python3 scripts/analyze_pdf.py`

Capture the font size thresholds and color values for use in Stage 2.

- [x] **Step 3: Write span_dumper.py**

The dumper reads the PDF page by page (by chapter ranges from TOC) and writes `{NNN}_raw.json`. It preserves every field PyMuPDF provides — no filtering, no classification.

```python
"""span_dumper.py - Stage 1: Extract all PDF text spans into raw JSON."""
import fitz
import json
import os
import re
import sys

PDF_PATH = "resource/4color_zhiping.pdf"
OUTPUT_DIR = "resource/zhiping_4color"

CN_NUMS = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '百': 100,
}

def chinese_to_int(s):
    result = 0
    current = 0
    for ch in s:
        val = CN_NUMS.get(ch, 0)
        if val == 10:
            if current == 0:
                current = 1
            result += current * 10
            current = 0
        elif val == 100:
            if current == 0:
                current = 1
            result += current * 100
            current = 0
        else:
            current = val
    result += current
    return result

def get_chapters(doc):
    """Extract chapter page ranges from TOC."""
    toc = doc.get_toc()
    chapters = []
    for entry in toc:
        level, title, page = entry
        m = re.match(r'第([一二三四五六七八九十百零]+)回', title.strip())
        if m and level == 2:
            num = chinese_to_int(m.group(1))
            chapters.append({
                'num': num,
                'title': title.strip(),
                'start_page': page - 1,  # 0-indexed
            })
    for i in range(len(chapters) - 1):
        chapters[i]['end_page'] = chapters[i+1]['start_page']
    if chapters:
        chapters[-1]['end_page'] = len(doc)
    return chapters

def dump_page(doc, page_num):
    """Extract all blocks/lines/spans from a page. Returns dict matching PDF structure exactly."""
    page = doc.load_page(page_num)
    rect = page.rect
    data = {
        "page": page_num,
        "width": round(rect.width, 1),
        "height": round(rect.height, 1),
        "blocks": [],
    }
    blocks = page.get_text("dict")["blocks"]
    img_idx = 0
    for block in blocks:
        if block.get("type") == 1:
            # Image block
            data["blocks"].append({
                "type": 1,
                "number": block.get("number"),
                "bbox": list(block.get("bbox", [])),
                "width": block.get("width"),
                "height": block.get("height"),
                "image_index": img_idx,
            })
            img_idx += 1
        elif "lines" in block:
            lines = []
            for line in block["lines"]:
                spans = []
                for span in line["spans"]:
                    # Handle char_flags which can be a list or int
                    cf = span.get("char_flags")
                    if isinstance(cf, list):
                        cf = cf  # keep as list
                    spans.append({
                        "text": span["text"],
                        "size": span["size"],
                        "font": span["font"],
                        "color": span["color"],
                        "flags": span["flags"],
                        "alpha": span.get("alpha", 255),
                        "ascender": span.get("ascender"),
                        "descender": span.get("descender"),
                        "bidi": span.get("bidi", 0),
                        "char_flags": cf,
                        "origin": list(span["origin"]),
                        "bbox": list(span["bbox"]),
                    })
                lines.append({
                    "bbox": list(line["bbox"]),
                    "wmode": line.get("wmode", 0),
                    "dir": list(line.get("dir", [1.0, 0.0])),
                    "spans": spans,
                })
            data["blocks"].append({
                "type": 0,
                "number": block.get("number"),
                "bbox": list(block.get("bbox", [])),
                "lines": lines,
            })
    return data

def main():
    target_chapter = None
    if len(sys.argv) > 1:
        target_chapter = int(sys.argv[1])

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    chapters = get_chapters(doc)

    for ch in chapters:
        if target_chapter and ch['num'] != target_chapter:
            continue
        print(f"Dumping chapter {ch['num']}: {ch['title']} (pages {ch['start_page']+1}-{ch['end_page']})")

        pages = []
        for pn in range(ch['start_page'], ch['end_page']):
            pages.append(dump_page(doc, pn))

        output = {
            "chapter": ch['num'],
            "title": ch['title'],
            "pages": pages,
        }

        filename = os.path.join(OUTPUT_DIR, f"{ch['num']:03d}_raw.json")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False)

        total_spans = sum(
            1 for p in pages for b in p["blocks"] if b["type"] == 0
            for ln in b["lines"] for _ in ln["spans"]
        )
        print(f"  → {filename}: {len(pages)} pages, {total_spans} spans")

    doc.close()
    print("Done.")

if __name__ == '__main__':
    main()
```

- [x] **Step 4: Run span_dumper.py on chapter 1**

Run: `source .venv/bin/activate && python3 scripts/span_dumper.py 1`

Expected: creates `resource/zhiping_4color/001_raw.json` with ~17 pages and several thousand spans.

- [x] **Step 5: Verify the output shape**

Run a quick validation:

```python
source .venv/bin/activate && python3 -c "
import json
with open('resource/zhiping_4color/001_raw.json') as f:
    data = json.load(f)
print(f'chapter: {data[\"chapter\"]}')
print(f'title: {data[\"title\"]}')
print(f'pages: {len(data[\"pages\"])}')
p0 = data['pages'][0]
print(f'page 0: {p0[\"width\"]}x{p0[\"height\"]}')
print(f'blocks on page 0: {len(p0[\"blocks\"])}')
# Check a text span has all 12 fields
span = None
for b in p0['blocks']:
    if b['type'] == 0:
        span = b['lines'][0]['spans'][0]
        break
print(f'span fields: {sorted(span.keys())}')
print(f'sample span: {json.dumps(span, ensure_ascii=False, indent=2)[:500]}')
"
```

- [x] **Step 6: Run span_dumper.py on all 80 chapters**

Run: `source .venv/bin/activate && python3 scripts/span_dumper.py`

Expected: creates `resource/zhiping_4color/{001..080}_raw.json`.

- [x] **Step 7: Commit**

```bash
git add scripts/span_dumper.py scripts/analyze_pdf.py resource/zhiping_4color/*_raw.json
git commit -m "feat: add Stage 1 span_dumper.py - raw PDF extraction to JSON

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Implement paragraph_builder.py (Stage 2)

**Files:**
- Create: `scripts/paragraph_builder.py`
- Create: `scripts/analyze_spans.py` (helper: span-level statistics for threshold detection)

- [x] **Step 1: Write analyze_spans.py**

Analyze the raw JSON spans to determine:
- Exact font size thresholds (what size separates annotations from body text)
- Color → color_name mapping
- X-coordinate patterns (page margins, indent widths)
- Line spacing patterns

```python
"""analyze_spans.py - Analyze span metrics from raw JSON for Stage 2 thresholds."""
import json
import os
from collections import Counter

RAW_DIR = "resource/zhiping_4color"

# Sample across multiple chapters
font_sizes = Counter()
colors_map = {}
x_starts = Counter()  # x0 of spans (for indent detection)
y_deltas = []  # vertical gaps between consecutive spans

for fname in sorted(os.listdir(RAW_DIR)):
    if not fname.endswith('_raw.json'):
        continue
    path = os.path.join(RAW_DIR, fname)
    with open(path) as f:
        data = json.load(f)
    
    prev_bottom = None
    for page in data['pages']:
        for block in page['blocks']:
            if block['type'] != 0:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    font_sizes[round(span['size'], 1)] += 1
                    x_starts[round(span['bbox'][0], 1)] += 1
                    if prev_bottom is not None:
                        y_deltas.append(round(span['bbox'][1] - prev_bottom, 1))
                    prev_bottom = span['bbox'][3]
    
    if len(font_sizes) > 20:
        break  # enough data

print("Font size distribution (top 30):")
for sz, cnt in font_sizes.most_common(30):
    print(f"  {sz:.1f}: {cnt}")

print(f"\nX-start positions (top 20):")
for x, cnt in x_starts.most_common(20):
    print(f"  {x:.1f}: {cnt}")

print(f"\nY-delta distribution (top 20):")
y_delta_counter = Counter(y_deltas)
for y, cnt in y_delta_counter.most_common(20):
    print(f"  {y:.1f}: {cnt}")

# Suggest thresholds
print("\n--- Suggested thresholds ---")
# Body text: most common font size in 10-16 range
body_sizes = [(sz, cnt) for sz, cnt in font_sizes.items() if 10 <= sz < 16]
if body_sizes:
    body_size = max(body_sizes, key=lambda x: x[1])[0]
    print(f"Body text font size: {body_size:.1f}")
# Annotation text: most common below body
annot_sizes = [(sz, cnt) for sz, cnt in font_sizes.items() if sz < 10]
if annot_sizes:
    annot_size = max(annot_sizes, key=lambda x: x[1])[0]
    print(f"Annotation font size: {annot_size:.1f}")
```

- [x] **Step 2: Run analyze_spans.py and record thresholds**

Run: `source .venv/bin/activate && python3 scripts/analyze_spans.py`

Record the detected font size thresholds and margin/indent values.

- [x] **Step 3: Write paragraph_builder.py**

The builder reads `{NNN}_raw.json`, flattens spans into a chronological sequence, applies font-size-based classification and coordinate-based paragraph boundary detection, then outputs `{NNN}_paras.json`.

```python
"""paragraph_builder.py - Stage 2: Build logical paragraphs from raw spans."""
import json
import os
import sys
from collections import defaultdict

RAW_DIR = "resource/zhiping_4color"
OUTPUT_SUFFIX = "_paras.json"

# Thresholds determined by analyze_spans.py
HEADING_SIZE_THRESHOLD = 16.0
BODY_SIZE_MIN = 10.0
# Anything below BODY_SIZE_MIN = annotation text

# Color mapping
COLOR_MAP = {
    0xff0000: 'red',
    0x00008b: 'blue',
    0x00442b: 'green',
    0x442b: 'green',
}
DEFAULT_COLORS = {'red': 0xff0000, 'blue': 0x00008b, 'green': 0x00442b}

def color_name(color_int):
    return COLOR_MAP.get(color_int, None)

def flatten_spans(raw_data):
    """Flatten all text spans in page order, each tagged with page number."""
    flat = []
    for page_data in raw_data['pages']:
        page_num = page_data['page']
        for block in page_data['blocks']:
            if block['type'] != 0:
                # Save image block info but don't include in paragraph flow
                continue
            for line in block['lines']:
                for span in line['spans']:
                    span['_page'] = page_num
                    flat.append(span)
    return flat

def classify_span(span):
    """Classify a raw span by font size."""
    sz = span['size']
    if sz >= HEADING_SIZE_THRESHOLD:
        return 'heading'
    elif sz >= BODY_SIZE_MIN:
        return 'body'
    else:
        return 'annotation'

def build_paragraphs(flat_spans):
    """Group classified spans into paragraphs/blocks."""
    paragraphs = []
    current_type = None  # 'body' | 'annotation' | 'heading'
    current_color = None
    current_spans = []
    
    i = 0
    while i < len(flat_spans):
        span = flat_spans[i]
        cls = classify_span(span)
        cname = color_name(span['color'])
        text = span['text']
        
        if cls == 'heading':
            # Flush current, start new heading (heading is standalone)
            if current_spans:
                paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
                current_spans = []
            current_type = 'heading'
            current_color = cname
            current_spans = [span]
            # Heading ends at this span
            paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
            current_spans = []
            current_type = None
            current_color = None
            i += 1
            continue
        
        if cls == 'body':
            # Check for paragraph break
            if current_type == 'body' and _is_new_paragraph(span, current_spans, flat_spans, i):
                paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
                current_spans = []
            elif current_type == 'annotation' and current_spans:
                # Prev block was annotation block, flush it
                paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
                current_spans = []
                current_color = None
            
            current_type = 'body'
            if cname:
                current_color = cname
            current_spans.append(span)
        
        else:  # annotation
            # Annotations that are inline (small text between body text on same line)
            # vs block annotations (continuous small text)
            # Key heuristic: if there's a nearby body span before AND after on the same page,
            # it's likely inline
            
            is_inline = _is_inline_annotation(span, flat_spans, i)
            
            if is_inline:
                # Add inline annotation to current paragraph
                if current_type != 'body':
                    # Start a new body paragraph
                    if current_spans:
                        paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
                        current_spans = []
                    current_type = 'body'
                    current_color = None
                current_spans.append(span)
            else:
                # Block annotation
                if current_type == 'body' and current_spans:
                    paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
                    current_spans = []
                
                color_key = cname
                # Check if new annotation block (different color or first one)
                if current_type != 'annotation' or (color_key and current_color != color_key):
                    if current_spans:
                        paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
                        current_spans = []
                    current_type = 'annotation'
                    current_color = color_key
                
                current_spans.append(span)
        
        i += 1
    
    # Flush final paragraph
    if current_spans:
        paragraphs.append(_make_paragraph(current_type, current_color, current_spans))
    
    return paragraphs

def _is_new_paragraph(span, current_spans, all_spans, idx):
    """Detect paragraph boundary based on indent and vertical spacing."""
    if not current_spans:
        return False
    
    prev_span = current_spans[-1]
    text = span['text']
    bbox = span['bbox']
    prev_bbox = prev_span['bbox']
    
    # Vertical gap: if > 1.5x normal line height, new paragraph
    normal_line_height = span['size'] * 1.5
    vertical_gap = bbox[1] - prev_bbox[3]
    if vertical_gap > normal_line_height * 2:
        return True
    
    # Indent: if x-start is significantly right of body margin
    # Body margin is typically around 70-80pts
    body_x_margin = 73.0  # determined from analyze_spans.py output
    if bbox[0] > body_x_margin + 15:  # 2+ character indent
        return True
    
    # Start of a page = potential new paragraph
    if span['_page'] != prev_span.get('_page'):
        # Check if it starts with indent
        if bbox[0] > body_x_margin + 10:
            return True
    
    return False

def _is_inline_annotation(span, all_spans, idx):
    """Determine if a small-font span is inline or a block annotation."""
    # Look at nearby spans
    # If same page has body text immediately before AND after, it's inline
    page = span['_page']
    y = span['bbox'][1]
    
    has_body_before = False
    has_body_after = False
    
    # Check previous spans on same page
    for j in range(idx - 1, max(0, idx - 5), -1):
        prev = all_spans[j]
        if prev['_page'] != page:
            break
        if classify_span(prev) == 'body':
            has_body_before = True
            break
    
    # Check next spans on same page
    for j in range(idx + 1, min(len(all_spans), idx + 5)):
        nxt = all_spans[j]
        if nxt['_page'] != page:
            break
        if classify_span(nxt) == 'body':
            has_body_after = True
            break
    
    # Block annotation: starts with prefix like 甲侧：, 庚： etc
    text = span['text'].strip()
    if has_body_before and not has_body_after:
        # Might be start of annotation block after a paragraph
        return False
    
    return has_body_before and has_body_after

def _make_paragraph(p_type, color, spans):
    """Build a paragraph dict from accumulated spans."""
    if not spans:
        return None
    
    # Determine paragraph type
    para_type = 'paragraph'
    if p_type == 'annotation':
        para_type = 'annotation_block'
    elif p_type == 'heading':
        para_type = 'heading'
    
    first_span_x = spans[0]['bbox'][0]
    # Rough indent detection: most spans start around 73, indented ones around 100+
    indent = first_span_x > 85
    
    output_spans = []
    for s in spans:
        out = {
            'content': s['text'],
            'font_size': s['size'],
            'color': s['color'],
            'color_name': color_name(s['color']),
            'font_name': s['font'],
            'bbox': s['bbox'],
            'origin': s['origin'],
            'page': s['_page'],
        }
        output_spans.append(out)
    
    return {
        'type': para_type,
        'indent': indent,
        'color_name': color,
        'spans': output_spans,
    }

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
        
        # Filter out None items
        paragraphs = [p for p in paragraphs if p is not None]
        
        output = {
            'chapter': num,
            'title': raw['title'],
            'paragraphs': paragraphs,
        }
        
        out_path = os.path.join(RAW_DIR, f"{num:03d}{OUTPUT_SUFFIX}")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        type_counts = Counter(p['type'] for p in paragraphs)
        print(f"  → {out_path}: {len(paragraphs)} paragraphs {dict(type_counts)}")
    
    print("Done.")

if __name__ == '__main__':
    main()
```

- [x] **Step 4: Run paragraph_builder.py on chapter 1**

Run: `source .venv/bin/activate && python3 scripts/paragraph_builder.py 1`

Expected: creates `resource/zhiping_4color/001_paras.json`.

- [x] **Step 5: Manually review the paragraph output**

Spot-check paragraphs against the original PDF or existing `001.json`:
- Are body text paragraphs correctly separated?
- Are block annotations detected?
- Are inline annotations placed inside paragraphs?
- Are headings detected?

If thresholds are wrong, update them in `paragraph_builder.py` based on `analyze_spans.py` data.

- [x] **Step 6: Iterate on paragraph boundary heuristics**

Repeat steps 4-5, tuning:
- `BODY_SIZE_MIN` threshold
- `_is_new_paragraph()` vertical gap and indent thresholds
- `_is_inline_annotation()` heuristics

Until chapter 1 output is satisfactory.

- [x] **Step 7: Run on all 80 chapters**

Run: `source .venv/bin/activate && python3 scripts/paragraph_builder.py`

- [x] **Step 8: Commit**

```bash
git add scripts/paragraph_builder.py scripts/analyze_spans.py resource/zhiping_4color/*_paras.json
git commit -m "feat: add Stage 2 paragraph_builder.py - logical paragraph detection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Implement semantic_enricher.py (Stage 3)

**Files:**
- Create: `scripts/semantic_enricher.py`

- [x] **Step 1: Write semantic_enricher.py**

The enricher reads `{NNN}_paras.json`, applies semantic processing, and writes the final `{NNN}.json` (overwriting existing files with the compatible `ChapterData` format).

```python
"""semantic_enricher.py - Stage 3: Add semantic annotations to paragraphs."""
import json
import os
import re
import sys

RAW_DIR = "resource/zhiping_4color"

SOURCE_VERSIONS = {'甲', '己', '庚', '戚', '蒙', '列', '辰'}
POSITIONS = {'眉', '侧', '夹'}
ANNOT_PREFIX_RE = re.compile(r'^([甲己庚戚蒙列辰])([眉侧夹])?(?:：|:)(.*)$', re.DOTALL)

FOOTNOTE_NUMS = '①②③④⑤⑥⑦⑧⑨⑩'
FOOTNOTE_REF_RE = re.compile(r'[①②③④⑤⑥⑦⑧⑨⑩]')

CORRECTION_BOTH_RE = re.compile(r'\(([^)]*)\)\[([^\]]*)\]')
CORRECTION_DEL_RE = re.compile(r'\(([^)]+)\)(?!\[)')
CORRECTION_INS_RE = re.compile(r'(?<!\))\[([^\]]+)\]')

def parse_annotation_prefix(text):
    """Extract source and position from annotation prefix like '甲侧：content'."""
    m = ANNOT_PREFIX_RE.match(text.strip())
    if m:
        return m.group(1), (m.group(2) or ''), m.group(3)
    return None, '', text

def extract_inline_spans(span_objects):
    """Convert raw spans into InlineSpan format with text/annotation/correction/footnote_ref."""
    # First, join all text into one string, with markers for annotation positions
    # This is a simpler version; for now just pass through text and small-font as annotations
    result = []
    for s in span_objects:
        content = s['content']
        cname = s.get('color_name')
        font_size = s.get('font_size', 12)
        
        # Small font + colored = inline annotation
        if font_size < 10 and cname:
            source, position, ann_content = parse_annotation_prefix(content)
            if source is None:
                source = '庚'
                position = '夹'
                ann_content = content
            result.append({
                'type': 'annotation',
                'source': source,
                'position': position,
                'color': cname,
                'content': ann_content,
            })
        else:
            # Process text for corrections and footnote refs
            result.append({'type': 'text', 'content': content})
    
    return result

def detect_poetry(paragraphs):
    """Rule-based poetry detection using keywords, indent patterns."""
    poetry_keywords = ['口占', '高吟', '吟罢', '口号', '诗云', '复高吟', '一绝', '一联云']
    
    result = []
    i = 0
    while i < len(paragraphs):
        p = paragraphs[i]
        
        if p['type'] != 'paragraph':
            result.append(p)
            i += 1
            continue
        
        full_text = ''.join(s['content'] for s in p.get('spans', []))
        
        # Check for poetry keyword
        has_keyword = any(kw in full_text for kw in poetry_keywords)
        if not has_keyword:
            result.append(p)
            i += 1
            continue
        
        # Look ahead for indented lines that follow
        poetry_lines = []
        j = i
        while j < len(paragraphs):
            pj = paragraphs[j]
            if pj['type'] != 'paragraph':
                break
            pj_text = ''.join(s['content'] for s in pj.get('spans', []))
            # Check if this is a poetry line: indented + shorter than body
            is_poetry_candidate = (
                pj.get('indent') and 
                len(pj_text) < 100 and
                not any(kw in pj_text for kw in ['说道', '道：', '笑道'])
            )
            if is_poetry_candidate:
                poetry_lines.append(pj)
                j += 1
            else:
                # Check if there's narrative continuation (e.g., "雨村吟罢...")
                if any(kw in pj_text for kw in ['吟罢', '念毕', '歌毕', '题毕']):
                    # This is the end of poetry section
                    break
                break
        
        if poetry_lines:
            # Build poetry block
            lines = []
            for pl in poetry_lines:
                line_spans = extract_inline_spans(pl.get('spans', []))
                lines.append(line_spans)
            
            # Convert the keyword-containing first paragraph if it's mixed (keyword + some poetry)
            result.append({
                'type': 'poetry',
                'lines': lines,
            })
            i = j
        else:
            result.append(p)
            i += 1
    
    return result

def extract_footnotes(paragraphs):
    """Extract footnote definitions from end-of-chapter paragraphs."""
    result = []
    footnotes = []
    
    for p in paragraphs:
        if p['type'] != 'paragraph':
            result.append(p)
            continue
        
        full_text = ''.join(s['content'] for s in p.get('spans', []))
        fn_match = re.match(r'^\s*([①②③④⑤⑥⑦⑧⑨⑩])', full_text.strip())
        if fn_match:
            fn_char = fn_match.group(1)
            fn_id = FOOTNOTE_NUMS.index(fn_char) + 1
            # Clean the footnote text
            spans = p.get('spans', [])
            cleaned = []
            first = True
            for s in spans:
                content = s['content']
                if first:
                    content = content.lstrip()
                    if content.startswith(fn_char):
                        content = content[len(fn_char):].lstrip()
                    if content.startswith('按：') or content.startswith('按:'):
                        content = content[2:]
                    first = False
                if content:
                    cleaned.append({**s, 'content': content})
            
            if cleaned:
                footnotes.append({
                    'type': 'footnote',
                    'id': fn_id,
                    'spans': cleaned,
                })
            continue
        
        result.append(p)
    
    result.extend(footnotes)
    return result

def process_annotation_block(p):
    """Process an annotation_block into the final format."""
    full_text = ''.join(s['content'] for s in p.get('spans', []))
    source, position, content = parse_annotation_prefix(full_text)
    if source is None:
        source = '庚'
        position = '夹'
        content = full_text
    
    # Build inline spans from the content
    spans = extract_inline_spans(p.get('spans', []))
    
    return {
        'type': 'annotation_block',
        'source': source,
        'position': position,
        'color': p.get('color_name', 'green'),
        'indent': p.get('indent', False),
        'spans': spans,
    }

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
        
        paragraphs = data['paragraphs']
        
        # Step 1: Process annotation blocks
        processed = []
        for p in paragraphs:
            if p['type'] == 'annotation_block':
                processed.append(process_annotation_block(p))
            elif p['type'] == 'heading':
                processed.append({
                    'type': 'heading',
                    'level': 1,
                    'text': ''.join(s['content'] for s in p.get('spans', [])),
                })
            else:
                # Paragraph with potential inline annotations
                spans = extract_inline_spans(p.get('spans', []))
                processed.append({
                    'type': 'paragraph',
                    'indent': p.get('indent', False),
                    'spans': spans,
                })
        
        # Step 2: Detect poetry
        processed = detect_poetry(processed)
        
        # Step 3: Extract footnotes
        processed = extract_footnotes(processed)
        
        # Build final output
        chapter_data = {
            'id': f'{num:03d}',
            'chapterNumber': num,
            'title': data['title'],
            'blocks': processed,
        }
        
        out_path = os.path.join(RAW_DIR, f"{num:03d}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        block_counts = {}
        for b in processed:
            block_counts[b['type']] = block_counts.get(b['type'], 0) + 1
        print(f"  → {out_path}: {len(processed)} blocks {block_counts}")
    
    print("Done.")

if __name__ == '__main__':
    main()
```

- [x] **Step 2: Run semantic_enricher.py on chapter 1**

Run: `source .venv/bin/activate && python3 scripts/semantic_enricher.py 1`

Expected: creates/overwrites `resource/zhiping_4color/001.json`.

- [x] **Step 3: Compare output with expectations**

Diff the new `001.json` against the previous one (if backed up):
- Check annotation source/position parsing
- Check poetry block detection
- Check footnote extraction
- Verify the `ChapterData` type compatibility

- [x] **Step 4: Iterate on heuristics until chapter 1 is correct**

Tune poetry detection, annotation prefix parsing, footnote detection.

- [x] **Step 5: Run on all 80 chapters**

Run: `source .venv/bin/activate && python3 scripts/semantic_enricher.py`

- [x] **Step 6: Commit**

```bash
git add scripts/semantic_enricher.py resource/zhiping_4color/*.json
git commit -m "feat: add Stage 3 semantic_enricher.py - annotation/poetry/footnote parsing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update TypeScript types

**Files:**
- Modify: `src/types/chapterTypes.ts`

- [x] **Step 1: Add source_info to InlineSpan types**

Add an optional `source_info` field to `TextSpan` and `AnnotationSpan` to carry the original PDF metadata:

```typescript
/** Original PDF metadata carried through from extraction */
export interface SpanSourceInfo {
  bbox: [number, number, number, number];
  origin: [number, number];
  page: number;
  font_size: number;
  font_name: string;
  color: number;  // original sRGB int
}
```

- [x] **Step 2: Add source_info to TextSpan and AnnotationSpan**

```typescript
export interface TextSpan {
  type: 'text';
  content: string;
  source_info?: SpanSourceInfo;
}

export interface AnnotationSpan {
  type: 'annotation';
  source: SourceVersion;
  position: AnnotationPosition;
  color: AnnotationColor;
  content: string;
  source_info?: SpanSourceInfo;
}
```

- [x] **Step 3: Verify backward compatibility**

Ensure existing code that creates `TextSpan` and `AnnotationSpan` without `source_info` still compiles.

- [x] **Step 4: Commit**

```bash
git add src/types/chapterTypes.ts
git commit -m "feat: add SpanSourceInfo to carry PDF metadata through to render

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Test frontend rendering

**Files:**
- Possibly modify: `src/components/reader/InlineSpanRenderer.tsx`

- [x] **Step 1: Start dev server**

Run: `npm run dev`

- [x] **Step 2: Open in browser and navigate to chapter 1**

Check:
- Body text paragraphs render correctly
- Annotation blocks show in correct colors (red/green/blue)
- Inline annotations appear interleaved with body text
- Poetry blocks are indented and center-aligned
- Footnotes appear at chapter end
- Correction spans show as strikethrough/inserted

- [x] **Step 3: Compare with PDF original**

Open the PDF alongside the browser and compare a few pages of chapter 1:
- Are all annotations present?
- Are there any missing or duplicated text segments?
- Is the reading order correct?

- [x] **Step 4: Fix any rendering issues**

If the JSON output doesn't match the existing `ChapterData` format exactly, update the enricher or the renderer accordingly.

- [x] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: rendering adjustments for new JSON pipeline output

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Clean up scratch files

**Files:**
- Delete: `scratch/*.py`, `scripts/checkAiSplit.py`, `scripts/debug*.py`, `scripts/test*.py`, `scripts/parseZhipingJson.py` (old monolithic parser)

- [x] **Step 1: Archive old scripts**

```bash
mkdir -p scripts/archived
mv scripts/parseZhipingJson.py scripts/archived/
mv scripts/parseZhiping.py scripts/archived/
mv scripts/checkAiSplit.py scripts/archived/
mv scripts/debug*.py scripts/archived/
mv scripts/test*.py scripts/archived/
mv scripts/exploreChapters.py scripts/archived/
mv scripts/extractChapter.py scripts/archived/
mv scripts/extract_images.py scripts/archived/
mv scripts/inspectPdf.py scripts/archived/
mv scripts/inspectPdfDict.py scripts/archived/
mv scripts/parseEpub.py scripts/archived/
mv split_017.py scripts/archived/
rm -rf scratch/*.py
```

- [x] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: archive old PDF parsing scripts, clean up scratch

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
