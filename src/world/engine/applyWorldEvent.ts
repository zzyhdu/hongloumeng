import { relationshipKey } from './relationshipKey';
import type {
  CharacterId,
  CharacterRuntimeState,
  LocationId,
  LocationRuntimeState,
  RelationshipState,
  WorldEffect,
  WorldEvent,
  WorldState,
} from '../types/worldTypes';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function ensureCharacter(state: WorldState, characterId: CharacterId): CharacterRuntimeState {
  return (
    state.characters[characterId] ?? {
      characterId,
      status: 'unknown',
      currentConcerns: [],
      knownFacts: [],
      recentEventIds: [],
    }
  );
}

function ensureLocation(state: WorldState, locationId: LocationId): LocationRuntimeState {
  return (
    state.locations[locationId] ?? {
      locationId,
      status: 'locked',
      occupants: [],
      activeEventIds: [],
    }
  );
}

function updateCharacter(
  state: WorldState,
  characterId: CharacterId,
  updater: (character: CharacterRuntimeState) => CharacterRuntimeState
): WorldState {
  return {
    ...state,
    characters: {
      ...state.characters,
      [characterId]: updater(ensureCharacter(state, characterId)),
    },
  };
}

function updateLocation(
  state: WorldState,
  locationId: LocationId,
  updater: (location: LocationRuntimeState) => LocationRuntimeState
): WorldState {
  return {
    ...state,
    locations: {
      ...state.locations,
      [locationId]: updater(ensureLocation(state, locationId)),
    },
  };
}

function removeOccupant(state: WorldState, locationId: LocationId | undefined, characterId: CharacterId): WorldState {
  if (!locationId) return state;
  return updateLocation(state, locationId, (location) => ({
    ...location,
    occupants: location.occupants.filter((id) => id !== characterId),
  }));
}

function moveCharacter(state: WorldState, characterId: CharacterId, locationId: LocationId): WorldState {
  const current = ensureCharacter(state, characterId);
  const withoutPrevious = removeOccupant(state, current.locationId, characterId);
  const withCharacter = updateCharacter(withoutPrevious, characterId, (character) => ({
    ...character,
    locationId,
  }));

  return updateLocation(withCharacter, locationId, (location) => ({
    ...location,
    occupants: unique([...location.occupants, characterId]),
  }));
}

function updateRelationship(
  state: WorldState,
  from: CharacterId,
  to: CharacterId,
  updater: (relationship: RelationshipState) => RelationshipState
): WorldState {
  const key = relationshipKey(from, to);
  const existing =
    state.relationships[key] ??
    ({
      from,
      to,
      affinity: 0,
      trust: 0,
      tension: 0,
      notes: [],
    } satisfies RelationshipState);

  return {
    ...state,
    relationships: {
      ...state.relationships,
      [key]: updater(existing),
    },
  };
}

function applyEffect(state: WorldState, effect: WorldEffect): WorldState {
  switch (effect.type) {
    case 'move_character':
      return moveCharacter(state, effect.characterId, effect.locationId);

    case 'set_era':
      return { ...state, era: effect.era };

    case 'set_character_status':
      return updateCharacter(state, effect.characterId, (character) => ({
        ...character,
        status: effect.status,
      }));

    case 'set_character_health':
      return updateCharacter(state, effect.characterId, (character) => ({
        ...character,
        health: clamp(effect.health, 0, 100),
      }));

    case 'set_character_mood':
      return updateCharacter(state, effect.characterId, (character) => ({
        ...character,
        mood: effect.mood,
      }));

    case 'set_character_concerns':
      return updateCharacter(state, effect.characterId, (character) => ({
        ...character,
        currentConcerns: effect.concerns,
      }));

    case 'add_known_fact':
      return updateCharacter(state, effect.characterId, (character) => ({
        ...character,
        knownFacts: unique([...character.knownFacts, effect.fact]),
      }));

    case 'set_location_status':
      return updateLocation(state, effect.locationId, (location) => ({
        ...location,
        status: effect.status,
      }));

    case 'set_location_note':
      return updateLocation(state, effect.locationId, (location) => ({
        ...location,
        note: effect.note,
      }));

    case 'relationship_delta':
      return updateRelationship(state, effect.from, effect.to, (relationship) => ({
        ...relationship,
        affinity: clamp(relationship.affinity + (effect.affinity ?? 0), -100, 100),
        trust: clamp(relationship.trust + (effect.trust ?? 0), -100, 100),
        tension: clamp(relationship.tension + (effect.tension ?? 0), -100, 100),
        notes: effect.note ? [...relationship.notes, effect.note] : relationship.notes,
      }));

    case 'set_prosperity':
      return { ...state, prosperity: clamp(effect.value, 0, 100) };

    case 'prosperity_delta':
      return { ...state, prosperity: clamp(state.prosperity + effect.value, 0, 100) };
  }
}

function attachEventToState(state: WorldState, event: WorldEvent): WorldState {
  let nextState: WorldState = {
    ...state,
    activeEvents: [...state.activeEvents, event],
  };

  for (const characterId of event.characterIds ?? []) {
    nextState = updateCharacter(nextState, characterId, (character) => ({
      ...character,
      recentEventIds: unique([...character.recentEventIds, event.id]).slice(-8),
    }));
  }

  for (const locationId of event.locationIds ?? []) {
    nextState = updateLocation(nextState, locationId, (location) => ({
      ...location,
      activeEventIds: unique([...location.activeEventIds, event.id]).slice(-8),
    }));
  }

  return nextState;
}

export function applyWorldEvent(state: WorldState, event: WorldEvent): WorldState {
  const withEffects = event.effects.reduce(applyEffect, state);
  return attachEventToState(withEffects, event);
}
