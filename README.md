# easyspec — Spec-Driven Development Kit for AI Coding Agents

[![npm version](https://img.shields.io/npm/v/@myaider/easyspec.svg)](https://www.npmjs.com/package/@myaider/easyspec)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Downloads](https://img.shields.io/npm/dm/@myaider/easyspec.svg)](https://www.npmjs.com/package/@myaider/easyspec)

**One `init` command. A team of AI agents. Your entire software lifecycle — managed by specs, not chaos.**

Supports **GitHub Copilot**, **OpenCode**, **Claude Code**, **ZCode**, **Qoder**, and **Kilo Code**.

> Built on the ideas of [OpenSpec](https://openspec.dev/) — the spec-driven development framework. Our spec format, agent delegation model, and change lifecycle are derived from OpenSpec's concepts. Thanks to the OpenSpec team.

## Showcase

**[Parthenon](https://github.com/hurungang/parthenon)** — a self-hosted enterprise AI harness — was built with easyspec, feature by feature, through the propose → apply → update-master pipeline.

![Parthenon feature demo](docs/parthenon-demo.gif)

The same spec-driven pipeline that keeps the code clean also keeps the UI consistent. Each screen below was prototyped by the UX agent for a *different* feature, yet every one shares the same design language:

![Parthenon UI consistency](docs/ui-consistency.gif)

## Install

**Recommended** — install globally:

```bash
npm install -g @myaider/easyspec
```

**Try without installing:**

```bash
npx @myaider/easyspec init
```

## Usage

### Init

```bash
easyspec init
```

Run interactively, the CLI asks two questions:

1. **Harness(es)** — which coding agent(s) to install for (multi-select: Copilot, OpenCode, Claude Code, ZCode, Qoder, Kilo Code).
2. **Scope** — install into the current project, or globally into your user profile.

You can skip the prompts with flags:

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--agent` | `copilot`, `opencode`, `claude-code`, `zcode`, `qoder`, `kilocode` (comma-separated for multiple) | interactive | Target coding agent(s) |
| `--scope` | `project`, `global` | interactive | Install scope |
| `--workspace` | `<path>` | cwd | Project folder for `--scope project` |
| `--force` | — | false | Overwrite existing files |
| `--dry-run` | — | false | Preview without writing |
| `--tech-model` | `<name>` | `auto` | Model for technical agents |
| `--non-tech-model` | `<name>` | `auto` | Model for non-technical agents |
| `--model-preset` | `balanced`, `speed`, `quality` | — | Apply a preset model pair |

Models default to **`auto`** — no need to pick one. Model options only affect **Copilot** agent files; agent definitions for the other harnesses carry no `model` field.

### Inspect or remove

```bash
# Show which easyspec files are installed per harness
easyspec list --agent qoder --scope project
easyspec list --scope project          # all harnesses

# Remove every es-* file easyspec installed (preview first with --dry-run)
easyspec uninstall --agent copilot --scope project --dry-run
easyspec uninstall --agent copilot --scope project
```

`uninstall` only touches `es-`-prefixed files and skill folders, so user-created content stays untouched.

### Destination mapping

**Project scope** (`--scope project`):

| Agent | Commands/Prompts | Agents | Skills |
|-------|------------------|--------|--------|
| `copilot` | `<ws>/.github/prompts/*.prompt.md` | `<ws>/.github/agents/*.agent.md` | `<ws>/.github/skills/<name>/SKILL.md` |
| `opencode` | `<ws>/.opencode/commands/*.md` | `<ws>/.opencode/agents/*.md` | `<ws>/.opencode/skills/<name>/SKILL.md` + rule `rules/es-conventions.md` |
| `claude-code` | `<ws>/.claude/commands/*.md` | `<ws>/.claude/agents/*.md` | `<ws>/.claude/skills/<name>/SKILL.md` + rule `rules/es-conventions.md` |
| `zcode` | `<ws>/.zcode/commands/*.md` | `<ws>/.zcode/agents/*.md` | `<ws>/.zcode/skills/<name>/SKILL.md` + rule `rules/es-conventions.md` |
| `qoder` | `<ws>/.qoder/commands/*.md` | `<ws>/.qoder/agents/*.md` | `<ws>/.qoder/skills/<name>/SKILL.md` + rule `rules/es-conventions.md` |
| `kilocode` | `<ws>/.kilo/commands/*.md` | `<ws>/.kilo/agents/*.md` | `<ws>/.kilo/skills/<name>/SKILL.md` + rule `rules/es-conventions.md` |

**Global scope** (`--scope global`): installed under your user profile instead of `<ws>/`.

| Agent | Commands/Prompts | Agents | Skills |
|-------|------------------|--------|--------|
| `copilot` | `~/Library/Application Support/Code/User/prompts/` (macOS) or `%APPDATA%\Code\User\prompts\` (Windows) | `~/.copilot/agents/` | `~/.copilot/skills/` |
| `opencode` | `~/.config/opencode/commands/` | `~/.config/opencode/agents/` | `~/.config/opencode/skills/` + rule `~/.config/opencode/rules/` |
| `claude-code` | `~/.claude/commands/` | `~/.claude/agents/` | `~/.claude/skills/` + rule `~/.claude/rules/` |
| `zcode` | `~/.zcode/commands/` | `~/.zcode/agents/` | `~/.zcode/skills/` + rule `~/.zcode/rules/` |
| `qoder` | `~/.qoder/commands/` | `~/.qoder/agents/` | `~/.qoder/skills/` + rule `~/.qoder/rules/` |
| `kilocode` | `~/.config/kilo/commands/` | `~/.config/kilo/agents/` | `~/.kilo/skills/` + rule `~/.config/kilo/rules/` |

### Examples

```bash
# Interactive — multi-select harness(es) and scope
easyspec init

# Copilot in the current project
easyspec init --agent copilot --scope project

# Copilot and Claude Code in one run
easyspec init --agent copilot,claude-code --scope project

# OpenCode globally
easyspec init --agent opencode --scope global

# Claude Code with a model preset
easyspec init --agent claude-code --scope project --model-preset balanced

# ZCode and Qoder in one run
easyspec init --agent zcode,qoder --scope project

# Kilo Code globally (skills go to ~/.kilo/skills)
easyspec init --agent kilocode --scope global

# Preview without writing (lists every file)
easyspec init --agent opencode --dry-run
```

### What is installed

**Commands:** `es-init`, `es-propose`, `es-implement`, `es-refinement`, `es-fix`, `es-master-review`, `es-update-master`, `es-quick-fix`, `es-archive`

**Agents:** `es-product-owner`, `es-ux-specialist`, `es-architect`, `es-database-designer`, `es-developer`, `es-tester`, `es-document-reviewer`

**Skill:** `es-lifecycle`

> Every harness except Copilot also installs a conventions rule (`rules/es-conventions.md`). Claude Code and Qoder load rules natively; for OpenCode, ZCode, and Kilo Code the rule is installed for forward-compatibility.

## Acknowledgements

This project builds on [OpenSpec](https://openspec.dev/) — a spec-driven development framework. The spec format, agent delegation model, and change lifecycle are derived from OpenSpec's concepts. Thanks to the OpenSpec team for the foundational ideas.

## License

MIT
