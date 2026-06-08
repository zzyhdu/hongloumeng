import type { CharacterId } from '../types/worldTypes';

export function relationshipKey(from: CharacterId, to: CharacterId): string {
  return `${from}:${to}`;
}
