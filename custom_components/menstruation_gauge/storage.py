"""Storage helpers for menstruation gauge."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timezone
import math
import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


_PRODUCT_USAGE_PRODUCT_ALIASES: dict[str, str] = {
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


class MenstruationStorage:
    """Persist and load cycle history + symptom data + product usage + pregnancy data."""

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
                "symptom_history": [],
                "product_usage": [],
                "pregnancy_data": {"is_pregnant": False, "start_date": None},
                "menarche_data": {"tracking_active": False, "is_menarche": False, "menarche_date": None, "estimated_date": None, "family_menarche_age": None},
                "pre_menarche_data": {"signs": {}, "tanner_stage": None},
                "menopause_data": {"is_menopause": False, "start_date": None},
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

        menarche_data = data.get("menarche_data", {})
        if not isinstance(menarche_data, dict):
            menarche_data = {}
        menarche_data.setdefault("tracking_active", False)
        menarche_data.setdefault("is_menarche", False)
        menarche_data.setdefault("menarche_date", None)
        menarche_data.setdefault("estimated_date", None)
        menarche_data.setdefault("family_menarche_age", None)

        pre_menarche_data = data.get("pre_menarche_data", {})
        if not isinstance(pre_menarche_data, dict):
            pre_menarche_data = {}
        pre_menarche_data.setdefault("signs", {})
        pre_menarche_data.setdefault("tanner_stage", None)

        menopause_data = data.get("menopause_data", {})
        if not isinstance(menopause_data, dict):
            menopause_data = {}
        menopause_data.setdefault("is_menopause", False)
        menopause_data.setdefault("start_date", None)

        return {
            "history": normalized,
            "period_duration_days": days,
            "symptom_history": self._normalize_symptoms(symptom_history),
            "product_usage": self._normalize_product_usage(product_usage),
            "pregnancy_data": pregnancy_data,
            "menarche_data": menarche_data,
            "pre_menarche_data": pre_menarche_data,
            "menopause_data": menopause_data,
        }

    async def async_save(
        self,
        history: Iterable[str],
        period_duration_days: int,
        symptom_history: list[dict[str, Any]] | None = None,
        product_usage: list[dict[str, Any]] | None = None,
        pregnancy_data: dict[str, Any] | None = None,
        menarche_data: dict[str, Any] | None = None,
        pre_menarche_data: dict[str, Any] | None = None,
        menopause_data: dict[str, Any] | None = None,
    ) -> None:
        """Save data to storage."""
        normalized = sorted({self._normalize_iso(raw) for raw in history if self._normalize_iso(raw)})
        days = max(1, min(14, int(period_duration_days)))
        symptoms = self._normalize_symptoms(symptom_history or [])
        usage = self._normalize_product_usage(product_usage or [])
        preg_data = pregnancy_data or {"is_pregnant": False, "start_date": None}
        men_data = menarche_data or {"tracking_active": False, "is_menarche": False, "menarche_date": None, "estimated_date": None, "family_menarche_age": None}
        pre_men_data = pre_menarche_data or {"signs": {}, "tanner_stage": None}
        meno_data = menopause_data or {"is_menopause": False, "start_date": None}

        await self._store.async_save(
            {
                "history": normalized,
                "period_duration_days": days,
                "symptom_history": symptoms,
                "product_usage": usage,
                "pregnancy_data": preg_data,
                "menarche_data": men_data,
                "pre_menarche_data": pre_men_data,
                "menopause_data": meno_data,
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
            data.get("menarche_data"),
            data.get("pre_menarche_data"),
            data.get("menopause_data"),
        )

    async def async_load_pregnancy_data(self) -> dict[str, Any]:
        """Load only the pregnancy data block."""
        data = await self.async_load()
        return data["pregnancy_data"]

    async def async_save_pregnancy_data(self, pregnancy_data: dict[str, Any]) -> None:
        """Persist pregnancy data while preserving all other stored fields."""
        data = await self.async_load()
        await self.async_save(
            data["history"],
            data["period_duration_days"],
            data.get("symptom_history", []),
            data.get("product_usage", []),
            pregnancy_data,
            data.get("menarche_data"),
            data.get("pre_menarche_data"),
            data.get("menopause_data"),
        )

    async def async_load_menarche_data(self) -> dict[str, Any]:
        """Load only the menarche data block."""
        data = await self.async_load()
        return data["menarche_data"]

    async def async_save_menarche_data(self, menarche_data: dict[str, Any]) -> None:
        """Persist menarche data while preserving all other stored fields."""
        data = await self.async_load()
        await self.async_save(
            data["history"],
            data["period_duration_days"],
            data.get("symptom_history", []),
            data.get("product_usage", []),
            data.get("pregnancy_data"),
            menarche_data,
            data.get("pre_menarche_data"),
            data.get("menopause_data"),
        )

    @staticmethod
    def _normalize_iso(value: Any) -> str | None:
        if value in (None, ""):
            return None

        try:
            return date.fromisoformat(str(value)).isoformat()
        except ValueError:
            pass

        raw = str(value).strip()
        if not raw:
            return None

        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            pass

        try:
            numeric = float(raw)
        except ValueError:
            return None

        if not numeric.is_integer():
            return None

        try:
            timestamp = int(numeric)
            if abs(timestamp) >= 1_000_000_000_000:
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
        except (OverflowError, OSError, ValueError):
            return None

    @staticmethod
    def _normalize_product_usage_product(value: Any) -> str | None:
        raw = str(value or "").strip().lower()
        if not raw:
            return None
        normalized = raw.replace("-", "_")
        return _PRODUCT_USAGE_PRODUCT_ALIASES.get(normalized) or _PRODUCT_USAGE_PRODUCT_ALIASES.get(raw)

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
            if normalized_symptom.get("clots") != "yes":
                normalized_symptom.pop("clot_size", None)
            seen[normalized_date] = normalized_symptom
        return sorted(seen.values(), key=lambda item: item.get("date", ""))

    @staticmethod
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

    @staticmethod
    def _normalize_product_usage(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize product usage entries and drop invalid items."""
        normalized: list[dict[str, Any]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            date_str = (
                MenstruationStorage._normalize_iso(entry.get("date"))
                or MenstruationStorage._normalize_iso(entry.get("created_at"))
                or MenstruationStorage._normalize_iso(entry.get("logged_at"))
                or MenstruationStorage._normalize_iso(entry.get("timestamp"))
            )
            product = MenstruationStorage._normalize_product_usage_product(entry.get("product"))
            action = str(entry.get("action", "used")).strip().lower() or "used"

            if not date_str or not product:
                continue

            quantity = MenstruationStorage._coerce_quantity(entry.get("quantity", 1))

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
