#!/usr/bin/env python3
"""
使用 DeepSeek API (OpenAI 兼容) 从《红楼梦》各章节逐章提取人物关系。
支持断点续传：每章结果独立保存到 resource/llm_chapters_deepseek/ 目录。
全部完成后自动合并去重，输出到 resource/llm_extracted_graph_deepseek.json。

用法:
  .venv/bin/python scripts/llm_extract_relations.py              # 处理全部 119 回
  .venv/bin/python scripts/llm_extract_relations.py --start 1 --end 10  # 处理第 1-10 回
  .venv/bin/python scripts/llm_extract_relations.py --force      # 强制重新处理（覆盖已有结果）
"""

import json
import os
import glob
import time
import argparse
import sys
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# ── 配置 ──────────────────────────────────────────────────
load_dotenv()

API_KEY = os.getenv("DEEPSEEK_API_KEY")
BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-v4-flash"  # 可选: deepseek-v4-flash (快), deepseek-v4-pro (强)

INPUT_DIR = "resource/rm120"
CHAPTER_OUTPUT_DIR = "resource/llm_chapters_deepseek"
FINAL_OUTPUT = "resource/llm_extracted_graph_deepseek.json"

DELAY_SECONDS = 2  # 请求间隔，避免触发限流

# ── 系统提示词 ────────────────────────────────────────────
SYSTEM_PROMPT = """你是一个专业的中国古典文学分析专家。你的任务是从《红楼梦》的章节文本中，提取所有出现的人物以及他们之间的关系。

## 提取规则：
1. **识别所有出场的人物**，包括用别名、称呼、绰号提到的（如"宝二爷"="贾宝玉"，"凤姐"="王熙凤"，"老太太"="贾母"），统一使用最常见的全名。
2. **提取人物之间的关系**。关系必须有文本依据，不要凭你的预训练知识补充文中未提及的关系。
3. 关系的 type 分为以下类别：亲属、夫妻、主仆、朋友、师徒、情感、对立、其他。
4. 每对人物只需记录最重要的一种关系。
5. 只提取**本章文本中明确提到或可以直接推断出的关系**。

## 输出格式：
严格输出 JSON 数组，不要输出其他任何内容（不要 markdown 代码块标记）。每个元素格式：
{"source": "人名A", "target": "人名B", "relation": "关系描述", "type": "类别"}

例如：
[
  {"source": "贾宝玉", "target": "林黛玉", "relation": "表兄妹", "type": "亲属"},
  {"source": "贾宝玉", "target": "花袭人", "relation": "主仆", "type": "主仆"}
]"""


def extract_chapter_text(chapter_path: str) -> tuple[str, str, str]:
    """从章节 JSON 文件中提取纯文本，返回 (chapter_id, title, text)"""
    with open(chapter_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    chapter_id = data.get("id", "")
    title = data.get("title", "")

    paragraphs = []
    for block in data.get("blocks", []):
        block_type = block.get("type")
        if block_type == "paragraph":
            text = "".join(
                span.get("content", "")
                for span in block.get("spans", [])
                if span.get("type") == "text"
            )
            if text.strip():
                paragraphs.append(text.strip())
        elif block_type == "poetry":
            lines_text = []
            for line in block.get("lines", []):
                line_text = "".join(
                    span.get("content", "")
                    for span in line
                    if span.get("type") == "text"
                )
                if line_text.strip():
                    lines_text.append(line_text.strip())
            if lines_text:
                paragraphs.append("\n".join(lines_text))

    return chapter_id, title, "\n\n".join(paragraphs)


def call_llm(client: OpenAI, chapter_id: str, title: str, text: str) -> list[dict]:
    """调用 DeepSeek API 提取人物关系"""
    user_message = f"以下是《红楼梦》{title}的全文。请从中提取所有人物关系，输出 json 数组。\n\n{text}"

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,  # 低温度，保证输出稳定
            max_tokens=16384,
            response_format={"type": "json_object"},  # 启用 JSON 模式，保证输出合法 JSON
            extra_body={"thinking": {"type": "disabled"}},  # 关闭思考模式，减少 token 消耗
        )

        content = response.choices[0].message.content
        if not content or not content.strip():
            print(f"  ⚠️  第{chapter_id}回 API 返回空内容")
            return []
        content = content.strip()

        # 去除可能的 markdown 代码块标记
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        parsed = json.loads(content)

        # JSON 模式可能返回对象包裹的数组，如 {"relations": [...]}
        if isinstance(parsed, dict):
            # 取第一个 list 类型的值
            for v in parsed.values():
                if isinstance(v, list):
                    relations = v
                    break
            else:
                print(f"  ⚠️  第{chapter_id}回 JSON 对象中未找到数组字段")
                return []
        elif isinstance(parsed, list):
            relations = parsed
        else:
            print(f"  ⚠️  第{chapter_id}回 JSON 格式不符合预期: {type(parsed)}")
            return []

        # 添加 chapter 字段
        for r in relations:
            r["chapter"] = chapter_id

        return relations

    except json.JSONDecodeError as e:
        print(f"  ⚠️  第{chapter_id}回 JSON 解析失败: {e}")
        print(f"  原始输出: {content[:200]}...")
        return []
    except Exception as e:
        print(f"  ❌ 第{chapter_id}回 API 调用失败: {e}")
        return []


def merge_all_chapters(chapter_dir: str, output_path: str):
    """合并所有章节的提取结果并去重"""
    all_relations = []
    seen = set()

    for filepath in sorted(glob.glob(os.path.join(chapter_dir, "*.json"))):
        with open(filepath, "r", encoding="utf-8") as f:
            relations = json.load(f)

        for r in relations:
            # 用 (source, target, relation) 去重，保留最早出现的 chapter
            key = (r["source"], r["target"], r["relation"])
            if key not in seen:
                seen.add(key)
                all_relations.append(r)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_relations, f, ensure_ascii=False, indent=2)

    # 统计
    people = set()
    for r in all_relations:
        people.add(r["source"])
        people.add(r["target"])

    print(f"\n{'='*50}")
    print(f"📊 合并完成！")
    print(f"   总关系数: {len(all_relations)}")
    print(f"   涉及人物: {len(people)} 人")
    print(f"   输出文件: {output_path}")
    print(f"{'='*50}")


def main():
    parser = argparse.ArgumentParser(description="从《红楼梦》各章提取人物关系")
    parser.add_argument("--start", type=int, default=1, help="起始章回（默认 1）")
    parser.add_argument("--end", type=int, default=120, help="结束章回（默认 120）")
    parser.add_argument("--force", action="store_true", help="强制重新处理已有结果")
    parser.add_argument("--delay", type=float, default=DELAY_SECONDS, help="请求间隔秒数")
    parser.add_argument("--merge-only", action="store_true", help="仅合并已有结果，不调用 API")
    parser.add_argument("--output-dir", type=str, default=CHAPTER_OUTPUT_DIR, help="章节输出目录")
    parser.add_argument("--output", type=str, default=FINAL_OUTPUT, help="合并输出文件路径")
    args = parser.parse_args()

    # 允许覆盖输出路径
    chapter_dir = args.output_dir
    final_output = args.output

    if args.merge_only:
        merge_all_chapters(chapter_dir, final_output)
        return

    if not API_KEY:
        print("❌ 未找到 DEEPSEEK_API_KEY，请在 .env 文件中配置")
        sys.exit(1)

    # 创建输出目录
    os.makedirs(chapter_dir, exist_ok=True)

    # 初始化客户端
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

    # 获取待处理的章节文件
    chapter_files = sorted(glob.glob(os.path.join(INPUT_DIR, "*.json")))
    total = len(chapter_files)

    print(f"🔍 准备处理《红楼梦》第 {args.start} 回到第 {args.end} 回")
    print(f"   模型: {MODEL}")
    print(f"   请求间隔: {args.delay}s")
    print(f"{'='*50}")

    processed = 0
    skipped = 0
    failed = 0

    for filepath in chapter_files:
        filename = os.path.basename(filepath)
        chapter_num = int(filename.replace(".json", ""))

        if chapter_num < args.start or chapter_num > args.end:
            continue

        output_path = os.path.join(chapter_dir, filename)

        # 断点续传：跳过已处理的
        if os.path.exists(output_path) and not args.force:
            skipped += 1
            continue

        # 提取章节文本
        chapter_id, title, text = extract_chapter_text(filepath)

        if not text.strip():
            print(f"  ⚠️  {filename}: 无文本内容，跳过")
            continue

        print(f"  📖 [{chapter_num:03d}/{args.end:03d}] {title} ({len(text)} 字)...", end=" ", flush=True)

        # 调用 API
        relations = call_llm(client, chapter_id, title, text)

        if relations:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(relations, f, ensure_ascii=False, indent=2)
            print(f"✅ 提取到 {len(relations)} 条关系")
            processed += 1
        else:
            print(f"⚠️ 未提取到关系")
            failed += 1

        # 间隔等待
        time.sleep(args.delay)

    print(f"\n{'='*50}")
    print(f"📋 处理统计:")
    print(f"   成功: {processed} 回")
    print(f"   跳过: {skipped} 回（已有结果）")
    print(f"   失败: {failed} 回")

    # 自动合并
    if processed > 0 or skipped > 0:
        print(f"\n🔄 合并所有章节结果...")
        merge_all_chapters(chapter_dir, final_output)


if __name__ == "__main__":
    main()
