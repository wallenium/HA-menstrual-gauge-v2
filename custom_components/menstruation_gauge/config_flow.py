"""Config flow for menstruation gauge."""

from __future__ import annotations

from datetime import date

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import slugify

from .const import (
    CONF_ESTIMATED_MENARCHE_DATE,
    CONF_FAMILY_MENARCHE_AGE,
    CONF_FRIENDLY_NAME,
    CONF_ICON,
    CONF_PERIOD_DURATION_DAYS,
    CONF_PRE_MENARCHE_ENABLED,
    CONF_PREGNANCY_ENABLED,
    CONF_PREGNANCY_START_DATE,
    CONF_PROFILE,
    DEFAULT_MENARCHE_AGE_MAX,
    DEFAULT_MENARCHE_AGE_MIN,
    DEFAULT_NAME,
    DEFAULT_PERIOD_DURATION_DAYS,
    DOMAIN,
    SIGNAL_HISTORY_UPDATED,
    STORAGE_KEY,
)


_INVALID_DATE_SENTINEL = "__invalid__"


def _parse_date_opt(value: str) -> str | None:
    """Return normalized ISO date string, None if empty, or _INVALID_DATE_SENTINEL if malformed."""
    if not value or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError:
        return _INVALID_DATE_SENTINEL


class MenstruationGaugeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for menstruation gauge."""

    VERSION = 2

    @staticmethod
    @config_entries.callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> MenstruationGaugeOptionsFlow:
        """Create the options flow."""
        return MenstruationGaugeOptionsFlow(config_entry)

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        """Handle first step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            profile = slugify(str(user_input[CONF_PROFILE])).strip("_")
            if not profile:
                errors[CONF_PROFILE] = "invalid_profile"
            else:
                await self.async_set_unique_id(profile)
                self._abort_if_unique_id_configured()
                friendly_name = str(user_input[CONF_FRIENDLY_NAME]).strip() or DEFAULT_NAME
                icon = str(user_input.get(CONF_ICON, "")).strip()
                data = {
                    CONF_PROFILE: profile,
                    CONF_FRIENDLY_NAME: friendly_name,
                    CONF_ICON: icon,
                }
                return self.async_create_entry(
                    title=friendly_name,
                    data=data,
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_PROFILE): str,
                vol.Required(CONF_FRIENDLY_NAME, default=DEFAULT_NAME): str,
                vol.Optional(CONF_ICON, default=""): str,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)


class MenstruationGaugeOptionsFlow(config_entries.OptionsFlow):
    """Handle options for menstruation gauge."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._entry = config_entry

    async def async_step_init(self, user_input: dict | None = None) -> FlowResult:
        """Manage the options."""
        from .storage import MenstruationStorage

        errors: dict[str, str] = {}

        # Resolve current runtime (may be absent during a reload)
        domain_data = self.hass.data.get(DOMAIN, {})
        runtime = domain_data.get(self._entry.entry_id)

        if runtime is not None:
            current_period_duration: int = runtime.period_duration_days
            current_friendly_name: str = runtime.friendly_name
            current_icon: str = runtime.icon
            pregnancy_data: dict = runtime.pregnancy_data
            menarche_data: dict = runtime.menarche_data
        else:
            # Fallback: load from storage when runtime is not yet available
            profile = slugify(str(self._entry.data.get(CONF_PROFILE, ""))).strip("_") or "default"
            storage = MenstruationStorage(
                self.hass,
                key=f"{STORAGE_KEY}.{profile}",
                legacy_key=STORAGE_KEY if profile == "default" else None,
            )
            stored = await storage.async_load()
            current_period_duration = stored.get("period_duration_days", DEFAULT_PERIOD_DURATION_DAYS)
            current_friendly_name = str(self._entry.data.get(CONF_FRIENDLY_NAME, DEFAULT_NAME))
            current_icon = str(self._entry.data.get(CONF_ICON, ""))
            pregnancy_data = stored.get("pregnancy_data", {"is_pregnant": False, "start_date": None})
            menarche_data = stored.get(
                "menarche_data",
                {
                    "tracking_active": False,
                    "is_menarche": False,
                    "menarche_date": None,
                    "estimated_date": None,
                    "family_menarche_age": None,
                },
            )

        if user_input is not None:
            # Validate optional date fields
            preg_date_raw = str(user_input.get(CONF_PREGNANCY_START_DATE, "")).strip()
            men_date_raw = str(user_input.get(CONF_ESTIMATED_MENARCHE_DATE, "")).strip()

            preg_date_parsed = _parse_date_opt(preg_date_raw)
            men_date_parsed = _parse_date_opt(men_date_raw)

            if preg_date_parsed is _INVALID_DATE_SENTINEL:
                errors[CONF_PREGNANCY_START_DATE] = "invalid_date"
            if men_date_parsed is _INVALID_DATE_SENTINEL:
                errors[CONF_ESTIMATED_MENARCHE_DATE] = "invalid_date"

            # Validate family menarche age
            family_age_raw = str(user_input.get(CONF_FAMILY_MENARCHE_AGE, "")).strip()
            new_family_menarche_age: int | None = None
            if family_age_raw:
                try:
                    new_family_menarche_age = int(family_age_raw)
                    if not (DEFAULT_MENARCHE_AGE_MIN <= new_family_menarche_age <= DEFAULT_MENARCHE_AGE_MAX):
                        errors[CONF_FAMILY_MENARCHE_AGE] = "invalid_menarche_age"
                        new_family_menarche_age = None
                except ValueError:
                    errors[CONF_FAMILY_MENARCHE_AGE] = "invalid_menarche_age"

            if not errors:
                new_friendly_name = str(user_input.get(CONF_FRIENDLY_NAME, DEFAULT_NAME)).strip() or DEFAULT_NAME
                new_icon = str(user_input.get(CONF_ICON, "")).strip()
                new_period_duration = max(1, min(14, int(user_input.get(CONF_PERIOD_DURATION_DAYS, DEFAULT_PERIOD_DURATION_DAYS))))
                pregnancy_enabled = bool(user_input.get(CONF_PREGNANCY_ENABLED, False))
                pre_menarche_enabled = bool(user_input.get(CONF_PRE_MENARCHE_ENABLED, False))

                # Auto-populate pregnancy start date from last cycle if not provided
                new_preg_start: str | None = preg_date_parsed if preg_date_parsed is not _INVALID_DATE_SENTINEL else None
                if pregnancy_enabled and not new_preg_start and runtime and runtime.history:
                    new_preg_start = sorted(runtime.history)[-1]

                new_pregnancy_data = {
                    "is_pregnant": pregnancy_enabled,
                    "start_date": new_preg_start,
                }
                new_menarche_data = {
                    "tracking_active": pre_menarche_enabled,
                    "is_menarche": menarche_data.get("is_menarche", False),
                    "menarche_date": menarche_data.get("menarche_date"),
                    "estimated_date": men_date_parsed if men_date_parsed is not _INVALID_DATE_SENTINEL else None,
                    "family_menarche_age": new_family_menarche_age,
                }

                if runtime is not None:
                    # Update in-memory runtime
                    runtime.friendly_name = new_friendly_name
                    runtime.icon = new_icon
                    runtime.period_duration_days = new_period_duration
                    runtime.pregnancy_data = new_pregnancy_data
                    runtime.menarche_data = new_menarche_data

                    # Persist to storage
                    await runtime.storage.async_save(
                        runtime.history,
                        runtime.period_duration_days,
                        runtime.symptom_history,
                        runtime.product_usage,
                        runtime.pregnancy_data,
                        runtime.menarche_data,
                        runtime.pre_menarche_data,
                    )
                    async_dispatcher_send(self.hass, SIGNAL_HISTORY_UPDATED)
                else:
                    # Runtime unavailable – save directly to storage
                    profile = slugify(str(self._entry.data.get(CONF_PROFILE, ""))).strip("_") or "default"
                    fallback_storage = MenstruationStorage(
                        self.hass,
                        key=f"{STORAGE_KEY}.{profile}",
                        legacy_key=STORAGE_KEY if profile == "default" else None,
                    )
                    stored_full = await fallback_storage.async_load()
                    await fallback_storage.async_save(
                        stored_full["history"],
                        new_period_duration,
                        stored_full.get("symptom_history", []),
                        stored_full.get("product_usage", []),
                        new_pregnancy_data,
                        new_menarche_data,
                        stored_full.get("pre_menarche_data"),
                    )

                # Keep entry.data in sync for basic info fields
                self.hass.config_entries.async_update_entry(
                    self._entry,
                    data={
                        **self._entry.data,
                        CONF_FRIENDLY_NAME: new_friendly_name,
                        CONF_ICON: new_icon,
                    },
                    title=new_friendly_name,
                )

                return self.async_create_entry(title="", data={})

        # Build schema pre-filled with current values
        schema = vol.Schema(
            {
                vol.Required(CONF_FRIENDLY_NAME, default=current_friendly_name): str,
                vol.Optional(CONF_ICON, default=current_icon): str,
                vol.Required(
                    CONF_PERIOD_DURATION_DAYS,
                    default=current_period_duration,
                ): vol.All(vol.Coerce(int), vol.Range(min=1, max=14)),
                vol.Optional(
                    CONF_PREGNANCY_ENABLED,
                    default=bool(pregnancy_data.get("is_pregnant", False)),
                ): bool,
                vol.Optional(
                    CONF_PREGNANCY_START_DATE,
                    default=pregnancy_data.get("start_date") or "",
                ): str,
                vol.Optional(
                    CONF_PRE_MENARCHE_ENABLED,
                    default=bool(menarche_data.get("tracking_active", False)),
                ): bool,
                vol.Optional(
                    CONF_ESTIMATED_MENARCHE_DATE,
                    default=menarche_data.get("estimated_date") or "",
                ): str,
                vol.Optional(
                    CONF_FAMILY_MENARCHE_AGE,
                    default=str(menarche_data.get("family_menarche_age") or ""),
                ): str,
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
