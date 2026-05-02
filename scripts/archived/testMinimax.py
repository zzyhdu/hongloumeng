"""Test MINIMAX API directly."""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

test_text = """雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云：
未卜三生愿，频添一段愁。
闷来时敛额，行去几回头。
自顾风前影，谁堪月下俦？
蟾光如有意，先上玉人楼。
雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："""

prompt = f"""判断以下中文文本是否包含诗歌。如果包含诗歌，请找出诗歌的完整内容（每行一首诗歌的几行诗句），并指出诗歌结束后面的叙述文字从哪里开始。

判断标准：
1. 诗歌通常有固定的韵律和节奏，每行字数相近
2. 诗歌内容相对独立，后面会有"吟罢"、"雨村吟罢"等叙述性文字接续

文本：
---
{test_text}
---

请以JSON格式返回：
{{
  "is_poetry": true/false,
  "poem_lines": ["第一行", "第二行", ...],
  "remaining_text": "诗歌结束后剩余的叙述文字，如果没有或诗歌到文本末尾则为空字符串"
}}

只返回JSON，不要有其他内容。"""

print(f"API Key exists: {bool(MINIMAX_API_KEY)}")
print(f"API Key prefix: {MINIMAX_API_KEY[:20]}...")

try:
    response = requests.post(
        "https://api.minimax.chat/v1/text/chatcompletion_v2",
        headers={
            "Authorization": f"Bearer {MINIMAX_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "MiniMax-Text-01",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 512,
        },
        timeout=30,
    )
    print(f"Status code: {response.status_code}")
    print(f"Response text: {response.text[:1000]}")
except Exception as e:
    print(f"Error: {e}")
