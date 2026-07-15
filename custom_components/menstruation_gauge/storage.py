"""Storage helpers for menstruation gauge."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class MenstruationStorage:
    """Persist and load cycle history + settings + product usage."""

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
            return {
                "history": [],
                "period_duration_days": 5,
                "product_usage": [],
            }

        # Perform migrations
        data = self._migrate_data(data)

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

        product_usage = data.get("product_usage", [])
        if not isinstance(product_usage, list):
            product_usage = []

        return {
            "history": normalized,
            "period_duration_days": days,
            "product_usage": self._normalize_product_usage(product_usage),
        }

    async def async_save(
        self,
        history: Iterable[str],
        period_duration_days: int,
        product_usage: list[dict[str, Any]] | None = None,
    ) -> None:
        """Save data to storage."""
        normalized = sorted({self._normalize_iso(raw) for raw in history if self._normalize_iso(raw)})
        days = max(1, min(14, int(period_duration_days)))
        prod_usage = self._normalize_product_usage(product_usage or [])

        await self._store.async_save(
            {
                "history": normalized,
                "period_duration_days": days,
                "product_usage": prod_usage,
            }
        )

    async def async_save_product_usage(
        self,
        date_str: str,
        product: str,
        quantity: int | None = None,
        action: str | None = None,
        cycle_day: int | None = None,
        notes: str | None = None,
    ) -> None:
        """Save product usage entry."""
        data = await self.async_load()

        usage_entry = {
            "date": date_str,
            "product": product,
        }

        if quantity is not None:
            usage_entry["quantity"] = quantity
        if action is not None:
            usage_entry["action"] = action
        if cycle_day is not None:
            usage_entry["cycle_day"] = cycle_day
        if notes is not None:
            usage_entry["notes"] = notes

        data["product_usage"].append(usage_entry)

        await self.async_save(
            history=data["history"],
            period_duration_days=data["period_duration_days"],
            product_usage=data["product_usage"],
        )

    @staticmethod
    def _migrate_data(data: dict[str, Any]) -> dict[str, Any]:
        """Migrate data from old versions to current version."""
        # Add product_usage field if missing
        if "product_usage" not in data:
            data["product_usage"] = []

        return data

    @staticmethod
    def _normalize_iso(value: str) -> str | None:
        try:
            return date.fromisoformat(str(value)).isoformat()
        except ValueError:
            return None

    @staticmethod
    def _normalize_product_usage(product_usage: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize product usage entries."""
        normalized = []
        for usage in product_usage:
            if not isinstance(usage, dict):
                continue
            date_str = usage.get("date")
            product = usage.get("product")
            if not date_str or not product:
                continue
            try:
                normalized_date = date.fromisoformat(str(date_str)).isoformat()
                entry = {
                    "date": normalized_date,
                    "product": product,
                }
                if "quantity" in usage:
                    entry["quantity"] = usage["quantity"]
                if "action" in usage:
                    entry["action"] = usage["action"]
                if "cycle_day" in usage:
                    entry["cycle_day"] = usage["cycle_day"]
                if "notes" in usage:
                    entry["notes"] = usage["notes"]
                normalized.append(entry)
            except ValueError:
                continue
        return sorted(normalized, key=lambda x: x.get("date", ""))
