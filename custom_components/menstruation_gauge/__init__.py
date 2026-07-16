"""Menstruation gauge integration."""

from __future__ import annotations

import inspect
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError

try:
    from homeassistant.core import SupportsResponse
except ImportError:
    SupportsResponse = None  # type: ignore[assignment,misc]
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from .const import (
    ATTR_HISTORY,
    ATTR_PERIOD_DURATION_DAYS,
    ATTR_PRODUCT_USAGE,
    ATTR_SYMPTOM_HISTORY,
    CONF_FRIENDLY_NAME,
    CONF_ICON,
    CONF_NAME,
    CONF_PROFILE,
    DEFAULT_NAME,
    DEFAULT_PERIOD_DURATION_DAYS,
    DEFAULT_MENARCHE_AGE_MAX,
    DEFAULT_MENARCHE_AGE_MIN,
    DOMAIN,
    PRE_MENARCHE_SIGN_OPTIONS,
    SERVICE_ADD_CYCLE_START,
    SERVICE_ADD_PRE_MENARCHE_SIGN,
    SERVICE_FIELD_ACTION,
    SERVICE_ADD_SYMPTOM,
    SERVICE_ERASE_ALL_HISTORY,
    SERVICE_EXPORT_HISTORY,
    SERVICE_FIELD_DATE,
    SERVICE_FIELD_DATES,
    SERVICE_FIELD_DAYS,
    SERVICE_FIELD_ENTITY_ID,
    SERVICE_FIELD_ENTRY_ID,
    SERVICE_FIELD_ERASE_ALL,
    SERVICE_FIELD_ESTIMATED_MENARCHE_DATE,
    SERVICE_FIELD_FAMILY_MENARCHE_AGE,
    SERVICE_FIELD_FILENAME,
    SERVICE_FIELD_FORMAT,
    SERVICE_FIELD_IS_PREGNANT,
    SERVICE_FIELD_PRODUCT,
    SERVICE_FIELD_PREGNANCY_START_DATE,
    SERVICE_FIELD_PRE_MENARCHE_SIGN,
    SERVICE_FIELD_PROFILE,
    SERVICE_FIELD_QUANTITY,
    SERVICE_FIELD_SYMPTOM_DATA,
    SERVICE_FIELD_TANNER_STAGE,
    SERVICE_GET_MENARCHE_INFO,
    SERVICE_GET_SYMPTOM,
    SERVICE_LOG_PRODUCT_USAGE,
    SERVICE_REFRESH_CYCLE_MODEL,
    SERVICE_REMOVE_CYCLE_START,
    SERVICE_REMOVE_PRE_MENARCHE_SIGN,
    SERVICE_REMOVE_SYMPTOM,
    SERVICE_SET_CYCLE_HISTORY,
    SERVICE_SET_MENARCHE_MODE,
    SERVICE_SET_PERIOD_DURATION,
    SERVICE_SET_PREGNANCY_MODE,
    SERVICE_UPDATE_MENARCHE_DATE,
    SERVICE_UPDATE_PREGNANCY_DATE,
    SIGNAL_HISTORY_UPDATED,
    STORAGE_KEY,
    SYMPTOM_BASAL_TEMP,
    SYMPTOM_OPTIONS,
    TANNER_STAGE_1,
    TANNER_STAGE_2,
    TANNER_STAGE_3,
    TANNER_STAGE_4,
    TANNER_STAGE_5,
)
from .model import normalize_history
from .storage import MenstruationStorage

PLATFORMS: list[Platform] = [Platform.SENSOR]
CARD_RESOURCE_URL = "/menstruation_gauge/menstruation-gauge-card.js"
HEATMAP_RESOURCE_URL = "/menstruation_gauge/menstruation-cycle-heatmap-card.js"
TIMER_RESOURCE_URL = "/menstruation_gauge/period-countdown-timer.js"
PRODUCT_STATS_RESOURCE_URL = "/menstruation_gauge/menstrual-product-stats-card.js"
COMPACT_CARD_RESOURCE_URL = "/menstruation_gauge/menstrual-cycle-card-compact.js"
HISTORY_ROW_RESOURCE_URL = "/menstruation_gauge/menstrual-cycle-history-card-row.js"
HISTORY_ANALOG_RESOURCE_URL = "/menstruation_gauge/menstrual-cycle-history-card-analog.js"
CARD_RESOURCE_TYPE = "module"
EXPORT_DIR_NAME = "menstruation_gauge_exports"
LOVELACE_RESOURCES = (
    (CARD_RESOURCE_URL, "menstruation-gauge-card.js"),
    (HEATMAP_RESOURCE_URL, "menstruation-cycle-heatmap-card.js"),
    (TIMER_RESOURCE_URL, "period-countdown-timer.js"),
    (PRODUCT_STATS_RESOURCE_URL, "menstrual-product-stats-card.js"),
    (COMPACT_CARD_RESOURCE_URL, "menstrual-cycle-card-compact.js"),
    (HISTORY_ROW_RESOURCE_URL, "menstrual-cycle-history-card-row.js"),
    (HISTORY_ANALOG_RESOURCE_URL, "menstrual-cycle-history-card-analog.js"),
)
VALID_PRODUCT_USAGE_PRODUCTS = {"tampon", "pad", "cup", "underwear", "liner"}
VALID_PRODUCT_USAGE_ACTIONS = {"used", "emptied"}

_LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class MenstruationRuntime:
    """Runtime data for one profile."""

    storage: MenstruationStorage
    profile: str
    friendly_name: str
    icon: str
    history: list[str]
    period_duration_days: int
    symptom_history: list[dict[str, Any]]
    product_usage: list[dict[str, Any]]
    pregnancy_data: dict[str, Any] = field(default_factory=lambda: {"is_pregnant": False, "start_date": None})
    menarche_data: dict[str, Any] = field(default_factory=lambda: {"tracking_active": False, "is_menarche": False, "menarche_date": None, "estimated_date": None, "family_menarche_age": None})
    pre_menarche_data: dict[str, Any] = field(default_factory=lambda: {"signs": {}, "tanner_stage": None})
    unregister_midnight_listener: Callable[[], None] | None = None


CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


def _profile_from_entry(entry: ConfigEntry) -> str:
    profile = slugify(str(entry.data.get(CONF_PROFILE, ""))).strip("_")
    if profile:
        return profile
    legacy_name = str(entry.data.get(CONF_NAME, DEFAULT_NAME))
    return slugify(legacy_name).strip("_") or "default"


def _friendly_name_from_entry(entry: ConfigEntry) -> str:
    return str(entry.data.get(CONF_FRIENDLY_NAME) or entry.data.get(CONF_NAME) or DEFAULT_NAME).strip() or DEFAULT_NAME


def _icon_from_entry(entry: ConfigEntry) -> str:
    return str(entry.data.get(CONF_ICON, "")).strip()


def _normalize_date_or_raise(value: str) -> str:
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError as err:
        raise HomeAssistantError(f"Invalid date '{value}', expected YYYY-MM-DD") from err


def _runtime_by_profile(hass: HomeAssistant, profile: str) -> MenstruationRuntime:
    domain_data: dict[str, MenstruationRuntime] = hass.data.get(DOMAIN, {})
    if not domain_data:
        raise HomeAssistantError("No menstruation_gauge config entry loaded")

    wanted = slugify(str(profile)).strip("_")
    for runtime in domain_data.values():
        if runtime.profile == wanted:
            return runtime
    raise HomeAssistantError(f"Unknown profile '{profile}'.")


def _runtime_for_call(hass: HomeAssistant, call: ServiceCall) -> MenstruationRuntime:
    domain_data: dict[str, MenstruationRuntime] = hass.data.get(DOMAIN, {})
    if not domain_data:
        raise HomeAssistantError("No menstruation_gauge config entry loaded")

    profile = call.data.get(SERVICE_FIELD_PROFILE)
    if profile is not None and str(profile).strip():
        return _runtime_by_profile(hass, str(profile))

    entity_id = call.data.get(SERVICE_FIELD_ENTITY_ID)
    if entity_id is not None and str(entity_id).strip():
        state_obj = hass.states.get(str(entity_id).strip())
        if state_obj is None:
            raise HomeAssistantError(f"Unknown entity_id '{entity_id}'.")
        runtime_entry_id = state_obj.attributes.get("entry_id")
        if runtime_entry_id and runtime_entry_id in domain_data:
            return domain_data[runtime_entry_id]
        raise HomeAssistantError(f"Entity '{entity_id}' is not a menstruation_gauge sensor.")

    entry_id = call.data.get(SERVICE_FIELD_ENTRY_ID)
    if entry_id is not None and str(entry_id).strip():
        runtime = domain_data.get(str(entry_id).strip())
        if runtime is not None:
            return runtime
        raise HomeAssistantError(f"Unknown entry_id '{entry_id}'.")

    if len(domain_data) == 1:
        return next(iter(domain_data.values()))

    known = ", ".join(sorted(runtime.profile for runtime in domain_data.values()))
    raise HomeAssistantError(
        f"Multiple profiles configured. Provide '{SERVICE_FIELD_PROFILE}' in service data. Known: {known}"
    )


async def _async_save_and_notify(hass: HomeAssistant, runtime: MenstruationRuntime) -> None:
    runtime.history = normalize_history(runtime.history)
    runtime.period_duration_days = max(1, min(14, int(runtime.period_duration_days)))
    await runtime.storage.async_save(
        runtime.history,
        runtime.period_duration_days,
        runtime.symptom_history,
        runtime.product_usage,
        runtime.pregnancy_data,
        runtime.menarche_data,
        runtime.pre_menarche_data,
    )
    await _async_refresh_cycle_model(hass, {_entry_id_for_runtime(hass, runtime)})


def _entry_id_for_runtime(hass: HomeAssistant, runtime: MenstruationRuntime) -> str:
    for entry_id, candidate in hass.data.get(DOMAIN, {}).items():
        if candidate is runtime:
            return entry_id
    raise HomeAssistantError(f"Runtime for profile '{runtime.profile}' is not registered.")


def _target_entry_ids_for_call(hass: HomeAssistant, call: ServiceCall | None = None) -> set[str]:
    domain_data: dict[str, MenstruationRuntime] = hass.data.get(DOMAIN, {})
    if not domain_data:
        return set()

    if call is None or not call.data:
        return set(domain_data)

    runtime = _runtime_for_call(hass, call)
    return {_entry_id_for_runtime(hass, runtime)}


async def _async_refresh_cycle_model(hass: HomeAssistant, entry_ids: set[str] | None = None) -> None:
    """Trigger recalculation for loaded cycle sensors and force entity updates."""
    async_dispatcher_send(hass, SIGNAL_HISTORY_UPDATED)

    entity_registry = er.async_get(hass)
    target_entry_ids = entry_ids or set(hass.data.get(DOMAIN, {}))
    entity_ids: list[str] = []

    for entry_id in target_entry_ids:
        for entity_entry in er.async_entries_for_config_entry(entity_registry, entry_id):
            if entity_entry.domain == Platform.SENSOR:
                entity_ids.append(entity_entry.entity_id)

    if entity_ids:
        await hass.services.async_call(
            "homeassistant",
            "update_entity",
            {"entity_id": entity_ids},
            blocking=True,
        )


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up integration from YAML (not used, config-entry only)."""
    return True


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old single-profile entry to profile schema."""
    if entry.version >= 2:
        return True

    old_name = str(entry.data.get(CONF_NAME, DEFAULT_NAME)).strip() or DEFAULT_NAME
    profile = slugify(old_name).strip("_") or "default"
    new_data = {
        CONF_PROFILE: profile,
        CONF_FRIENDLY_NAME: old_name,
        CONF_ICON: "",
    }
    hass.config_entries.async_update_entry(entry, data=new_data, title=old_name, version=2)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up menstruation gauge profile from config entry."""
    hass.data.setdefault(DOMAIN, {})

    profile = _profile_from_entry(entry)
    friendly_name = _friendly_name_from_entry(entry)
    icon = _icon_from_entry(entry)

    storage = MenstruationStorage(
        hass,
        key=f"{STORAGE_KEY}.{profile}",
        legacy_key=STORAGE_KEY if profile == "default" else None,
    )
    stored = await storage.async_load()

    runtime = MenstruationRuntime(
        storage=storage,
        profile=profile,
        friendly_name=friendly_name,
        icon=icon,
        history=stored[ATTR_HISTORY],
        period_duration_days=stored.get(ATTR_PERIOD_DURATION_DAYS, DEFAULT_PERIOD_DURATION_DAYS),
        symptom_history=stored.get(ATTR_SYMPTOM_HISTORY, []),
        product_usage=stored.get(ATTR_PRODUCT_USAGE, []),
        pregnancy_data=stored.get("pregnancy_data", {"is_pregnant": False, "start_date": None}),
        menarche_data=stored.get("menarche_data", {"tracking_active": False, "is_menarche": False, "menarche_date": None, "estimated_date": None, "family_menarche_age": None}),
        pre_menarche_data=stored.get("pre_menarche_data", {"signs": {}, "tanner_stage": None}),
    )

    runtime.unregister_midnight_listener = async_track_time_change(
        hass,
        lambda now: hass.async_create_task(_async_refresh_cycle_model(hass, {entry.entry_id})),
        hour=0,
        minute=0,
        second=5,
    )

    hass.data[DOMAIN][entry.entry_id] = runtime

    async def async_add(call: ServiceCall) -> None:
        await _async_handle_add(hass, call)

    async def async_remove(call: ServiceCall) -> None:
        await _async_handle_remove(hass, call)

    async def async_set_history(call: ServiceCall) -> None:
        await _async_handle_set_history(hass, call)

    async def async_set_period_duration(call: ServiceCall) -> None:
        await _async_handle_set_period_duration(hass, call)

    async def async_erase_all_history(call: ServiceCall) -> None:
        await _async_handle_erase_all_history(hass, call)

    async def async_export_history(call: ServiceCall) -> None:
        await _async_handle_export_history(hass, call)

    async def async_refresh_cycle_model(call: ServiceCall) -> None:
        await _async_handle_refresh_cycle_model(hass, call)

    async def async_log_product_usage(call: ServiceCall) -> None:
        await _async_handle_log_product_usage(hass, call)

    async def async_add_symptom(call: ServiceCall) -> None:
        await _async_handle_add_symptom(hass, call)

    async def async_remove_symptom(call: ServiceCall) -> None:
        await _async_handle_remove_symptom(hass, call)

    async def async_get_symptom(call: ServiceCall) -> dict[str, Any]:
        return await _async_handle_get_symptom(hass, call)

    async def async_set_pregnancy_mode(call: ServiceCall) -> None:
        await _async_handle_set_pregnancy_mode(hass, call)

    async def async_update_pregnancy_date(call: ServiceCall) -> None:
        await _async_handle_update_pregnancy_date(hass, call)

    async def async_set_menarche_mode(call: ServiceCall) -> None:
        await _async_handle_set_menarche_mode(hass, call)

    async def async_update_menarche_date(call: ServiceCall) -> None:
        await _async_handle_update_menarche_date(hass, call)

    async def async_get_menarche_info(call: ServiceCall) -> dict[str, Any]:
        return await _async_handle_get_menarche_info(hass, call)

    async def async_add_pre_menarche_sign(call: ServiceCall) -> None:
        await _async_handle_add_pre_menarche_sign(hass, call)

    async def async_remove_pre_menarche_sign(call: ServiceCall) -> None:
        await _async_handle_remove_pre_menarche_sign(hass, call)

    common_profile_field = {
        vol.Optional(SERVICE_FIELD_ENTITY_ID): cv.entity_id,
        vol.Optional(SERVICE_FIELD_PROFILE): cv.string,
        vol.Optional(SERVICE_FIELD_ENTRY_ID): cv.string,
    }

    if not hass.services.has_service(DOMAIN, SERVICE_ADD_CYCLE_START):
        hass.services.async_register(
            DOMAIN,
            SERVICE_ADD_CYCLE_START,
            async_add,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_REMOVE_CYCLE_START):
        hass.services.async_register(
            DOMAIN,
            SERVICE_REMOVE_CYCLE_START,
            async_remove,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_CYCLE_HISTORY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_CYCLE_HISTORY,
            async_set_history,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATES): [cv.string]}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_PERIOD_DURATION):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_PERIOD_DURATION,
            async_set_period_duration,
            schema=vol.Schema(
                {
                    **common_profile_field,
                    vol.Required(SERVICE_FIELD_DAYS): vol.All(vol.Coerce(int), vol.Range(min=1, max=14)),
                }
            ),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_ERASE_ALL_HISTORY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_ERASE_ALL_HISTORY,
            async_erase_all_history,
            schema=vol.Schema(
                {
                    **common_profile_field,
                    vol.Required(SERVICE_FIELD_ENTITY_ID): cv.entity_id,
                    vol.Required(SERVICE_FIELD_ERASE_ALL): vol.Equal(True),
                }
            ),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_EXPORT_HISTORY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_EXPORT_HISTORY,
            async_export_history,
            schema=vol.Schema(
                {
                    **common_profile_field,
                    vol.Optional(SERVICE_FIELD_FORMAT, default="csv"): vol.In(["csv", "txt"]),
                    vol.Optional(SERVICE_FIELD_FILENAME): cv.string,
                }
            ),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_REFRESH_CYCLE_MODEL):
        hass.services.async_register(
            DOMAIN,
            SERVICE_REFRESH_CYCLE_MODEL,
            async_refresh_cycle_model,
            schema=vol.Schema(common_profile_field),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_LOG_PRODUCT_USAGE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_LOG_PRODUCT_USAGE,
            async_log_product_usage,
            schema=vol.Schema(
                {
                    **common_profile_field,
                    vol.Required(SERVICE_FIELD_PRODUCT): cv.string,
                    vol.Optional(SERVICE_FIELD_ACTION, default="used"): vol.In(VALID_PRODUCT_USAGE_ACTIONS),
                    vol.Optional(SERVICE_FIELD_QUANTITY, default=1): vol.All(vol.Coerce(int), vol.Range(min=1, max=50)),
                    vol.Optional(SERVICE_FIELD_DATE): cv.string,
                }
            ),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_ADD_SYMPTOM):
        hass.services.async_register(
            DOMAIN,
            SERVICE_ADD_SYMPTOM,
            async_add_symptom,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string, vol.Required(SERVICE_FIELD_SYMPTOM_DATA): dict}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_REMOVE_SYMPTOM):
        hass.services.async_register(
            DOMAIN,
            SERVICE_REMOVE_SYMPTOM,
            async_remove_symptom,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_GET_SYMPTOM):
        _register_kwargs: dict[str, Any] = {
            "schema": vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
        }
        if SupportsResponse is not None:
            _register_kwargs["supports_response"] = SupportsResponse.OPTIONAL
        hass.services.async_register(DOMAIN, SERVICE_GET_SYMPTOM, async_get_symptom, **_register_kwargs)

    if not hass.services.has_service(DOMAIN, SERVICE_SET_PREGNANCY_MODE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_PREGNANCY_MODE,
            async_set_pregnancy_mode,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_IS_PREGNANT): cv.boolean, vol.Optional(SERVICE_FIELD_PREGNANCY_START_DATE): cv.string}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_UPDATE_PREGNANCY_DATE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_UPDATE_PREGNANCY_DATE,
            async_update_pregnancy_date,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_PREGNANCY_START_DATE): cv.string}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_MENARCHE_MODE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_MENARCHE_MODE,
            async_set_menarche_mode,
            schema=vol.Schema({
                **common_profile_field,
                vol.Required("is_menarche"): cv.boolean,
                vol.Optional(SERVICE_FIELD_ESTIMATED_MENARCHE_DATE): cv.string,
                vol.Optional(SERVICE_FIELD_FAMILY_MENARCHE_AGE): vol.All(vol.Coerce(int), vol.Range(min=DEFAULT_MENARCHE_AGE_MIN, max=DEFAULT_MENARCHE_AGE_MAX)),
            }),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_UPDATE_MENARCHE_DATE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_UPDATE_MENARCHE_DATE,
            async_update_menarche_date,
            schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_GET_MENARCHE_INFO):
        _menarche_info_kwargs: dict[str, Any] = {
            "schema": vol.Schema(common_profile_field),
        }
        if SupportsResponse is not None:
            _menarche_info_kwargs["supports_response"] = SupportsResponse.OPTIONAL
        hass.services.async_register(DOMAIN, SERVICE_GET_MENARCHE_INFO, async_get_menarche_info, **_menarche_info_kwargs)

    if not hass.services.has_service(DOMAIN, SERVICE_ADD_PRE_MENARCHE_SIGN):
        hass.services.async_register(
            DOMAIN,
            SERVICE_ADD_PRE_MENARCHE_SIGN,
            async_add_pre_menarche_sign,
            schema=vol.Schema({
                **common_profile_field,
                vol.Required(SERVICE_FIELD_PRE_MENARCHE_SIGN): vol.In(list(PRE_MENARCHE_SIGN_OPTIONS.keys())),
                vol.Required(SERVICE_FIELD_TANNER_STAGE): cv.string,
            }),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_REMOVE_PRE_MENARCHE_SIGN):
        hass.services.async_register(
            DOMAIN,
            SERVICE_REMOVE_PRE_MENARCHE_SIGN,
            async_remove_pre_menarche_sign,
            schema=vol.Schema({
                **common_profile_field,
                vol.Required(SERVICE_FIELD_PRE_MENARCHE_SIGN): vol.In(list(PRE_MENARCHE_SIGN_OPTIONS.keys())),
            }),
        )

    await _async_register_card_static_path(hass)
    await _async_ensure_lovelace_resource(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    runtime: MenstruationRuntime | None = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    if runtime and runtime.unregister_midnight_listener:
        runtime.unregister_midnight_listener()

    if not hass.data.get(DOMAIN):
        for service in (
            SERVICE_ADD_CYCLE_START,
            SERVICE_REMOVE_CYCLE_START,
            SERVICE_SET_CYCLE_HISTORY,
            SERVICE_SET_PERIOD_DURATION,
            SERVICE_ERASE_ALL_HISTORY,
            SERVICE_EXPORT_HISTORY,
            SERVICE_REFRESH_CYCLE_MODEL,
            SERVICE_LOG_PRODUCT_USAGE,
            SERVICE_ADD_SYMPTOM,
            SERVICE_REMOVE_SYMPTOM,
            SERVICE_GET_SYMPTOM,
            SERVICE_SET_PREGNANCY_MODE,
            SERVICE_UPDATE_PREGNANCY_DATE,
            SERVICE_SET_MENARCHE_MODE,
            SERVICE_UPDATE_MENARCHE_DATE,
            SERVICE_GET_MENARCHE_INFO,
            SERVICE_ADD_PRE_MENARCHE_SIGN,
            SERVICE_REMOVE_PRE_MENARCHE_SIGN,
        ):
            if hass.services.has_service(DOMAIN, service):
                hass.services.async_remove(DOMAIN, service)

    return unload_ok


async def _async_handle_add(hass: HomeAssistant, call: ServiceCall) -> None:
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])
    if date_iso not in runtime.history:
        runtime.history.append(date_iso)
    await _async_save_and_notify(hass, runtime)


async def _async_handle_remove(hass: HomeAssistant, call: ServiceCall) -> None:
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])
    runtime.history = [item for item in runtime.history if item != date_iso]
    await _async_save_and_notify(hass, runtime)


async def _async_handle_set_history(hass: HomeAssistant, call: ServiceCall) -> None:
    runtime = _runtime_for_call(hass, call)
    dates = [_normalize_date_or_raise(raw) for raw in call.data[SERVICE_FIELD_DATES]]
    runtime.history = dates
    await _async_save_and_notify(hass, runtime)


async def _async_handle_set_period_duration(hass: HomeAssistant, call: ServiceCall) -> None:
    runtime = _runtime_for_call(hass, call)
    runtime.period_duration_days = int(call.data[SERVICE_FIELD_DAYS])
    await _async_save_and_notify(hass, runtime)


async def _async_handle_erase_all_history(hass: HomeAssistant, call: ServiceCall) -> None:
    entity_id = str(call.data.get(SERVICE_FIELD_ENTITY_ID, "")).strip()
    if not entity_id:
        raise HomeAssistantError("Refusing to erase history. Provide entity_id explicitly for safety.")
    runtime = _runtime_for_call(hass, call)
    erase_all = call.data.get(SERVICE_FIELD_ERASE_ALL)
    if erase_all is not True:
        raise HomeAssistantError("Refusing to erase history. Set erase_all: true to confirm destructive action.")
    runtime.history = []
    await _async_save_and_notify(hass, runtime)


def _sanitize_export_filename(raw: str) -> str:
    candidate = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in str(raw))
    return candidate.strip("._") or "menstruation_history"


async def _async_handle_export_history(hass: HomeAssistant, call: ServiceCall) -> None:
    runtime = _runtime_for_call(hass, call)
    export_format = str(call.data.get(SERVICE_FIELD_FORMAT, "csv")).lower()
    if export_format not in {"csv", "txt"}:
        raise HomeAssistantError("Invalid format. Use 'csv' or 'txt'.")

    stem = call.data.get(SERVICE_FIELD_FILENAME)
    if stem:
        stem = _sanitize_export_filename(str(stem))
    else:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = f"menstruation_history_{runtime.profile}_{stamp}"

    extension = ".csv" if export_format == "csv" else ".txt"
    target_dir = Path(hass.config.path(EXPORT_DIR_NAME))
    target_path = target_dir / f"{stem}{extension}"

    history = normalize_history(runtime.history)
    if export_format == "csv":
        content = "date\n" + "\n".join(history) + ("\n" if history else "")
    else:
        content = "\n".join(history) + ("\n" if history else "")

    def _write_file() -> None:
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path.write_text(content, encoding="utf-8")

    await hass.async_add_executor_job(_write_file)
    _LOGGER.info("Exported menstruation history for profile '%s' to %s", runtime.profile, target_path)


async def _async_handle_refresh_cycle_model(hass: HomeAssistant, call: ServiceCall) -> None:
    await _async_refresh_cycle_model(hass, _target_entry_ids_for_call(hass, call))


async def _async_handle_log_product_usage(hass: HomeAssistant, call: ServiceCall) -> None:
    """Log product usage for the selected profile/entity."""
    runtime = _runtime_for_call(hass, call)
    product = str(call.data.get(SERVICE_FIELD_PRODUCT, "")).strip().lower()
    action = str(call.data.get(SERVICE_FIELD_ACTION, "used")).strip().lower() or "used"
    quantity = int(call.data.get(SERVICE_FIELD_QUANTITY, 1))
    raw_date = call.data.get(SERVICE_FIELD_DATE)
    date_iso = _normalize_date_or_raise(raw_date) if raw_date else dt_util.now().date().isoformat()

    if product not in VALID_PRODUCT_USAGE_PRODUCTS:
        valid_products = ", ".join(sorted(VALID_PRODUCT_USAGE_PRODUCTS))
        raise HomeAssistantError(f"Unsupported product '{product}'. Use one of: {valid_products}")

    if action not in VALID_PRODUCT_USAGE_ACTIONS:
        valid_actions = ", ".join(sorted(VALID_PRODUCT_USAGE_ACTIONS))
        raise HomeAssistantError(f"Unsupported action '{action}'. Use one of: {valid_actions}")

    runtime.product_usage.append(
        {
            "date": date_iso,
            "product": product,
            "quantity": max(1, quantity),
            "action": action,
        }
    )
    await _async_save_and_notify(hass, runtime)


async def _async_handle_add_symptom(hass: HomeAssistant, call: ServiceCall) -> None:
    """Add or update symptom data for a date."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])
    symptom_data = call.data.get(SERVICE_FIELD_SYMPTOM_DATA, {})

    if not isinstance(symptom_data, dict):
        raise HomeAssistantError("Symptom data must be a dictionary.")

    valid_fields = set(SYMPTOM_OPTIONS.keys()) | {SYMPTOM_BASAL_TEMP}
    for key, value in symptom_data.items():
        if key not in valid_fields:
            raise HomeAssistantError(
                f"Unknown symptom field '{key}'. Valid fields: {', '.join(sorted(valid_fields))}"
            )
        if key == SYMPTOM_BASAL_TEMP:
            try:
                float(value)
            except (TypeError, ValueError):
                raise HomeAssistantError(f"Symptom field '{SYMPTOM_BASAL_TEMP}' must be a number, got '{value}'.")
        else:
            allowed = SYMPTOM_OPTIONS[key]
            values_to_check = value if isinstance(value, list) else [value]
            for item in values_to_check:
                if item not in allowed:
                    raise HomeAssistantError(
                        f"Invalid value '{item}' for symptom field '{key}'. Allowed: {', '.join(allowed)}"
                    )

    existing = None
    for entry in runtime.symptom_history:
        if entry.get("date") == date_iso:
            existing = entry
            break

    if existing:
        existing.update(symptom_data)
        existing["date"] = date_iso
    else:
        new_entry = dict(symptom_data)
        new_entry["date"] = date_iso
        runtime.symptom_history.append(new_entry)

    runtime.symptom_history.sort(key=lambda x: x.get("date", ""))
    await _async_save_and_notify(hass, runtime)


async def _async_handle_remove_symptom(hass: HomeAssistant, call: ServiceCall) -> None:
    """Remove symptom data for a date."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])

    runtime.symptom_history = [entry for entry in runtime.symptom_history if entry.get("date") != date_iso]
    await _async_save_and_notify(hass, runtime)


async def _async_handle_get_symptom(hass: HomeAssistant, call: ServiceCall) -> dict[str, Any]:
    """Get symptom data for a date."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])

    for entry in runtime.symptom_history:
        if entry.get("date") == date_iso:
            _LOGGER.info("Symptom data for %s: %s", date_iso, entry)
            return dict(entry)

    _LOGGER.info("No symptom data found for %s", date_iso)
    return {"date": date_iso, "found": False}


async def _async_handle_set_pregnancy_mode(hass: HomeAssistant, call: ServiceCall) -> None:
    """Set pregnancy mode on or off."""
    runtime = _runtime_for_call(hass, call)
    is_pregnant = bool(call.data.get(SERVICE_FIELD_IS_PREGNANT, False))
    pregnancy_start_date = call.data.get(SERVICE_FIELD_PREGNANCY_START_DATE)
    if pregnancy_start_date:
        pregnancy_start_date = _normalize_date_or_raise(pregnancy_start_date)
    elif is_pregnant and runtime.history:
        pregnancy_start_date = runtime.history[-1]
    else:
        pregnancy_start_date = None
    runtime.pregnancy_data = {"is_pregnant": is_pregnant, "start_date": pregnancy_start_date}
    await _async_save_and_notify(hass, runtime)


async def _async_handle_update_pregnancy_date(hass: HomeAssistant, call: ServiceCall) -> None:
    """Update pregnancy start date."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_PREGNANCY_START_DATE])
    runtime.pregnancy_data["start_date"] = date_iso
    await _async_save_and_notify(hass, runtime)


async def _async_handle_set_menarche_mode(hass: HomeAssistant, call: ServiceCall) -> None:
    """Set menarche mode - enable pre-menarche tracking or confirm menarche occurred."""
    runtime = _runtime_for_call(hass, call)
    is_menarche = bool(call.data.get("is_menarche", False))
    estimated_date = call.data.get(SERVICE_FIELD_ESTIMATED_MENARCHE_DATE)
    family_age = call.data.get(SERVICE_FIELD_FAMILY_MENARCHE_AGE)

    if estimated_date:
        estimated_date = _normalize_date_or_raise(estimated_date)

    runtime.menarche_data = {
        "tracking_active": True,
        "is_menarche": is_menarche,
        "menarche_date": runtime.menarche_data.get("menarche_date"),
        "estimated_date": estimated_date,
        "family_menarche_age": int(family_age) if family_age is not None else runtime.menarche_data.get("family_menarche_age"),
    }
    await _async_save_and_notify(hass, runtime)


async def _async_handle_update_menarche_date(hass: HomeAssistant, call: ServiceCall) -> None:
    """Record the actual menarche date (first period)."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])
    runtime.menarche_data["tracking_active"] = True
    runtime.menarche_data["is_menarche"] = True
    runtime.menarche_data["menarche_date"] = date_iso
    await _async_save_and_notify(hass, runtime)


async def _async_handle_get_menarche_info(hass: HomeAssistant, call: ServiceCall) -> dict[str, Any]:
    """Get menarche and pre-menarche information."""
    runtime = _runtime_for_call(hass, call)
    _LOGGER.info("Menarche info for profile '%s': %s", runtime.profile, runtime.menarche_data)
    return {
        "menarche_data": dict(runtime.menarche_data),
        "pre_menarche_data": dict(runtime.pre_menarche_data),
    }


async def _async_handle_add_pre_menarche_sign(hass: HomeAssistant, call: ServiceCall) -> None:
    """Add or update a pre-menarche body sign."""
    runtime = _runtime_for_call(hass, call)
    sign = str(call.data[SERVICE_FIELD_PRE_MENARCHE_SIGN])
    stage = str(call.data[SERVICE_FIELD_TANNER_STAGE])

    if sign not in PRE_MENARCHE_SIGN_OPTIONS:
        raise HomeAssistantError(f"Unknown pre-menarche sign '{sign}'.")
    allowed_stages = PRE_MENARCHE_SIGN_OPTIONS[sign]
    if stage not in allowed_stages:
        raise HomeAssistantError(
            f"Invalid value '{stage}' for sign '{sign}'. Allowed: {', '.join(allowed_stages)}"
        )

    if not isinstance(runtime.pre_menarche_data.get("signs"), dict):
        runtime.pre_menarche_data["signs"] = {}
    runtime.pre_menarche_data["signs"][sign] = stage
    await _async_save_and_notify(hass, runtime)


async def _async_handle_remove_pre_menarche_sign(hass: HomeAssistant, call: ServiceCall) -> None:
    """Remove a pre-menarche body sign."""
    runtime = _runtime_for_call(hass, call)
    sign = str(call.data[SERVICE_FIELD_PRE_MENARCHE_SIGN])

    if isinstance(runtime.pre_menarche_data.get("signs"), dict):
        runtime.pre_menarche_data["signs"].pop(sign, None)
    await _async_save_and_notify(hass, runtime)


async def _maybe_await(result: Any) -> Any:
    """Await coroutine-like values, return plain values unchanged."""
    if inspect.isawaitable(result):
        return await result
    return result


async def _async_ensure_lovelace_resource(hass: HomeAssistant) -> None:
    """Auto-register Lovelace JS resources for storage dashboards."""
    try:
        from homeassistant.components.lovelace.resources import async_get_resource_collection
    except Exception as err:
        _LOGGER.debug("Lovelace resource API unavailable, skip auto registration: %s", err)
        return

    try:
        collection = await _maybe_await(async_get_resource_collection(hass))
        items = await _maybe_await(collection.async_items())
        existing_urls = {
            item.get("url")
            for item in items or []
            if isinstance(item, dict) and item.get("url")
        }

        for resource_url, _filename in LOVELACE_RESOURCES:
            if resource_url in existing_urls:
                continue

            created = False
            for payload in (
                {"url": resource_url, "res_type": CARD_RESOURCE_TYPE},
                {"url": resource_url, "type": CARD_RESOURCE_TYPE},
            ):
                try:
                    await _maybe_await(collection.async_create_item(payload))
                    created = True
                    break
                except Exception:
                    continue

            if created:
                _LOGGER.info("Registered Lovelace resource automatically: %s", resource_url)
            else:
                _LOGGER.warning("Could not auto-register Lovelace resource. Add manually: %s", resource_url)
    except Exception as err:
        _LOGGER.warning("Auto-registration of Lovelace resources failed, add them manually (%s)", err)


async def _async_register_card_static_path(hass: HomeAssistant) -> None:
    """Register card JS files as static paths across HA core API variants."""
    static_files = [
        (url, str(Path(__file__).parent / "www" / filename))
        for url, filename in LOVELACE_RESOURCES
    ]
    if hasattr(hass.http, "async_register_static_paths"):
        try:
            from homeassistant.components.http import StaticPathConfig
            await _maybe_await(hass.http.async_register_static_paths([StaticPathConfig(url_path=url, path=path, cache_headers=False) for url, path in static_files]))
            return
        except Exception:
            pass
    if hasattr(hass.http, "async_register_static_path"):
        for url, path in static_files:
            await _maybe_await(hass.http.async_register_static_path(url, path, False))
        return
    if hasattr(hass.http, "register_static_path"):
        for url, path in static_files:
            await hass.async_add_executor_job(hass.http.register_static_path, url, path, False)
        return
    _LOGGER.warning("No compatible HA HTTP static-path API found for %s", CARD_RESOURCE_URL)
