"""span_dumper.py - Stage 1: Faithfully extract all PDF text spans into raw JSON.

Preserves all 12 PyMuPDF span fields, all line metadata, block structure,
image block info, and page dimensions. No filtering, classification, or merging.
"""
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

def _sanitize_char_flags(cf):
    """char_flags can be a list of per-char integers or a single int."""
    if isinstance(cf, list):
        return cf
    return cf

def dump_page(doc, page_num):
    """Extract all blocks/lines/spans from one page faithfully."""
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
            data["blocks"].append({
                "type": 1,
                "number": block.get("number"),
                "bbox": _f4list(block.get("bbox", [])),
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
                        "char_flags": _sanitize_char_flags(span.get("char_flags")),
                        "origin": _f2list(span["origin"]),
                        "bbox": _f4list(span["bbox"]),
                    })
                lines.append({
                    "bbox": _f4list(line["bbox"]),
                    "wmode": line.get("wmode", 0),
                    "dir": _f2list(line.get("dir", [1.0, 0.0])),
                    "spans": spans,
                })
            data["blocks"].append({
                "type": 0,
                "number": block.get("number"),
                "bbox": _f4list(block.get("bbox", [])),
                "lines": lines,
            })
    return data

def _f2list(tup):
    """Round (x, y) tuple to 1 decimal place and convert to list."""
    return [round(float(tup[0]), 1), round(float(tup[1]), 1)]

def _f4list(tup):
    """Round (x0, y0, x1, y1) tuple to 1 decimal place and convert to list."""
    return [round(float(tup[0]), 1), round(float(tup[1]), 1),
            round(float(tup[2]), 1), round(float(tup[3]), 1)]

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

        ch_id = f"{ch['num']:03d}"
        print(f"Chapter {ch['num']}: {ch['title']}")
        print(f"  Pages {ch['start_page']+1}–{ch['end_page']} ({ch['end_page']-ch['start_page']} pages)")

        pages = []
        total_spans = 0
        for pn in range(ch['start_page'], ch['end_page']):
            pg = dump_page(doc, pn)
            pages.append(pg)
            for b in pg["blocks"]:
                if b["type"] == 0:
                    for ln in b["lines"]:
                        total_spans += len(ln["spans"])

        output = {
            "chapter": ch['num'],
            "title": ch['title'],
            "pages": pages,
        }

        filename = os.path.join(OUTPUT_DIR, f"{ch_id}_raw.json")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False)

        print(f"  → {filename}: {len(pages)} pages, {total_spans} spans")

    doc.close()
    print("Done.")

if __name__ == '__main__':
    main()
