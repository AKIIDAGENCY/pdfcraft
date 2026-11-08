import { useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from 'd3-force';
import { api } from '../../lib/api';
import { useAsync } from '../../hooks/useAsync';
import { roleLabel } from '../../lib/format';
import ErrorState from '../common/ErrorState';
import type { Defendant, DefendantRole, NetworkLink } from '../../../shared/types';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: 'defendant' | 'entity';
  label: string;
  role?: DefendantRole;
  custodyStatus?: Defendant['custodyStatus'];
}
interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

const ROLE_COLOR: Record<DefendantRole, string> = {
  principal: '#c81e1e',
  accomplice: '#b5690b',
  instigator: '#7a1fa2',
  legal_entity: '#0b5d3b',
};

const WIDTH = 900;
const HEIGHT = 560;

export default function NetworkGraph({ caseId }: { caseId: string }) {
  const { data: bundle, loading, error, reload } = useAsync(async () => {
    const [defendants, entities, links, entityLinks] = await Promise.all([
      api.defendants.listByCase(caseId),
      api.entities.listByCase(caseId),
      api.network.listByCase(caseId),
      api.entities.listDefendantLinks(caseId),
    ]);
    return { defendants, entities, links, entityLinks } as {
      defendants: Defendant[];
      entities: { id: string; name: string }[];
      links: NetworkLink[];
      entityLinks: { defendantId: string; entityId: string; roleInEntity: string | null }[];
    };
  }, [caseId]);

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [layoutComputing, setLayoutComputing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focusEntitiesOnly, setFocusEntitiesOnly] = useState(false);
  const nodesRef = useRef<GraphNode[]>([]);

  const { nodes, edges } = useMemo(() => {
    if (!bundle) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    const nodes: GraphNode[] = bundle.defendants.map((d) => ({
      id: d.id,
      kind: 'defendant',
      label: d.fullName,
      role: d.role,
      custodyStatus: d.custodyStatus,
    }));
    for (const e of bundle.entities) {
      nodes.push({ id: e.id, kind: 'entity', label: e.name });
    }
    const edges: GraphEdge[] = bundle.links.map((l) => ({
      source: l.sourceDefendantId,
      target: l.targetDefendantId,
      relationship: l.relationship,
    }));
    for (const el of bundle.entityLinks) {
      edges.push({ source: el.defendantId, target: el.entityId, relationship: el.roleInEntity ?? 'صلة بكيان' });
    }
    return { nodes, edges };
  }, [bundle]);

  // Keyed by actual node/edge identity, not counts: switching from one case
  // to another whose node and edge COUNTS happen to match (a realistic
  // coincidence) must still re-run the layout. Keying on [nodes.length,
  // edges.length] previously meant that case switch left `positions` keyed
  // by the old case's node ids, so every lookup below missed and the graph
  // rendered completely blank with no error.
  const graphKey = useMemo(
    () => `${nodes.map((n) => n.id).join(',')}::${edges.map((e) => `${e.source}-${e.target}`).join(',')}`,
    [nodes, edges],
  );

  useEffect(() => {
    if (nodes.length === 0) return;
    setLayoutComputing(true);
    // Yield one frame so React can paint the "computing layout" state before
    // the synchronous 260-tick simulation blocks the main thread — at a few
    // hundred nodes that loop is long enough to otherwise freeze the UI with
    // no feedback at all.
    const raf = requestAnimationFrame(() => {
      const simNodes = nodes.map((n) => ({ ...n }));
      nodesRef.current = simNodes;

      const sim = forceSimulation(simNodes)
        .force(
          'link',
          forceLink<GraphNode, any>(edges as any)
            .id((d: any) => d.id)
            .distance(70)
            .strength(0.4),
        )
        .force('charge', forceManyBody().strength(-90))
        .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
        .force('collide', forceCollide(22))
        .stop();

      for (let i = 0; i < 260; i++) sim.tick();

      const next = new Map<string, { x: number; y: number }>();
      for (const n of simNodes) {
        next.set(n.id, { x: n.x ?? WIDTH / 2, y: n.y ?? HEIGHT / 2 });
      }
      setPositions(next);
      setLayoutComputing(false);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

  function handleDrag(id: string, e: React.MouseEvent<SVGCircleElement | SVGRectElement>) {
    e.preventDefault();
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    function onMove(ev: MouseEvent) {
      const rect = svg!.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * WIDTH;
      const y = ((ev.clientY - rect.top) / rect.height) * HEIGHT;
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(id, { x, y });
        return next;
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <div className="text-muted">جارٍ بناء المخطط العلائقي…</div>;
  if (nodes.length === 0) return <div className="text-muted">لا توجد بيانات علائقية لهذا الملف بعد.</div>;
  if (layoutComputing) return <div className="text-muted">جارٍ حساب تخطيط المخطط العلائقي…</div>;

  const relatedToHover = new Set<string>();
  if (hovered) {
    relatedToHover.add(hovered);
    for (const e of edges) {
      if (e.source === hovered) relatedToHover.add(e.target);
      if (e.target === hovered) relatedToHover.add(e.source);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
        <Legend color={ROLE_COLOR.principal} label="فاعل أصلي" />
        <Legend color={ROLE_COLOR.accomplice} label="شريك" />
        <Legend color={ROLE_COLOR.instigator} label="محرض" />
        <Legend color="#0b5d3b" shape="square" label="كيان / شركة وهمية" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={focusEntitiesOnly} onChange={(e) => setFocusEntitiesOnly(e.target.checked)} />
          إبراز روابط الكيانات فقط
        </label>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block', background: 'var(--color-surface-alt)' }}>
          {edges.map((e, i) => {
            const s = positions.get(e.source);
            const t = positions.get(e.target);
            if (!s || !t) return null;
            const dim = hovered && !relatedToHover.has(e.source) && !relatedToHover.has(e.target);
            const isEntityEdge = nodes.find((n) => n.id === e.target)?.kind === 'entity';
            if (focusEntitiesOnly && !isEntityEdge) return null;
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={isEntityEdge ? 'var(--color-gold)' : 'var(--color-border)'}
                strokeWidth={isEntityEdge ? 1.6 : 1}
                opacity={dim ? 0.12 : 0.7}
              />
            );
          })}
          {nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const dim = hovered && !relatedToHover.has(n.id);
            const color = n.kind === 'entity' ? '#0b5d3b' : ROLE_COLOR[n.role ?? 'accomplice'];
            return (
              <g
                key={n.id}
                transform={`translate(${p.x}, ${p.y})`}
                opacity={dim ? 0.25 : 1}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'grab' }}
              >
                {n.kind === 'entity' ? (
                  <rect
                    x={-9}
                    y={-9}
                    width={18}
                    height={18}
                    fill={color}
                    stroke="var(--color-surface)"
                    strokeWidth={1.5}
                    onMouseDown={(e) => handleDrag(n.id, e)}
                  />
                ) : (
                  <circle
                    r={9}
                    fill={color}
                    stroke="var(--color-surface)"
                    strokeWidth={1.5}
                    onMouseDown={(e) => handleDrag(n.id, e)}
                  />
                )}
                <text x={0} y={22} textAnchor="middle" fontSize={10} fill="var(--color-text)">
                  {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hovered && (
        <div className="card" style={{ padding: 10, fontSize: 12.5 }}>
          {(() => {
            const n = nodes.find((x) => x.id === hovered);
            if (!n) return null;
            return (
              <span>
                <strong>{n.label}</strong>
                {n.role ? ` — ${roleLabel(n.role)}` : ' — كيان قانوني'}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, shape = 'circle' }: { color: string; label: string; shape?: 'circle' | 'square' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 11,
          height: 11,
          background: color,
          borderRadius: shape === 'circle' ? '50%' : 3,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
