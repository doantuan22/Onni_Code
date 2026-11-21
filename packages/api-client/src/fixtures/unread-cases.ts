// Survey Part A §3.5: shared golden data for the duplicated timestamp rule, imported by
// tests only (not the public barrel). Sequence/visibility UI policy is outside this table.
const finished = {
  status: 'done',
  finishedAt: '2020-01-02T00:00:00.000Z',
  seenAt: undefined,
  archived: false,
  autoResumeAt: undefined,
  awaitingAnswerSince: undefined,
} as const

export const unreadCases = [
  { name: 'done, never seen', run: finished, unread: true },
  { name: 'failed, never seen', run: { ...finished, status: 'failed' }, unread: true },
  { name: 'done, seen before finishing', run: { ...finished, seenAt: '2020-01-01T00:00:00.000Z' }, unread: true },
  { name: 'failed, seen before finishing', run: { ...finished, status: 'failed', seenAt: '2020-01-01T00:00:00.000Z' }, unread: true },
  { name: 'done, seen at finish', run: { ...finished, seenAt: finished.finishedAt }, unread: false },
  { name: 'failed, seen at finish', run: { ...finished, status: 'failed', seenAt: finished.finishedAt }, unread: false },
  { name: 'done, seen after finish', run: { ...finished, seenAt: '2020-01-03T00:00:00.000Z' }, unread: false },
  { name: 'failed, seen after finish', run: { ...finished, status: 'failed', seenAt: '2020-01-03T00:00:00.000Z' }, unread: false },
  { name: 'done without finish', run: { ...finished, finishedAt: undefined }, unread: false },
  { name: 'failed without finish', run: { ...finished, status: 'failed', finishedAt: undefined }, unread: false },
  { name: 'archived done', run: { ...finished, archived: true }, unread: false },
  { name: 'archived failed', run: { ...finished, status: 'failed', archived: true }, unread: false },
  { name: 'cancelled', run: { ...finished, status: 'cancelled' }, unread: false },
  { name: 'queued even with finish', run: { ...finished, status: 'queued' }, unread: false },
  { name: 'running even with finish', run: { ...finished, status: 'running' }, unread: false },
  { name: 'waiting even with finish', run: { ...finished, status: 'waiting' }, unread: false },
  { name: 'review even with finish', run: { ...finished, status: 'review' }, unread: false },
  { name: 'failed with scheduled resume', run: { ...finished, status: 'failed', autoResumeAt: '2020-01-03T00:00:00.000Z' }, unread: false },
  { name: 'failed awaiting answer', run: { ...finished, status: 'failed', awaitingAnswerSince: '2020-01-01T00:00:00.000Z' }, unread: false },
  { name: 'failed with both pending signals', run: { ...finished, status: 'failed', autoResumeAt: '2020-01-03T00:00:00.000Z', awaitingAnswerSince: '2020-01-01T00:00:00.000Z' }, unread: false },
  { name: 'done ignores stale resume signal', run: { ...finished, autoResumeAt: '2020-01-03T00:00:00.000Z' }, unread: true },
  { name: 'done ignores stale answer signal', run: { ...finished, awaitingAnswerSince: '2020-01-01T00:00:00.000Z' }, unread: true },
] as const
