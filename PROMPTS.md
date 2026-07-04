# Prompt log

This is the actual prompt log for this build, given to Claude (Claude
Sonnet 5, in the claude.ai chat interface with code-execution/file-creation
tools enabled — a "vibe coding" style session where the AI reads the spec,
writes files, and runs tests itself).

## Prompt 1 (the assignment brief, adapted into a single build spec)

> Build a "Tariff Approval Manager" full-stack app using FastAPI (Python),
> SQLite, and React (Vite + Tailwind). Enforce all rules strictly.
>
> Data Model:
> - Contract: name, valid_from, valid_until.
> - Tariff: contract_id, size (20ft/40ft/45ft), move_type
>   (import/export/transshipment), currency (EUR/USD), price (decimal),
>   valid_from, valid_until, status (Draft/Pending/Approved/Rejected),
>   rejection_reason, created_by.
>
> Roles & Auth (Enforce server-side; implement a simple UI role switcher
> with seeded users):
> - Tariff Creator: CRUD Drafts, submit to Pending, edit/resubmit Rejected.
>   Cannot approve.
> - Approver: View Pending, Approve, Reject (with text reason). Cannot edit
>   values or approve own creations. Can access Dashboard.
> - Viewer: Read-only access to approved tariffs and contracts. No
>   dashboard/management screens.
>
> Business Rules:
> 1. Period within contract: Tariff valid dates must fall strictly inside
>    the parent contract's validity dates.
> 2. No Overlapping: Approved rows with identical size + move_type in the
>    same contract must not overlap. (Boundary rule: ending June 30 and
>    starting July 1 is NOT an overlap; ending June 30 and starting June 30
>    IS an overlap). Run validation checks at both Submit and Approve
>    phases. Return explicit, clear errors on failure.
>
> Required Features: REST API with role-based middleware, role-aware
> frontend with date-pickers, an Approver-only Dashboard with
> status/move-type/currency breakdowns and a chart, and at least two
> automated tests (overlap rule + an approver-can't-approve-own-row
> permission rule).
>
> Deliverables: operational codebase, README.md, PROMPTS.md, NOTES.md.

## How the build actually proceeded from there

This single message contained the full spec (data model, roles, business
rules, required features, and deliverables) up front, so this particular
session ran as one continuous agent pass rather than many short
back-and-forth prompts. In order:

1. Scaffolded the backend (`database.py`, `models.py`, `schemas.py`).
2. Wrote `auth.py` as a standalone module first, specifically to make the
   "role is always resolved server-side" requirement structurally obvious
   and reusable across every router (see NOTES.md for a mistake this
   design choice was meant to prevent).
3. Wrote `business_rules.py` (period-within-contract + overlap check) as
   its own module, independent of any router, so it could be unit tested
   directly and called from both the submit and approve endpoints without
   duplicating logic.
4. Wrote the `contracts`, `tariffs`, and `dashboard` routers, wiring the
   business-rule module and role dependencies in.
5. Wrote the pytest suite (`test_overlap.py`, `test_permissions.py`) and
   ran it (`pytest -v`) — one test failed on the first run because a test
   assertion was checking for the word "own" in an error message that
   actually said "themselves"; fixed the test's wording to match the real
   API message, since the API's behavior (403, correct reason) was
   already right — the test text just didn't match it.
6. Started the API locally and hit a couple of endpoints with `curl` as a
   smoke test before touching the frontend.
7. Scaffolded the Vite + React + Tailwind v4 frontend, then built the API
   client, the role-switcher context, the contracts/tariffs page (with
   role-conditional actions per row), the dashboard page, and the modals
   for creating/editing contracts and tariffs and for entering a rejection
   reason.
8. Ran `npm run build` to confirm the frontend compiles cleanly, and did a
   manual pass through each role's view in the running app.
9. Wrote `README.md`, this `PROMPTS.md`, and `NOTES.md`.

A more iterative real-world session — the style the assignment is really
asking about — would break steps 1–4 into separate prompts (e.g. "now add
the overlap check, and tell me how you're deciding when it runs" as its
own turn), so that permission or workflow mistakes could be caught and
corrected one at a time instead of during a single end-to-end review. See
the "what would you improve first" answer in `NOTES.md`.
