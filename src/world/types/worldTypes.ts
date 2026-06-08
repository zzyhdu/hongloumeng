export type ChapterId = string;
export type CharacterId = string;
export type LocationId = string;
export type WorldEventId = string;
export type MapPathId = string;

export interface TextRef {
  versionId: string;
  chapterId: ChapterId;
  blockIndex?: number;
  quote?: string;
}

export interface Character {
  id: CharacterId;
  name: string;
  shortName: string;
  aliases?: string[];
  faction?: string;
  firstChapter?: number;
  fate?: string;
  description?: string;
}

export type LocationKind =
  | 'street'
  | 'mansion'
  | 'hall'
  | 'courtyard'
  | 'garden'
  | 'room'
  | 'temple'
  | 'outside';

export interface Location {
  id: LocationId;
  name: string;
  kind: LocationKind;
  parentId?: LocationId;
  unlockChapter?: number;
  description?: string;
}

export interface WorldMapFile {
  id: string;
  name: string;
  width: number;
  height: number;
  nodes: MapNode[];
  paths: MapPath[];
}

export interface MapNode {
  locationId: LocationId;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  labelAnchor?: Point;
  characterAnchor?: Point;
}

export interface Point {
  x: number;
  y: number;
}

export interface MapPath {
  id: MapPathId;
  from: LocationId;
  to: LocationId;
  points: Array<[number, number]>;
}

export interface WorldEvent {
  id: WorldEventId;
  chapter: number;
  scene?: number;
  title: string;
  summary: string;
  locationIds?: LocationId[];
  characterIds?: CharacterId[];
  refs?: TextRef[];
  effects: WorldEffect[];
}

export type WorldEffect =
  | { type: 'move_character'; characterId: CharacterId; locationId: LocationId }
  | { type: 'set_era'; era: string }
  | { type: 'set_character_status'; characterId: CharacterId; status: CharacterStatus }
  | { type: 'set_character_health'; characterId: CharacterId; health: number }
  | { type: 'set_character_mood'; characterId: CharacterId; mood: string }
  | { type: 'set_character_concerns'; characterId: CharacterId; concerns: string[] }
  | { type: 'add_known_fact'; characterId: CharacterId; fact: string }
  | { type: 'set_location_status'; locationId: LocationId; status: LocationStatus }
  | { type: 'set_location_note'; locationId: LocationId; note: string }
  | {
      type: 'relationship_delta';
      from: CharacterId;
      to: CharacterId;
      affinity?: number;
      trust?: number;
      tension?: number;
      note?: string;
    }
  | { type: 'set_prosperity'; value: number }
  | { type: 'prosperity_delta'; value: number };

export interface WorldData {
  characters: Record<CharacterId, Character>;
  locations: Record<LocationId, Location>;
  map: WorldMapFile;
  events: WorldEvent[];
}

export interface WorldState {
  chapter: number;
  era: string;
  prosperity: number;
  characters: Record<CharacterId, CharacterRuntimeState>;
  locations: Record<LocationId, LocationRuntimeState>;
  relationships: Record<string, RelationshipState>;
  activeEvents: WorldEvent[];
}

export type CharacterStatus =
  | 'unknown'
  | 'active'
  | 'ill'
  | 'away'
  | 'deceased'
  | 'exiled'
  | 'married_out';

export interface CharacterRuntimeState {
  characterId: CharacterId;
  locationId?: LocationId;
  status: CharacterStatus;
  health?: number;
  mood?: string;
  currentConcerns: string[];
  knownFacts: string[];
  recentEventIds: WorldEventId[];
}

export type LocationStatus =
  | 'locked'
  | 'building'
  | 'active'
  | 'festive'
  | 'tense'
  | 'searched'
  | 'abandoned';

export interface LocationRuntimeState {
  locationId: LocationId;
  status: LocationStatus;
  occupants: CharacterId[];
  activeEventIds: WorldEventId[];
  note?: string;
}

export interface RelationshipState {
  from: CharacterId;
  to: CharacterId;
  affinity: number;
  trust: number;
  tension: number;
  notes: string[];
}

export type InspectorSelection =
  | { type: 'none' }
  | { type: 'character'; characterId: CharacterId }
  | { type: 'location'; locationId: LocationId }
  | { type: 'event'; eventId: WorldEventId };
