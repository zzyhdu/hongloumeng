import type {
  CharacterId,
  CharacterRuntimeState,
  LocationId,
  LocationRuntimeState,
  WorldData,
  WorldState,
} from '../types/worldTypes';

function createCharacterState(characterId: CharacterId): CharacterRuntimeState {
  return {
    characterId,
    status: 'unknown',
    currentConcerns: [],
    knownFacts: [],
    recentEventIds: [],
  };
}

function createLocationState(locationId: LocationId): LocationRuntimeState {
  return {
    locationId,
    status: 'locked',
    occupants: [],
    activeEventIds: [],
  };
}

export function createInitialWorldState(data: WorldData, chapter = 1): WorldState {
  return {
    chapter,
    era: '未启',
    prosperity: 0,
    characters: Object.fromEntries(
      Object.keys(data.characters).map((characterId) => [characterId, createCharacterState(characterId)])
    ),
    locations: Object.fromEntries(
      Object.keys(data.locations).map((locationId) => [locationId, createLocationState(locationId)])
    ),
    relationships: {},
    activeEvents: [],
  };
}
