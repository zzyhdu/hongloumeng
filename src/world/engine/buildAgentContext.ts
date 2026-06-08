import { getCharacterEvents, getLocation, getOutgoingRelationships } from './worldSelectors';
import type { AgentContext } from '../types/agentTypes';
import type { CharacterId, WorldData, WorldState } from '../types/worldTypes';

export function buildAgentContext(
  data: WorldData,
  state: WorldState,
  characterId: CharacterId,
  userMessage: string
): AgentContext | null {
  const character = data.characters[characterId];
  const runtime = state.characters[characterId];
  if (!character || !runtime) return null;

  const location = runtime.locationId ? getLocation(data, runtime.locationId) : undefined;
  const locationState = runtime.locationId ? state.locations[runtime.locationId] : undefined;
  const recentEvents = getCharacterEvents(data, state, characterId);

  return {
    mode: 'canon',
    chapter: state.chapter,
    character,
    runtime,
    location,
    locationState,
    relationships: getOutgoingRelationships(state, characterId),
    recentEvents,
    knownFacts: runtime.knownFacts,
    textRefs: recentEvents.flatMap((event) => event.refs ?? []),
    userMessage,
  };
}
