"""Check what AI actually returns for the problematic text."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

# Test with newlines (which works better)
test_text_with_newlines = """今又正值中秋，不免对月有怀，因而口占五言一律云：
未卜三生愿，频添一段愁。
闷来时敛额，行去几回头。
自顾风前影，谁堪月下俦？
蟾光如有意，先上玉人楼。
蟾光如有意，先上玉人楼。 雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："""

print("Test 1: With newlines in input")
print("="*50)
result = is_poetry_text(test_text_with_newlines)
print(f"is_poetry: {result['is_poetry']}")
print(f"poem_lines ({len(result['poem_lines'])}):")
for i, line in enumerate(result['poem_lines']):
    print(f"  {i}: {line}")
print(f"remaining_text: {result['remaining_text'][:50] if result['remaining_text'] else '(empty)'}...")

print("\n\nTest 2: Without newlines (all on one line)")
print("="*50)
test_text_no_newlines = """今又正值中秋，不免对月有怀，因而口占五言一律云：
未卜三生愿，频添一段愁。闷来时敛额，行去几回头。自顾风前影，谁堪月下俦？蟾光如有意，先上玉人楼。蟾光如有意，先上玉人楼。 雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："""

result2 = is_poetry_text(test_text_no_newlines)
print(f"is_poetry: {result2['is_poetry']}")
print(f"poem_lines ({len(result2['poem_lines'])}):")
for i, line in enumerate(result2['poem_lines']):
    print(f"  {i}: {line}")
print(f"remaining_text: {result2['remaining_text'][:50] if result2['remaining_text'] else '(empty)'}...")
