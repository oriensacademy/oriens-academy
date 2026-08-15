# Documentation Index

## Canonical handoff documents

- `../README.md` — fast onboarding, routes, commands and operational overview.
- `DEVELOPER_HANDOFF.md` — current architecture, data/security boundaries and workflows.
- `DESIGN_SYSTEM.md` — current implemented visual and animation system.
- `COMPONENT_REFERENCES.md` — external component source/restoration index.
- `MAINTENANCE.md` — recurring operational and release checks.

These files take precedence over older phase documents when implementation details differ.

## Current setup and subsystem references

- `SUPABASE_SETUP.md`, `LOCAL_ADMIN_SETUP.md`, `TURNSTILE_SETUP.md`, `NETLIFY_DEPLOYMENT.md`
- `BACKEND.md`, `BOOKING.md`, `EMAIL_NOTIFICATIONS.md`
- `UNIVERSITY_DATA_SOURCE.md`

Some of these retain phase terminology or historical rationale. Verify commands and schema claims against the canonical handoff and latest migrations before operating a remote environment.

## Preserved audit and design evidence

The remaining `*_AUDIT.md`, `*_QA.md`, owner checklist, content inventory, animation inventory and Sage theme records document earlier verification, approved UI requirements, source decisions and browser evidence. They are intentionally retained as project knowledge rather than treated as disposable agent output.

`references/owner-assets/` contains owner-provided original animation/logo variants. Runtime copies remain in `public/`. Do not remove reference assets solely because a byte-identical runtime copy exists.

The original detailed brand/design rationale remains under `../design-system/oriens-academy/`. Its historic tokens may differ from the currently implemented palette/fonts; `DESIGN_SYSTEM.md` explicitly records the current source of truth.
