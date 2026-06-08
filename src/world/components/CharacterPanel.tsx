import { characterStatusText } from './statusText';
import { getCharacterEvents, getLocation, getOutgoingRelationships } from '../engine/worldSelectors';
import type { CharacterId, WorldData, WorldState } from '../types/worldTypes';

interface CharacterPanelProps {
  data: WorldData;
  state: WorldState;
  characterId: CharacterId;
  onSelectEvent: (eventId: string) => void;
}

function healthText(health?: number): string {
  if (health === undefined) return '未记录';
  if (health >= 80) return `${health} / 康健`;
  if (health >= 55) return `${health} / 偏弱`;
  if (health > 0) return `${health} / 病重`;
  return '0 / 已尽';
}

export function CharacterPanel({ data, state, characterId, onSelectEvent }: CharacterPanelProps) {
  const character = data.characters[characterId];
  const runtime = state.characters[characterId];
  const location = runtime?.locationId ? getLocation(data, runtime.locationId) : undefined;
  const relationships = getOutgoingRelationships(state, characterId).slice(-5).reverse();
  const recentEvents = getCharacterEvents(data, state, characterId).slice(-5).reverse();

  if (!character || !runtime) {
    return <div className="px-5 py-5 text-sm text-xiaoxiang-bamboo/60">人物不存在</div>;
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-5 py-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-xiaoxiang-ink">{character.name}</h2>
            <div className="mt-1 text-xs text-xiaoxiang-bamboo/50">{character.aliases?.join(' · ')}</div>
          </div>
          <span className="rounded-full border border-xiaoxiang-celadon/30 px-2.5 py-1 text-xs text-xiaoxiang-bamboo">
            {characterStatusText(runtime.status)}
          </span>
        </div>
        {character.description && <p className="mt-3 text-sm leading-7 text-xiaoxiang-bamboo/80">{character.description}</p>}
      </div>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-xiaoxiang-celadon/15 bg-white/45 px-3 py-2">
          <div className="text-[11px] text-xiaoxiang-bamboo/45">位置</div>
          <div className="mt-1 font-serif text-sm text-xiaoxiang-ink">{location?.name ?? '未定位'}</div>
        </div>
        <div className="rounded-md border border-xiaoxiang-celadon/15 bg-white/45 px-3 py-2">
          <div className="text-[11px] text-xiaoxiang-bamboo/45">身体</div>
          <div className="mt-1 font-serif text-sm text-xiaoxiang-ink">{healthText(runtime.health)}</div>
        </div>
        <div className="rounded-md border border-xiaoxiang-celadon/15 bg-white/45 px-3 py-2">
          <div className="text-[11px] text-xiaoxiang-bamboo/45">心境</div>
          <div className="mt-1 font-serif text-sm text-xiaoxiang-ink">{runtime.mood ?? '未记录'}</div>
        </div>
        <div className="rounded-md border border-xiaoxiang-celadon/15 bg-white/45 px-3 py-2">
          <div className="text-[11px] text-xiaoxiang-bamboo/45">阵营</div>
          <div className="mt-1 font-serif text-sm text-xiaoxiang-ink">{character.faction ?? '未记录'}</div>
        </div>
      </section>

      {runtime.currentConcerns.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">当前关切</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {runtime.currentConcerns.map((concern) => (
              <span key={concern} className="rounded-full bg-xiaoxiang-celadon/10 px-2.5 py-1 text-xs text-xiaoxiang-bamboo">
                {concern}
              </span>
            ))}
          </div>
        </section>
      )}

      {runtime.knownFacts.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">已知事实</h3>
          <div className="mt-2 space-y-2">
            {runtime.knownFacts.slice(-4).map((fact) => (
              <p key={fact} className="border-l border-xiaoxiang-celadon/25 pl-3 text-xs leading-6 text-xiaoxiang-bamboo/75">
                {fact}
              </p>
            ))}
          </div>
        </section>
      )}

      {relationships.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">关系</h3>
          <div className="mt-2 space-y-2">
            {relationships.map((relationship) => {
              const target = data.characters[relationship.to];
              return (
                <div key={`${relationship.from}-${relationship.to}`} className="rounded-md border border-xiaoxiang-celadon/15 bg-white/35 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-sm text-xiaoxiang-ink">{target?.name ?? relationship.to}</span>
                    <span className="text-[11px] text-xiaoxiang-bamboo/45">
                      情 {relationship.affinity} · 信 {relationship.trust} · 隙 {relationship.tension}
                    </span>
                  </div>
                  {relationship.notes.length > 0 && (
                    <p className="mt-1 text-xs leading-5 text-xiaoxiang-bamboo/60">
                      {relationship.notes[relationship.notes.length - 1]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {recentEvents.length > 0 && (
        <section>
          <h3 className="font-serif text-xs font-semibold tracking-widest text-xiaoxiang-bamboo/45">近期事件</h3>
          <div className="mt-2 space-y-2">
            {recentEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                className="w-full rounded-md border border-xiaoxiang-celadon/15 bg-white/35 px-3 py-2 text-left transition-colors hover:bg-xiaoxiang-celadon/10"
              >
                <div className="font-serif text-sm text-xiaoxiang-ink">{event.title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-xiaoxiang-bamboo/60">{event.summary}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
