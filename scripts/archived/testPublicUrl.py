"""Test MINIMAX API with a public image URL."""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")

# Use a public image URL
test_image_url = "https://upload.wikimedia.org/wikipedia/en/a/a9/Blank.jpg"

prompt = "这张图片里有什么？只回答JSON格式：{\"description\": \"描述\"}"

print(f"API Key exists: {bool(MINIMAX_API_KEY)}")

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
                        {"type": "image_url", "image_url": {"url": test_image_url}}
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
