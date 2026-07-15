"""Constants for the menstruation gauge integration."""

from __future__ import annotations

DOMAIN = "menstruation_gauge"
PLATFORMS = ["sensor"]

STORAGE_VERSION = 2
STORAGE_KEY = "menstruation_gauge.history"

CONF_NAME = "name"
CONF_PROFILE = "profile"
CONF_FRIENDLY_NAME = "friendly_name"
CONF_ICON = "icon"
CONF_PERIOD_DURATION_DAYS = "period_duration_days"

DEFAULT_NAME = "Menstruation"
DEFAULT_PERIOD_DURATION_DAYS = 5

ATTR_HISTORY = "history"
ATTR_SYMPTOM_HISTORY = "symptom_history"
ATTR_GROUPED_STARTS = "grouped_starts"
ATTR_BLEEDING_BLOCKS = "bleeding_blocks"
ATTR_NEXT_PREDICTED_START = "next_predicted_start"
ATTR_AVG_CYCLE_LENGTH = "avg_cycle_length"
ATTR_FERTILE_WINDOW_START = "fertile_window_start"
ATTR_FERTILE_WINDOW_END = "fertile_window_end"
ATTR_DAYS_UNTIL_NEXT_START = "days_until_next_start"
ATTR_PERIOD_DURATION_DAYS = "period_duration_days"
ATTR_IS_PREGNANT = "is_pregnant"
ATTR_PREGNANCY_START_DATE = "pregnancy_start_date"
ATTR_WEEKS_PREGNANT = "weeks_pregnant"
ATTR_DUE_DATE = "due_date"
ATTR_PREGNANCY_DATA = "pregnancy_data"

SERVICE_ADD_CYCLE_START = "add_cycle_start"
SERVICE_REMOVE_CYCLE_START = "remove_cycle_start"
SERVICE_SET_CYCLE_HISTORY = "set_cycle_history"
SERVICE_SET_PERIOD_DURATION = "set_period_duration"
SERVICE_ERASE_ALL_HISTORY = "erase_all_history"
SERVICE_EXPORT_HISTORY = "export_history"
SERVICE_REFRESH_CYCLE_MODEL = "refresh_cycle_model"
SERVICE_ADD_SYMPTOM = "add_symptom"
SERVICE_REMOVE_SYMPTOM = "remove_symptom"
SERVICE_GET_SYMPTOM = "get_symptom"
SERVICE_SET_PREGNANCY_MODE = "set_pregnancy_mode"
SERVICE_UPDATE_PREGNANCY_DATE = "update_pregnancy_date"

SERVICE_FIELD_DATE = "date"
SERVICE_FIELD_DATES = "dates"
SERVICE_FIELD_DAYS = "days"
SERVICE_FIELD_ERASE_ALL = "erase_all"
SERVICE_FIELD_FORMAT = "format"
SERVICE_FIELD_FILENAME = "filename"
SERVICE_FIELD_PROFILE = "profile"
SERVICE_FIELD_ENTRY_ID = "entry_id"
SERVICE_FIELD_ENTITY_ID = "entity_id"
SERVICE_FIELD_SYMPTOM_DATA = "symptom_data"
SERVICE_FIELD_IS_PREGNANT = "is_pregnant"
SERVICE_FIELD_PREGNANCY_START_DATE = "pregnancy_start_date"

SIGNAL_HISTORY_UPDATED = "menstruation_gauge_history_updated"

STATE_PERIOD = "period"
STATE_FERTILE = "fertile"
STATE_PMS = "pms"
STATE_NEUTRAL = "neutral"
STATE_PREGNANT = "pregnant"

# Symptom field definitions
SYMPTOM_BLEEDING_STRENGTH = "bleeding_strength"
SYMPTOM_SPOTTING = "spotting"
SYMPTOM_INTERCOURSE = "intercourse"
SYMPTOM_PAIN = "pain"
SYMPTOM_BASAL_TEMP = "basal_temp"
SYMPTOM_HYGIENE = "hygiene"
SYMPTOM_TEST = "test"

# Symptom options for reference (used in UI)
SYMPTOM_OPTIONS = {
    SYMPTOM_BLEEDING_STRENGTH: ["light", "medium", "heavy", "very_heavy"],
    SYMPTOM_SPOTTING: ["red", "brown"],
    SYMPTOM_INTERCOURSE: ["protected", "unprotected"],
    SYMPTOM_PAIN: ["mittelschmerz", "cramps", "tender_breasts", "headache", "migraine", "lower_back", "vulva"],
    SYMPTOM_HYGIENE: ["pad", "liner", "tampon", "cup", "period_underwear"],
    SYMPTOM_TEST: ["positive_ovulation", "negative_ovulation", "positive_pregnancy", "negative_pregnancy"],
}
