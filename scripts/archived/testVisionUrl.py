"""Test MINIMAX API with image URL instead of base64."""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

# First test with a simple image URL
test_image_url = "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"

prompt = """识别这张图片中的文字内容，以JSON格式返回：
{
  "text": "图片中的文字"
}
只返回JSON。"""

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
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": test_image_url}}
                    ]
                }
            ],
            "temperature": 0.1,
            "max_tokens": 256,
        },
        timeout=30,
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
