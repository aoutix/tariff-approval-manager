# Notes

## Which AI tool(s), and roughly what % AI-generated vs hand-written?

Claude (Sonnet 5, in the claude.ai interface with code-execution/file tools)
wrote effectively all of the code in this session — model, schema, business
rules, routers, tests, and the React frontend — from one detailed spec
prompt (see `PROMPTS.md`). Call it ~95% AI-generated. The ~5% "hand-written"
is really the spec itself (the data model, role table, and the exact
boundary-date and submit-vs-approve decisions in the prompt) plus this
notes file, which is judgment/communication rather than code.

## How did you prompt the AI to build the roles & permissions? Where did it get something wrong?

The prompt specified the three roles and their allowed actions as an
explicit table (Creator / Approver / Viewer → what each can and can't do),
and called out "enforce server-side" and "approver cannot approve own row"
by name, rather than leaving permission logic to be inferred. That
specificity is what let the resulting code centralize role resolution in
one place (`app/auth.py`): every protected route depends on
`require_role(...)`, and the role is always re-read from the `users` table
using only a user-id claim — never accepted as a role string from the
client. That's a deliberate reaction to a common vibe-coding trap: it's
very easy for an agent to take a shortcut like reading `X-User-Role` from a
header or trusting a `role` field in the request body, which any client
(or `curl`) could then spoof to grant itself Approver access. Structuring
the auth dependency to only accept an id and do the DB lookup itself
closes that off by construction.

Within this session, the concrete mistake that surfaced and was fixed came
up in the test suite rather than the app logic: `test_permissions.py`
originally asserted the word "own" would appear in the 403 message for an
Approver trying to approve their own row, but the actual API message reads
"...cannot approve a tariff row they created themselves." — correct
behavior, wrong test wording. Running `pytest -v` caught it immediately
(1 failed / 10 passed), and the fix was to correct the test's assertion to
match the real, already-correct message, rather than touch the endpoint.
It's a small example, but it's exactly the kind of thing that's easy to
wave away as "close enough" if you don't actually run the tests and read
the failure.

## Where did you decide not to trust the AI and write/verify it yourself, and why?

- **Boundary-date semantics.** The prompt pinned the exact rule (shared day
  = overlap) rather than letting the model guess, since this is the one
  place a plausible-sounding but wrong default (e.g. strict `<`/`>` instead
  of `<=`/`>=`) would silently pass most manual testing and only surface on
  an edge case.
- **When overlap is checked.** Explicitly required at both submit and
  approve, rather than trusting a single check to be "good enough" — see
  the trade-off below.
- **Running the tests, not just reading them.** `pytest -v` was actually
  executed against a real in-memory SQLite DB and a live `TestClient`
  fixture, not just skimmed for plausibility, which is what caught the
  wording mismatch above.
- **Actually starting both servers.** The backend was started and smoke
  tested with `curl` (root route + seeded users), and the frontend was
  built with `npm run build` and previewed, rather than assuming green
  code compiles into a correct running app.

## How did you decide when to check for duplicates/overlap (submit vs approve), and what trade-off did you weigh?

The spec required both, which is the right call: checking only at submit
would miss the case where two rows are independently submitted while
non-overlapping-looking (e.g. both Pending, no Approved conflict yet), and
then one gets approved — at that point the second one is now unapprovable,
but a submit-only check would never re-validate it and an Approver could
approve an actually-overlapping row. Checking only at approve, meanwhile,
would let obviously-conflicting Drafts sit in Pending for a long time
before an Approver ever finds out, which is a worse reviewer experience.

The trade-off is mostly extra latency (one more query on submit) and the
fact that a row can look valid at submit time and then get rejected at
approve time through no fault of the Approver or Creator — purely because
someone else's row got approved first. That's an unavoidable consequence
of "only Approved rows are authoritative": Draft/Pending rows never block
each other, so two conflicting rows can coexist right up until one of them
is actually approved.

## If you had two more hours, what would you improve first?

1. **Iterate over one continuous session, in smaller prompts.** This
   session was one large spec-to-app pass; a better real-world process
   would split it into stages (models → business rules → routers → tests
   → frontend) as separate prompts, reviewing and pushing back at each
   stage instead of only at the end.
2. **Ownership rules for contracts and edits.** Right now any Creator can
   edit any Draft/Rejected tariff row, but only the original creator can
   edit *their* row (contract editing isn't scoped to a creator at all).
   I'd tighten and test this, and decide explicitly whether contracts
   should be creator-scoped too.
3. **Surface the audit log in the UI.** The backend already writes an
   `AuditLog` row on every create/submit/approve/reject/resubmit action
   (a bonus item), but the frontend never displays it — I'd add a small
   history panel per tariff row.
4. ~~The bonus timeline visual~~ and ~~dashboard filters~~ were added in a
   follow-up session (timeline groups Pending/Approved tariffs into
   size+move-type lanes with overlap-aware stacking; filters cover status,
   currency, and a validity date range). The audit log is now also
   surfaced as a "Recent activity" feed on the dashboard, and a wildcard
   `Any` move type was added (see `app/business_rules.py` for how it's
   treated as conflicting with every move type of the same size, in both
   directions).

   Verifying the timeline in an actual browser (via a Playwright
   screenshot, not just reading the JSON) caught a real bug: the
   "Recent activity" feed showed timestamps like "6h ago" for events that
   had just happened, because the backend returns naive UTC timestamps
   (`datetime.utcnow()`, no `Z`/offset suffix) and the frontend's
   `new Date(iso)` was parsing them as local time. Fixed by appending `Z`
   before parsing on the frontend rather than changing the backend's
   timestamp format. It's the same category of mistake as the earlier
   test-wording one: plausible-looking code that only breaks when you
   actually look at the rendered output instead of trusting the response
   shape.
5. **Concurrency.** Two near-simultaneous approvals could theoretically
   both pass the overlap check before either commits (a classic
   check-then-act race). I'd add a DB-level constraint or a transaction
   with `SELECT ... FOR UPDATE`-equivalent locking to close that gap
   properly, since SQLite's own concurrency model made this low priority
   for a few hours of scope but it's a real gap in Postgres/production.
