import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient } from '@/api/query-client'
import type { Skill } from '@onni/api-client'
import { SkillEditor } from '@/components/skill-editor'
import { Toaster, resetToasts } from '@/components/ui/toaster'

/**
 * The onni-managed skill create/edit form. Driven through a stubbed `fetch` so the request BODY
 * on the wire — especially the `scope` field on create, absent on edit, and a rename sending the
 * new `name` — is what the assertions read, matching the server contract in
 * `packages/contract/src/skills.ts`.
 */

const fetchMock = vi.fn<typeof fetch>()

const posted: Array<{ method: string; path: string; body: unknown }> = []

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function savedSkill(over: Partial<Skill> = {}): Skill {
  return {
    name: 'fresh',
    body: 'Body',
    path: '.ai/onni/skills/fresh/SKILL.md',
    source: 'onni',
    owned: true,
    scope: 'project',
    ...over,
  }
}

beforeEach(() => {
  posted.length = 0
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined
    posted.push({ method, path: url.pathname, body })
    if (url.pathname.endsWith('/skills') && method === 'POST') return json({ skill: savedSkill({ name: (body as { name: string }).name }) }, 201)
    if (/\/skills\/[^/]+$/.test(url.pathname) && method === 'PUT') return json({ skill: savedSkill({ name: (body as { name?: string }).name }) })
    if (/\/skills\/[^/]+$/.test(url.pathname) && method === 'DELETE') return json({ deleted: true })
    return json({ error: `unexpected ${method} ${url.pathname}` }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  act(() => resetToasts())
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

function renderEditor(skill: Skill | null, onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SkillEditor open skill={skill} onClose={onClose} onSaved={onSaved} />
      <Toaster />
    </QueryClientProvider>,
  )
  return { onSaved, onClose }
}

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null
const nameInput = () => slot('skill-editor-name') as HTMLInputElement
const bodyInput = () => slot('skill-editor-body') as HTMLTextAreaElement
const saveButton = () => slot('skill-editor-save') as HTMLButtonElement

describe('SkillEditor', () => {
  it('creates a skill, sending the chosen scope, and reports the new skill back', async () => {
    const onSaved = vi.fn()
    renderEditor(null, onSaved)
    await waitFor(() => expect(slot('skill-editor-scope')).toBeTruthy())
    expect(slot('skill-editor-scope')!.className).toContain('rounded-sm')
    expect(slot('skill-editor-scope')!.className).toContain('bg-background')

    fireEvent.change(nameInput(), { target: { value: 'deploy-checklist' } })
    fireEvent.change(slot('skill-editor-description') as HTMLInputElement, { target: { value: 'Deploy a change' } })
    // AppSelect is a Radix Select: click the trigger, then the option.
    fireEvent.click(slot('skill-editor-scope') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[role="option"][data-value="global"]')).not.toBeNull())
    fireEvent.click(document.querySelector('[role="option"][data-value="global"]')!)
    fireEvent.change(bodyInput(), { target: { value: '# Deploy\n\nSteps here.' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(posted.some((r) => r.method === 'POST')).toBe(true))
    const create = posted.find((r) => r.method === 'POST')!
    expect(create.body).toMatchObject({ name: 'deploy-checklist', description: 'Deploy a change', scope: 'global', body: '# Deploy\n\nSteps here.' })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'deploy-checklist' })))
  })

  it('edits in place: no scope field, and a rename sends the new name', async () => {
    const original = savedSkill({ name: 'old-name', description: 'before', body: 'Old' })
    renderEditor(original)
    await waitFor(() => expect(slot('skill-editor-name')).toBeTruthy())
    expect(slot('skill-editor-scope')).toBeNull()

    fireEvent.change(nameInput(), { target: { value: 'new-name' } })
    fireEvent.change(bodyInput(), { target: { value: 'New body' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(posted.some((r) => r.method === 'PUT')).toBe(true))
    const update = posted.find((r) => r.method === 'PUT')!
    expect(update.path).toContain('old-name')
    expect(update.body).toMatchObject({ name: 'new-name', body: 'New body' })
    expect(JSON.stringify(update.body)).not.toContain('scope')
  })

  it('disables Save until the name is valid and the body is non-empty', async () => {
    renderEditor(null)
    await waitFor(() => expect(slot('skill-editor-scope')).toBeTruthy())
    expect(saveButton().disabled).toBe(true)

    fireEvent.change(nameInput(), { target: { value: 'bad name' } })
    expect(saveButton().disabled).toBe(true)
    expect(slot('skill-editor-name-hint')).toBeTruthy()

    fireEvent.change(nameInput(), { target: { value: 'good-name' } })
    expect(saveButton().disabled).toBe(true) // body still empty

    fireEvent.change(bodyInput(), { target: { value: 'Body' } })
    expect(saveButton().disabled).toBe(false)
  })

  it('toggles between the body textarea and a live Markdown preview', async () => {
    renderEditor(null)
    await waitFor(() => expect(slot('skill-editor-scope')).toBeTruthy())
    fireEvent.change(bodyInput(), { target: { value: '# Heading\n\nText' } })
    fireEvent.click(slot('skill-editor-preview-toggle') as HTMLButtonElement)
    await waitFor(() => expect(slot('skill-editor-preview')).toBeTruthy())
    expect(slot('skill-editor-preview')?.textContent).toContain('Heading')
    expect(slot('skill-editor-body')).toBeNull()

    fireEvent.click(slot('skill-editor-preview-toggle') as HTMLButtonElement)
    expect(slot('skill-editor-body')).toBeTruthy()
    expect(slot('skill-editor-preview')).toBeNull()
  })
})
