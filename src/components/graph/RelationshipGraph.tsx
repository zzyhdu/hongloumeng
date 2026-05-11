import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { X } from 'lucide-react';

interface GraphData {
  nodes: { id: string; name: string; value: number; symbolSize?: number }[];
  edges: { source: string; target: string; value: number }[];
}

interface RelationshipGraphProps {
  onClose: () => void;
  resourceBase: string;
}

export function RelationshipGraph({ onClose, resourceBase }: RelationshipGraphProps) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${resourceBase}/character_graph.json`)
      .then((res) => res.json())
      .then((json: GraphData) => {
        // Adjust node sizes based on value (frequency)
        const processedNodes = json.nodes.map(node => ({
          ...node,
          symbolSize: Math.max(20, Math.min(80, Math.sqrt(node.value) * 3)),
          category: 0 // All in one category for now
        }));
        
        setData({
          nodes: processedNodes,
          edges: json.edges
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load graph data', err);
        setLoading(false);
      });
  }, [resourceBase]);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}'
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: data?.nodes || [],
        links: data?.edges || [],
        roam: true,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          color: '#2a3b32', // xiaoxiang-ink
          fontFamily: 'serif'
        },
        force: {
          repulsion: 300,
          edgeLength: [50, 200]
        },
        lineStyle: {
          color: '#90b4a1', // xiaoxiang-celadon
          opacity: 0.5,
          width: 1,
          curveness: 0.3
        },
        itemStyle: {
          color: '#e4ebe6', // xiaoxiang-celadon/10 roughly
          borderColor: '#90b4a1',
          borderWidth: 2
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 3
          }
        }
      }
    ]
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-xiaoxiang-paper/95 backdrop-blur-sm p-4 sm:p-8">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="font-serif text-2xl font-bold text-xiaoxiang-ink">大观园人物交互网络</h2>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-xiaoxiang-bamboo hover:bg-xiaoxiang-celadon/20 transition-colors"
          title="关闭图谱"
        >
          <X size={24} />
        </button>
      </div>
      
      <div className="flex-1 rounded-2xl border border-xiaoxiang-celadon/30 bg-white/50 shadow-inner overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-xiaoxiang-celadon">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <p className="font-serif text-sm text-xiaoxiang-bamboo">编织关系网中...</p>
            </div>
          </div>
        ) : data ? (
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xiaoxiang-rose font-serif">
            无法加载图谱数据
          </div>
        )}
      </div>
    </div>
  );
}
