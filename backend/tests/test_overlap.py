from datetime import date

from tests.conftest import headers
from app import models


def make_draft(client, creator, contract, valid_from, valid_until, size="20ft", move_type="import"):
    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": size,
            "move_type": move_type,
            "currency": "USD",
            "price": "100.00",
            "valid_from": str(valid_from),
            "valid_until": str(valid_until),
        },
        headers=headers(creator),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def submit(client, user, tariff_id):
    return client.post(f"/api/tariffs/{tariff_id}/submit", headers=headers(user))


def approve(client, user, tariff_id):
    return client.post(f"/api/tariffs/{tariff_id}/approve", headers=headers(user))


def test_overlapping_approved_tariff_is_rejected(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    # First tariff: Jan 1 - Jun 30, approved.
    t1 = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 6, 30))
    assert submit(client, creator, t1["id"]).status_code == 200
    assert approve(client, approver, t1["id"]).status_code == 200

    # Second tariff with same size+move_type, overlapping on the boundary
    # day (starts exactly when the first one ends) - per our stated boundary
    # rule, shared-day counts as overlap, so this must be rejected at submit.
    t2 = make_draft(client, creator, contract, date(2026, 6, 30), date(2026, 12, 31))
    resp = submit(client, creator, t2["id"])
    assert resp.status_code == 400
    assert "overlap" in resp.json()["detail"].lower()


def test_non_overlapping_back_to_back_tariff_succeeds(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    t1 = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 6, 30))
    assert submit(client, creator, t1["id"]).status_code == 200
    assert approve(client, approver, t1["id"]).status_code == 200

    # Starts the day after the first one ends -> no overlap.
    t2 = make_draft(client, creator, contract, date(2026, 7, 1), date(2026, 12, 31))
    resp = submit(client, creator, t2["id"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "Pending"


def test_overlap_blocked_again_at_approve_time(client, seeded_users, contract):
    """
    Two Pending tariffs can coexist (only Approved rows are authoritative),
    but approving both must fail on the second one since the check also
    runs at approve time.
    """
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    t1 = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 3, 31))
    t2 = make_draft(client, creator, contract, date(2026, 2, 1), date(2026, 4, 30))

    assert submit(client, creator, t1["id"]).status_code == 200
    assert submit(client, creator, t2["id"]).status_code == 200  # both Pending is fine

    assert approve(client, approver, t1["id"]).status_code == 200
    resp = approve(client, approver, t2["id"])
    assert resp.status_code == 400
    assert "overlap" in resp.json()["detail"].lower()


def test_any_move_type_blocks_specific_move_type_overlap(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    # Approve an "Any" move-type tariff first - it stands for every move type.
    t1 = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 6, 30), move_type="Any")
    assert submit(client, creator, t1["id"]).status_code == 200
    assert approve(client, approver, t1["id"]).status_code == 200

    # A specific move type overlapping the same size/period must be blocked,
    # since the "Any" row already covers that lane.
    t2 = make_draft(client, creator, contract, date(2026, 3, 1), date(2026, 4, 1), move_type="import")
    resp = submit(client, creator, t2["id"])
    assert resp.status_code == 400
    assert "overlap" in resp.json()["detail"].lower()


def test_specific_move_type_blocks_subsequent_any_overlap(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    t1 = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 6, 30), move_type="export")
    assert submit(client, creator, t1["id"]).status_code == 200
    assert approve(client, approver, t1["id"]).status_code == 200

    # An "Any" tariff overlapping the same size/period must also be blocked,
    # since it would re-cover the already-approved export lane.
    t2 = make_draft(client, creator, contract, date(2026, 3, 1), date(2026, 4, 1), move_type="Any")
    resp = submit(client, creator, t2["id"])
    assert resp.status_code == 400
    assert "overlap" in resp.json()["detail"].lower()


def test_any_move_type_does_not_block_non_overlapping_period(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    t1 = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 6, 30), move_type="Any")
    assert submit(client, creator, t1["id"]).status_code == 200
    assert approve(client, approver, t1["id"]).status_code == 200

    # Starts the day after the "Any" row ends -> no overlap even against Any.
    t2 = make_draft(client, creator, contract, date(2026, 7, 1), date(2026, 12, 31), move_type="import")
    resp = submit(client, creator, t2["id"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "Pending"


def test_period_must_fall_within_contract(client, seeded_users, contract):
    creator = seeded_users["creator"]
    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": "40ft",
            "move_type": "export",
            "currency": "EUR",
            "price": "50.00",
            "valid_from": "2025-12-01",  # before contract starts
            "valid_until": "2026-02-01",
        },
        headers=headers(creator),
    )
    assert resp.status_code == 400
    assert "within" in resp.json()["detail"].lower()
