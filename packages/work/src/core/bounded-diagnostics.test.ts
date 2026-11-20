import { describe, expect, it } from 'vitest';
import { BoundedDiagnostics } from './bounded-diagnostics.ts';

describe('bounded runner diagnostics (A4)', () => {
  it('preserves short diagnostics byte for byte across chunk boundaries', () => {
    const diagnostics = new BoundedDiagnostics(1024);
    diagnostics.append('startup\n'); diagnostics.append('Tiếng Việt 🦊\n');
    expect(diagnostics.text()).toBe('startup\nTiếng Việt 🦊\n');
  });

  it('bounds repeated output while retaining startup and latest failure', () => {
    const diagnostics = new BoundedDiagnostics(1024);
    diagnostics.append('authentication startup error\n');
    for (let i = 0; i < 2000; i++) diagnostics.append('x'.repeat(100));
    diagnostics.append('\nfatal: disk full');
    const value = diagnostics.text();
    expect(value.length).toBeLessThanOrEqual(1024);
    expect(value).toMatch(/^authentication startup error/);
    expect(value).toContain('diagnostics truncated');
    expect(value).toMatch(/fatal: disk full$/);
  });

  it('bounds a single oversized chunk and keeps surrogate pairs intact', () => {
    const diagnostics = new BoundedDiagnostics(1024);
    diagnostics.append('🦊'.repeat(100_000));
    diagnostics.append('🦊'.repeat(100_000));
    const value = diagnostics.text();
    expect(value.length).toBeLessThanOrEqual(1024);
    expect(Buffer.from(value).toString('utf8')).toBe(value);
  });

  it('does not truncate an exactly full buffer', () => {
    const diagnostics = new BoundedDiagnostics(1024);
    diagnostics.append('a'.repeat(1024));
    expect(diagnostics.text()).toBe('a'.repeat(1024));
    diagnostics.append('b');
    expect(diagnostics.text()).toMatch(/b$/);
    expect(diagnostics.text().length).toBeLessThanOrEqual(1024);
  });
});
