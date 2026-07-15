"""Storage helpers for menstruation gauge."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class MenstruationStorage:
    """Persist and load cycle history + symptom data."""

    def __init__(self, hass: HomeAssistant, key: str, legacy_key: str | None = None) -> None:
        self._store = Store(hass, STORAGE_VERSION, key)
        self._legacy_store = Store(hass, STORAGE_VERSION, legacy_key) if legacy_key else None

    async def async_load(self) -> dict:
        """Load data from storage."""
        data = await self._store.async_load()
        if not isinstance(data, dict) and self._legacy_store is not None:
            legacy_data = await self._legacy_store.async_load()
            if isinstance(legacy_data, dict):
                data = legacy_data

        if not isinstance(data, dict):
            return {"history": [], "period_duration_days": 5, "symptom_history": []}

        history = data.get("history", [])
        if not isinstance(history, list):
            history = []

        normalized = sorted({self._normalize_iso(raw) for raw in history if self._normalize_iso(raw)})
        days = data.get("period_duration_days", 5)
        try:
            days = int(days)
        except (TypeError, ValueError):
            days = 5
        days = max(1, min(14, days))

        symptom_history = data.get("symptom_history", [])
        if not isinstance(symptom_history, list):
            symptom_history = []

        return {"history": normalized, "period_duration_days": days, "symptom_history": self._normalize_symptoms(symptom_history)}

    async def async_save(self, history: Iterable[str], period_duration_days: int, symptom_history: list[dict[str, Any]] | None = None) -> None:
        """Save data to storage."""
        normalized = sorted({self._normalize_iso(raw) for raw in history if self._normalize_iso(raw)})
        days = max(1, min(14, int(period_duration_days)))
        symptoms = self._normalize_symptoms(symptom_history or [])
        await self._store.async_save({
            "history": normalized,
            "period_duration_days": days,
            "symptom_history": symptoms
        })

    @staticmethod
    def _normalize_iso(value: str) -> str | None:
        try:
            return date.fromisoformat(str(value)).isoformat()
        except ValueError:
            return None

    @staticmethod
    def _normalize_symptoms(symptoms: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize and deduplicate symptom entries by date."""
        seen: dict[str, dict[str, Any]] = {}
        for symptom in symptoms:
            if not isinstance(symptom, dict):
                continue
            date_str = symptom.get("date")
            if not date_str:
                continue
            try:
                normalized_date = date.fromisoformat(str(date_str)).isoformat()
                seen[normalized_date] = symptom
                seen[normalized_date]["date"] = normalized_date
            except ValueError:
                continue
        return sorted(seen.values(), key=lambda x: x.get("date", ""))
