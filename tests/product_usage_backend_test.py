from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
COMPONENT_ROOT = REPO_ROOT / "custom_components" / "menstruation_gauge"


def _install_homeassistant_stubs() -> None:
    homeassistant = types.ModuleType("homeassistant")
    homeassistant.__path__ = []
    sys.modules.setdefault("homeassistant", homeassistant)

    components = types.ModuleType("homeassistant.components")
    components.__path__ = []
    sys.modules.setdefault("homeassistant.components", components)

    sensor_mod = types.ModuleType("homeassistant.components.sensor")
    sensor_mod.SensorEntity = type("SensorEntity", (), {})
    sys.modules.setdefault("homeassistant.components.sensor", sensor_mod)

    config_entries = types.ModuleType("homeassistant.config_entries")
    config_entries.ConfigEntry = type("ConfigEntry", (), {})
    sys.modules.setdefault("homeassistant.config_entries", config_entries)

    core = types.ModuleType("homeassistant.core")
    core.HomeAssistant = type("HomeAssistant", (), {})
    sys.modules.setdefault("homeassistant.core", core)

    helpers = types.ModuleType("homeassistant.helpers")
    helpers.__path__ = []
    sys.modules.setdefault("homeassistant.helpers", helpers)

    dispatcher = types.ModuleType("homeassistant.helpers.dispatcher")
    dispatcher.async_dispatcher_connect = lambda *args, **kwargs: None
    sys.modules.setdefault("homeassistant.helpers.dispatcher", dispatcher)

    entity_platform = types.ModuleType("homeassistant.helpers.entity_platform")
    entity_platform.AddEntitiesCallback = type("AddEntitiesCallback", (), {})
    sys.modules.setdefault("homeassistant.helpers.entity_platform", entity_platform)

    event = types.ModuleType("homeassistant.helpers.event")
    event.async_track_time_change = lambda *args, **kwargs: None
    sys.modules.setdefault("homeassistant.helpers.event", event)

    storage = types.ModuleType("homeassistant.helpers.storage")
    storage.Store = type("Store", (), {"__init__": lambda self, *args, **kwargs: None})
    sys.modules.setdefault("homeassistant.helpers.storage", storage)

    typing_mod = types.ModuleType("homeassistant.helpers.typing")
    typing_mod.StateType = object
    sys.modules.setdefault("homeassistant.helpers.typing", typing_mod)

    util = types.ModuleType("homeassistant.util")
    util.__path__ = []
    sys.modules.setdefault("homeassistant.util", util)

    dt_mod = types.ModuleType("homeassistant.util.dt")
    dt_mod.now = lambda: None
    sys.modules.setdefault("homeassistant.util.dt", dt_mod)


def _load_module(module_name: str, file_name: str):
    spec = importlib.util.spec_from_file_location(module_name, COMPONENT_ROOT / file_name)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


_install_homeassistant_stubs()
package = types.ModuleType("mgtest")
package.__path__ = [str(COMPONENT_ROOT)]
sys.modules.setdefault("mgtest", package)
const = _load_module("mgtest.const", "const.py")
model = _load_module("mgtest.model", "model.py")
sensor = _load_module("mgtest.sensor", "sensor.py")
storage = _load_module("mgtest.storage", "storage.py")


class ProductUsageBackendTests(unittest.TestCase):
    def test_storage_normalizes_aliases_and_dates(self) -> None:
        entries = [
            {"created_at": "2026-07-18T09:15:00Z", "product": "pantyliners", "quantity": "2"},
            {"date": "2026-07-19T10:30:00+02:00", "product": "period panties"},
            {"timestamp": "1752883200", "product": "binde"},
        ]

        normalized = storage.MenstruationStorage._normalize_product_usage(entries)

        self.assertEqual(
            normalized,
            [
                {"date": "2025-07-19", "product": "pad", "quantity": 1, "action": "used"},
                {"date": "2026-07-18", "product": "liner", "quantity": 2, "action": "used"},
                {"date": "2026-07-19", "product": "underwear", "quantity": 1, "action": "used"},
            ],
        )

    def test_merge_product_usage_sources_uses_symptom_fallbacks(self) -> None:
        merged = sensor._merge_product_usage_sources(
            [
                {"date": "2026-07-18", "product": "tampon", "quantity": 2},
            ],
            [
                {"date": "2026-07-18", "hygiene": ["tampon", "period_underwear"]},
                {"date": "2026-07-19", "hygiene": ["pantyliners"]},
            ],
        )

        self.assertEqual(
            merged,
            [
                {"date": "2026-07-18", "product": "tampon", "quantity": 2, "action": "used"},
                {"date": "2026-07-18", "product": "underwear", "quantity": 1, "action": "used"},
                {"date": "2026-07-19", "product": "liner", "quantity": 1, "action": "used"},
            ],
        )

    def test_compact_product_usage_includes_exact_cutoff_day(self) -> None:
        compact = sensor._compact_product_usage_for_sensor(
            product_usage=[],
            symptom_history=[
                {"date": "2026-06-19", "hygiene": ["tampon"]},
                {"date": "2026-06-20", "hygiene": ["pad"]},
                {"date": "2026-07-19", "hygiene": ["period_underwear"]},
            ],
            today=date(2026, 7, 19),
            days=30,
        )

        self.assertEqual(
            compact,
            [
                {"date": "2026-06-20", "product": "pad", "quantity": 1, "action": "used"},
                {"date": "2026-07-19", "product": "underwear", "quantity": 1, "action": "used"},
            ],
        )

    def test_build_product_usage_stats_counts_mixed_sources(self) -> None:
        stats = sensor._build_product_usage_stats(
            history=["2026-07-18", "2026-07-19"],
            product_usage=[
                {"created_at": "2026-07-18T08:00:00Z", "product": "tampon", "quantity": 2},
                {"date": "2026-07-18", "product": "cup", "quantity": 1, "action": "emptied"},
            ],
            today=date(2026, 7, 19),
            symptom_history=[
                {"date": "2026-07-18", "hygiene": ["tampon", "pantyliners", "period_underwear"]},
                {"date": "2026-07-19", "hygiene": ["binde"]},
            ],
        )

        self.assertEqual(stats["today"], {"tampon": 0, "pad": 1, "cup": 0, "liner": 0, "underwear": 0})
        self.assertEqual(stats["this_cycle"], {"tampon": 2, "pad": 1, "cup": 1, "liner": 1, "underwear": 1})
        self.assertEqual(stats["stats"]["cycles_considered"], 1)
        self.assertEqual(stats["stats"]["average_per_cycle"], {"tampon": 2, "pad": 1, "cup": 1, "liner": 1, "underwear": 1})


if __name__ == "__main__":
    unittest.main()
