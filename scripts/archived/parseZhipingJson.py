"""
parseZhipingJson.py
Parse the 4-color 脂评汇校本 PDF into structured JSON files.

Output schema matches src/types/chapterTypes.ts (ChapterData).
"""
import fitz  # PyMuPDF
import json
import os
import re
import sys
from dotenv import load_dotenv

load_dotenv()

# ── Color mapping ────────────────────────────────────────────────────
# From inspectPdfDict.py observations:
#   0xff0000 (16711680) → 朱批 red (甲/庚 朱批)
#   0x8b     (139)      → 深蓝 blue (戚/蒙/列/辰 墨批)
#   0x442b   (17451)    → 墨绿 green (甲/己/庚 墨批)
#   0x0      (0)        → 黑色 正文
COLOR_MAP = {
    0xff0000: 'red',
    0x8b:     'blue',
    0x442b:   'green',
}

def get_annotation_color(color_int):
    return COLOR_MAP.get(color_int, None)

# ── MINIMAX Poetry Detection ────────────────────────────────────────────

import requests

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

def is_poetry_text(text: str) -> dict:
    """Call MINIMAX AI to detect if the text is poetry and where it ends.

    Returns dict with keys:
      - is_poetry: bool
      - poem_lines: list of str (lines that are poetry, empty if not poetry)
      - remaining_text: str (text after the poem ends, empty if not poetry or poem continues to end)
    """
    if not MINIMAX_API_KEY:
        return {"is_poetry": False, "poem_lines": [], "remaining_text": ""}

    if not text or len(text.strip()) < 10:
        return {"is_poetry": False, "poem_lines": [], "remaining_text": ""}

    prompt = f"""判断以下中文文本是否包含诗歌。如果包含诗歌，请找出诗歌的完整内容（每行一首诗歌的几行诗句），并指出诗歌结束后面的叙述文字从哪里开始。

判断标准：
1. 诗歌通常有固定的韵律和节奏，每行字数相近
2. 诗歌内容相对独立，后面会有"吟罢"、"雨村吟罢"等叙述性文字接续

文本：
---
{text}
---

请以JSON格式返回：
{{
  "is_poetry": true/false,
  "poem_lines": ["第一行", "第二行", ...],
  "remaining_text": "诗歌结束后剩余的叙述文字，如果没有或诗歌到文本末尾则为空字符串"
}}

只返回JSON，不要有其他内容。"""

    try:
        response = requests.post(
            "https://api.minimax.chat/v1/text/chatcompletion_v2",
            headers={
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "MiniMax-M2.7",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 2048,
            },
            timeout=60,
        )
        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("reasoning_content", "")

        # Parse JSON response from reasoning_content
        import json as json_lib
        # Try to find JSON in the reasoning content
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = content[json_start:json_end]
            parsed = json_lib.loads(json_str)
            return {
                "is_poetry": bool(parsed.get("is_poetry", False)),
                "poem_lines": [str(line).strip() for line in parsed.get("poem_lines", []) if str(line).strip()],
                "remaining_text": str(parsed.get("remaining_text", "")).strip(),
            }
    except Exception as e:
        print(f"  [MINIMAX API error] {e}")

    return {"is_poetry": False, "poem_lines": [], "remaining_text": ""}

# ── Annotation prefix parsing ────────────────────────────────────────
# Patterns like: 甲侧：, 庚眉：, 蒙侧：, 戚夹：
SOURCE_VERSIONS = {'甲', '己', '庚', '戚', '蒙', '列', '辰'}
POSITIONS = {'眉', '侧', '夹'}

ANNOT_PREFIX_RE = re.compile(
    r'^([甲己庚戚蒙列辰])([眉侧夹上下])?([：:])(.*)$', re.DOTALL
)

def parse_annotation_prefix(text):
    """Try to parse '甲侧：xxx' or '庚：xxx' → (source, position, content).
    Returns (source, position, content) or (None, None, text)."""
    m = ANNOT_PREFIX_RE.match(text.strip())
    if m:
        s = m.group(1)
        p = m.group(2) if m.group(2) else ""
        return s, p, m.group(4)
    return None, None, text

# ── Correction / footnote parsing ────────────────────────────────────
CORRECTION_RE = re.compile(r'\(([^)]*)\)\[([^\]]*)\]')  # (甲)[乙] → delete 甲, insert 乙
DELETE_RE = re.compile(r'\(([^)]+)\)(?!\[)')              # (某) alone → delete
INSERT_RE = re.compile(r'(?<!\))\[([^\]]+)\]')            # [某] alone → insert
FOOTNOTE_REF_RE = re.compile(r'[①②③④⑤⑥⑦⑧⑨⑩]')
FOOTNOTE_NUM = '①②③④⑤⑥⑦⑧⑨⑩'

def is_header_footer(text, size):
    """Filter out page numbers, site URLs, redactor lines."""
    if text == '  ' or text == '　　' or text == '   ':
        return False
    t = text.strip()
    if not t:
        return True
    if size < 11:
        if t == 'www.hlmbbs.com' or (t.isdigit() and not FOOTNOTE_REF_RE.match(t)):
            return True
        if '抚琴居' in t or 'redactor' in t or 'kolistan' in t.lower():
            return True
        if re.match(r'^第[一二三四五六七八九十百零]+回', t):
            return True
    return False

def text_to_inline_spans(text, inline_annotations=None):
    """Convert a plain text string into a list of InlineSpans,
    extracting corrections (某)[某], footnote refs ①, and injecting inline_annotations."""
    spans = []
    pos = 0
    
    # Find all corrections and footnote refs, merge them in order
    events = []
    for m in CORRECTION_RE.finditer(text):
        events.append((m.start(), m.end(), 'correction_both', m.group(1), m.group(2)))
    for m in DELETE_RE.finditer(text):
        # Skip if already covered by CORRECTION_RE
        if any(e[0] == m.start() for e in events):
            continue
        events.append((m.start(), m.end(), 'correction_del', m.group(1), None))
    for m in INSERT_RE.finditer(text):
        if any(e[0] <= m.start() < e[1] for e in events):
            continue
        events.append((m.start(), m.end(), 'correction_ins', None, m.group(1)))
    for m in FOOTNOTE_REF_RE.finditer(text):
        idx = FOOTNOTE_NUM.index(m.group()) + 1
        events.append((m.start(), m.end(), 'footnote_ref', idx, None))
    
    if inline_annotations:
        for offset, ann in inline_annotations:
            events.append((offset, offset, 'annotation', ann, None))
            
    events.sort(key=lambda e: e[0])
    
    for ev in events:
        if ev[0] > pos:
            spans.append({'type': 'text', 'content': text[pos:ev[0]]})
        
        if ev[2] == 'annotation':
            spans.append(ev[3])
            pos = max(pos, ev[1])
        elif ev[2] == 'correction_both':
            spans.append({'type': 'correction', 'deleted': ev[3], 'inserted': ev[4]})
            pos = max(pos, ev[1])
        elif ev[2] == 'correction_del':
            spans.append({'type': 'correction', 'deleted': ev[3]})
            pos = max(pos, ev[1])
        elif ev[2] == 'correction_ins':
            spans.append({'type': 'correction', 'inserted': ev[4]})
            pos = max(pos, ev[1])
        elif ev[2] == 'footnote_ref':
            spans.append({'type': 'footnote_ref', 'id': ev[3]})
            pos = max(pos, ev[1])
    
    if pos < len(text):
        remainder = text[pos:]
        if remainder:
            spans.append({'type': 'text', 'content': remainder})
    
    if not spans:
        spans.append({'type': 'text', 'content': text})
    
    return spans


# ── Main parser ──────────────────────────────────────────────────────

def parse_chapter(doc, start_page, end_page, chapter_num, chapter_title):
    """Parse a single chapter from the PDF into a ChapterData dict."""
    blocks = []
    
    # Accumulate spans for the current block
    current_block_type = None  # 'paragraph' | 'annotation_block'
    current_block_color = None
    current_block_source = None
    current_block_position = None
    current_spans_text = []    # raw text pieces for current block
    in_footnote_zone = False    # set True once we see a footnote marker ①②③...
    current_inline_annotations = []  # (insert_index, annotation_span_dict)
    
    def flush_block():
        nonlocal current_block_type, current_block_color, current_spans_text
        nonlocal current_block_source, current_block_position, current_inline_annotations
        
        # Process buffered inline annotations
        final_inline_annotations = []
        for idx, color, raw_text in current_inline_annotations:
            source, position, content = parse_annotation_prefix(raw_text)
            if source is None:
                source = current_block_source or '庚'
                position = current_block_position or '夹'
                content = raw_text
                
            annot_span = {
                'type': 'annotation',
                'source': source,
                'position': position,
                'color': color,
                'content': content,
            }
            final_inline_annotations.append((idx, annot_span))
            
        # Build text and compute marker offsets
        items = []
        annot_map = {}
        for idx, ann in final_inline_annotations:
            annot_map.setdefault(idx, []).append(ann)
        
        for i, piece in enumerate(current_spans_text):
            if i in annot_map:
                for ann in annot_map[i]:
                    items.append({'type': '_marker', 'annot': ann})
            items.append({'type': 'text', 'content': piece})
        
        if len(current_spans_text) in annot_map:
            for ann in annot_map[len(current_spans_text)]:
                items.append({'type': '_marker', 'annot': ann})
                
        full_text = ""
        marker_offsets = []
        for item in items:
            if item['type'] == 'text':
                full_text += item['content']
            elif item['type'] == '_marker':
                marker_offsets.append((len(full_text), item['annot']))
                
        text = full_text.strip()
        if not text:
            return
            
        leading_spaces = len(full_text) - len(full_text.lstrip())
        
        adjusted_markers = []
        for offset, ann in marker_offsets:
            new_offset = max(0, min(len(text), offset - leading_spaces))
            adjusted_markers.append((new_offset, ann))
        
        if current_block_type == 'annotation_block':
            source, position, content = parse_annotation_prefix(text)
            if source is None:
                source = current_block_source or '庚'
                position = current_block_position or '夹'
                content = text
                
            prefix_len = len(text) - len(content)
            shifted_markers = []
            for off, ann in adjusted_markers:
                new_off = max(0, off - prefix_len)
                shifted_markers.append((new_off, ann))
                
            inner_spans = text_to_inline_spans(content, shifted_markers)
            
            blocks.append({
                'type': 'annotation_block',
                'source': source,
                'position': position,
                'color': current_block_color or 'green',
                'spans': inner_spans,
                'indent': leading_spaces > 0,
            })
        
        elif current_block_type == 'paragraph':
            # Only call AI for suspicious text (poetry keywords)
            poetry_keywords = ['口占', '高吟', '吟罢', '口号', '诗云', '复高吟', '一首', '一联云', '一绝']
            should_check = any(kw in text for kw in poetry_keywords)

            if should_check:
                poetry_result = is_poetry_text(text)
            else:
                poetry_result = {"is_poetry": False, "poem_lines": [], "remaining_text": ""}

            if poetry_result["is_poetry"] and poetry_result["poem_lines"]:
                # Build PoetryBlock from AI-detected lines
                poem_lines = []
                for line_text in poetry_result["poem_lines"]:
                    line_spans = text_to_inline_spans(line_text, [])
                    poem_lines.append(line_spans)

                blocks.append({
                    'type': 'poetry',
                    'lines': poem_lines,
                })

                # If there's remaining text, create a new paragraph with it
                if poetry_result["remaining_text"]:
                    remaining_spans = text_to_inline_spans(poetry_result["remaining_text"], adjusted_markers)
                    blocks.append({
                        'type': 'paragraph',
                        'spans': remaining_spans,
                        'indent': False,
                    })
            else:
                all_spans = text_to_inline_spans(text, adjusted_markers)
                blocks.append({
                    'type': 'paragraph',
                    'spans': all_spans,
                    'indent': leading_spaces > 0 or text.startswith('士隐听得明白'),
                    'leading_spaces': leading_spaces,
                })
        
        current_spans_text = []
        current_inline_annotations = []
    
    for page_num in range(start_page, end_page):
        page = doc.load_page(page_num)
        page_blocks = page.get_text("dict")["blocks"]
        
        for block in page_blocks:
            if "lines" not in block:
                continue
            
            # Collect all spans in this PDF block
            pdf_spans = []
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].replace('\xa0', ' ').replace('\u3000', '  ')
                    if text.strip() or '  ' in text:
                        if not is_header_footer(text, span["size"]):
                            pdf_spans.append({
                                'text': text,
                                'size': span["size"],
                                'color': span["color"],
                            })
            
            if not pdf_spans:
                continue
            
            # Check if this block contains a footnote marker - if so, enter footnote zone
            if any(FOOTNOTE_REF_RE.match(s['text'].strip()) for s in pdf_spans):
                in_footnote_zone = True
            
            for span in pdf_spans:
                sz = span['size']
                col = span['color']
                txt = span['text']
                stripped = txt.strip()
                
                if not stripped and sz >= 11:
                    if txt == '  ' or txt == '　　' or txt == '   ':
                        flush_block()
                        current_block_type = 'paragraph'
                        current_block_color = None
                    current_spans_text.append(txt)
                    continue
                
                # Classify this span
                if sz > 16:
                    # Heading - skip, we already have the title
                    # But still check if it's the chapter title line
                    flush_block()
                    # Don't add headings as blocks (title is in metadata)
                    continue
                
                if sz < 11 and not FOOTNOTE_REF_RE.match(stripped):
                    # Check if this is actually an annotation block instead of an inline annotation
                    text_so_far = ''.join(current_spans_text).strip()
                    is_annot_block_start = (not text_so_far and bool(ANNOT_PREFIX_RE.match(stripped)))
                    is_continuation = False
                    if current_block_type == 'annotation_block':
                        color_class = get_annotation_color(col)
                        has_prefix = bool(ANNOT_PREFIX_RE.match(stripped))
                        if not has_prefix and color_class == current_block_color:
                            is_continuation = True
                            
                    if is_annot_block_start or is_continuation:
                        sz = 12.0  # Force it to be treated as normal text and part of the block
                    else:
                        # Small text = inline annotation
                        annot_color = get_annotation_color(col)
                        if annot_color is None:
                            if in_footnote_zone:
                                # Black small text in the footnote zone is normal text
                                current_spans_text.append(txt)
                                continue
                            annot_color = 'blue'  # default for black small text
                        
                        idx = len(current_spans_text)
                        
                        # Merge with previous if same idx and color
                        if current_inline_annotations and current_inline_annotations[-1][0] == idx and current_inline_annotations[-1][1] == annot_color:
                            current_inline_annotations[-1] = (
                                idx,
                                annot_color,
                                current_inline_annotations[-1][2] + stripped
                            )
                        else:
                            current_inline_annotations.append((idx, annot_color, stripped))
                        
                        continue

                if FOOTNOTE_REF_RE.match(stripped):
                    current_spans_text.append(txt)
                    continue
                
                # Normal-sized text (sz >= 11)
                annot_color = get_annotation_color(col)
                
                if annot_color:
                    # Colored normal text = annotation block
                    color_class = annot_color
                    
                    should_flush = False
                    if current_block_type != 'annotation_block':
                        should_flush = True
                    elif current_block_color != color_class:
                        should_flush = True
                    elif txt.startswith('  ') or txt.startswith('　　') or txt.startswith('   ') or txt.startswith('士隐听得明白') or txt.startswith('士隐意欲也跟了过去'):
                        should_flush = True
                    
                    if should_flush:
                        flush_block()
                        current_block_type = 'annotation_block'
                        current_block_color = color_class
                        # Pre-parse source/position
                        s, p, _ = parse_annotation_prefix(stripped)
                        current_block_source = s
                        current_block_position = p
                    
                    current_spans_text.append(txt)
                
                else:
                    # Black normal text = main paragraph
                    should_flush = False
                    if current_block_type != 'paragraph':
                        should_flush = True
                    elif txt.startswith('  ') or txt.startswith('　　') or txt.startswith('   ') or txt.startswith('士隐听得明白') or txt.startswith('士隐意欲也跟了过去'):
                        should_flush = True
                    
                    if should_flush:
                        flush_block()
                        current_block_type = 'paragraph'
                        current_block_color = None
                    
                    current_spans_text.append(txt)
    
    flush_block()
    

    # Post-process: detect poetry and footnote blocks
    processed_blocks = []
    current_poetry = None
    
    for b in blocks:
        if b['type'] == 'paragraph' and b.get('leading_spaces', 0) >= 4:
            if not current_poetry:
                current_poetry = {'type': 'poetry', 'lines': [b['spans']]}
                processed_blocks.append(current_poetry)
            else:
                current_poetry['lines'].append(b['spans'])
        else:
            current_poetry = None
            if 'leading_spaces' in b:
                del b['leading_spaces']
            processed_blocks.append(b)
            
    blocks = processed_blocks
    
    processed_blocks = []
    footnote_blocks = []

    
    for b in blocks:
        if b['type'] == 'paragraph':
            full_text = ''.join(
                s.get('content', '') for s in b['spans'] if s['type'] == 'text'
            )
            # Check if this is a footnote definition: starts with ① or similar numbering
            fn_match = re.match(r'^\s*([①②③④⑤⑥⑦⑧⑨⑩])', full_text.strip())
            if fn_match and full_text.strip().startswith(fn_match.group(1)):
                fn_char = fn_match.group(1)
                fn_id = FOOTNOTE_NUM.index(fn_char) + 1
                # Remove the ① prefix from spans
                cleaned_spans = []
                first_text = True
                for s in b['spans']:
                    if first_text and s['type'] == 'text':
                        content = s['content'].lstrip()
                        if content.startswith(fn_char):
                            content = content[len(fn_char):].lstrip()
                            if content.startswith('按：'):
                                content = content[2:]
                            elif content.startswith('按:'):
                                content = content[2:]
                        if content:
                            cleaned_spans.append({'type': 'text', 'content': content})
                        first_text = False
                    else:
                        cleaned_spans.append(s)
                        if s['type'] == 'text':
                            first_text = False
                
                footnote_blocks.append({
                    'type': 'footnote',
                    'id': fn_id,
                    'spans': cleaned_spans if cleaned_spans else b['spans'],
                })
                continue
        
        processed_blocks.append(b)
    
    # Append footnotes at the end
    processed_blocks.extend(footnote_blocks)
    
    return {
        'id': f'{chapter_num:03d}',
        'chapterNumber': chapter_num,
        'title': chapter_title,
        'blocks': processed_blocks,
    }


def get_chapter_pages(doc):
    """Extract chapter page ranges from the TOC."""
    toc = doc.get_toc()
    chapters = []
    
    for i, entry in enumerate(toc):
        level, title, page = entry
        # Match chapter titles: 第X回
        m = re.match(r'第([一二三四五六七八九十百零]+)回', title.strip())
        if m:
            chapter_num_str = m.group(1)
            # Convert Chinese number to int
            chapter_num = chinese_to_int(chapter_num_str)
            # Clean the title: remove 第X回 prefix whitespace
            clean_title = title.strip()
            chapters.append({
                'num': chapter_num,
                'title': clean_title,
                'start_page': page - 1,  # 0-indexed
            })
    
    # Set end pages
    for i in range(len(chapters) - 1):
        chapters[i]['end_page'] = chapters[i + 1]['start_page']
    if chapters:
        chapters[-1]['end_page'] = len(doc)
    
    return chapters


CN_NUMS = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '百': 100,
}

def chinese_to_int(s):
    """Convert Chinese numeral string to integer. Handles up to 百."""
    if not s:
        return 0
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


def main():
    pdf_path = "resource/4color_zhiping.pdf"
    output_dir = "resource/zhiping_4color"
    os.makedirs(output_dir, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    chapters = get_chapter_pages(doc)
    
    # Parse only chapter 1 if --chapter flag is given, otherwise all
    target_chapter = None
    if len(sys.argv) > 1:
        target_chapter = int(sys.argv[1])
    
    for ch in chapters:
        if target_chapter and ch['num'] != target_chapter:
            continue
        
        print(f"Parsing chapter {ch['num']}: {ch['title']} (pages {ch['start_page']+1}-{ch['end_page']})")
        
        chapter_data = parse_chapter(
            doc,
            ch['start_page'],
            ch['end_page'],
            ch['num'],
            ch['title'],
        )
        chapter_data['blocks'] = post_process_footnotes(chapter_data['blocks'])
        
        filename = os.path.join(output_dir, f"{ch['num']:03d}.json")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        block_counts = {}
        for b in chapter_data['blocks']:
            block_counts[b['type']] = block_counts.get(b['type'], 0) + 1
        print(f"  → {filename}: {len(chapter_data['blocks'])} blocks {block_counts}")
    
    print("Done.")




def post_process_footnotes(blocks):
    new_blocks = []
    
    for i, block in enumerate(blocks):
        spans = block.get('spans', [])
        if not spans:
            new_blocks.append(block)
            continue
            
        has_footnote_ref = any(s.get('type') == 'footnote_ref' for s in spans)
        
        # Determine if this block contains footnote definitions.
        # They usually appear at the end of the chapter.
        # Even if they don't start with a footnote_ref, if it's the last few blocks and has footnote_refs, it's the definitions block.
        is_footnote_def = False
        if has_footnote_ref and i > len(blocks) - 5:
            is_footnote_def = True
            
        if is_footnote_def:
            current_spans = []
            footnote_blocks = []
            current_fn_id = None
            current_fn_spans = []
            
            for span in spans:
                if span.get('type') == 'footnote_ref':
                    if current_fn_id is not None:
                        footnote_blocks.append({
                            'type': 'footnote',
                            'id': current_fn_id,
                            'spans': current_fn_spans
                        })
                    current_fn_id = span['id']
                    current_fn_spans = []
                else:
                    if current_fn_id is not None:
                        current_fn_spans.append(span)
                    else:
                        current_spans.append(span)
                        
            if current_fn_id is not None:
                footnote_blocks.append({
                    'type': 'footnote',
                    'id': current_fn_id,
                    'spans': current_fn_spans
                })
                
            if current_spans:
                block['spans'] = current_spans
                new_blocks.append(block)
                
            new_blocks.extend(footnote_blocks)
        else:
            new_blocks.append(block)
            
    return new_blocks


if __name__ == '__main__':
    main()

