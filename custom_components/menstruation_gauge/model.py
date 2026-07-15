"""Cycle calculation model for menstruation gauge."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from .const import STATE_FERTILE, STATE_NEUTRAL, STATE_PERIOD, STATE_PMS, STATE_PREGNANT

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
    days_until_next_start: int | None
    period_duration_days: int
    learned_period_duration_days: int | None
    state: str
    symptom_history: list[dict[str, Any]]
    is_pregnant: bool
    pregnancy_start_date: str | None
    weeks_pregnant: int | None
    due_date: str | None


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

    # Calculate weeks from start date
    weeks = (now - start).days // 7
    # Due date is 280 days after start
    due = start + timedelta(days=PREGNANCY_DAYS)

    return weeks, due.isoformat()


def build_cycle_model(
    history: list[str],
    period_duration_days: int,
    symptom_history: list[dict[str, Any]] | None = None,
    pregnancy_data: dict[str, Any] | None = None,
    today: date | None = None,
) -> CycleModel:
    """Build complete cycle model for sensor state + attributes."""
    now = today or date.today()
    normalized = normalize_history(history)
    symptoms = normalize_symptoms(symptom_history or [])

    preg_data = pregnancy_data or {"is_pregnant": False, "start_date": None}
    is_pregnant = bool(preg_data.get("is_pregnant", False))
    pregnancy_start_date = preg_data.get("start_date")

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
            days_until_next_start=None,
            period_duration_days=period_duration_days,
            learned_period_duration_days=None,
            state=STATE_PREGNANT,
            symptom_history=symptoms,
            is_pregnant=True,
            pregnancy_start_date=pregnancy_start_date,
            weeks_pregnant=weeks,
            due_date=due_date,
        )

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
    next_start, avg_cycle = predict_next_start(starts)
    effective_duration, learned_avg_duration = learned_period_duration(period_duration_days, blocks)

    fertile_start: str | None = None
    fertile_end: str | None = None
    days_until: int | None = None

    if next_start:
        next_date = date.fromisoformat(next_start)
        ovulation_day = next_date - timedelta(days=14)
        fertile_start = (ovulation_day - timedelta(days=4)).isoformat()
        fertile_end = (ovulation_day + timedelta(days=1)).isoformat()
        days_until = (next_date - now).days

    state = STATE_NEUTRAL
    if now.isoformat() in set(normalized):
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
        days_until_next_start=days_until,
        period_duration_days=effective_duration,
        learned_period_duration_days=learned_avg_duration,
        state=state,
        symptom_history=symptoms,
        is_pregnant=False,
        pregnancy_start_date=None,
        weeks_pregnant=None,
        due_date=None,
    )
