# Honglou World V1

## 概述

Honglou World V1 的目标是把现有《红楼梦》阅读器扩展成一个由小说章回驱动的互动世界：用户切到第 N 回时，地图、人物位置、人物状态、地点开放状态、家族气数和可对话上下文都进入第 N 回对应状态。

V1 不是开放世界游戏，也不是让用户改写剧情的模拟器。V1 的核心价值是：

- 让读者看见“这一回的红楼世界是什么状态”。
- 让读者追踪人物在章回进展中的位置、情绪、身体、关系和命运变化。
- 让角色 agent 在正典状态边界内进行对话和解释，帮助理解当时角色的处境。

## 产品目标

- 提供一个独立的“红楼世界”全屏入口。
- 支持按章回驱动世界状态，范围覆盖第 1-120 回。
- 提供可点击的 2D 地图，展示荣宁二府和大观园的地点状态。
- 提供角色详情面板，展示角色当前位置、身体、情绪、关切、关系、已知事实和相关事件。
- 支持选择少量核心角色进行 agent 对话。
- 保证 agent 不直接修改正典世界状态，不泄露当前章回之后的剧情。

## 非目标

- 不做 3D 开放世界。
- 不做战斗、经营、任务、养成系统。
- 不允许用户改变小说主线。
- 不做全 120 回逐场景剧场回放。
- 不在 V1 引入复杂寻路、碰撞、真实地形比例。
- 不让 agent 自行决定正典事实，例如人物是否死亡、地点是否开放、某人是否知道后文信息。

## V1 用户流程

### 从阅读器进入

用户在阅读器读到某一章，点击 Header 中的“红楼世界”入口：

- 打开全屏 Honglou World。
- 当前章回继承阅读器的 `currentChapterId`。
- 世界状态自动计算到该章回。
- 地图显示该章回的地点状态和人物分布。

### 时间轴探索

用户拖动章回时间轴：

- 当前章回变更。
- 世界状态重新计算。
- 地图状态、人物状态、事件列表、角色对话上下文同步变化。
- 如果已经选中某个角色，角色面板保留选中对象并展示该角色在新章回的状态。

### 地图探索

用户点击地图地点：

- 右侧 inspector 切换到地点详情。
- 展示地点名称、层级、当前状态、住客、当前事件、历史事件摘要。
- 未开放地点显示“未建”“营建中”或“未启用”等状态，不允许进入二级视图。

### 角色探索

用户点击人物气泡：

- 右侧 inspector 切换到角色详情。
- 展示角色当前状态、所处地点、情绪、身体、近期事件、当前关切、关系摘要。
- 如果该角色支持 agent 对话，显示对话输入框。

### Agent 对话

用户向角色提问：

- 系统根据当前章回、角色状态、地点状态、关系状态、已知事实、相关原文片段构造 agent 上下文。
- Agent 只能以该角色在该章回可能知道的范围回应。
- Agent 输出只作为对话内容和轻量意图，不直接改写世界状态。

## 总体架构

```
resource/world/entities/*.json
resource/world/maps/*.json
resource/world/events/*.json
resource/world/agent-profiles/*.json
            │
            ▼
src/world/data/loadWorldData.ts
            │
            ▼
src/world/engine/computeWorldState.ts
            │
            ├─ world state
            │
            ├─ character runtime state
            │
            ├─ location runtime state
            │
            └─ agent context
            │
            ▼
src/world/components/HonglouWorld.tsx
            │
            ├─ WorldTimeline
            ├─ WorldMap
            ├─ WorldInspector
            └─ CharacterChat
```

系统分三层：

| 层级 | 职责 |
|------|------|
| 数据层 | 定义人物、地点、地图、事件、角色 profile |
| 引擎层 | 根据章回和事件流计算当前世界状态 |
| 表现层 | 渲染地图、时间轴、详情面板、agent 对话 |

## 数据目录规划

新增资源目录：

```
resource/world/
  entities/
    characters.json
    locations.json
  maps/
    main.json
  events/
    chapters-001-020.json
    chapters-021-040.json
    chapters-041-080.json
    chapters-081-120.json
  agent-profiles/
    daiyu.json
    baoyu.json
    baochai.json
    xifeng.json
```

新增前端目录：

```
src/world/
  types/
    worldTypes.ts
    agentTypes.ts
  data/
    loadWorldData.ts
  engine/
    createInitialWorldState.ts
    applyWorldEvent.ts
    computeWorldState.ts
    buildAgentContext.ts
    worldSelectors.ts
  components/
    HonglouWorld.tsx
    WorldTimeline.tsx
    WorldMap.tsx
    WorldInspector.tsx
    CharacterPanel.tsx
    LocationPanel.tsx
    EventPanel.tsx
    CharacterChat.tsx
```

## 核心数据模型

### 人物静态档案

```ts
export interface Character {
  id: string;
  name: string;
  shortName: string;
  aliases?: string[];
  faction?: string;
  firstChapter?: number;
  fate?: string;
}
```

### 地点静态档案

```ts
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
  id: string;
  name: string;
  kind: LocationKind;
  parentId?: string;
  unlockChapter?: number;
  description?: string;
}
```

### 地图节点

地图使用 2D 语义地图，不追求真实比例。坐标只服务于阅读理解、点击交互和场景回放。

```ts
export interface WorldMapFile {
  id: string;
  name: string;
  width: number;
  height: number;
  nodes: MapNode[];
  paths: MapPath[];
}

export interface MapNode {
  locationId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  labelAnchor?: { x: number; y: number };
  characterAnchor?: { x: number; y: number };
}

export interface MapPath {
  id: string;
  from: string;
  to: string;
  points: Array<[number, number]>;
}
```

### 世界事件

世界状态以事件流计算。事件是正典事实的最小变更单位。

```ts
export interface WorldEvent {
  id: string;
  chapter: number;
  scene?: number;
  title: string;
  summary: string;
  locationIds?: string[];
  characterIds?: string[];
  refs?: TextRef[];
  effects: WorldEffect[];
}

export interface TextRef {
  versionId: string;
  chapterId: string;
  blockIndex?: number;
  quote?: string;
}
```

V1 支持的 effect：

```ts
export type WorldEffect =
  | { type: 'move_character'; characterId: string; locationId: string }
  | { type: 'set_era'; era: string }
  | { type: 'set_character_status'; characterId: string; status: CharacterStatus }
  | { type: 'set_character_health'; characterId: string; health: number }
  | { type: 'set_character_mood'; characterId: string; mood: string }
  | { type: 'set_character_concerns'; characterId: string; concerns: string[] }
  | { type: 'add_known_fact'; characterId: string; fact: string }
  | { type: 'set_location_status'; locationId: string; status: LocationStatus }
  | { type: 'set_location_note'; locationId: string; note: string }
  | { type: 'relationship_delta'; from: string; to: string; affinity?: number; trust?: number; tension?: number; note?: string }
  | { type: 'set_prosperity'; value: number }
  | { type: 'prosperity_delta'; value: number };
```

### 运行时世界状态

```ts
export interface WorldState {
  chapter: number;
  era: string;
  prosperity: number;
  characters: Record<string, CharacterRuntimeState>;
  locations: Record<string, LocationRuntimeState>;
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
  characterId: string;
  locationId?: string;
  status: CharacterStatus;
  health?: number;
  mood?: string;
  currentConcerns: string[];
  knownFacts: string[];
  recentEventIds: string[];
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
  locationId: string;
  status: LocationStatus;
  occupants: string[];
  activeEventIds: string[];
  note?: string;
}

export interface RelationshipState {
  from: string;
  to: string;
  affinity: number;
  trust: number;
  tension: number;
  notes: string[];
}
```

## 状态引擎规则

世界状态必须由章回输入计算得到：

```ts
export function computeWorldState(
  data: WorldData,
  chapter: number,
  scene?: number
): WorldState {
  let state = createInitialWorldState(data);

  for (const event of data.events) {
    if (event.chapter > chapter) break;
    if (event.chapter === chapter && scene && event.scene && event.scene > scene) break;
    state = applyWorldEvent(state, event);
  }

  return state;
}
```

规则：

- `computeWorldState` 必须是纯函数。
- 事件按 `chapter`、`scene`、原始数组顺序应用。
- 世界状态不能在 UI 组件中手写。
- agent 响应不能直接修改 `WorldState`。
- 后续如果支持沙盒推演，必须使用独立的 `SimulationState`，不能污染正典状态。

## 地图方案

V1 使用 React + SVG 实现 2D 语义地图。

地图层级：

```
宁荣街
  ├─ 宁国府
  └─ 荣国府
       ├─ 荣庆堂
       ├─ 荣禧堂
       ├─ 贾赦院
       ├─ 碧纱橱
       └─ 大观园
            ├─ 怡红院
            ├─ 潇湘馆
            ├─ 蘅芜苑
            ├─ 秋爽斋
            ├─ 稻香村
            ├─ 栊翠庵
            └─ 紫菱洲
```

V1 只做一张总地图，不做多层室内地图。地点以节点块、院落轮廓、路径线和文字标签表示。

地点状态视觉规则：

| 状态 | 视觉 |
|------|------|
| `locked` | 灰色、低透明度、显示未开放 |
| `building` | 灰色虚线、显示营建中 |
| `active` | 正常墨色或青绿色边框 |
| `festive` | 金色边框或微弱光晕 |
| `tense` | 红色边框 |
| `searched` | 红色虚线 |
| `abandoned` | 低饱和、低透明度 |

人物显示规则：

- 人物以气泡挂在地点的 `characterAnchor` 附近。
- 同一地点最多直接显示 4 个核心人物，其余用 `+N` 聚合。
- 点击气泡选中人物。
- 点击聚合标记打开该地点住客列表。

## Agent 设计

V1 agent 是角色状态解释器，不是剧情控制器。

### 支持角色

第一版只支持 4 个角色：

- 林黛玉
- 贾宝玉
- 薛宝钗
- 王熙凤

其他角色只展示状态，不开放对话。

### 角色 profile

```ts
export interface AgentProfile {
  characterId: string;
  persona: string;
  speechStyle: string;
  values: string[];
  taboos: string[];
  boundaries: string[];
}
```

### Agent 上下文

```ts
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
```

上下文构造原则：

- 只提供当前章回及之前的事件。
- 只提供该角色可能知道的事实。
- 可以提供少量相关原文片段，但不提供后文。
- 对 deceased、away、married_out 等状态要限制可对话性。

### Agent 输出

```ts
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
```

规则：

- `speech` 是唯一直接展示给用户的文本。
- `suggestedAction` 只能作为 UI 提示或后续扩展输入。
- Agent 不允许输出 `move_character`、`set_character_status` 等世界 effect。
- 如果用户要求后文剧透，agent 应以角色视角回避。
- 如果用户要求现代分析，agent 可以提示“这不是我此时能知晓之事”，但系统可在后续加入“旁白分析模式”。V1 不做旁白分析模式。

### Agent 接入边界

V1 前端先通过 adapter 调用 agent：

```ts
export interface CharacterAgentClient {
  reply(context: AgentContext): Promise<AgentReply>;
}
```

实现可以分两步：

1. `MockCharacterAgentClient`：本地模板回复，用于无 API key 时开发和测试。
2. `OpenAICharacterAgentClient`：接入真实模型，用环境变量控制启用。

如果 V1 暂不接后端，真实 agent 调用可以先不落地，但数据结构、上下文构造和 UI 边界必须按真实 agent 设计。

## V1 数据范围

V1 的数据分两级。

### 粗粒度覆盖

用阶段事件覆盖第 1-120 回，保证任意章回都有世界状态：

| 章回 | 阶段 |
|------|------|
| 1-3 | 黛玉入府前后 |
| 4-16 | 贾府初盛、秦可卿丧事 |
| 17-22 | 大观园落成、元妃省亲 |
| 23-36 | 众人入住、宝黛情愫、宝玉挨打 |
| 37-54 | 诗社与宴饮，极盛阶段 |
| 55-69 | 理家、尤氏姊妹事件，暗流阶段 |
| 70-80 | 抄检大观园，风雨阶段 |
| 81-97 | 后四十回衰败前段 |
| 98-110 | 黛玉亡、宝钗婚、贾府被抄 |
| 111-120 | 败落收束 |

### 精细章回样本

先精做 5 个关键章回：

| 章回 | 内容 | V1 用途 |
|------|------|---------|
| 3 | 黛玉入府、宝黛初会 | 地图移动、黛玉 agent 初始样本 |
| 17-18 | 大观园试才、省亲 | 地点开放、盛事状态 |
| 23 | 众人入住大观园 | 人物位置迁移 |
| 27 | 黛玉葬花 | 黛玉状态与 agent 重点样本 |
| 74 | 抄检大观园 | 地点状态变化、紧张事件 |

## 页面布局

全屏 Honglou World 布局：

```
┌───────────────────────────────────────────────┐
│ Header: 返回阅读器 | 当前回目 | 世界模式       │
├───────────────────────────────────────────────┤
│ Timeline: 1 ───────────────────────── 120      │
├───────────────────────────────┬───────────────┤
│                               │ Inspector     │
│           WorldMap             │               │
│                               │ Character /   │
│                               │ Location /    │
│                               │ Event / Chat  │
├───────────────────────────────┴───────────────┤
│ Event strip: 当前章回关键事件                   │
└───────────────────────────────────────────────┘
```

移动端 V1：

- 地图占主视图。
- Inspector 从底部抽屉打开。
- 时间轴保持在顶部或底部。

## 文件改动计划

新增：

| 文件 | 用途 |
|------|------|
| `src/world/types/worldTypes.ts` | 世界实体、事件、状态类型 |
| `src/world/types/agentTypes.ts` | agent profile、context、reply 类型 |
| `src/world/data/loadWorldData.ts` | 加载 world JSON |
| `src/world/engine/createInitialWorldState.ts` | 创建初始状态 |
| `src/world/engine/applyWorldEvent.ts` | 应用事件 effect |
| `src/world/engine/computeWorldState.ts` | 按章回计算世界状态 |
| `src/world/engine/buildAgentContext.ts` | 构造角色 agent 上下文 |
| `src/world/components/HonglouWorld.tsx` | 全屏红楼世界入口 |
| `src/world/components/WorldTimeline.tsx` | 章回时间轴 |
| `src/world/components/WorldMap.tsx` | SVG 地图 |
| `src/world/components/WorldInspector.tsx` | 右侧详情容器 |
| `src/world/components/CharacterPanel.tsx` | 角色详情 |
| `src/world/components/LocationPanel.tsx` | 地点详情 |
| `src/world/components/CharacterChat.tsx` | agent 对话 UI |
| `resource/world/entities/characters.json` | 人物档案 |
| `resource/world/entities/locations.json` | 地点档案 |
| `resource/world/maps/main.json` | 总地图 |
| `resource/world/events/*.json` | 事件流 |
| `resource/world/agent-profiles/*.json` | agent profile |

修改：

| 文件 | 修改点 |
|------|--------|
| `src/App.tsx` | 管理 Honglou World 全屏开关和当前章回传入 |
| `src/components/layout/Header.tsx` | 增加“红楼世界”入口 |
| `src/index.css` | 增加地图、时间轴、inspector、chat 基础样式 |

## 开发里程碑

### Milestone 1: 文档与类型

- 完成 V1 规格文档。
- 新增 world 和 agent 类型。
- 不接 UI，不改主应用行为。

验收：

- TypeScript 类型能表达人物、地点、地图、事件、状态和 agent 上下文。

### Milestone 2: 最小数据集

- 新增核心人物数据。
- 新增核心地点数据。
- 新增总地图数据。
- 新增覆盖 1-120 回的粗粒度事件。
- 新增第 3、27、74 回的精细事件样本。

验收：

- 数据能加载。
- 任意 1-120 章都能计算出非空世界状态。

### Milestone 3: 状态引擎

- 实现 `computeWorldState`。
- 实现 effect 应用。
- 添加基础单元测试或脚本验证。

验收：

- 第 3 回：黛玉位于荣国府相关地点，宝黛初会事件可见。
- 第 23 回：大观园核心地点开放，主要人物迁入。
- 第 74 回：怡红院、秋爽斋等地点进入抄检或紧张状态。
- 第 98 回后：黛玉状态不再可对话，世界气数明显下降。

### Milestone 4: 地图 UI

- 实现全屏 Honglou World。
- 实现时间轴。
- 实现 SVG 地图。
- 实现地点和人物点击。
- 实现 inspector。

验收：

- 从阅读器可打开红楼世界。
- 拖动时间轴时地图状态变化。
- 点击人物和地点可查看详情。
- 桌面端布局不遮挡，移动端可用。

### Milestone 5: Agent 原型

- 实现 `buildAgentContext`。
- 实现 mock agent。
- 接入 4 个核心角色的对话 UI。
- 如果环境允许，再接真实 agent client。

验收：

- 第 27 回点击黛玉，可以围绕葬花、寄人篱下、宝玉误会等状态对话。
- 第 74 回点击王熙凤，可以围绕抄检、管家压力、府中风气对话。
- 角色不会透露后文。
- 角色不会改变世界状态。

## 验收标准

- `npm run build` 通过。
- 打开红楼世界不影响现有阅读器、搜索、关系图功能。
- 任意章回都能显示世界状态。
- 地图至少包含宁国府、荣国府、荣庆堂、荣禧堂、贾赦院、碧纱橱、大观园、怡红院、潇湘馆、蘅芜苑、秋爽斋、稻香村、栊翠庵、紫菱洲。
- 第 3、23、27、74 回有可观察的状态差异。
- 支持黛玉、宝玉、宝钗、王熙凤 4 个角色的 agent 面板。
- Agent 对话使用当前章回状态构造上下文。
- Agent 不泄露当前章回之后的剧情。
- Agent 不直接产生世界状态变更。

## 风险与约束

- 红楼地理存在文学空间和版本差异，V1 地图应明确是“语义地图”，不声称真实复原。
- 人物是否知道某个事实需要谨慎建模。V1 先用 `knownFacts` 明确列出，不做自动推理。
- 后四十回与前八十回存在版本争议。V1 可以标记数据来源和版本，不在 UI 中展开版本争议。
- Agent 容易产生幻觉。必须用上下文边界、系统约束和输出 schema 限制。
- 数据补全成本高。V1 先用粗粒度覆盖和少量精细章回验证系统结构。

## 后续扩展

- 章节级事件补全到 120 回。
- 增加剧场回放模式。
- 增加角色时间线和关系曲线。
- 增加地点记忆，例如潇湘馆的事件史。
- 增加“旁白分析模式”，区别于角色 agent。
- 增加沙盒推演模式，但必须与正典模式隔离。
