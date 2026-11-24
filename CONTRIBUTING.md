# Contributing to rtl-scout

## Development setup

```bash
git clone https://github.com/next-dna/rtl-scout.git
cd rtl-scout
npm install
npm run build
npm test
npm run lint
```

Most logic (output parsing, scoring, reporting) is **pure** and unit-tested
against fixtures in `tests/fixtures/`, so you don't need Verible installed to
run the test suite. Install Verible only for end-to-end smoke tests.

## Branching & pull requests

- `main` is protected — **no direct pushes**. All changes land via pull request.
- Branch with a short prefix: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- CI (lint + build + tests on Node 18/20/22) must pass before merge.

## Conventional Commits (required)

Commit messages — and PR titles, since we squash-merge — follow
[Conventional Commits](https://www.conventionalcommits.org/): `feat:` (minor
bump), `fix:`/`perf:` (patch), and `docs:`/`test:`/`refactor:`/`chore:`/`ci:`
(no release). This drives automated versioning and the changelog.

## Adding a linter adapter

New engines (Verilator, svlint, …) plug in under `src/adapters/`: expose a pure
`parse<Tool>Output(stdout): LintFinding[]` and the argv builder, add it to the
adapter registry, and commit a captured-output fixture under `tests/fixtures/`.

## Releases

Merging Conventional-Commit PRs makes
[release-please](https://github.com/googleapis/release-please) open a Release
PR; merging it tags a release and publishes to npm via **OIDC Trusted
Publishing** (no tokens). You never run `npm publish` locally.
