"""Menstruation gauge integration."""

from __future__ import annotations

import inspect
import json
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_TYPE, Platform
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
from homeassistant.helpers.storage import Store
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
    SERVICE_FIELD_IS_MENOPAUSE,
    SERVICE_FIELD_MENOPAUSE_START_DATE,
    SERVICE_FIELD_PRODUCT,
    SERVICE_FIELD_PREGNANCY_START_DATE,
    SERVICE_FIELD_PRE_MENARCHE_SIGN,
    SERVICE_FIELD_PROFILE,
    SERVICE_FIELD_QUANTITY,
    SERVICE_FIELD_SYMPTOM_DATA,
    SERVICE_FIELD_TANNER_STAGE,
    SERVICE_FIELD_WARNING_THRESHOLD,
    SERVICE_GET_MENARCHE_INFO,
    SERVICE_GET_SYMPTOM,
    SERVICE_LOG_PRODUCT_USAGE,
    SERVICE_MANAGE_HOUSEHOLD_INVENTORY,
    SERVICE_FIELD_CRITICAL_THRESHOLD,
    SERVICE_REFRESH_CYCLE_MODEL,
    SERVICE_FIELD_INVENTORY_ACTION,
    SERVICE_FIELD_MEMBER,
    SERVICE_REMOVE_CYCLE_START,
    SERVICE_REMOVE_PRE_MENARCHE_SIGN,
    SERVICE_REMOVE_SYMPTOM,
    SERVICE_SET_CYCLE_HISTORY,
    SERVICE_SET_MENARCHE_MODE,
    SERVICE_SET_MENOPAUSE_MODE,
    SERVICE_SET_PERIOD_DURATION,
    SERVICE_SET_PREGNANCY_MODE,
    SERVICE_SAVE_TIMER_STATE,
    SERVICE_EXPORT_DOCTOR_REPORT,
    SERVICE_FIELD_DAYS_BACK,
    SERVICE_FIELD_PATIENT_NAME,
    SERVICE_FIELD_PATIENT_BIRTHDATE,
    SERVICE_FIELD_LANGUAGE,
    SERVICE_UPDATE_MENARCHE_DATE,
    SERVICE_UPDATE_MENOPAUSE_DATE,
    SERVICE_UPDATE_PREGNANCY_DATE,
    SIGNAL_HISTORY_UPDATED,
    STORAGE_KEY,
    STORAGE_VERSION,
    SYMPTOM_BASAL_TEMP,
    SYMPTOM_CLOTS,
    SYMPTOM_CLOT_SIZE,
    SYMPTOM_OPTIONS,
    TANNER_STAGE_1,
    TANNER_STAGE_2,
    TANNER_STAGE_3,
    TANNER_STAGE_4,
    TANNER_STAGE_5,
)
from .model import build_cycle_model, normalize_history
from .statistics import compute_statistics, generate_doctor_report_html
from .storage import MenstruationStorage

PLATFORMS: list[Platform] = [Platform.SENSOR]
MANIFEST_PATH = Path(__file__).with_name("manifest.json")
WWW_DIR = Path(__file__).parent / "www"
ASSETS_DIR = Path(__file__).parent / "assets"
_ALLOWED_ASSET_SUBFOLDERS: frozenset[str] = frozenset({"pregnancy", "period", "state"})
_HTTP_ROUTES_REGISTERED_KEY = f"{DOMAIN}_http_routes_registered"
_LOVELACE_RESOURCES_ENSURED_KEY = f"{DOMAIN}_lovelace_resources_ensured"
_LOVELACE_RESOURCES_SCHEDULED_KEY = f"{DOMAIN}_lovelace_resources_scheduled"


def _load_manifest_version() -> str:
    """Read the integration version from manifest.json for cache busting."""
    try:
        with MANIFEST_PATH.open(encoding="utf-8") as manifest_file:
            version = json.load(manifest_file).get("version")
    except (OSError, TypeError, ValueError):
        return "0.0.0"
    return str(version or "0.0.0")


def _build_card_static_url(filename: str) -> str:
    """Build the HTTP handler path for a card JS file."""
    return f"/{DOMAIN}/{filename}"


def _build_card_resource_url(filename: str) -> str:
    """Build the Lovelace resource URL with version-based cache busting."""
    return f"{_build_card_static_url(filename)}?v={RESOURCE_VERSION}"


RESOURCE_VERSION = _load_manifest_version()
CARD_STATIC_URL = _build_card_static_url("menstruation-gauge-card.js")
HEATMAP_STATIC_URL = _build_card_static_url("menstruation-cycle-heatmap-card.js")
PRODUCT_ICONS_STATIC_URL = _build_card_static_url("product-icons.js")
TIMER_STATIC_URL = _build_card_static_url("period-countdown-timer.js")
TIMER_EDITOR_STATIC_URL = _build_card_static_url("period-countdown-timer-editor.js")
PRODUCT_STATS_STATIC_URL = _build_card_static_url("menstrual-product-stats-card.js")
PRODUCT_INVENTORY_STATIC_URL = _build_card_static_url("menstrual-product-inventory-card.js")
PRODUCT_INVENTORY_EDITOR_STATIC_URL = _build_card_static_url("menstrual-product-inventory-card-editor.js")
HEATMAP_EDITOR_STATIC_URL = _build_card_static_url("menstruation-cycle-heatmap-card-editor.js")
HISTORY_ROW_EDITOR_STATIC_URL = _build_card_static_url("menstrual-cycle-history-card-row-editor.js")
COMPACT_CARD_STATIC_URL = _build_card_static_url("menstrual-cycle-card-compact.js")
HISTORY_ROW_STATIC_URL = _build_card_static_url("menstrual-cycle-history-card-row.js")
HISTORY_ANALOG_STATIC_URL = _build_card_static_url("menstrual-cycle-history-card-analog.js")
COMPACT_STATUS_STATIC_URL = _build_card_static_url("menstrual-cycle-compact-status-card.js")
STATISTICS_CARD_STATIC_URL = _build_card_static_url("menstrual-statistics-card.js")
STATISTICS_CARD_EDITOR_STATIC_URL = _build_card_static_url("menstrual-statistics-card-editor.js")
CARD_RESOURCE_URL = _build_card_resource_url("menstruation-gauge-card.js")
HEATMAP_RESOURCE_URL = _build_card_resource_url("menstruation-cycle-heatmap-card.js")
PRODUCT_ICONS_RESOURCE_URL = _build_card_resource_url("product-icons.js")
TIMER_RESOURCE_URL = _build_card_resource_url("period-countdown-timer.js")
TIMER_EDITOR_RESOURCE_URL = _build_card_resource_url("period-countdown-timer-editor.js")
PRODUCT_STATS_RESOURCE_URL = _build_card_resource_url("menstrual-product-stats-card.js")
PRODUCT_INVENTORY_RESOURCE_URL = _build_card_resource_url("menstrual-product-inventory-card.js")
PRODUCT_INVENTORY_EDITOR_RESOURCE_URL = _build_card_resource_url("menstrual-product-inventory-card-editor.js")
HEATMAP_EDITOR_RESOURCE_URL = _build_card_resource_url("menstruation-cycle-heatmap-card-editor.js")
HISTORY_ROW_EDITOR_RESOURCE_URL = _build_card_resource_url("menstrual-cycle-history-card-row-editor.js")
COMPACT_CARD_RESOURCE_URL = _build_card_resource_url("menstrual-cycle-card-compact.js")
HISTORY_ROW_RESOURCE_URL = _build_card_resource_url("menstrual-cycle-history-card-row.js")
HISTORY_ANALOG_RESOURCE_URL = _build_card_resource_url("menstrual-cycle-history-card-analog.js")
COMPACT_STATUS_RESOURCE_URL = _build_card_resource_url("menstrual-cycle-compact-status-card.js")
STATISTICS_CARD_RESOURCE_URL = _build_card_resource_url("menstrual-statistics-card.js")
STATISTICS_CARD_EDITOR_RESOURCE_URL = _build_card_resource_url("menstrual-statistics-card-editor.js")
CARD_RESOURCE_TYPE = "module"
EXPORT_DIR_NAME = "menstruation_gauge_exports"
LOVELACE_RESOURCES = (
    (CARD_RESOURCE_URL, CARD_STATIC_URL, "menstruation-gauge-card.js"),
    (PRODUCT_ICONS_RESOURCE_URL, PRODUCT_ICONS_STATIC_URL, "product-icons.js"),
    (HEATMAP_RESOURCE_URL, HEATMAP_STATIC_URL, "menstruation-cycle-heatmap-card.js"),
    (TIMER_RESOURCE_URL, TIMER_STATIC_URL, "period-countdown-timer.js"),
    (TIMER_EDITOR_RESOURCE_URL, TIMER_EDITOR_STATIC_URL, "period-countdown-timer-editor.js"),
    (PRODUCT_STATS_RESOURCE_URL, PRODUCT_STATS_STATIC_URL, "menstrual-product-stats-card.js"),
    (PRODUCT_INVENTORY_RESOURCE_URL, PRODUCT_INVENTORY_STATIC_URL, "menstrual-product-inventory-card.js"),
    (PRODUCT_INVENTORY_EDITOR_RESOURCE_URL, PRODUCT_INVENTORY_EDITOR_STATIC_URL, "menstrual-product-inventory-card-editor.js"),
    (HEATMAP_EDITOR_RESOURCE_URL, HEATMAP_EDITOR_STATIC_URL, "menstruation-cycle-heatmap-card-editor.js"),
    (HISTORY_ROW_EDITOR_RESOURCE_URL, HISTORY_ROW_EDITOR_STATIC_URL, "menstrual-cycle-history-card-row-editor.js"),
    (COMPACT_CARD_RESOURCE_URL, COMPACT_CARD_STATIC_URL, "menstrual-cycle-card-compact.js"),
    (COMPACT_STATUS_RESOURCE_URL, COMPACT_STATUS_STATIC_URL, "menstrual-cycle-compact-status-card.js"),
    (HISTORY_ROW_RESOURCE_URL, HISTORY_ROW_STATIC_URL, "menstrual-cycle-history-card-row.js"),
    (HISTORY_ANALOG_RESOURCE_URL, HISTORY_ANALOG_STATIC_URL, "menstrual-cycle-history-card-analog.js"),
    (STATISTICS_CARD_RESOURCE_URL, STATISTICS_CARD_STATIC_URL, "menstrual-statistics-card.js"),
    (STATISTICS_CARD_EDITOR_RESOURCE_URL, STATISTICS_CARD_EDITOR_STATIC_URL, "menstrual-statistics-card-editor.js"),
)
VALID_PRODUCT_USAGE_PRODUCTS = {"tampon", "pad", "cup", "underwear", "liner"}
VALID_PRODUCT_USAGE_ACTIONS = {"used", "emptied"}
HOUSEHOLD_INVENTORY_STATE_ENTITY_ID = "sensor.household_product_stock"
HOUSEHOLD_INVENTORY_DATA_KEY = f"{DOMAIN}_household_inventory"
HOUSEHOLD_INVENTORY_STORE_KEY = f"{STORAGE_KEY}.household_inventory"
HOUSEHOLD_CONSUMPTION_LOG_LIMIT = 50
HOUSEHOLD_PRODUCTS = ("tampon", "pad", "cup", "liner", "underwear")

# Products that should NOT trigger a shopping list entry (cup is emptied/reused;
# underwear is washed, not purchased).
_SKIP_SHOPPING_PRODUCTS: frozenset[str] = frozenset({"cup", "underwear"})

# Display names used when adding items to the HA shopping list.
_SHOPPING_PRODUCT_NAMES: dict[str, str] = {
    "tampon": "Tampons",
    "pad": "Pads",
    "liner": "Liners",
    "underwear": "Period underwear",
}

_TODO_SHOPPING_LIST_ENTITY = "todo.shopping_list"
_UNDERWEAR_WASH_TODO_ITEM = "Underwear washing needed"
_DEFAULT_UNDERWEAR_TOTAL_OWNED = 12
_DEFAULT_UNDERWEAR_WASHING_THRESHOLD = 3
_SERVICE_FIELD_UNDERWEAR_TOTAL_OWNED = "underwear_total_owned"

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
    menopause_data: dict[str, Any] = field(default_factory=lambda: {"is_menopause": False, "start_date": None})
    unregister_midnight_listener: Callable[[], None] | None = None


CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


def _default_household_inventory_data() -> dict[str, Any]:
    inventory = {product: 0 for product in HOUSEHOLD_PRODUCTS}
    inventory["cup"] = 1
    thresholds = {product: {"warning": 10, "critical": 5} for product in HOUSEHOLD_PRODUCTS}
    thresholds["underwear"] = {
        "warning": _DEFAULT_UNDERWEAR_WASHING_THRESHOLD,
        "critical": max(0, _DEFAULT_UNDERWEAR_WASHING_THRESHOLD - 1),
    }
    thresholds["cup"] = {"warning": 0, "critical": 0}
    return {
        "inventory": inventory,
        "thresholds": thresholds,
        "consumption_log": [],
        "last_usage": None,
        "underwear_settings": {
            "total_owned": _DEFAULT_UNDERWEAR_TOTAL_OWNED,
            "washing_threshold": _DEFAULT_UNDERWEAR_WASHING_THRESHOLD,
        },
    }


def _normalize_household_inventory_data(data: Any) -> dict[str, Any]:
    defaults = _default_household_inventory_data()
    if not isinstance(data, dict):
        return defaults

    inventory_raw = data.get("inventory", {})
    thresholds_raw = data.get("thresholds", {})
    underwear_settings_raw = data.get("underwear_settings", {})
    inventory: dict[str, int] = {}
    thresholds: dict[str, dict[str, int]] = {}
    default_underwear = defaults["underwear_settings"]
    if isinstance(underwear_settings_raw, dict):
        total_owned_raw = underwear_settings_raw.get("total_owned", default_underwear["total_owned"])
        washing_threshold_raw = underwear_settings_raw.get("washing_threshold", default_underwear["washing_threshold"])
    else:
        total_owned_raw = default_underwear["total_owned"]
        washing_threshold_raw = default_underwear["washing_threshold"]

    try:
        total_owned = max(1, int(total_owned_raw))
    except (TypeError, ValueError):
        total_owned = default_underwear["total_owned"]
    try:
        washing_threshold = max(0, int(washing_threshold_raw))
    except (TypeError, ValueError):
        washing_threshold = default_underwear["washing_threshold"]
    washing_threshold = min(washing_threshold, total_owned)

    for product in HOUSEHOLD_PRODUCTS:
        try:
            quantity = int(inventory_raw.get(product, defaults["inventory"][product])) if isinstance(inventory_raw, dict) else defaults["inventory"][product]
        except (TypeError, ValueError):
            quantity = defaults["inventory"][product]
        normalized_quantity = max(0, quantity)
        if product == "cup":
            normalized_quantity = 1
        elif product == "underwear":
            normalized_quantity = min(normalized_quantity, total_owned)
        inventory[product] = normalized_quantity

        product_thresholds = thresholds_raw.get(product, {}) if isinstance(thresholds_raw, dict) else {}
        try:
            warning = int(product_thresholds.get("warning", defaults["thresholds"][product]["warning"])) if isinstance(product_thresholds, dict) else defaults["thresholds"][product]["warning"]
        except (TypeError, ValueError):
            warning = defaults["thresholds"][product]["warning"]
        try:
            critical = int(product_thresholds.get("critical", defaults["thresholds"][product]["critical"])) if isinstance(product_thresholds, dict) else defaults["thresholds"][product]["critical"]
        except (TypeError, ValueError):
            critical = defaults["thresholds"][product]["critical"]
        if warning < critical:
            warning = critical
        thresholds[product] = {"warning": max(0, warning), "critical": max(0, critical)}

    thresholds["cup"] = {"warning": 0, "critical": 0}
    thresholds["underwear"] = {
        "warning": washing_threshold,
        "critical": max(0, min(washing_threshold, washing_threshold - 1)),
    }

    normalized_log: list[dict[str, Any]] = []
    for entry in data.get("consumption_log", []) if isinstance(data.get("consumption_log"), list) else []:
        if not isinstance(entry, dict):
            continue
        product = str(entry.get("product", "")).strip().lower()
        if product not in HOUSEHOLD_PRODUCTS:
            continue
        try:
            quantity = max(1, int(entry.get("quantity", 1)))
        except (TypeError, ValueError):
            quantity = 1
        timestamp = str(entry.get("timestamp", "")).strip()
        if not timestamp:
            continue
        normalized_log.append(
            {
                "product": product,
                "quantity": quantity,
                "member": str(entry.get("member", "")).strip() or "unknown",
                "timestamp": timestamp,
                "source": str(entry.get("source", "")).strip() or "manual",
            }
        )

    last_usage = data.get("last_usage")
    if not isinstance(last_usage, dict):
        last_usage = normalized_log[-1] if normalized_log else None

    return {
        "inventory": inventory,
        "thresholds": thresholds,
        "consumption_log": normalized_log[-HOUSEHOLD_CONSUMPTION_LOG_LIMIT:],
        "last_usage": last_usage,
        "underwear_settings": {
            "total_owned": total_owned,
            "washing_threshold": washing_threshold,
        },
    }


def _household_members(hass: HomeAssistant) -> list[dict[str, str]]:
    members: list[dict[str, str]] = []
    for runtime in hass.data.get(DOMAIN, {}).values():
        if not isinstance(runtime, MenstruationRuntime):
            continue
        members.append({"profile": runtime.profile, "name": runtime.friendly_name})
    members.sort(key=lambda item: item["name"].lower())
    return members


def _underwear_settings(household_data: dict[str, Any]) -> dict[str, int]:
    defaults = _default_household_inventory_data()["underwear_settings"]
    raw = household_data.get("underwear_settings", {})
    if not isinstance(raw, dict):
        raw = {}
    try:
        total_owned = max(1, int(raw.get("total_owned", defaults["total_owned"])))
    except (TypeError, ValueError):
        total_owned = defaults["total_owned"]
    try:
        washing_threshold = max(0, int(raw.get("washing_threshold", defaults["washing_threshold"])))
    except (TypeError, ValueError):
        washing_threshold = defaults["washing_threshold"]
    washing_threshold = min(washing_threshold, total_owned)
    return {"total_owned": total_owned, "washing_threshold": washing_threshold}


def _underwear_available(household_data: dict[str, Any]) -> int:
    settings = _underwear_settings(household_data)
    in_use = max(0, int((household_data.get("inventory") or {}).get("underwear", 0)))
    return max(0, settings["total_owned"] - min(in_use, settings["total_owned"]))


async def _async_update_household_inventory_state(hass: HomeAssistant) -> None:
    household_data = hass.data.get(HOUSEHOLD_INVENTORY_DATA_KEY)
    if not isinstance(household_data, dict):
        return

    inventory = household_data.get("inventory", {})
    thresholds = household_data.get("thresholds", {})
    underwear_settings = _underwear_settings(household_data)
    underwear_in_use = max(0, min(int(inventory.get("underwear", 0)), underwear_settings["total_owned"]))
    inventory["underwear"] = underwear_in_use
    inventory["cup"] = 1
    total_stock = sum(max(0, int(inventory.get(product, 0))) for product in HOUSEHOLD_PRODUCTS)

    hass.states.async_set(
        HOUSEHOLD_INVENTORY_STATE_ENTITY_ID,
        total_stock,
        {
            "friendly_name": "Household Product Stock",
            "inventory": {product: max(0, int(inventory.get(product, 0))) for product in HOUSEHOLD_PRODUCTS},
            "thresholds": {
                product: {
                    "warning": max(0, int((thresholds.get(product) or {}).get("warning", 10))),
                    "critical": max(0, int((thresholds.get(product) or {}).get("critical", 5))),
                }
                for product in HOUSEHOLD_PRODUCTS
            },
            "consumption_log": list(household_data.get("consumption_log", []))[-HOUSEHOLD_CONSUMPTION_LOG_LIMIT:],
            "last_usage": household_data.get("last_usage"),
            "household_members": _household_members(hass),
            "underwear_total_owned": underwear_settings["total_owned"],
            "underwear_washing_threshold": underwear_settings["washing_threshold"],
            "underwear_available": max(0, underwear_settings["total_owned"] - underwear_in_use),
        },
    )


async def _async_save_household_inventory(hass: HomeAssistant) -> None:
    household_data = hass.data.get(HOUSEHOLD_INVENTORY_DATA_KEY)
    if not isinstance(household_data, dict):
        return

    store = Store(hass, STORAGE_VERSION, HOUSEHOLD_INVENTORY_STORE_KEY)
    await store.async_save(household_data)
    await _async_update_household_inventory_state(hass)


async def _async_ensure_household_inventory_loaded(hass: HomeAssistant) -> None:
    if HOUSEHOLD_INVENTORY_DATA_KEY in hass.data:
        await _async_update_household_inventory_state(hass)
        return

    store = Store(hass, STORAGE_VERSION, HOUSEHOLD_INVENTORY_STORE_KEY)
    loaded = await store.async_load()
    hass.data[HOUSEHOLD_INVENTORY_DATA_KEY] = _normalize_household_inventory_data(loaded)
    await _async_update_household_inventory_state(hass)


async def _async_register_consumption(
    hass: HomeAssistant,
    product: str,
    quantity: int,
    member: str,
    *,
    source: str,
) -> None:
    household_data = hass.data.get(HOUSEHOLD_INVENTORY_DATA_KEY)
    if not isinstance(household_data, dict):
        await _async_ensure_household_inventory_loaded(hass)
        household_data = hass.data.get(HOUSEHOLD_INVENTORY_DATA_KEY)
    if not isinstance(household_data, dict):
        return

    inventory = household_data.setdefault("inventory", {})
    current = max(0, int(inventory.get(product, 0)))
    qty = max(1, int(quantity))
    if product == "cup":
        inventory[product] = 1
    elif product == "underwear":
        total_owned = _underwear_settings(household_data)["total_owned"]
        inventory[product] = min(total_owned, current + qty)
    else:
        inventory[product] = max(0, current - qty)

    entry = {
        "product": product,
        "quantity": qty,
        "member": member.strip() or "unknown",
        "timestamp": dt_util.now().isoformat(),
        "source": source,
    }
    household_data["last_usage"] = entry
    log = household_data.setdefault("consumption_log", [])
    if isinstance(log, list):
        log.append(entry)
        household_data["consumption_log"] = log[-HOUSEHOLD_CONSUMPTION_LOG_LIMIT:]

    await _async_save_household_inventory(hass)


def _apply_optional_thresholds(
    household_data: dict,
    product: str,
    warning: int | None,
    critical: int | None,
) -> None:
    """Persist threshold values supplied by the card config, if any."""
    if product == "cup":
        return
    if warning is None and critical is None:
        return
    stored = household_data.setdefault("thresholds", {}).setdefault(
        product, {"warning": 10, "critical": 5}
    )
    if warning is not None:
        stored["warning"] = max(0, int(warning))
    if critical is not None:
        stored["critical"] = max(0, int(critical))
    if product == "underwear":
        settings = _underwear_settings(household_data)
        settings["washing_threshold"] = min(settings["total_owned"], max(0, int(stored.get("warning", settings["washing_threshold"]))))
        household_data["underwear_settings"] = settings


async def _async_check_and_update_todo_list(hass: HomeAssistant, household_data: dict, product: str) -> None:
    """Add a product to the HA shopping list when its stock reaches the warning threshold.

    Cup and underwear are intentionally excluded: cups are reusable (only emptied)
    and underwear needs washing rather than purchasing.
    """
    if product in _SKIP_SHOPPING_PRODUCTS:
        return

    display_name = _SHOPPING_PRODUCT_NAMES.get(product)
    if not display_name:
        return

    inventory = household_data.get("inventory", {})
    quantity = max(0, int(inventory.get(product, 0)))
    thresholds = household_data.get("thresholds", {})
    threshold = thresholds.get(product, {})
    warning = max(0, int(threshold.get("warning", 10) if isinstance(threshold, dict) else 10))

    if quantity > warning:
        return

    added = await _async_add_todo_item_if_missing(hass, display_name)
    if added:
        _LOGGER.info(
            "Added '%s' to shopping list (stock: %d, warning threshold: %d).",
            display_name, quantity, warning,
        )


async def _async_add_todo_item_if_missing(
    hass: HomeAssistant,
    item: str,
    *,
    duplicate_contains: str | None = None,
) -> bool:
    """Add an item to todo.shopping_list unless an equivalent item already exists."""
    normalized_item = item.strip().lower()
    if not normalized_item:
        return False

    # Check for duplicate entry before adding.
    already_listed = False
    try:
        response = await hass.services.async_call(
            "todo",
            "get_items",
            {"entity_id": _TODO_SHOPPING_LIST_ENTITY},
            blocking=True,
            return_response=True,
        )
        if isinstance(response, dict):
            items = response.get(_TODO_SHOPPING_LIST_ENTITY, {}).get("items", [])
            for todo_item in (items if isinstance(items, list) else []):
                summary = str(todo_item.get("summary", "")).strip().lower()
                if summary == normalized_item:
                    already_listed = True
                    break
                if duplicate_contains and duplicate_contains.strip().lower() in summary:
                    already_listed = True
                    break
    except Exception as ex:  # noqa: BLE001
        _LOGGER.debug("Could not read shopping list to check for duplicates: %s", ex)

    if already_listed:
        _LOGGER.debug("'%s' is already on the shopping list; skipping.", item)
        return False

    try:
        await hass.services.async_call(
            "todo",
            "add_item",
            {"entity_id": _TODO_SHOPPING_LIST_ENTITY, "item": item},
            blocking=True,
        )
        return True
    except Exception as ex:  # noqa: BLE001
        _LOGGER.warning("Could not add '%s' to shopping list: %s", item, ex)
        return False


async def _async_check_underwear_washing_todo(hass: HomeAssistant, household_data: dict[str, Any]) -> None:
    settings = _underwear_settings(household_data)
    if _underwear_available(household_data) > settings["washing_threshold"]:
        return
    await _async_add_todo_item_if_missing(hass, _UNDERWEAR_WASH_TODO_ITEM)


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
        runtime.menopause_data,
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




def _register_domain_services(hass: HomeAssistant) -> None:
    """Register all domain services globally (once per domain load)."""

    common_profile_field = {
        vol.Optional(SERVICE_FIELD_ENTITY_ID): cv.entity_id,
        vol.Optional(SERVICE_FIELD_PROFILE): cv.string,
        vol.Optional(SERVICE_FIELD_ENTRY_ID): cv.string,
    }

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

    async def async_manage_household_inventory(call: ServiceCall) -> None:
        await _async_handle_manage_household_inventory(hass, call)

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

    async def async_set_menopause_mode(call: ServiceCall) -> None:
        await _async_handle_set_menopause_mode(hass, call)

    async def async_update_menopause_date(call: ServiceCall) -> None:
        await _async_handle_update_menopause_date(hass, call)

    async def async_save_timer_state(call: ServiceCall) -> None:
        await _async_handle_save_timer_state(hass, call)

    async def async_export_doctor_report(call: ServiceCall) -> None:
        await _async_handle_export_doctor_report(hass, call)

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_CYCLE_START,
        async_add,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_CYCLE_START,
        async_remove,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_CYCLE_HISTORY,
        async_set_history,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATES): [cv.string]}),
    )

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

    hass.services.async_register(
        DOMAIN,
        SERVICE_REFRESH_CYCLE_MODEL,
        async_refresh_cycle_model,
        schema=vol.Schema(common_profile_field),
    )

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

    hass.services.async_register(
        DOMAIN,
        SERVICE_MANAGE_HOUSEHOLD_INVENTORY,
        async_manage_household_inventory,
        schema=vol.Schema(
            {
                **common_profile_field,
                vol.Required(SERVICE_FIELD_INVENTORY_ACTION): vol.In(
                    ["set", "add", "consume", "set_thresholds", "add_to_shopping_list", "reset"]
                ),
                vol.Optional(SERVICE_FIELD_PRODUCT): vol.In(HOUSEHOLD_PRODUCTS),
                vol.Optional(SERVICE_FIELD_QUANTITY, default=1): vol.All(vol.Coerce(int), vol.Range(min=0, max=5000)),
                vol.Optional(SERVICE_FIELD_WARNING_THRESHOLD): vol.All(vol.Coerce(int), vol.Range(min=0, max=5000)),
                vol.Optional(SERVICE_FIELD_CRITICAL_THRESHOLD): vol.All(vol.Coerce(int), vol.Range(min=0, max=5000)),
                vol.Optional(SERVICE_FIELD_MEMBER): cv.string,
                vol.Optional(_SERVICE_FIELD_UNDERWEAR_TOTAL_OWNED): vol.All(vol.Coerce(int), vol.Range(min=1, max=5000)),
            }
        ),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_SYMPTOM,
        async_add_symptom,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string, vol.Required(SERVICE_FIELD_SYMPTOM_DATA): dict}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_SYMPTOM,
        async_remove_symptom,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
    )

    _register_kwargs: dict[str, Any] = {
        "schema": vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
    }
    if SupportsResponse is not None:
        _register_kwargs["supports_response"] = SupportsResponse.OPTIONAL
    hass.services.async_register(DOMAIN, SERVICE_GET_SYMPTOM, async_get_symptom, **_register_kwargs)

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_PREGNANCY_MODE,
        async_set_pregnancy_mode,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_IS_PREGNANT): cv.boolean, vol.Optional(SERVICE_FIELD_PREGNANCY_START_DATE): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_PREGNANCY_DATE,
        async_update_pregnancy_date,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_PREGNANCY_START_DATE): cv.string}),
    )

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

    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_MENARCHE_DATE,
        async_update_menarche_date,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_DATE): cv.string}),
    )

    _menarche_info_kwargs: dict[str, Any] = {
        "schema": vol.Schema(common_profile_field),
    }
    if SupportsResponse is not None:
        _menarche_info_kwargs["supports_response"] = SupportsResponse.OPTIONAL
    hass.services.async_register(DOMAIN, SERVICE_GET_MENARCHE_INFO, async_get_menarche_info, **_menarche_info_kwargs)

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

    hass.services.async_register(
        DOMAIN,
        SERVICE_REMOVE_PRE_MENARCHE_SIGN,
        async_remove_pre_menarche_sign,
        schema=vol.Schema({
            **common_profile_field,
            vol.Required(SERVICE_FIELD_PRE_MENARCHE_SIGN): vol.In(list(PRE_MENARCHE_SIGN_OPTIONS.keys())),
        }),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_MENOPAUSE_MODE,
        async_set_menopause_mode,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_IS_MENOPAUSE): cv.boolean, vol.Optional(SERVICE_FIELD_MENOPAUSE_START_DATE): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_UPDATE_MENOPAUSE_DATE,
        async_update_menopause_date,
        schema=vol.Schema({**common_profile_field, vol.Required(SERVICE_FIELD_MENOPAUSE_START_DATE): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SAVE_TIMER_STATE,
        async_save_timer_state,
        schema=vol.Schema({
            **common_profile_field,
            vol.Required("remaining_seconds"): vol.All(vol.Coerce(int), vol.Range(min=0)),
            vol.Required("total_seconds"): vol.All(vol.Coerce(int), vol.Range(min=0)),
            vol.Optional("selected_product"): cv.string,
            vol.Required("is_running"): cv.boolean,
            vol.Required("saved_at"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        }),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_EXPORT_DOCTOR_REPORT,
        async_export_doctor_report,
        schema=vol.Schema({
            **common_profile_field,
            vol.Optional(SERVICE_FIELD_DAYS_BACK, default=180): vol.All(vol.Coerce(int), vol.Range(min=30, max=730)),
            vol.Optional(SERVICE_FIELD_PATIENT_NAME): cv.string,
            vol.Optional(SERVICE_FIELD_PATIENT_BIRTHDATE): cv.string,
            vol.Optional(SERVICE_FIELD_LANGUAGE, default="de"): vol.In(["de", "en"]),
        }),
    )


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up integration from YAML (not used, config-entry only)."""
    hass.data.setdefault(DOMAIN, {})
    _register_domain_services(hass)
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
    await _async_ensure_household_inventory_loaded(hass)

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
        menopause_data=stored.get("menopause_data", {"is_menopause": False, "start_date": None}),
    )

    async def _async_handle_midnight_refresh(_now: datetime) -> None:
        await _async_refresh_cycle_model(hass, {entry.entry_id})

    runtime.unregister_midnight_listener = async_track_time_change(
        hass,
        _async_handle_midnight_refresh,
        hour=0,
        minute=0,
        second=5,
    )

    hass.data[DOMAIN][entry.entry_id] = runtime
    await _async_update_household_inventory_state(hass)
    await _async_load_timer_state(hass, profile)

    # Re-register services if they were removed when the last entry was unloaded.
    # Normally services are registered once in async_setup(); this handles the
    # edge case where all entries were removed (services cleaned up) and a new
    # entry is being added in the same HA session.
    if not hass.services.has_service(DOMAIN, SERVICE_ADD_CYCLE_START):
        _register_domain_services(hass)

    await _async_register_http_handlers(hass)
    _async_schedule_lovelace_resource_registration(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    runtime: MenstruationRuntime | None = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    if runtime and runtime.unregister_midnight_listener:
        runtime.unregister_midnight_listener()
    await _async_update_household_inventory_state(hass)

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
            SERVICE_MANAGE_HOUSEHOLD_INVENTORY,
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
            SERVICE_SET_MENOPAUSE_MODE,
            SERVICE_UPDATE_MENOPAUSE_DATE,
            SERVICE_SAVE_TIMER_STATE,
        ):
            if hass.services.has_service(DOMAIN, service):
                hass.services.async_remove(DOMAIN, service)

    return unload_ok


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload config entry."""
    await async_unload_entry(hass, entry)
    await async_setup_entry(hass, entry)


async def _async_load_timer_state(hass: HomeAssistant, profile: str) -> None:
    """Load persisted timer state and expose it as a virtual HA state for the frontend."""
    store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}.timer_state.{profile}")
    timer_state = await store.async_load()
    if isinstance(timer_state, dict):
        hass.states.async_set(
            f"menstruation_gauge_timer.{profile}",
            "active" if timer_state.get("is_running") else "idle",
            timer_state,
        )


async def _async_handle_save_timer_state(hass: HomeAssistant, call: ServiceCall) -> None:
    """Persist countdown timer state so it survives page reloads and device switches."""
    runtime = _runtime_for_call(hass, call)
    profile = runtime.profile

    remaining_seconds = max(0, int(call.data.get("remaining_seconds", 0)))
    total_seconds = max(0, int(call.data.get("total_seconds", 0)))
    raw_product = call.data.get("selected_product")
    selected_product = str(raw_product).strip() if raw_product else None
    is_running = bool(call.data.get("is_running", False))
    saved_at = max(0, int(call.data.get("saved_at", 0)))

    timer_state: dict[str, Any] = {
        "remaining_seconds": remaining_seconds,
        "total_seconds": total_seconds,
        "selected_product": selected_product,
        "is_running": is_running,
        "saved_at": saved_at,
    }

    store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}.timer_state.{profile}")
    await store.async_save(timer_state)

    hass.states.async_set(
        f"menstruation_gauge_timer.{profile}",
        "active" if is_running else "idle",
        timer_state,
    )


async def _async_handle_export_doctor_report(hass: HomeAssistant, call: ServiceCall) -> None:
    """Generate an HTML doctor report from the cycle history and symptom data."""
    runtime = _runtime_for_call(hass, call)
    days_back = max(30, min(730, int(call.data.get(SERVICE_FIELD_DAYS_BACK, 180))))
    patient_name = call.data.get(SERVICE_FIELD_PATIENT_NAME)
    patient_birthdate = call.data.get(SERVICE_FIELD_PATIENT_BIRTHDATE)
    language = str(call.data.get(SERVICE_FIELD_LANGUAGE, "de")).strip().lower() or "de"

    if patient_name is not None:
        patient_name = str(patient_name).strip() or None
    if patient_birthdate is not None:
        patient_birthdate = _normalize_date_or_raise(str(patient_birthdate).strip())

    stats = compute_statistics(runtime.history, runtime.symptom_history, days_back=days_back)
    html_content = generate_doctor_report_html(
        stats=stats,
        history=runtime.history,
        symptom_history=runtime.symptom_history,
        profile=runtime.profile,
        patient_name=patient_name,
        patient_birthdate=patient_birthdate,
        language=language,
    )

    stem = _sanitize_export_filename(f"doctor_report_{runtime.profile}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    target_dir = Path(hass.config.path(EXPORT_DIR_NAME))
    target_path = target_dir / f"{stem}.html"

    def _write_file() -> None:
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path.write_text(html_content, encoding="utf-8")

    await hass.async_add_executor_job(_write_file)
    _LOGGER.info(
        "Exported doctor report for profile '%s' to %s",
        runtime.profile,
        target_path,
    )


def _smart_period_history_dates(
    runtime: MenstruationRuntime,
    date_iso: str,
    *,
    allow_new_period: bool = True,
) -> list[str]:
    """Resolve which history dates should be recorded for a smart period continuation."""
    target_date = date.fromisoformat(date_iso)
    model = build_cycle_model(
        history=runtime.history,
        period_duration_days=runtime.period_duration_days,
        symptom_history=runtime.symptom_history,
        pregnancy_data=runtime.pregnancy_data,
        menarche_data=runtime.menarche_data,
        pre_menarche_data=runtime.pre_menarche_data,
        menopause_data=runtime.menopause_data,
        today=target_date,
    )
    current_period = model.current_period
    if not isinstance(current_period, dict) or not current_period.get("is_active"):
        return [date_iso] if allow_new_period else []

    start_iso = current_period.get("start")
    if not isinstance(start_iso, str) or date_iso < start_iso:
        return [date_iso] if allow_new_period else []

    confirmed_days = [
        item
        for item in current_period.get("confirmed_days", [])
        if isinstance(item, str) and item <= date_iso
    ]
    last_confirmed_iso = confirmed_days[-1] if confirmed_days else None

    if last_confirmed_iso is None:
        return [date_iso] if allow_new_period else []
    if last_confirmed_iso >= date_iso:
        return [] if date_iso in runtime.history else [date_iso]

    fill_start = date.fromisoformat(last_confirmed_iso)
    fill_days: list[str] = []
    day_cursor = fill_start
    while day_cursor.isoformat() < date_iso:
        day_cursor = day_cursor.fromordinal(day_cursor.toordinal() + 1)
        fill_days.append(day_cursor.isoformat())
    return fill_days


async def _async_handle_add(hass: HomeAssistant, call: ServiceCall) -> None:
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])
    for history_date in _smart_period_history_dates(runtime, date_iso):
        if history_date not in runtime.history:
            runtime.history.append(history_date)
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
    if action == "used":
        await _async_register_consumption(hass, product, max(1, quantity), runtime.friendly_name, source="log_product_usage")
    await _async_save_and_notify(hass, runtime)


async def _async_handle_manage_household_inventory(hass: HomeAssistant, call: ServiceCall) -> None:
    await _async_ensure_household_inventory_loaded(hass)
    household_data = hass.data.get(HOUSEHOLD_INVENTORY_DATA_KEY)
    if not isinstance(household_data, dict):
        raise HomeAssistantError("Household inventory storage is unavailable.")

    action = str(call.data.get(SERVICE_FIELD_INVENTORY_ACTION, "")).strip().lower()
    product = str(call.data.get(SERVICE_FIELD_PRODUCT, "")).strip().lower()
    quantity = int(call.data.get(SERVICE_FIELD_QUANTITY, 1))
    member = str(call.data.get(SERVICE_FIELD_MEMBER, "")).strip() or "manual"

    if action != "reset" and product not in HOUSEHOLD_PRODUCTS:
        raise HomeAssistantError(f"Unsupported product '{product}'.")

    # Optional threshold values sent from the card config so the backend stays in
    # sync with whatever the user configured in the Lovelace card editor.
    threshold_warning = call.data.get(SERVICE_FIELD_WARNING_THRESHOLD)
    threshold_critical = call.data.get(SERVICE_FIELD_CRITICAL_THRESHOLD)
    underwear_total_owned = call.data.get(_SERVICE_FIELD_UNDERWEAR_TOTAL_OWNED)
    if underwear_total_owned is not None:
        settings = _underwear_settings(household_data)
        settings["total_owned"] = max(1, int(underwear_total_owned))
        settings["washing_threshold"] = min(settings["washing_threshold"], settings["total_owned"])
        household_data["underwear_settings"] = settings
        household_data["inventory"]["underwear"] = min(
            max(0, int(household_data["inventory"].get("underwear", 0))),
            settings["total_owned"],
        )

    if action == "set":
        if product == "cup":
            household_data["inventory"][product] = 1
        elif product == "underwear":
            settings = _underwear_settings(household_data)
            household_data["inventory"][product] = min(settings["total_owned"], max(0, quantity))
        else:
            household_data["inventory"][product] = max(0, quantity)
        _apply_optional_thresholds(household_data, product, threshold_warning, threshold_critical)
    elif action == "add":
        current = max(0, int(household_data["inventory"].get(product, 0)))
        if product == "cup":
            household_data["inventory"][product] = 1
        elif product == "underwear":
            household_data["inventory"][product] = max(0, current - max(0, quantity))
        else:
            household_data["inventory"][product] = current + max(0, quantity)
        _apply_optional_thresholds(household_data, product, threshold_warning, threshold_critical)
    elif action == "consume":
        _apply_optional_thresholds(household_data, product, threshold_warning, threshold_critical)
        await _async_register_consumption(hass, product, max(1, quantity), member, source="inventory_service")
        # household_data is updated in-place by _async_register_consumption; reload ref.
        household_data = hass.data.get(HOUSEHOLD_INVENTORY_DATA_KEY, {})
        await _async_check_and_update_todo_list(hass, household_data, product)
        if product == "underwear":
            await _async_check_underwear_washing_todo(hass, household_data)
        return
    elif action == "set_thresholds":
        if product == "cup":
            raise HomeAssistantError("Cup thresholds are not supported.")
        warning = call.data.get(SERVICE_FIELD_WARNING_THRESHOLD)
        critical = call.data.get(SERVICE_FIELD_CRITICAL_THRESHOLD)
        if warning is None and critical is None:
            raise HomeAssistantError("Provide warning_threshold and/or critical_threshold.")
        current_thresholds = household_data["thresholds"].setdefault(product, {"warning": 10, "critical": 5})
        next_warning = current_thresholds.get("warning", 10) if warning is None else max(0, int(warning))
        next_critical = current_thresholds.get("critical", 5) if critical is None else max(0, int(critical))
        if next_warning < next_critical:
            raise HomeAssistantError("warning_threshold must be greater than or equal to critical_threshold.")
        household_data["thresholds"][product] = {"warning": next_warning, "critical": next_critical}
        if product == "underwear":
            settings = _underwear_settings(household_data)
            settings["washing_threshold"] = min(settings["total_owned"], max(0, int(next_warning)))
            household_data["underwear_settings"] = settings
    elif action == "add_to_shopping_list":
        if product not in HOUSEHOLD_PRODUCTS:
            raise HomeAssistantError("Provide a valid product for add_to_shopping_list.")
        if product == "cup":
            raise HomeAssistantError("Cup is reusable and cannot be added to the shopping list.")
        qty = max(1, int(quantity or 1))
        display_name = _SHOPPING_PRODUCT_NAMES.get(product) or product.replace("_", " ").title()
        item_name = f"{display_name} x{qty}" if qty > 1 else display_name
        duplicate_contains = display_name if product == "underwear" else None
        await _async_add_todo_item_if_missing(hass, item_name, duplicate_contains=duplicate_contains)
        return
    elif action == "reset":
        hass.data[HOUSEHOLD_INVENTORY_DATA_KEY] = _default_household_inventory_data()
    else:
        raise HomeAssistantError(
            "Unsupported inventory_action. Use one of: set, add, consume, set_thresholds, add_to_shopping_list, reset."
        )

    await _async_save_household_inventory(hass)

    # After reducing or explicitly setting stock, check whether the shopping list
    # needs an entry (consume already handled above).
    if action == "set":
        await _async_check_and_update_todo_list(hass, household_data, product)
    if action in {"set", "add", "set_thresholds"} and product == "underwear":
        await _async_check_underwear_washing_todo(hass, household_data)


async def _async_handle_add_symptom(hass: HomeAssistant, call: ServiceCall) -> None:
    """Add or update symptom data for a date."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_DATE])
    symptom_data = call.data.get(SERVICE_FIELD_SYMPTOM_DATA, {})

    if not isinstance(symptom_data, dict):
        raise HomeAssistantError("Symptom data must be a dictionary.")

    existing = None
    for entry in runtime.symptom_history:
        if entry.get("date") == date_iso:
            existing = entry
            break

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

    next_symptom_data = dict(symptom_data)
    if SYMPTOM_CLOTS in next_symptom_data and next_symptom_data.get(SYMPTOM_CLOTS) != "yes":
        next_symptom_data.pop(SYMPTOM_CLOT_SIZE, None)

    if SYMPTOM_CLOT_SIZE in next_symptom_data:
        clots_value = next_symptom_data.get(SYMPTOM_CLOTS)
        if clots_value is None and existing is not None:
            clots_value = existing.get(SYMPTOM_CLOTS)
        if clots_value != "yes":
            raise HomeAssistantError(f"Symptom field '{SYMPTOM_CLOT_SIZE}' can only be set when '{SYMPTOM_CLOTS}' is 'yes'.")

    if existing:
        merged = dict(existing)
        merged.update(next_symptom_data)
        if merged.get(SYMPTOM_CLOTS) != "yes":
            merged.pop(SYMPTOM_CLOT_SIZE, None)
        merged["date"] = date_iso
        existing.clear()
        existing.update(merged)
    else:
        new_entry = dict(next_symptom_data)
        if new_entry.get(SYMPTOM_CLOTS) != "yes":
            new_entry.pop(SYMPTOM_CLOT_SIZE, None)
        new_entry["date"] = date_iso
        runtime.symptom_history.append(new_entry)

    runtime.symptom_history.sort(key=lambda x: x.get("date", ""))

    bleeding_strength = str(next_symptom_data.get("bleeding_strength", "")).strip().lower()
    if bleeding_strength in {"none", "keine"}:
        runtime.history = [item for item in runtime.history if item != date_iso]
    elif "bleeding_strength" in next_symptom_data:
        for history_date in _smart_period_history_dates(runtime, date_iso, allow_new_period=False):
            if history_date not in runtime.history:
                runtime.history.append(history_date)

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


async def _async_handle_set_menopause_mode(hass: HomeAssistant, call: ServiceCall) -> None:
    """Set menopause mode on or off."""
    runtime = _runtime_for_call(hass, call)
    is_menopause = bool(call.data.get(SERVICE_FIELD_IS_MENOPAUSE, False))
    menopause_start_date = call.data.get(SERVICE_FIELD_MENOPAUSE_START_DATE)
    if menopause_start_date:
        menopause_start_date = _normalize_date_or_raise(menopause_start_date)
    else:
        menopause_start_date = runtime.menopause_data.get("start_date")
    runtime.menopause_data = {"is_menopause": is_menopause, "start_date": menopause_start_date}
    await _async_save_and_notify(hass, runtime)


async def _async_handle_update_menopause_date(hass: HomeAssistant, call: ServiceCall) -> None:
    """Update menopause start date."""
    runtime = _runtime_for_call(hass, call)
    date_iso = _normalize_date_or_raise(call.data[SERVICE_FIELD_MENOPAUSE_START_DATE])
    runtime.menopause_data["start_date"] = date_iso
    await _async_save_and_notify(hass, runtime)


async def _maybe_await(result: Any) -> Any:
    """Await coroutine-like values, return plain values unchanged."""
    if inspect.isawaitable(result):
        return await result
    return result


async def _async_register_http_handlers(hass: HomeAssistant) -> None:
    """Register HTTP routes to serve card JS files from www/ directory."""
    if hass.data.get(_HTTP_ROUTES_REGISTERED_KEY):
        return

    async def _serve_card_file(request):  # type: ignore[no-untyped-def]
        from aiohttp.web import HTTPBadRequest, HTTPNotFound, Response

        filename = request.match_info["filename"]
        if "/" in filename or "\\" in filename or filename.startswith("."):
            raise HTTPBadRequest()

        file_path = WWW_DIR / filename
        if not file_path.is_file():
            _LOGGER.debug("Card file not found: %s", file_path)
            raise HTTPNotFound()

        content = await hass.async_add_executor_job(file_path.read_bytes)
        return Response(
            body=content,
            content_type="application/javascript",
            headers={"Cache-Control": "public, max-age=3600, s-maxage=3600"},
        )

    async def _serve_asset_file(request):  # type: ignore[no-untyped-def]
        from aiohttp.web import HTTPBadRequest, HTTPNotFound, Response

        subfolder = request.match_info["subfolder"]
        filename = request.match_info["filename"]
        if subfolder not in _ALLOWED_ASSET_SUBFOLDERS:
            raise HTTPBadRequest()
        if "/" in filename or "\\" in filename or filename.startswith(".") or not filename.endswith(".svg"):
            raise HTTPBadRequest()

        file_path = ASSETS_DIR / subfolder / filename
        if not file_path.is_file():
            _LOGGER.debug("Asset file not found: %s", file_path)
            raise HTTPNotFound()

        content = await hass.async_add_executor_job(file_path.read_bytes)
        return Response(
            body=content,
            content_type="image/svg+xml",
            headers={"Cache-Control": "public, max-age=86400, s-maxage=86400"},
        )

    try:
        hass.http.app.router.add_get(f"/{DOMAIN}/assets/{{subfolder}}/{{filename}}", _serve_asset_file)
        hass.http.app.router.add_get(f"/{DOMAIN}/{{filename}}", _serve_card_file)
        hass.data[_HTTP_ROUTES_REGISTERED_KEY] = True
        for _resource_url, _static_url, filename in LOVELACE_RESOURCES:
            _LOGGER.info("Registered HTTP route: /%s/%s", DOMAIN, filename)
        _LOGGER.info("Registered HTTP route: /%s/assets/{subfolder}/{filename}", DOMAIN)
    except Exception as err:
        _LOGGER.warning("Failed to register HTTP routes for card files: %s", err)


def _async_schedule_lovelace_resource_registration(hass: HomeAssistant) -> None:
    """Register Lovelace resources once the Lovelace component is ready."""
    if hass.data.get(_LOVELACE_RESOURCES_SCHEDULED_KEY):
        return

    hass.data[_LOVELACE_RESOURCES_SCHEDULED_KEY] = True

    async def _async_when_lovelace_ready(_hass: HomeAssistant, _component: str) -> None:
        await _async_ensure_lovelace_resource(_hass)

    try:
        from homeassistant.setup import async_when_setup_or_start
    except ImportError:
        hass.async_create_task(_async_ensure_lovelace_resource(hass))
        return

    async_when_setup_or_start(hass, "lovelace", _async_when_lovelace_ready)


def _normalize_resource_url(url: str | None) -> str | None:
    """Normalize a resource URL for duplicate detection."""
    if not url:
        return None
    return url.split("?", 1)[0]


def _extract_resource_version(url: str | None) -> str | None:
    """Extract the resource version value from a URL query string."""
    if not url:
        return None

    try:
        version_values = parse_qs(urlsplit(url).query).get("v")
    except Exception:
        return None

    if not version_values:
        return None
    return version_values[-1]


def _build_lovelace_resource_payloads(resource_url: str) -> list[dict[str, str]]:
    """Build payloads for supported Lovelace resource schemas."""
    payloads: list[dict[str, str]] = []
    seen_type_keys: set[str] = set()

    try:
        from homeassistant.components.lovelace.const import CONF_RESOURCE_TYPE_WS

        seen_type_keys.add(CONF_RESOURCE_TYPE_WS)
        payloads.append({"url": resource_url, CONF_RESOURCE_TYPE_WS: CARD_RESOURCE_TYPE})
    except Exception:
        pass

    for type_key in ("res_type", CONF_TYPE):
        if type_key in seen_type_keys:
            continue
        seen_type_keys.add(type_key)
        payloads.append({"url": resource_url, type_key: CARD_RESOURCE_TYPE})

    return payloads


async def _async_get_lovelace_resource_collection(hass: HomeAssistant) -> tuple[Any | None, str | None]:
    """Return a Lovelace resource collection and its mode if available."""
    try:
        from homeassistant.components.lovelace.resources import async_get_resource_collection
    except Exception:
        async_get_resource_collection = None

    if async_get_resource_collection is not None:
        try:
            collection = await _maybe_await(async_get_resource_collection(hass))
        except Exception as err:
            _LOGGER.debug("Legacy Lovelace resource helper failed: %s", err)
        else:
            if collection is not None:
                return collection, None

    try:
        from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_STORAGE
    except Exception as err:
        _LOGGER.debug("Unable to import Lovelace constants: %s", err)
        LOVELACE_DATA = None  # type: ignore[assignment]
        MODE_STORAGE = "storage"  # type: ignore[assignment]

    lovelace_data = hass.data.get(LOVELACE_DATA) if LOVELACE_DATA is not None else None
    resource_mode = getattr(lovelace_data, "resource_mode", None)
    collection = getattr(lovelace_data, "resources", None)
    if collection is not None:
        return collection, resource_mode

    if resource_mode not in (None, MODE_STORAGE):
        return None, resource_mode

    if "lovelace" not in hass.config.components:
        return None, resource_mode

    try:
        from homeassistant.components.lovelace.dashboard import LovelaceStorage
        from homeassistant.components.lovelace.resources import ResourceStorageCollection

        return ResourceStorageCollection(hass, LovelaceStorage(hass, None)), MODE_STORAGE
    except Exception as err:
        _LOGGER.warning("Failed to create Lovelace resource storage collection: %s", err)
        return None, resource_mode


async def _async_ensure_lovelace_resource(hass: HomeAssistant) -> None:
    """Auto-register Lovelace JS resources for storage dashboards."""
    if hass.data.get(_LOVELACE_RESOURCES_ENSURED_KEY):
        return

    collection, resource_mode = await _async_get_lovelace_resource_collection(hass)
    if collection is None:
        if "lovelace" not in hass.config.components:
            _LOGGER.warning("Lovelace component is unavailable; cannot auto-register card resources")
        elif resource_mode and resource_mode != "storage":
            _LOGGER.warning(
                "Lovelace resources use %s mode; automatic resource registration requires storage mode",
                resource_mode,
            )
        else:
            _LOGGER.warning("Lovelace resource collection is unavailable; card resources were not registered")
        return

    if not hasattr(collection, "async_create_item"):
        _LOGGER.warning(
            "Lovelace resource collection does not support automatic creation%s",
            f" in {resource_mode} mode" if resource_mode else "",
        )
        return

    try:
        items = await _maybe_await(collection.async_items())
        existing_urls = {
            _normalize_resource_url(item.get("url"))
            for item in items or []
            if isinstance(item, dict) and item.get("url")
        }
        existing_exact_urls = {
            str(item.get("url"))
            for item in items or []
            if isinstance(item, dict) and item.get("url")
        }

        added_count = 0
        failed_urls: list[str] = []
        for resource_url, _static_url, filename in LOVELACE_RESOURCES:
            normalized_resource_url = _normalize_resource_url(resource_url)
            if resource_url in existing_exact_urls:
                _LOGGER.debug("Lovelace resource already registered: %s", resource_url)
                continue

            create_errors: list[str] = []
            for payload in _build_lovelace_resource_payloads(resource_url):
                try:
                    await _maybe_await(collection.async_create_item(payload))
                    added_count += 1
                    existing_urls.add(normalized_resource_url)
                    existing_exact_urls.add(resource_url)
                    _LOGGER.info("Registered Lovelace resource automatically: %s", resource_url)
                    break
                except Exception as err:
                    create_errors.append(f"{payload!r} -> {err}")
            else:
                failed_urls.append(resource_url)
                _LOGGER.error(
                    "Failed to auto-register Lovelace resource %s (%s). Attempts: %s",
                    resource_url,
                    filename,
                    " | ".join(create_errors),
                )

        if failed_urls:
            _LOGGER.warning(
                "Lovelace resource registration incomplete; %s resources still missing",
                len(failed_urls),
            )
            return

        await _async_cleanup_old_lovelace_resources(hass, RESOURCE_VERSION)
        hass.data[_LOVELACE_RESOURCES_ENSURED_KEY] = True
        _LOGGER.info("Lovelace resource registration complete; %s new resources added", added_count)
    except Exception as err:
        _LOGGER.exception("Auto-registration of Lovelace resources failed: %s", err)


async def _async_cleanup_old_lovelace_resources(hass: HomeAssistant, current_version: str) -> None:
    """Remove outdated Lovelace resource entries from previous integration versions."""
    collection, _resource_mode = await _async_get_lovelace_resource_collection(hass)
    if collection is None or not hasattr(collection, "async_items") or not hasattr(collection, "async_delete_item"):
        return

    try:
        items = await _maybe_await(collection.async_items())
    except Exception as err:
        _LOGGER.debug("Lovelace resource cleanup skipped: %s", err)
        return

    if not items:
        return

    current_base_urls = {_normalize_resource_url(resource_url) for resource_url, _static_url, _filename in LOVELACE_RESOURCES}
    removed_count = 0

    for item in items:
        if not isinstance(item, dict) or not item.get("url"):
            continue

        item_url = str(item["url"])
        if _normalize_resource_url(item_url) not in current_base_urls:
            continue

        item_version = _extract_resource_version(item_url)
        if item_version is None or item_version == current_version:
            continue

        item_id = item.get("id")
        try:
            if item_id is None:
                await _maybe_await(collection.async_delete_item(item))
            else:
                await _maybe_await(collection.async_delete_item(item_id))
            removed_count += 1
            _LOGGER.info("Removed outdated Lovelace resource: %s", item_url)
        except Exception as err:
            _LOGGER.debug("Could not remove outdated Lovelace resource %s: %s", item_url, err)

    if removed_count:
        _LOGGER.info("Lovelace resource cleanup complete; removed %s outdated resource entries", removed_count)
