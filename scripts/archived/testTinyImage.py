"""Test MINIMAX API with simplest possible image."""
import requests
import os
import base64
from dotenv import load_dotenv

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

# Create a tiny 1x1 red pixel PNG
# This is a minimal valid PNG
tiny_png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

prompt = "这张图片里有什么？只回答JSON格式：{\"description\": \"描述\"}"

print(f"API Key exists: {bool(MINIMAX_API_KEY)}")
print(f"Tiny PNG length: {len(tiny_png_base64)}")

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
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{tiny_png_base64}"}}
                    ]
                }
            ],
            "temperature": 0.1,
            "max_tokens": 128,
        },
        timeout=30,
    )
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {result}")
except Exception as e:
    print(f"Error: {e}")
