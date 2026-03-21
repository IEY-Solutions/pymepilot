import unittest
from decimal import Decimal
from unittest.mock import Mock

from backend.engine.db import queries


class _FakeCursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, dict]] = []

    def __enter__(self) -> "_FakeCursor":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def execute(self, sql: str, params: dict) -> None:
        self.executed.append((sql, params))


class QueryRegressionTests(unittest.TestCase):
    def test_update_prediction_attribution_casts_variadic_jsonb_parameters(self) -> None:
        fake_cursor = _FakeCursor()
        fake_conn = Mock()
        fake_conn.cursor.return_value = fake_cursor

        queries.update_prediction_attribution(
            fake_conn,
            tenant_id="tenant-1",
            prediction_id="prediction-1",
            order_id="order-1",
            order_amount=Decimal("123.45"),
        )

        self.assertEqual(len(fake_cursor.executed), 1)
        sql, params = fake_cursor.executed[0]

        self.assertIn("%(order_id)s::text", sql)
        self.assertIn("%(order_amount)s::numeric", sql)
        self.assertEqual(params["tenant_id"], "tenant-1")
        self.assertEqual(params["prediction_id"], "prediction-1")
        self.assertEqual(params["order_id"], "order-1")
        self.assertEqual(params["order_amount"], 123.45)


if __name__ == "__main__":
    unittest.main()
