import re

with open("resource/rm120/017.md", "r", encoding="utf-8") as f:
    content = f.read()

split_marker = "<p>当下又有人回，工程上等着糊东西的纱绫"
if split_marker not in content:
    print("Split marker not found!")
    exit(1)

part1, part2 = content.split(split_marker, 1)
part2 = split_marker + part2

# Now we need to split part2 to separate the main text from the footnotes
# The footnotes start with `----` and `〔一〕` or something similar.
# In the file, there is `正如——\n\n----\n\n<p>〔一〕`
footnote_split_marker = "----\n\n<p>〔一〕"
if footnote_split_marker in part2:
    ch18_text, footnotes = part2.split(footnote_split_marker, 1)
    footnotes = footnote_split_marker + footnotes
else:
    ch18_text = part2
    footnotes = ""

# Wait, let's just attach all footnotes to the end of chapter 18 for simplicity.
ch17_title = "### 第十七回 大观园试才题对额 荣国府归省庆元宵\n----\n\n"
ch18_title = "### 第十八回 皇恩重元妃省父母 天伦乐宝玉呈才藻\n----\n\n"

# Remove the old title from part1
part1 = re.sub(r"^### 第十七回至十八回.*?\n----\n\n", "", part1, flags=re.DOTALL)

with open("resource/rm120/017.md", "w", encoding="utf-8") as f:
    f.write(ch17_title + part1.strip() + "\n")

with open("resource/rm120/018.md", "w", encoding="utf-8") as f:
    f.write(ch18_title + part2.strip() + "\n")

print("Successfully split 017.md into 017.md and 018.md")
