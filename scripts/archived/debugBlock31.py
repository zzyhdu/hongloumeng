"""Debug why block 31 text returns is_poetry=False."""
import sys
sys.path.insert(0, '.')

import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

text = ("一日，早又中秋佳节。士隐家宴已毕，乃又另具一席于书房，却自己步月至庙中来邀雨村。"
        "原来雨村自那日见了甄家之婢曾回头顾他两次，自为是个知己，便时刻放在心上。"
        "今又正值中秋，不免对月有怀，因而口占五言一律云：")

prompt = f"""判断以下中文文本是否包含诗歌。如果包含诗歌，请找出诗歌的完整内容（每行一首诗歌的几行诗句），并指出诗歌结束后后面的叙述文字从哪里开始。

判断标准：
1. 诗歌通常有固定的韵律和节奏，每行字数相近
2. 诗歌内容相对独立，后面会有"吟罢"、"雨村吟罢"等叙述性文字接续

文本：
---
{text}
---

请以JSON格式返回：
{{
  "is_poetry": true/false,
  "poem_lines": ["第一行", "第二行", ...],
  "remaining_text": "诗歌结束后剩余的叙述文字，如果没有或诗歌到文本末尾则为空字符串"
}}

只返回JSON，不要有其他内容。"""

print(f"API Key: {MINIMAX_API_KEY[:20]}...")
print(f"Text: {text}")
print(f"Text length: {len(text)}")
print("\n" + "="*50 + "\n")

response = requests.post(
    "https://api.minimaxi.com/v1/text/chatcompletion_v2",
    headers={
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "model": "MiniMax-M2.7",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 2048,
    },
    timeout=60,
)

print(f"Status: {response.status_code}")
result = response.json()
content = result.get("choices", [{}])[0].get("message", {}).get("reasoning_content", "")
print(f"\nRaw content ({len(content)} chars):")
print(content[:500])
print("\n" + "="*50 + "\n")

# Try to parse JSON
json_start = content.find('{')
json_end = content.rfind('}') + 1
if json_start >= 0 and json_end > json_start:
    json_str = content[json_start:json_end]
    print(f"JSON string: {json_str}")
    parsed = json.loads(json_str)
    print(f"\nParsed: {parsed}")
else:
    print("No JSON found in content")
