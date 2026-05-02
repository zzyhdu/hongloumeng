"""Test poetry detection on the block 35 text."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

test_text = "雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："

print("Input text:")
print(test_text)
print("\n" + "="*50 + "\n")

result = is_poetry_text(test_text)
print("Result:")
print(f"  is_poetry: {result['is_poetry']}")
print(f"  poem_lines: {result['poem_lines']}")
print(f"  remaining_text: {result['remaining_text']}")
