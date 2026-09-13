---
name: es-conventions
description: 'easyspec change-lifecycle conventions — read before any development task.'
---

# easyspec Change Conventions

Follow these conventions for every development task in this project.

## Always start from project config

Before any task, read `docs/config.yaml` for project name, source paths, tech stack, and conventions. Use its `source` paths in all file references.

## Change lifecycle

Work is organized as changes under `docs/changes/<change-name>/`:

| Stage | Command |
|-------|---------|
| Initialize project config | `/es-init` |
| Propose a full change doc set | `/es-propose` |
| Implement per plan | `/es-implement` |
| Fix tester-reported defects | `/es-fix` |
| Small targeted fixes | `/es-quick-fix` |
| Refresh stale change docs | `/es-refinement` |
| Review master docs | `/es-master-review` |
| Merge change docs into master docs | `/es-update-master` |
| Archive a finished change | `/es-archive` |

Each change carries `.change.yaml` (status + scope flags) and role-specific documents (prd.md, spec-change.md, architecture.md, data-model.md, implementation-plan.md, tech-spec.md, test-plan.md). Load the `es-lifecycle` skill for document formats.

## Agent team

The lifecycle delegates to specialized es- agents: es-product-owner (PRD, spec delta), es-ux-specialist (HTML prototypes), es-architect (Mermaid architecture), es-database-designer (tech-agnostic entity models), es-developer (plans, tech specs, code), es-tester (test plans), es-document-reviewer (review gate). Documents must not contain code snippets or schema code — they reference source files with workspace-relative paths.

## Naming

All easyspec-installed files use the `es-` prefix. Never create or modify non-`es-` files inside harness config directories.
