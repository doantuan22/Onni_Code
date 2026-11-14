import { z } from 'zod';
// `StartTodoResponse` embeds a whole run record, which belongs to the runs slice.
import { runRecordSchema } from './runs.ts';

// ---- skills (`GET /skills`, `POST /skills`, `PUT /skills/:name`, `DELETE /skills/:name`, `POST /skills/refresh`) ---------------------------------------

/** A skill name is one directory name — no separators, never `.`/`..`, no leading dot. Shared
 *  with the provisioner (`skills-provision.ts` re-exports this) so the store and the worktree
 *  installer enforce the same rule from one source. */
export const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * One discovered skill: repo (`.ai/skills`, `.ai/onni/skills`), onni-managed
 * (`~/.onni/skills`), `npx skills` install dirs (project + global), a configured team skills
 * repo (spec 005), or the one built-in.
 */
export const skillSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** Advisory hint for untouched composer run-mode choices. */
  interactive: z.literal(true).optional(),
  body: z.string(),
  path: z.string(),
  /** `builtin`: the one skill onni ships itself (`create-onni-automation`), served only while
   *  GitHub automations are on and reachable (spec 2026-09-13-automations-from-prompt).
   *  `onni-global`: an onni-managed skill under `~/.onni/skills` (all projects). */
  source: z.enum(['ai', 'onni', 'agents', 'global', 'team', 'builtin', 'onni-global']),
  /** True when onni wrote this skill (`source` is `onni` or `onni-global`) — the UI's
   *  create/edit/delete affordances key off this rather than guessing from the path. */
  owned: z.boolean().optional(),
  /** Onni-managed skills only: `project` (`.ai/onni/skills`) or `global` (`~/.onni/skills`). */
  scope: z.enum(['project', 'global']).optional(),
  /** Team skills only: where the definition lives in its skills repo. */
  team: z
    .object({
      repo: z.string(),
      ref: z.string(),
      path: z.string(),
      /** True for the `SKILL.md` convention — a whole directory (references/…). */
      dir: z.boolean(),
      /**
       * The exact commit `ref` resolved to when the skill was read (#428).
       *
       * The hand-written DTO omitted this field entirely — it was NARROWER than the route,
       * which has served it since #428.
       */
      commit: z.string().optional(),
    })
    .optional(),
});
export type Skill = z.infer<typeof skillSchema>;

/** `POST /skills` — create an onni-managed skill in the chosen scope. */
export const createSkillInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(SKILL_NAME_PATTERN, 'letters, numbers, and . _ - only (must start with a letter or number)'),
  description: z.string().max(2000).optional(),
  interactive: z.boolean().optional(),
  body: z.string().min(1).max(50_000),
  scope: z.enum(['project', 'global']),
});
export type CreateSkillInput = z.infer<typeof createSkillInputSchema>;

/** `PUT /skills/:name` — edit an onni-managed skill. Omitted fields stay as they are; an empty
 *  `description` clears it; `interactive: false` clears the hint. */
export const updateSkillInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(SKILL_NAME_PATTERN, 'letters, numbers, and . _ - only (must start with a letter or number)')
    .optional(),
  description: z.string().max(2000).optional(),
  interactive: z.boolean().optional(),
  body: z.string().min(1).max(50_000).optional(),
});
export type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;

/** `POST /skills` and `PUT /skills/:name` answer the skill as read back from disk. */
export const skillSavedResponseSchema = z.object({
  skill: skillSchema,
});
export type SkillSavedResponse = z.infer<typeof skillSavedResponseSchema>;

/** `DELETE /skills/:name` — `deleted` is the LITERAL `true`: a miss is a 404 `{ error }`. */
export const deleteSkillResponseSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteSkillResponse = z.infer<typeof deleteSkillResponseSchema>;

/**
 * A skill offered by the default (vendor) repo, from `GET /skills/importable`, independent of
 * whether it is enabled. The full definition lets the Skills catalog preview it before enabling.
 */
export const importableSkillSchema = skillSchema;
export type ImportableSkill = z.infer<typeof importableSkillSchema>;

// ---- follow-up inbox / todos (spec 007) ---------------------------------------------------

/** One entry of `.ai/onni/todos.json`, as `GET /todos` serves it (ids are backfilled on read). */
export const todoItemSchema = z.object({
  id: z.string(),
  ts: z.string().optional(),
  taskId: z.string().optional(),
  summary: z.string().min(1),
  action: z.string().optional(),
  prUrl: z.string().optional(),
  suggestedSkill: z.string().optional(),
  suggestedArgs: z.string().optional(),
  suggestedPrompt: z.string().optional(),
  /** Explicit intent; missing infers from suggestedSkill/suggestedPrompt for old files. */
  runnable: z.boolean().optional(),
  /** Set once a task was started from this entry — it then leaves the inbox and stays as
   *  the audit trail. A later launch never overwrites the first. */
  startedTaskId: z.string().optional(),
});
export type TodoItem = z.infer<typeof todoItemSchema>;

/**
 * `DELETE /todos/:id` — Dismiss checks the entry off.
 *
 * `removed` is the LITERAL `true`: a miss is a 404 `{ error }`, never `{ removed: false }`.
 * The hand-written DTO said `boolean`, which was wider than the route.
 */
export const removeTodoResponseSchema = z.object({
  removed: z.literal(true),
});
export type RemoveTodoResponse = z.infer<typeof removeTodoResponseSchema>;

/** `POST /todos/:id/start` — 201 with the run the entry became. */
export const startTodoResponseSchema = z.object({
  run: runRecordSchema,
});
export type StartTodoResponse = z.infer<typeof startTodoResponseSchema>;
