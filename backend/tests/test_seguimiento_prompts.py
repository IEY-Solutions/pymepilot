import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.engine.seguimiento import base as seguimiento_base
from backend.engine.seguimiento.base import VerticalBase


class _DummyVertical(VerticalBase):
    vertical_name = "dummy"
    prompt_file = "dummy.txt"

    def get_candidates(self, conn, tenant_id):
        return []

    def get_context(self, conn, tenant_id, candidate):
        return {}

    def calculate_confidence(self, candidate, context):
        return 0.0

    def build_prompt_data(self, candidate, context, profile):
        return {}

    def calculate_contact_date(self, candidate):
        raise NotImplementedError


class SeguimientoPromptTests(unittest.TestCase):
    def test_load_prompt_prefers_module_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            prompts_dir = Path(tmp_dir)
            (prompts_dir / "dummy.txt").write_text(
                "===SYSTEM===\nroot\n===USER===\nroot-user",
                encoding="utf-8",
            )
            (prompts_dir / "seguimiento").mkdir()
            (prompts_dir / "seguimiento" / "dummy.txt").write_text(
                "===SYSTEM===\nmodule\n===USER===\nmodule-user",
                encoding="utf-8",
            )

            vertical = _DummyVertical()

            with patch.object(seguimiento_base, "_PROMPTS_DIR", prompts_dir):
                vertical._load_prompt()

            self.assertEqual(vertical._prompt_system, "module")
            self.assertEqual(vertical._prompt_user, "module-user")

    def test_load_prompt_falls_back_to_legacy_root_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            prompts_dir = Path(tmp_dir)
            (prompts_dir / "dummy.txt").write_text(
                "===SYSTEM===\nlegacy\n===USER===\nlegacy-user",
                encoding="utf-8",
            )

            vertical = _DummyVertical()

            with patch.object(seguimiento_base, "_PROMPTS_DIR", prompts_dir):
                vertical._load_prompt()

            self.assertEqual(vertical._prompt_system, "legacy")
            self.assertEqual(vertical._prompt_user, "legacy-user")


if __name__ == "__main__":
    unittest.main()
