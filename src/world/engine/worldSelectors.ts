import { relationshipKey } from './relationshipKey';
import type {
  Character,
  CharacterId,
  Location,
  LocationId,
  RelationshipState,
  WorldData,
  WorldEvent,
  WorldEventId,
  WorldState,
} from '../types/worldTypes';

export function getCharacter(data: WorldData, characterId: CharacterId): Character | undefined {
  return data.characters[characterId];
}

export function getLocation(data: WorldData, locationId: LocationId): Location | undefined {
  return data.locations[locationId];
}

export function getWorldEvent(data: WorldData, eventId: WorldEventId): WorldEvent | undefined {
  return data.events.find((event) => event.id === eventId);
}

export function getCharacterEvents(data: WorldData, state: WorldState, characterId: CharacterId): WorldEvent[] {
  const eventIds = state.characters[characterId]?.recentEventIds ?? [];
  return eventIds.map((eventId) => getWorldEvent(data, eventId)).filter((event): event is WorldEvent => Boolean(event));
}

export function getLocationEvents(data: WorldData, state: WorldState, locationId: LocationId): WorldEvent[] {
  const eventIds = state.locations[locationId]?.activeEventIds ?? [];
  return eventIds.map((eventId) => getWorldEvent(data, eventId)).filter((event): event is WorldEvent => Boolean(event));
}

export function getOutgoingRelationships(state: WorldState, characterId: CharacterId): RelationshipState[] {
  return Object.values(state.relationships).filter((relationship) => relationship.from === characterId);
}

export function getRelationship(
  state: WorldState,
  from: CharacterId,
  to: CharacterId
): RelationshipState | undefined {
  return state.relationships[relationshipKey(from, to)];
}
