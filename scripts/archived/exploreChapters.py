import fitz
import sys

def explore(pdf_path):
    doc = fitz.open(pdf_path)
    for i in range(20):
        page = doc.load_page(i)
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if "lines" in block:
                for line in block["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        size = span["size"]
                        if size > 16:
                            print(f"Page {i+1}: '{text}' (Size: {size})")
explore("resource/4color_zhiping.pdf")
