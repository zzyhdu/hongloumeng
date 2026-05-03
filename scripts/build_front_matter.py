"""build_front_matter.py - Build front matter JSON from pages 1-5 raw data.

These pages (cover, copyright, production notes) have a different structure
than regular chapters and don't work well with the indent-based pipeline.
This script builds the JSON manually.
"""
import json
import os

RAW_DIR = "resource/zhiping_4color"
INPUT = os.path.join(RAW_DIR, "front_raw.json")
OUTPUT = os.path.join(RAW_DIR, "front.json")


def make_text_span(text):
    return {"type": "text", "content": text}


def get_page_spans(page_data):
    result = []
    for b in page_data["blocks"]:
        if b["type"] != 0:
            continue
        for line in b["lines"]:
            for span in line["spans"]:
                t = span["text"].strip()
                if t:
                    result.append({
                        "text": t,
                        "size": span["size"],
                        "bbox": span["bbox"],
                    })
    return result


def build():
    with open(INPUT) as f:
        raw = json.load(f)

    pages = raw["pages"]
    blocks = []

    # ── Page 1: blank → skip ──

    # ── Page 2: Title page ──
    p2 = get_page_spans(pages[1])
    blocks.append({
        "type": "heading",
        "level": 1,
        "text": p2[0]["text"],  # "红楼梦脂评汇校本"
        "color": "black",
        "indent": False,
    })
    blocks.append({
        "type": "paragraph",
        "indent": False,
        "spans": [make_text_span("曹雪芹著／脂砚斋评")],
    })
    blocks.append({
        "type": "paragraph",
        "indent": False,
        "spans": [make_text_span("Kolistan 汇校整理、制作")],
    })

    # ── Page 3: Declaration ──
    p3 = get_page_spans(pages[2])
    decl_text = "".join(
        s["text"] for s in p3
        if "抚琴居红楼梦文学社区发布" not in s["text"]
    )
    blocks.append({
        "type": "paragraph",
        "indent": True,
        "spans": [make_text_span(decl_text)],
    })

    # ── Pages 4-5: Production notes ──
    blocks.append({
        "type": "heading",
        "level": 2,
        "text": "电子版制作说明",
        "color": "black",
        "indent": False,
    })

    for pi in [3, 4]:
        pg = get_page_spans(pages[pi])
        # Filter Roman numerals and page headers
        filtered = [
            s for s in pg
            if s["text"] not in ("I", "II")
            and "抚琴居" not in s["text"]
            and ("电" not in s["text"] or "制" not in s["text"])
        ]
        para_text = "".join(s["text"] for s in filtered)
        if para_text:
            blocks.append({
                "type": "paragraph",
                "indent": True,
                "spans": [make_text_span(para_text)],
            })

    output = {
        "id": "front",
        "chapterNumber": -1,
        "title": "封面与说明",
        "blocks": blocks,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"front.json: {len(blocks)} blocks")
    for i, b in enumerate(blocks):
        if b["type"] == "heading":
            print(f'  [{i}] heading: {b["text"]}')
        else:
            text = "".join(s.get("content", "") for s in b["spans"])[:100]
            print(f"  [{i}] paragraph: {text}...")


if __name__ == "__main__":
    build()
