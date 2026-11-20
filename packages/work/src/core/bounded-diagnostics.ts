const TRUNCATED = '\n[diagnostics truncated]\n';

/** Keep startup context and the latest errors, bounded in UTF-16 units (spec 2026-11-20-agent-runner-repairs). */
export class BoundedDiagnostics {
  private head = '';
  private tail = '';
  private truncated = false;

  constructor(private readonly limit = 64 * 1024) {
    if (!Number.isInteger(limit) || limit < 128) throw new RangeError('Diagnostic limit must be at least 128');
  }

  append(chunk: string): void {
    if (!this.truncated && this.head.length + chunk.length <= this.limit) {
      this.head += chunk;
      return;
    }
    const headLimit = Math.floor((this.limit - TRUNCATED.length) / 4);
    const tailLimit = this.limit - TRUNCATED.length - headLimit;
    const previous = this.truncated ? this.tail : this.head;
    this.tail = suffix(previous + chunk.slice(-tailLimit), tailLimit);
    if (!this.truncated) this.head = prefix(this.head + chunk.slice(0, headLimit), headLimit);
    this.truncated = true;
  }

  text(): string {
    return this.truncated ? this.head + TRUNCATED + this.tail : this.head;
  }
}

function prefix(value: string, limit: number): string {
  const result = value.slice(0, limit);
  const last = result.charCodeAt(result.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? result.slice(0, -1) : result;
}

function suffix(value: string, limit: number): string {
  const result = value.slice(-limit);
  const first = result.charCodeAt(0);
  return first >= 0xdc00 && first <= 0xdfff ? result.slice(1) : result;
}
