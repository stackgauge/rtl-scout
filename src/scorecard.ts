/**
 * Lint cleanliness scorecard.
 *
 * Turns lint findings into a letter grade (A–F), a numeric score, and a
 * one-line verdict — the shareable headline of a run. Zero dependencies.
 */

import type { Grade, LintFinding, Scorecard, Severity } from './types';

/** Points deducted per finding, by severity. */
const WEIGHTS: Record<Severity, number> = { error: 20, warning: 4, style: 2, info: 0 };

const EMPTY_COUNTS: Record<Severity, number> = { error: 0, warning: 0, style: 0, info: 0 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function gradeForScore(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Compute a {@link Scorecard} from lint findings. */
export function computeScorecard(findings: LintFinding[]): Scorecard {
  const counts: Record<Severity, number> = { ...EMPTY_COUNTS };
  let penalty = 0;
  for (const f of findings) {
    counts[f.severity] += 1;
    penalty += WEIGHTS[f.severity];
  }

  const score = clamp(100 - penalty, 0, 100);
  const grade = gradeForScore(score);

  let summary: string;
  if (findings.length === 0) {
    summary = `Grade ${grade} — clean, no lint findings`;
  } else {
    const parts = (['error', 'warning', 'style', 'info'] as Severity[])
      .filter((s) => counts[s] > 0)
      .map((s) => `${counts[s]} ${s}`);
    summary = `Grade ${grade} — ${parts.join(', ')}`;
  }

  return { score, grade, counts, summary };
}
