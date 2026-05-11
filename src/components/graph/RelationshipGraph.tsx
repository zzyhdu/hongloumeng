import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { X, Search, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

/* ─── Types ──────────────────────────────────────────────────────── */

interface RawNode {
  id: string;
  name: string;
  degree: number;
  weight: number;
  category: string;
}

interface RawEdge {
  source: string;
  target: string;
  weight: number;
  chapters: number;
  relation?: string;
  type?: string;
}

interface FullGraph {
  nodes: RawNode[];
  edges: RawEdge[];
  topCharacters: string[];
  stats: { totalNodes: number; totalEdges: number; totalRelations: number };
}

interface RelationshipGraphProps {
  onClose: () => void;
  resourceBase: string;
}

/* ─── Constants ──────────────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, string> = {
  '宝黛钗': '#C75C5C',
  '贾府主人': '#C49B6A',
  '金陵十二钗': '#6B9E7A',
  '丫鬟群': '#6B87A8',
  '薛家': '#B07BAD',
  '外围要角': '#8C8C8C',
  '王家/史家': '#A89B6B',
  '林家': '#7AADAD',
  '其他': '#A0A0A0',
};

const CATEGORY_ORDER = [
  '宝黛钗', '贾府主人', '金陵十二钗', '丫鬟群',
  '薛家', '外围要角', '林家', '王家/史家', '其他',
];

const MAX_HOPS = 4;
const DEFAULT_HOPS = 2;
const DEFAULT_CENTER = '贾宝玉';

/* ─── BFS sub-graph extraction ───────────────────────────────────── */

function extractEgoGraph(
  graph: FullGraph,
  centerName: string,
  maxHops: number,
): { nodes: RawNode[]; edges: RawEdge[]; hops: Map<string, number> } {
  // Build adjacency
  const adj = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  // BFS from center
  const visited = new Map<string, number>(); // name → hop distance
  const queue: [string, number][] = [[centerName, 0]];
  visited.set(centerName, 0);

  while (queue.length > 0) {
    const [current, hop] = queue.shift()!;
    if (hop >= maxHops) continue;
    const neighbors = adj.get(current);
    if (!neighbors) continue;
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.set(nb, hop + 1);
        queue.push([nb, hop + 1]);
      }
    }
  }

  const nodeSet = new Set(visited.keys());
  const filteredNodes = graph.nodes.filter(n => nodeSet.has(n.id));
  const filteredEdges = graph.edges.filter(
    e => nodeSet.has(e.source) && nodeSet.has(e.target),
  );

  return { nodes: filteredNodes, edges: filteredEdges, hops: visited };
}

/* ─── Component ──────────────────────────────────────────────────── */

export function RelationshipGraph({ onClose, resourceBase }: RelationshipGraphProps) {
  const [fullGraph, setFullGraph] = useState<FullGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [centerName, setCenterName] = useState(DEFAULT_CENTER);
  const [hops, setHops] = useState(DEFAULT_HOPS);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const chartRef = useRef<ReactECharts | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ── Load data ──
  useEffect(() => {
    fetch('/full_graph.json')
      .then(res => res.json())
      .then((json: FullGraph) => {
        setFullGraph(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load graph data', err);
        setLoading(false);
      });
  }, []);

  // ── Extract ego graph ──
  const egoData = useMemo(() => {
    if (!fullGraph) return null;
    return extractEgoGraph(fullGraph, centerName, hops);
  }, [fullGraph, centerName, hops]);

  // ── Search suggestions ──
  const searchSuggestions = useMemo(() => {
    if (!fullGraph || !searchText.trim()) return [];
    const q = searchText.trim().toLowerCase();
    return fullGraph.nodes
      .filter(n => n.name.toLowerCase().includes(q))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 12);
  }, [fullGraph, searchText]);

  // ── Handle node click → make it the center ──
  const handleChartEvents = useMemo(() => ({
    click: (params: { dataType: string; name?: string }) => {
      if (params.dataType === 'node' && params.name) {
        setCenterName(params.name);
        setSearchText('');
        setSearchOpen(false);
      }
    },
  }), []);

  // ── Select a character from search ──
  const selectCharacter = useCallback((name: string) => {
    setCenterName(name);
    setSearchText('');
    setSearchOpen(false);
  }, []);

  // ── ECharts option ──
  const option = useMemo(() => {
    if (!egoData) return {};

    const { nodes, edges, hops: hopMap } = egoData;

    // Build categories list from present categories
    const presentCats = new Set(nodes.map(n => n.category));
    const categories = CATEGORY_ORDER
      .filter(c => presentCats.has(c))
      .map(c => ({ name: c }));
    const catIndexMap = new Map(categories.map((c, i) => [c.name, i]));

    // Map nodes to ECharts format
    const chartNodes = nodes.map(node => {
      const hop = hopMap.get(node.id) ?? 99;
      const isCenter = node.id === centerName;
      const baseSize = Math.max(16, Math.min(70, Math.sqrt(node.weight) * 4));
      const sizeMultiplier = isCenter ? 1.5 : hop === 1 ? 1.1 : 1;

      return {
        id: node.id,
        name: node.name,
        value: node.weight,
        symbolSize: baseSize * sizeMultiplier,
        category: catIndexMap.get(node.category) ?? (categories.length - 1),
        itemStyle: {
          opacity: hop <= 1 ? 1 : hop === 2 ? 0.85 : 0.6,
          ...(isCenter ? {
            shadowBlur: 20,
            shadowColor: CATEGORY_COLORS[node.category] || '#C75C5C',
            borderWidth: 3,
            borderColor: '#fff',
          } : {}),
        },
        label: {
          show: hop <= 2 || node.weight > 10 || baseSize > 25,
          fontSize: isCenter ? 16 : hop === 1 ? 13 : 11,
          fontWeight: isCenter ? 'bold' : (hop <= 1 ? 600 : 'normal'),
          color: isCenter ? '#111' : '#3A2E25',
          fontFamily: '"Noto Serif SC", "Songti SC", serif',
        },
        // Store hop for tooltip
        _hop: hop,
        _degree: node.degree,
        _category: node.category,
      };
    });

    // Map edges to ECharts format
    const maxWeight = Math.max(...edges.map(e => e.weight), 1);
    const chartEdges = edges.map(edge => {
      const normalizedWeight = edge.weight / maxWeight;
      const sourceHop = hopMap.get(edge.source) ?? 99;
      const targetHop = hopMap.get(edge.target) ?? 99;
      const minHop = Math.min(sourceHop, targetHop);

      return {
        source: edge.source,
        target: edge.target,
        value: edge.weight,
        lineStyle: {
          width: Math.max(0.5, normalizedWeight * 6),
          opacity: minHop <= 1 ? 0.6 : 0.25,
          curveness: 0.2,
          type: edge.weight <= 1 ? 'dashed' as const : 'solid' as const,
        },
        label: {
          show: edge.relation && edge.weight >= 3 && minHop <= 1,
          formatter: edge.relation || '',
          fontSize: 10,
          color: '#666',
          fontFamily: '"Noto Serif SC", serif',
        },
        _relation: edge.relation || '',
        _chapters: edge.chapters,
        _type: edge.type || '',
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(255,255,250,0.96)',
        borderColor: '#ddd',
        borderWidth: 1,
        textStyle: {
          color: '#333',
          fontFamily: '"Noto Serif SC", serif',
          fontSize: 13,
        },
        formatter: (params: {
          dataType: string;
          name?: string;
          data?: Record<string, unknown>;
          value?: number;
        }) => {
          if (params.dataType === 'node') {
            const d = params.data as Record<string, unknown> | undefined;
            const hop = d?._hop ?? '?';
            const degree = d?._degree ?? '?';
            const cat = d?._category ?? '';
            return `
              <div style="font-weight:600;font-size:15px;margin-bottom:4px">${params.name}</div>
              <div style="color:#888;font-size:12px">${cat}</div>
              <div style="margin-top:6px;font-size:12px">
                <span style="color:#999">出场强度：</span>${params.value}<br/>
                <span style="color:#999">关联人数：</span>${degree}<br/>
                <span style="color:#999">距${centerName}：</span>${hop} 步
              </div>
              <div style="margin-top:6px;color:#aaa;font-size:11px">点击以此人为中心</div>
            `;
          }
          if (params.dataType === 'edge') {
            const d = params.data as Record<string, unknown> | undefined;
            const rel = d?._relation || '共现';
            const type = d?._type || '';
            const chapters = d?._chapters ?? '?';
            const src = (d?.source as string) || '';
            const tgt = (d?.target as string) || '';
            return `
              <div style="font-weight:600;font-size:14px;margin-bottom:4px">${src} — ${tgt}</div>
              <div style="font-size:12px">
                <span style="color:#999">关系：</span>${rel}<br/>
                ${type ? `<span style="color:#999">类型：</span>${type}<br/>` : ''}
                <span style="color:#999">共现章回：</span>${chapters} 回<br/>
                <span style="color:#999">关联强度：</span>${params.value}
              </div>
            `;
          }
          return '';
        },
      },
      legend: {
        data: categories.map(c => c.name),
        orient: 'vertical' as const,
        right: 16,
        bottom: 16,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 12,
          color: '#555',
          fontFamily: '"Noto Serif SC", serif',
        },
        itemGap: 8,
        backgroundColor: 'rgba(255,255,250,0.8)',
        borderRadius: 8,
        padding: [12, 16],
        borderWidth: 1,
        borderColor: 'rgba(122,147,125,0.2)',
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: chartNodes,
          links: chartEdges,
          categories: categories.map(c => ({
            name: c.name,
            itemStyle: {
              color: CATEGORY_COLORS[c.name] || '#A0A0A0',
            },
          })),
          roam: true,
          draggable: true,
          label: {
            position: 'right',
          },
          force: {
            repulsion: nodes.length > 60 ? 350 : nodes.length > 30 ? 450 : 600,
            gravity: 0.08,
            edgeLength: [40, 200],
            friction: 0.6,
            layoutAnimation: true,
          },
          lineStyle: {
            color: 'source',
          },
          emphasis: {
            focus: 'adjacency' as const,
            lineStyle: {
              width: 4,
              opacity: 0.8,
            },
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          blur: {
            itemStyle: {
              opacity: 0.1,
            },
            lineStyle: {
              opacity: 0.05,
            },
          },
          animationDuration: 800,
          animationEasingUpdate: 'quinticInOut',
        },
      ],
    };
  }, [egoData, centerName]);

  // ── Focus search input when opened ──
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // ── Top characters quick-select ──
  const topChars = fullGraph?.topCharacters.slice(0, 20) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col bg-xiaoxiang-paper/97 backdrop-blur-md"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-xiaoxiang-celadon/20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-serif text-lg sm:text-xl font-bold text-xiaoxiang-ink whitespace-nowrap">
            人物关系图谱
          </h2>
          {egoData && (
            <span className="hidden sm:inline text-xs text-xiaoxiang-bamboo/60 font-serif">
              以「{centerName}」为中心 · {egoData.nodes.length} 人 · {egoData.edges.length} 条关系
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={cn(
              "rounded-full p-2 transition-colors",
              searchOpen
                ? "bg-xiaoxiang-celadon text-white"
                : "text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/10"
            )}
            title="搜索人物"
          >
            <Search size={18} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="rounded-full p-2 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/20 transition-colors"
            title="关闭图谱"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Search Panel ───────────────────────────────────────── */}
      {searchOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b border-xiaoxiang-celadon/20 bg-white/40 backdrop-blur-sm px-4 sm:px-6 py-3 shrink-0"
        >
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xiaoxiang-bamboo/40" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="输入人物名，如：林黛玉、刘姥姥..."
              className="w-full rounded-full border border-xiaoxiang-celadon/30 bg-white/70 pl-9 pr-4 py-2 text-sm text-xiaoxiang-ink font-serif placeholder:text-xiaoxiang-bamboo/30 focus:outline-none focus:border-xiaoxiang-celadon focus:ring-1 focus:ring-xiaoxiang-celadon/30"
            />
          </div>
          {searchSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {searchSuggestions.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectCharacter(s.name)}
                  className="rounded-full border border-xiaoxiang-celadon/30 px-3 py-0.5 text-xs font-serif text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon hover:text-white hover:border-xiaoxiang-celadon transition-colors"
                >
                  {s.name}
                  <span className="ml-1 text-xiaoxiang-bamboo/40">{s.category}</span>
                </button>
              ))}
            </div>
          )}
          {!searchText.trim() && (
            <div className="mt-2">
              <span className="text-[11px] text-xiaoxiang-bamboo/50 font-serif mr-2">热门人物：</span>
              <div className="inline-flex flex-wrap gap-1.5 mt-1">
                {topChars.map(name => (
                  <button
                    key={name}
                    onClick={() => selectCharacter(name)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-serif transition-colors",
                      name === centerName
                        ? "bg-xiaoxiang-celadon text-white border-xiaoxiang-celadon"
                        : "border-xiaoxiang-celadon/30 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/10"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Graph Canvas ───────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-xiaoxiang-celadon">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <p className="font-serif text-sm text-xiaoxiang-bamboo">编织关系网中...</p>
            </div>
          </div>
        ) : egoData ? (
          <ReactECharts
            ref={chartRef}
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={handleChartEvents}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xiaoxiang-rose font-serif">
            无法加载图谱数据
          </div>
        )}

        {/* ── Hop Control (bottom left) ──────────────────────── */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-xiaoxiang-celadon/30 bg-white/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
          <span className="text-[11px] text-xiaoxiang-bamboo/70 font-serif whitespace-nowrap">距离</span>
          <button
            onClick={() => setHops(h => Math.max(1, h - 1))}
            disabled={hops <= 1}
            className="rounded-full p-0.5 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="text-sm font-serif font-medium text-xiaoxiang-ink w-4 text-center">
            {hops}
          </span>
          <button
            onClick={() => setHops(h => Math.min(MAX_HOPS, h + 1))}
            disabled={hops >= MAX_HOPS}
            className="rounded-full p-0.5 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
          </button>
          <span className="text-[11px] text-xiaoxiang-bamboo/40 font-serif">步</span>
        </div>

        {/* ── Stats Panel (bottom center on mobile, left on desktop) ── */}
        {egoData && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:bottom-14 sm:left-4 text-[11px] text-xiaoxiang-bamboo/50 font-serif bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-xiaoxiang-celadon/10">
            以「<span className="font-medium text-xiaoxiang-ink">{centerName}</span>」为中心
            · {hops} 步内 {egoData.nodes.length} 人
            · {egoData.edges.length} 条关系
          </div>
        )}
      </div>
    </motion.div>
  );
}
