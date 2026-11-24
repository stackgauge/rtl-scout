/** Shared types for rtl-scout. */

/** Severity of a lint finding, ordered least to most severe. */
export type Severity = 'info' | 'style' | 'warning' | 'error';

/** A single lint finding against one source location. */
export interface LintFinding {
  /** Source file path (as the linter reported it). */
  file: string;
  line: number;
  col: number;
  /** Lint rule id, e.g. "line-length". */
  rule: string;
  severity: Severity;
  message: string;
}

/** Result of linting a set of files with one tool. */
export interface LintReport {
  /** The linter that produced the findings, e.g. "verible". */
  tool: string;
  findings: LintFinding[];
  /** Number of source files scanned. */
  filesScanned: number;
}

/** Letter grade for a design's lint cleanliness. */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** A cleanliness scorecard derived from lint findings. */
export interface Scorecard {
  /** 0–100 score (100 = clean). */
  score: number;
  grade: Grade;
  /** Finding counts by severity. */
  counts: Record<Severity, number>;
  /** One-line verdict. */
  summary: string;
}
