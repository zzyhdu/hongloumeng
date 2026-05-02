"""Test with actual block 31 text."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

# Actual block 31 text from JSON
test_text = "一日，早又中秋佳节。士隐家宴已毕，乃又另具一席于书房，却自己步月至庙中来邀雨村。原来雨村自那日见了甄家之婢曾回头顾他两次，自为是个知己，便时刻放在心上。今又正值中秋，不免对月有怀，因而口占五言一律云："

print("Input (actual block 31 text):")
print(test_text)
print(f"\nLength: {len(test_text)}")
print(f"Contains 口占: {'口占' in test_text}")
print("\n" + "="*50 + "\n")

result = is_poetry_text(test_text)
print("Result:")
print(f"  is_poetry: {result['is_poetry']}")
print(f"  poem_lines count: {len(result['poem_lines'])}")
for i, line in enumerate(result['poem_lines']):
    print(f"    Line {i}: {line}")
print(f"  remaining_text: {result['remaining_text'][:50] if result['remaining_text'] else '(empty)'}...")
