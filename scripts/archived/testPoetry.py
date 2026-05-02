"""Test poetry detection with MINIMAX API."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

# Test with the problematic text from chapter 1
test_text = """雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云：
未卜三生愿，频添一段愁。
闷来时敛额，行去几回头。
自顾风前影，谁堪月下俦？
蟾光如有意，先上玉人楼。
雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："""

print("Testing poetry detection...")
print(f"Input text:\n{test_text}\n")
print("-" * 50)

result = is_poetry_text(test_text)
print(f"Result: {result}")
