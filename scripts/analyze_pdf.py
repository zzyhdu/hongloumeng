"""analyze_pdf.py - Gather statistics about the PDF structure for threshold calibration."""
import fitz
from collections import Counter

PDF_PATH = "resource/4color_zhiping.pdf"

doc = fitz.open(PDF_PATH)
print(f"Total pages: {len(doc)}")

# ── TOC ──
toc = doc.get_toc()
print(f"\nTOC entries total: {len(toc)}")

chapters = []
for entry in toc:
    level, title, page = entry
    if '回' in title and level == 2:
        chapters.append({'title': title.strip(), 'start_page': page - 1})

for i in range(len(chapters) - 1):
    chapters[i]['end_page'] = chapters[i+1]['start_page']
if chapters:
    chapters[-1]['end_page'] = len(doc)

print(f"Chapters found: {len(chapters)}")
for ch in chapters[:5]:
    print(f"  第{ch['title'].split('回')[0]}回: pages {ch['start_page']}-{ch['end_page']} ({ch['end_page']-ch['start_page']} pages)")

# ── Font size distribution ──
font_sizes = Counter()
colors = Counter()
fonts = Counter()
image_blocks = []
all_span_sizes = []

for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if block.get("type") == 1:
            image_blocks.append((page_num + 1, block.get("width"), block.get("height")))
            continue
        for line in block.get("lines", []):
            for span in line["spans"]:
                sz = round(span["size"], 1)
                font_sizes[sz] += 1
                colors[span["color"]] += 1
                fonts[span["font"]] += 1
                all_span_sizes.append(sz)

print(f"\nImage blocks: {len(image_blocks)}")
for pg, w, h in image_blocks:
    print(f"  Page {pg}: {w:.0f}x{h:.0f}")

print(f"\nTop 25 font sizes:")
for sz, cnt in font_sizes.most_common(25):
    bar = '█' * min(50, cnt // max(1, font_sizes.most_common(1)[0][1] // 50))
    print(f"  {sz:6.1f}: {cnt:>8} {bar}")

print(f"\nTop 10 colors:")
for c, cnt in colors.most_common(10):
    hex_str = f"0x{c:06x}"
    print(f"  {hex_str} ({c}): {cnt}")

print(f"\nFonts used:")
for f, cnt in fonts.most_common(15):
    print(f"  {f!r}: {cnt}")

# ── Detailed analysis for chapter 1 ──
ch1 = chapters[0]
print(f"\n=== Chapter 1 Detailed (pages {ch1['start_page']}-{ch1['end_page']}) ===")

ch1_sizes = Counter()
ch1_colors = Counter()
ch1_x_starts = Counter()

for pn in range(ch1['start_page'], ch1['end_page']):
    page = doc.load_page(pn)
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if block.get("type") == 1:
            continue
        for line in block.get("lines", []):
            for span in line["spans"]:
                sz = round(span["size"], 1)
                ch1_sizes[sz] += 1
                ch1_colors[span["color"]] += 1
                ch1_x_starts[round(span["bbox"][0], 0)] += 1

print(f"Font sizes:")
for sz, cnt in ch1_sizes.most_common(15):
    print(f"  {sz:5.1f}: {cnt}")

print(f"\nColors:")
for c, cnt in ch1_colors.most_common(10):
    print(f"  0x{c:06x}: {cnt}")

print(f"\nX-start positions (for indent analysis):")
for x, cnt in ch1_x_starts.most_common(15):
    print(f"  x={x:6.0f}: {cnt}")

# ── Y-gap analysis for paragraph break detection ──
y_gaps = []
for pn in range(ch1['start_page'], ch1['end_page']):
    page = doc.load_page(pn)
    blocks = page.get_text("dict")["blocks"]
    prev_bottom = None
    for block in blocks:
        if block.get("type") == 1:
            continue
        for line in block.get("lines", []):
            for span in line["spans"]:
                if prev_bottom is not None:
                    gap = round(span["bbox"][1] - prev_bottom, 1)
                    if -50 < gap < 50:  # skip page-transition gaps
                        y_gaps.append(gap)
                prev_bottom = span["bbox"][3]

gap_counter = Counter(y_gaps)
print(f"\nY-gap distribution (within pages, top 20):")
for gap, cnt in gap_counter.most_common(20):
    print(f"  {gap:6.1f}: {cnt}")

doc.close()
print("\nDone.")
