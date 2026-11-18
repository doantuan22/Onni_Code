import '@xyflow/react/dist/style.css'
import './activity-graph.css'

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  BanIcon,
  BotIcon,
  CheckCircle2Icon,
  ClockIcon,
  CrownIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MaximizeIcon,
  MessageCircleQuestionIcon,
  RadioIcon,
  ShieldAlertIcon,
  UsersIcon,
  XCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { useRuns } from '@/api/queries'
import type { ApiRun } from '@onni/api-client'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'
import {
  buildActivityGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
  rootOf,
  type ActivityEdgeSpec,
  type ActivityGraph,
  type ActivityNodeSpec,
  type ActivityState,
} from '@/lib/activity-graph'
import { useI18n } from '@/lib/i18n'
import { Link } from '@/lib/project-router'
import { formatCost } from '@/lib/tasks-table'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

import { FloatingPanel } from './workflow-graph'

/**
 * The Activity view of the task Graph tab (P9): who works on what, right now.
 *
 * One source of truth — the run records the sidebar reads, patched live by SSE — folded by
 * `lib/activity-graph.ts`. This file only draws: a card per agent (icon, model, state with an
 * icon so colour is never the only signal, current line, elapsed, cost), assign edges
 * (manager → worker) and report edges (worker → manager) that move while something flows, a
 * deterministic grid layout, fit-to-view that stops once the user pans, and a details panel.
 */

const STATE_META: Record<ActivityState, { icon: LucideIcon; label: string; tone: string; spin?: boolean }> = {
  queued: { icon: ClockIcon, label: 'Queued', tone: 'text-muted-foreground border-border' },
  running: { icon: Loader2Icon, label: 'Working', tone: 'text-primary border-primary/60', spin: true },
  monitoring: { icon: RadioIcon, label: 'Waiting for workers', tone: 'text-primary border-primary/50' },
  asking: { icon: MessageCircleQuestionIcon, label: 'Needs you', tone: 'text-warning border-warning/60' },
  done: { icon: CheckCircle2Icon, label: 'Done', tone: 'text-success border-success/50' },
  failed: { icon: XCircleIcon, label: 'Failed', tone: 'text-danger border-danger/60' },
  blocked: { icon: ShieldAlertIcon, label: 'Blocked by permission', tone: 'text-danger border-danger/60' },
  cancelled: { icon: BanIcon, label: 'Cancelled', tone: 'text-muted-foreground border-border' },
}

type CardData = { spec: ActivityNodeSpec; fresh: boolean; onExpand?: () => void }

function Elapsed({ startedAt, finishedAt }: { startedAt?: string; finishedAt?: string }) {
  const live = startedAt !== undefined && finishedAt === undefined
  // One timer per RUNNING card only: finished cards never tick.
  const now = useNow(1000, live)
  if (!startedAt) return null
  const end = finishedAt ? Date.parse(finishedAt) : now
  const seconds = Math.max(0, Math.round((end - Date.parse(startedAt)) / 1000))
  const text = seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m` : seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
  return <span className="tabular-nums">{text}</span>
}

/**
 * Four invisible anchors, so every edge uses the side it means: an assignment leaves the
 * manager's bottom and lands on a worker's top, and `--after` joins two siblings side to side.
 * Anonymous handles would make a return edge leave the worker's BOTTOM and enter the manager's
 * TOP, looping the whole subtree.
 */
const handles = (
  <>
    <Handle id="assign-out" type="source" position={Position.Bottom} className="!size-1 !border-0 !bg-transparent" isConnectable={false} />
    <Handle id="assign-in" type="target" position={Position.Top} className="!size-1 !border-0 !bg-transparent" isConnectable={false} />
    <Handle id="after-out" type="source" position={Position.Right} className="!size-1 !border-0 !bg-transparent" isConnectable={false} />
    <Handle id="after-in" type="target" position={Position.Left} className="!size-1 !border-0 !bg-transparent" isConnectable={false} />
  </>
)

const ActivityCard = memo(function ActivityCard({ data }: NodeProps<Node<CardData>>) {
  const { t } = useI18n()
  const { spec, fresh, onExpand } = data
  if (spec.kind === 'group') {
    return (
      <div
        data-slot="activity-node"
        data-state="done"
        style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
        className="activity-node flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-success/50 bg-card/70 px-4 text-center"
      >
        {handles}
        <UsersIcon className="size-5 text-success" aria-hidden="true" />
        <span className="text-[13px] font-medium text-foreground">{t('{count} finished workers', { count: spec.count ?? 0 })}</span>
        <Button type="button" size="sm" variant="outline" className="nodrag nopan h-7" onClick={onExpand}>
          {t('Show all')}
        </Button>
      </div>
    )
  }
  const meta = STATE_META[spec.state]
  const Icon = meta.icon
  const manager = spec.role === 'manager'
  return (
    <div
      data-slot="activity-node"
      data-state={spec.state}
      data-fresh={fresh ? 'true' : undefined}
      data-role={spec.role}
      title={`${spec.title} · ${t(meta.label)}`}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={cn(
        'activity-node flex flex-col gap-1.5 rounded-md border bg-card px-3.5 py-3 text-left shadow-sm',
        meta.tone,
        manager && 'ring-2 ring-primary/35',
      )}
    >
      {handles}
      <div className="flex items-center gap-2">
        {manager ? <CrownIcon className="size-4 shrink-0 text-primary" aria-label={t('manager')} /> : <BotIcon className="size-4 shrink-0 text-soft-foreground" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-foreground">
          {spec.runner}
          {spec.model ? <span className="font-normal text-muted-foreground"> · {spec.model}</span> : null}
        </span>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] font-medium', meta.tone)}>
          <Icon className={cn('size-3', meta.spin && 'motion-safe:animate-spin')} aria-hidden="true" />
          {t(meta.label)}
        </span>
      </div>
      <p className="truncate text-[13px] font-medium text-foreground">{spec.title}</p>
      <p className="line-clamp-2 min-h-[2.2em] text-[11.5px] leading-snug text-muted-foreground">{t(spec.line)}</p>
      <div className="mt-auto flex items-center gap-3 text-[11px] text-soft-foreground">
        <Elapsed startedAt={spec.startedAt} finishedAt={spec.finishedAt} />
        {spec.costUsd !== undefined && spec.costUsd > 0 ? <span className="tabular-nums">{formatCost(spec.costUsd)}</span> : null}
        {spec.tokens ? <span className="tabular-nums">{Intl.NumberFormat('en', { notation: 'compact' }).format(spec.tokens)} tok</span> : null}
      </div>
    </div>
  )
})

const nodeTypes = { activity: ActivityCard }

type ActivityEdgeData = { kind: 'assign' | 'after'; fan: number; bus: number; gutter: number; multiRow: boolean }

const EDGE_HANDLES = {
  assign: { sourceHandle: 'assign-out', targetHandle: 'assign-in' },
  after: { sourceHandle: 'after-out', targetHandle: 'after-in' },
} as const

/** An orthogonal path through `points` with rounded corners of at most `radius`. */
function roundedPath(points: Array<[number, number]>, radius = 9): string {
  const clean = points.filter((point, index) => {
    const previous = points[index - 1]
    return index === 0 || point[0] !== previous![0] || point[1] !== previous![1]
  })
  const first = clean[0]
  if (!first) return ''
  let d = `M ${first[0]},${first[1]}`
  for (let i = 1; i < clean.length - 1; i++) {
    const [px, py] = clean[i - 1]!
    const [cx, cy] = clean[i]!
    const [nx, ny] = clean[i + 1]!
    const inLength = Math.hypot(cx - px, cy - py)
    const outLength = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(radius, inLength / 2, outLength / 2)
    const ax = cx + ((px - cx) / inLength) * r
    const ay = cy + ((py - cy) / inLength) * r
    const bx = cx + ((nx - cx) / outLength) * r
    const by = cy + ((ny - cy) / outLength) * r
    d += ` L ${ax},${ay} Q ${cx},${cy} ${bx},${by}`
  }
  const last = clean[clean.length - 1]!
  return `${d} L ${last[0]},${last[1]}`
}

/**
 * Route one edge. Siblings fan out across the manager's bottom edge by `fan`, so every pair has
 * its own rail and no two strokes paint the same trunk; each then steps onto its own `bus` line
 * before turning toward the worker. When a group wraps onto several rows, the turn happens in the
 * `gutter` left of the target column and the trunk runs beside the cards instead of through them,
 * with a short hook into each card's top edge. A return edge reuses its assignment's geometry, so
 * the corridor never carries a second, looping line.
 */
function routeActivityEdge(kind: ActivityEdgeData['kind'], sx: number, sy: number, tx: number, ty: number, fan: number, bus: number, gutter: number, multiRow: boolean): string {
  if (kind === 'after') {
    if (Math.abs(sy - ty) < 2) return `M ${sx},${sy} L ${tx},${ty}`
    const mx = Math.round((sx + tx) / 2)
    return roundedPath([[sx, sy], [mx, sy], [mx, ty], [tx, ty]])
  }
  const rail = sx + fan
  if (multiRow) return roundedPath([[rail, sy], [rail, sy + bus], [gutter, sy + bus], [gutter, ty - 14], [tx, ty - 14], [tx, ty]])
  return roundedPath([[rail, sy], [rail, sy + bus], [tx, sy + bus], [tx, ty]])
}

const ActivityEdge = memo(function ActivityEdge({ id, sourceX, sourceY, targetX, targetY, markerStart, markerEnd, style, data }: EdgeProps) {
  const { kind = 'assign', fan = 0, bus = 30, gutter = 0, multiRow = false } = (data ?? {}) as Partial<ActivityEdgeData>
  return (
    <BaseEdge
      id={id}
      path={routeActivityEdge(kind, sourceX, sourceY, targetX, targetY, fan, bus, gutter, multiRow)}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={16}
    />
  )
})

const edgeTypes = { activity: ActivityEdge }

/**
 * Edges drawn from the run's edge specs, with two decisions made here rather than in the model:
 *
 *  - **A report rides its assignment.** The model keeps assign and report as separate edges
 *    because they mean different things, but two strokes over one corridor read as clutter. They
 *    are folded into one line per pair: violet into the worker while it works, then the worker's
 *    own tone (success, danger, muted) with the arrow at the manager's end once the result is in.
 *  - **Siblings get their own lane** around the manager, ordered by the worker's x, so a fan
 *    reads left to right and no two edges stack on the same trunk.
 */
function activityEdges(graph: ActivityGraph, focusId: string | null): Edge[] {
  const xOf = new Map(graph.nodes.map((node) => [node.id, node.position.x] as const))
  const yOf = new Map(graph.nodes.map((node) => [node.id, node.position.y] as const))
  const stateOf = new Map(graph.nodes.map((node) => [node.id, node.state] as const))
  const returned = new Map<string, boolean>()
  for (const edge of graph.edges) {
    if (edge.kind === 'report') returned.set(edge.source, (returned.get(edge.source) ?? false) || edge.active)
  }

  // One lane per TARGET COLUMN, not per sibling: an unwrapped group fans left to right, and a
  // wrapped one keeps every row on the same rail, so ten rows of workers share four trunks.
  const lanes = new Map<string, Pick<ActivityEdgeData, 'fan' | 'bus' | 'gutter' | 'multiRow'>>()
  const groups = new Map<string, ActivityEdgeSpec[]>()
  for (const edge of graph.edges) {
    if (edge.kind !== 'assign') continue
    groups.set(edge.source, [...(groups.get(edge.source) ?? []), edge])
  }
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (xOf.get(a.target) ?? 0) - (xOf.get(b.target) ?? 0) || a.id.localeCompare(b.id))
    const columns = [...new Set(sorted.map((edge) => xOf.get(edge.target) ?? 0))].sort((a, b) => a - b)
    const multiRow = new Set(sorted.map((edge) => yOf.get(edge.target) ?? 0)).size > 1
    for (const edge of sorted) {
      const column = Math.max(0, columns.indexOf(xOf.get(edge.target) ?? 0))
      lanes.set(edge.id, {
        fan: Math.round((column - (columns.length - 1) / 2) * 14),
        bus: 22 + column * 9,
        gutter: (xOf.get(edge.target) ?? 0) - 14,
        multiRow,
      })
    }
  }

  return graph.edges.flatMap((spec) => {
    if (spec.kind === 'report') return []
    const answered = spec.kind === 'assign' ? returned.has(spec.target) : false
    const workerState = stateOf.get(spec.target)
    const tone = !answered
      ? spec.kind === 'after' ? 'var(--muted-foreground)' : 'var(--primary)'
      : workerState === 'failed' || workerState === 'blocked'
        ? 'var(--danger)'
        : workerState === 'cancelled'
          ? 'var(--muted-foreground)'
          : 'var(--success)'
    const flowing = answered ? (returned.get(spec.target) ?? false) : spec.active
    const dimmed = focusId !== null && focusId !== spec.source && focusId !== spec.target
    const opacity = dimmed ? 0.12 : flowing ? 1 : answered || spec.kind === 'after' ? 0.6 : 0.48
    const lane = lanes.get(spec.id) ?? { fan: 0, bus: 30, gutter: (xOf.get(spec.target) ?? 0) - 14, multiRow: false }
    return [
      {
        id: spec.id,
        source: spec.source,
        target: spec.target,
        type: 'activity',
        ...EDGE_HANDLES[spec.kind === 'after' ? 'after' : 'assign'],
        className: cn('activity-edge', flowing && (answered ? 'activity-edge-return' : 'activity-edge-flow')),
        data: { kind: spec.kind === 'after' ? 'after' : 'assign', ...lane } satisfies ActivityEdgeData,
        style: {
          stroke: tone,
          // Width lives in a custom property so :hover can thicken it: an inline strokeWidth
          // beat the stylesheet rule and the hover never showed. The unit must be in the value,
          // or the hover's calc(number + px) is invalid and the stroke falls back to 1px.
          '--edge-w': `${flowing ? 2 : 1.5}px`,
          opacity,
          strokeDasharray: answered ? '5 5' : spec.kind === 'after' ? '2 5' : undefined,
        } as CSSProperties,
        ...(answered
          ? { markerStart: { type: MarkerType.ArrowClosed, color: tone, width: 12, height: 12 } }
          : { markerEnd: { type: MarkerType.ArrowClosed, color: tone, width: 14, height: 14 } }),
      },
    ]
  })
}

/** Keep each node data object identical between renders unless something about it changed. */
function useStableNodes(specs: ActivityNodeSpec[], onExpand: () => void): Node<CardData>[] {
  const previous = useRef(new Map<string, { key: string; node: Node<CardData> }>())
  const seen = useRef(new Set<string>())
  return useMemo(() => {
    const next = new Map<string, { key: string; node: Node<CardData> }>()
    const nodes = specs.map((spec) => {
      const key = JSON.stringify(spec)
      const old = previous.current.get(spec.id)
      if (old && old.key === key) {
        next.set(spec.id, old)
        return old.node
      }
      const fresh = seen.current.has(spec.id) // changed after first paint → play the state effect
      seen.current.add(spec.id)
      const node: Node<CardData> = {
        id: spec.id,
        type: 'activity',
        position: spec.position,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        draggable: false,
        connectable: false,
        data: { spec, fresh, ...(spec.kind === 'group' ? { onExpand } : {}) },
      }
      next.set(spec.id, { key, node })
      return node
    })
    previous.current = next
    return nodes
  }, [specs, onExpand])
}

/** The Activity graph with its own xyflow context (the task Graph tab may embed it anywhere). */
export function ActivityGraph({ run }: { run: ApiRun }) {
  return (
    <ReactFlowProvider>
      <ActivityGraphView run={run} />
    </ReactFlowProvider>
  )
}

function ActivityGraphView({ run }: { run: ApiRun }) {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const runs = useRuns()
  const rf = useReactFlow()
  const rootId = rootOf(run)
  const [collapse, setCollapse] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const userMoved = useRef(false)

  const now = useNow(5000)
  const graph = useMemo(
    () => buildActivityGraph(runs.data ?? [run], rootId, { collapseDone: collapse, now }),
    [runs.data, run, rootId, collapse, now],
  )
  const expand = useMemo(() => () => setCollapse(false), [])
  const nodes = useStableNodes(graph.nodes, expand)
  const edges = useMemo(() => activityEdges(graph, selectedId), [graph, selectedId])
  const selected = graph.nodes.find((n) => n.id === selectedId && n.kind === 'agent')
  const selectedRun = (runs.data ?? []).find((r) => r.id === selectedId)

  // Fit when the set of nodes changes, until the user takes the camera.
  const signature = nodes.map((n) => n.id).join('|')
  useEffect(() => {
    if (userMoved.current || nodes.length === 0) return
    const frame = requestAnimationFrame(() => void rf.fitView({ padding: 0.2, maxZoom: 1.1, duration: 280 }))
    return () => cancelAnimationFrame(frame)
  }, [signature, rf]) // eslint-disable-line react-hooks/exhaustive-deps

  if (runs.isPending) return <CenteredState icon={<Loader2Icon className="motion-safe:animate-spin" />} tone="neutral" title={t('Loading the activity map…')} subtitle="" heading="h2" />
  if (runs.isError) return <CenteredState icon={<XCircleIcon />} tone="danger" title={t('The activity map did not load')} subtitle={runs.error.message} heading="h2" />
  if (nodes.length === 0) return <CenteredState icon={<UsersIcon />} tone="neutral" title={t('Nothing to draw yet')} subtitle={t('This task has not started.')} heading="h2" />

  return (
    <div data-slot="activity-graph" data-node-count={nodes.length} className="relative min-h-[420px] flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        // A user pan/zoom carries a DOM event; our own fitView does not.
        onMoveStart={(event) => {
          if (event) userMoved.current = true
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        minZoom={0.15}
        maxZoom={1.6}
        colorMode={resolvedTheme === 'light' ? 'light' : 'dark'}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements={nodes.length > 40}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        {nodes.length > 8 ? <MiniMap pannable zoomable nodeColor="var(--primary)" maskColor="transparent" /> : null}
        <Panel position="top-right" className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 bg-card"
            onClick={() => {
              userMoved.current = false
              void rf.fitView({ padding: 0.2, maxZoom: 1.1, duration: 280 })
            }}
          >
            <MaximizeIcon className="size-3.5" aria-hidden="true" />
            {t('Fit')}
          </Button>
          {graph.hiddenDone > 0 || !collapse ? (
            <Button type="button" size="sm" variant="outline" className="h-7 bg-card" onClick={() => setCollapse((v) => !v)}>
              {collapse ? t('Show all workers') : t('Group finished')}
            </Button>
          ) : null}
        </Panel>
      </ReactFlow>
      {selected ? (
        <FloatingPanel side="right" label="Agent details" title={selected.title} onClose={() => setSelectedId(null)}>
          <div className="flex flex-col gap-3 p-3 text-[13px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-muted-foreground">{t('Agent')}</dt>
              <dd className="font-mono text-[12px]">{selected.runner}{selected.model ? ` · ${selected.model}` : ''}</dd>
              <dt className="text-muted-foreground">{t('State')}</dt>
              <dd>{t(STATE_META[selected.state].label)}</dd>
              {selected.costUsd !== undefined ? (<><dt className="text-muted-foreground">{t('Cost')}</dt><dd className="tabular-nums">{formatCost(selected.costUsd)}</dd></>) : null}
            </dl>
            <p className="whitespace-pre-wrap text-muted-foreground">{selectedRun?.dispatch?.report?.result ?? t(selected.line)}</p>
            {selectedRun?.dispatch?.report?.evidence?.length ? (
              <ul className="list-disc pl-4 text-[12px] text-muted-foreground">
                {selectedRun.dispatch.report.evidence.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
              </ul>
            ) : null}
            <Button asChild size="sm" variant="outline" className="w-fit gap-1.5">
              <Link to={`/tasks/${selected.id}`}>
                <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                {t('Open task')}
              </Link>
            </Button>
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  )
}
