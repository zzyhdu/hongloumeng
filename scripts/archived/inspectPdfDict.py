import fitz # PyMuPDF
import sys

def inspect_pdf_dict(pdf_path, page_num):
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num - 1)
    
    # Extract text as a dictionary (contains font, size, color, etc.)
    blocks = page.get_text("dict")["blocks"]
    
    print(f"=== Page {page_num} Rich Text Inspection ===")
    for block in blocks:
        if "lines" in block:
            for line in block["lines"]:
                line_text = ""
                for span in line["spans"]:
                    text = span["text"]
                    color = hex(span["color"])
                    size = span["size"]
                    font = span["font"]
                    # Print span details
                    if text.strip():
                        print(f"Text: '{text}' | Color: {color} | Size: {size:.1f} | Font: {font}")
                
if __name__ == "__main__":
    # Let's inspect page 12 (first chapter)
    inspect_pdf_dict("resource/4color_zhiping.pdf", 12)
