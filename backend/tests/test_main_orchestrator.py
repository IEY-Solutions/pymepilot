import unittest
from argparse import Namespace
from contextlib import nullcontext
from unittest.mock import Mock, patch

from backend import main as orchestrator


class MainOrchestratorTests(unittest.TestCase):
    def test_refreshes_materialized_views_after_all_syncs(self) -> None:
        tenant_a = {
            "id": "tenant-a",
            "slug": "a",
            "name": "Tenant A",
            "erp_type": "contabilium",
            "active_verticals": ["reposicion"],
        }
        tenant_b = {
            "id": "tenant-b",
            "slug": "b",
            "name": "Tenant B",
            "erp_type": "contabilium",
            "active_verticals": ["reposicion"],
        }
        events: list[str] = []

        def fake_sync(tenant: dict) -> bool:
            events.append(f"sync:{tenant['slug']}")
            return True

        def fake_refresh() -> bool:
            events.append("refresh")
            return True

        def fake_attribution(tenant_id: str, tenant_slug: str) -> int:
            events.append(f"attr:{tenant_slug}")
            return 0

        def fake_verticals(tenant: dict, dry_run: bool) -> dict:
            events.append(f"verticals:{tenant['slug']}")
            return {"predictions": 0, "limit_exceeded": False}

        def fake_push(
            tenant_id: str,
            tenant_slug: str,
            predictions_count: int,
            attributed_count: int,
        ) -> None:
            events.append(f"push:{tenant_slug}")

        with (
            patch.object(orchestrator.argparse.ArgumentParser, "parse_args", return_value=Namespace(dry_run=False, tenant_slug=None)),
            patch("backend.main.get_db_connection_no_tenant", return_value=nullcontext(Mock())),
            patch("backend.main._create_run", side_effect=lambda conn: events.append("create_run") or "run-1"),
            patch("backend.main._get_active_tenants", side_effect=lambda conn, slug: events.append("get_active_tenants") or [tenant_a, tenant_b]),
            patch("backend.main._run_sync", side_effect=fake_sync),
            patch("backend.main._refresh_views", side_effect=fake_refresh),
            patch("backend.main._run_attribution", side_effect=fake_attribution),
            patch("backend.main._run_verticals", side_effect=fake_verticals),
            patch("backend.main._send_push_notifications", side_effect=fake_push),
            patch("backend.main._update_run", side_effect=lambda conn, *args: events.append("update_run")),
            patch("backend.main.close_pool"),
        ):
            orchestrator.main()

        self.assertEqual(
            events,
            [
                "create_run",
                "get_active_tenants",
                "sync:a",
                "sync:b",
                "refresh",
                "attr:a",
                "verticals:a",
                "push:a",
                "attr:b",
                "verticals:b",
                "push:b",
                "update_run",
            ],
        )

    def test_skips_refresh_when_all_syncs_fail(self) -> None:
        tenant = {
            "id": "tenant-a",
            "slug": "a",
            "name": "Tenant A",
            "erp_type": "contabilium",
            "active_verticals": ["reposicion"],
        }
        events: list[str] = []

        with (
            patch.object(orchestrator.argparse.ArgumentParser, "parse_args", return_value=Namespace(dry_run=False, tenant_slug=None)),
            patch("backend.main.get_db_connection_no_tenant", return_value=nullcontext(Mock())),
            patch("backend.main._create_run", side_effect=lambda conn: events.append("create_run") or "run-1"),
            patch("backend.main._get_active_tenants", side_effect=lambda conn, slug: [tenant]),
            patch("backend.main._run_sync", side_effect=lambda tenant: events.append(f"sync:{tenant['slug']}") or False),
            patch("backend.main._refresh_views", side_effect=lambda: events.append("refresh") or True),
            patch("backend.main._run_attribution", side_effect=lambda tenant_id, tenant_slug: events.append("attr") or 0),
            patch("backend.main._run_verticals", side_effect=lambda tenant, dry_run: events.append("verticals") or {"predictions": 0, "limit_exceeded": False}),
            patch("backend.main._send_push_notifications", side_effect=lambda *args: events.append("push")),
            patch("backend.main._update_run"),
            patch("backend.main.close_pool"),
        ):
            orchestrator.main()

        self.assertEqual(events, ["create_run", "sync:a"])


if __name__ == "__main__":
    unittest.main()
