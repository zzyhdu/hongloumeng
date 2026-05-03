"""epub_to_json.py - Extract rm120 EPUB into structured JSON chapters.

Reads resource/rm_120.epub (人民文学出版社校注本), parses each chapter
into ContentBlock/InlineSpan structured data matching the ChapterData type,
and writes resource/rm120/001.json through resource/rm120/120.json.

Only requires Python standard library (zipfile, xml.etree, html.parser, re).
"""
import json
import os
import re
import sys
import zipfile
from html import unescape
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
EPUB_PATH = ROOT / "resource" / "rm_120.epub"
OUTPUT_DIR = ROOT / "resource" / "rm120"
SKIP_FRONT_PARTS = range(0, 10)  # part0000–part0009 = front matter

# ── Chinese numeral conversion (extended with 〇/○ for 100+) ──

CN_NUMS = {
    '零': 0, '〇': 0, '○': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100,
}


def chinese_to_int(s):
    """Convert Chinese numeral string (一二〇, 一一三, etc.) to int."""
    s = s.strip()
    if not s:
        return None
    # Pure Western digits
    if s.isdigit():
        return int(s)
    result = 0
    current = 0
    for ch in s:
        val = CN_NUMS.get(ch)
        if val is None:
            return None
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
            current = current * 10 + val
    result += current
    return result


# ── EPUB spine extraction ─────────────────────────────────────────

def get_spine_parts(epub_path):
    """Return list of part filenames in spine reading order."""
    with zipfile.ZipFile(epub_path) as zf:
        with zf.open("content.opf") as f:
            tree = ET.parse(f)
    root = tree.getroot()
    ns = "http://www.idpf.org/2007/opf"
    spine = root.find(f"{{{ns}}}spine")
    manifest = root.find(f"{{{ns}}}manifest")

    # Build id → href map
    id_to_href = {}
    for item in manifest.findall(f"{{{ns}}}item"):
        id_to_href[item.get("id")] = item.get("href")

    parts = []
    for itemref in spine.findall(f"{{{ns}}}itemref"):
        idref = itemref.get("idref")
        href = id_to_href.get(idref)
        if href and href.endswith(".html"):
            parts.append(href)
    return parts


def read_part_html(zf, href):
    """Return the HTML body content of a spine part."""
    try:
        data = zf.read(href).decode("utf-8")
    except Exception as e:
        print(f"  Warning: cannot read {href}: {e}")
        return ""
    # Extract body content
    m = re.search(r"<body[^>]*>(.*?)</body>", data, re.DOTALL)
    if m:
        return m.group(1)
    return data


# ── HTML cleaning ─────────────────────────────────────────────────

def strip_html_tags(text):
    """Remove all HTML tags, leaving only text content."""
    return re.sub(r"<[^>]+>", "", text)


def normalize_whitespace(text):
    """Collapse whitespace but preserve it in Chinese text context."""
    return text.strip()


def clean_para_inner(inner_html):
    """Clean paragraph inner HTML: remove empty <a>, <img>, normalize."""
    # Remove empty <a> tags (footnote anchors like <a id="w16"></a>)
    s = re.sub(r"<a[^>]*></a>", "", inner_html)
    # Remove inline <img> tags
    s = re.sub(r"<img[^>]*/?>", "", s)
    # Normalize whitespace in sup tags
    s = re.sub(r"<sup[^>]*>\s*", "", s)
    s = re.sub(r"\s*</sup>", "", s)
    # Remove remaining sup open/close
    s = re.sub(r"</?sup[^>]*>", "", s)
    return s


# ── Inline footnote ref extraction ────────────────────────────────

FOOTNOTE_REF_RE = re.compile(
    r'<a[^>]*href="[^"]*#m(\d+)"[^>]*>'
    r'(?:<sup[^>]*?>)?\s*'
    r'\[(\d+)\]\s*'
    r'(?:</sup>)?'
    r'</a>'
    r'|'
    r'<a[^>]*href="[^"]*#m(\d+)"[^>]*>'
    r'(?:<sup[^>]*?>)?\s*'
    r'〔([一二三四五六七八九十百零〇○]+)〕\s*'
    r'(?:</sup>)?'
    r'</a>'
)


def extract_footnote_refs(inner_html):
    """Extract footnote references from paragraph inner HTML.

    Returns (clean_text, spans_list) where spans_list is a list of
    TextSpan / FootnoteRefSpan dicts.
    """
    # First, collect all footnote ref positions
    refs = []
    for m in FOOTNOTE_REF_RE.finditer(inner_html):
        if m.group(2):
            fn_id = int(m.group(2))
        else:
            fn_id = chinese_to_int(m.group(4)) or 0
        refs.append((m.start(), m.end(), fn_id))

    if not refs:
        # No footnotes — simple text extraction
        text = clean_para_inner(inner_html)
        text = strip_html_tags(text)
        text = normalize_whitespace(text)
        if text:
            return [{"type": "text", "content": text}]
        return []

    # Build spans with footnote refs interleaved
    spans = []
    pos = 0
    for start, end, fn_id in refs:
        # Text before this footnote ref
        before = inner_html[pos:start]
        before = clean_para_inner(before)
        before = strip_html_tags(before)
        before = normalize_whitespace(before)
        if before:
            spans.append({"type": "text", "content": before})

        spans.append({"type": "footnote_ref", "id": fn_id})
        pos = end

    # Remaining text after last footnote ref
    after = inner_html[pos:]
    after = clean_para_inner(after)
    after = strip_html_tags(after)
    after = normalize_whitespace(after)
    if after:
        spans.append({"type": "text", "content": after})

    return spans


# ── Footnote definition parsing ───────────────────────────────────

NOTE_RE = re.compile(
    r'<a[^>]*id="m(\d+)"[^>]*></a>'
    r'\s*<a[^>]*href="[^"]*#w\d+"[^>]*>'
    r'\[(\d+)\]'
    r'</a>\s*'
    r'(.*?)(?='
    r'<a[^>]*id="m\d+"[^>]*></a>'
    r'|<p[^>]*class="[^"]*"[^>]*>'
    r'|$)',
    re.DOTALL,
)

COLLATION_NOTE_RE = re.compile(
    r'<a[^>]*id="m(\d+)"[^>]*></a>'
    r'\s*<a[^>]*href="[^"]*#w\d+"[^>]*>'
    r'〔(\d+)〕'  # Chinese numerals for collation notes
    r'</a>\s*'
    r'(.*?)(?='
    r'<a[^>]*id="m\d+"[^>]*></a>'
    r'|<p[^>]*class="[^"]*"[^>]*>'
    r'|$)',
    re.DOTALL,
)


def parse_footnotes(html_chunk):
    """Parse <p class=\"note\"> elements into FootnoteBlock dicts."""
    footnotes = []

    # Find all note paragraphs
    note_pattern = re.compile(
        r'<p class="note">(.*?)</p>', re.DOTALL
    )
    for m in note_pattern.finditer(html_chunk):
        note_inner = m.group(1)

        # Try regular footnote first
        nm = re.match(
            r'<a[^>]*id="m(\d+)"[^>]*></a>\s*'
            r'<a[^>]*href="[^"]*"[^>]*>'
            r'\[(\d+)\]'
            r'</a>\s*',
            note_inner,
        )
        if nm:
            fn_id = int(nm.group(1))
            note_text = note_inner[nm.end():]
            note_text = strip_html_tags(note_text)
            note_text = normalize_whitespace(note_text)
            footnotes.append({
                "type": "footnote",
                "id": fn_id,
                "spans": [{"type": "text", "content": note_text}],
            })
            continue

        # Try collation note (Chinese numerals in 〔〕）
        cm = re.match(
            r'<a[^>]*id="m(\d+)"[^>]*></a>\s*'
            r'<a[^>]*href="[^"]*"[^>]*>'
            r'〔[一二三四五六七八九十百零〇○]+〕'
            r'</a>\s*',
            note_inner,
        )
        if cm:
            fn_id = int(cm.group(1))
            note_text = note_inner[cm.end():]
            note_text = strip_html_tags(note_text)
            note_text = normalize_whitespace(note_text)
            footnotes.append({
                "type": "footnote",
                "id": fn_id,
                "spans": [{"type": "text", "content": note_text}],
            })
            continue

    return footnotes


# ── Chapter parsing ──────────────────────────────────────────────

def clean_title(title_html):
    """Clean chapter title: strip footnote refs and HTML."""
    # Remove footnote reference links within h1
    title = re.sub(r'<a[^>]*></a>', '', title_html)
    title = re.sub(r'<a[^>]*href="[^"]*"[^>]*>', '', title)
    title = re.sub(r'</a>', '', title)
    title = re.sub(r'<sup[^>]*>.*?</sup>', '', title)
    title = re.sub(r'<[^>]+>', '', title)
    # Normalize whitespace to single space, preserve word separation
    title = re.sub(r'\s+', ' ', title).strip()
    return title


def extract_chapter_num(title):
    """Extract chapter number from title text like '第一二○回 ...'."""
    m = re.match(r'第([一二三四五六七八九十百零〇○]+)回', title)
    if m:
        return chinese_to_int(m.group(1))
    # Try Western-style like "第一○一回"
    m = re.match(r'第([一二三四五六七八九十百零〇○a-zA-Z0-9]+)回', title)
    if m:
        return chinese_to_int(m.group(1))
    return None


def is_chapter_heading(h1_text):
    """Check if h1 text looks like a chapter heading."""
    return '第' in h1_text and '回' in h1_text


def parse_chapter_body(body_html):
    """Parse body HTML into a list of ContentBlock dicts."""
    blocks = []

    # Find all paragraphs and headings in order
    tag_pattern = re.compile(
        r'<(h1|p)\b[^>]*class="([^"]*)"[^>]*>(.*?)</\1>',
        re.DOTALL,
    )

    consecutive_center = []

    for m in tag_pattern.finditer(body_html):
        tag = m.group(1)
        cls = m.group(2)
        inner = m.group(3)

        if tag == 'h1':
            # Flush pending poetry
            if consecutive_center:
                blocks.append({
                    "type": "poetry",
                    "lines": consecutive_center,
                })
                consecutive_center = []
            # Heading
            title = clean_title(inner)
            blocks.append({
                "type": "heading",
                "level": 1,
                "text": title,
            })
        elif cls == 'center':
            # Poetry line
            text = clean_para_inner(inner)
            text = strip_html_tags(text)
            text = normalize_whitespace(text)
            if text:
                consecutive_center.append([
                    {"type": "text", "content": text},
                ])
        elif cls == 'calibre6':
            # Flush poetry before regular paragraph
            if consecutive_center:
                blocks.append({
                    "type": "poetry",
                    "lines": consecutive_center,
                })
                consecutive_center = []
            # Regular paragraph
            spans = extract_footnote_refs(inner)
            if spans:
                blocks.append({
                    "type": "paragraph",
                    "indent": True,
                    "spans": spans,
                })
        elif cls == 'note':
            # Footnotes — handled separately
            pass

    # Flush any remaining poetry
    if consecutive_center:
        blocks.append({
            "type": "poetry",
            "lines": consecutive_center,
        })

    # Parse footnotes from the whole body (not just the tag iteration)
    footnotes = parse_footnotes(body_html)

    return blocks, footnotes


def parse_chapter(full_html):
    """Parse a full chapter's HTML into ChapterData dict."""
    # Extract all blocks in order
    content_blocks, footnotes = parse_chapter_body(full_html)

    # Find heading block
    heading_block = None
    other_blocks = []
    for b in content_blocks:
        if b["type"] == "heading" and heading_block is None:
            heading_block = b
        else:
            other_blocks.append(b)

    if heading_block is None:
        heading_block = {
            "type": "heading",
            "level": 1,
            "text": "",
        }

    title = heading_block["text"]
    chap_num = extract_chapter_num(title)

    # Build final block list: heading + body blocks + footnotes
    blocks = [heading_block] + other_blocks + footnotes

    return {
        "id": f"{chap_num:03d}" if chap_num else "000",
        "chapterNumber": chap_num or 0,
        "title": title,
        "blocks": blocks,
    }


# ── Main ─────────────────────────────────────────────────────────

def main():
    if not EPUB_PATH.exists():
        print(f"Error: EPUB not found at {EPUB_PATH}")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Opening: {EPUB_PATH}")
    spine_parts = get_spine_parts(EPUB_PATH)
    print(f"Spine parts: {len(spine_parts)}")

    with zipfile.ZipFile(EPUB_PATH) as zf:
        chapters = []
        current_html_parts = []
        current_start_part = None

        for i, href in enumerate(spine_parts):
            # Extract part number
            pm = re.search(r"part(\d+)\.html", href)
            part_num = int(pm.group(1)) if pm else -1

            # Skip front matter
            if part_num in SKIP_FRONT_PARTS:
                continue

            html_body = read_part_html(zf, href)

            # Check if this part starts a new chapter
            h1m = re.search(r"<h1[^>]*>(.*?)</h1>", html_body, re.DOTALL)
            h1_text = ""
            if h1m:
                h1_text = clean_title(h1m.group(1))

            is_new_chapter = h1m and is_chapter_heading(h1_text)

            if is_new_chapter:
                # Flush previous chapter
                if current_html_parts:
                    full_html = "\n".join(current_html_parts)
                    chap = parse_chapter(full_html)
                    chapters.append(chap)
                    print(
                        f"  [{chap['id']}] {chap['title'][:50]} "
                        f"({len(chap['blocks'])} blocks)"
                    )

                current_html_parts = [html_body]
                current_start_part = part_num
            else:
                # Continuation of current chapter
                current_html_parts.append(html_body)

        # Flush last chapter
        if current_html_parts:
            full_html = "\n".join(current_html_parts)
            chap = parse_chapter(full_html)
            chapters.append(chap)
            print(
                f"  [{chap['id']}] {chap['title'][:50]} "
                f"({len(chap['blocks'])} blocks)"
            )

    print(f"\nTotal chapters extracted: {len(chapters)}")

    # Write output
    for chap in chapters:
        out_path = OUTPUT_DIR / f"{chap['id']}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(chap, f, ensure_ascii=False, indent=2)

    print(f"Written to: {OUTPUT_DIR}")

    # Summary stats
    total_blocks = sum(len(c["blocks"]) for c in chapters)
    poetry_count = sum(
        sum(1 for b in c["blocks"] if b["type"] == "poetry")
        for c in chapters
    )
    fn_count = sum(
        sum(1 for b in c["blocks"] if b["type"] == "footnote")
        for c in chapters
    )
    print(f"Blocks: {total_blocks} (poetry: {poetry_count}, footnotes: {fn_count})")


if __name__ == "__main__":
    main()
