import type { AgentProfile } from '../types/agentTypes';
import type { Character, Location, WorldData, WorldEvent, WorldMapFile } from '../types/worldTypes';

const EVENT_FILES = [
  'chapters-001-020.json',
  'chapters-021-040.json',
  'chapters-041-080.json',
  'chapters-081-120.json',
] as const;

const AGENT_PROFILE_IDS = ['daiyu', 'baoyu', 'baochai', 'xifeng'] as const;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load world data: ${path} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function joinResourcePath(resourceBase: string, path: string): string {
  return `${resourceBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function sortEvents(events: WorldEvent[]): WorldEvent[] {
  return [...events].sort((a, b) => {
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return (a.scene ?? 0) - (b.scene ?? 0);
  });
}

export async function loadWorldData(resourceBase = './resource'): Promise<WorldData> {
  const worldBase = joinResourcePath(resourceBase, 'world');

  const [characters, locations, map, ...eventGroups] = await Promise.all([
    fetchJson<Record<string, Character>>(`${worldBase}/entities/characters.json`),
    fetchJson<Record<string, Location>>(`${worldBase}/entities/locations.json`),
    fetchJson<WorldMapFile>(`${worldBase}/maps/main.json`),
    ...EVENT_FILES.map((file) => fetchJson<WorldEvent[]>(`${worldBase}/events/${file}`)),
  ]);

  return {
    characters,
    locations,
    map,
    events: sortEvents(eventGroups.flat()),
  };
}

export async function loadAgentProfiles(resourceBase = './resource'): Promise<Record<string, AgentProfile>> {
  const worldBase = joinResourcePath(resourceBase, 'world');
  const profiles = await Promise.all(
    AGENT_PROFILE_IDS.map((id) => fetchJson<AgentProfile>(`${worldBase}/agent-profiles/${id}.json`))
  );

  return Object.fromEntries(profiles.map((profile) => [profile.characterId, profile]));
}
