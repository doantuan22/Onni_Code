import { describe, expect, it } from 'vitest';
import { assertWindowsCommandLine, quoteWindowsArgument } from './windows-command-line.ts';

describe('CreateProcessW command line length (A5)', () => {
  it('quotes literal arguments like the native task launcher', () => {
    expect(quoteWindowsArgument('')).toBe('""');
    expect(quoteWindowsArgument('a&b')).toBe('a&b');
    expect(quoteWindowsArgument('a b\\')).toBe('"a b\\\\"');
    expect(quoteWindowsArgument('a"b')).toBe('"a\\"b"');
  });

  it('includes executable, spaces and terminating null at the exact boundary', () => {
    expect(() => assertWindowsCommandLine('x', ['a'.repeat(32764)])).not.toThrow();
    expect(() => assertWindowsCommandLine('x', ['a'.repeat(32765)])).toThrow(/32768.*32767/);
  });

  it('counts quote escaping and UTF-16 units without including secrets in errors', () => {
    expect(() => assertWindowsCommandLine('x', ['🦊'.repeat(16382)])).not.toThrow();
    expect(() => assertWindowsCommandLine('x', ['🦊'.repeat(16383)])).toThrow('command line');
    expect(() => assertWindowsCommandLine('x', ['"'.repeat(17000)])).toThrow('command line');
    try { assertWindowsCommandLine('x', ['private-prompt-' + 'a'.repeat(33000)]); }
    catch (error) { expect(String(error)).not.toContain('private-prompt-'); }
  });
});
