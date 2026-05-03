"""analyze_spans.py - Analyze raw JSON spans to calibrate Stage 2 thresholds.

Reads the raw JSONs produced by span_dumper.py, computes font-size / color /
x-margin / y-gap distributions to determine the thresholds paragraph_builder.py
needs to classify body, annotation, and heading text.
"""

import json
import os
from collections import Counter

RAW_DIR = "resource/zhiping_4color"

def main():
    font_sizes = Counter()          # size → count
    color_counts = Counter()        # color_int → count
    x_starts = Counter()            # x0 → count  (indent detection)
    y_gaps = []                     # consecutive span y1→next y0 (line spacing)

    # Per-class metrics
    # After initial analysis, we group spans into classes:
    #   body:     black (0x000000) AND size >= 10 AND font 宋体
    #   heading:  size >= 16
    #   annot:    colored (non-black, non-white) OR size < 10
    body_x_starts = Counter()
    annot_x_starts = Counter()

    prev_bottom = None
    prev_page = None

    files_processed = 0
    total_spans = 0

    for fname in sorted(os.listdir(RAW_DIR)):
        if not fname.endswith('_raw.json'):
            continue
        path = os.path.join(RAW_DIR, fname)
        with open(path) as f:
            data = json.load(f)

        for page_data in data['pages']:
            page_num = page_data['page']
            for block in page_data['blocks']:
                if block['type'] != 0:
                    continue
                for line in block['lines']:
                    for span in line['spans']:
                        total_spans += 1
                        sz = round(span['size'], 1)
                        color = span['color']
                        x0 = round(span['bbox'][0], 1)
                        y0 = span['bbox'][1]
                        y1 = span['bbox'][3]

                        font_sizes[sz] += 1
                        color_counts[color] += 1
                        x_starts[x0] += 1

                        # Y-gap between consecutive spans on same page
                        if prev_bottom is not None and page_num == prev_page:
                            gap = round(y0 - prev_bottom, 1)
                            if -50 < gap < 50:
                                y_gaps.append(gap)

                        prev_bottom = y1
                        prev_page = page_num

                        # Per-class x-starts
                        is_heading = sz >= 16
                        is_annot = color not in (0x000000, 0xffffff) or sz < 10
                        is_body = color == 0x000000 and sz >= 10

                        if is_body:
                            body_x_starts[x0] += 1
                        if is_annot and not is_heading:
                            annot_x_starts[x0] += 1

        files_processed += 1
        if files_processed >= 10:   # first 10 chapters = good sample
            break

    # ── Report ──
    print(f"Analyzed {files_processed} chapters, {total_spans} spans\n")

    print("=== Font Size Distribution (top 20) ===")
    for sz, cnt in font_sizes.most_common(20):
        bar = '█' * max(1, min(50, cnt // 50))
        print(f"  {sz:6.1f}: {cnt:>8} {bar}")

    print(f"\n=== Color Distribution ===")
    COLOR_NAMES = {
        0x000000: 'black', 0xff0000: 'red', 0x00442b: 'green',
        0x00008b: 'blue', 0xffffff: 'white', 0x000080: 'navy', 0x0000ff: 'blue2'
    }
    for c, cnt in color_counts.most_common(10):
        name = COLOR_NAMES.get(c, 'unknown')
        print(f"  0x{c:06x} ({name:7s}): {cnt:>8}")

    print(f"\n=== All X-Start Positions (top 20) ===")
    for x, cnt in x_starts.most_common(20):
        print(f"  x={x:7.1f}: {cnt:>8}")

    print(f"\n=== Body-Text X-Start Positions ===")
    for x, cnt in body_x_starts.most_common(15):
        print(f"  x={x:7.1f}: {cnt:>8}")

    print(f"\n=== Annotation X-Start Positions ===")
    for x, cnt in annot_x_starts.most_common(15):
        print(f"  x={x:7.1f}: {cnt:>8}")

    print(f"\n=== Y-Gap Distribution (top 20) ===")
    gap_counter = Counter(y_gaps)
    for gap, cnt in gap_counter.most_common(25):
        print(f"  {gap:7.1f}: {cnt:>8}")

    # Suggested thresholds
    print("\n=== Suggested Thresholds ===")

    # Body margin: most common x-start for body text
    if body_x_starts:
        body_margin = body_x_starts.most_common(1)[0][0]
        print(f"Body left margin: x ≈ {body_margin:.0f} pt")

    # Indent threshold: body margin + 1.5 character widths (~15pt for 10pt font)
    if body_x_starts:
        indent_candidates = [(x, c) for x, c in body_x_starts.most_common()
                             if x > body_x_starts.most_common(1)[0][0] + 8]
        if indent_candidates:
            print(f"Indented x-starts: {indent_candidates[:10]}")

    # Annotation margin: most common x-start for annotations
    if annot_x_starts:
        annot_margin = annot_x_starts.most_common(1)[0][0]
        print(f"Annotation left margin: x ≈ {annot_margin:.0f} pt")

    # Normal line spacing (positive y-gap between consecutive body lines)
    positive_gaps = [(g, c) for g, c in gap_counter.most_common() if g > 0]
    if positive_gaps:
        print(f"Positive y-gaps: {positive_gaps[:10]}")

    # Batch font sizes
    body_sizes = [(sz, cnt) for sz, cnt in font_sizes.items() if 10 <= sz < 16 and sz > 1]
    annot_sizes = [(sz, cnt) for sz, cnt in font_sizes.items() if 8 <= sz < 10]
    if body_sizes:
        print(f"Body text sizes: {sorted(body_sizes, key=lambda x: -x[1])[:8]}")
    if annot_sizes:
        print(f"Annotation sizes: {sorted(annot_sizes, key=lambda x: -x[1])[:8]}")

    print("\nDone.")


if __name__ == '__main__':
    main()
