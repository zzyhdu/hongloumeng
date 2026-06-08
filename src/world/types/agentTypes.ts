import type {
  Character,
  CharacterRuntimeState,
  Location,
  LocationRuntimeState,
  RelationshipState,
  TextRef,
  WorldEvent,
} from './worldTypes';

export interface AgentProfile {
  characterId: string;
  persona: string;
  speechStyle: string;
  values: string[];
  taboos: string[];
  boundaries: string[];
}

export interface AgentContext {
  mode: 'canon';
  chapter: number;
  character: Character;
  runtime: CharacterRuntimeState;
  location?: Location;
  locationState?: LocationRuntimeState;
  relationships: RelationshipState[];
  recentEvents: WorldEvent[];
  knownFacts: string[];
  textRefs: TextRef[];
  userMessage: string;
}

export interface AgentReply {
  speech: string;
  emotion?: string;
  suggestedAction?: AgentSuggestedAction;
  safetyNotes?: string[];
}

export type AgentSuggestedAction =
  | { type: 'stay' }
  | { type: 'mention_event'; eventId: string }
  | { type: 'ask_question' };

export interface CharacterAgentClient {
  reply(context: AgentContext): Promise<AgentReply>;
}
