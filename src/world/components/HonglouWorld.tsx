import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Map, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { loadWorldData } from '../data/loadWorldData';
import { computeWorldState } from '../engine/computeWorldState';
import { WorldInspector } from './WorldInspector';
import { WorldMap } from './WorldMap';
import { WorldTimeline } from './WorldTimeline';
import type { InspectorSelection, WorldData } from '../types/worldTypes';

interface HonglouWorldProps {
  chapterId: string | null;
  chapterTitle?: string;
  resourceBase: string;
  onClose: () => void;
}

function parseChapterId(chapterId: string | null): number {
  if (!chapterId) return 1;
  const parsed = Number.parseInt(chapterId, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(120, parsed)) : 1;
}

export function HonglouWorld({ chapterId, chapterTitle, resourceBase, onClose }: HonglouWorldProps) {
  const [data, setData] = useState<WorldData | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [chapter, setChapter] = useState(() => parseChapterId(chapterId));
  const [selection, setSelection] = useState<InspectorSelection>({ type: 'none' });

  useEffect(() => {
    setChapter(parseChapterId(chapterId));
  }, [chapterId]);

  useEffect(() => {
    let active = true;
    loadWorldData(resourceBase)
      .then((worldData) => {
        if (!active) return;
        setData(worldData);
        setLoadingError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadingError(error instanceof Error ? error.message : '加载红楼世界失败');
      });

    return () => {
      active = false;
    };
  }, [resourceBase]);

  const state = useMemo(() => (data ? computeWorldState(data, chapter) : null), [data, chapter]);
  const latestEvents = state ? state.activeEvents.slice(-5).reverse() : [];
  const titleForTimeline = chapter === parseChapterId(chapterId) ? chapterTitle : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-xiaoxiang-paper text-xiaoxiang-ink"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-xiaoxiang-celadon/20 bg-xiaoxiang-paper/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Map className="h-5 w-5 shrink-0 text-xiaoxiang-celadon" />
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-semibold tracking-widest text-xiaoxiang-ink">红楼世界</h1>
            {state && (
              <div className="truncate text-xs text-xiaoxiang-bamboo/50">
                {state.era} · 气数 {state.prosperity}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-xiaoxiang-celadon/25 text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 hover:text-xiaoxiang-ink"
          title="关闭红楼世界"
        >
          <X size={18} />
        </button>
      </header>

      {loadingError && (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <div className="font-serif text-lg text-xiaoxiang-rose">红楼世界加载失败</div>
            <p className="mt-2 text-sm text-xiaoxiang-bamboo/60">{loadingError}</p>
          </div>
        </div>
      )}

      {!data || !state ? (
        !loadingError && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-xiaoxiang-celadon/25 border-t-xiaoxiang-celadon" />
              <span className="font-serif text-sm text-xiaoxiang-bamboo/50">载入红楼世界</span>
            </div>
          </div>
        )
      ) : (
        <>
          <WorldTimeline chapter={chapter} chapterTitle={titleForTimeline} onChapterChange={setChapter} />

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <main className="min-h-0 flex-1">
              <WorldMap data={data} state={state} selection={selection} onSelect={setSelection} />
            </main>
            <WorldInspector data={data} state={state} selection={selection} onSelect={setSelection} />
          </div>

          <div className="shrink-0 border-t border-xiaoxiang-celadon/15 bg-white/50 px-3 py-2 backdrop-blur">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {latestEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelection({ type: 'event', eventId: event.id })}
                  className={cn(
                    'shrink-0 rounded-md border px-3 py-2 text-left transition-colors',
                    selection.type === 'event' && selection.eventId === event.id
                      ? 'border-xiaoxiang-celadon bg-xiaoxiang-celadon/10'
                      : 'border-xiaoxiang-celadon/15 bg-white/40 hover:bg-xiaoxiang-celadon/10'
                  )}
                >
                  <div className="font-serif text-xs font-semibold text-xiaoxiang-ink">{event.title}</div>
                  <div className="mt-0.5 max-w-[18rem] truncate text-[11px] text-xiaoxiang-bamboo/50">
                    第 {event.chapter} 回 · {event.summary}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
