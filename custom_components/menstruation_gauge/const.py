"""Constants for the menstruation gauge integration."""

from __future__ import annotations

DOMAIN = "menstruation_gauge"
PLATFORMS = ["sensor"]

STORAGE_VERSION = 1
STORAGE_KEY = "menstruation_gauge.history"

CONF_NAME = "name"
CONF_PROFILE = "profile"
CONF_FRIENDLY_NAME = "friendly_name"
CONF_ICON = "icon"
CONF_PERIOD_DURATION_DAYS = "period_duration_days"
CONF_PREGNANCY_ENABLED = "pregnancy_enabled"
CONF_PREGNANCY_START_DATE = "pregnancy_start_date"
CONF_PRE_MENARCHE_ENABLED = "pre_menarche_enabled"
CONF_ESTIMATED_MENARCHE_DATE = "estimated_menarche_date"
CONF_FAMILY_MENARCHE_AGE = "family_menarche_age"

DEFAULT_NAME = "Menstruation"
DEFAULT_PERIOD_DURATION_DAYS = 5

ATTR_HISTORY = "history"
ATTR_SYMPTOM_HISTORY = "symptom_history"
ATTR_PRODUCT_USAGE = "product_usage"
ATTR_GROUPED_STARTS = "grouped_starts"
ATTR_BLEEDING_BLOCKS = "bleeding_blocks"
ATTR_NEXT_PREDICTED_START = "next_predicted_start"
ATTR_AVG_CYCLE_LENGTH = "avg_cycle_length"
ATTR_FERTILE_WINDOW_START = "fertile_window_start"
ATTR_FERTILE_WINDOW_END = "fertile_window_end"
ATTR_OVULATION_DAY = "ovulation_day"
ATTR_DAYS_UNTIL_NEXT_START = "days_until_next_start"
ATTR_PERIOD_DURATION_DAYS = "period_duration_days"
ATTR_IS_PREGNANT = "is_pregnant"
ATTR_PREGNANCY_START_DATE = "pregnancy_start_date"
ATTR_WEEKS_PREGNANT = "weeks_pregnant"
ATTR_DUE_DATE = "due_date"
ATTR_PREGNANCY_DATA = "pregnancy_data"
ATTR_AWAITING_MENARCHE = "awaiting_menarche"
ATTR_ESTIMATED_MENARCHE_DATE = "estimated_menarche_date"
ATTR_DAYS_UNTIL_MENARCHE = "days_until_menarche"
ATTR_AGE_AT_TRACKING = "age_at_tracking"
ATTR_FAMILY_MENARCHE_AGE = "family_menarche_age"
ATTR_PRE_MENARCHE_DATA = "pre_menarche_data"

SERVICE_ADD_CYCLE_START = "add_cycle_start"
SERVICE_REMOVE_CYCLE_START = "remove_cycle_start"
SERVICE_SET_CYCLE_HISTORY = "set_cycle_history"
SERVICE_SET_PERIOD_DURATION = "set_period_duration"
SERVICE_ERASE_ALL_HISTORY = "erase_all_history"
SERVICE_EXPORT_HISTORY = "export_history"
SERVICE_REFRESH_CYCLE_MODEL = "refresh_cycle_model"
SERVICE_LOG_PRODUCT_USAGE = "log_product_usage"
SERVICE_MANAGE_HOUSEHOLD_INVENTORY = "manage_household_inventory"
SERVICE_ADD_SYMPTOM = "add_symptom"
SERVICE_REMOVE_SYMPTOM = "remove_symptom"
SERVICE_GET_SYMPTOM = "get_symptom"
SERVICE_SET_PREGNANCY_MODE = "set_pregnancy_mode"
SERVICE_UPDATE_PREGNANCY_DATE = "update_pregnancy_date"
SERVICE_SET_MENARCHE_MODE = "set_menarche_mode"
SERVICE_UPDATE_MENARCHE_DATE = "update_menarche_date"
SERVICE_GET_MENARCHE_INFO = "get_menarche_info"
SERVICE_ADD_PRE_MENARCHE_SIGN = "add_pre_menarche_sign"
SERVICE_REMOVE_PRE_MENARCHE_SIGN = "remove_pre_menarche_sign"
SERVICE_SAVE_TIMER_STATE = "save_timer_state"

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
SERVICE_FIELD_PRODUCT = "product"
SERVICE_FIELD_QUANTITY = "quantity"
SERVICE_FIELD_ACTION = "action"
SERVICE_FIELD_IS_PREGNANT = "is_pregnant"
SERVICE_FIELD_PREGNANCY_START_DATE = "pregnancy_start_date"
SERVICE_FIELD_ESTIMATED_MENARCHE_DATE = "estimated_menarche_date"
SERVICE_FIELD_FAMILY_MENARCHE_AGE = "family_menarche_age"
SERVICE_FIELD_PRE_MENARCHE_SIGN = "pre_menarche_sign"
SERVICE_FIELD_TANNER_STAGE = "tanner_stage"
SERVICE_FIELD_INVENTORY_ACTION = "inventory_action"
SERVICE_FIELD_WARNING_THRESHOLD = "warning_threshold"
SERVICE_FIELD_CRITICAL_THRESHOLD = "critical_threshold"
SERVICE_FIELD_MEMBER = "member"

SIGNAL_HISTORY_UPDATED = "menstruation_gauge_history_updated"

STATE_PERIOD = "period"
STATE_FERTILE = "fertile"
STATE_PMS = "pms"
STATE_NEUTRAL = "neutral"
STATE_PREGNANT = "pregnant"
STATE_PRE_MENARCHE = "pre_menarche"
STATE_MENARCHE = "menarche"

# Symptom field definitions
SYMPTOM_BLEEDING_STRENGTH = "bleeding_strength"
SYMPTOM_SPOTTING = "spotting"
SYMPTOM_INTERCOURSE = "intercourse"
SYMPTOM_PAIN = "pain"
SYMPTOM_BASAL_TEMP = "basal_temp"
SYMPTOM_HYGIENE = "hygiene"
SYMPTOM_TEST = "test"
SYMPTOM_CERVICAL_MUCUS = "cervical_mucus"
SYMPTOM_PREGNANCY = "pregnancy_symptoms"

# Symptom options for reference (used in UI)
SYMPTOM_OPTIONS = {
    SYMPTOM_BLEEDING_STRENGTH: ["light", "medium", "heavy", "very_heavy"],
    SYMPTOM_SPOTTING: ["red", "brown"],
    SYMPTOM_INTERCOURSE: ["protected", "unprotected"],
    SYMPTOM_PAIN: ["mittelschmerz", "cramps", "tender_breasts", "headache", "migraine", "lower_back", "vulva"],
    SYMPTOM_HYGIENE: ["pad", "liner", "tampon", "cup", "period_underwear"],
    SYMPTOM_TEST: ["positive_ovulation", "negative_ovulation", "positive_pregnancy", "negative_pregnancy"],
    SYMPTOM_CERVICAL_MUCUS: ["keinen", "klebrig", "cremig", "fadenziehend", "untypisch"],
    SYMPTOM_PREGNANCY: ["nausea", "fatigue", "heartburn", "swelling", "headache", "back_pain"],
}

# Pre-Menarche Body Signs - Tanner Stages
PRE_MENARCHE_SIGN_PUBIC_HAIR = "pubic_hair_growth"
PRE_MENARCHE_SIGN_BREAST = "breast_development"
PRE_MENARCHE_SIGN_HEIGHT_SPURT = "height_spurt"
PRE_MENARCHE_SIGN_MOOD = "mood_changes"
PRE_MENARCHE_SIGN_ACNE = "acne"
PRE_MENARCHE_SIGN_BODY_ODOR = "body_odor"
PRE_MENARCHE_SIGN_DISCHARGE = "vaginal_discharge"

# Tanner Stages (1-5) - Medical Standard
TANNER_STAGE_1 = "stage_1"      # Pre-puberty / Vorpupertät
TANNER_STAGE_2 = "stage_2"      # Early puberty / Frühe Pubertät
TANNER_STAGE_3 = "stage_3"      # Mid puberty / Mittlere Pubertät
TANNER_STAGE_4 = "stage_4"      # Late puberty / Späte Pubertät
TANNER_STAGE_5 = "stage_5"      # Adult / Erwachsenenalter

# Pre-Menarche Sign Options
PRE_MENARCHE_SIGN_OPTIONS = {
    PRE_MENARCHE_SIGN_PUBIC_HAIR: [TANNER_STAGE_1, TANNER_STAGE_2, TANNER_STAGE_3, TANNER_STAGE_4, TANNER_STAGE_5],
    PRE_MENARCHE_SIGN_BREAST: [TANNER_STAGE_1, TANNER_STAGE_2, TANNER_STAGE_3, TANNER_STAGE_4, TANNER_STAGE_5],
    PRE_MENARCHE_SIGN_HEIGHT_SPURT: ["none", "slight", "moderate", "significant"],
    PRE_MENARCHE_SIGN_MOOD: ["stable", "mild_changes", "noticeable_changes", "significant_changes"],
    PRE_MENARCHE_SIGN_ACNE: ["none", "slight", "moderate", "severe"],
    PRE_MENARCHE_SIGN_BODY_ODOR: ["none", "slight", "moderate", "strong"],
    PRE_MENARCHE_SIGN_DISCHARGE: ["none", "clear", "white", "clear_to_white"],
}

# Default age ranges for menarche (varies by population)
DEFAULT_MENARCHE_AGE_MIN = 9
DEFAULT_MENARCHE_AGE_MAX = 16
DEFAULT_MENARCHE_AGE_TYPICAL = 12
