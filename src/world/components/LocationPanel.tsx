import { locationStatusText } from './statusText';
import { getLocationEvents } from '../engine/worldSelectors';
import type { LocationId, WorldData, WorldState } from '../types/worldTypes';

interface LocationPanelProps {
  data: WorldData;
  state: WorldState;
  locationId: LocationId;
  onSelectCharacter: (characterId: string) => void;
  onSelectEvent: (eventId: string) => void;
}

export function LocationPanel({ data, state, locationId, onSelectCharacter, onSelectEvent }: LocationPanelProps) {
  const location = data.locations[locationId];
  const runtime = state.locations[locationId];
  const parent = location?.parentId ? data.locations[location.parentId] : undefined;
  const occupants = (runtime?.occupants ?? []).map((id) => data.characters[id]).filter(Boolean);
  const events = getLocationEvents(data, state, locationId).slice(-6).reverse();

  if (!location || !runtime) {
    return <div className="px-5 py-5 text-sm text-xiaoxiang-bamboo/60">地点不存在</div>;
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-5 py-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-xiaoxiang-ink">{location.name}</h2>
            {parent && <div className="mt-1 text-xs text-xiaoxiang-bamboo/50">隶属：{parent.name}</div>}
          </div>
          <span className="rounded-full border border-xiaoxiang-celadon/30 px-2.5 py-1 text-xs text-xiaoxiang-bamboo">
            {locationStatusText(runtime.status)}
          </span>
        </div>
        {location.description && <p className="mt-3 text-sm leading-7 text-xiaoxiang-bamboo/80">{location.description}</p>}
        {runtime.note && (
          <p className="mt-3 border-l border-xiaoxiang-celadon/30 pl-3 font-serif text-sm leading-7 text-xiaoxiang-bamboo">
            {runtime.note}
          </p>
        )}
      </div>

      <section>
        <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">当前人物</h3>
        {occupants.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {occupants.map((character) => (
              <button
                key={character.id}
                onClick={() => onSelectCharacter(character.id)}
                className="rounded-md border border-xiaoxiang-celadon/15 bg-white/35 px-3 py-2 text-left transition-colors hover:bg-xiaoxiang-celadon/10"
              >
                <div className="font-serif text-sm text-xiaoxiang-ink">{character.name}</div>
                <div className="mt-0.5 text-[11px] text-xiaoxiang-bamboo/45">{character.faction ?? '未记录'}</div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-xiaoxiang-bamboo/50">此时无人定位于此。</p>
        )}
      </section>

      {events.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">地点事件</h3>
          <div className="mt-2 space-y-2">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                className="w-full rounded-md border border-xiaoxiang-celadon/15 bg-white/35 px-3 py-2 text-left transition-colors hover:bg-xiaoxiang-celadon/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-sm text-xiaoxiang-ink">{event.title}</span>
                  <span className="text-[11px] text-xiaoxiang-bamboo/45">第 {event.chapter} 回</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-xiaoxiang-bamboo/60">{event.summary}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
