import type { WorldData, WorldEvent } from '../types/worldTypes';

interface EventPanelProps {
  data: WorldData;
  event: WorldEvent;
}

export function EventPanel({ data, event }: EventPanelProps) {
  const characters = (event.characterIds ?? []).map((id) => data.characters[id]).filter(Boolean);
  const locations = (event.locationIds ?? []).map((id) => data.locations[id]).filter(Boolean);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-5 py-5">
      <div>
        <div className="font-serif text-xs text-xiaoxiang-bamboo/50">第 {event.chapter} 回</div>
        <h2 className="mt-1 font-serif text-xl font-semibold text-xiaoxiang-ink">{event.title}</h2>
        <p className="mt-3 text-sm leading-7 text-xiaoxiang-bamboo/80">{event.summary}</p>
      </div>

      {locations.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">地点</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {locations.map((location) => (
              <span
                key={location.id}
                className="rounded-full border border-xiaoxiang-celadon/20 px-2.5 py-1 text-xs text-xiaoxiang-bamboo"
              >
                {location.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {characters.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">人物</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {characters.map((character) => (
              <span
                key={character.id}
                className="rounded-full border border-xiaoxiang-celadon/20 px-2.5 py-1 text-xs text-xiaoxiang-bamboo"
              >
                {character.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {event.refs && event.refs.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">原文锚点</h3>
          <div className="mt-2 space-y-2">
            {event.refs.map((ref, index) => (
              <div key={`${ref.versionId}-${ref.chapterId}-${index}`} className="border-l border-xiaoxiang-celadon/30 pl-3">
                <div className="text-[11px] text-xiaoxiang-bamboo/45">
                  {ref.versionId} / 第 {Number(ref.chapterId)} 回
                </div>
                {ref.quote && <div className="mt-1 font-serif text-sm text-xiaoxiang-bamboo">“{ref.quote}”</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
