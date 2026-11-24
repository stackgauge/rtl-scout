/**
 * Source discovery and linter invocation.
 *
 * The only impure layer: finds `.sv`/`.v` sources, locates the linter binary on
 * PATH, and shells out to it. Parsing/grading live in pure modules so they can
 * be tested without any linter installed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

import type { LintReport } from './types';
import { VERIBLE_BIN, buildVeribleArgs, parseVeribleOutput } from './adapters/verible';

/** Recognized RTL source extensions. */
const RTL_EXTENSIONS = new Set(['.v', '.sv', '.svh', '.vh']);

/** Error thrown when the required linter binary is not on PATH. */
export class LinterNotFoundError extends Error {
  constructor(public readonly binary: string) {
    super(`Linter "${binary}" not found on PATH. Install Verible (e.g. \`brew install verible\`).`);
    this.name = 'LinterNotFoundError';
  }
}

/** Locate an executable by name on PATH; null when absent. */
export function findBinary(name: string): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

/** Expand file/directory paths into a de-duplicated list of RTL source files. */
export function collectSources(paths: string[]): string[] {
  const found = new Set<string>();

  const walk = (p: string): void => {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(p);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p)) {
        if (entry === 'node_modules' || entry.startsWith('.')) {
          continue;
        }
        walk(path.join(p, entry));
      }
    } else if (stat.isFile() && RTL_EXTENSIONS.has(path.extname(p).toLowerCase())) {
      found.add(path.resolve(p));
    }
  };

  for (const p of paths) {
    walk(p);
  }
  return [...found].sort();
}

/**
 * Run Verible over the given files and return a normalized report.
 *
 * `verible-verilog-lint` exits non-zero when it finds issues, so a non-zero
 * exit with captured stdout is the normal path, not an error.
 */
export function runVerible(files: string[], binPath?: string): LintReport {
  const bin = binPath ?? findBinary(VERIBLE_BIN);
  if (!bin) {
    throw new LinterNotFoundError(VERIBLE_BIN);
  }

  let stdout = '';
  try {
    stdout = execFileSync(bin, buildVeribleArgs(files), {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as { stdout?: string | Buffer; code?: string };
    if (e.stdout !== undefined && e.stdout !== null) {
      stdout = typeof e.stdout === 'string' ? e.stdout : e.stdout.toString('utf8');
    } else {
      throw err; // genuine spawn failure (not a lint non-zero exit)
    }
  }

  return {
    tool: 'verible',
    findings: parseVeribleOutput(stdout),
    filesScanned: files.length,
  };
}
