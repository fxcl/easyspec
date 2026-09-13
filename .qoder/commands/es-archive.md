---
name: es-archive
description: 'Archive a completed change directory after its master docs are updated.'
---

Archive a completed change by moving it into the archive and closing out its metadata.

**Input**: Optionally specify a change name (e.g., `/es-archive add-dark-mode`). If omitted, ask which change to archive (list candidates from `docs/changes/*/`).

---

## Step 0: Verify Config is Initialized

Check that `docs/config.yaml` exists and is populated. If not, run `/es-init` first and stop.

---

## Step 1: Determine the Change

Resolve the target change directory `docs/changes/<name>/` from the input or by asking. The directory must exist and contain `.change.yaml`.

---

## Step 2: Check Readiness

Read `.change.yaml` and verify the change is ready to archive:

- `status: master-updated` → ready to archive.
- `status: implemented` → warn the user that master docs have not been updated yet, recommend `/es-update-master`, and ask whether to continue anyway.
- `status: in-progress` → stop and tell the user to finish implementation (`/es-implement`) first.
- `status: archived` → report that nothing needs to be done.

---

## Step 3: Move the Change to the Archive

1. Create `docs/changes/archive/` if it does not exist.
2. Move the whole `docs/changes/<name>/` directory to `docs/changes/archive/<name>/`.
3. Do not modify any document contents during the move.

---

## Step 4: Close Out Metadata

Update `docs/changes/archive/<name>/.change.yaml`:

- `status: archived`
- `archived_at: <YYYY-MM-DD>`

---

## Step 5: Show Completion Summary

```
## Change Archived

**Change:** <name>
**Archived to:** docs/changes/archive/<name>/
**Status:** archived

Master docs remain the source of truth for the current product.
```

---

## Guardrails
- Never archive a change whose implementation is still in progress
- Never edit change documents while archiving — move only, then update `.change.yaml`
- Keep `docs/changes/` root clean: only active changes stay outside `archive/`
