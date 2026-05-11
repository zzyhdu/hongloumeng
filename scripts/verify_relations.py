import json
import os

GROUND_TRUTH_FILE = 'scripts/ground_truth.json'
EXTRACTED_FILE = 'resource/llm_extracted_graph.json'

def get_undirected_edge(source, target):
    return tuple(sorted([source, target]))

def load_edges(filepath, is_llm_format=False):
    if not os.path.exists(filepath):
        print(f"Warning: File {filepath} not found.")
        return set(), []
        
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return set(), []
            
    edges_set = set()
    raw_edges = []
    
    for item in data:
        src = item.get('source')
        tgt = item.get('target')
        rel = item.get('relation', '')
        if src and tgt:
            edge = get_undirected_edge(src, tgt)
            edges_set.add(edge)
            raw_edges.append({
                "pair": edge,
                "relation": rel
            })
            
    return edges_set, raw_edges

def main():
    gt_edges_set, gt_raw = load_edges(GROUND_TRUTH_FILE)
    ext_edges_set, ext_raw = load_edges(EXTRACTED_FILE)
    
    if not gt_edges_set:
        print("Error: Ground truth data is empty or missing.")
        return
        
    if not ext_edges_set:
        print("Error: Extracted data is empty or missing. Please run the LLM extraction skill first.")
        return

    # Calculate overlaps
    true_positives = gt_edges_set.intersection(ext_edges_set)
    false_positives = ext_edges_set - gt_edges_set
    false_negatives = gt_edges_set - ext_edges_set
    
    precision = len(true_positives) / len(ext_edges_set) if len(ext_edges_set) > 0 else 0
    recall = len(true_positives) / len(gt_edges_set) if len(gt_edges_set) > 0 else 0
    
    print("="*50)
    print("📊 人物关系大模型提取验证报告")
    print("="*50)
    print(f"基准关系总数 (Ground Truth): {len(gt_edges_set)}")
    print(f"大模型提取总数 (Extracted) : {len(ext_edges_set)}")
    print(f"命中数量 (True Positives)  : {len(true_positives)}")
    print("-"*50)
    print(f"🎯 准确率 (Precision) : {precision:.2%}")
    print(f"🔍 召回率 (Recall)    : {recall:.2%}")
    print("="*50)
    
    if false_negatives:
        print("\n❌ 漏报分析 (模型未能提取出的经典关系):")
        for fn in false_negatives:
            # Find description in GT
            desc = next((item['relation'] for item in gt_raw if item['pair'] == fn), "未知")
            print(f"  - {fn[0]} <-> {fn[1]} [{desc}]")
            
    if false_positives:
        print("\n⚠️ 额外发现/可能幻觉 (模型提取出但基准未收录):")
        for fp in false_positives:
             desc = next((item['relation'] for item in ext_raw if item['pair'] == fp), "未知")
             print(f"  + {fp[0]} <-> {fp[1]} [{desc}]")

if __name__ == '__main__':
    main()
