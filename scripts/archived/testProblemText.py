"""Test poetry detection on the specific problem text."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

test_text = """今又正值中秋，不免对月有怀，因而口占五言一律云：
未卜三生愿，频添一段愁。闷来时敛额，行去几回头。自顾风前影，谁堪月下俦？蟾光如有意，先上玉人楼。蟾光如有意，先上玉人楼。 雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："""

print("Input text:")
print(test_text)
print("\n" + "="*50 + "\n")

result = is_poetry_text(test_text)
print("Result:")
print(f"  is_poetry: {result['is_poetry']}")
print(f"  poem_lines: {result['poem_lines']}")
print(f"  remaining_text: {result['remaining_text']}")
