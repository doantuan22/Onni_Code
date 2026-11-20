/** Mirror windows-job-spawn.ps1's literal argv quoting (spec 2026-11-20-agent-runner-repairs). */
export function quoteWindowsArgument(value: string): string {
  if (value.length > 0 && !/[ \t\n\v"]/.test(value)) return value;
  return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}

/** CreateProcessW includes the terminating null in its 32,767 UTF-16-unit limit. */
export function assertWindowsCommandLine(file: string, args: readonly string[]): void {
  const units = [file, ...args].reduce((total, value) => total + quoteWindowsArgument(value).length + 1, 0);
  if (units > 32767) {
    throw new Error(`Windows task command line is ${units} UTF-16 code units; maximum is 32767. Shorten the prompt or optional arguments.`);
  }
}
