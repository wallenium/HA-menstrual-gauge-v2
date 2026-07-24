class MenstruationCalendarCard extends HTMLElement {
  constructor() {
    super();
    this._viewDate = new Date();
    this._modalIso = null;
    this._focusedIso = null;
  }

  static getConfigElement() {
    return document.createElement('menstruation-calendar-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:menstruation-calendar-card',
      entity: 'sensor.menstruation',
      entry_id: '',
      title: 'Cycle Calendar',
      show_fertile_period: true,
      show_ovulation_marker: true,
      show_cycle_day_numbers: false,
      week_start: 'monday',
      show_predicted_cycles: true,
      num_predicted_cycles: 6,
    };
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      title: 'Cycle Calendar',
      show_fertile_period: true,
      show_ovulation_marker: true,
      show_cycle_day_numbers: false,
      week_start: 'monday',
      show_predicted_cycles: true,
      num_predicted_cycles: 6,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // Don't re-render while the symptom modal is open to preserve user input.
    if (this._modalIso) return;
    this._render();
  }

  getCardSize() {
    return 5;
  }

  _lang() {
    const language = String(this._hass?.locale?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        title: 'Zykluskalender',
        today: 'Heute',
        previous_month: 'Vorheriger Monat',
        next_month: 'Nächster Monat',
        cycle_day: 'Zyklustag',
        day_of_cycle: 'Tag',
        of_cycle: 'des Zyklus',
        no_data: 'Keine Daten',
        edit_symptoms: 'Symptome bearbeiten',
        save: 'Speichern',
        close: 'Schließen',
        bleeding_strength: 'Blutungsstärke',
        spotting: 'Schmierblutung',
        pain: 'Schmerzen',
        none: 'Kein',
        predicted: 'Vorhergesagt',
        predicted_period: 'Vorhergesagte Periode',
        modal_edit_day: 'Tag bearbeiten',
        period_toggle: 'Periode',
        period_start: 'Periode Start',
        log_today: 'Heute loggen',
        cancel: 'Abbrechen',
        basal_temp_label: 'Basaltemperatur (°C)',
        cat_bleeding_strength: 'Blutungsstärke',
        cat_spotting: 'Schmierblutung',
        cat_discharge: 'Ausfluss',
        cat_intercourse: 'Geschlechtsverkehr',
        cat_pain: 'Schmerzen',
        cat_hygiene: 'Hygiene',
        cat_test: 'Test',
        cat_cervical_mucus: 'Zervixschleim',
        cat_smell: 'Geruch',
        cat_clots: 'Klumpen',
        cat_clot_size: 'Klumpengröße',
        cat_bleeding_type: 'Blutungstyp',
        cat_cervix_position: 'Zervixposition',
        cat_cervix_texture: 'Zervixbeschaffenheit',
        cat_libido: 'Libido',
        cat_training_intensity: 'Trainingsintensität',
        cat_pregnancy_symptoms: 'Schwangerschaft',
        opt_light: 'Gering',
        opt_medium: 'Mittel',
        opt_heavy: 'Stark',
        opt_very_heavy: 'Sehr stark',
        opt_none: 'Keine',
        opt_red: 'Rot',
        opt_brown: 'Braun',
        opt_reddish: 'Rötlich',
        opt_white: 'Weiß',
        opt_clear: 'Klar',
        opt_other: 'Sonstiges',
        opt_protected: 'Geschützt',
        opt_unprotected: 'Ungeschützt',
        opt_mittelschmerz: 'Mittelschmerz',
        opt_cramps: 'Krämpfe',
        opt_tender_breasts: 'Brustspannung',
        opt_headache: 'Kopfschmerz',
        opt_migraine: 'Migräne',
        opt_lower_back: 'Rückenschmerzen',
        opt_vulva: 'Vulvaschmerz',
        opt_pad: 'Binde',
        opt_liner: 'Slipeinlage',
        opt_tampon: 'Tampon',
        opt_cup: 'Menstruationstasse',
        opt_period_underwear: 'Periodenunterwäsche',
        opt_positive_ovulation: 'LH positiv',
        opt_negative_ovulation: 'LH negativ',
        opt_positive_pregnancy: 'Schwangerschaft +',
        opt_negative_pregnancy: 'Schwangerschaft -',
        opt_keinen: 'Keinen',
        opt_klebrig: 'Klebrig',
        opt_cremig: 'Cremig',
        opt_fadenziehend: 'Fadenziehend',
        opt_untypisch: 'Untypisch',
        opt_normal: 'Normal',
        opt_inconspicuous: 'Unauffällig',
        opt_unpleasant: 'Unangenehm',
        opt_fishy: 'Fischartig',
        opt_yes: 'Ja',
        opt_no: 'Nein',
        opt_small: 'Klein',
        opt_large: 'Groß',
        opt_continuous: 'Kontinuierlich',
        opt_intermittent: 'Intermittierend',
        opt_drops: 'Tropfen',
        opt_cervix_high: 'Oben',
        opt_cervix_mid: 'Mitte',
        opt_cervix_low: 'Unten',
        opt_firm: 'Hart',
        opt_soft: 'Weich',
        opt_open: 'Offen',
        opt_libido_low: 'Niedrig',
        opt_libido_high: 'Erhöht',
        opt_training_light: 'Leicht',
        opt_training_moderate: 'Moderat',
        opt_training_intense: 'Intensiv',
        opt_nausea: 'Übelkeit',
        opt_fatigue: 'Müdigkeit',
        opt_heartburn: 'Sodbrennen',
        opt_swelling: 'Schwellungen',
        opt_back_pain: 'Rückenschmerz',
        opt_preg_nausea: 'Übelkeit',
        opt_preg_fatigue: 'Erschöpfung',
        opt_preg_heartburn: 'Sodbrennen',
        opt_preg_swelling: 'Schwellungen',
        opt_preg_mood_swings: 'Stimmungsschwankungen',
        opt_preg_frequent_urination: 'Häufiges Wasserlassen',
        opt_preg_braxton_hicks: 'Braxton-Hicks',
        opt_preg_back_pain: 'Rückenschmerzen',
        discharge: 'Ausfluss',
        yes: 'Ja',
        no: 'Nein',
        continue: 'Weiter',
      },
      en: {
        title: 'Cycle Calendar',
        today: 'Today',
        previous_month: 'Previous month',
        next_month: 'Next month',
        cycle_day: 'Cycle day',
        day_of_cycle: 'Day',
        of_cycle: 'of cycle',
        no_data: 'No data',
        edit_symptoms: 'Edit symptoms',
        save: 'Save',
        close: 'Close',
        bleeding_strength: 'Bleeding strength',
        spotting: 'Spotting',
        pain: 'Pain',
        none: 'None',
        predicted: 'Predicted',
        predicted_period: 'Predicted period',
        modal_edit_day: 'Edit Day',
        period_toggle: 'Period',
        period_start: 'Period Start',
        log_today: 'Log Today',
        cancel: 'Cancel',
        basal_temp_label: 'Basal Temperature (°C)',
        cat_bleeding_strength: 'Bleeding Strength',
        cat_spotting: 'Spotting',
        cat_discharge: 'Discharge',
        cat_intercourse: 'Intercourse',
        cat_pain: 'Pain',
        cat_hygiene: 'Hygiene',
        cat_test: 'Test',
        cat_cervical_mucus: 'Cervical Mucus',
        cat_smell: 'Smell',
        cat_clots: 'Clots',
        cat_clot_size: 'Clot Size',
        cat_bleeding_type: 'Bleeding Type',
        cat_cervix_position: 'Cervix Position',
        cat_cervix_texture: 'Cervix Texture',
        cat_libido: 'Libido',
        cat_training_intensity: 'Training Intensity',
        cat_pregnancy_symptoms: 'Pregnancy',
        opt_light: 'Light',
        opt_medium: 'Medium',
        opt_heavy: 'Heavy',
        opt_very_heavy: 'Very Heavy',
        opt_none: 'None',
        opt_red: 'Red',
        opt_brown: 'Brown',
        opt_reddish: 'Reddish',
        opt_white: 'White',
        opt_clear: 'Clear',
        opt_other: 'Other',
        opt_protected: 'Protected',
        opt_unprotected: 'Unprotected',
        opt_mittelschmerz: 'Mittelschmerz',
        opt_cramps: 'Cramps',
        opt_tender_breasts: 'Tender Breasts',
        opt_headache: 'Headache',
        opt_migraine: 'Migraine',
        opt_lower_back: 'Lower Back Pain',
        opt_vulva: 'Vulva Pain',
        opt_pad: 'Pad',
        opt_liner: 'Liner',
        opt_tampon: 'Tampon',
        opt_cup: 'Cup',
        opt_period_underwear: 'Period Underwear',
        opt_positive_ovulation: 'LH Positive',
        opt_negative_ovulation: 'LH Negative',
        opt_positive_pregnancy: 'Pregnancy +',
        opt_negative_pregnancy: 'Pregnancy -',
        opt_keinen: 'None',
        opt_klebrig: 'Sticky',
        opt_cremig: 'Creamy',
        opt_fadenziehend: 'Stretchy',
        opt_untypisch: 'Atypical',
        opt_normal: 'Normal',
        opt_inconspicuous: 'Inconspicuous',
        opt_unpleasant: 'Unpleasant',
        opt_fishy: 'Fishy',
        opt_yes: 'Yes',
        opt_no: 'No',
        opt_small: 'Small',
        opt_large: 'Large',
        opt_continuous: 'Continuous',
        opt_intermittent: 'Intermittent',
        opt_drops: 'Drops',
        opt_cervix_high: 'High',
        opt_cervix_mid: 'Mid',
        opt_cervix_low: 'Low',
        opt_firm: 'Firm',
        opt_soft: 'Soft',
        opt_open: 'Open',
        opt_libido_low: 'Low',
        opt_libido_high: 'High',
        opt_training_light: 'Light',
        opt_training_moderate: 'Moderate',
        opt_training_intense: 'Intense',
        opt_nausea: 'Nausea',
        opt_fatigue: 'Fatigue',
        opt_heartburn: 'Heartburn',
        opt_swelling: 'Swelling',
        opt_back_pain: 'Back Pain',
        opt_preg_nausea: 'Nausea',
        opt_preg_fatigue: 'Fatigue',
        opt_preg_heartburn: 'Heartburn',
        opt_preg_swelling: 'Swelling',
        opt_preg_mood_swings: 'Mood Swings',
        opt_preg_frequent_urination: 'Frequent Urination',
        opt_preg_braxton_hicks: 'Braxton Hicks',
        opt_preg_back_pain: 'Back Pain',
        discharge: 'Discharge',
        yes: 'Yes',
        no: 'No',
        continue: 'Continue',
      },
    };
    return (i18n[this._lang()]?.[key]) ?? (i18n.en[key] ?? key);
  }

  _normalizeISO(value) {
    const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s].*)/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  _parseISO(iso) {
    const n = this._normalizeISO(iso);
    if (!n) return null;
    const [y, m, d] = n.split('-').map((x) => Number(x));
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  _isoFromDate(dt) {
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _addDaysToISO(iso, days) {
    const dt = this._parseISO(iso);
    if (!dt) return null;
    return this._isoFromDate(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + days, 12, 0, 0, 0));
  }

  _dayDiff(aIso, bIso) {
    const a = this._parseISO(aIso);
    const b = this._parseISO(bIso);
    if (!a || !b) return 0;
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  _resolveEntityId() {
    const states = this._hass?.states || {};
    const configuredEntity = String(this._config?.entity || '').trim();
    if (configuredEntity && states[configuredEntity]) return configuredEntity;

    const targetEntryId = String(this._config?.entry_id || '').trim();
    if (targetEntryId) {
      const match = Object.keys(states).find((entityId) => states[entityId]?.attributes?.entry_id === targetEntryId);
      if (match) return match;
    }

    return configuredEntity || null;
  }

  _weekdayLabels(locale) {
    const weekStart = String(this._config?.week_start || 'monday').toLowerCase();
    const isSundayFirst = weekStart === 'sunday';
    const start = isSundayFirst
      ? new Date(Date.UTC(2026, 0, 4))
      : new Date(Date.UTC(2026, 0, 5));
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const label = formatter.format(d).replace('.', '').trim();
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  }

  _monthLabel(locale) {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(this._viewDate);
  }

  _allCycleStarts(attrs) {
    const grouped = Array.isArray(attrs?.grouped_starts) ? attrs.grouped_starts : [];
    const predicted = Array.isArray(attrs?.predicted_cycle_starts) ? attrs.predicted_cycle_starts : [];
    const nextPredicted = attrs?.next_predicted_start ? [attrs.next_predicted_start] : [];
    const combined = [...grouped, ...predicted, ...nextPredicted]
      .map((iso) => this._normalizeISO(iso))
      .filter(Boolean);
    return Array.from(new Set(combined)).sort();
  }

  _periodHistorySet(attrs) {
    const history = Array.isArray(attrs?.history) ? attrs.history : [];
    return new Set(history.map((iso) => this._normalizeISO(iso)).filter(Boolean));
  }

  _actualCycleStarts(attrs) {
    const grouped = Array.isArray(attrs?.grouped_starts) ? attrs.grouped_starts : [];
    return grouped.map((iso) => this._normalizeISO(iso)).filter(Boolean).sort();
  }

  _predictedCycleStartsList(attrs) {
    const predicted = Array.isArray(attrs?.predicted_cycle_starts) ? attrs.predicted_cycle_starts : [];
    const nextPredicted = attrs?.next_predicted_start ? [attrs.next_predicted_start] : [];
    const combined = [...predicted, ...nextPredicted]
      .map((iso) => this._normalizeISO(iso))
      .filter(Boolean);
    return Array.from(new Set(combined)).sort();
  }

  _periodDurationDays(attrs) {
    const val = Number(attrs?.period_duration_days);
    if (Number.isFinite(val) && val >= 1 && val <= 14) return Math.round(val);
    return 5;
  }

  _predictedPeriodSet(predictedStarts, periodDuration) {
    const set = new Set();
    predictedStarts.forEach((startIso) => {
      for (let d = 0; d < periodDuration; d += 1) {
        const dayIso = this._addDaysToISO(startIso, d);
        if (dayIso) set.add(dayIso);
      }
    });
    return set;
  }

  _effectiveCycleLength(attrs) {
    const val = Number(attrs?.avg_cycle_length);
    if (Number.isFinite(val) && val >= 20 && val <= 60) return Math.round(val);
    return 28;
  }

  _windowForCycleStart(cycleStartIso, nextCycleStartIso, avgCycleLength) {
    if (!cycleStartIso) return null;
    let cycleLen = avgCycleLength;
    if (nextCycleStartIso) {
      const len = this._dayDiff(nextCycleStartIso, cycleStartIso);
      if (len >= 20 && len <= 60) cycleLen = len;
    }
    const cl = Math.max(20, Math.min(60, Math.round(cycleLen) || 28));
    const ovulationOffset = Math.floor(cl / 2) - 1;
    return {
      fertileStart: this._addDaysToISO(cycleStartIso, ovulationOffset - 5),
      fertileEnd: this._addDaysToISO(cycleStartIso, ovulationOffset + 1),
      ovulationDay: this._addDaysToISO(cycleStartIso, ovulationOffset),
    };
  }

  _cycleStartForDate(iso, starts) {
    let found = null;
    for (let i = 0; i < starts.length; i += 1) {
      if (this._dayDiff(iso, starts[i]) >= 0) found = starts[i];
      else break;
    }
    return found;
  }

  _statusForDay(iso, ctx) {
    const isPeriod = ctx.periodSet.has(iso);
    const isPredictedPeriod = !isPeriod && (ctx.predictedPeriodSet?.has(iso) ?? false);
    let isFertile = false;
    let isOvulation = false;
    let isPredictedFertile = false;
    let isPredictedOvulation = false;

    const cycleStart = this._cycleStartForDate(iso, ctx.starts);
    if (cycleStart) {
      const idx = ctx.starts.indexOf(cycleStart);
      const next = idx >= 0 ? ctx.starts[idx + 1] : null;
      const window = this._windowForCycleStart(cycleStart, next, ctx.avgCycleLength);
      if (window) {
        const inFertile = this._dayDiff(iso, window.fertileStart) >= 0 && this._dayDiff(window.fertileEnd, iso) >= 0;
        const inOvulation = iso === window.ovulationDay;
        if (ctx.predictedStartSet?.has(cycleStart)) {
          isPredictedFertile = inFertile;
          isPredictedOvulation = inOvulation;
        } else {
          isFertile = inFertile;
          isOvulation = inOvulation;
        }
      }
    }

    if (!isOvulation && ctx.sensorOvulation && iso === ctx.sensorOvulation) {
      isOvulation = true;
    }
    if (!isFertile && ctx.sensorFertileStart && ctx.sensorFertileEnd) {
      isFertile = this._dayDiff(iso, ctx.sensorFertileStart) >= 0 && this._dayDiff(ctx.sensorFertileEnd, iso) >= 0;
    }

    const cycleDay = cycleStart ? this._dayDiff(iso, cycleStart) + 1 : null;
    return { isPeriod, isFertile, isOvulation, cycleDay, isPredictedPeriod, isPredictedFertile, isPredictedOvulation };
  }

  _buildModel() {
    const entityId = this._resolveEntityId();
    const stateObj = this._hass?.states?.[entityId];
    if (!stateObj) return { missing: true, entityId };

    const attrs = stateObj.attributes || {};
    const actualStarts = this._actualCycleStarts(attrs);
    const allPredictedStarts = this._predictedCycleStartsList(attrs);

    const showPredicted = this._config?.show_predicted_cycles !== false;
    const numPredicted = Math.max(1, Math.min(12, Number(this._config?.num_predicted_cycles || 6)));
    const limitedPredictedStarts = showPredicted ? allPredictedStarts.slice(0, numPredicted) : [];

    const starts = Array.from(new Set([...actualStarts, ...limitedPredictedStarts])).sort();
    const avgCycleLength = this._effectiveCycleLength(attrs);
    const periodDuration = this._resolvePeriodDuration(attrs);
    const predictedStartSet = new Set(limitedPredictedStarts);
    const predictedPeriodSet = this._predictedPeriodSet(limitedPredictedStarts, periodDuration);

    // Normalize history for confirmed-set tracking
    const history = Array.isArray(attrs.history)
      ? attrs.history.map((x) => this._normalizeISO(x)).filter(Boolean)
      : [];
    const confirmedSet = new Set(history);

    const pregnancyInfo = this._resolvePregnancyInfo({ state: stateObj.state, ...attrs });
    const currentBleedingBlock = attrs.current_bleeding_block && typeof attrs.current_bleeding_block === 'object'
      ? attrs.current_bleeding_block
      : null;

    return {
      missing: false,
      entityId,
      stateObj,
      attrs,
      state: String(stateObj.state || 'neutral'),
      starts,
      avgCycleLength,
      periodSet: this._periodHistorySet(attrs),
      history,
      confirmedSet,
      periodDuration,
      pregnancyInfo,
      currentBleedingBlock,
      sensorFertileStart: this._normalizeISO(attrs.fertile_window_start),
      sensorFertileEnd: this._normalizeISO(attrs.fertile_window_end),
      sensorOvulation: this._normalizeISO(attrs.ovulation_day),
      todayIso: this._isoFromDate(new Date()),
      symptomByDate: this._symptomMap(attrs),
      predictedStartSet,
      predictedPeriodSet,
    };
  }

  _symptomMap(attrs) {
    const map = {};
    const history = Array.isArray(attrs?.symptom_history) ? attrs.symptom_history : [];
    history.forEach((entry) => {
      const iso = this._normalizeISO(entry?.date);
      if (!iso) return;
      map[iso] = entry?.symptom_data && typeof entry.symptom_data === 'object' ? entry.symptom_data : {};
    });
    return map;
  }

  _resolvePeriodDuration(attrs) {
    const sensorEffective = Number(attrs?.period_duration_days);
    const sensorLearned = Number(attrs?.period_duration_learned_avg_days);
    const sensorDefault = Number(attrs?.period_duration_default_days);
    const cfgRaw = this._config?.period_duration_days;
    const cfgNum = Number(cfgRaw);
    if (Number.isFinite(cfgNum)) return Math.max(1, Math.min(14, Math.round(cfgNum)));
    if (Number.isFinite(sensorEffective)) return Math.max(1, Math.min(14, Math.round(sensorEffective)));
    if (Number.isFinite(sensorLearned)) return Math.max(1, Math.min(14, Math.round(sensorLearned)));
    if (Number.isFinite(sensorDefault)) return Math.max(1, Math.min(14, Math.round(sensorDefault)));
    return 5;
  }

  _resolvePregnancyInfo(source = {}) {
    const sharedResolver = window.ProductIcons?.resolvePregnancyInfo;
    if (typeof sharedResolver === 'function') {
      return sharedResolver(source);
    }
    const parsePositiveInt = (value) => {
      const normalized = parseInt(String(value ?? '').trim(), 10);
      return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
    };
    const clampInt = (value, min, max) => Math.max(min, Math.min(max, value));
    const pregnancyData = source && typeof source === 'object' && source.pregnancy_data && typeof source.pregnancy_data === 'object'
      ? source.pregnancy_data : {};
    const weeksValue = parsePositiveInt(
      source?.weeks_pregnant ?? source?.pregnancy_week ?? source?.week
      ?? pregnancyData.weeks_pregnant ?? pregnancyData.pregnancy_week ?? pregnancyData.week,
    );
    const monthValue = parsePositiveInt(
      source?.pregnancy_month ?? source?.month
      ?? pregnancyData.pregnancy_month ?? pregnancyData.month,
    );
    const trimesterValue = parsePositiveInt(
      source?.pregnancy_trimester ?? source?.trimester
      ?? pregnancyData.pregnancy_trimester ?? pregnancyData.trimester,
    );
    const month = monthValue !== null
      ? clampInt(monthValue, 1, 9)
      : clampInt(Math.ceil((weeksValue || 1) / 4), 1, 9);
    const week = weeksValue !== null
      ? clampInt(weeksValue, 1, 40)
      : clampInt((((month - 1) * 4) + 1), 1, 40);
    const trimester = trimesterValue !== null
      ? clampInt(trimesterValue, 1, 3)
      : clampInt(weeksValue !== null ? Math.ceil(week / 13) : Math.ceil(month / 3), 1, 3);
    const isPregnant = Boolean(source?.is_pregnant ?? source?.isPregnant ?? pregnancyData.is_pregnant ?? pregnancyData.isPregnant)
      || String(source?.state || '').toLowerCase() === 'pregnant';
    return { isPregnant, week, month, trimester };
  }

  _bleedingBlocks(history) {
    const days = Array.from(new Set((history || []).map((value) => this._normalizeISO(value)).filter(Boolean))).sort();
    if (!days.length) return [];
    const blocks = [];
    let current = [days[0]];
    for (let i = 1; i < days.length; i += 1) {
      if (this._dayDiff(days[i], days[i - 1]) <= 2) {
        current.push(days[i]);
        continue;
      }
      blocks.push({ start: current[0], end: current[current.length - 1], days: current });
      current = [days[i]];
    }
    blocks.push({ start: current[0], end: current[current.length - 1], days: current });
    return blocks;
  }

  _symptomConfig(state, isPregnant = false) {
    const pregnant = isPregnant || String(state || '') === 'pregnant';
    const all = [
      { key: 'bleeding_strength', icon: 'mdi:water-opacity', multi: false, options: ['none', 'light', 'medium', 'heavy', 'very_heavy'] },
      { key: 'clots', icon: 'mdi:water-alert', multi: false, options: ['yes', 'no'] },
      { key: 'clot_size', icon: 'mdi:ruler-square', multi: false, options: ['small', 'medium', 'large'], dependsOn: { key: 'clots', value: 'yes' } },
      { key: 'bleeding_type', icon: 'mdi:waves', multi: false, options: ['continuous', 'intermittent', 'drops'] },
      { key: 'spotting', icon: 'mdi:blood-bag', multi: false, options: ['red', 'brown'] },
      { key: 'smell', icon: 'mdi:nose', multi: false, options: ['normal', 'inconspicuous', 'unpleasant', 'fishy'] },
      { key: 'discharge', icon: 'mdi:water-outline', multi: false, options: ['reddish', 'brown', 'white', 'clear', 'other'] },
      { key: 'hygiene', icon: 'mdi:medical-bag', multi: true, options: ['pad', 'liner', 'tampon', 'cup', 'period_underwear'] },
      { key: 'cervical_mucus', icon: 'mdi:water', multi: false, options: ['keinen', 'klebrig', 'cremig', 'fadenziehend', 'untypisch'] },
      { key: 'cervix_position', icon: 'mdi:grid', multi: false, options: ['cervix_high', 'cervix_mid', 'cervix_low'], renderAs: 'cervix-grid' },
      { key: 'cervix_texture', icon: 'mdi:grid', multi: false, options: ['firm', 'soft', 'open'], hiddenInModal: true },
      { key: 'intercourse', icon: 'mdi:heart', multi: false, options: ['protected', 'unprotected'] },
      { key: 'libido', icon: 'mdi:heart-pulse', multi: false, options: ['libido_low', 'normal', 'libido_high'] },
      { key: 'pain', icon: 'mdi:emoticon-sad-outline', multi: true, options: ['mittelschmerz', 'cramps', 'tender_breasts', 'headache', 'migraine', 'lower_back', 'vulva'] },
      { key: 'test', icon: 'mdi:test-tube', multi: true, options: ['positive_ovulation', 'negative_ovulation', 'positive_pregnancy', 'negative_pregnancy'] },
      { key: 'training_intensity', icon: 'mdi:run-fast', multi: false, options: ['training_light', 'training_moderate', 'training_intense'] },
    ];
    if (String(state || '') === 'pre_menarche') {
      const allowed = new Set(['spotting', 'smell', 'discharge', 'hygiene', 'cervical_mucus', 'pain', 'training_intensity']);
      return all.filter((cat) => allowed.has(cat.key));
    }
    if (String(state || '') === 'menopause') {
      const allowed = new Set(['spotting', 'smell', 'discharge', 'hygiene', 'cervical_mucus', 'cervix_position', 'cervix_texture', 'intercourse', 'libido', 'pain', 'test', 'training_intensity']);
      return all.filter((cat) => allowed.has(cat.key));
    }
    if (pregnant) {
      const pregnancyConfig = all
        .filter((cat) => (cat.key !== 'bleeding_strength' && cat.key !== 'clots' && cat.key !== 'clot_size' && cat.key !== 'bleeding_type'))
        .map((cat) => {
          if (cat.key === 'hygiene') {
            return { ...cat, options: cat.options.filter((opt) => opt !== 'tampon' && opt !== 'cup') };
          }
          return cat;
        });
      return [{
        key: 'pregnancy_symptoms',
        icon: 'mdi:baby-carriage',
        multi: true,
        options: ['nausea', 'fatigue', 'headache', 'back_pain', 'heartburn', 'swelling'],
      }, ...pregnancyConfig];
    }
    return all;
  }

  _periodModalContext(iso, model) {
    const safeDuration = Number.isFinite(Number(model?.periodDuration))
      ? Math.max(1, Math.min(14, Math.round(Number(model.periodDuration))))
      : 5;
    const blocks = this._bleedingBlocks(model?.history);
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      const block = blocks[i];
      const daysFromStart = this._dayDiff(iso, block.start);
      if (daysFromStart < 0 || daysFromStart >= safeDuration) continue;
      return {
        showPeriodToggle: iso === block.start,
        continuationBlock: iso === block.start ? null : block,
      };
    }
    return { showPeriodToggle: true, continuationBlock: null };
  }

  _daysToAutoConfirm(iso, model, continuationBlock) {
    if (!continuationBlock || model.confirmedSet.has(iso)) return [];
    const gapFromBlockEnd = this._dayDiff(iso, continuationBlock.end);
    if (gapFromBlockEnd <= 0) return [iso];
    const days = [];
    const endDate = this._parseISO(continuationBlock.end);
    if (!endDate) return [iso];
    for (let offset = 1; offset <= gapFromBlockEnd; offset += 1) {
      const next = new Date(endDate);
      next.setDate(endDate.getDate() + offset);
      const nextIso = this._isoFromDate(next);
      if (nextIso && !model.confirmedSet.has(nextIso)) days.push(nextIso);
    }
    return days;
  }

  _periodSaveLabel(iso, model) {
    if (iso !== model?.todayIso) return this._t('save');
    if (model?.currentBleedingBlock?.is_active) return this._t('log_today');
    return this._t('period_start');
  }

  _renderSymptomModal(iso, model) {
    const dt = this._parseISO(iso);
    const locale = this._hass?.locale?.language || 'en';
    const dateLabel = dt
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(dt)
      : iso;

    const isPeriodDay = model.confirmedSet.has(iso);
    const existing = model.symptomByDate?.[iso] || {};
    const isPreMenarche = model.state === 'pre_menarche';
    const isPregnant = Boolean(model.pregnancyInfo?.isPregnant);
    const periodModalContext = this._periodModalContext(iso, model);
    const symptomConfig = this._symptomConfig(model.state, isPregnant);

    const categoryRows = symptomConfig.map((cat) => {
      if (cat.hiddenInModal) return '';
      const catLabel = this._t(`cat_${cat.key}`);
      if (cat.renderAs === 'cervix-grid') {
        const positionValue = existing.cervix_position || '';
        const textureValue = existing.cervix_texture || '';
        const positionButtons = cat.options.map((opt) => {
          const sel = positionValue === opt ? ' sym-selected' : '';
          return `<button type="button" class="sym-opt-btn${sel}" data-cat="cervix_position" data-val="${opt}">${this._t(`opt_${opt}`)}</button>`;
        }).join('');
        const textureConfig = symptomConfig.find((entry) => entry.key === 'cervix_texture');
        const textureButtons = (textureConfig?.options || []).map((opt) => {
          const sel = textureValue === opt ? ' sym-selected' : '';
          return `<button type="button" class="sym-opt-btn${sel}" data-cat="cervix_texture" data-val="${opt}">${this._t(`opt_${opt}`)}</button>`;
        }).join('');
        return `
          <div class="sym-row">
            <div class="sym-cat-head"><ha-icon icon="${cat.icon}"></ha-icon><span>${catLabel}</span></div>
            <div class="sym-cervix-grid">
              <div class="sym-cervix-col">
                <div class="sym-cervix-title">${this._t('cat_cervix_position')}</div>
                <div class="sym-options sym-cervix-opts">${positionButtons}</div>
              </div>
              <div class="sym-cervix-col">
                <div class="sym-cervix-title">${this._t('cat_cervix_texture')}</div>
                <div class="sym-options sym-cervix-opts">${textureButtons}</div>
              </div>
            </div>
          </div>`;
      }
      if (cat.multi) {
        const currentValues = Array.isArray(existing[cat.key]) ? existing[cat.key] : [];
        const checkboxes = cat.options.map((opt) => {
          const checked = currentValues.includes(opt) ? 'checked' : '';
          return `<label class="sym-opt-label"><input type="checkbox" class="sym-multi" name="${cat.key}" value="${opt}" ${checked}><span>${this._t(`opt_${opt}`)}</span></label>`;
        }).join('');
        return `<div class="sym-row"><div class="sym-cat-head"><ha-icon icon="${cat.icon}"></ha-icon><span>${catLabel}</span></div><div class="sym-options sym-multi-opts">${checkboxes}</div></div>`;
      }
      const currentValue = existing[cat.key] || '';
      const buttons = cat.options.map((opt) => {
        const sel = currentValue === opt ? ' sym-selected' : '';
        return `<button type="button" class="sym-opt-btn${sel}" data-cat="${cat.key}" data-val="${opt}">${this._t(`opt_${opt}`)}</button>`;
      }).join('');
      const hiddenClass = cat.dependsOn && existing[cat.dependsOn.key] !== cat.dependsOn.value ? ' sym-hidden' : '';
      return `<div class="sym-row${hiddenClass}" data-sym-row="${cat.key}"><div class="sym-cat-head"><ha-icon icon="${cat.icon}"></ha-icon><span>${catLabel}</span></div><div class="sym-options sym-single-opts">${buttons}</div></div>`;
    }).join('');

    const basalTemp = existing.basal_temp != null ? existing.basal_temp : '';
    const saveLabel = this._periodSaveLabel(iso, model);

    return `
      <div class="sym-overlay" id="sym-modal">
        <div class="sym-backdrop"></div>
        <div class="sym-dialog">
          <div class="sym-header">
            <span>${this._t('modal_edit_day')}: ${dateLabel}</span>
            <button type="button" class="sym-close" aria-label="close">✕</button>
          </div>
          <div class="sym-body">
            ${isPreMenarche || isPregnant || !periodModalContext.showPeriodToggle ? '' : `
            <div class="sym-row">
              <div class="sym-cat-head"><ha-icon icon="mdi:calendar-heart"></ha-icon><span>${this._t('period_start')}</span></div>
              <div class="sym-options sym-single-opts">
                <button type="button" class="sym-opt-btn${isPeriodDay ? ' sym-selected' : ''}" data-cat="_period" data-val="yes">✔</button>
                <button type="button" class="sym-opt-btn${!isPeriodDay ? ' sym-selected' : ''}" data-cat="_period" data-val="no">✗</button>
              </div>
            </div>`}
            ${categoryRows}
            <div class="sym-row">
              <div class="sym-cat-head"><ha-icon icon="mdi:thermometer"></ha-icon><span>${this._t('basal_temp_label')}</span></div>
              <input id="sym-basal-temp" type="number" step="0.1" min="35" max="42" value="${basalTemp}" class="sym-temp-input" placeholder="36.5">
            </div>
          </div>
          <div class="sym-footer">
            <button type="button" class="btn sym-save">${saveLabel}</button>
            <button type="button" class="btn ghost sym-cancel">${this._t('cancel')}</button>
          </div>
        </div>
      </div>`;
  }

  async _handleModalSave() {
    const iso = this._modalIso;
    if (!iso) return;

    const root = this.shadowRoot;
    const model = this._buildModel();
    if (model.missing) return;
    const entityId = model.entityId || this._config?.entity || '';
    const entryId = model.stateObj?.attributes?.entry_id || this._config?.entry_id || '';
    const profile = model.stateObj?.attributes?.profile;

    const periodModalContext = this._periodModalContext(iso, model);
    const allowPeriodToggle = !model.pregnancyInfo?.isPregnant && model.state !== 'pre_menarche' && periodModalContext.showPeriodToggle;
    const periodYesBtn = root.querySelector('.sym-opt-btn[data-cat="_period"][data-val="yes"]');
    const wantsPeriod = allowPeriodToggle
      ? (periodYesBtn?.classList.contains('sym-selected') ?? model.confirmedSet.has(iso))
      : model.confirmedSet.has(iso);
    const hasPeriod = model.confirmedSet.has(iso);

    const symptomData = {};
    this._symptomConfig(model.state, model.pregnancyInfo?.isPregnant).forEach((cat) => {
      if (cat.hiddenInModal) return;
      if (cat.multi) {
        const checked = Array.from(root.querySelectorAll(`.sym-multi[name="${cat.key}"]:checked`)).map((el) => el.value);
        if (checked.length > 0) symptomData[cat.key] = checked;
      } else {
        const selected = root.querySelector(`.sym-opt-btn.sym-selected[data-cat="${cat.key}"]`);
        if (selected) symptomData[cat.key] = selected.getAttribute('data-val');
      }
    });
    if (symptomData.clots !== 'yes') delete symptomData.clot_size;
    const rawTemp = root.getElementById('sym-basal-temp')?.value;
    const basalTemp = parseFloat(rawTemp);
    if (!Number.isNaN(basalTemp) && rawTemp !== '') symptomData.basal_temp = basalTemp;
    const autoConfirmDays = symptomData.bleeding_strength && symptomData.bleeding_strength !== 'none'
      ? this._daysToAutoConfirm(iso, model, periodModalContext.continuationBlock)
      : [];

    this._modalIso = null;

    if (allowPeriodToggle && wantsPeriod !== hasPeriod) {
      try {
        await this._toggleCycleStart(iso);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('menstruation-calendar-card: failed to toggle period', err);
      }
    }

    if (!allowPeriodToggle && autoConfirmDays.length > 0) {
      try {
        for (const dayIso of autoConfirmDays) {
          // eslint-disable-next-line no-await-in-loop
          await this._toggleCycleStart(dayIso);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('menstruation-calendar-card: failed to auto-confirm period day', err);
      }
    }

    if (Object.keys(symptomData).length > 0) {
      try {
        await this._hass.callService('menstruation_gauge', 'add_symptom', {
          date: iso,
          symptom_data: symptomData,
          ...(entityId ? { entity_id: entityId } : {}),
          ...(entryId ? { entry_id: entryId } : {}),
          ...(profile ? { profile } : {}),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('menstruation-calendar-card: failed to save symptoms', err);
      }
    }

    await this._refreshSensorEntity(entityId);
    this._render();
  }

  async _toggleCycleStart(iso) {
    const model = this._buildModel();
    if (model.missing || model.pregnancyInfo?.isPregnant) return;
    const service = model.confirmedSet.has(iso) ? 'remove_cycle_start' : 'add_cycle_start';
    const profile = model.stateObj?.attributes?.profile;
    const entityId = model.entityId || this._config?.entity || '';
    const entryId = model.stateObj?.attributes?.entry_id || this._config?.entry_id || '';
    const attempts = [
      { date: iso, ...(entityId ? { entity_id: entityId } : {}), ...(profile ? { profile } : {}), ...(entryId ? { entry_id: entryId } : {}) },
      { date: iso, ...(entityId ? { entity_id: entityId } : {}), ...(profile ? { profile } : {}) },
      { date: iso, ...(profile ? { profile } : {}), ...(entryId ? { entry_id: entryId } : {}) },
      { date: iso, ...(profile ? { profile } : {}) },
      { date: iso },
    ];
    let lastError = null;
    for (const payload of attempts) {
      try {
        await this._hass.callService('menstruation_gauge', service, payload);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Service call failed');
  }

  async _refreshSensorEntity(entityId) {
    const eid = String(entityId || '').trim();
    if (!eid) return;
    try {
      await this._hass.callService('homeassistant', 'update_entity', { entity_id: eid });
    } catch (_) {
      // Ignore environments where update_entity is unavailable.
    }
  }

  _calendarGrid(model, locale) {
    const y = this._viewDate.getFullYear();
    const m = this._viewDate.getMonth();
    const first = new Date(y, m, 1, 12, 0, 0, 0);
    const count = new Date(y, m + 1, 0).getDate();
    const weekStart = String(this._config?.week_start || 'monday').toLowerCase();
    const firstDow = weekStart === 'sunday' ? first.getDay() : (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((firstDow + count) / 7) * 7;
    const isPregnant = Boolean(model.pregnancyInfo?.isPregnant);
    const isPreMenarche = model.state === 'pre_menarche';
    const isMenopause = model.state === 'menopause';

    const items = [];
    this._weekdayLabels(locale).forEach((d) => items.push(`<div class="dow">${d}</div>`));

    for (let i = 0; i < totalCells; i += 1) {
      const day = i - firstDow + 1;
      const valid = day >= 1 && day <= count;
      if (!valid) {
        items.push('<button class="day other" type="button" disabled tabindex="-1"></button>');
        continue;
      }
      const iso = this._isoFromDate(new Date(y, m, day, 12, 0, 0, 0));
      const st = this._statusForDay(iso, model);
      const isToday = iso === model.todayIso;
      const isFocused = this._focusedIso ? this._focusedIso === iso : isToday;
      const isPredictedDay = st.isPredictedPeriod || st.isPredictedFertile || st.isPredictedOvulation;
      const hasSymptoms = model.symptomByDate && Object.keys(model.symptomByDate[iso] || {}).length > 0;
      const isModalOpen = this._modalIso === iso;

      const classes = [
        'day',
        st.isPeriod ? 'is-period-day' : '',
        st.isPredictedPeriod ? 'is-predicted-period' : '',
        (this._config?.show_fertile_period !== false && st.isFertile) ? 'is-fertile' : '',
        (this._config?.show_fertile_period !== false && st.isPredictedFertile) ? 'is-predicted-fertile' : '',
        (this._config?.show_ovulation_marker !== false && st.isOvulation) ? 'is-ovulation' : '',
        (this._config?.show_ovulation_marker !== false && st.isPredictedOvulation) ? 'is-predicted-ovulation' : '',
        (isPregnant && !st.isPeriod) ? 'is-pregnancy-day' : '',
        (isPreMenarche && !st.isPeriod) ? 'is-premenarche-day' : '',
        (isMenopause && !st.isPeriod) ? 'is-menopause-day' : '',
        isToday ? 'today' : '',
        isModalOpen ? 'selected' : '',
      ].filter(Boolean).join(' ');

      const cycleHint = Number.isFinite(st.cycleDay)
        ? `${this._t('cycle_day')}: ${st.cycleDay}${isPredictedDay ? ` (${this._t('predicted')})` : ''}`
        : this._t('no_data');
      items.push(`
        <button
          class="${classes}"
          type="button"
          data-iso="${iso}"
          title="${cycleHint}"
          aria-label="${day}. ${cycleHint}"
          tabindex="${isFocused ? '0' : '-1'}"
        >
          <span class="day-number">${day}</span>
          ${this._config?.show_cycle_day_numbers && Number.isFinite(st.cycleDay)
            ? `<span class="cycle-day">${st.cycleDay}</span>`
            : ''}
          ${hasSymptoms ? '<span class="sym-dot" aria-hidden="true"></span>' : ''}
          ${(this._config?.show_ovulation_marker !== false && (st.isOvulation || st.isPredictedOvulation))
            ? `<span class="ovulation-dot${st.isPredictedOvulation ? ' predicted' : ''}" aria-hidden="true"></span>`
            : ''}
        </button>
      `);
    }

    return items.join('');
  }

  _setViewToToday() {
    this._viewDate = new Date();
    this._focusedIso = this._isoFromDate(this._viewDate);
  }

  _changeMonth(offset) {
    this._viewDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth() + offset, 1, 12, 0, 0, 0);
    this._focusedIso = null;
  }

  _focusIso(iso) {
    if (!iso) return;
    this._focusedIso = iso;
  }

  _moveFocusByDays(delta) {
    const baseIso = this._focusedIso || this._isoFromDate(new Date(this._viewDate.getFullYear(), this._viewDate.getMonth(), 1, 12, 0, 0, 0));
    const nextIso = this._addDaysToISO(baseIso, delta);
    const next = this._parseISO(nextIso);
    if (!next) return;
    if (next.getFullYear() !== this._viewDate.getFullYear() || next.getMonth() !== this._viewDate.getMonth()) {
      this._viewDate = new Date(next.getFullYear(), next.getMonth(), 1, 12, 0, 0, 0);
    }
    this._focusIso(nextIso);
    this._render();
    const btn = this.shadowRoot?.querySelector(`[data-iso="${nextIso}"]`);
    btn?.focus?.();
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    const model = this._buildModel();
    const locale = this._hass?.locale?.language || 'en';
    const title = this._config?.title || this._t('title');

    if (model.missing) {
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px">Entity not found</div></ha-card>`;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; position: relative; }
        .wrap { padding: 12px; display: grid; gap: 10px; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .title { font-size: 1rem; font-weight: 700; color: var(--primary-text-color); }
        .month { font-size: .95rem; font-weight: 600; color: var(--primary-text-color); text-transform: capitalize; }
        .nav { display: inline-flex; gap: 6px; align-items: center; }
        .btn {
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border-radius: 10px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: .82rem;
          min-height: 34px;
        }
        .btn.ghost { opacity: .9; }
        .grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
        }
        .dow {
          text-align: center;
          font-size: .75rem;
          color: var(--secondary-text-color);
          font-weight: 600;
          padding: 4px 0;
        }
        .day {
          position: relative;
          border: 1px solid var(--divider-color);
          border-radius: 12px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          min-height: 52px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 2px;
          padding: 6px 7px;
          cursor: pointer;
        }
        .day.other { visibility: hidden; }
        .day:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
        .day.today { box-shadow: inset 0 0 0 2px var(--primary-color); }
        .day.selected { box-shadow: inset 0 0 0 2px var(--accent-color, var(--primary-color)); }
        .day.is-period-day { background: color-mix(in srgb, var(--error-color, #e11d48) 26%, var(--card-background-color)); }
        .day.is-fertile { background: color-mix(in srgb, var(--warning-color, #facc15) 26%, var(--card-background-color)); }
        .day.is-ovulation { background: color-mix(in srgb, var(--success-color, #22c55e) 20%, var(--card-background-color)); }
        .day.is-predicted-period { background: color-mix(in srgb, var(--error-color, #e11d48) 11%, var(--card-background-color)); border-style: dashed; }
        .day.is-predicted-fertile { background: color-mix(in srgb, var(--warning-color, #facc15) 11%, var(--card-background-color)); border-style: dashed; }
        .day.is-predicted-ovulation { background: color-mix(in srgb, var(--success-color, #22c55e) 8%, var(--card-background-color)); border-style: dashed; }
        .day.is-pregnancy-day { background: color-mix(in srgb, #a855f7 10%, var(--card-background-color)); }
        .day.is-premenarche-day { background: color-mix(in srgb, #94a3b8 12%, var(--card-background-color)); }
        .day.is-menopause-day { background: color-mix(in srgb, #94a3b8 8%, var(--card-background-color)); }
        .day-number { font-size: .88rem; font-weight: 650; }
        .cycle-day { font-size: .66rem; color: var(--secondary-text-color); line-height: 1; }
        .sym-dot {
          position: absolute;
          right: 7px;
          top: 7px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--warning-color, #d97706);
          opacity: .85;
        }
        .ovulation-dot {
          position: absolute;
          right: 7px;
          bottom: 7px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--success-color, #16a34a);
        }
        .legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: .74rem; color: var(--secondary-text-color); }
        .legend-item { display: inline-flex; align-items: center; gap: 5px; }
        .swatch { width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--divider-color); }
        .swatch.period { background: color-mix(in srgb, var(--error-color, #e11d48) 68%, transparent); }
        .swatch.fertile { background: color-mix(in srgb, var(--warning-color, #facc15) 68%, transparent); }
        .swatch.ovulation { background: var(--success-color, #16a34a); }
        .swatch.predicted-period { background: color-mix(in srgb, var(--error-color, #e11d48) 36%, transparent); border-style: dashed; }
        .swatch.predicted-fertile { background: color-mix(in srgb, var(--warning-color, #facc15) 36%, transparent); border-style: dashed; }
        .swatch.predicted-ovulation { background: color-mix(in srgb, var(--success-color, #16a34a) 45%, transparent); border-style: dashed; }
        .ovulation-dot.predicted { background: color-mix(in srgb, var(--success-color, #16a34a) 55%, transparent); }
        /* Symptom modal */
        .sym-overlay { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; border-radius: 12px; overflow: hidden; }
        .sym-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); }
        .sym-dialog { position: relative; z-index: 1; border-radius: 12px; border: 1px solid var(--divider-color); padding: 0; width: 92%; max-width: 360px; max-height: 85%; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,.32); background: var(--ha-card-background, var(--card-background-color, #fff)); color: var(--primary-text-color); }
        .sym-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px 10px; font-weight: 700; font-size: .92rem; border-bottom: 1px solid rgba(128,128,128,.2); }
        .sym-close { background: transparent; border: none; cursor: pointer; font-size: 1rem; color: inherit; opacity: .7; padding: 2px 6px; }
        .sym-close:hover { opacity: 1; }
        .sym-body { overflow-y: auto; padding: 10px 14px; display: grid; gap: 10px; }
        .sym-footer { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid rgba(128,128,128,.2); justify-content: flex-end; }
        .sym-row { display: grid; gap: 6px; }
        .sym-cat-head { display: flex; align-items: center; gap: 6px; font-size: .82rem; font-weight: 600; opacity: .85; }
        .sym-cat-head ha-icon { --mdc-icon-size: 16px; }
        .sym-options { display: flex; flex-wrap: wrap; gap: 5px; }
        .sym-hidden { display: none; }
        .sym-cervix-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
        .sym-cervix-col { display: grid; gap: 4px; }
        .sym-cervix-title { font-size: .72rem; opacity: .75; }
        .sym-cervix-opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .sym-opt-btn { border: 1px solid rgba(128,128,128,.35); border-radius: 6px; padding: 4px 9px; cursor: pointer; font-size: .8rem; background: transparent; color: inherit; transition: background 120ms, border-color 120ms; }
        .sym-opt-btn:hover { border-color: var(--primary-color); }
        .sym-opt-btn.sym-selected { background: var(--error-color, #be123c); color: #fff; border-color: var(--error-color, #be123c); }
        .sym-opt-label { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: .82rem; }
        .sym-opt-label input[type="checkbox"] { accent-color: var(--error-color, #be123c); }
        .sym-temp-input { padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(128,128,128,.35); background: transparent; color: inherit; font-size: .88rem; width: 100px; }
        @media (max-width: 480px) {
          .day { min-height: 46px; padding: 5px; border-radius: 10px; }
          .day-number { font-size: .8rem; }
          .cycle-day { font-size: .62rem; }
          .btn { min-height: 36px; }
        }
      </style>
      <ha-card>
        <div class="wrap" id="root" style="position:relative">
          <div class="title">${title}</div>
          <div class="toolbar">
            <div class="nav">
              <button type="button" class="btn" data-action="prev-month" title="${this._t('previous_month')}">◀</button>
              <div class="month">${this._monthLabel(locale)}</div>
              <button type="button" class="btn" data-action="next-month" title="${this._t('next_month')}">▶</button>
            </div>
            <button type="button" class="btn" data-action="today">${this._t('today')}</button>
          </div>
          <div class="grid" role="grid" aria-label="calendar">${this._calendarGrid(model, locale)}</div>
          <div class="legend">
            <span class="legend-item"><span class="swatch period"></span>🔴 Period</span>
            ${this._config?.show_fertile_period !== false ? '<span class="legend-item"><span class="swatch fertile"></span>🟡 Fertile</span>' : ''}
            ${this._config?.show_ovulation_marker !== false ? '<span class="legend-item"><span class="swatch ovulation"></span>💚 Ovulation</span>' : ''}
            ${this._config?.show_predicted_cycles !== false ? `<span class="legend-item"><span class="swatch predicted-period"></span>🔮 ${this._t('predicted_period')}</span>` : ''}
          </div>
        </div>
      </ha-card>
      ${this._modalIso ? this._renderSymptomModal(this._modalIso, model) : ''}
    `;

    const root = this.shadowRoot.getElementById('root');
    root?.addEventListener('click', (ev) => {
      const actionEl = ev.target?.closest?.('[data-action]');
      if (actionEl) {
        const action = actionEl.getAttribute('data-action');
        if (action === 'prev-month') {
          this._changeMonth(-1);
          this._render();
          return;
        }
        if (action === 'next-month') {
          this._changeMonth(1);
          this._render();
          return;
        }
        if (action === 'today') {
          this._setViewToToday();
          this._render();
          return;
        }
      }

      const dayBtn = ev.target?.closest?.('[data-iso]');
      const iso = dayBtn?.getAttribute?.('data-iso');
      if (iso) {
        this._focusedIso = iso;
        this._modalIso = iso;
        this._render();
        this.dispatchEvent(new CustomEvent('menstruation-calendar-day-click', {
          detail: { date: iso, entity_id: this._resolveEntityId() },
          bubbles: true,
          composed: true,
        }));
      }
    });

    root?.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); this._moveFocusByDays(-1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); this._moveFocusByDays(1); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); this._moveFocusByDays(-7); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); this._moveFocusByDays(7); }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target?.matches?.('[data-iso]')) {
        ev.preventDefault();
        const iso = ev.target.getAttribute('data-iso');
        if (iso) {
          this._focusedIso = iso;
          this._modalIso = iso;
          this._render();
        }
      }
    });

    // Modal handlers — attached on shadowRoot to catch clicks outside #root too
    this.shadowRoot?.addEventListener?.('click', (ev) => {
      if (!this._modalIso) return;
      // Close on backdrop or close/cancel buttons
      if (ev.target?.closest('.sym-backdrop') || ev.target?.closest('.sym-close') || ev.target?.closest('.sym-cancel')) {
        this._modalIso = null;
        this._render();
        return;
      }
      // Save
      if (ev.target?.closest('.sym-save')) {
        this._handleModalSave();
        return;
      }
      // Single-select symptom option buttons
      const optBtn = ev.target?.closest('.sym-opt-btn[data-cat]');
      if (optBtn) {
        const cat = optBtn.getAttribute('data-cat');
        const modal = this.shadowRoot.getElementById('sym-modal');
        modal?.querySelectorAll(`.sym-opt-btn[data-cat="${cat}"]`).forEach((b) => b.classList.remove('sym-selected'));
        optBtn.classList.add('sym-selected');
        if (cat === 'clots') {
          const showSize = optBtn.getAttribute('data-val') === 'yes';
          const clotSizeRow = modal?.querySelector('[data-sym-row="clot_size"]');
          if (clotSizeRow) clotSizeRow.classList.toggle('sym-hidden', !showSize);
          if (!showSize) {
            modal?.querySelectorAll('.sym-opt-btn[data-cat="clot_size"]').forEach((b) => b.classList.remove('sym-selected'));
          }
        }
      }
    });
  }
}

if (!customElements.get('menstruation-calendar-card')) {
  customElements.define('menstruation-calendar-card', MenstruationCalendarCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-calendar-card',
  name: 'Menstruation Calendar Card',
  description: 'Standalone full-month calendar with period, fertile window, and ovulation markers.',
});
