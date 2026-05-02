"""Debug the AI splitting issue."""
import sys
sys.path.insert(0, '.')

from scripts.parseZhipingJson import is_poetry_text

# Test with text that has NO newlines but comma-separated couplets
test_text = "未卜三生愿，频添一段愁。闷来时敛额，行去几回头。自顾风前影，谁堪月下俦？蟾光如有意，先上玉人楼。蟾光如有意，先上玉人楼。 雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："

print("Input (NO newlines):")
print(test_text)
print("\n" + "="*50 + "\n")

result = is_poetry_text(test_text)
print("Result:")
print(f"  is_poetry: {result['is_poetry']}")
print(f"  poem_lines count: {len(result['poem_lines'])}")
for i, line in enumerate(result['poem_lines']):
    print(f"    Line {i}: {line}")

print("\n" + "="*50 + "\n")

# Test WITH newlines
test_text2 = """未卜三生愿，频添一段愁。
闷来时敛额，行去几回头。
自顾风前影，谁堪月下俦？
蟾光如有意，先上玉人楼。
蟾光如有意，先上玉人楼。 雨村吟罢，因又思及平生抱负，苦未逢时，乃又搔首对天长叹，复高吟一联云："""

print("Input (WITH newlines):")
print(test_text2)
print("\n" + "="*50 + "\n")

result2 = is_poetry_text(test_text2)
print("Result:")
print(f"  is_poetry: {result2['is_poetry']}")
print(f"  poem_lines count: {len(result2['poem_lines'])}")
for i, line in enumerate(result2['poem_lines']):
    print(f"    Line {i}: {line}")
