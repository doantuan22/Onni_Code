import { PlusIcon, Trash2Icon } from 'lucide-react'

import { ROSTER_MAX_CONCURRENT, ROSTER_MAX_WORKERS, RUNNER_CAPABILITIES, WORKER_KINDS, WORKER_TIERS, type Runner, type WorkerKind, type WorkerTier } from '@onni/api-client'
import { fieldClass } from '@/components/form-field'
import { ModelPickerField } from '@/components/model-picker-field'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { emptyWorker, managerCapable, type RosterDraft, type WorkerDraft } from '@/lib/roster'
import { AppSelect } from '@/components/ui/app-select'

const TIER_LABELS: Record<WorkerTier, string> = {
  light: 'Tier: light (small mechanical parts)',
  standard: 'Tier: standard (ordinary parts)',
  heavy: 'Tier: heavy (hard, multi-file parts)',
}

const KIND_LABELS: Record<WorkerKind, string> = {
  implement: 'Implement',
  test: 'Test',
  explore: 'Explore',
  review: 'Review',
}

function BackendSelect({
  value,
  connected,
  onChange,
  label,
  disabled,
}: {
  value: Runner | ''
  connected: readonly Runner[]
  onChange: (runner: Runner | '') => void
  label: string
  disabled?: boolean
}) {
  // A backend already chosen but no longer connected stays visible (and flagged) instead of vanishing.
  const options = value && !connected.includes(value) ? [...connected, value] : connected
  const { t } = useI18n()
  return (
    <AppSelect aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Runner | '')} className={fieldClass}>
      <option value="">{t('Choose a backend…')}</option>
      {options.map((runner) => (
        <option key={runner} value={runner}>
          {runner}
          {connected.includes(runner) ? '' : ` ${t('(not connected)')}`}
        </option>
      ))}
    </AppSelect>
  )
}

/**
 * The manager and the workers it may use. Backends are limited to the ones connected right now;
 * a worker is a backend, an optional model from that backend's own list (several entries may share
 * a backend), a free-text role the manager reads, how heavy a part it can carry (tier), the kinds
 * of part it suits, and how many of its tasks may run at once. Tier and kinds only inform the
 * manager's choice; they never limit the worker.
 * Agents left out are never
 * used — the server refuses a dispatch to them.
 */
export function RosterEditor({
  draft,
  onChange,
  connected,
  disabled,
  managerLocked,
  modeLocked,
  workerIdentityLocked,
}: {
  draft: RosterDraft
  onChange: (next: RosterDraft) => void
  connected: readonly Runner[]
  disabled?: boolean
  /** Keep the manager fixed when editing the roster of an already running task. */
  managerLocked?: boolean
  /** A running task keeps the orchestration mode it started with. */
  modeLocked?: boolean
  /** A live pair keeps the backend/model admitted for its worker; role and traits stay editable. */
  workerIdentityLocked?: boolean
}) {
  const workerOnly = connected.filter((runner) => !managerCapable(connected).includes(runner))
  const oneAndOne = draft.mode === 'one-and-one'
  const workerLocked = disabled || oneAndOne
  const { t } = useI18n()
  const setMode = (mode: RosterDraft['mode']) => onChange(mode === 'one-and-one'
    ? { ...draft, mode, workers: draft.workers.slice(0, 1).map((worker) => ({ ...worker, maxConcurrent: 1 })) }
    : { ...draft, mode })
  const setWorker = (index: number, patch: Partial<WorkerDraft>) =>
    onChange({ ...draft, workers: draft.workers.map((w, i) => (i === index ? { ...w, ...patch } : w)) })
  return (
    <div data-slot="roster-editor" className="@container flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">{t('Working mode')}</span>
        <AppSelect
          aria-label={t('Working mode')}
          data-slot="roster-mode"
          value={draft.mode}
          disabled={disabled || modeLocked}
          onChange={(event) => setMode(event.target.value as RosterDraft['mode'])}
          className={fieldClass}
        >
          <option value="fanout">{t('Fanout')}</option>
          <option value="one-and-one">{t('One & One')}</option>
        </AppSelect>
        {modeLocked ? <span className="text-xs text-soft-foreground">{t('The working mode is fixed for a running task.')}</span> : null}
      </label>
      {oneAndOne ? (
        <p data-slot="roster-pair-note" className="text-xs text-soft-foreground">
          {t('One manager and one worker share this checkout. Add, remove and concurrency are fixed.')}
        </p>
      ) : null}
      {connected.length === 0 ? (
        <p data-slot="roster-no-backends" className="text-xs text-danger">
          {t('No agent is connected on this machine — connect one in Settings → Agents first.')}
        </p>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold">{t('Manager')}</legend>
        <div className="grid grid-cols-2 gap-2">
          <BackendSelect label={t('Manager backend')} value={draft.managerRunner} connected={managerCapable(connected)} disabled={disabled || managerLocked} onChange={(managerRunner) => onChange({ ...draft, managerRunner })} />
          <ModelPickerField runner={draft.managerRunner} value={draft.managerModel} onChange={(managerModel) => onChange({ ...draft, managerModel })} ariaLabel={t('Manager model')} disabled={disabled || managerLocked} />
        </div>
        {managerLocked ? <p className="text-xs text-soft-foreground">{t('The manager is fixed for a running task.')}</p> : null}
        {workerOnly.map((runner) => (
          <p key={runner} data-slot="roster-worker-only" data-backend={runner} className="text-xs text-soft-foreground">
            {t('{runner} is offered as a worker only: {reason}.', { runner, reason: RUNNER_CAPABILITIES[runner].manageReason ?? '' })}
          </p>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold">{t('Workers')}</legend>
        {draft.workers.map((worker, index) => (
          <div key={index} data-slot="roster-worker" className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
            {/* One row in Settings (the pane is ~479px here), two in the composer's 352px popover:
                the query is on the CONTAINER, because a 400px-wide phone viewport can still host a
                wide settings pane. @md is 448px — the four columns need ~110px each to stay legible. */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 @md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem_auto] @md:items-center">
              <BackendSelect label={t('Worker {n} backend', { n: index + 1 })} value={worker.runner} connected={connected} disabled={disabled || workerIdentityLocked} onChange={(runner) => setWorker(index, { runner })} />
              <ModelPickerField runner={worker.runner} value={worker.model} onChange={(model) => setWorker(index, { model })} ariaLabel={t('Worker {n} model', { n: index + 1 })} disabled={disabled || workerIdentityLocked} />
              <input
                type="number"
                min={1}
                max={ROSTER_MAX_CONCURRENT}
                aria-label={t('Worker {n} at once', { n: index + 1 })}
                title={t('How many tasks of this worker run at once')}
                value={oneAndOne ? 1 : worker.maxConcurrent}
                disabled={workerLocked}
                onChange={(e) => setWorker(index, { maxConcurrent: Number(e.target.value) || 1 })}
                className={fieldClass}
              />
              <Button type="button" variant="ghost" size="icon" className="rounded-sm" aria-label={t('Remove worker {n}', { n: index + 1 })} disabled={workerLocked || draft.workers.length <= 1} onClick={() => onChange({ ...draft, workers: draft.workers.filter((_, i) => i !== index) })}>
                <Trash2Icon className="size-[14px]" aria-hidden="true" />
              </Button>
            </div>
            <div data-slot="roster-worker-traits" className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <AppSelect
                aria-label={t('Worker {n} tier', { n: index + 1 })}
                title={t('How heavy a part this worker can carry — the manager reads it when choosing who gets what')}
                value={worker.tier}
                disabled={disabled}
                onChange={(e) => setWorker(index, { tier: e.target.value as WorkerTier | '' })}
                className={`${fieldClass} w-auto`}
              >
                <option value="">{t('Tier: not set')}</option>
                {WORKER_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {t(TIER_LABELS[tier])}
                  </option>
                ))}
              </AppSelect>
              <div role="group" aria-label={t('Worker {n} suits', { n: index + 1 })} className="flex flex-wrap items-center gap-1.5">
                {WORKER_KINDS.map((kind) => {
                  const on = worker.kinds.includes(kind)
                  return (
                    <button
                      key={kind}
                      type="button"
                      data-slot="roster-worker-kind"
                      data-kind={kind}
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() => setWorker(index, { kinds: on ? worker.kinds.filter((k) => k !== kind) : WORKER_KINDS.filter((k) => k === kind || worker.kinds.includes(k)) })}
                      className="inline-flex h-8 min-h-8 items-center rounded-sm border border-border bg-background px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 aria-pressed:bg-muted aria-pressed:text-foreground"
                    >
                      {t(KIND_LABELS[kind])}
                    </button>
                  )
                })}
              </div>
            </div>
            <input aria-label={t('Worker {n} role', { n: index + 1 })} placeholder={t('Role / strengths — e.g. backend tests, docs, mechanical renames')} maxLength={500} value={worker.role} disabled={disabled} onChange={(e) => setWorker(index, { role: e.target.value })} className={fieldClass} />
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" data-slot="roster-add-worker" disabled={workerLocked || draft.workers.length >= ROSTER_MAX_WORKERS} onClick={() => onChange({ ...draft, workers: [...draft.workers, emptyWorker(connected[0] ?? '')] })}>
            <PlusIcon className="size-[14px]" aria-hidden="true" />
            {t('Add worker')}
          </Button>
        </div>
      </fieldset>
      <p data-slot="roster-fence-note" className="text-xs text-soft-foreground">
        {t('Tier and the kinds a worker suits only tell the manager who fits which part; they do not limit the worker.')}{' '}
        {t('The manager can hand work only to the workers listed here; the server refuses any other backend. This steers orchestration — it is not a security boundary (an agent can still run a CLI or call the API directly).')}
      </p>
    </div>
  )
}
