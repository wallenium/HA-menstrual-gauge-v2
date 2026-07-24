"""Cycle calculation model for menstruation gauge."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from .const import (
    CYCLE_LENGTH_OVERRIDE_MAX,
    CYCLE_LENGTH_OVERRIDE_MIN,
    DEFAULT_CYCLE_LENGTH,
    DEFAULT_PERIOD_DURATION_DAYS,
    STATE_FERTILE,
    STATE_MENARCHE,
    STATE_NEUTRAL,
    STATE_PERIOD,
    STATE_PMS,
    STATE_PREGNANT,
    STATE_PRE_MENARCHE,
)

PREGNANCY_DAYS = 280  # Standard pregnancy duration in days (40 weeks)


@dataclass(slots=True)
class CycleModel:
    """Computed cycle values for the sensor attributes."""

    history: list[str]
    grouped_starts: list[str]
    bleeding_blocks: list[dict[str, str | int]]
    next_predicted_start: str | None
    avg_cycle_length: int | None
    fertile_window_start: str | None
    fertile_window_end: str | None
    ovulation_day: str | None
    days_until_next_start: int | None
    period_duration_days: int
    learned_period_duration_days: int | None
    current_period: dict[str, Any] | None
    state: str
    symptom_history: list[dict[str, Any]]
    is_pregnant: bool
    pregnancy_start_date: str | None
    weeks_pregnant: int | None
    due_date: str | None
    menarche_data: dict[str, Any]
    pre_menarche_data: dict[str, Any]
    menopause_data: dict[str, Any]
    noncycle_data: dict[str, Any]


def normalize_history(history: list[str]) -> list[str]:
    """Normalize and sort history values."""
    normalized: set[str] = set()
    for raw in history:
        try:
            normalized.add(date.fromisoformat(str(raw)).isoformat())
        except ValueError:
            continue
    return sorted(normalized)


def grouped_cycle_starts(days: list[str]) -> list[str]:
    """Group contiguous bleeding entries and return starts."""
    if not days:
        return []

    starts: list[str] = []
    for idx, current in enumerate(days):
        if idx == 0:
            starts.append(current)
            continue

        prev = days[idx - 1]
        diff = (date.fromisoformat(current) - date.fromisoformat(prev)).days
        if diff > 2:
            starts.append(current)

    return starts


def bleeding_blocks(days: list[str]) -> list[list[str]]:
    """Group bleeding days into blocks (contiguous / near-contiguous entries)."""
    if not days:
        return []

    blocks: list[list[str]] = []
    current: list[str] = [days[0]]

    for idx in range(1, len(days)):
        prev = date.fromisoformat(days[idx - 1])
        current_day = date.fromisoformat(days[idx])
        diff = (current_day - prev).days
        if diff <= 2:
            current.append(days[idx])
        else:
            blocks.append(current)
            current = [days[idx]]

    blocks.append(current)
    return blocks


def learned_period_duration(default_days: int, blocks: list[list[str]]) -> tuple[int, int | None]:
    """Learn period duration from historical block lengths; only adapt upward."""
    default_norm = max(1, min(14, int(default_days)))
    if len(blocks) < 3:
        return default_norm, None

    recent = blocks[-6:]
    lengths = [len(block) for block in recent if block]
    if not lengths:
        return default_norm, None

    avg_len = round(sum(lengths) / len(lengths))
    learned = max(default_norm, max(1, min(14, avg_len)))
    return learned, avg_len


def current_period_details(
    blocks: list[list[str]],
    symptom_history: list[dict[str, Any]],
    period_duration_days: int,
    today: date,
) -> dict[str, Any] | None:
    """Return lifecycle details for the latest period block."""
    if not blocks:
        return None

    last_block = blocks[-1]
    if not last_block:
        return None

    start_iso = last_block[0]
    end_iso = last_block[-1]
    start_date = date.fromisoformat(start_iso)
    end_date = date.fromisoformat(end_iso)
    if start_date > today:
        return None

    max_duration = max(1, min(14, int(period_duration_days)))
    latest_expected_end = start_date + timedelta(days=max_duration - 1)
    today_iso = today.isoformat()
    none_date_iso: str | None = None
    none_values = {"none", "keine"}

    for entry in normalize_symptoms(symptom_history):
        entry_date = entry.get("date")
        bleeding_strength = str(entry.get("bleeding_strength", "")).strip().lower()
        if not isinstance(entry_date, str):
            continue
        if entry_date < start_iso or entry_date > today_iso:
            continue
        if bleeding_strength in none_values:
            none_date_iso = entry_date
            break

    ended_by: str | None = None
    ended_on_iso: str | None = None
    is_active = True

    if none_date_iso is not None:
        ended_by = "bleeding_none"
        ended_on_iso = none_date_iso
        is_active = False
    elif today > latest_expected_end:
        ended_by = "duration"
        ended_on_iso = latest_expected_end.isoformat()
        is_active = False

    confirmed_days = [day for day in last_block if day <= today_iso]
    days_elapsed = max(1, (today - start_date).days + 1)
    today_logged = today_iso in confirmed_days or any(
        isinstance(entry, dict) and entry.get("date") == today_iso
        for entry in symptom_history
    )

    return {
        "start": start_iso,
        "end": end_iso,
        "length": len(last_block),
        "confirmed_days": confirmed_days,
        "days_elapsed": days_elapsed,
        "effective_duration": max_duration,
        "expected_end": latest_expected_end.isoformat(),
        "today_logged": today_logged,
        "is_active": is_active,
        "ended_by": ended_by,
        "ended_on": ended_on_iso,
        "last_confirmed_day": end_date.isoformat(),
    }


def predict_next_start(grouped_starts: list[str]) -> tuple[str | None, int | None]:
    """Predict next cycle start based on recent cycle lengths."""
    if not grouped_starts:
        return None, None

    if len(grouped_starts) == 1:
        last = date.fromisoformat(grouped_starts[0])
        return (last + timedelta(days=28)).isoformat(), 28

    lengths: list[int] = []
    start_index = max(1, len(grouped_starts) - 4)
    for idx in range(start_index, len(grouped_starts)):
        current = date.fromisoformat(grouped_starts[idx])
        prev = date.fromisoformat(grouped_starts[idx - 1])
        diff = (current - prev).days
        if 10 < diff < 80:
            lengths.append(diff)

    avg = round(sum(lengths) / len(lengths)) if lengths else 28
    next_start = date.fromisoformat(grouped_starts[-1]) + timedelta(days=avg)
    return next_start.isoformat(), avg


def normalize_symptoms(symptom_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize symptom history and ensure all dates are valid ISO format."""
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in symptom_history:
        if not isinstance(item, dict):
            continue
        date_str = item.get("date")
        if not date_str:
            continue
        try:
            iso_date = date.fromisoformat(str(date_str)).isoformat()
            if iso_date not in seen:
                normalized_item = dict(item)
                normalized_item["date"] = iso_date
                normalized.append(normalized_item)
                seen.add(iso_date)
        except ValueError:
            continue

    return sorted(normalized, key=lambda x: x.get("date", ""))


def calculate_pregnancy_info(pregnancy_start_date: str | None, today: date | None = None) -> tuple[int | None, str | None]:
    """Calculate weeks pregnant and due date from pregnancy start date (first day of last period)."""
    if not pregnancy_start_date:
        return None, None

    now = today or date.today()
    try:
        start = date.fromisoformat(str(pregnancy_start_date))
    except ValueError:
        return None, None

    # Reject future start dates – pregnancy cannot start in the future
    if start > now:
        return None, None

    # Gestational age uses 1-based week counting (week 1 = days 0–6 after LMP)
    weeks = (now - start).days // 7 + 1
    # Due date is 280 days after start
    due = start + timedelta(days=PREGNANCY_DAYS)

    return weeks, due.isoformat()


def build_cycle_model(
    history: list[str],
    period_duration_days: int,
    symptom_history: list[dict[str, Any]] | None = None,
    pregnancy_data: dict[str, Any] | None = None,
    menarche_data: dict[str, Any] | None = None,
    pre_menarche_data: dict[str, Any] | None = None,
    menopause_data: dict[str, Any] | None = None,
    noncycle_data: dict[str, Any] | None = None,
    today: date | None = None,
    cycle_length_override: int | None = None,
) -> CycleModel:
    """Build complete cycle model for sensor state + attributes."""
    now = today or date.today()
    normalized = normalize_history(history)
    symptoms = normalize_symptoms(symptom_history or [])

    preg_data = pregnancy_data or {"is_pregnant": False, "start_date": None}
    is_pregnant = bool(preg_data.get("is_pregnant", False))
    pregnancy_start_date = preg_data.get("start_date")

    men_data: dict[str, Any] = {"tracking_active": False, "is_menarche": False, "menarche_date": None, "estimated_date": None, "family_menarche_age": None}
    if isinstance(menarche_data, dict):
        men_data.update(menarche_data)

    pre_men_data: dict[str, Any] = {"signs": {}, "tanner_stage": None}
    if isinstance(pre_menarche_data, dict):
        pre_men_data.update(pre_menarche_data)

    meno_data: dict[str, Any] = {"is_menopause": False, "start_date": None}
    if isinstance(menopause_data, dict):
        meno_data.update(menopause_data)

    nc_data: dict[str, Any] = {"has_noncycle": False}
    if isinstance(noncycle_data, dict):
        nc_data.update(noncycle_data)

    # If pregnant, return pregnancy state
    if is_pregnant:
        weeks, due_date = calculate_pregnancy_info(pregnancy_start_date, now)
        return CycleModel(
            history=normalized,
            grouped_starts=[],
            bleeding_blocks=[],
            next_predicted_start=None,
            avg_cycle_length=None,
            fertile_window_start=None,
            fertile_window_end=None,
            ovulation_day=None,
            days_until_next_start=None,
            period_duration_days=period_duration_days,
            learned_period_duration_days=None,
            current_period=None,
            state=STATE_PREGNANT,
            symptom_history=symptoms,
            is_pregnant=True,
            pregnancy_start_date=pregnancy_start_date,
            weeks_pregnant=weeks,
            due_date=due_date,
            menarche_data=men_data,
            pre_menarche_data=pre_men_data,
            menopause_data=meno_data,
            noncycle_data=nc_data,
        )

    # If in pre-menarche mode (tracking explicitly enabled, awaiting first period)
    if men_data.get("tracking_active") and men_data.get("is_menarche") is False:
        return CycleModel(
            history=normalized,
            grouped_starts=[],
            bleeding_blocks=[],
            next_predicted_start=men_data.get("estimated_date"),
            avg_cycle_length=None,
            fertile_window_start=None,
            fertile_window_end=None,
            ovulation_day=None,
            days_until_next_start=None,
            period_duration_days=period_duration_days,
            learned_period_duration_days=None,
            current_period=None,
            state=STATE_PRE_MENARCHE,
            symptom_history=symptoms,
            is_pregnant=False,
            pregnancy_start_date=None,
            weeks_pregnant=None,
            due_date=None,
            menarche_data=men_data,
            pre_menarche_data=pre_men_data,
            menopause_data=meno_data,
            noncycle_data=nc_data,
        )

    # If menarche has been recorded, check if we're in the menarche transition state
    if men_data.get("is_menarche") is True and men_data.get("menarche_date"):
        menarche_date_str = men_data["menarche_date"]
        try:
            menarche_date = date.fromisoformat(str(menarche_date_str))
            days_since_menarche = (now - menarche_date).days
            # Menarche state persists for first ~90 days (3 months) after first period
            if days_since_menarche <= 90 and len(normalized) <= 3:
                return CycleModel(
                    history=normalized,
                    grouped_starts=[],
                    bleeding_blocks=[],
                    next_predicted_start=None,
                    avg_cycle_length=None,
                    fertile_window_start=None,
                    fertile_window_end=None,
                    ovulation_day=None,
                    days_until_next_start=None,
                    period_duration_days=period_duration_days,
                    learned_period_duration_days=None,
                    current_period=None,
                    state=STATE_MENARCHE,
                    symptom_history=symptoms,
                    is_pregnant=False,
                    pregnancy_start_date=None,
                    weeks_pregnant=None,
                    due_date=None,
                    menarche_data=men_data,
                    pre_menarche_data=pre_men_data,
                    menopause_data=meno_data,
                    noncycle_data=nc_data,
                )
        except ValueError:
            pass

    # Keep model based on confirmed values up to today, but keep full history as attribute.
    base_history = [item for item in normalized if item <= now.isoformat()] or normalized

    blocks = bleeding_blocks(base_history)
    blocks_payload = [
        {
            "start": block[0],
            "end": block[-1],
            "length": len(block),
        }
        for block in blocks
        if block
    ]
    starts = grouped_cycle_starts(base_history)
    effective_duration, learned_avg_duration = learned_period_duration(period_duration_days, blocks)
    next_start, avg_cycle = predict_next_start(starts)
    # When cycle length is auto (no detected starts) and noncycle data exists,
    # use the default period duration of 5 days for cycle phase calculations.
    if avg_cycle is None and nc_data.get("has_noncycle"):
        avg_cycle = DEFAULT_PERIOD_DURATION_DAYS
    duration_shift_days = max(0, effective_duration - DEFAULT_PERIOD_DURATION_DAYS)
    if next_start and duration_shift_days:
        shifted_next_date = date.fromisoformat(next_start) + timedelta(days=duration_shift_days)
        next_start = shifted_next_date.isoformat()
        if avg_cycle is not None:
            avg_cycle += duration_shift_days
    current_period = current_period_details(blocks, symptoms, effective_duration, now)

    fertile_start: str | None = None
    fertile_end: str | None = None
    ovulation_day_iso: str | None = None
    days_until: int | None = None

    if next_start:
        next_date = date.fromisoformat(next_start)
        # Determine effective cycle length: use override if valid, else avg_cycle, else default 28
        if cycle_length_override and CYCLE_LENGTH_OVERRIDE_MIN <= cycle_length_override <= CYCLE_LENGTH_OVERRIDE_MAX:
            effective_cycle = cycle_length_override
        elif avg_cycle and CYCLE_LENGTH_OVERRIDE_MIN <= avg_cycle <= CYCLE_LENGTH_OVERRIDE_MAX:
            effective_cycle = int(avg_cycle)
        else:
            effective_cycle = DEFAULT_CYCLE_LENGTH
        # Ovulation: day floor(effective_cycle/2) from cycle start, consistent with frontend formula
        # = next_date - (effective_cycle - effective_cycle//2 + 1)
        # For 28-day: next_date - 15 = cycle_start + 13 = day 14 ✓
        ovulation_day = next_date - timedelta(days=effective_cycle - effective_cycle // 2 + 1)
        ovulation_day_iso = ovulation_day.isoformat()
        # Fertile window proportional to cycle length: day (L//7 + 1) to day (L - L//7 - 1)
        fertile_start = (next_date - timedelta(days=effective_cycle - effective_cycle // 7)).isoformat()
        fertile_end = (next_date - timedelta(days=effective_cycle // 7 + 2)).isoformat()
        days_until = (next_date - now).days

    state = STATE_NEUTRAL
    if current_period and current_period.get("is_active"):
        state = STATE_PERIOD
    elif now.isoformat() in set(normalized):
        state = STATE_PERIOD
    elif fertile_start and fertile_end and fertile_start <= now.isoformat() <= fertile_end:
        state = STATE_FERTILE
    elif next_start and abs((date.fromisoformat(next_start) - now).days) <= 1:
        state = STATE_PMS

    return CycleModel(
        history=normalized,
        grouped_starts=starts,
        bleeding_blocks=blocks_payload,
        next_predicted_start=next_start,
        avg_cycle_length=avg_cycle,
        fertile_window_start=fertile_start,
        fertile_window_end=fertile_end,
        ovulation_day=ovulation_day_iso,
        days_until_next_start=days_until,
        period_duration_days=effective_duration,
        learned_period_duration_days=learned_avg_duration,
        current_period=current_period,
        state=state,
        symptom_history=symptoms,
        is_pregnant=False,
        pregnancy_start_date=None,
        weeks_pregnant=None,
        due_date=None,
        menarche_data=men_data,
        pre_menarche_data=pre_men_data,
        menopause_data=meno_data,
        noncycle_data=nc_data,
    )
