from datetime import date

from tests.conftest import headers


def test_creator_cannot_approve(client, seeded_users, contract):
    creator = seeded_users["creator"]

    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": "20ft",
            "move_type": "import",
            "currency": "USD",
            "price": "100.00",
            "valid_from": "2026-01-01",
            "valid_until": "2026-06-30",
        },
        headers=headers(creator),
    )
    tariff_id = resp.json()["id"]
    client.post(f"/api/tariffs/{tariff_id}/submit", headers=headers(creator))

    # Creator tries to approve their own submitted row -> forbidden by role.
    resp = client.post(f"/api/tariffs/{tariff_id}/approve", headers=headers(creator))
    assert resp.status_code == 403
    assert "not permitted" in resp.json()["detail"].lower()


def test_approver_cannot_approve_own_created_row(client, seeded_users, contract, db_session):
    """
    Edge case: if an Approver account is somehow the creator of a row
    (e.g. a user who used to be a Creator, or a seeded edge case), they
    still cannot approve it themselves, even though their role permits
    approving in general.
    """
    approver = seeded_users["approver"]

    # Directly insert a tariff "created by" the approver to simulate this state,
    # since the API itself won't let an Approver role create tariffs.
    from app import models
    t = models.Tariff(
        contract_id=contract.id,
        size=models.ContainerSize.FT20,
        move_type=models.MoveType.IMPORT,
        currency=models.Currency.USD,
        price=100,
        valid_from=date(2026, 1, 1),
        valid_until=date(2026, 6, 30),
        status=models.TariffStatus.PENDING,
        created_by_id=approver.id,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)

    resp = client.post(f"/api/tariffs/{t.id}/approve", headers=headers(approver))
    assert resp.status_code == 403
    assert "themselves" in resp.json()["detail"].lower()


def test_viewer_cannot_create_tariff(client, seeded_users, contract):
    viewer = seeded_users["viewer"]
    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": "45ft",
            "move_type": "transshipment",
            "currency": "EUR",
            "price": "75.00",
            "valid_from": "2026-01-01",
            "valid_until": "2026-06-30",
        },
        headers=headers(viewer),
    )
    assert resp.status_code == 403


def test_viewer_only_sees_approved_tariffs(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]
    viewer = seeded_users["viewer"]

    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": "20ft",
            "move_type": "import",
            "currency": "USD",
            "price": "10.00",
            "valid_from": "2026-01-01",
            "valid_until": "2026-03-01",
        },
        headers=headers(creator),
    )
    tariff_id = resp.json()["id"]

    # As a draft, Viewer should not see it.
    visible = client.get("/api/tariffs", headers=headers(viewer)).json()
    assert all(t["id"] != tariff_id for t in visible)

    client.post(f"/api/tariffs/{tariff_id}/submit", headers=headers(creator))
    client.post(f"/api/tariffs/{tariff_id}/approve", headers=headers(approver))

    visible = client.get("/api/tariffs", headers=headers(viewer)).json()
    assert any(t["id"] == tariff_id for t in visible)


def test_rejected_tariff_can_be_edited_and_resubmitted(client, seeded_users, contract):
    creator = seeded_users["creator"]
    approver = seeded_users["approver"]

    resp = client.post(
        "/api/tariffs",
        json={
            "contract_id": contract.id,
            "size": "40ft",
            "move_type": "export",
            "currency": "EUR",
            "price": "20.00",
            "valid_from": "2026-01-01",
            "valid_until": "2026-03-01",
        },
        headers=headers(creator),
    )
    tariff_id = resp.json()["id"]
    client.post(f"/api/tariffs/{tariff_id}/submit", headers=headers(creator))
    resp = client.post(f"/api/tariffs/{tariff_id}/reject", json={"reason": "Price too low"}, headers=headers(approver))
    assert resp.status_code == 200
    assert resp.json()["status"] == "Rejected"

    # Creator edits and it should auto-resubmit to Pending.
    resp = client.put(f"/api/tariffs/{tariff_id}", json={"price": "35.00"}, headers=headers(creator))
    assert resp.status_code == 200
    assert resp.json()["status"] == "Pending"
    assert resp.json()["rejection_reason"] is None


def test_dashboard_forbidden_for_creator_and_viewer(client, seeded_users):
    creator = seeded_users["creator"]
    viewer = seeded_users["viewer"]
    assert client.get("/api/dashboard", headers=headers(creator)).status_code == 403
    assert client.get("/api/dashboard", headers=headers(viewer)).status_code == 403


def test_dashboard_ok_for_approver(client, seeded_users):
    approver = seeded_users["approver"]
    resp = client.get("/api/dashboard", headers=headers(approver))
    assert resp.status_code == 200
    assert "total_tariffs" in resp.json()
