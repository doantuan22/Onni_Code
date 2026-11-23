import { ChevronDownIcon, UsersIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import type {
  PairDecision,
  PairMessage,
  PairOrder,
  PairOrderStatus,
  PairPhase,
  PairProposal,
  PairRole,
  PairSnapshot,
} from '@onni/api-client'
import { Pill } from '@/components/pill'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Translate = (key: string) => string

function assertNever(value: never): never {
  throw new Error(`Unhandled One & One value: ${String(value)}`)
}

export function pairPhaseLabel(phase: PairPhase, t: Translate): string {
  switch (phase) {
    case 'planning': return t('Planning')
    case 'worker_queued': return t('Worker queued')
    case 'worker_working': return t('Worker working')
    case 'manager_review': return t('Manager review')
    case 'discussion': return t('Discussion')
    case 'user_wait': return t('Waiting for you')
    case 'transitioning': return t('Transitioning')
    case 'final_check': return t('Final check')
    case 'complete': return t('Complete')
    case 'stopped': return t('Stopped')
    default: return assertNever(phase)
  }
}

export function pairRoleLabel(role: PairRole, t: Translate): string {
  switch (role) {
    case 'manager': return t('Manager')
    case 'worker': return t('Worker')
    default: return assertNever(role)
  }
}

export function pairOrderStatusLabel(status: PairOrderStatus, t: Translate): string {
  switch (status) {
    case 'queued': return t('Queued')
    case 'working': return t('Working')
    case 'reported': return t('Reported')
    case 'accepted': return t('Accepted')
    case 'superseded': return t('Superseded')
    case 'rejected': return t('Rejected')
    default: return assertNever(status)
  }
}

function pairMessageKindLabel(kind: PairMessage['kind'], t: Translate): string {
  switch (kind) {
    case 'note': return t('Note')
    case 'question': return t('Question')
    case 'answer': return t('Answer')
    default: return assertNever(kind)
  }
}

function pairProposalStatusLabel(status: PairProposal['status'], t: Translate): string {
  switch (status) {
    case 'open': return t('Open')
    case 'chosen': return t('Chosen')
    case 'declined': return t('Declined')
    case 'superseded': return t('Superseded')
    default: return assertNever(status)
  }
}

function pairDecisionOutcomeLabel(outcome: PairDecision['outcome'], t: Translate): string {
  switch (outcome) {
    case 'chosen': return t('Chosen')
    case 'declined': return t('Declined')
    default: return assertNever(outcome)
  }
}

const COLLECTION_PREVIEW_MAX = 4
const COLLECTION_RENDER_MAX = 50
const OPTIONS_RENDER_MAX = 10
const TEXT_PREVIEW_LENGTH = 280

/**
 * One authoritative pair snapshot, not a synthetic transcript event. Every collection is bounded
 * before it reaches the DOM; opening a long collection reveals at most its latest bounded window.
 */
export function PairCard({ snapshot }: { snapshot: PairSnapshot }) {
  const { t } = useI18n()
  const { state } = snapshot
  const currentOrder = state.currentOrderId === undefined
    ? undefined
    : snapshot.orders.find((order) => order.id === state.currentOrderId)

  return (
    <section
      data-slot="pair-card"
      data-pair-id={state.pairId}
      data-phase={state.phase}
      aria-label={t('One & One status')}
      className="min-w-0 rounded-lg border border-border bg-card p-3 text-[13px] text-muted-foreground"
    >
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-foreground">
          <UsersIcon className="size-3.5 text-primary" aria-hidden="true" />
          {t('One & One')}
        </span>
        <Pill>{pairPhaseLabel(state.phase, t)}</Pill>
        {state.activeRole !== undefined ? (
          <span data-slot="pair-active-role">{t('Active: {role}', { role: pairRoleLabel(state.activeRole, t) })}</span>
        ) : null}
        {currentOrder !== undefined ? (
          <span data-slot="pair-current-order" className="inline-flex items-center gap-1.5">
            <span>{t('Order {revision}', { revision: currentOrder.revision })}</span>
            <Pill data-order-status={currentOrder.status}>{pairOrderStatusLabel(currentOrder.status, t)}</Pill>
          </span>
        ) : null}
      </header>

      <dl className="mt-3 grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2">
        <PairValue label={t('Repository')} value={state.workspace.repoRoot} monospace />
        <PairValue label={t('Branch')} value={state.workspace.branch} monospace />
        <PairValue label={t('Baseline')} value={state.workspace.baselineSha} monospace />
        <PairValue label={t('Checkpoint')} value={state.lastCheckpointSha ?? '—'} monospace />
        <PairValue label={t('Handoffs')} value={String(state.handoffs)} />
      </dl>

      <div className="mt-3 space-y-2 border-t border-border pt-2">
        <PairCollection
          title={t('Orders')}
          items={snapshot.orders}
          itemKey={(order) => order.id}
          renderItem={(order) => <PairOrderCard order={order} />}
        />
        <PairCollection
          title={t('Messages')}
          items={snapshot.messages}
          itemKey={(message) => message.id}
          renderItem={(message) => <PairMessageCard message={message} />}
        />
        <PairCollection
          title={t('Proposals')}
          items={snapshot.proposals}
          itemKey={(proposal) => proposal.id}
          renderItem={(proposal) => <PairProposalCard proposal={proposal} />}
        />
        <PairCollection
          title={t('Decisions')}
          items={snapshot.decisions}
          itemKey={(decision) => decision.id}
          renderItem={(decision) => <PairDecisionCard decision={decision} />}
        />
      </div>
    </section>
  )
}

function PairValue({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-soft-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate', monospace && 'font-mono text-[11px]')} title={value}>{value}</dd>
    </div>
  )
}

function PairCollection<T>({
  title,
  items,
  itemKey,
  renderItem,
  limit = COLLECTION_RENDER_MAX,
}: {
  title: string
  items: readonly T[]
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  limit?: number
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(items.length <= COLLECTION_PREVIEW_MAX)
  const visible = items.slice(-limit)
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="pair-collection" data-count={items.length}>
      <CollapsibleTrigger className="flex min-h-7 w-full items-center gap-1.5 rounded-sm px-1 text-left font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChevronDownIcon className={cn('size-3 shrink-0 transition-transform', !open && '-rotate-90')} aria-hidden="true" />
        <span>{title}</span>
        <span className="tabular-nums text-muted-foreground">{items.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-l border-border py-1 pl-3">
          {visible.map((item) => <div key={itemKey(item)}>{renderItem(item)}</div>)}
          {visible.length === 0 ? <p className="py-1 text-xs text-soft-foreground">{t('None yet')}</p> : null}
          {items.length > visible.length ? (
            <p className="text-[11px] text-soft-foreground">
              {t('Showing the latest {shown} of {total}.', { shown: visible.length, total: items.length })}
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function PairLongText({ text }: { text: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const long = text.length > TEXT_PREVIEW_LENGTH
  if (!long) return <p className="whitespace-pre-wrap break-words">{text}</p>
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="pair-long-text">
      {open ? null : <p className="whitespace-pre-wrap break-words">{`${text.slice(0, TEXT_PREVIEW_LENGTH).trimEnd()}…`}</p>}
      <CollapsibleTrigger className="mt-0.5 text-[11px] font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {open ? t('Show less') : t('Show more')}
      </CollapsibleTrigger>
      <CollapsibleContent><p className="whitespace-pre-wrap break-words">{text}</p></CollapsibleContent>
    </Collapsible>
  )
}

function PairOrderCard({ order }: { order: PairOrder }) {
  const { t } = useI18n()
  const hasDetails = order.scope !== undefined || order.successCriteria !== undefined || order.requiredEvidence !== undefined
  return (
    <article data-slot="pair-order" data-order-id={order.id} className="min-w-0 rounded-sm border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{t('Revision {revision}', { revision: order.revision })}</span>
        <Pill>{pairOrderStatusLabel(order.status, t)}</Pill>
      </div>
      <div className="mt-1.5"><PairLongText text={order.objective} /></div>
      {hasDetails ? <PairOrderDetails order={order} /> : null}
      {order.report !== undefined ? (
        <div className="mt-2 border-t border-border pt-2">
          <div className="text-[11px] font-medium text-soft-foreground">{t('Report')}</div>
          <PairLongText text={order.report} />
        </div>
      ) : null}
    </article>
  )
}

function PairOrderDetails({ order }: { order: PairOrder }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1.5">
      <CollapsibleTrigger className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChevronDownIcon className={cn('size-3 transition-transform', !open && '-rotate-90')} aria-hidden="true" />
        {t('Order details')}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1.5">
        {order.scope !== undefined ? <PairTextField label={t('Scope')} text={order.scope} /> : null}
        {order.successCriteria !== undefined ? <PairTextField label={t('Success criteria')} text={order.successCriteria} /> : null}
        {order.requiredEvidence !== undefined ? <PairTextField label={t('Required evidence')} text={order.requiredEvidence} /> : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

function PairTextField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-soft-foreground">{label}</div>
      <PairLongText text={text} />
    </div>
  )
}

function PairMessageCard({ message }: { message: PairMessage }) {
  const { t } = useI18n()
  return (
    <article data-slot="pair-message" data-message-id={message.id} className="min-w-0 rounded-sm border border-border p-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-medium text-foreground">{pairRoleLabel(message.from, t)}</span>
        <span aria-hidden="true">→</span>
        <span>{pairRoleLabel(message.to, t)}</span>
        <Pill>{pairMessageKindLabel(message.kind, t)}</Pill>
        {message.orderId !== undefined ? <span>{t('Order')}: <code>{message.orderId}</code></span> : null}
      </div>
      <div className="mt-1.5"><PairLongText text={message.text} /></div>
    </article>
  )
}

function PairProposalCard({ proposal }: { proposal: PairProposal }) {
  const { t } = useI18n()
  return (
    <article data-slot="pair-proposal" data-proposal-id={proposal.id} className="min-w-0 rounded-sm border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{pairProposalStatusLabel(proposal.status, t)}</Pill>
        <span className="text-[11px]">{pairRoleLabel(proposal.from, t)}</span>
        {proposal.orderId !== undefined ? <span className="text-[11px]">{t('Order')}: <code>{proposal.orderId}</code></span> : null}
      </div>
      <div className="mt-1.5"><PairLongText text={proposal.question} /></div>
      {proposal.recommendation !== undefined ? (
        <div className="mt-1.5">
          <div className="text-[11px] font-medium text-soft-foreground">{t('Recommendation')}</div>
          <PairLongText text={proposal.recommendation} />
        </div>
      ) : null}
      <PairCollection
        title={t('Options')}
        items={proposal.options}
        itemKey={(option) => option.id}
        renderItem={(option) => (
          <div data-slot="pair-proposal-option" className="rounded-sm bg-muted/40 p-2">
            <div className="font-medium text-foreground">{option.title}</div>
            {option.detail !== undefined ? <PairLongText text={option.detail} /> : null}
          </div>
        )}
        limit={OPTIONS_RENDER_MAX}
      />
    </article>
  )
}

function PairDecisionCard({ decision }: { decision: PairDecision }) {
  const { t } = useI18n()
  return (
    <article data-slot="pair-decision" data-decision-id={decision.id} className="min-w-0 rounded-sm border border-border p-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Pill>{pairDecisionOutcomeLabel(decision.outcome, t)}</Pill>
        <span>{pairRoleLabel(decision.decidedBy, t)}</span>
        <span>{t('Proposal')}: <code>{decision.proposalId}</code></span>
        {decision.optionId !== undefined ? <span>{t('Option')}: <code>{decision.optionId}</code></span> : null}
      </div>
      {decision.note !== undefined ? <div className="mt-1.5"><PairLongText text={decision.note} /></div> : null}
    </article>
  )
}
