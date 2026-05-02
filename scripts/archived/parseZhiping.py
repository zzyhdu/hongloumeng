import fitz
import os
import re

def get_color_class(color):
    if color == 0xff0000: return 'red'
    if color == 0x8b: return 'blue'
    if color == 0x442b: return 'green'
    return 'black'

def clean_text(text):
    return text.replace('\xa0', ' ').replace('\u3000', '  ')

def is_header_footer(text, size):
    # Filter out page numbers, site URLs, etc.
    text_strip = text.strip()
    if size < 11 and (text_strip == 'www.hlmbbs.com' or text_strip.isdigit()):
        return True
    return False

def parse_pdf_to_markdown(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    
    current_chapter = 0
    current_md_content = []
    
    # Track state
    in_block_annotation = False
    block_annotation_color = None
    block_annotation_text = []

    def flush_current():
        nonlocal current_state, current_text, current_md_content, current_color, current_chapter, output_dir

        text = "".join(current_text).strip()
        if not text:
            return

        if current_state == 'heading':
            if "回" in text and re.search(r'第.*?回', text):
                if current_chapter > 0 and current_md_content:
                    filename = os.path.join(output_dir, f"{current_chapter:03d}.md")
                    with open(filename, "w", encoding="utf-8") as f:
                        f.write("".join(current_md_content))
                    print(f"Saved Chapter {current_chapter}")
                current_chapter += 1
                current_md_content = []
            
            current_md_content.append(f"\n# {text}\n\n")

        elif current_state == 'annot_block':
            current_md_content.append(f'\n<div class="annotation-block {current_color}">\n{text}\n</div>\n\n')

        elif current_state == 'main':
            # Ensure proper indentation
            current_md_content.append(f"  {text}\n\n")

        current_text = []

    current_state = None 
    current_color = None
    current_text = []

    for page_num in range(11, len(doc)):
        page = doc.load_page(page_num)
        blocks = page.get_text("dict")["blocks"]
        
        for block in blocks:
            if "lines" not in block:
                continue
            
            block_spans = []
            for line in block["lines"]:
                for span in line["spans"]:
                    # Keep leading spaces to detect paragraph breaks
                    text = span["text"].replace('\xa0', ' ').replace('\u3000', '  ')
                    if text.strip() or ' ' in text:
                        if not is_header_footer(text, span["size"]):
                            block_spans.append({"text": text, "size": span["size"], "color": span["color"]})
            
            if not block_spans:
                continue

            for span in block_spans:
                sz = span["size"]
                col = span["color"]
                txt = span["text"]
                stripped = txt.strip()
                
                if not stripped and sz >= 11:
                    current_text.append(txt)
                    continue
                
                if sz > 16:
                    span_state = 'heading'
                elif sz < 11:
                    span_state = 'inline'
                elif col != 0x0:
                    span_state = 'annot_block'
                else:
                    span_state = 'main'
                
                if span_state == 'inline':
                    # Inline annotations are appended directly without flushing
                    current_text.append(f'<span class="annotation-inline {get_color_class(col)}">{stripped}</span>')
                else:
                    color_class = get_color_class(col) if span_state == 'annot_block' else None
                    
                    # Determine if we should flush
                    # Flush if state changes, OR if state is annot_block but color changes
                    # OR if it's a 'main' text and the text starts with significant whitespace (new paragraph)
                    should_flush = False
                    if current_state != span_state:
                        should_flush = True
                    elif span_state == 'annot_block' and current_color != color_class:
                        should_flush = True
                    elif span_state == 'main' and txt.startswith('  '):
                        should_flush = True
                    elif span_state == 'annot_block' and txt.startswith('  '):
                        should_flush = True
                        
                    if should_flush:
                        flush_current()
                        current_state = span_state
                        if span_state == 'annot_block':
                            current_color = color_class
                    
                    current_text.append(txt)
                    
    flush_current()
    # Save the last chapter
    if current_chapter > 0 and current_md_content:
        filename = os.path.join(output_dir, f"{current_chapter:03d}.md")
        with open(filename, "w", encoding="utf-8") as f:
            f.write("".join(current_md_content))
        print(f"Saved Chapter {current_chapter}")

if __name__ == "__main__":
    pdf_path = "resource/4color_zhiping.pdf"
    output_dir = "resource/zhiping_4color"
    parse_pdf_to_markdown(pdf_path, output_dir)
    print("Done parsing.")
