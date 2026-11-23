import * as React from 'react'
import { PencilIcon, UsersIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { isOneAndOneRoster, rosterWorkerKey, type ApiRun } from '@onni/api-client'
import { putRunRoster } from '@/api/client'
import { queryKeys, useProviderStatus, useRuns } from '@/api/queries'
import { RosterEditor } from '@/components/roster-editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { connectedBackends, draftFromRoster, rosterFromDraft, type RosterDraft } from '@/lib/roster'

export interface EditWorkersButtonProps {
  /** The tree ROOT run whose roster is edited — resolve `dispatch.rootRunId` before passing. */
  run: ApiRun | undefined
  /** Icon-only control for a title row; otherwise a labelled outline button. */
  iconOnly?: boolean
}

/**
 * The one place a live manager run's roster is edited from the cockpit (docs/design/manager-worker.md).
 * Renders nothing while the root is settled or carries no roster; the dialog reuses `RosterEditor`
 * and saves through `PUT /runs/:id/roster`, updating the runs-list and detail caches in place.
 */
export function EditWorkersButton({ run, iconOnly = false }: EditWorkersButtonProps) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const providers = useProviderStatus()
  const runs = useRuns()
  const connected = connectedBackends(providers.data)
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<RosterDraft | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const savingRef = React.useRef(false)

  const active = run?.status === 'running' || run?.status === 'queued' || run?.status === 'waiting'
  const editable = Boolean(run?.roster && active)
  const oneAndOne = Boolean(run?.roster && isOneAndOneRoster(run.roster))
  const pairWorkerRunId = run?.dispatch?.pair?.workerRunId
  const admittedWorker = pairWorkerRunId === undefined
    ? undefined
    : (runs.data ?? []).find((candidate) => candidate.id === pairWorkerRunId)
  const workerIdentityLocked = oneAndOne && pairWorkerRunId !== undefined
  const parsed = draft ? rosterFromDraft(draft) : null
  const draftWorker = draft?.workers.length === 1 ? draft.workers[0] : undefined
  const admittedRunner = admittedWorker?.runner
  const draftRunner = draftWorker?.runner
  const admittedWorkerMatches = admittedRunner !== undefined && draftRunner !== undefined && Boolean(draftRunner) &&
    rosterWorkerKey({ runner: admittedRunner, model: admittedWorker?.model }) ===
    rosterWorkerKey({ runner: draftRunner, model: draftWorker?.model })

  React.useEffect(() => {
    if (open && !editable) setOpen(false)
  }, [open, editable])

  const save = async () => {
    if (!run || !editable || !parsed?.ok || savingRef.current || (workerIdentityLocked && !admittedWorkerMatches)) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await putRunRoster(run.id, parsed.roster)
      queryClient.setQueryData<ApiRun[]>(queryKeys.runs.list(), (runs) =>
        runs?.map((r) => (r.id === run.id ? { ...r, roster: result.roster } : r)),
      )
      queryClient.setQueryData<ApiRun>(queryKeys.runs.detail(run.id), (r) =>
        r ? { ...r, roster: result.roster } : r,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all })
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Could not update workers'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (!editable) return null

  const openEditor = () => {
    setDraft(draftFromRoster(run!.roster!))
    setError(null)
    setOpen(true)
  }

  return (
    <>
      {iconOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-slot="edit-workers"
          aria-label={t('Edit workers')}
          title={t('Edit workers')}
          className="text-muted-foreground"
          onClick={openEditor}
        >
          <UsersIcon aria-hidden="true" />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="xs" data-slot="edit-workers" onClick={openEditor}>
          <PencilIcon aria-hidden="true" />
          {t('Edit workers')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!next) setOpen(false) }}>
        <DialogContent data-slot="edit-workers-dialog" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Edit workers')}</DialogTitle>
            <DialogDescription>
              {oneAndOne
                ? t('One & One keeps its working mode and admitted worker fixed. You may still edit the worker’s role and traits.')
                : t('Changes apply to future dispatches. Existing workers keep running.')}
            </DialogDescription>
          </DialogHeader>
          {draft ? <RosterEditor draft={draft} onChange={setDraft} connected={connected} disabled={!editable || saving} managerLocked modeLocked workerIdentityLocked={workerIdentityLocked} /> : null}
          {workerIdentityLocked && !admittedWorkerMatches ? <p role="alert" className="text-[12.5px] text-danger">{t('The admitted worker could not be verified. Reload before changing this pair.')}</p> : null}
          {parsed && !parsed.ok ? <p role="alert" className="text-[12.5px] text-danger">{parsed.error}</p> : null}
          {error ? <p role="alert" data-slot="roster-save-error" className="text-[12.5px] text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button type="button" data-slot="save-workers" disabled={!editable || !parsed?.ok || saving || (workerIdentityLocked && !admittedWorkerMatches)} onClick={() => void save()}>{t('Save workers')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
