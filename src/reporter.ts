/**
 * Terminal reporter. ANSI escapes directly (no deps); color disabled when not a
 * TTY or NO_COLOR is set.
 */

import type { Grade, LintFinding, LintReport, Scorecard, Severity } from './types';

const COLOR_ENABLED = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  orange: '\x1b[38;5;208m',
} as const;

function paint(code: keyof typeof CODES, text: string): string {
  return COLOR_ENABLED ? `${CODES[code]}${text}${CODES.reset}` : text;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function heading(text: string): string {
  return paint('cyan', paint('bold', `\n${text}`));
}

const GRADE_COLOR: Record<Grade, keyof typeof CODES> = {
  A: 'green',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

const SEVERITY_COLOR: Record<Severity, keyof typeof CODES> = {
  error: 'red',
  warning: 'yellow',
  style: 'cyan',
  info: 'gray',
};

/** Render the prominent, shareable cleanliness grade banner. */
export function renderScorecard(scorecard: Scorecard): string {
  const badge = paint(GRADE_COLOR[scorecard.grade], paint('bold', `  ${scorecard.grade}  `));
  const score = paint('gray', `${scorecard.score}/100`);
  const verdict = scorecard.summary.replace(/^Grade [A-F] — /, '');
  return ['', `  [${badge}]  ${paint('bold', 'Lint grade')}  ${score}`, `  ${verdict}`].join('\n');
}

/** Render the findings, grouped by file. */
export function renderFindings(findings: LintFinding[]): string {
  if (findings.length === 0) {
    return paint('green', '  ✓ No lint findings.');
  }
  const byFile = new Map<string, LintFinding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file);
    if (list) list.push(f);
    else byFile.set(f.file, [f]);
  }

  const lines: string[] = [];
  for (const [file, list] of byFile) {
    lines.push('  ' + paint('bold', file));
    for (const f of list) {
      const loc = paint('gray', pad(`${f.line}:${f.col}`, 8));
      const sev = paint(SEVERITY_COLOR[f.severity], pad(f.severity.toUpperCase(), 7));
      lines.push(`    ${loc} ${sev} ${f.message} ${paint('gray', `[${f.rule}]`)}`);
    }
  }
  return lines.join('\n');
}

/** Render a full lint report: grade banner + findings. */
export function renderReport(report: LintReport, scorecard: Scorecard): string {
  const header =
    paint('bold', `rtl-scout (${report.tool})`) +
    paint('gray', `  ${report.filesScanned} file${report.filesScanned === 1 ? '' : 's'} scanned`);
  return [
    '',
    header,
    renderScorecard(scorecard),
    heading('Findings'),
    renderFindings(report.findings),
  ].join('\n');
}
