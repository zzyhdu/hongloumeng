import fitz

def get_color_class(color):
    if color == 0xff0000: return 'red'
    if color == 0x8b: return 'blue'
    if color == 0x442b: return 'green'
    return 'black'

def parse_page(pdf_path, page_num):
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num - 1)
    blocks = page.get_text("dict")["blocks"]
    
    html = ""
    for block in blocks:
        if "lines" not in block:
            continue
        
        block_spans = []
        for line in block["lines"]:
            for span in line["spans"]:
                if span["text"].strip():
                    block_spans.append(span)
        
        if not block_spans:
            continue
            
        # Determine block type from first span
        first_span = block_spans[0]
        size = first_span["size"]
        color = first_span["color"]
        
        if size >= 17:
            # Heading
            text = "".join(s["text"] for s in block_spans)
            html += f"# {text}\n\n"
        elif size > 11 and color != 0x0:
            # Block annotation
            text = "".join(s["text"] for s in block_spans)
            html += f"<div class=\"annotation-block {get_color_class(color)}\">\n{text}\n</div>\n\n"
        else:
            # Paragraph
            p_html = ""
            for span in block_spans:
                text = span["text"]
                sz = span["size"]
                col = span["color"]
                if sz < 11:
                    p_html += f"<span class=\"annotation-inline {get_color_class(col)}\">{text}</span>"
                else:
                    p_html += text
            html += f"{p_html}\n\n"
            
    print(html)

if __name__ == "__main__":
    parse_page("resource/4color_zhiping.pdf", 12)
