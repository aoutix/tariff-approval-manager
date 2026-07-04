# Tariff Approval Manager

A small full-stack app for managing shipping-line contracts and their tariff
rows through a Draft → Pending → Approved/Rejected approval workflow, with
role-based permissions enforced server-side.

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **Frontend:** React (Vite), Tailwind CSS v4

## Project layout

```
tariff-approval-manager/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, startup seeding
│   │   ├── database.py        # SQLAlchemy engine/session
│   │   ├── models.py          # ORM models + enums
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── auth.py            # Header-based auth, server-side role resolution
│   │   ├── business_rules.py  # Period-within-contract + overlap checks
│   │   └── routers/           # contracts, tariffs, dashboard, auth
│   ├── tests/                 # pytest suite
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/              # ContractsPage, DashboardPage
    │   ├── components/         # Modals, badges, role switcher
    │   ├── context/RoleContext.jsx
    │   ├── api.js
    │   └── App.jsx / main.jsx
    └── package.json
```

## Running the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. A SQLite file
(`backend/tariff.db`) is created automatically, and five seeded users are
inserted on first startup (see below). Interactive API docs are at
`http://localhost:8000/docs`.

To run the tests:

```bash
cd backend
pytest -v
```

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` and expects the
backend at `http://localhost:8000` (override with a `VITE_API_URL` env var
if needed, e.g. in a `.env` file).

## Login / seeded users

There's no password login. Instead, the top-right **role switcher** lets you
pick which seeded user you're acting as; the frontend sends that user's id
as an `X-User-Id` header on every request. The backend never trusts a role
sent by the client — on every request it looks up the user's role fresh
from the `users` table using that id, so permissions are enforced
server-side regardless of what the frontend does or doesn't show.

| Username         | Role           |
|-------------------|----------------|
| alice.creator     | Tariff Creator |
| carlos.creator    | Tariff Creator |
| bob.approver      | Approver       |
| dana.approver     | Approver       |
| vera.viewer       | Viewer         |

## Business rules implemented

- **Period within contract:** a tariff's `valid_from`/`valid_until` must fall
  inside its parent contract's validity period. Checked on create and edit.
- **No overlapping tariffs:** two **Approved** rows with the same
  `size` + `move_type` (within the same contract) must not have overlapping
  validity periods. Two periods are considered overlapping if they share
  even a single day — so a tariff ending 30 Jun and another starting 30 Jun
  **do** overlap; ending 30 Jun and starting 1 Jul do **not**. Only Approved
  rows are authoritative for this check (Draft/Pending/Rejected rows never
  block each other), and the check runs both at **submit** (Draft → Pending)
  and again at **approve** (Pending → Approved), since another row could
  have been approved in the interim. See `NOTES.md` for the trade-off
  discussion.
- **Approval workflow:** Draft → Pending → Approved/Rejected. A Rejected row
  can be edited by its creator, which clears the rejection reason and moves
  it back to Pending automatically.
- **Role permissions**, enforced in `app/auth.py` + per-router dependencies:
  - **Tariff Creator** — create/edit their own Draft or Rejected rows,
    submit Drafts. Cannot approve/reject anything.
  - **Approver** — view Pending rows, approve or reject them (with an
    optional reason on reject). Cannot create/edit tariff values, and
    cannot approve or reject a row they created themselves. Only Approvers
    can see the Dashboard.
  - **Viewer** — read-only access to Approved tariffs and contracts; no
    workflow actions, no Dashboard.

## Bonus features implemented

- **Timeline visual** on the dashboard: Pending/Approved tariffs are plotted
  as horizontal bars per size + move-type lane, so a visual overlap in the
  same lane makes conflicts (real or pending) obvious at a glance.
- **Audit log surfaced on the dashboard**: a "Recent activity" feed lists
  the last 20 create/submit/approve/reject/resubmit events, with who did
  it and when (the underlying `AuditLog` table was already written on
  every action; this exposes it in the UI).
- **Wildcard "Any" move type**: a tariff can be created with move type
  `Any`, meaning it covers every move type for that container size. In the
  no-overlap/duplicate check, an Approved `Any` row is treated as
  conflicting with *any* other move type of the same size and overlapping
  period, in both directions (`Any` blocks a later specific type, and a
  specific type blocks a later overlapping `Any`). See `app/business_rules.py`.
- **Dashboard filters**: filter the summary, breakdowns, and timeline by
  status, currency, and/or a validity date range.
- **Persisted storage**: already SQLite from the start (`backend/tariff.db`),
  not in-memory.

## Notes & prompt log

See `NOTES.md` for the assignment's reflection questions and `PROMPTS.md`
for the prompt log.
