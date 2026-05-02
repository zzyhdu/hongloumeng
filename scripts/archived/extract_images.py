import fitz
import os

def main():
    pdf_path = "resource/4color_zhiping.pdf"
    output_dir = "scratch/ch1_images"
    os.makedirs(output_dir, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    # Chapter 1 is pages 12 to 27
    start_page = 12
    end_page = 28
    
    for page_num in range(start_page, end_page):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=150)
        out_path = os.path.join(output_dir, f"page_{page_num:03d}.png")
        pix.save(out_path)
        print(f"Saved {out_path}")

if __name__ == "__main__":
    main()
