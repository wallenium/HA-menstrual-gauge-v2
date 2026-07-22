"""Sensor platform for menstruation gauge."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from statistics import mean
import math
import re
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
    ATTR_MENOPAUSE_DATA,
    DOMAIN,
    SIGNAL_HISTORY_UPDATED,
)
from .model import bleeding_blocks, build_cycle_model, grouped_cycle_starts, normalize_history


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
SYMPTOM_SENSOR_HISTORY_LIMIT = 60
SYMPTOM_STATS_MAX_CYCLES = 6
SYMPTOM_MULTI_VALUE_KEYS = ("pain", "hygiene", "test")
BLEEDING_STRENGTH_PRIORITY = {"light": 1, "medium": 2, "heavy": 3, "very_heavy": 4}
CYCLE_STATS_MAX_CYCLES = 12
CYCLE_RECENT_LIMIT = 12
CYCLE_HISTORY_LIMIT_MONTHS = 18
PRODUCT_USAGE_PRODUCT_ALIASES = {
    "tampon": "tampon",
    "tampons": "tampon",
    "pad": "pad",
    "pads": "pad",
    "binde": "pad",
    "binden": "pad",
    "cup": "cup",
    "cups": "cup",
    "menstrual_cup": "cup",
    "menstrual cup": "cup",
    "liner": "liner",
    "liners": "liner",
    "pantyliner": "liner",
    "pantyliners": "liner",
    "slipeinlage": "liner",
    "slipeinlagen": "liner",
    "underwear": "underwear",
    "period_underwear": "underwear",
    "period underwear": "underwear",
    "period_panties": "underwear",
    "period panties": "underwear",
    "period_panty": "underwear",
    "period panty": "underwear",
    "periodenunterwaesche": "underwear",
    "periodenunterwäsche": "underwear",
}


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
    return _coerce_quantity(entry.get("quantity", 1))


def _coerce_quantity(value: Any, default: int = 1) -> int:
    parsed: float | None
    if isinstance(value, bool):
        parsed = None
    elif isinstance(value, (int, float)):
        parsed = float(value)
    else:
        text = str(value or "").strip()
        if not text:
            parsed = None
        else:
            match = re.search(r"[-+]?\d+(?:[.,]\d+)?", text)
            if match is None:
                parsed = None
            else:
                try:
                    parsed = float(match.group(0).replace(",", "."))
                except ValueError:
                    parsed = None
    if parsed is None or not math.isfinite(parsed) or parsed <= 0:
        return max(1, int(default))
    return max(1, int(parsed))


def _normalize_product_usage_product(raw: Any) -> str | None:
    value = str(raw or "").strip().lower()
    if not value:
        return None
    normalized = value.replace("-", "_")
    return PRODUCT_USAGE_PRODUCT_ALIASES.get(normalized) or PRODUCT_USAGE_PRODUCT_ALIASES.get(value)


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
    symptom_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    normalized_history = normalize_history(history)
    usable_history = [item for item in normalized_history if item <= today.isoformat()] or normalized_history
    blocks = bleeding_blocks(usable_history)
    grouped_usage = _group_product_usage_by_date(_merge_product_usage_sources(product_usage, symptom_history or []))

    today_counts = _count_products(grouped_usage.get(today.isoformat(), []))

    recent_blocks = [block for block in blocks[-PRODUCT_USAGE_CYCLES_CONSIDERED:] if block]
    cycle_totals = [_count_products_for_block(grouped_usage, block) for block in recent_blocks]
    cycles_considered = len(cycle_totals)

    average_per_cycle = {
        product: round(mean([cycle[product] for cycle in cycle_totals]), 1) if cycles_considered else 0.0
        for product in PRODUCT_USAGE_PRODUCTS
    }

    this_cycle = _count_products_for_block(grouped_usage, blocks[-1]) if blocks else _empty_product_counts()

    return {
        "today": today_counts,
        "this_cycle": this_cycle,
        "stats": {
            "average_per_cycle": average_per_cycle,
            "cycles_considered": cycles_considered,
        },
    }


def _parse_iso_date(raw: Any) -> date | None:
    if raw in (None, ""):
        return None
    if isinstance(raw, date):
        return raw
    if isinstance(raw, datetime):
        return raw.date()

    text = str(raw).strip()
    if not text:
        return None

    try:
        return date.fromisoformat(text)
    except ValueError:
        pass

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        pass

    try:
        numeric = float(text)
    except ValueError:
        return None

    if not numeric.is_integer():
        return None

    try:
        timestamp = int(numeric)
        if abs(timestamp) >= 1_000_000_000_000:
            timestamp /= 1000
        return datetime.utcfromtimestamp(timestamp).date()
    except (OverflowError, OSError, ValueError):
        return None


def _normalize_product_usage_entry(entry: dict[str, Any]) -> dict[str, Any] | None:
    entry_date = (
        _parse_iso_date(entry.get("date"))
        or _parse_iso_date(entry.get("created_at"))
        or _parse_iso_date(entry.get("logged_at"))
        or _parse_iso_date(entry.get("timestamp"))
    )
    product = _normalize_product_usage_product(entry.get("product"))
    if entry_date is None or product is None:
        return None
    return {
        **entry,
        "date": entry_date.isoformat(),
        "product": product,
        "quantity": _entry_quantity(entry),
        "action": str(entry.get("action", "used")).strip().lower() or "used",
    }


def _merge_product_usage_sources(
    product_usage: list[dict[str, Any]],
    symptom_history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized_usage: list[dict[str, Any]] = []
    explicit_pairs: set[tuple[str, str]] = set()

    for raw_entry in product_usage:
        if not isinstance(raw_entry, dict):
            continue
        normalized_entry = _normalize_product_usage_entry(raw_entry)
        if normalized_entry is None:
            continue
        normalized_usage.append(normalized_entry)
        explicit_pairs.add((normalized_entry["date"], normalized_entry["product"]))

    for symptom_entry in symptom_history:
        if not isinstance(symptom_entry, dict):
            continue
        entry_date = _parse_iso_date(symptom_entry.get("date"))
        if entry_date is None:
            continue

        for raw_product in _coerce_multi_values(symptom_entry.get("hygiene")):
            product = _normalize_product_usage_product(raw_product)
            date_key = entry_date.isoformat()
            if product is None or (date_key, product) in explicit_pairs:
                continue
            normalized_usage.append(
                {
                    "date": date_key,
                    "product": product,
                    "quantity": 1,
                    "action": "used",
                }
            )

    return sorted(
        normalized_usage,
        key=lambda item: (item.get("date", ""), item.get("product", ""), item.get("action", "")),
    )


def _symptom_entries_for_period(
    symptom_history: list[dict[str, Any]],
    start: date,
    end: date,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for entry in symptom_history:
        entry_date = _parse_iso_date(entry.get("date"))
        if entry_date is None or entry_date < start or entry_date > end:
            continue
        entries.append(entry)
    return entries


def _coerce_multi_values(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item not in (None, "")]
    if value in (None, ""):
        return []
    return [str(value)]


def _summarize_symptoms_for_period(
    symptom_history: list[dict[str, Any]],
    start: date,
    end: date,
) -> dict[str, Any]:
    period_entries = _symptom_entries_for_period(symptom_history, start, end)
    if not period_entries:
        return {}

    if start == end and len(period_entries) == 1:
        return {
            key: value
            for key, value in period_entries[0].items()
            if key != "date" and value not in (None, "", [], {})
        }

    summary: dict[str, Any] = {}

    bleeding_values: list[tuple[int, str]] = []
    for index, entry in enumerate(period_entries):
        value = entry.get("bleeding_strength")
        if not isinstance(value, str):
            continue
        bleeding_values.append((index, value))
    if bleeding_values:
        _, strongest_bleeding = max(
            bleeding_values,
            key=lambda item: (BLEEDING_STRENGTH_PRIORITY.get(item[1], 0), item[0]),
        )
        summary["bleeding_strength"] = strongest_bleeding

    for key in ("spotting", "intercourse", "cervical_mucus"):
        values = [str(entry[key]) for entry in period_entries if entry.get(key) not in (None, "")]
        if values:
            summary[key] = Counter(values).most_common(1)[0][0]

    for key in SYMPTOM_MULTI_VALUE_KEYS:
        days_with_value = 0
        value_counter: Counter[str] = Counter()
        for entry in period_entries:
            values = _coerce_multi_values(entry.get(key))
            if not values:
                continue
            days_with_value += 1
            value_counter.update(values)

        if not value_counter:
            continue

        types = [name for name, _ in value_counter.most_common()]
        summary[f"{key}_days"] = days_with_value
        summary[f"{key}_types"] = types
        if key == "pain":
            summary["pain_days"] = days_with_value
            summary["pain_types"] = types

    basal_temps: list[float] = []
    for entry in period_entries:
        value = entry.get("basal_temp")
        if value in (None, ""):
            continue
        try:
            basal_temps.append(float(value))
        except (TypeError, ValueError):
            continue
    if basal_temps:
        summary["basal_temp_average"] = round(mean(basal_temps), 1)
        summary["basal_temp_min"] = round(min(basal_temps), 1)
        summary["basal_temp_max"] = round(max(basal_temps), 1)

    return summary


def _build_symptom_statistics(
    history: list[str],
    symptom_history: list[dict[str, Any]],
    today: date,
) -> dict[str, Any]:
    normalized_history = normalize_history(history)
    usable_history = [item for item in normalized_history if item <= today.isoformat()] or normalized_history
    cycle_starts = grouped_cycle_starts(usable_history)
    cycle_starts = cycle_starts[-SYMPTOM_STATS_MAX_CYCLES:]

    periods: list[tuple[date, date]] = []
    for idx, start_iso in enumerate(cycle_starts):
        start_date = _parse_iso_date(start_iso)
        if start_date is None:
            continue
        if idx + 1 < len(cycle_starts):
            next_start = _parse_iso_date(cycle_starts[idx + 1])
            if next_start is None:
                continue
            end_date = min(today, next_start - timedelta(days=1))
        else:
            end_date = today
        if end_date >= start_date:
            periods.append((start_date, end_date))

    if not periods:
        return {"cycles_analyzed": 0}

    cycles_analyzed = len(periods)
    cycles_with_pain = 0
    pain_days_per_cycle: list[int] = []
    pain_types: Counter[str] = Counter()
    bleeding_strengths: Counter[str] = Counter()
    cervical_mucus: Counter[str] = Counter()
    basal_temps: list[float] = []

    for start, end in periods:
        entries = _symptom_entries_for_period(symptom_history, start, end)
        cycle_pain_days = 0
        for entry in entries:
            pain_values = _coerce_multi_values(entry.get("pain"))
            if pain_values:
                cycle_pain_days += 1
                pain_types.update(pain_values)

            bleeding = entry.get("bleeding_strength")
            if isinstance(bleeding, str) and bleeding:
                bleeding_strengths[bleeding] += 1

            mucus = entry.get("cervical_mucus")
            if isinstance(mucus, str) and mucus:
                cervical_mucus[mucus] += 1

            temp_value = entry.get("basal_temp")
            if temp_value not in (None, ""):
                try:
                    basal_temps.append(float(temp_value))
                except (TypeError, ValueError):
                    pass

        pain_days_per_cycle.append(cycle_pain_days)
        if cycle_pain_days > 0:
            cycles_with_pain += 1

    pain_total = sum(pain_types.values())
    bleeding_total = sum(bleeding_strengths.values())

    typical_bleeding = None
    if bleeding_strengths:
        top_count = max(bleeding_strengths.values())
        candidates = [value for value, count in bleeding_strengths.items() if count == top_count]
        typical_bleeding = max(candidates, key=lambda value: BLEEDING_STRENGTH_PRIORITY.get(value, 0))

    return {
        "pain_frequency": round((cycles_with_pain / cycles_analyzed) * 100) if cycles_analyzed else 0,
        "average_pain_days_per_cycle": round(mean(pain_days_per_cycle), 1) if pain_days_per_cycle else 0.0,
        "common_pain_types": {
            key: round((count / pain_total) * 100)
            for key, count in pain_types.items()
        } if pain_total else {},
        "typical_bleeding_strength": typical_bleeding,
        "bleeding_strength_distribution": {
            key: round((count / bleeding_total) * 100)
            for key, count in bleeding_strengths.items()
        } if bleeding_total else {},
        "typical_cervical_mucus": cervical_mucus.most_common(1)[0][0] if cervical_mucus else None,
        "average_basal_temp": round(mean(basal_temps), 1) if basal_temps else None,
        "cycles_analyzed": cycles_analyzed,
    }


def _compact_symptom_history(symptom_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(symptom_history) <= SYMPTOM_SENSOR_HISTORY_LIMIT:
        return symptom_history
    return symptom_history[-SYMPTOM_SENSOR_HISTORY_LIMIT:]


def _compact_product_usage_for_sensor(
    product_usage: list[dict[str, Any]],
    symptom_history: list[dict[str, Any]],
    today: date,
    days: int = PRODUCT_USAGE_TIMELINE_DAYS,
) -> list[dict[str, Any]]:
    """Limit product usage to a recent window for sensor broadcasting."""
    merged_usage = _merge_product_usage_sources(product_usage, symptom_history)
    if not merged_usage:
        return merged_usage
    cutoff = today - timedelta(days=max(days - 1, 0))
    compact_entries: list[dict[str, Any]] = []
    for entry in merged_usage:
        entry_date = _parse_iso_date(entry.get("date"))
        if entry_date is None or entry_date > today or entry_date < cutoff:
            continue
        compact_entries.append(entry)
    return compact_entries


def _compact_history_for_sensor(history: list[str], today: date, months: int = CYCLE_HISTORY_LIMIT_MONTHS) -> list[str]:
    """Limit history to recent months for sensor broadcasting."""
    if not history:
        return history
    cutoff = today - timedelta(days=int(months * 30.44))
    cutoff_iso = cutoff.isoformat()
    compact = [d for d in history if d >= cutoff_iso]
    return compact if compact else history


def _compact_grouped_starts_for_sensor(grouped_starts: list[str], today: date, months: int = CYCLE_HISTORY_LIMIT_MONTHS) -> list[str]:
    """Limit grouped_starts to recent months for sensor broadcasting."""
    if not grouped_starts:
        return grouped_starts
    cutoff = today - timedelta(days=int(months * 30.44))
    cutoff_iso = cutoff.isoformat()
    compact = [d for d in grouped_starts if d >= cutoff_iso]
    # Always include at least the last 2 entries so cycle-length calculations still work in cards
    if len(compact) < 2 and len(grouped_starts) >= 2:
        compact = grouped_starts[-2:]
    return compact if compact else grouped_starts


def _build_cycle_statistics(
    grouped_starts: list[str],
    bleeding_blocks_payload: list[dict[str, str | int]],
    today: date,
) -> dict[str, Any]:
    """Build pre-calculated cycle statistics for the sensor attribute."""
    if not grouped_starts:
        return {"cycles_analyzed": 0}

    recent_starts = grouped_starts[-(CYCLE_STATS_MAX_CYCLES + 1):]

    cycle_lengths: list[int] = []
    recent_cycles: list[dict[str, Any]] = []

    for idx in range(1, len(recent_starts)):
        start_iso = recent_starts[idx - 1]
        next_iso = recent_starts[idx]
        start_d = _parse_iso_date(start_iso)
        next_d = _parse_iso_date(next_iso)
        if start_d is None or next_d is None:
            continue
        length = (next_d - start_d).days
        if 10 < length < 80:
            cycle_lengths.append(length)
            recent_cycles.append({
                "start": start_iso,
                "end": (next_d - timedelta(days=1)).isoformat(),
                "length": length,
            })

    current_start_iso = grouped_starts[-1]
    current_start_d = _parse_iso_date(current_start_iso)
    if current_start_d is not None:
        days_in_current = (today - current_start_d).days + 1
        recent_cycles.append({
            "start": current_start_iso,
            "end": None,
            "length": days_in_current,
        })

    if not cycle_lengths:
        return {
            "cycles_analyzed": 0,
            "recent_cycles": recent_cycles[-CYCLE_RECENT_LIMIT:],
        }

    avg_cycle = round(mean(cycle_lengths), 1)
    min_cycle = min(cycle_lengths)
    max_cycle = max(cycle_lengths)
    regular_count = sum(1 for length in cycle_lengths if abs(length - avg_cycle) <= 3)
    regularity = round((regular_count / len(cycle_lengths)) * 100)

    avg_period_duration: float | None = None
    if bleeding_blocks_payload:
        recent_blocks = bleeding_blocks_payload[-CYCLE_STATS_MAX_CYCLES:]
        durations = [
            block["length"]
            for block in recent_blocks
            if isinstance(block.get("length"), int)
        ]
        if durations:
            avg_period_duration = round(mean(durations), 1)

    return {
        "average_cycle_length": avg_cycle,
        "average_period_duration": avg_period_duration,
        "cycles_analyzed": len(cycle_lengths),
        "min_cycle_length": min_cycle,
        "max_cycle_length": max_cycle,
        "cycle_regularity_percent": regularity,
        "recent_cycles": recent_cycles[-CYCLE_RECENT_LIMIT:],
    }


def _get_current_bleeding_block(
    bleeding_blocks_payload: list[dict[str, str | int]],
    history: list[str],
    today: date,
) -> dict[str, Any] | None:
    """Return the most recent bleeding block enriched with confirmed days."""
    if not bleeding_blocks_payload:
        return None

    last_block = bleeding_blocks_payload[-1]
    start_iso = last_block.get("start")
    end_iso = last_block.get("end")

    if not isinstance(start_iso, str):
        return None

    end_filter = end_iso if isinstance(end_iso, str) else today.isoformat()
    confirmed_days = [d for d in history if isinstance(d, str) and start_iso <= d <= end_filter]

    return {
        "start": start_iso,
        "end": end_iso,
        "length": last_block.get("length"),
        "confirmed_days": confirmed_days,
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
        today = dt_util.now().date()
        self._attr_name = runtime.friendly_name
        self._icon = runtime.icon or None
        model = build_cycle_model(
            history=runtime.history,
            period_duration_days=runtime.period_duration_days,
            symptom_history=runtime.symptom_history,
            pregnancy_data=runtime.pregnancy_data,
            menarche_data=runtime.menarche_data,
            pre_menarche_data=runtime.pre_menarche_data,
            menopause_data=runtime.menopause_data,
            today=today,
        )
        usage_stats = _build_product_usage_stats(
            runtime.history,
            runtime.product_usage,
            today,
            runtime.symptom_history,
        )
        symptom_data_today = _summarize_symptoms_for_period(model.symptom_history, today, today)

        symptom_data_this_cycle: dict[str, Any] = {}
        if model.grouped_starts:
            cycle_start = _parse_iso_date(model.grouped_starts[-1])
            if cycle_start is not None:
                symptom_data_this_cycle = _summarize_symptoms_for_period(
                    model.symptom_history,
                    cycle_start,
                    today,
                )

        symptom_statistics = _build_symptom_statistics(model.history, model.symptom_history, today)
        compact_symptom_history = _compact_symptom_history(model.symptom_history)
        compact_product_usage = _compact_product_usage_for_sensor(
            runtime.product_usage,
            runtime.symptom_history,
            today,
        )

        # Cycle start / day in current cycle
        cycle_start_date: str | None = model.grouped_starts[-1] if model.grouped_starts else None
        cycle_day: int | None = None
        if cycle_start_date:
            start_d = _parse_iso_date(cycle_start_date)
            if start_d is not None:
                cycle_day = (today - start_d).days + 1

        cycle_statistics = _build_cycle_statistics(model.grouped_starts, model.bleeding_blocks, today)
        current_bleeding_block = _get_current_bleeding_block(model.bleeding_blocks, model.history, today)

        # Compact history/grouped_starts for sensor broadcasting (full data stays in storage)
        sensor_history = _compact_history_for_sensor(model.history, today)
        sensor_grouped_starts = _compact_grouped_starts_for_sensor(model.grouped_starts, today)

        self._state = model.state
        has_history = bool(model.history)

        self._attrs = {
            ATTR_HISTORY: sensor_history,
            ATTR_SYMPTOM_HISTORY: compact_symptom_history,
            ATTR_GROUPED_STARTS: sensor_grouped_starts,
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
            ATTR_MENOPAUSE_DATA: model.menopause_data,
            "profile": runtime.profile,
            "entry_id": self._entry.entry_id,
            "friendly_name": runtime.friendly_name,
            "product_usage_today": usage_stats["today"],
            "product_usage_this_cycle": usage_stats["this_cycle"],
            "product_usage_stats": usage_stats["stats"],
            "product_usage_timeline": compact_product_usage,
            "symptom_data_today": symptom_data_today,
            "symptom_data_this_cycle": symptom_data_this_cycle,
            "symptom_statistics": symptom_statistics,
            "cycle_start_date": cycle_start_date,
            "cycle_day": cycle_day,
            "current_bleeding_block": current_bleeding_block,
            "cycle_statistics": cycle_statistics,
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

        stats = _build_product_usage_stats(
            runtime.history,
            runtime.product_usage,
            dt_util.now().date(),
            runtime.symptom_history,
        )
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
