"""Storage helpers for menstruation gauge."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class MenstruationStorage:
    """Persist and load cycle history + symptom data + product usage + pregnancy data."""

    def __init__(self, hass: HomeAssistant, key: str, legacy_key: str | None = None) -> None:
        self._store = Store(
            hass,
            STORAGE_VERSION,
            key,
            minor_version_changed_func=self._async_migrate_data,
        )
        self._legacy_store = Store(hass, STORAGE_VERSION, legacy_key) if legacy_key else None

    async def async_load(self) -> dict:
        """Load data from storage."""
        data = await self._store.async_load()
        if not isinstance(data, dict) and self._legacy_store is not None:
            legacy_data = await self._legacy_store.async_load()
            if isinstance(legacy_data, dict):
                data = legacy_data

        if not isinstance(data, dict):
            return {
                "history": [],
                "period_duration_days": 5,
                "symptom_history": [],
                "product_usage": [],
                "pregnancy_data": {"is_pregnant": False, "start_date": None},
            }

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

        product_usage = data.get("product_usage", [])
        if not isinstance(product_usage, list):
            product_usage = []

        pregnancy_data = data.get("pregnancy_data", {})
        if not isinstance(pregnancy_data, dict):
            pregnancy_data = {}
        pregnancy_data.setdefault("is_pregnant", False)
        pregnancy_data.setdefault("start_date", None)

        return {
            "history": normalized,
            "period_duration_days": days,
            "symptom_history": self._normalize_symptoms(symptom_history),
            "product_usage": self._normalize_product_usage(product_usage),
            "pregnancy_data": pregnancy_data,
        }

    async def async_save(
        self,
        history: Iterable[str],
        period_duration_days: int,
        symptom_history: list[dict[str, Any]] | None = None,
        product_usage: list[dict[str, Any]] | None = None,
        pregnancy_data: dict[str, Any] | None = None,
    ) -> None:
        """Save data to storage."""
        normalized = sorted({self._normalize_iso(raw) for raw in history if self._normalize_iso(raw)})
        days = max(1, min(14, int(period_duration_days)))
        symptoms = self._normalize_symptoms(symptom_history or [])
        usage = self._normalize_product_usage(product_usage or [])
        preg_data = pregnancy_data or {"is_pregnant": False, "start_date": None}

        await self._store.async_save(
            {
                "history": normalized,
                "period_duration_days": days,
                "symptom_history": symptoms,
                "product_usage": usage,
                "pregnancy_data": preg_data,
            }
        )

    async def async_load_product_usage(self) -> list[dict[str, Any]]:
        """Load only normalized product usage history."""
        data = await self.async_load()
        return data["product_usage"]

    async def async_save_product_usage(self, product_usage: list[dict[str, Any]]) -> None:
        """Persist product usage while preserving the remaining stored fields."""
        data = await self.async_load()
        await self.async_save(
            data["history"],
            data["period_duration_days"],
            data.get("symptom_history", []),
            product_usage,
            data.get("pregnancy_data"),
        )

    @staticmethod
    async def _async_migrate_data(version: int, minor_version: int, data: dict[str, Any]) -> dict[str, Any]:
        """Migrate stored payloads to the current schema."""
        if version <= 2:
            if "symptom_history" not in data:
                data["symptom_history"] = []
            if "product_usage" not in data:
                data["product_usage"] = []
            if "pregnancy_data" not in data:
                data["pregnancy_data"] = {"is_pregnant": False, "start_date": None}
        return data

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
            except ValueError:
                continue
            normalized_symptom = dict(symptom)
            normalized_symptom["date"] = normalized_date
            seen[normalized_date] = normalized_symptom
        return sorted(seen.values(), key=lambda item: item.get("date", ""))

    @staticmethod
    def _normalize_product_usage(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize product usage entries and drop invalid items."""
        normalized: list[dict[str, Any]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            date_str = MenstruationStorage._normalize_iso(entry.get("date"))
            product = str(entry.get("product", "")).strip().lower()
            action = str(entry.get("action", "used")).strip().lower() or "used"

            if not date_str or not product:
                continue

            try:
                quantity = max(1, int(entry.get("quantity", 1)))
            except (TypeError, ValueError):
                quantity = 1

            normalized_entry: dict[str, Any] = {
                "date": date_str,
                "product": product,
                "quantity": quantity,
                "action": action,
            }

            cycle_day = entry.get("cycle_day")
            try:
                if cycle_day is not None:
                    normalized_entry["cycle_day"] = max(1, int(cycle_day))
            except (TypeError, ValueError):
                pass

            notes = entry.get("notes")
            if isinstance(notes, str) and notes.strip():
                normalized_entry["notes"] = notes.strip()

            normalized.append(normalized_entry)

        return sorted(
            normalized,
            key=lambda item: (item.get("date", ""), item.get("product", ""), item.get("action", "")),
        )
