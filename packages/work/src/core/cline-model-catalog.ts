import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { z } from 'zod';
import { trackChildExit } from './agent-runner.ts';
import { AcpClient } from './acp-client.ts';
import { buildChildEnv } from './agent-env.ts';
import type { ModelOption } from './runner-model-catalog.ts';
import { spawnableCommand } from './windows-shim.ts';

export interface ClineModelDiscoveryOptions {
  cwd: string;
  bin?: string;
  timeoutMs?: number;
  spawn?: (bin: string, args: readonly string[], cwd: string) => ChildProcessWithoutNullStreams;
}

const DEFAULT_DISCOVERY_TIMEOUT_MS = 15_000;
/** Grace between the probe's SIGTERM and the SIGKILL that follows it. */
const KILL_GRACE_MS = 2_000;
const MAX_MODELS = 500;

/**
 * The host binary, resolved the same way the Cline runner resolves it. The catalog and the runner
 * must agree on which binary they probe — a mismatch would list one CLI's models and run another's.
 */
export function resolveClineExecutable(bin?: string): string {
  return bin ?? process.env.ONNI_CLINE_BIN ?? 'cline';
}

const sessionSchema = z
  .object({
    models: z
      .object({
        availableModels: z.array(
          z.object({ modelId: z.string(), name: z.string().optional() }).passthrough(),
        ),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Discover the models the host's Cline installation offers by asking the CLI over ACP: a
 * short-lived `cline --acp` child whose `session/new` answer carries `models.availableModels` —
 * the same list Cline's own picker routes to (#1035). No login is performed and no session is
 * kept; the child is bounded by a deadline and killed on the way out.
 *
 * Best-effort by contract — `RunnerModelCatalog` turns any throw here into a cached or
 * `unavailable` answer, and `auto` stays selectable either way.
 */
export async function discoverClineModels(options: ClineModelDiscoveryOptions): Promise<ModelOption[]> {
  const bin = resolveClineExecutable(options.bin);
  const child = (options.spawn ?? spawnCline)(bin, ['--acp'], options.cwd);
  const kill = teardown(child);
  const client = new AcpClient(child.stdin, child.stdout);
  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  let timeout: NodeJS.Timeout | undefined;

  const reading = client.run();
  void reading.catch(() => undefined);

  try {
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        client.close('Cline model discovery timed out');
        reject(new Error('Cline model discovery timed out'));
      }, timeoutMs);
      timeout.unref?.();
    });
    const exited = new Promise<never>((_, reject) => {
      child.once('error', () => {
        client.close('Cline model discovery child failed');
        reject(new Error('Cline model discovery child failed'));
      });
      child.once('exit', (code) => {
        client.close('Cline model discovery child exited');
        reject(new Error(`Cline model discovery child exited (${code ?? 'unknown'})`));
      });
    });
    const discovered = (async (): Promise<ModelOption[]> => {
      await client.initialize(timeoutMs);
      const session = await client.newSession(options.cwd, timeoutMs);
      return parseClineModels(session);
    })();
    return await Promise.race([discovered, deadline, exited]);
  } finally {
    if (timeout) clearTimeout(timeout);
    kill();
    client.close('discovery finished');
  }
}

/**
 * Turn a `session/new` result into picker options, preserving Cline's own order. A missing
 * `models` block (a CLI that answered in a dialect onni cannot read) is a failure, not an empty
 * catalog: reporting "unavailable" is more honest than "you have no models".
 */
export function parseClineModels(session: unknown): ModelOption[] {
  const parsed = sessionSchema.safeParse(session);
  if (!parsed.success || !parsed.data.models) {
    throw new Error('Cline model discovery returned no model list');
  }
  const available = parsed.data.models.availableModels ?? [];
  if (available.length > MAX_MODELS) throw new Error('Cline model discovery exceeded the size limit');
  const seen = new Set<string>();
  return available.flatMap((entry) => {
    const id = entry.modelId.trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const provider = id.slice(0, id.indexOf('/'));
    return [{ id, label: entry.name?.trim() || id, description: provider ? `via ${provider}` : '' }];
  });
}

function spawnCline(
  bin: string,
  args: readonly string[],
  cwd: string,
): ChildProcessWithoutNullStreams {
  const child = nodeSpawn(...spawnableCommand(bin, args), {
    windowsHide: true,
    cwd,
    env: buildChildEnv({ backend: 'cline' }),
  });
  // Closing a pipe the child already dropped reports EPIPE as an async 'error'; the read loop and
  // the teardown own settlement.
  child.stdin.on('error', () => {});
  child.stderr.resume();
  return child;
}

/** SIGTERM now, SIGKILL once the grace window elapses — gated on real termination, never on
 *  `child.killed` (Node flips that flag on signal delivery, not on exit). */
function teardown(child: ChildProcessWithoutNullStreams): () => void {
  const hasExited = trackChildExit(child);
  let signalled = false;
  return () => {
    if (signalled || hasExited()) return;
    signalled = true;
    child.kill('SIGTERM');
    const escalation = setTimeout(() => {
      if (hasExited()) return;
      child.kill('SIGKILL');
    }, KILL_GRACE_MS);
    escalation.unref?.();
  };
}
