import json

# Load base co-occurrence graph
with open('resource/character_graph.json', 'r', encoding='utf-8') as f:
    base_graph = json.load(f)

# Load LLM extracted relations
with open('resource/llm_extracted_graph.json', 'r', encoding='utf-8') as f:
    llm_relations = json.load(f)

# Build a lookup for LLM relations
llm_edge_map = {}
for rel in llm_relations:
    u = rel['source']
    v = rel['target']
    # Ensure consistent ordering
    if u > v:
        u, v = v, u
    key = (u, v)
    # If there are multiple relations between same pair, just take first or join
    if key not in llm_edge_map:
        llm_edge_map[key] = rel['relation']
    else:
        llm_edge_map[key] += f" / {rel['relation']}"

# Update the base graph edges with LLM relations
merged_edges = []
for edge in base_graph['edges']:
    u = edge['source']
    v = edge['target']
    
    # Check consistent ordering
    lookup_u, lookup_v = u, v
    if lookup_u > lookup_v:
        lookup_u, lookup_v = lookup_v, lookup_u
        
    key = (lookup_u, lookup_v)
    
    merged_edge = dict(edge)
    if key in llm_edge_map:
        merged_edge['relationType'] = llm_edge_map[key]
        # Remove from map so we know what's left
        del llm_edge_map[key]
        
    merged_edges.append(merged_edge)

# Add any remaining LLM edges that weren't in the co-occurrence graph
# We give them a default weight (e.g., 5) so they show up
for (u, v), rel_type in llm_edge_map.items():
    merged_edges.append({
        'source': u,
        'target': v,
        'value': 5, # default value for explicitly defined relationships
        'relationType': rel_type
    })

# Ensure all nodes exist for the new edges
existing_nodes = {n['id'] for n in base_graph['nodes']}
new_nodes = set()
for edge in merged_edges:
    if edge['source'] not in existing_nodes:
        new_nodes.add(edge['source'])
    if edge['target'] not in existing_nodes:
        new_nodes.add(edge['target'])

# Add missing nodes with default values
for node_id in new_nodes:
    base_graph['nodes'].append({
        'id': node_id,
        'name': node_id,
        'value': 100 # default value
    })

merged_graph = {
    'nodes': base_graph['nodes'],
    'edges': merged_edges
}

with open('resource/character_graph.json', 'w', encoding='utf-8') as f:
    json.dump(merged_graph, f, ensure_ascii=False, indent=2)

print(f"Merged {len(llm_relations)} explicit relations into graph. Total edges: {len(merged_edges)}")
