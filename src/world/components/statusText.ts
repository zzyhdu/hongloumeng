import type { CharacterStatus, LocationStatus } from '../types/worldTypes';

export function locationStatusText(status: LocationStatus): string {
  switch (status) {
    case 'locked':
      return '未开放';
    case 'building':
      return '营建中';
    case 'active':
      return '活跃';
    case 'festive':
      return '盛事';
    case 'tense':
      return '紧张';
    case 'searched':
      return '抄检';
    case 'abandoned':
      return '荒废';
  }
}

export function characterStatusText(status: CharacterStatus): string {
  switch (status) {
    case 'unknown':
      return '未登场';
    case 'active':
      return '在场';
    case 'ill':
      return '抱恙';
    case 'away':
      return '离府';
    case 'deceased':
      return '已逝';
    case 'exiled':
      return '被逐';
    case 'married_out':
      return '出嫁';
  }
}
