"""Test poetry detection on block 31 text."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

# This is what block 31 text would be (approximately)
test_text = "一日，早又中秋佳节。士隐家宴已毕，乃又另具一席于书房，却自己步月至庙中来邀雨村。原来雨村自那日见了甄家之婢曾回头顾他两次，自为是个知己，便时刻放在心上。今又正值中秋，不免对月有怀，因而口占五言一律云："

print("Input text:")
print(test_text)
print(f"\nLength: {len(test_text)}")
print("\n" + "="*50 + "\n")

result = is_poetry_text(test_text)
print("Result:")
print(f"  is_poetry: {result['is_poetry']}")
print(f"  poem_lines: {result['poem_lines']}")
print(f"  remaining_text: {result['remaining_text'][:100] if result['remaining_text'] else ''}")
