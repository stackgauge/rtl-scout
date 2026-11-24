/**
 * Verible adapter.
 *
 * Wraps `verible-verilog-lint` (https://github.com/chipsalliance/verible):
 * builds its argv and parses its output into normalized {@link LintFinding}s.
 * The parser is pure so it can be unit-tested against captured fixtures with no
 * linter installed.
 */

import type { LintFinding } from '../types';

/** The binary rtl-scout invokes for the Verible adapter. */
export const VERIBLE_BIN = 'verible-verilog-lint';

/** Build the argv for a Verible lint run over the given files. */
export function buildVeribleArgs(files: string[]): string[] {
  // Verible prints one finding per line to stdout and exits non-zero on findings.
  return [...files];
}

/**
 * Parse `verible-verilog-lint` output into findings.
 *
 * Verible emits lines shaped like:
 *   path/to/file.sv:12:7: <message> [<rule-name>]
 *   path/to/file.sv:12:7-19: <message> [<rule-name>]
 *
 * Verible lint does not tier severities, so every finding is mapped to
 * `warning`. Lines that do not match are ignored.
 */
export function parseVeribleOutput(stdout: string): LintFinding[] {
  const line_re = /^(.*?):(\d+):(\d+)(?:-\d+)?:\s*(.*?)\s*\[([\w./-]+)\]\s*$/;
  const findings: LintFinding[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.trimEnd();
    if (line.length === 0) {
      continue;
    }
    const m = line_re.exec(line);
    if (!m) {
      continue;
    }
    findings.push({
      file: m[1]!,
      line: Number(m[2]),
      col: Number(m[3]),
      message: m[4]!,
      rule: m[5]!,
      severity: 'warning',
    });
  }
  return findings;
}
