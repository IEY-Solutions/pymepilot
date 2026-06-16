import json
import logging
import unittest

from backend.engine.core.logger import JSONFormatter, SanitizingFormatter


class JSONFormatterTests(unittest.TestCase):
    def _make_record(self, msg: str, extra: dict | None = None) -> logging.LogRecord:
        record = logging.LogRecord(
            name='pymepilot.test',
            level=logging.INFO,
            pathname='',
            lineno=0,
            msg=msg,
            args=(),
            exc_info=None,
        )
        if extra:
            for key, value in extra.items():
                setattr(record, key, value)
        return record

    def test_is_sanitizing_formatter_subclass(self) -> None:
        self.assertTrue(issubclass(JSONFormatter, SanitizingFormatter))

    def test_outputs_valid_json(self) -> None:
        formatter = JSONFormatter()
        record = self._make_record('hello', {
            'correlation_id': 'corr-1',
            'tenant_id': 'tenant-1',
            'event': 'test.event',
        })
        output = formatter.format(record)
        parsed = json.loads(output)
        self.assertEqual(parsed['message'], 'hello')
        self.assertEqual(parsed['level'], 'INFO')
        self.assertEqual(parsed['logger'], 'pymepilot.test')
        self.assertEqual(parsed['correlation_id'], 'corr-1')
        self.assertEqual(parsed['tenant_id'], 'tenant-1')
        self.assertEqual(parsed['event'], 'test.event')
        self.assertIn('timestamp', parsed)

    def test_flattens_context_attribute(self) -> None:
        formatter = JSONFormatter()
        record = self._make_record('context test', {
            'context': {'endpoint': '/api/test', 'method': 'GET'},
        })
        output = formatter.format(record)
        parsed = json.loads(output)
        self.assertEqual(parsed['endpoint'], '/api/test')
        self.assertEqual(parsed['method'], 'GET')
        self.assertNotIn('context', parsed)

    def test_redacts_secrets_in_json_output(self) -> None:
        formatter = JSONFormatter()
        record = self._make_record('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
        output = formatter.format(record)
        parsed = json.loads(output)
        self.assertEqual(parsed['message'], '***REDACTED***')


if __name__ == '__main__':
    unittest.main()
