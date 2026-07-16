"""Sensor platform for menstruation gauge."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
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
    ATTR_GROUPED_STARTS,
    ATTR_HISTORY,
    ATTR_IS_PREGNANT,
    ATTR_NEXT_PREDICTED_START,
    ATTR_PERIOD_DURATION_DAYS,
    ATTR_PRE_MENARCHE_DATA,
    ATTR_PREGNANCY_DATA,
    ATTR_PREGNANCY_START_DATE,
    ATTR_PRODUCT_INVENTORY,
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
            ProductUsageTodaySensor(hass, entry, "tampon"),
            ProductUsageTodaySensor(hass, entry, "pad"),
            CupEmptiesTodaySensor(hass, entry),
            ProductUsageAverageCycleSensor(hass, entry),
        ],
        True,
    )


def _group_product_usage_by_date(product_usage: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in product_usage:
        date_str = entry.get("date")
        if isinstance(date_str, str):
            grouped[date_str].append(entry)
    return grouped


def _product_usage_for_range(
    grouped_usage: dict[str, list[dict[str, Any]]],
    start: str,
    end: str,
    *,
    product: str | None = None,
    action: str | None = None,
) -> int:
    start_date = date.fromisoformat(start)
    end_date = date.fromisoformat(end)
    count = 0
    for day_entries_date, day_entries in grouped_usage.items():
        try:
            entry_date = date.fromisoformat(day_entries_date)
        except ValueError:
            continue
        if entry_date < start_date or entry_date > end_date:
            continue
        for entry in day_entries:
            if product and entry.get("product") != product:
                continue
            if action and entry.get("action") != action:
                continue
            count += int(entry.get("quantity", 1) or 1)
    return count


def _build_product_usage_stats(
    history: list[str],
    product_usage: list[dict[str, Any]],
    today: date,
) -> dict[str, Any]:
    normalized_history = normalize_history(history)
    usable_history = [item for item in normalized_history if item <= today.isoformat()] or normalized_history
    blocks = bleeding_blocks(usable_history)
    grouped_usage = _group_product_usage_by_date(product_usage)

    today_iso = today.isoformat()
    today_entries = grouped_usage.get(today_iso, [])
    today_tampons = sum(int(entry.get("quantity", 1) or 1) for entry in today_entries if entry.get("product") == "tampon")
    today_pads = sum(int(entry.get("quantity", 1) or 1) for entry in today_entries if entry.get("product") == "pad")
    today_cup_empties = sum(
        int(entry.get("quantity", 1) or 1)
        for entry in today_entries
        if entry.get("product") == "cup" and entry.get("action") == "emptied"
    )

    recent_blocks = blocks[-3:]
    tampon_cycle_counts = [
        _product_usage_for_range(grouped_usage, block[0], block[-1], product="tampon")
        for block in recent_blocks
        if block
    ]
    pad_cycle_counts = [
        _product_usage_for_range(grouped_usage, block[0], block[-1], product="pad")
        for block in recent_blocks
        if block
    ]
    cup_cycle_counts = [
        _product_usage_for_range(grouped_usage, block[0], block[-1], product="cup", action="emptied")
        for block in recent_blocks
        if block
    ]

    overall_cycle_counts = [
        _product_usage_for_range(grouped_usage, block[0], block[-1])
        for block in recent_blocks
        if block
    ]

    return {
        "today": {
            "tampon": today_tampons,
            "pad": today_pads,
            "cup_empties": today_cup_empties,
        },
        "averages_per_cycle": {
            "overall": round(mean(overall_cycle_counts), 1) if overall_cycle_counts else 0.0,
            "tampon": round(mean(tampon_cycle_counts), 1) if tampon_cycle_counts else 0.0,
            "pad": round(mean(pad_cycle_counts), 1) if pad_cycle_counts else 0.0,
            "cup_empties": round(mean(cup_cycle_counts), 1) if cup_cycle_counts else 0.0,
            "cycles_considered": len(recent_blocks),
        },
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
            "profile": runtime.profile,
            "entry_id": self._entry.entry_id,
            "friendly_name": runtime.friendly_name,
            "product_usage_stats": usage_stats,
            ATTR_PRODUCT_INVENTORY: runtime.product_inventory,
        }

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


class ProductUsageTodaySensor(SensorEntity):
    """Count logged tampon or pad usage for today with profile naming."""

    _attr_has_entity_name = True
    _product_labels = {
        "tampon": ("Tampon usage today", "mdi:water-opacity"),
        "pad": ("Pad usage today", "mdi:medical-bag"),
        "cup": ("Cup empties today", "mdi:cup-water"),
    }

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, product: str) -> None:
        self.hass = hass
        self._entry = entry
        self._product = product
        runtime = self.hass.data[DOMAIN][entry.entry_id]
        self._profile = runtime.profile
        self._friendly_name = runtime.friendly_name
        
        # Create unique ID with profile to avoid duplicates
        self._attr_unique_id = f"{entry.entry_id}_{product}_usage_today"
        
        # Create name with profile prefix for clarity
        base_label, icon = self._product_labels[product]
        self._attr_name = f"{self._friendly_name}: {base_label}"
        self._icon = icon
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
        base_label, _ = self._product_labels[self._product]
        self._attr_name = f"{self._friendly_name}: {base_label}"
        
        self._attr_native_value = _build_product_usage_stats(
            runtime.history,
            runtime.product_usage,
            dt_util.now().date(),
        )["today"][self._product]
        self._attrs = {
            "profile": runtime.profile,
            "friendly_name": runtime.friendly_name,
            "entry_id": self._entry.entry_id,
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


class CupEmptiesTodaySensor(ProductUsageTodaySensor):
    """Count logged menstrual cup emptying events for today with profile naming."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry, "cup")
        runtime = self.hass.data[DOMAIN][entry.entry_id]
        self._attr_unique_id = f"{entry.entry_id}_cup_empties_today"
        self._attr_name = f"{runtime.friendly_name}: Cup empties today"
        self._icon = "mdi:cup-water"
        self._attr_native_unit_of_measurement = "empties"

    async def async_update(self) -> None:
        runtime = self.hass.data[DOMAIN][self._entry.entry_id]
        self._attr_name = f"{runtime.friendly_name}: Cup empties today"
        self._attr_native_value = _build_product_usage_stats(
            runtime.history,
            runtime.product_usage,
            dt_util.now().date(),
        )["today"]["cup_empties"]
        self._attrs = {
            "profile": runtime.profile,
            "friendly_name": runtime.friendly_name,
            "entry_id": self._entry.entry_id,
        }


class ProductUsageAverageCycleSensor(SensorEntity):
    """Average logged product usage per recent cycle with profile naming."""

    _attr_has_entity_name = True

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
        runtime = self.hass.data[DOMAIN][entry.entry_id]
        self._friendly_name = runtime.friendly_name
        
        self._attr_unique_id = f"{entry.entry_id}_product_usage_average_cycle"
        self._attr_name = f"{self._friendly_name}: Product usage average cycle"
        self._icon = "mdi:chart-line"
        self._attr_native_unit_of_measurement = "items/cycle"
        self._attr_native_value = 0.0
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
        self._attr_name = f"{self._friendly_name}: Product usage average cycle"
        
        stats = _build_product_usage_stats(runtime.history, runtime.product_usage, dt_util.now().date())
        averages = stats["averages_per_cycle"]
        self._attr_native_value = averages["overall"]
        self._attrs = {
            "profile": runtime.profile,
            "friendly_name": runtime.friendly_name,
            "entry_id": self._entry.entry_id,
            "tampon_average_per_cycle": averages["tampon"],
            "pad_average_per_cycle": averages["pad"],
            "cup_empties_average_per_cycle": averages["cup_empties"],
            "cycles_considered": averages["cycles_considered"],
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
