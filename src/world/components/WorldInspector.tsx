import { CharacterPanel } from './CharacterPanel';
import { EventPanel } from './EventPanel';
import { LocationPanel } from './LocationPanel';
import type { InspectorSelection, WorldData, WorldState } from '../types/worldTypes';

interface WorldInspectorProps {
  data: WorldData;
  state: WorldState;
  selection: InspectorSelection;
  onSelect: (selection: InspectorSelection) => void;
}

export function WorldInspector({ data, state, selection, onSelect }: WorldInspectorProps) {
  const latestEvent = state.activeEvents[state.activeEvents.length - 1];

  return (
    <aside className="h-full min-h-[280px] border-t border-xiaoxiang-celadon/15 bg-white/50 backdrop-blur lg:w-[390px] lg:border-l lg:border-t-0">
      {selection.type === 'character' && (
        <CharacterPanel
          data={data}
          state={state}
          characterId={selection.characterId}
          onSelectEvent={(eventId) => onSelect({ type: 'event', eventId })}
        />
      )}
      {selection.type === 'location' && (
        <LocationPanel
          data={data}
          state={state}
          locationId={selection.locationId}
          onSelectCharacter={(characterId) => onSelect({ type: 'character', characterId })}
          onSelectEvent={(eventId) => onSelect({ type: 'event', eventId })}
        />
      )}
      {selection.type === 'event' && (
        <EventPanel
          data={data}
          event={data.events.find((event) => event.id === selection.eventId) ?? latestEvent ?? data.events[0]}
        />
      )}
      {selection.type === 'none' && latestEvent && <EventPanel data={data} event={latestEvent} />}
    </aside>
  );
}
