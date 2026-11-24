import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parseVeribleOutput } from '../src/adapters/verible';
import { computeScorecard } from '../src/scorecard';
import { collectSources } from '../src/runner';
import * as runner from '../src/runner';
import { parseArgs, meetsFailThreshold, main } from '../src/cli';
import type { LintFinding } from '../src/types';

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'verible-output.txt'), 'utf8');

function finding(severity: LintFinding['severity'], over = {}): LintFinding {
  return { file: 'a.sv', line: 1, col: 1, rule: 'r', severity, message: 'm', ...over };
}

describe('parseVeribleOutput', () => {
  const findings = parseVeribleOutput(FIXTURE);

  it('parses each finding and ignores non-matching lines', () => {
    expect(findings).toHaveLength(4);
  });

  it('extracts file, position, message and rule', () => {
    const f = findings[0]!;
    expect(f.file).toBe('rtl/alu.sv');
    expect(f.line).toBe(7);
    expect(f.col).toBe(1);
    expect(f.rule).toBe('posix-eof');
    expect(f.severity).toBe('warning');
    expect(f.message).toBe('File must end with a newline.');
  });

  it('handles a column range (line:col-col)', () => {
    const f = findings.find((x) => x.rule === 'module-port-lower-snake-case')!;
    expect(f.line).toBe(20);
    expect(f.col).toBe(5);
  });

  it('returns nothing for empty output', () => {
    expect(parseVeribleOutput('')).toEqual([]);
  });
});

describe('computeScorecard', () => {
  it('grades a clean design A at 100', () => {
    const sc = computeScorecard([]);
    expect(sc.score).toBe(100);
    expect(sc.grade).toBe('A');
    expect(sc.summary).toMatch(/clean/i);
  });

  it('deducts per severity and counts them', () => {
    const sc = computeScorecard([finding('error'), finding('warning'), finding('warning'), finding('style')]);
    // 20 + 4 + 4 + 2 = 30 penalty -> 70 -> C
    expect(sc.score).toBe(70);
    expect(sc.grade).toBe('C');
    expect(sc.counts).toEqual({ error: 1, warning: 2, style: 1, info: 0 });
    expect(sc.summary).toContain('1 error');
  });

  it('floors at 0', () => {
    const many = Array.from({ length: 10 }, () => finding('error'));
    expect(computeScorecard(many).score).toBe(0);
    expect(computeScorecard(many).grade).toBe('F');
  });
});

describe('meetsFailThreshold', () => {
  const warnOnly = [finding('warning')];
  it('fails at or above threshold', () => {
    expect(meetsFailThreshold(warnOnly, 'warning')).toBe(true);
    expect(meetsFailThreshold(warnOnly, 'error')).toBe(false);
    expect(meetsFailThreshold(warnOnly, 'style')).toBe(true);
    expect(meetsFailThreshold(warnOnly, 'none')).toBe(false);
  });
});

describe('collectSources', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-scout-'));
    fs.writeFileSync(path.join(dir, 'a.sv'), 'module a; endmodule\n');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore me\n');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'b.v'), 'module b; endmodule\n');
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('finds .sv/.v recursively and skips others', () => {
    const files = collectSources([dir]);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith('a.sv'))).toBe(true);
    expect(files.some((f) => f.endsWith('b.v'))).toBe(true);
    expect(files.some((f) => f.endsWith('notes.txt'))).toBe(false);
  });

  it('returns empty for a missing path', () => {
    expect(collectSources([path.join(dir, 'nope')])).toEqual([]);
  });
});

describe('cli', () => {
  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    jest.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  it('parses command, paths and flags', () => {
    const a = parseArgs(['lint', 'src/', 'alu.sv', '--fail-on', 'error', '--json']);
    expect(a.command).toBe('lint');
    expect(a.paths).toEqual(['src/', 'alu.sv']);
    expect(a.failOn).toBe('error');
    expect(a.json).toBe(true);
  });

  it('rejects an invalid --fail-on', () => {
    expect(main(['lint', '--fail-on', 'critical'])).toBe(1);
  });

  it('gates on findings via --fail-on', () => {
    jest.spyOn(runner, 'collectSources').mockReturnValue(['/x/a.sv']);
    jest.spyOn(runner, 'runVerible').mockReturnValue({
      tool: 'verible',
      filesScanned: 1,
      findings: [finding('warning', { file: '/x/a.sv' })],
    });
    expect(main(['lint', '/x'])).toBe(2); // default fail-on warning
    expect(main(['lint', '/x', '--fail-on', 'none'])).toBe(0);
    expect(main(['lint', '/x', '--fail-on', 'error'])).toBe(0); // only warnings
  });

  it('exits 1 with an install hint when the linter is missing', () => {
    jest.spyOn(runner, 'collectSources').mockReturnValue(['/x/a.sv']);
    jest
      .spyOn(runner, 'runVerible')
      .mockImplementation(() => {
        throw new runner.LinterNotFoundError('verible-verilog-lint');
      });
    expect(main(['lint', '/x'])).toBe(1);
  });

  it('exits 1 when no RTL files are found', () => {
    jest.spyOn(runner, 'collectSources').mockReturnValue([]);
    expect(main(['lint', '/x'])).toBe(1);
  });
});
