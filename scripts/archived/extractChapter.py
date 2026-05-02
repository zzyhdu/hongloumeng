import fitz
import sys

def extract_chapter(pdf_path, start_page, end_page, out_path):
    doc = fitz.open(pdf_path)
    
    output = []
    
    current_paragraph = ""
    
    for page_num in range(start_page - 1, end_page):
        page = doc.load_page(page_num)
        blocks = page.get_text("dict")["blocks"]
        
        for block in blocks:
            if "lines" not in block:
                continue
            
            block_text = ""
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    
                    # Filter headers and footers
                    if text == "www.hlmbbs.com" or text.isdigit() or text.startswith("抚琴居红楼梦脂评汇校本"):
                        continue
                    if text == "redactor: kolistan":
                        continue
                        
                    color = span["color"]
                    
                    if color == 0x0: # Black
                        block_text += text
                    elif color == 0xff0000: # Red
                        block_text += f'<span class="zhi-red">（{text}）</span>'
                    elif color == 0x8b: # Blue (蒙侧)
                        block_text += f'<span class="zhi-blue">（{text}）</span>'
                    elif color == 0x442b: # Green/Brown (庚辰)
                        block_text += f'<span class="zhi-green">（{text}）</span>'
                    else:
                        block_text += f'<span style="color:#{color:06x}">（{text}）</span>'
            
            if block_text:
                if current_paragraph:
                    # If current paragraph doesn't end with punctuation, it might continue
                    if current_paragraph[-1] not in ["。", "！", "？", "”", "：", "）", ">"]:
                        current_paragraph += block_text
                    else:
                        output.append(current_paragraph)
                        current_paragraph = block_text
                else:
                    current_paragraph = block_text
                    
    if current_paragraph:
        output.append(current_paragraph)
        
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(output))
        
    print(f"Extracted chapter to {out_path}")

if __name__ == "__main__":
    extract_chapter("resource/4color_zhiping.pdf", 12, 28, "resource/001_test.md")
