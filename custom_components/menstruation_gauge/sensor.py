"""Sensor platform for menstruation gauge."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.typing import StateType
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_AGE_AT_TRACKING,
    ATTR_AVG_CYCLE_LENGTH,
    ATTR_AWAITING_MENARCHE,
    ATTR_BLEEDING_BLOCKS,
    ATTR_DAYS_UNTIL_MENARCHE,
    ATTR_DAYS_UNTIL_NEXT_START,
    ATTR_DUE_DATE,
    ATTR_ESTIMATED_MENARCHE_DATE,
    ATTR_FAMILY_MENARCHE_AGE,
    ATTR_FERTILE_WINDOW_END,
    ATTR_FERTILE_WINDOW_START,
    ATTR_OVULATION_DAY,
    ATTR_GROUPED_STARTS,
    ATTR_HISTORY,
    ATTR_IS_PREGNANT,
    ATTR_NEXT_PREDICTED_START,
    ATTR_PERIOD_DURATION_DAYS,
    ATTR_PRE_MENARCHE_DATA,
    ATTR_PREGNANCY_DATA,
    ATTR_PREGNANCY_START_DATE,
    ATTR_SYMPTOM_HISTORY,
    ATTR_WEEKS_PREGNANT,
    DOMAIN,
    SIGNAL_HISTORY_UPDATED,
)
from .model import bleeding_blocks, build_cycle_model, normalize_history


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensor from config entry."""
    async_add_entities(
        [
            MenstruationGaugeSensor(hass, entry),
            ProductUsageStatsConsolidatedSensor(hass, entry),
        ],
        True,
    )


PRODUCT_USAGE_PRODUCTS = ("tampon", "pad", "cup", "liner", "underwear")
PRODUCT_USAGE_CYCLES_CONSIDERED = 3
PRODUCT_USAGE_TIMELINE_DAYS = 30


def _group_product_usage_by_date(product_usage: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in product_usage:
        date_str = entry.get("date")
        if isinstance(date_str, str):
            grouped[date_str].append(entry)
    return grouped


def _empty_product_counts() -> dict[str, int]:
    return {product: 0 for product in PRODUCT_USAGE_PRODUCTS}


def _entry_quantity(entry: dict[str, Any]) -> int:
    try:
        return max(1, int(entry.get("quantity", 1) or 1))
    except (TypeError, ValueError):
        return 1


def _count_products(entries: list[dict[str, Any]]) -> dict[str, int]:
    counts = _empty_product_counts()
    for entry in entries:
        product = entry.get("product")
        if product not in counts:
            continue
        counts[product] += _entry_quantity(entry)
    return counts


def _count_products_for_block(
    grouped_usage: dict[str, list[dict[str, Any]]],
    block: list[str] | tuple[str, ...],
) -> dict[str, int]:
    counts = _empty_product_counts()
    for day in block:
        for entry in grouped_usage.get(day, []):
            product = entry.get("product")
            if product not in counts:
                continue
            counts[product] += _entry_quantity(entry)
    return counts


def _build_product_usage_stats(
    history: list[str],
    product_usage: list[dict[str, Any]],
    today: date,
) -> dict[str, Any]:
    normalized_history = normalize_history(history)
    usable_history = [item for item in normalized_history if item <= today.isoformat()] or normalized_history
    blocks = bleeding_blocks(usable_history)
    grouped_usage = _group_product_usage_by_date(product_usage)

    today_counts = _count_products(grouped_usage.get(today.isoformat(), []))

    recent_blocks = [block for block in blocks[-PRODUCT_USAGE_CYCLES_CONSIDERED:] if block]
    cycle_totals = [_count_products_for_block(grouped_usage, block) for block in recent_blocks]
    cycles_considered = len(cycle_totals)

    average_per_cycle = {
        product: round(mean([cycle[product] for cycle in cycle_totals]), 1) if cycles_considered else 0.0
        for product in PRODUCT_USAGE_PRODUCTS
    }

    this_cycle = _count_products_for_block(grouped_usage, blocks[-1]) if blocks else _empty_product_counts()

    timeline_entries: list[dict[str, Any]] = []
    for entry in reversed(product_usage):
        date_str = entry.get("date")
        if not isinstance(date_str, str):
            continue
        try:
            entry_date = date.fromisoformat(date_str)
        except ValueError:
            continue
        if entry_date > today:
            continue
        if (today - entry_date) >= timedelta(days=PRODUCT_USAGE_TIMELINE_DAYS):
            continue
        timeline_entries.append(entry)

    return {
        "today": today_counts,
        "this_cycle": this_cycle,
        "stats": {
            "average_per_cycle": average_per_cycle,
            "cycles_considered": cycles_considered,
        },
        "timeline": timeline_entries,
    }


class MenstruationGaugeSensor(SensorEntity):
    """Expose cycle state and computed attributes including symptoms and pregnancy."""

    _attr_has_entity_name = True

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_menstruation"
        runtime = self.hass.data[DOMAIN][self._entry.entry_id]
        self._attr_name = runtime.friendly_name
        self._state: str = "neutral"
        self._attrs: dict[str, StateType] = {}
        self._icon: str | None = runtime.icon or None

    async def async_added_to_hass(self) -> None:
        """Register update signals and daily refresh."""
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_HISTORY_UPDATED, self._handle_runtime_update)
        )
        self.async_on_remove(
            async_track_time_change(
                self.hass,
                self._handle_daily_refresh,
                hour=0,
                minute=0,
                second=5,
            )
        )
        # Force one recalculation on add/startup so day-based attributes are never stale.
        self.async_schedule_update_ha_state(True)

    async def async_update(self) -> None:
        """Update sensor from shared runtime."""
        runtime = self.hass.data[DOMAIN][self._entry.entry_id]
        self._attr_name = runtime.friendly_name
        self._icon = runtime.icon or None
        model = build_cycle_model(
            history=runtime.history,
            period_duration_days=runtime.period_duration_days,
            symptom_history=runtime.symptom_history,
            pregnancy_data=runtime.pregnancy_data,
            menarche_data=runtime.menarche_data,
            pre_menarche_data=runtime.pre_menarche_data,
            today=dt_util.now().date(),
        )
        usage_stats = _build_product_usage_stats(runtime.history, runtime.product_usage, dt_util.now().date())

        self._state = model.state
        has_history = bool(model.history)

        self._attrs = {
            ATTR_HISTORY: model.history,
            ATTR_SYMPTOM_HISTORY: model.symptom_history,
            ATTR_GROUPED_STARTS: model.grouped_starts,
            ATTR_BLEEDING_BLOCKS: model.bleeding_blocks,
            ATTR_NEXT_PREDICTED_START: model.next_predicted_start,
            ATTR_AVG_CYCLE_LENGTH: model.avg_cycle_length,
            ATTR_FERTILE_WINDOW_START: model.fertile_window_start,
            ATTR_FERTILE_WINDOW_END: model.fertile_window_end,
            ATTR_OVULATION_DAY: model.ovulation_day,
            ATTR_DAYS_UNTIL_NEXT_START: model.days_until_next_start,
            ATTR_PERIOD_DURATION_DAYS: model.period_duration_days if has_history else None,
            "period_duration_default_days": runtime.period_duration_days if has_history else None,
            "period_duration_learned_avg_days": model.learned_period_duration_days if has_history else None,
            ATTR_IS_PREGNANT: model.is_pregnant,
            ATTR_PREGNANCY_START_DATE: model.pregnancy_start_date,
            ATTR_WEEKS_PREGNANT: model.weeks_pregnant,
            ATTR_DUE_DATE: model.due_date,
            ATTR_PREGNANCY_DATA: {
                "is_pregnant": model.is_pregnant,
                "start_date": model.pregnancy_start_date,
                "weeks_pregnant": model.weeks_pregnant,
                "due_date": model.due_date,
            },
            ATTR_ESTIMATED_MENARCHE_DATE: model.menarche_data.get("estimated_date"),
            ATTR_DAYS_UNTIL_MENARCHE: self._calculate_days_until_menarche(model.menarche_data),
            "menarche_data": model.menarche_data,
            ATTR_PRE_MENARCHE_DATA: model.pre_menarche_data,
            "profile": runtime.profile,
            "entry_id": self._entry.entry_id,
            "friendly_name": runtime.friendly_name,
            "product_usage_today": usage_stats["today"],
            "product_usage_this_cycle": usage_stats["this_cycle"],
            "product_usage_stats": usage_stats["stats"],
            "product_usage_timeline": usage_stats["timeline"],
        }

    def _calculate_days_until_menarche(self, menarche_data: dict[str, Any]) -> int | None:
        """Calculate days until estimated menarche."""
        estimated_date = menarche_data.get("estimated_date")
        if not estimated_date:
            return None
        try:
            est_date = date.fromisoformat(str(estimated_date))
            today = dt_util.now().date()
            return (est_date - today).days
        except (TypeError, ValueError):
            return None

    @property
    def state(self) -> StateType:
        """Return current cycle state."""
        return self._state

    @property
    def extra_state_attributes(self) -> dict[str, StateType]:
        """Return extra attributes for card rendering."""
        return self._attrs

    @property
    def icon(self) -> str | None:
        """Return icon."""
        return self._icon

    @property
    def suggested_display_precision(self) -> int | None:
        """No numeric precision needed."""
        return None

    @property
    def unit_of_measurement(self) -> str | None:
        """No unit for string states."""
        return None

    @property
    def should_poll(self) -> bool:
        """Updates come via dispatcher; no polling needed."""
        return False

    @property
    def available(self) -> bool:
        """Sensor is available when runtime exists."""
        return self._entry.entry_id in self.hass.data.get(DOMAIN, {})

    @property
    def force_update(self) -> bool:
        """State changes only when model changes."""
        return False

    @property
    def native_value(self) -> StateType:
        """Return sensor state."""
        return self._state

    @property
    def name(self) -> str | None:
        """Return entity name."""
        return self._attr_name

    @property
    def translation_key(self) -> str | None:
        """Translation key for future localization."""
        return None

    @property
    def entity_registry_enabled_default(self) -> bool:
        """Enable by default."""
        return True

    def _handle_runtime_update(self) -> None:
        self.async_schedule_update_ha_state(True)

    def _handle_daily_refresh(self, _now: datetime) -> None:
        self.async_schedule_update_ha_state(True)


class ProductUsageStatsConsolidatedSensor(SensorEntity):
    """Consolidated product usage sensor for today's total and per-product stats."""

    _attr_has_entity_name = True

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
        runtime = self.hass.data[DOMAIN][entry.entry_id]
        self._friendly_name = runtime.friendly_name
        self._attr_unique_id = f"{entry.entry_id}_period_products_today"
        self._attr_name = f"{self._friendly_name}: Period products today"
        self._icon = "mdi:chart-box"
        self._attr_native_unit_of_measurement = "items"
        self._attr_native_value = 0
        self._attrs: dict[str, StateType] = {}

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_HISTORY_UPDATED, self._handle_runtime_update)
        )
        self.async_on_remove(
            async_track_time_change(
                self.hass,
                self._handle_daily_refresh,
                hour=0,
                minute=0,
                second=5,
            )
        )

    async def async_update(self) -> None:
        runtime = self.hass.data[DOMAIN][self._entry.entry_id]
        self._friendly_name = runtime.friendly_name
        self._attr_name = f"{self._friendly_name}: Period products today"

        stats = _build_product_usage_stats(runtime.history, runtime.product_usage, dt_util.now().date())
        today = stats["today"]
        this_cycle = stats["this_cycle"]
        averages = stats["stats"]["average_per_cycle"]
        self._attr_native_value = sum(int(today.get(product, 0)) for product in PRODUCT_USAGE_PRODUCTS)
        self._attrs = {
            "profile": runtime.profile,
            "friendly_name": runtime.friendly_name,
            "entry_id": self._entry.entry_id,
            "today": today,
            "this_cycle": this_cycle,
            "average_per_cycle": averages,
            "cycles_considered": stats["stats"]["cycles_considered"],
        }

    @property
    def native_value(self) -> StateType:
        return self._attr_native_value

    @property
    def extra_state_attributes(self) -> dict[str, StateType]:
        return self._attrs

    @property
    def icon(self) -> str | None:
        return self._icon

    @property
    def should_poll(self) -> bool:
        return False

    @property
    def available(self) -> bool:
        return self._entry.entry_id in self.hass.data.get(DOMAIN, {})

    def _handle_runtime_update(self) -> None:
        self.async_schedule_update_ha_state(True)

    def _handle_daily_refresh(self, _now: datetime) -> None:
        self.async_schedule_update_ha_state(True)
