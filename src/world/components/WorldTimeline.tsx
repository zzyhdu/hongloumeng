import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WorldTimelineProps {
  chapter: number;
  chapterTitle?: string;
  onChapterChange: (chapter: number) => void;
}

const MARKS = [
  { chapter: 3, label: '入府' },
  { chapter: 23, label: '入园' },
  { chapter: 37, label: '诗社' },
  { chapter: 74, label: '抄检' },
  { chapter: 98, label: '情断' },
  { chapter: 120, label: '归结' },
];

function clampChapter(chapter: number): number {
  return Math.max(1, Math.min(120, chapter));
}

export function WorldTimeline({ chapter, chapterTitle, onChapterChange }: WorldTimelineProps) {
  const setChapter = (nextChapter: number) => onChapterChange(clampChapter(nextChapter));

  return (
    <div className="border-b border-xiaoxiang-celadon/15 bg-white/55 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setChapter(chapter - 1)}
            disabled={chapter <= 1}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-xiaoxiang-celadon/25 text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 disabled:opacity-30"
            title="上一回"
          >
            <ChevronLeft size={17} />
          </button>
          <div className="min-w-[92px] text-center">
            <div className="font-serif text-base font-semibold text-xiaoxiang-ink">第 {chapter} 回</div>
            {chapterTitle && (
              <div className="max-w-[22rem] truncate text-xs text-xiaoxiang-bamboo/50">{chapterTitle}</div>
            )}
          </div>
          <button
            onClick={() => setChapter(chapter + 1)}
            disabled={chapter >= 120}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-xiaoxiang-celadon/25 text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 disabled:opacity-30"
            title="下一回"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={1}
            max={120}
            value={chapter}
            onChange={(event) => setChapter(Number(event.target.value))}
            className="honglou-world-range w-full"
            aria-label="章回时间轴"
          />
          <div className="mt-1 grid grid-cols-6 gap-1 text-center">
            {MARKS.map((mark) => (
              <button
                key={mark.chapter}
                onClick={() => setChapter(mark.chapter)}
                className={cn(
                  'truncate rounded-full px-2 py-0.5 text-[10px] font-serif transition-colors',
                  chapter >= mark.chapter
                    ? 'bg-xiaoxiang-celadon/10 text-xiaoxiang-bamboo'
                    : 'text-xiaoxiang-bamboo/35 hover:bg-xiaoxiang-celadon/5'
                )}
                title={`第 ${mark.chapter} 回`}
              >
                {mark.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
