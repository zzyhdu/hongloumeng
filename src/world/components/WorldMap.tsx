import { useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, WheelEvent } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import bztMapImage from '../../../downloads/sdmz_hldgy/images/bzt.gif';
import type {
  CharacterId,
  InspectorSelection,
  LocationId,
  LocationRuntimeState,
  LocationStatus,
  MapNode,
  WorldData,
  WorldState,
} from '../types/worldTypes';
import { characterStatusText, locationStatusText } from './statusText';

interface WorldMapProps {
  data: WorldData;
  state: WorldState;
  selection: InspectorSelection;
  onSelect: (selection: InspectorSelection) => void;
}

const STATUS_STYLE: Record<LocationStatus, { fill: string; stroke: string; opacity: number; dash?: string }> = {
  locked: { fill: 'rgba(170,170,160,0.08)', stroke: 'rgba(120,120,110,0.22)', opacity: 0.48, dash: '7 6' },
  building: { fill: 'rgba(190,170,120,0.10)', stroke: 'rgba(155,125,62,0.45)', opacity: 0.75, dash: '8 5' },
  active: { fill: 'rgba(122,147,125,0.12)', stroke: 'rgba(122,147,125,0.62)', opacity: 1 },
  festive: { fill: 'rgba(212,175,55,0.18)', stroke: 'rgba(178,134,22,0.72)', opacity: 1 },
  tense: { fill: 'rgba(180,55,48,0.10)', stroke: 'rgba(180,55,48,0.66)', opacity: 1 },
  searched: { fill: 'rgba(180,55,48,0.08)', stroke: 'rgba(180,55,48,0.78)', opacity: 1, dash: '6 3' },
  abandoned: { fill: 'rgba(90,90,84,0.07)', stroke: 'rgba(90,90,84,0.30)', opacity: 0.62 },
};

const CHARACTER_COLORS = [
  '#8B6F8B',
  '#B0443E',
  '#7A937D',
  '#B8892F',
  '#596A93',
  '#7A6048',
  '#3F7F7F',
  '#9A6A7A',
];

const STRUCTURE_LOCATION_IDS = new Set(['ningrong_street', 'rongfu', 'ningfu', 'daguanyuan']);
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3.2;
const ZOOM_STEP = 1.22;

interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

function isSelectedLocation(selection: InspectorSelection, locationId: LocationId): boolean {
  return selection.type === 'location' && selection.locationId === locationId;
}

function isSelectedCharacter(selection: InspectorSelection, characterId: CharacterId): boolean {
  return selection.type === 'character' && selection.characterId === characterId;
}

function isVisibleOccupant(state: WorldState, characterId: CharacterId): boolean {
  const character = state.characters[characterId];
  if (!character) return false;
  return character.status !== 'unknown' && character.status !== 'deceased' && character.status !== 'away';
}

function getNodeStatus(state: WorldState, node: MapNode): LocationRuntimeState {
  return (
    state.locations[node.locationId] ?? {
      locationId: node.locationId,
      status: 'locked',
      occupants: [],
      activeEventIds: [],
    }
  );
}

function pathData(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')}`;
}

function getNodeLabelLines(node: MapNode, fallback: string): string[] {
  return (node.label ?? fallback)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: clientX, y: clientY };
  const svgPoint = point.matrixTransform(matrix.inverse());
  return { x: svgPoint.x, y: svgPoint.y };
}

function zoomAroundPoint(transform: ViewTransform, targetScale: number, center: { x: number; y: number }): ViewTransform {
  const scale = clamp(targetScale, MIN_ZOOM, MAX_ZOOM);
  const ratio = scale / transform.scale;

  return {
    scale,
    x: center.x - (center.x - transform.x) * ratio,
    y: center.y - (center.y - transform.y) * ratio,
  };
}

function MapImageBase({ width, height }: { width: number; height: number }) {
  return (
    <image
      href={bztMapImage}
      x="0"
      y="0"
      width={width}
      height={height}
      preserveAspectRatio="none"
      className="pointer-events-none"
    />
  );
}

export function WorldMap({ data, state, selection, onSelect }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const isDragging = Boolean(dragState);

  const zoomFromCenter = (direction: 'in' | 'out') => {
    const svg = svgRef.current;
    const center = svg ? { x: data.map.width / 2, y: data.map.height / 2 } : { x: 0, y: 0 };
    const factor = direction === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP;
    setViewTransform((current) => zoomAroundPoint(current, current.scale * factor, center));
  };

  const resetView = () => {
    setViewTransform({ scale: 1, x: 0, y: 0 });
    setDragState(null);
  };

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const center = getSvgPoint(svg, event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setViewTransform((current) => zoomAroundPoint(current, current.scale * factor, center));
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('[data-map-clickable="true"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: viewTransform.x,
      startY: viewTransform.y,
    });
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const viewScaleX = data.map.width / rect.width;
    const viewScaleY = data.map.height / rect.height;
    setViewTransform((current) => ({
      ...current,
      x: dragState.startX + (event.clientX - dragState.startClientX) * viewScaleX,
      y: dragState.startY + (event.clientY - dragState.startClientY) * viewScaleY,
    }));
  };

  const handlePointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  };

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden bg-xiaoxiang-paper">
      <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-md border border-xiaoxiang-celadon/25 bg-xiaoxiang-paper/90 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomFromCenter('out')}
          className="flex h-9 w-9 items-center justify-center text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 hover:text-xiaoxiang-ink"
          title="缩小地图"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="flex h-9 w-9 items-center justify-center border-x border-xiaoxiang-celadon/20 text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 hover:text-xiaoxiang-ink"
          title="重置地图"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={() => zoomFromCenter('in')}
          className="flex h-9 w-9 items-center justify-center text-xiaoxiang-bamboo transition-colors hover:bg-xiaoxiang-celadon/10 hover:text-xiaoxiang-ink"
          title="放大地图"
        >
          <Plus size={16} />
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${data.map.width} ${data.map.height}`}
        className={cn('h-full w-full touch-none select-none', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
        role="img"
        aria-label="红楼世界地图"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <defs>
          <pattern id="honglou-map-paper" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 31.5H32M31.5 0V32" stroke="rgba(122,147,125,0.06)" strokeWidth="1" />
          </pattern>
          <filter id="honglou-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3A2E25" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect width={data.map.width} height={data.map.height} fill="url(#honglou-map-paper)" />
        <g transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
          <MapImageBase width={data.map.width} height={data.map.height} />

          <g transform="translate(38 38)" className="pointer-events-none">
            <circle cx="0" cy="0" r="22" fill="rgba(249,248,244,0.82)" stroke="rgba(122,147,125,0.28)" />
            <path d="M0 -14 L5 2 L0 -1 L-5 2 Z" fill="rgba(122,147,125,0.9)" />
            <text
              x="0"
              y="37"
              textAnchor="middle"
              className="fill-xiaoxiang-bamboo font-serif"
              style={{ fontSize: 12 }}
            >
              北
            </text>
          </g>

          <g fill="none" stroke="rgba(58,46,37,0.14)" strokeLinecap="round" strokeLinejoin="round">
            {data.map.paths.map((mapPath) => (
              <path key={mapPath.id} d={pathData(mapPath.points)} strokeWidth="3" strokeDasharray="8 7" />
            ))}
          </g>

          {data.map.nodes.map((node) => {
          const location = data.locations[node.locationId];
          const runtime = getNodeStatus(state, node);
          const style = STATUS_STYLE[runtime.status];
          const selected = isSelectedLocation(selection, node.locationId);
          const occupants = runtime.occupants.filter((characterId) => isVisibleOccupant(state, characterId));
          const visibleOccupants = occupants.slice(0, 4);
          const hiddenCount = Math.max(0, occupants.length - visibleOccupants.length);
          const labelAnchor = node.labelAnchor ?? { x: node.x + node.w / 2, y: node.y + node.h / 2 };
          const characterAnchor = node.characterAnchor ?? { x: node.x + node.w / 2, y: node.y };
          const labelLines = getNodeLabelLines(node, location?.name ?? node.locationId);
          const labelFontSize = STRUCTURE_LOCATION_IDS.has(node.locationId) ? 18 : 15;
          const labelLineHeight = labelFontSize + (labelFontSize > 15 ? 4 : 3);
          const firstLabelY = labelAnchor.y - ((labelLines.length - 1) * labelLineHeight) / 2;
          const statusY = labelAnchor.y + ((labelLines.length - 1) * labelLineHeight) / 2 + (node.w > 500 ? 24 : 18);

          return (
            <g key={node.locationId} data-map-clickable="true">
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={STRUCTURE_LOCATION_IDS.has(node.locationId) ? 0 : 4}
                fill={STRUCTURE_LOCATION_IDS.has(node.locationId) ? 'rgba(255,255,255,0.02)' : style.fill}
                stroke={selected ? '#111111' : style.stroke}
                strokeWidth={selected ? 3 : 1.5}
                strokeDasharray={style.dash}
                opacity={STRUCTURE_LOCATION_IDS.has(node.locationId) ? Math.max(0.28, style.opacity * 0.46) : style.opacity}
                filter={runtime.status === 'festive' || selected ? 'url(#honglou-map-shadow)' : undefined}
                className="cursor-pointer transition-all"
                onClick={() => onSelect({ type: 'location', locationId: node.locationId })}
              />

              <text
                x={labelAnchor.x}
                y={labelAnchor.y}
                textAnchor="middle"
                className={cn('pointer-events-none fill-xiaoxiang-ink font-serif', selected && 'font-semibold')}
                style={{ fontSize: labelFontSize }}
              >
                {labelLines.map((line, index) => (
                  <tspan key={`${node.locationId}-label-${index}`} x={labelAnchor.x} y={firstLabelY + index * labelLineHeight}>
                    {line}
                  </tspan>
                ))}
              </text>
              {runtime.status !== 'active' && (
                <text
                  x={labelAnchor.x}
                  y={statusY}
                  textAnchor="middle"
                  className="pointer-events-none fill-xiaoxiang-bamboo/50 font-serif"
                  style={{ fontSize: 11 }}
                >
                  {locationStatusText(runtime.status)}
                </text>
              )}

              <g>
                {visibleOccupants.map((characterId, index) => {
                  const character = data.characters[characterId];
                  const runtimeCharacter = state.characters[characterId];
                  const radius = 15;
                  const spacing = 30;
                  const x = characterAnchor.x - ((visibleOccupants.length - 1) * spacing) / 2 + index * spacing;
                  const y = characterAnchor.y;
                  const selectedCharacter = isSelectedCharacter(selection, characterId);

                  return (
                    <g
                      key={`${node.locationId}-${characterId}`}
                      className="cursor-pointer"
                      onClick={(event: MouseEvent<SVGGElement>) => {
                        event.stopPropagation();
                        onSelect({ type: 'character', characterId });
                      }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={selectedCharacter ? radius + 3 : radius}
                        fill={CHARACTER_COLORS[index % CHARACTER_COLORS.length]}
                        stroke={selectedCharacter ? '#111111' : 'rgba(249,248,244,0.92)'}
                        strokeWidth={selectedCharacter ? 2.5 : 2}
                        filter="url(#honglou-map-shadow)"
                      />
                      <text
                        x={x}
                        y={y + 5}
                        textAnchor="middle"
                        className="pointer-events-none fill-white font-serif font-bold"
                        style={{ fontSize: 13 }}
                      >
                        {character?.shortName ?? characterId.slice(0, 1)}
                      </text>
                      <title>
                        {character?.name ?? characterId}
                        {runtimeCharacter?.mood ? ` · ${runtimeCharacter.mood}` : ''}
                        {runtimeCharacter?.status ? ` · ${characterStatusText(runtimeCharacter.status)}` : ''}
                      </title>
                    </g>
                  );
                })}
                {hiddenCount > 0 && (
                  <g
                    className="cursor-pointer"
                    onClick={(event: MouseEvent<SVGGElement>) => {
                      event.stopPropagation();
                      onSelect({ type: 'location', locationId: node.locationId });
                    }}
                  >
                    <circle
                      cx={characterAnchor.x + ((visibleOccupants.length + 1) * 30) / 2}
                      cy={characterAnchor.y}
                      r="13"
                      fill="rgba(58,46,37,0.68)"
                      stroke="rgba(249,248,244,0.9)"
                      strokeWidth="2"
                    />
                    <text
                      x={characterAnchor.x + ((visibleOccupants.length + 1) * 30) / 2}
                      y={characterAnchor.y + 4}
                      textAnchor="middle"
                      className="pointer-events-none fill-white font-serif"
                      style={{ fontSize: 11 }}
                    >
                      +{hiddenCount}
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
          })}
        </g>
      </svg>
    </div>
  );
}
