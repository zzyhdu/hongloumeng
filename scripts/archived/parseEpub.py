import os
import re
import xml.etree.ElementTree as ET

ROOT_DIR = '/home/yangsan/workspace/hongloumeng'
EPUB_DIR = os.path.join(ROOT_DIR, 'dist/resource/epub_unzipped')
TOC_FILE = os.path.join(EPUB_DIR, 'toc.ncx')
OUT_DIR = os.path.join(ROOT_DIR, 'resource/rm120')

def clean_html(html_str):
    # Remove superscript annotations like <sup class="...">[1]</sup> or 〔一〕
    html_str = re.sub(r'<sup[^>]*>.*?</sup>', '', html_str)
    # Remove empty anchor tags like <a id="..."></a>
    html_str = re.sub(r'<a\s+id="[^"]*"\s*class="[^"]*"></a>', '', html_str)
    html_str = re.sub(r'<a\s+id="[^"]*"></a>', '', html_str)
    # Remove anchor tags that have hrefs but no real text
    html_str = re.sub(r'<a[^>]*href="[^"]*"[^>]*></a>', '', html_str)
    # Strip any link text wrapping but keep the text
    html_str = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', html_str)
    
    # Replace `<br>` and `<hr>` tags appropriately
    html_str = re.sub(r'<br\s*/?>', '\n', html_str)
    html_str = re.sub(r'<hr[^>]*>', '\n----\n', html_str)

    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', '', html_str)
    
    # Replace common HTML entities
    text = text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    return text.strip()

def process_html_file(filepath, out_filename):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract Title (assuming it's in <h1>)
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', content, re.DOTALL)
    title = clean_html(title_match.group(1)) if title_match else out_filename.replace('.md', '')

    markdown_lines = []
    # Use standard format for titles as seen in cg120
    # E.g. ### 【第一回】 ... or just ### 第一回 ...
    # We'll just use what is in the title, likely "第一回 ..."
    markdown_lines.append(f"### {title}")
    markdown_lines.append("----")
    markdown_lines.append("")

    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
    if body_match:
        body = body_match.group(1)
        
        # We find <p> or <blockquote>
        blocks = re.finditer(r'<(p|blockquote|hr)[^>]*(?:class="([^"]*)")?[^>]*>(.*?)</\1>|<hr[^>]*>', body, re.DOTALL | re.IGNORECASE)
        
        for match in blocks:
            full_match = match.group(0)
            if full_match.startswith('<hr'):
                markdown_lines.append("----")
                markdown_lines.append("")
                continue

            tag = match.group(1).lower() if match.group(1) else ''
            cls_attr = match.group(2) if match.group(2) else ''
            inner_html = match.group(3) if match.group(3) else ''
            
            # Skip notes for a clean reading version
            if cls_attr and 'note' in cls_attr.lower():
                continue
                
            # Skip heading if matched inside body by accident (we handled title)
            if 'calibre1' in cls_attr.lower() and tag == 'h1':
                continue

            clean_text = clean_html(inner_html)
            if not clean_text:
                continue
                
            if tag == 'blockquote' or (cls_attr and ('center' in cls_attr.lower() or 'block1' in cls_attr.lower() or 'ci' in cls_attr.lower())):
                 # Format as poetry/quote block
                 lines = clean_text.split('\n')
                 for line in lines:
                     if line.strip():
                        markdown_lines.append(f"> {line.strip()}")
            else:
                 # Normal paragraph
                 markdown_lines.append(f"<p>{clean_text}</p>")
                 
            markdown_lines.append("")

    out_filepath = os.path.join(OUT_DIR, out_filename)
    with open(out_filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(markdown_lines))
    print(f"Generated {out_filepath}")

def main():
    if not os.path.exists(OUT_DIR):
        os.makedirs(OUT_DIR)

    tree = ET.parse(TOC_FILE)
    root = tree.getroot()
    ns = {'ncx': 'http://www.daisy.org/z3986/2005/ncx/'}
    
    valid_chapters = []
    
    for navPoint in root.findall('.//ncx:navPoint', ns):
        label = navPoint.find('ncx:navLabel/ncx:text', ns).text
        content_src = navPoint.find('ncx:content', ns).attrib['src']
        
        # Check if it's one of the 120 chapters
        if re.search(r'第[一二三四五六七八九十○]+回', label):
            valid_chapters.append({
                'label': label.strip(),
                'src': content_src.split('#')[0]
            })
            
    if len(valid_chapters) != 120:
        print(f"Warning: Found {len(valid_chapters)} chapters, expected 120.")
        
    for i, item in enumerate(valid_chapters):
        chapter_num = str(i + 1).zfill(3)
        html_file = os.path.join(EPUB_DIR, 'text', item['src'].split('/')[-1])
        out_file = f"{chapter_num}.md"
        process_html_file(html_file, out_file)

if __name__ == '__main__':
    main()
