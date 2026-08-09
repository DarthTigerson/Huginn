# Open-sourcing Huginn: design

## Goal

Prepare the Huginn repo (currently private on GitLab) for a professional public
release on GitHub as `v0.1.0`, with downloadable `.dmg` (mac) and `.deb`
(linux) builds and GitHub's automatic source-archive download, without
exposing anything that shouldn't be public.

## 1. Repo sanitization

- Delete `docs/superpowers/` from the tracked tree (41 files of internal AI
  dev-session planning docs — local file paths, raw implementation notes, not
  written for public consumption).
- Add `LICENSE` (MIT).
- Update `.gitignore`:
  - add `release/` (electron-builder's build output directory, currently
    untracked but not excluded)
  - add `docs/superpowers/` (mirrors the existing `.superpowers/` exclusion,
    so future brainstorming/planning sessions don't re-add internal docs to
    the tracked tree)
- Secrets/credentials audit: done — `git grep` across all tracked files for
  key/secret/password/token patterns turned up nothing but the `apiKey` field
  name used for the user-supplied local-LLM ("Cosmos") endpoint setting. No
  leaked credentials found.
- Stale branches (`cosmos_fixes`, `gpt_implementation`, `feat/todos`,
  `claude_usage_monitoring_improvement`) are fully merged into `main` with no
  unique commits — not carried over, nothing lost.

## 2. Git history

All 294 GitLab-era commits are authored under the personal address
`thomas.bonnici@icloud.com`. Rather than push full history (exposing that
email hundreds of times plus every intermediate/WIP commit message), squash
everything into a single clean "Initial commit" representing the sanitized
tree from step 1. This becomes the first commit of the public GitHub history.

## 3. GitHub repository

- Remote: `git@github.com:DarthTigerson/Huginn.git`, set as `origin` (GitLab
  remote removed locally; the GitLab repo itself is left untouched on
  gitlab.com — nothing deleted there).
- Push the single squashed commit to `main`.
- Public visibility, MIT license.

## 4. README rewrite

Replace the current unedited GitLab template with:

- Title, one-line pitch, MIT license badge, latest-release badge
- 2-3 real screenshots (hero shot of the main IDE view, plus one or two
  feature panels — e.g. Cosmos settings, Git panel) captured by launching the
  app locally
- What it is: an Electron-based IDE built around terminal AI coding agents
  (Claude Code CLI, OpenAI Codex CLI) plus a local-LLM "Cosmos" panel, with
  git tooling, a mobile companion display, and usage tracking
- Explicit disclaimer: not affiliated with or endorsed by Anthropic or OpenAI
- Feature list drawn from the actual panels (Editor, Git, Terminal,
  Chat/agent panels, Mobile Display pairing, Usage tracking, Shortcuts)
- Installation: download `.dmg`/`.deb` from GitHub Releases, plus a
  "Build from source" section (clone, `npm install`, `npm run dev`)
- macOS Gatekeeper note: the `.dmg` is unsigned (no Apple Developer account
  yet) — document the right-click → Open / `xattr -cr` workaround
- Requirements: Claude Code CLI and/or Codex CLI installed separately,
  macOS or Linux
- Light Contributing section
- License section

## 5. Release engineering

- Version starts at `v0.1.0` (per existing `ToDo.md` note).
- New `.github/workflows/release.yml`: triggers on push of a tag matching
  `v*`. Builds `dist:mac` on a macOS runner and `dist:linux` on a Linux
  runner (electron-builder config already exists in `package.json`), then
  attaches the resulting `.dmg` and `.deb` to the GitHub Release for that tag.
  GitHub attaches the source zip/tarball automatically — no extra config
  needed for that part.
- Release flow going forward: bump `version` in `package.json`, commit,
  `git tag vX.Y.Z`, `git push origin vX.Y.Z` → CI builds and publishes.
- No code signing/notarization for v0.1.0 (documented limitation in README,
  can be added later if an Apple Developer account is set up).

## Out of scope for this pass

- Code signing / notarization for mac
- CI for pull-request checks (lint/test/typecheck) — only the tag-triggered
  release workflow is in scope here
- Windows builds
