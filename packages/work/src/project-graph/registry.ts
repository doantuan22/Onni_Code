import { ProjectGraphService, type BuildOutcome } from './index.ts';
import { selectTestsAdapter } from './tests-select/index.ts';

/** One rebuild per root per window; a faster request is refused with `accepted:false` (N1). */
export const REBUILD_MIN_INTERVAL_MS = 10_000;

/** `onni graph tests --runner` / `?runner=1` only spawn `vitest related` with this opt-in. */
export function graphToolsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ONNI_PROJECT_GRAPH_TOOLS === '1';
}

export function createGraphService(root: string): ProjectGraphService {
  return new ProjectGraphService(root, { selectTests: selectTestsAdapter });
}

export type RebuildOutcome = BuildOutcome | { started: false; throttled: true; status: Awaited<ReturnType<ProjectGraphService['getStatus']>>; reason: string };

/**
 * Lazy map of one service per project root. Nothing here builds at creation or on read: a build
 * happens only through {@link rebuild}.
 */
export class ProjectGraphRegistry {
  private readonly services = new Map<string, ProjectGraphService>();
  private readonly lastRebuild = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  service(root: string): ProjectGraphService {
    let s = this.services.get(root);
    if (!s) {
      s = createGraphService(root);
      this.services.set(root, s);
    }
    return s;
  }

  async rebuild(root: string, opts: { full?: boolean } = {}): Promise<RebuildOutcome> {
    const service = this.service(root);
    const last = this.lastRebuild.get(root);
    const t = this.now();
    if (last !== undefined && t - last < REBUILD_MIN_INTERVAL_MS) {
      const wait = Math.ceil((REBUILD_MIN_INTERVAL_MS - (t - last)) / 1000);
      return { started: false, throttled: true, status: await service.getStatus(), reason: `rebuilt moments ago; try again in ${wait}s` };
    }
    this.lastRebuild.set(root, t);
    return service.build(opts);
  }
}
