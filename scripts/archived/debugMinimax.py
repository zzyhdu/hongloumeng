"""Debug MINIMAX API."""
import requests
import os
from dotenv import load_dotenv
import json

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

test_text = """未卜三生愿，频添一段愁。
闷来时敛额，行去几回头。
自顾风前影，谁堪月下俦？
蟾光如有意，先上玉人楼。"""

prompt = f"""判断以下中文文本是否包含诗歌。

文本：
---
{test_text}
---

请以JSON格式返回：
{{
  "is_poetry": true/false,
  "poem_lines": ["第一行", "第二行", ...],
  "remaining_text": "诗歌结束后剩余的叙述文字"
}}"""

print(f"API Key exists: {bool(MINIMAX_API_KEY)}")

try:
    response = requests.post(
        "https://api.minimax.chat/v1/text/chatcompletion_v2",
        headers={
            "Authorization": f"Bearer {MINIMAX_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "MiniMax-M2.7",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 512,
        },
        timeout=30,
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
except Exception as e:
    print(f"Error: {e}")
