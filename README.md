# rtl-scout

> Lint your Verilog/SystemVerilog in CI and get a **cleanliness grade** — a zero-dependency CLI wrapper around [Verible](https://github.com/chipsalliance/verible). Modern lint-in-CI for hardware teams.

RTL linting catches bugs and style issues *before* you burn hours in simulation — but the good engines (Verible, Verilator) are raw, and the polished commercial tools are expensive and clunky. `rtl-scout` wraps Verible and gives you the thing software teams take for granted: a clean report, an **A–F grade**, machine-readable output, and a simple CI exit gate.

## Why

- **One command, a real signal.** Point it at your RTL; get a graded report instead of a wall of raw linter text.
- **CI-native.** A tunable `--fail-on` gate blocks risky changes in pull requests.
- **Zero runtime dependencies.** The CLI is tiny; it shells out to the Verible linter you already trust.

## Requirements

- **Node.js >= 18**
- **[Verible](https://github.com/chipsalliance/verible) on your PATH** (`verible-verilog-lint`):
  ```bash
  brew install verible          # macOS
  # Linux/Windows: download a release binary from the Verible releases page
  ```

## Install

```bash
npx @stackgauge/rtl-scout lint src/
```

Or globally:

```bash
npm install -g @stackgauge/rtl-scout
rtl-scout lint src/
```

> **Tip — verify your version.** `npx` and global installs can serve a **stale cached copy**, so a new feature may look "missing." Check with `rtl-scout --version` (or `npx @stackgauge/rtl-scout@latest --version`). If it's behind, update with `npm install -g @stackgauge/rtl-scout@latest`, or clear the npx cache: `rm -rf "$(npm config get cache)/_npx"`.

## Usage

```bash
# Lint a directory (recurses for .v / .sv / .svh)
rtl-scout lint rtl/

# Lint specific files, fail CI only on errors
rtl-scout lint alu.sv fifo.sv --fail-on error

# Machine-readable output for tooling
rtl-scout lint rtl/ --json
```

Example output:

```
rtl-scout (verible)  2 files scanned

  [  C  ]  Lint grade  72/100
  7 warning, 2 style

Findings
  rtl/alu.sv
    7:1     WARNING File must end with a newline. [posix-eof]
    2:11    WARNING Parameter storage type must be declared explicitly. [explicit-parameter-storage-type]
  ...
```

## Options

```
rtl-scout lint [paths...]   Lint RTL files/directories (defaults to the current dir)

--tool <name>     Linter to use: verible | auto (default auto)
--fail-on <sev>   Exit non-zero on a finding at/above none|info|style|warning|error (default warning)
--json            Machine-readable output
-h, --help        Show help
-v, --version     Show version
```

## Exit codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 0    | No findings at or above `--fail-on`                       |
| 1    | Usage error, no RTL files found, or Verible not installed |
| 2    | A finding met the `--fail-on` threshold (default warning) |

## How it works & limitations

`rtl-scout` runs `verible-verilog-lint` and normalizes its output into a graded report. It is a **thin wrapper**, so it inherits Verible's rules and coverage — it doesn't re-implement a SystemVerilog parser. Verible lint findings aren't severity-tiered, so this version maps them all to `warning`; per-rule severities and a density-based grade are on the roadmap.

**Roadmap:** a GitHub Action (PR comments + grade in the Checks tab), a Verilator adapter, waiver/baseline management, and clock-domain-crossing (CDC) checks.

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

## Author

Created and maintained by **Sandip Gami** ([@next-dna](https://github.com/next-dna)).

## License

MIT © Sandip Gami
