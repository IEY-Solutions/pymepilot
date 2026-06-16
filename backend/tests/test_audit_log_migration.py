import unittest
from pathlib import Path
import re


class AuditLogMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parent.parent.parent
        migration_path = repo_root / "database" / "migrations" / "059_audit_log.sql"
        self.sql = migration_path.read_text(encoding="utf-8").lower()

    def test_creates_audit_log_table(self) -> None:
        self.assertIn("create table", self.sql)
        self.assertIn("audit_log", self.sql)

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
            self.assertIn(column, self.sql, f"Missing required column: {column}")

    def test_uses_ip_hash_not_raw_ip(self) -> None:
        self.assertIn("ip_hash", self.sql)
        self.assertNotIn("ip_address", self.sql)
        self.assertNotIn("client_ip", self.sql)

    def test_is_insert_only_for_app_user(self) -> None:
        grants = re.findall(r"grant\s+(.*?)\s+on\s+audit_log", self.sql)
        for grant in grants:
            self.assertNotIn("update", grant)
            self.assertNotIn("delete", grant)
            self.assertNotIn("truncate", grant)

    def test_has_primary_key_and_timestamp_default(self) -> None:
        self.assertIn("primary key", self.sql)
        self.assertIn("default", self.sql)
        self.assertIn("now()", self.sql)


if __name__ == "__main__":
    unittest.main()
