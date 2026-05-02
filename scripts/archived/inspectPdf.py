import fitz # PyMuPDF
import sys

def inspect_pdf(pdf_path, start_page=1, num_pages=5):
    try:
        doc = fitz.open(pdf_path)
        print(f"Total pages: {len(doc)}")
        
        # We also want to check the Table of Contents if available
        toc = doc.get_toc()
        print(f"TOC entries: {len(toc)}")
        for i, entry in enumerate(toc[:10]):
            print(f"TOC Entry {i}: Level {entry[0]}, Title: {entry[1]}, Page: {entry[2]}")
            
        print("\n--- EXTRACTING SAMPLE PAGES ---")
        for i in range(start_page - 1, min(start_page - 1 + num_pages, len(doc))):
            page = doc.load_page(i)
            # Try to get raw text with block info
            text = page.get_text("text")
            print(f"\n=== PAGE {i + 1} ===")
            print(text[:1000]) # print first 1000 chars of page
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_pdf("resource/4color_zhiping.pdf", start_page=10, num_pages=3)
