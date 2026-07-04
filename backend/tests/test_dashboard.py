from datetime import date

from tests.conftest import headers


def make_draft(client, creator, contract, valid_from, valid_until, size="20ft", move_type="import", currency="USD"):
    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": size,
            "move_type": move_type,
            "currency": currency,
            "price": "100.00",
            "valid_from": str(valid_from),
            "valid_until": str(valid_until),
        },
        headers=headers(creator),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_dashboard_status_filter_narrows_counts(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    draft = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 3, 1))
    approved = make_draft(client, creator, contract, date(2026, 4, 1), date(2026, 6, 1), move_type="export")
    client.post(f"/api/tariffs/{approved['id']}/submit", headers=headers(creator))
    client.post(f"/api/tariffs/{approved['id']}/approve", headers=headers(approver))

    resp = client.get("/api/dashboard?status=Draft", headers=headers(approver))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_tariffs"] == 1
    assert body["counts_by_status"]["Draft"] == 1
    assert body["counts_by_status"]["Approved"] == 0


def test_dashboard_currency_filter(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 3, 1), currency="EUR")
    make_draft(client, creator, contract, date(2026, 4, 1), date(2026, 6, 1), move_type="export", currency="USD")

    resp = client.get("/api/dashboard?currency=EUR", headers=headers(approver))
    assert resp.status_code == 200
    assert resp.json()["total_tariffs"] == 1


def test_dashboard_timeline_groups_by_size_and_move_type(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    t = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 3, 1))
    client.post(f"/api/tariffs/{t['id']}/submit", headers=headers(creator))
    client.post(f"/api/tariffs/{t['id']}/approve", headers=headers(approver))

    resp = client.get("/api/dashboard", headers=headers(approver))
    body = resp.json()
    lanes = {(lane["size"], lane["move_type"]): lane["segments"] for lane in body["timeline"]}
    assert ("20ft", "import") in lanes
    assert len(lanes[("20ft", "import")]) == 1
    assert lanes[("20ft", "import")][0]["status"] == "Approved"


def test_dashboard_recent_activity_reflects_workflow_actions(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    t = make_draft(client, creator, contract, date(2026, 1, 1), date(2026, 3, 1))
    client.post(f"/api/tariffs/{t['id']}/submit", headers=headers(creator))
    client.post(f"/api/tariffs/{t['id']}/approve", headers=headers(approver))

    resp = client.get("/api/dashboard", headers=headers(approver))
    actions = [a["action"] for a in resp.json()["recent_activity"] if a["tariff_id"] == t["id"]]
    assert "created" in actions
    assert "submitted" in actions
    assert "approved" in actions
