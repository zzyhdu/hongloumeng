#!/usr/bin/env python3
"""
Build a consolidated graph from the per-chapter DeepSeek LLM extractions.

Input:  resource/llm_extracted_graph_deepseek.json
Output: public/full_graph.json

Processing:
  1. Normalize character names (short → canonical full names)
  2. Merge duplicate edges across chapters (sum weights, keep best relation label)
  3. Compute node degree and connection count
  4. Assign category by family/group membership
"""

import json
from collections import defaultdict, Counter
from pathlib import Path

# ── Name normalization map ──────────────────────────────────────────
# Maps short/variant names → canonical full name
NAME_MAP = {
    # 贾府核心
    "宝玉": "贾宝玉",
    "黛玉": "林黛玉",
    "宝钗": "薛宝钗",
    "探春": "贾探春",
    "迎春": "贾迎春",
    "惜春": "贾惜春",
    "元春": "贾元春",
    "湘云": "史湘云",
    "袭人": "花袭人",
    "凤姐": "王熙凤",
    "凤姐儿": "王熙凤",
    "巧姐": "巧姐儿",
    "宝琴": "薛宝琴",
    "岫烟": "邢岫烟",
    "金桂": "夏金桂",
    "五儿": "柳五儿",
    "金钏": "金钏儿",
    "玉钏": "玉钏儿",
    "大姐儿": "巧姐儿",
    "来旺": "来旺儿",
    "旺儿": "来旺儿",
    "尤老": "尤老娘",
    "金哥": "张金哥",
    "道婆": "马道婆",
    "李婶": "李婶娘",
    "宋妈": "宋妈妈",
    # 秦氏 variants
    "秦氏": "秦可卿",
    # 大姐 is ambiguous - likely 巧姐
    "大姐": "巧姐儿",
}

# ── Category assignment ─────────────────────────────────────────────
# Assign characters to groups for coloring
CATEGORY_RULES = {
    "贾府主人": ["贾母", "贾政", "贾赦", "王夫人", "邢夫人", "贾琏", "贾珍",
                "贾蓉", "贾敬", "贾代善", "贾代化", "荣国公", "宁国公", "贾珠",
                "李纨", "贾兰", "贾环", "赵姨娘", "贾蔷", "贾芸", "贾瑞",
                "尤氏", "贾芹", "贾菌"],
    "宝黛钗": ["贾宝玉", "林黛玉", "薛宝钗"],
    "金陵十二钗": ["贾元春", "贾探春", "贾迎春", "贾惜春", "史湘云", "妙玉",
                  "秦可卿", "薛宝琴", "邢岫烟", "李纹", "李绮", "巧姐儿"],
    "丫鬟群": ["花袭人", "晴雯", "平儿", "紫鹃", "鸳鸯", "香菱", "麝月",
              "金钏儿", "玉钏儿", "彩云", "彩霞", "翠缕", "司棋", "侍书",
              "入画", "莺儿", "小红", "芳官", "柳五儿", "鹦哥", "雪雁",
              "秋纹", "碧痕", "春燕", "媚人", "傻大姐"],
    "薛家": ["薛蟠", "薛姨妈", "夏金桂", "薛蝌", "薛科"],
    "外围要角": ["刘姥姥", "贾雨村", "尤二姐", "尤三姐", "尤老娘",
               "北静王", "柳湘莲", "蒋玉菡", "冯紫英", "甄士隐"],
    "王家/史家": ["王子腾", "王仁", "史鼎", "史鼐", "保龄侯"],
    "林家": ["林如海", "贾敏"],
}

# Build reverse lookup
CHAR_TO_CATEGORY = {}
for cat, members in CATEGORY_RULES.items():
    for m in members:
        CHAR_TO_CATEGORY[m] = cat


def normalize_name(name: str) -> str:
    """Normalize a character name to its canonical form."""
    name = name.strip()
    return NAME_MAP.get(name, name)


def get_category(name: str) -> str:
    """Get the category for a character, defaulting to '其他'."""
    return CHAR_TO_CATEGORY.get(name, "其他")


def main():
    base = Path(__file__).resolve().parent.parent
    input_path = base / "resource" / "llm_extracted_graph_deepseek.json"
    output_path = base / "public" / "full_graph.json"

    with open(input_path, "r", encoding="utf-8") as f:
        raw_relations = json.load(f)

    print(f"Loaded {len(raw_relations)} raw relations")

    # ── Step 1: Normalize and aggregate edges ───────────────────────
    edge_weights = defaultdict(int)       # (u, v) → total weight
    edge_relations = defaultdict(list)    # (u, v) → [relation labels]
    edge_types = defaultdict(list)        # (u, v) → [type labels]
    edge_chapters = defaultdict(set)      # (u, v) → {chapters}

    skipped = 0
    for rel in raw_relations:
        src = normalize_name(rel["source"])
        tgt = normalize_name(rel["target"])

        # Skip self-loops
        if src == tgt:
            skipped += 1
            continue

        # Canonical ordering for undirected edges
        if src > tgt:
            src, tgt = tgt, src

        key = (src, tgt)
        edge_weights[key] += 1
        edge_relations[key].append(rel.get("relation", ""))
        edge_types[key].append(rel.get("type", "其他"))
        edge_chapters[key].add(rel.get("chapter", "?"))

    print(f"Skipped {skipped} self-loops")
    print(f"Unique edges after merge: {len(edge_weights)}")

    # ── Step 2: Pick best relation label per edge ───────────────────
    edges = []
    for (src, tgt), weight in edge_weights.items():
        # Pick the most common relation label
        rels = [r for r in edge_relations[(src, tgt)] if r]
        best_relation = Counter(rels).most_common(1)[0][0] if rels else ""

        # Pick the most common type
        types = edge_types[(src, tgt)]
        best_type = Counter(types).most_common(1)[0][0] if types else "其他"

        edge_data = {
            "source": src,
            "target": tgt,
            "weight": weight,
            "chapters": len(edge_chapters[(src, tgt)]),
        }
        if best_relation:
            edge_data["relation"] = best_relation
        if best_type:
            edge_data["type"] = best_type

        edges.append(edge_data)

    # ── Step 3: Build node list ─────────────────────────────────────
    node_degree = defaultdict(int)
    node_weight = defaultdict(int)
    for e in edges:
        node_degree[e["source"]] += 1
        node_degree[e["target"]] += 1
        node_weight[e["source"]] += e["weight"]
        node_weight[e["target"]] += e["weight"]

    nodes = []
    for name in sorted(node_degree.keys()):
        nodes.append({
            "id": name,
            "name": name,
            "degree": node_degree[name],
            "weight": node_weight[name],
            "category": get_category(name),
        })

    print(f"Total nodes: {len(nodes)}")

    # ── Step 4: Compute top characters for quick-select ─────────────
    top_characters = sorted(nodes, key=lambda n: -n["weight"])[:30]
    top_names = [n["name"] for n in top_characters]

    # ── Step 5: Write output ────────────────────────────────────────
    output = {
        "nodes": nodes,
        "edges": edges,
        "topCharacters": top_names,
        "stats": {
            "totalNodes": len(nodes),
            "totalEdges": len(edges),
            "totalRelations": len(raw_relations),
        }
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nOutput written to {output_path}")
    print(f"Top 10 characters: {', '.join(top_names[:10])}")

    # Category breakdown
    cat_counts = Counter(n["category"] for n in nodes)
    print("\nCategory breakdown:")
    for cat, count in cat_counts.most_common():
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
