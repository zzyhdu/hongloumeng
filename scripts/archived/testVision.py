"""Test MINIMAX vision API with PDF page images."""
import fitz  # PyMuPDF
import requests
import os
import base64
import json
from dotenv import load_dotenv

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

def extract_page_image(pdf_path, page_num, zoom=2.0):
    """Extract a page as image, return as base64 PNG."""
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    doc.close()
    return base64.b64encode(img_bytes).decode("utf-8")

def is_poetry_page_vision(image_base64):
    """Use MINIMAX vision model to detect poetry on a page."""
    if not MINIMAX_API_KEY:
        print("No API key")
        return None

    prompt = """你是一个红楼梦研究助手。下面是一张红楼梦PDF页面的截图。

请识别并返回这首诗的完整内容（如果有的话），格式为JSON：
{
  "has_poetry": true/false,
  "poem_lines": ["第一行诗句", "第二行诗句", ...],
  "remaining_text": "如果诗歌后面还有叙述文字，请返回这段文字（到诗歌结束为止，不要包含诗歌内容本身）"
}

注意：
1. 诗歌通常有固定的韵律，每行字数相近
2. 诗歌后面的叙述文字会提到"吟罢"、"雨村"等
3. 如果页面没有诗歌，返回 {"has_poetry": false, "poem_lines": [], "remaining_text": ""}

只返回JSON，不要有其他内容。"""

    try:
        response = requests.post(
            "https://api.minimaxi.com/v1/text/chatcompletion_v2",
            headers={
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "MiniMax-M2.7",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                            {"type": "text", "text": prompt}
                        ]
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
            },
            timeout=60,
        )
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Result keys: {result.keys()}")
        print(f"Choices: {result.get('choices')}")

        content = result.get("choices", [{}])[0].get("message", {}).get("reasoning_content", "")
        print(f"Content length: {len(content)}")
        print(f"Content preview: {content[:200]}...")

        # Parse JSON - handle markdown code blocks
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]

        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = content[json_start:json_end]
            parsed = json.loads(json_str)
            return {
                "has_poetry": bool(parsed.get("has_poetry", False)),
                "poem_lines": [str(line).strip() for line in parsed.get("poem_lines", []) if str(line).strip()],
                "remaining_text": str(parsed.get("remaining_text", "")).strip(),
            }
        else:
            print("No JSON found in response")
    except Exception as e:
        print(f"Error: {e}")

    return None


# Test with chapter 1, page 21 (where poetry "未卜三生愿" appears)
pdf_path = "resource/4color_zhiping.pdf"

print("Extracting page 21 as image...")
img_b64 = extract_page_image(pdf_path, 19)  # 0-indexed
print(f"Image size: {len(img_b64)} bytes (base64)")

print("\nSending to MINIMAX vision API...")
result = is_poetry_page_vision(img_b64)
print(f"\nFinal result: {result}")
