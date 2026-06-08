const fs = require('fs');
const path = require('path');

const EVENT_FILES = [
  'chapters-001-020.json',
  'chapters-021-040.json',
  'chapters-041-080.json',
  'chapters-081-120.json',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function unique(values) {
  return Array.from(new Set(values));
}

function relationshipKey(from, to) {
  return `${from}:${to}`;
}

function loadData() {
  const root = path.resolve(__dirname, '..', '..');
  const worldRoot = path.join(root, 'resource', 'world');
  return {
    characters: readJson(path.join(worldRoot, 'entities', 'characters.json')),
    locations: readJson(path.join(worldRoot, 'entities', 'locations.json')),
    map: readJson(path.join(worldRoot, 'maps', 'main.json')),
    events: EVENT_FILES.flatMap((file) => readJson(path.join(worldRoot, 'events', file))).sort(
      (a, b) => a.chapter - b.chapter || (a.scene ?? 0) - (b.scene ?? 0)
    ),
    profiles: fs
      .readdirSync(path.join(worldRoot, 'agent-profiles'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => readJson(path.join(worldRoot, 'agent-profiles', file))),
  };
}

function createInitialState(data, chapter) {
  return {
    chapter,
    era: '未启',
    prosperity: 0,
    characters: Object.fromEntries(
      Object.keys(data.characters).map((characterId) => [
        characterId,
        { characterId, status: 'unknown', currentConcerns: [], knownFacts: [], recentEventIds: [] },
      ])
    ),
    locations: Object.fromEntries(
      Object.keys(data.locations).map((locationId) => [
        locationId,
        { locationId, status: 'locked', occupants: [], activeEventIds: [] },
      ])
    ),
    relationships: {},
    activeEvents: [],
  };
}

function moveCharacter(state, characterId, locationId) {
  const previousLocationId = state.characters[characterId].locationId;
  if (previousLocationId) {
    state.locations[previousLocationId].occupants = state.locations[previousLocationId].occupants.filter(
      (id) => id !== characterId
    );
  }
  state.characters[characterId].locationId = locationId;
  state.locations[locationId].occupants = unique([...state.locations[locationId].occupants, characterId]);
}

function applyEvent(state, event) {
  for (const effect of event.effects) {
    switch (effect.type) {
      case 'move_character':
        moveCharacter(state, effect.characterId, effect.locationId);
        break;
      case 'set_era':
        state.era = effect.era;
        break;
      case 'set_character_status':
        state.characters[effect.characterId].status = effect.status;
        break;
      case 'set_character_health':
        state.characters[effect.characterId].health = clamp(effect.health, 0, 100);
        break;
      case 'set_character_mood':
        state.characters[effect.characterId].mood = effect.mood;
        break;
      case 'set_character_concerns':
        state.characters[effect.characterId].currentConcerns = effect.concerns;
        break;
      case 'add_known_fact':
        state.characters[effect.characterId].knownFacts = unique([
          ...state.characters[effect.characterId].knownFacts,
          effect.fact,
        ]);
        break;
      case 'set_location_status':
        state.locations[effect.locationId].status = effect.status;
        break;
      case 'set_location_note':
        state.locations[effect.locationId].note = effect.note;
        break;
      case 'relationship_delta': {
        const key = relationshipKey(effect.from, effect.to);
        const relationship = (state.relationships[key] ??= {
          from: effect.from,
          to: effect.to,
          affinity: 0,
          trust: 0,
          tension: 0,
          notes: [],
        });
        relationship.affinity = clamp(relationship.affinity + (effect.affinity ?? 0), -100, 100);
        relationship.trust = clamp(relationship.trust + (effect.trust ?? 0), -100, 100);
        relationship.tension = clamp(relationship.tension + (effect.tension ?? 0), -100, 100);
        if (effect.note) relationship.notes.push(effect.note);
        break;
      }
      case 'set_prosperity':
        state.prosperity = clamp(effect.value, 0, 100);
        break;
      case 'prosperity_delta':
        state.prosperity = clamp(state.prosperity + effect.value, 0, 100);
        break;
      default:
        throw new Error(`Unknown world effect type: ${effect.type}`);
    }
  }

  state.activeEvents.push(event);
  for (const characterId of event.characterIds ?? []) {
    state.characters[characterId].recentEventIds = unique([
      ...state.characters[characterId].recentEventIds,
      event.id,
    ]).slice(-8);
  }
  for (const locationId of event.locationIds ?? []) {
    state.locations[locationId].activeEventIds = unique([...state.locations[locationId].activeEventIds, event.id]).slice(
      -8
    );
  }
  return state;
}

function computeState(data, chapter) {
  return data.events.filter((event) => event.chapter <= chapter).reduce(applyEvent, createInitialState(data, chapter));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function verifyReferences(data) {
  for (const node of data.map.nodes) {
    assert(data.locations[node.locationId], `Map node references missing location: ${node.locationId}`);
  }

  for (const mapPath of data.map.paths) {
    assert(data.locations[mapPath.from], `Map path references missing from location: ${mapPath.from}`);
    assert(data.locations[mapPath.to], `Map path references missing to location: ${mapPath.to}`);
  }

  for (const event of data.events) {
    for (const locationId of event.locationIds ?? []) {
      assert(data.locations[locationId], `${event.id} references missing location: ${locationId}`);
    }
    for (const characterId of event.characterIds ?? []) {
      assert(data.characters[characterId], `${event.id} references missing character: ${characterId}`);
    }
    for (const effect of event.effects) {
      if ('characterId' in effect) {
        assert(data.characters[effect.characterId], `${event.id} effect references missing character: ${effect.characterId}`);
      }
      if ('locationId' in effect) {
        assert(data.locations[effect.locationId], `${event.id} effect references missing location: ${effect.locationId}`);
      }
      if ('from' in effect) {
        assert(data.characters[effect.from], `${event.id} relationship references missing from character: ${effect.from}`);
      }
      if ('to' in effect) {
        assert(data.characters[effect.to], `${event.id} relationship references missing to character: ${effect.to}`);
      }
    }
  }

  for (const profile of data.profiles) {
    assert(data.characters[profile.characterId], `Agent profile references missing character: ${profile.characterId}`);
  }
}

function verifyWorldStates(data) {
  const chapter3 = computeState(data, 3);
  assert(chapter3.characters.daiyu.locationId === 'bisha', 'Chapter 3 should place Daiyu in Bisha');
  assert(chapter3.locations.daguanyuan.status === 'locked', 'Chapter 3 should keep Daguanyuan locked');

  const chapter23 = computeState(data, 23);
  assert(chapter23.characters.baoyu.locationId === 'yihong', 'Chapter 23 should place Baoyu in Yihong');
  assert(chapter23.characters.daiyu.locationId === 'xiaoxiang', 'Chapter 23 should place Daiyu in Xiaoxiang');
  assert(chapter23.locations.daguanyuan.status === 'active', 'Chapter 23 should activate Daguanyuan');

  const chapter74 = computeState(data, 74);
  assert(chapter74.locations.yihong.status === 'searched', 'Chapter 74 should mark Yihong as searched');
  assert(chapter74.locations.daguanyuan.status === 'searched', 'Chapter 74 should mark Daguanyuan as searched');
  assert(chapter74.prosperity < chapter23.prosperity, 'Chapter 74 prosperity should be lower than Chapter 23');

  const chapter98 = computeState(data, 98);
  assert(chapter98.characters.daiyu.status === 'deceased', 'Chapter 98 should mark Daiyu deceased');
  assert(chapter98.locations.xiaoxiang.status === 'abandoned', 'Chapter 98 should abandon Xiaoxiang');

  const chapter120 = computeState(data, 120);
  assert(chapter120.characters.baoyu.locationId === 'outside', 'Chapter 120 should move Baoyu outside');
  assert(chapter120.prosperity === 0, 'Chapter 120 prosperity should be zero');
}

const data = loadData();
verifyReferences(data);
verifyWorldStates(data);

console.log(
  JSON.stringify(
    {
      characters: Object.keys(data.characters).length,
      locations: Object.keys(data.locations).length,
      mapNodes: data.map.nodes.length,
      events: data.events.length,
      profiles: data.profiles.length,
      verifiedChapters: [3, 23, 74, 98, 120],
    },
    null,
    2
  )
);
