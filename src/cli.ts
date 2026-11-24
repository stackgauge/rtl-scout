#!/usr/bin/env node
/**
 * rtl-scout — lint Verilog/SystemVerilog and get a cleanliness grade.
 *
 * Commands:
 *   lint <paths...>   Lint RTL files/directories via Verible and grade them.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { LintFinding, Severity } from './types';
import { collectSources, runVerible, LinterNotFoundError } from './runner';
import { computeScorecard } from './scorecard';
import { renderReport, renderScorecard } from './reporter';

/** Severity threshold for `--fail-on`; 'none' never fails on findings. */
type FailOn = Severity | 'none';

interface ParsedArgs {
  command: string | undefined;
  paths: string[];
  tool: string;
  failOn: FailOn;
  json: boolean;
  help: boolean;
  version: boolean;
}

const USAGE = `
rtl-scout — lint Verilog/SystemVerilog in CI and get a cleanliness grade

Usage:
  rtl-scout lint [paths...] [options]

Commands:
  lint              Lint RTL files/directories (defaults to the current dir)

Options:
  --tool <name>     Linter to use: verible | auto (default auto)
  --fail-on <sev>   Exit non-zero on a finding at/above none|info|style|warning|error (default warning)
  --json            Output machine-readable JSON
  -h, --help        Show this help
  -v, --version     Show version

Requires Verible on PATH (https://github.com/chipsalliance/verible):
  brew install verible     # macOS
  # or download a release binary for Linux/Windows

Examples:
  rtl-scout lint src/
  rtl-scout lint alu.sv fifo.sv --fail-on error
  rtl-scout lint rtl/ --json
`;

const FAIL_ON_LEVELS: readonly FailOn[] = ['none', 'info', 'style', 'warning', 'error'];
const SEVERITY_RANK: Record<Severity, number> = { info: 0, style: 1, warning: 2, error: 3 };

function setFailOn(parsed: ParsedArgs, value: string | undefined): void {
  if (value !== undefined && (FAIL_ON_LEVELS as readonly string[]).includes(value)) {
    parsed.failOn = value as FailOn;
    return;
  }
  throw new Error(`Invalid --fail-on "${value ?? ''}". Use one of: ${FAIL_ON_LEVELS.join(', ')}.`);
}

function setTool(parsed: ParsedArgs, value: string | undefined): void {
  if (value === 'verible' || value === 'auto') {
    parsed.tool = value;
    return;
  }
  throw new Error(`Invalid --tool "${value ?? ''}". Use one of: verible, auto.`);
}

/** Parse argv into a typed options object. */
export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: undefined,
    paths: [],
    tool: 'auto',
    failOn: 'warning',
    json: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      case '--version':
      case '-v':
        parsed.version = true;
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--fail-on':
        setFailOn(parsed, argv[++i]);
        break;
      case '--tool':
        setTool(parsed, argv[++i]);
        break;
      default:
        if (arg !== undefined && arg.startsWith('--fail-on=')) {
          setFailOn(parsed, arg.slice('--fail-on='.length));
        } else if (arg !== undefined && arg.startsWith('--tool=')) {
          setTool(parsed, arg.slice('--tool='.length));
        } else if (arg !== undefined && !arg.startsWith('-')) {
          if (parsed.command === undefined) {
            parsed.command = arg;
          } else {
            parsed.paths.push(arg);
          }
        }
        break;
    }
  }

  return parsed;
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** True when any finding is at or above the fail-on threshold. */
export function meetsFailThreshold(findings: LintFinding[], failOn: FailOn): boolean {
  if (failOn === 'none') {
    return false;
  }
  const threshold = SEVERITY_RANK[failOn];
  return findings.some((f) => SEVERITY_RANK[f.severity] >= threshold);
}

/** `lint` command. Returns a process exit code. */
function runLint(args: ParsedArgs): number {
  const paths = args.paths.length > 0 ? args.paths : ['.'];
  const files = collectSources(paths);

  if (files.length === 0) {
    process.stderr.write(`No RTL source files (.v/.sv/.svh) found under: ${paths.join(', ')}\n`);
    return 1;
  }

  let report;
  try {
    report = runVerible(files);
  } catch (err) {
    if (err instanceof LinterNotFoundError) {
      process.stderr.write(err.message + '\n');
      return 1;
    }
    throw err;
  }

  const scorecard = computeScorecard(report.findings);
  const gateFailed = meetsFailThreshold(report.findings, args.failOn);

  if (args.json) {
    process.stdout.write(JSON.stringify({ ...report, scorecard }, null, 2) + '\n');
    return gateFailed ? 2 : 0;
  }

  process.stdout.write(renderReport(report, scorecard) + '\n');
  // Restate the grade at the end for quick scanning in long logs.
  process.stdout.write(renderScorecard(scorecard) + '\n');
  return gateFailed ? 2 : 0;
}

/** Entry point. Returns a process exit code (does not call process.exit). */
export function main(argv: string[] = process.argv.slice(2)): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }

  if (args.version) {
    process.stdout.write(readVersion() + '\n');
    return 0;
  }
  if (args.help || args.command === undefined) {
    process.stdout.write(USAGE);
    return args.command === undefined && !args.help ? 1 : 0;
  }

  try {
    switch (args.command) {
      case 'lint':
        return runLint(args);
      default:
        process.stderr.write(`Unknown command: ${args.command}\n`);
        process.stdout.write(USAGE);
        return 1;
    }
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}
