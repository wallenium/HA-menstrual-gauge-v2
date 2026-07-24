from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from datetime import date, datetime
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

    const_mod = types.ModuleType("homeassistant.const")
    const_mod.CONF_TYPE = "type"
    const_mod.Platform = type("Platform", (), {"SENSOR": "sensor"})
    sys.modules.setdefault("homeassistant.const", const_mod)

    core = types.ModuleType("homeassistant.core")
    core.HomeAssistant = type("HomeAssistant", (), {})
    core.ServiceCall = type("ServiceCall", (), {})
    sys.modules.setdefault("homeassistant.core", core)

    exceptions = types.ModuleType("homeassistant.exceptions")
    exceptions.HomeAssistantError = type("HomeAssistantError", (Exception,), {})
    sys.modules.setdefault("homeassistant.exceptions", exceptions)

    helpers = types.ModuleType("homeassistant.helpers")
    helpers.__path__ = []
    sys.modules.setdefault("homeassistant.helpers", helpers)

    config_validation = types.ModuleType("homeassistant.helpers.config_validation")
    config_validation.config_entry_only_config_schema = lambda domain: domain
    config_validation.string = lambda value: value
    config_validation.entity_id = lambda value: value
    config_validation.boolean = lambda value: value
    sys.modules.setdefault("homeassistant.helpers.config_validation", config_validation)

    entity_registry = types.ModuleType("homeassistant.helpers.entity_registry")
    entity_registry.async_get = lambda hass: object()
    entity_registry.async_entries_for_config_entry = lambda registry, entry_id: []
    sys.modules.setdefault("homeassistant.helpers.entity_registry", entity_registry)

    dispatcher = types.ModuleType("homeassistant.helpers.dispatcher")
    dispatcher.async_dispatcher_connect = lambda *args, **kwargs: None
    dispatcher.async_dispatcher_send = lambda *args, **kwargs: None
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
    util.slugify = lambda value: str(value).strip().lower().replace(" ", "_")
    sys.modules.setdefault("homeassistant.util", util)

    dt_mod = types.ModuleType("homeassistant.util.dt")
    dt_mod.now = lambda: datetime(2026, 7, 20, 8, 0, 0)
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
integration = _load_module("mgtest.integration", "__init__.py")


class _FakeStorage:
    def __init__(self) -> None:
        self.saved_args = None

    async def async_save(self, *args, **kwargs) -> None:
        self.saved_args = args


class _FakeServices:
    def __init__(self) -> None:
        self.registrations: dict[str, dict[str, object]] = {}

    def async_register(self, domain, service, handler, **kwargs) -> None:
        self.registrations[service] = {"domain": domain, "handler": handler, **kwargs}

    def has_service(self, domain, service) -> bool:
        return service in self.registrations

    def async_remove(self, domain, service) -> None:
        self.registrations.pop(service, None)

    async def async_call(self, domain, service, data, blocking=False) -> None:
        return None


class _FakeHass:
    def __init__(self, runtime=None) -> None:
        self.data = {const.DOMAIN: {"entry-1": runtime}} if runtime is not None else {const.DOMAIN: {}}
        self.services = _FakeServices()
        self.states = types.SimpleNamespace(get=lambda entity_id: None)


class _FakeCall:
    def __init__(self, data) -> None:
        self.data = data


class ProductUsageBackendTests(unittest.TestCase):
    def test_register_domain_services_registers_log_first_period_without_required_date(self) -> None:
        hass = _FakeHass()

        integration._register_domain_services(hass)

        registration = hass.services.registrations[const.SERVICE_LOG_FIRST_PERIOD]
        self.assertEqual(registration["domain"], const.DOMAIN)
        self.assertEqual(registration["schema"]({}), {})
        self.assertEqual(
            registration["schema"]({const.SERVICE_FIELD_DATE: "2026-07-19"}),
            {const.SERVICE_FIELD_DATE: "2026-07-19"},
        )

    def test_log_first_period_defaults_to_today_and_updates_runtime(self) -> None:
        runtime = integration.MenstruationRuntime(
            storage=_FakeStorage(),
            profile="default",
            friendly_name="Default",
            icon="",
            history=[],
            period_duration_days=5,
            symptom_history=[],
            product_usage=[],
            menarche_data={
                "tracking_active": False,
                "is_menarche": False,
                "menarche_date": None,
                "estimated_date": "2026-08-01",
                "family_menarche_age": 12,
            },
        )
        hass = _FakeHass(runtime)
        refreshed_entry_ids: list[set[str]] = []

        async def _fake_refresh(hass_arg, entry_ids=None) -> None:
            refreshed_entry_ids.append(set(entry_ids or set()))

        integration._async_refresh_cycle_model = _fake_refresh
        integration.dt_util.now = lambda: datetime(2026, 7, 20, 8, 0, 0)

        asyncio.run(integration._async_handle_log_first_period(hass, _FakeCall({})))

        self.assertEqual(runtime.history, ["2026-07-20"])
        self.assertTrue(runtime.menarche_data["tracking_active"])
        self.assertTrue(runtime.menarche_data["is_menarche"])
        self.assertEqual(runtime.menarche_data["menarche_date"], "2026-07-20")
        self.assertEqual(runtime.menarche_data["estimated_date"], "2026-08-01")
        self.assertEqual(runtime.menarche_data["family_menarche_age"], 12)
        self.assertIsNotNone(runtime.storage.saved_args)
        self.assertEqual(runtime.storage.saved_args[5]["menarche_date"], "2026-07-20")
        self.assertEqual(refreshed_entry_ids, [{"entry-1"}])

    def test_build_cycle_model_keeps_period_active_until_duration_limit(self) -> None:
        cycle = model.build_cycle_model(
            history=["2026-07-01"],
            period_duration_days=5,
            symptom_history=[],
            today=date(2026, 7, 2),
        )

        self.assertEqual(cycle.state, const.STATE_PERIOD)
        self.assertIsNotNone(cycle.current_period)
        self.assertTrue(cycle.current_period["is_active"])
        self.assertEqual(cycle.current_period["days_elapsed"], 2)
        self.assertEqual(cycle.current_period["effective_duration"], 5)

    def test_build_cycle_model_ends_period_when_none_is_logged(self) -> None:
        cycle = model.build_cycle_model(
            history=["2026-07-01", "2026-07-02"],
            period_duration_days=5,
            symptom_history=[{"date": "2026-07-03", "bleeding_strength": "none"}],
            today=date(2026, 7, 3),
        )

        self.assertNotEqual(cycle.state, const.STATE_PERIOD)
        self.assertIsNotNone(cycle.current_period)
        self.assertFalse(cycle.current_period["is_active"])
        self.assertEqual(cycle.current_period["ended_by"], "bleeding_none")

    def test_build_cycle_model_ends_period_after_average_duration(self) -> None:
        cycle = model.build_cycle_model(
            history=["2026-07-01", "2026-07-02"],
            period_duration_days=5,
            symptom_history=[],
            today=date(2026, 7, 6),
        )

        self.assertNotEqual(cycle.state, const.STATE_PERIOD)
        self.assertIsNotNone(cycle.current_period)
        self.assertFalse(cycle.current_period["is_active"])
        self.assertEqual(cycle.current_period["ended_by"], "duration")

    def test_build_cycle_model_sets_fertile_window_to_ovulation_plus_minus_five_days_for_28_day_cycle(self) -> None:
        cycle = model.build_cycle_model(
            history=["2026-06-01", "2026-06-29"],
            period_duration_days=5,
            symptom_history=[],
            today=date(2026, 7, 1),
        )

        self.assertEqual(cycle.ovulation_day, "2026-07-12")
        self.assertEqual(cycle.fertile_window_start, "2026-07-07")
        self.assertEqual(cycle.fertile_window_end, "2026-07-17")

    def test_build_cycle_model_sets_fertile_window_to_ovulation_plus_minus_five_days_for_30_day_cycle(self) -> None:
        cycle = model.build_cycle_model(
            history=["2026-05-01", "2026-05-31"],
            period_duration_days=5,
            symptom_history=[],
            today=date(2026, 6, 1),
        )

        self.assertEqual(cycle.ovulation_day, "2026-06-14")
        self.assertEqual(cycle.fertile_window_start, "2026-06-09")
        self.assertEqual(cycle.fertile_window_end, "2026-06-19")

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

    def test_storage_normalizes_quantity_variants(self) -> None:
        normalized = storage.MenstruationStorage._normalize_product_usage(
            [
                {"date": "2026-07-18", "product": "tampon", "quantity": "3"},
                {"date": "2026-07-18", "product": "pad", "quantity": "2x"},
                {"date": "2026-07-18", "product": "cup", "quantity": "3.0"},
                {"date": "2026-07-18", "product": "liner", "quantity": "0"},
                {"date": "2026-07-18", "product": "underwear", "quantity": "invalid"},
            ]
        )

        self.assertEqual(
            normalized,
            [
                {"date": "2026-07-18", "product": "cup", "quantity": 3, "action": "used"},
                {"date": "2026-07-18", "product": "liner", "quantity": 1, "action": "used"},
                {"date": "2026-07-18", "product": "pad", "quantity": 2, "action": "used"},
                {"date": "2026-07-18", "product": "tampon", "quantity": 3, "action": "used"},
                {"date": "2026-07-18", "product": "underwear", "quantity": 1, "action": "used"},
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

    def test_build_product_usage_stats_sums_quantities_same_day(self) -> None:
        stats = sensor._build_product_usage_stats(
            history=["2026-07-18", "2026-07-19"],
            product_usage=[
                {"date": "2026-07-18", "product": "tampon", "quantity": "2x"},
                {"date": "2026-07-18", "product": "tampon", "quantity": "3"},
                {"date": "2026-07-18", "product": "pad", "quantity": 0},
                {"date": "2026-07-18", "product": "cup", "quantity": None},
            ],
            today=date(2026, 7, 19),
            symptom_history=[],
        )

        self.assertEqual(stats["today"], {"tampon": 0, "pad": 0, "cup": 0, "liner": 0, "underwear": 0})
        self.assertEqual(stats["this_cycle"], {"tampon": 5, "pad": 1, "cup": 1, "liner": 0, "underwear": 0})
        self.assertEqual(stats["stats"]["average_per_cycle"], {"tampon": 5, "pad": 1, "cup": 1, "liner": 0, "underwear": 0})


if __name__ == "__main__":
    unittest.main()
