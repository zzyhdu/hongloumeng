import { applyWorldEvent } from './applyWorldEvent';
import { createInitialWorldState } from './createInitialWorldState';
import type { WorldData, WorldEvent, WorldState } from '../types/worldTypes';

function shouldApplyEvent(event: WorldEvent, chapter: number, scene?: number): boolean {
  if (event.chapter < chapter) return true;
  if (event.chapter > chapter) return false;
  if (scene === undefined) return true;
  return (event.scene ?? 0) <= scene;
}

export function computeWorldState(data: WorldData, chapter: number, scene?: number): WorldState {
  const initialState = createInitialWorldState(data, chapter);
  const events = data.events.filter((event) => shouldApplyEvent(event, chapter, scene));

  return events.reduce(applyWorldEvent, initialState);
}
