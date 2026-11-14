import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EyeIcon, PencilIcon } from 'lucide-react'

import { createSkill, updateSkill } from '@/api/client'
import { queryKeys } from '@/api/queries'
import type { Skill } from '@onni/api-client'
import { SKILL_NAME_PATTERN } from '@onni/api-client'
import { Button } from '@/components/ui/button'
import { AppSelect } from '@/components/ui/app-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useI18n } from '@/lib/i18n'
import { Markdown } from '@/routes/task-thread/markdown'

/**
 * The create/edit form for onni-managed skills (`owned: true`). `skill === null` is create mode
 * (with a scope picker); a skill is edit mode (scope fixed, name renameable). The body textarea
 * and a live Markdown preview share one field with a Write/Preview toggle — the same renderer the
 * thread uses, so what the user previews is what the skill actually looks like.
 */

type Scope = 'project' | 'global'

export function SkillEditor({
  open,
  skill,
  onClose,
  onSaved,
}: {
  open: boolean
  skill: Skill | null
  onClose: () => void
  onSaved: (skill: Skill) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [interactive, setInteractive] = useState(false)
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<Scope>('project')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(skill?.name ?? '')
    setDescription(skill?.description ?? '')
    setInteractive(skill?.interactive === true)
    setBody(skill?.body ?? '')
    setScope(skill?.scope ?? 'project')
    setPreview(false)
  }, [open, skill])

  const nameValid = useMemo(() => SKILL_NAME_PATTERN.test(name), [name])

  const save = async () => {
    setSaving(true)
    try {
      const saved = skill
        ? await updateSkill(skill.name, {
            name: name === skill.name ? undefined : name,
            description,
            interactive,
            body,
          })
        : await createSkill({ name, description, interactive, body, scope })
      void queryClient.invalidateQueries({ queryKey: queryKeys.skills })
      toast(skill ? t('Skill saved.') : t('Skill created.'))
      onSaved(saved.skill)
      onClose()
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : String(error), { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent data-slot="skill-editor" className="block sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{skill ? t('Edit skill') : t('New skill')}</DialogTitle>
          <DialogDescription>
            {skill
              ? t('Change the name, description, or Markdown body. The skill stays in its current scope.')
              : t('Create a skill as a Markdown playbook agents can follow.')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-name">{t('Name')}</Label>
            <Input
              id="skill-name"
              data-slot="skill-editor-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!nameValid}
              placeholder="deploy-checklist"
            />
            {!nameValid ? (
              <p data-slot="skill-editor-name-hint" className="text-xs text-muted-foreground">
                {t('Letters, numbers, and . _ - only (must start with a letter or number).')}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-description">{t('Description')}</Label>
            <Input
              id="skill-description"
              data-slot="skill-editor-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('When to use this skill, in one line')}
            />
          </div>

          {skill === null ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skill-scope">{t('Scope')}</Label>
              <AppSelect
                data-slot="skill-editor-scope"
                aria-label={t('Scope')}
                value={scope}
                onChange={(event) => setScope(event.target.value as Scope)}
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="project">{t('This project (.ai/onni/skills)')}</option>
                <option value="global">{t('All projects (~/.onni/skills)')}</option>
              </AppSelect>
            </div>
          ) : null}

          <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium">{t('Interactive')}</span>
            <Switch
              data-slot="skill-editor-interactive"
              aria-label={t('Interactive')}
              size="sm"
              checked={interactive}
              onCheckedChange={setInteractive}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="skill-body">{t('Body')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-slot="skill-editor-preview-toggle"
                onClick={() => setPreview((value) => !value)}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                {preview ? <PencilIcon aria-hidden="true" className="size-3.5" /> : <EyeIcon aria-hidden="true" className="size-3.5" />}
                {preview ? t('Write') : t('Preview')}
              </Button>
            </div>
            {preview ? (
              <div
                data-slot="skill-editor-preview"
                className="max-h-80 min-h-24 overflow-y-auto rounded-md border border-input bg-muted/20 px-3 py-2 text-sm"
              >
                <Markdown>{body || `# ${name || '…'}`}</Markdown>
              </div>
            ) : (
              <Textarea
                id="skill-body"
                data-slot="skill-editor-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t('Markdown instructions for the agent')}
                className="min-h-40"
              />
            )}
          </div>
        </div>

        <DialogFooter className="mt-5">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            type="button"
            data-slot="skill-editor-save"
            disabled={!nameValid || body.trim() === '' || saving}
            onClick={() => void save()}
          >
            {skill ? t('Save') : t('Create skill')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
