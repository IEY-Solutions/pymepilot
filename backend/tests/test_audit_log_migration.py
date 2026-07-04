import unittest
from pathlib import Path
import re


class AuditLogMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parent.parent.parent
        self.sql_059 = (repo_root / "database" / "migrations" / "059_audit_log.sql").read_text(encoding="utf-8").lower()
        self.sql_060 = (repo_root / "database" / "migrations" / "060_audit_log_rls_and_roles.sql").read_text(encoding="utf-8").lower()
        self.sql_060_rollback = (repo_root / "database" / "migrations" / "060_rollback.sql").read_text(encoding="utf-8").lower()
        self.sql_061 = (repo_root / "database" / "migrations" / "061_audit_log_hardening.sql").read_text(encoding="utf-8").lower()
        self.sql_061_rollback = (repo_root / "database" / "migrations" / "061_rollback.sql").read_text(encoding="utf-8").lower()

    def test_creates_audit_log_table(self) -> None:
        self.assertIn("create table", self.sql_059)
        self.assertIn("audit_log", self.sql_059)

    def test_has_required_columns(self) -> None:
        required = {
            "id",
            "timestamp",
            "actor_user_id",
            "actor_tenant_id",
            "action",
            "resource",
            "result",
            "correlation_id",
            "severity",
            "ip_hash",
        }
        for column in required:
            self.assertIn(column, self.sql_059, f"Missing required column: {column}")

    def test_uses_ip_hash_not_raw_ip(self) -> None:
        self.assertIn("ip_hash", self.sql_059)
        self.assertNotIn("ip_address", self.sql_059)
        self.assertNotIn("client_ip", self.sql_059)

    def test_is_insert_only_for_app_user(self) -> None:
        grants = re.findall(r"grant\s+(.*?)\s+on\s+audit_log", self.sql_059)
        for grant in grants:
            self.assertNotIn("update", grant)
            self.assertNotIn("delete", grant)
            self.assertNotIn("truncate", grant)

    def test_keeps_historical_migration_contract_intact(self) -> None:
        self.assertIn("current_setting('app.current_tenant_id')", self.sql_059)
        self.assertIn("alter default privileges in schema public grant usage, select on sequences to pymepilot_app", self.sql_059)
        self.assertNotIn("get_current_tenant_id()", self.sql_059)
        self.assertNotIn("enable row level security", self.sql_059)

    def test_followup_migration_enables_rls_and_supabase_role_access(self) -> None:
        self.assertIn("enable row level security", self.sql_060)
        self.assertIn("force row level security", self.sql_060)
        self.assertIn("grant insert on public.audit_log to anon, authenticated", self.sql_060)
        self.assertIn("grant select on public.audit_log to authenticated", self.sql_060)
        self.assertIn("get_current_tenant_id()", self.sql_060)
        self.assertIn("coalesce(get_current_tenant_id()", self.sql_060)
        self.assertIn("00000000-0000-0000-0000-000000000000", self.sql_060)

    def test_followup_rollback_restores_historical_policy_state(self) -> None:
        self.assertIn("revoke insert on public.audit_log from anon, authenticated", self.sql_060_rollback)
        self.assertIn("revoke select on public.audit_log from authenticated", self.sql_060_rollback)
        self.assertIn("current_setting('app.current_tenant_id')", self.sql_060_rollback)
        self.assertIn("to pymepilot_app", self.sql_060_rollback)
        self.assertNotIn("disable row level security", self.sql_060_rollback)

    def test_hardening_migration_revokes_anon_insert_and_binds_authenticated_writes(self) -> None:
        self.assertIn("revoke insert on public.audit_log from anon, authenticated, pymepilot_app", self.sql_061)
        self.assertIn("grant select on public.audit_log to authenticated, pymepilot_app", self.sql_061)
        self.assertIn("create or replace function public.record_audit_log", self.sql_061)
        self.assertIn("grant execute on function public.record_audit_log", self.sql_061)
        self.assertIn("force row level security", self.sql_061)
        self.assertNotIn("for insert", self.sql_061)
        self.assertNotIn("coalesce(get_current_tenant_id()", self.sql_061)
        self.assertNotIn("grant insert on public.audit_log to anon", self.sql_061)

    def test_hardening_rollback_keeps_rls_forced_and_write_path(self) -> None:
        self.assertIn("revoke insert on public.audit_log from anon, authenticated, pymepilot_app", self.sql_061_rollback)
        self.assertIn("grant insert on public.audit_log to pymepilot_app", self.sql_061_rollback)
        self.assertIn("grant select on public.audit_log to authenticated, pymepilot_app", self.sql_061_rollback)
        self.assertIn("create policy audit_log_app_insert on audit_log", self.sql_061_rollback)
        self.assertNotIn("drop function if exists public.record_audit_log", self.sql_061_rollback)
        self.assertNotIn("grant insert on public.audit_log to anon", self.sql_061_rollback)
        self.assertNotIn("coalesce(get_current_tenant_id()", self.sql_061_rollback)
        self.assertIn("force row level security", self.sql_061_rollback)
        self.assertNotIn("disable row level security", self.sql_061_rollback)

    def test_has_primary_key_and_timestamp_default(self) -> None:
        self.assertIn("primary key", self.sql_059)
        self.assertIn("default", self.sql_059)
        self.assertIn("now()", self.sql_059)


if __name__ == "__main__":
    unittest.main()
