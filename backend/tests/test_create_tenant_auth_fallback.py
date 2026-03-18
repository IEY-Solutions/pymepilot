import io
import json
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from backend.scripts import create_tenant


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


class CreateTenantAuthFallbackTests(unittest.TestCase):
    @patch("backend.scripts.create_tenant.subprocess.run")
    def test_discovers_direct_gotrue_url_from_docker_inspect(self, mock_run: Mock) -> None:
        mock_run.return_value = Mock(stdout="172.18.0.6\n")

        direct_url = create_tenant._discover_direct_gotrue_base_url()

        self.assertEqual(direct_url, "http://172.18.0.6:9999")

    @patch(
        "backend.scripts.create_tenant._iter_gotrue_base_urls",
        return_value=["http://kong/auth/v1", "http://172.18.0.6:9999"],
    )
    @patch("backend.scripts.create_tenant.urlopen")
    def test_retries_direct_auth_after_kong_401(
        self,
        mock_urlopen: Mock,
        _mock_base_urls: Mock,
    ) -> None:
        mock_urlopen.side_effect = [
            HTTPError(
                url="http://kong/auth/v1/admin/users",
                code=401,
                msg="Unauthorized",
                hdrs=None,
                fp=io.BytesIO(b'{"message":"Invalid authentication credentials"}'),
            ),
            _FakeResponse({"users": []}),
        ]

        response = create_tenant._gotrue_request("GET", "/admin/users")

        self.assertEqual(response, {"users": []})
        self.assertEqual(mock_urlopen.call_count, 2)

    @patch("backend.scripts.create_tenant.get_db_connection")
    def test_count_profiles_uses_tenant_context_connection(
        self,
        mock_get_db_connection: Mock,
    ) -> None:
        mock_conn = Mock()
        mock_conn.execute.return_value.fetchone.return_value = (2,)
        mock_get_db_connection.return_value.__enter__.return_value = mock_conn

        count = create_tenant._count_profiles_for_tenant(
            "b815e5d6-2ef0-4d27-999b-8a7642b71183"
        )

        self.assertEqual(count, 2)
        mock_get_db_connection.assert_called_once_with(
            "b815e5d6-2ef0-4d27-999b-8a7642b71183"
        )


if __name__ == "__main__":
    unittest.main()
