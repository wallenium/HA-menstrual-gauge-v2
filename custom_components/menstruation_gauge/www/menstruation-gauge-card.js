class MenstruationGaugeCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstruation-gauge-card',
      entity: 'sensor.menstruation',
      entry_id: '',
      friendly_name: '',
      theme_mode: 'auto',
      title: 'Cycle Gauge',
      show_fertile_period: true,
      calendar_edit_enabled: true,
      period_duration_days: 5
    };
  }

  static getConfigElement() {
    return document.createElement('menstruation-gauge-card-editor');
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      show_editor: true,
      show_fertile_period: true,
      calendar_edit_enabled: true,
      period_duration_days: 5,
      ...config
    };
    this._viewDate = new Date();
    this._editorOpen = false;
    this._lastRenderKey = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Don't re-render while the symptom modal or first period modal is open to preserve user input.
    if (this._modalIso || this._pmModalOpen) return;
    this._render();
  }

  connectedCallback() {
    if (typeof ResizeObserver !== 'undefined' && !this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => {
        const newWidth = this.getBoundingClientRect()?.width || 0;
        if (newWidth !== this._lastCardWidth) {
          this._lastCardWidth = newWidth;
          if (this._config && this._hass) this._render();
        }
      });
      this._resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  getCardSize() {
    return 4;
  }

  _ensureRoot() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
  }

  _lang() {
    const language = String(this._hass?.locale?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        card_name: 'Menstruation Gauge Karte',
        card_description: 'Eine Karte zur Visualisierung des weiblichen Menstruationszyklus, des fruchtbaren Tage, des Eisprungs und damit verbundener Symptome.',
        days_unit: 'Tage',
        days_unknown: '-- Tage',
        days_until_menarche: 'Tage bis Menarche',
        menarche_expected_in: 'Menarche erwartet in {days} Tagen',
        menarche_overdue: 'Menarche {days} Tage überfällig',
        pregnancy: 'Schwangerschaft',
        week: 'Woche',
        month: 'Monat',
        trimester: 'Trimester',
        // Modal UI
        modal_edit_day: 'Tag bearbeiten',
        period_toggle: 'Periode',
        period_start: 'Periode Start',
        log_today: 'Heute loggen',
        save: 'Speichern',
        cancel: 'Abbrechen',
        basal_temp_label: 'Basaltemperatur (°C)',
        // Symptom category labels
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
        // Symptom option labels
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
        // Pregnancy symptom options
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
        // First Period (Pre-Menarche) flow
        log_first_period: 'Erste Periode loggen',
        log_first_period_symptoms: 'Erste Periode - Symptome loggen',
        first_period_description: 'Wähle deine heutigen Symptome aus und bestätige den Start deiner ersten Periode.',
        leave_pre_menarche_title: 'Willst du den Pre-Menarche Modus verlassen?',
        leave_pre_menarche_message: 'Deine erste Periode wird für heute geloggt und der Zyklus-Tracking-Modus wird aktiviert.',
        welcome_period_title: 'Willkommen zur Periode! 🎉',
        welcome_period_cycle_tracking: 'Zyklus-Tracking startet jetzt',
        welcome_period_features: 'Neue Features: Zyklus-Vorhersage, Statistiken, ...',
        welcome_period_contraception: 'Du bist jetzt fruchtbar - denke an Verhütung, wenn nötig!',
        welcome_period_return: 'Du kannst jederzeit in den Einstellungen zum Pre-Menarche Modus zurückwechseln',
        spotting: 'Schmierblutung',
        discharge: 'Ausfluss',
        pain: 'Schmerzen',
        yes: 'Ja',
        no: 'Nein',
        continue: 'Weiter',
      },
      en: {
        card_name: 'Menstruation Gauge Card',
        card_description: 'A card to visualize menstruation cycle, fertile window, ovulation, and related symptoms.',
        days_unit: 'days',
        days_unknown: '-- days',
        days_until_menarche: 'Days until menarche',
        menarche_expected_in: 'Menarche expected in {days} days',
        menarche_overdue: 'Menarche {days} days overdue',
        pregnancy: 'Pregnancy',
        week: 'Week',
        month: 'Month',
        trimester: 'Trimester',
        // Modal UI
        modal_edit_day: 'Edit Day',
        period_toggle: 'Period',
        period_start: 'Period Start',
        log_today: 'Log Today',
        save: 'Save',
        cancel: 'Cancel',
        basal_temp_label: 'Basal Temperature (°C)',
        // Symptom category labels
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
        // Symptom option labels
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
        // Pregnancy symptom options
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
        // First Period (Pre-Menarche) flow
        log_first_period: 'Log First Period',
        log_first_period_symptoms: 'First Period - Log Symptoms',
        first_period_description: 'Select your symptoms for today and confirm the start of your first period.',
        leave_pre_menarche_title: 'Do you want to leave Pre-Menarche mode?',
        leave_pre_menarche_message: 'Your first period will be logged for today and cycle tracking mode will be activated.',
        welcome_period_title: 'Welcome to your period! 🎉',
        welcome_period_cycle_tracking: 'Cycle tracking starts now',
        welcome_period_features: 'New features: cycle prediction, statistics, ...',
        welcome_period_contraception: 'You are now fertile - think about contraception if needed!',
        welcome_period_return: 'You can always return to Pre-Menarche mode in Settings',
        spotting: 'Spotting',
        discharge: 'Discharge',
        pain: 'Pain',
        yes: 'Yes',
        no: 'No',
        continue: 'Continue',
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
  }

  _normalizeISO(value) {
    const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

  _dayDiff(aIso, bIso) {
    const a = this._parseISO(aIso);
    const b = this._parseISO(bIso);
    if (!a || !b) return 0;
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  _monthDays(dt) {
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  }

  _resolvePeriodDuration(attrs) {
    const sensorEffective = Number(attrs?.period_duration_days);
    const sensorLearned = Number(attrs?.period_duration_learned_avg_days);
    const sensorDefault = Number(attrs?.period_duration_default_days);
    const cfgRaw = this._config?.period_duration_days;
    const cfgText = String(cfgRaw ?? '').trim().toLowerCase();

    if (cfgText === 'learnt' || cfgText === 'learned') {
      if (Number.isFinite(sensorLearned)) return Math.max(1, Math.min(14, Math.round(sensorLearned)));
      if (Number.isFinite(sensorEffective)) return Math.max(1, Math.min(14, Math.round(sensorEffective)));
      if (Number.isFinite(sensorDefault)) return Math.max(1, Math.min(14, Math.round(sensorDefault)));
      return 5;
    }

    const cfgNum = Number(cfgRaw);
    if (Number.isFinite(cfgNum)) return Math.max(1, Math.min(14, Math.round(cfgNum)));
    if (Number.isFinite(sensorEffective)) return Math.max(1, Math.min(14, Math.round(sensorEffective)));
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
      ? source.pregnancy_data
      : {};
    const weeksValue = parsePositiveInt(
      source?.weeks_pregnant
      ?? source?.pregnancy_week
      ?? source?.week
      ?? pregnancyData.weeks_pregnant
      ?? pregnancyData.pregnancy_week
      ?? pregnancyData.week,
    );
    const monthValue = parsePositiveInt(
      source?.pregnancy_month
      ?? source?.month
      ?? pregnancyData.pregnancy_month
      ?? pregnancyData.month,
    );
    const trimesterValue = parsePositiveInt(
      source?.pregnancy_trimester
      ?? source?.trimester
      ?? pregnancyData.pregnancy_trimester
      ?? pregnancyData.trimester,
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

  _buildModel() {
    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    const attrs = stateObj?.attributes || {};
    const pregnancyInfo = this._resolvePregnancyInfo({ state: stateObj?.state, ...attrs });
    const historyRaw = JSON.stringify(attrs.history);
    if (historyRaw !== this._lastHistoryRaw) {
      this._lastHistoryRaw = historyRaw;
      this._normalizedHistory = Array.isArray(attrs.history) ? attrs.history.map((x) => this._normalizeISO(x)).filter(Boolean) : [];
    }
    const history = this._normalizedHistory || [];
    const confirmedSet = new Set(history);
    const periodDuration = this._resolvePeriodDuration(attrs);
    const predicted = this._normalizeISO(attrs.next_predicted_start);
    const fertileStart = this._normalizeISO(attrs.fertile_window_start);
    const fertileEnd = this._normalizeISO(attrs.fertile_window_end);
    const ovulationDay = this._normalizeISO(attrs.ovulation_day);
    const menarcheData = attrs.menarche_data || {};
    const normalizedEstimatedDate = this._normalizeISO(menarcheData?.estimated_date);
    const estimatedDate = this._parseISO(normalizedEstimatedDate) || new Date(menarcheData?.estimated_date || '');
    const today = new Date();
    const todayNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
    const daysUntilMenarche = String(stateObj?.state || '') === 'pre_menarche' && estimatedDate instanceof Date && !Number.isNaN(estimatedDate.getTime())
      ? Math.ceil((estimatedDate.getTime() - todayNoon.getTime()) / 86400000)
      : null;

    // Build a date-keyed symptom lookup
    const symptomHistoryRaw = JSON.stringify(attrs.symptom_history);
    const symptomDataTodayRaw = JSON.stringify(attrs.symptom_data_today);
    if (symptomHistoryRaw !== this._lastSymptomHistoryRaw || symptomDataTodayRaw !== this._lastSymptomDataTodayRaw) {
      this._lastSymptomHistoryRaw = symptomHistoryRaw;
      this._lastSymptomDataTodayRaw = symptomDataTodayRaw;
      const symptomByDateBuilt = {};
      const symptomHistory = Array.isArray(attrs.symptom_history) ? attrs.symptom_history : [];
      if (symptomHistory.length) {
        symptomHistory.forEach((entry) => {
          const d = this._normalizeISO(entry?.date);
          if (d) symptomByDateBuilt[d] = entry;
        });
      } else if (attrs.symptom_data_today && typeof attrs.symptom_data_today === 'object') {
        const todayIso = this._isoFromDate(new Date());
        symptomByDateBuilt[todayIso] = { date: todayIso, ...attrs.symptom_data_today };
      }
      this._normalizedSymptomByDate = symptomByDateBuilt;
    }
    const symptomByDate = this._normalizedSymptomByDate || {};
    const currentBleedingBlock = attrs.current_bleeding_block && typeof attrs.current_bleeding_block === 'object'
      ? attrs.current_bleeding_block
      : null;

    const viewDate = this._viewDate || new Date();
    const daysInMonth = this._monthDays(viewDate);
    const series = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12, 0, 0, 0);
      const iso = this._isoFromDate(dt);
      series.push({
        day,
        iso,
        confirmed: confirmedSet.has(iso),
      fertile: fertileStart && fertileEnd ? (this._dayDiff(iso, fertileStart) >= 0 && this._dayDiff(fertileEnd, iso) >= 0) : false,
      ovulation: ovulationDay ? iso === ovulationDay : false
      });
    }

    return {
      entityId,
      stateObj,
      state: String(stateObj?.state || 'neutral'),
      history,
      confirmedSet,
      predicted,
      periodDuration,
      fertileStart,
      fertileEnd,
      ovulationDay,
      menarcheData,
      daysUntilMenarche,
      pregnancyInfo,
      symptomByDate,
      currentBleedingBlock,
      daysInMonth,
      series,
      todayIso: this._isoFromDate(new Date())
    };
  }

  _resolveEntityId() {
    const states = this._hass?.states || {};
    const configuredEntity = String(this._config?.entity || '').trim();
    if (configuredEntity && states[configuredEntity]) return configuredEntity;

    const targetEntryId = String(this._config?.entry_id || '').trim();
    if (targetEntryId) {
      const match = Object.keys(states).find((entityId) => {
        const st = states[entityId];
        return st?.attributes?.entry_id === targetEntryId;
      });
      if (match) return match;
    }
    return configuredEntity || null;
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
        .filter((cat) => (cat.key !== 'bleeding_strength' && & cat.key !== 'clots' && cat.key !== 'clot_size' && cat.key !== 'bleeding_type'))
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

  _stateBg(state) {
    if (state === 'period') return 'linear-gradient(135deg, rgba(252,231,243,.97), rgba(255,241,246,.95))';
    if (state === 'fertile') return 'linear-gradient(135deg, rgba(254,252,232,.97), rgba(255,255,255,.95))';
    if (state === 'pms') return 'linear-gradient(135deg, rgba(255,241,246,.96), rgba(255,250,252,.94))';
    return 'linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,255,255,.95))';
  }

  _resolveThemeMode() {
    const mode = String(this._config?.theme_mode || 'auto').toLowerCase();
    if (mode === 'dark' || mode === 'light') return mode;
    return this._hass?.themes?.darkMode ? 'dark' : 'light';
  }

  _palette(state) {
    const dark = this._resolveThemeMode() === 'dark';
    if (!dark) {
      return {
        cardBg: this._stateBg(state),
        cardColor: 'var(--primary-text-color, #4a044e)',
        border: 'var(--divider-color, rgba(190,24,93,.20))',
        shadow: '0 8px 20px rgba(131,24,67,.10)',
        monthText: 'var(--secondary-text-color, rgba(131,24,67,.72))',
        dayLabel: 'var(--secondary-text-color, rgba(131,24,67,.68))',
        tick: 'rgba(190,24,93,.22)',
        confirmed: 'var(--error-color, #be123c)',
        fertile: 'var(--warning-color, #facc15)',
        ovulation: 'var(--success-color, #16a34a)',
        markerStroke: '#ffe4e6',
        hand: 'var(--error-color, #be123c)',
        ring: 'rgba(190,24,93,.16)',
        confirmedInset: 'rgba(190,24,93,.20)',
        countdownBg: 'color-mix(in srgb, var(--ha-card-background, var(--card-background-color, #fff)) 72%, white)',
        countdownColor: 'var(--primary-text-color, #831843)',
        buttonBg: 'var(--ha-card-background, var(--card-background-color, #fff))',
        buttonColor: 'var(--primary-text-color, #831843)',
        buttonBorder: 'var(--divider-color, rgba(190,24,93,.25))',
        dayBg: 'var(--ha-card-background, var(--card-background-color, #fff))',
        dayColor: 'var(--primary-text-color, #6b1b4a)',
        dayBorder: 'var(--divider-color, rgba(190,24,93,.16))',
        dayToday: 'rgba(190,24,93,.35)',
      };
    }

    const bg = state === 'period'
      ? 'linear-gradient(135deg, rgba(52,16,31,.98), rgba(27,11,20,.98))'
      : state === 'fertile'
        ? 'linear-gradient(135deg, rgba(43,41,18,.98), rgba(20,20,16,.98))'
        : state === 'pms'
          ? 'linear-gradient(135deg, rgba(44,19,34,.98), rgba(20,14,21,.98))'
          : 'linear-gradient(135deg, rgba(26,19,27,.98), rgba(17,15,20,.98))';

    return {
      cardBg: bg,
      cardColor: 'var(--primary-text-color, #f8d9e9)',
      border: 'var(--divider-color, rgba(251,113,133,.34))',
      shadow: '0 10px 24px rgba(0,0,0,.34)',
      monthText: 'var(--secondary-text-color, rgba(251,214,232,.82))',
      dayLabel: 'var(--secondary-text-color, rgba(251,214,232,.78))',
      tick: 'rgba(251,113,133,.42)',
      confirmed: 'var(--error-color, #fb7185)',
      fertile: 'var(--warning-color, #fde047)',
      ovulation: 'var(--success-color, #4ade80)',
      markerStroke: '#2f1f29',
      hand: 'var(--error-color, #fb7185)',
      ring: 'rgba(251,113,133,.32)',
      confirmedInset: 'rgba(251,113,133,.36)',
      countdownBg: 'rgba(32,20,29,.72)',
      countdownColor: 'var(--primary-text-color, #ffd4e6)',
      buttonBg: 'rgba(41,27,36,.95)',
      buttonColor: 'var(--primary-text-color, #ffd4e6)',
      buttonBorder: 'var(--divider-color, rgba(251,113,133,.45))',
      dayBg: 'rgba(41,27,36,.95)',
      dayColor: 'var(--primary-text-color, #f9d8e9)',
      dayBorder: 'var(--divider-color, rgba(251,113,133,.30))',
      dayToday: 'rgba(251,113,133,.66)',
    };
  }

  _polar(cx, cy, r, deg) {
    const a = deg * Math.PI / 180;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  _arcPath(cx, cy, r, startDeg, endDeg) {
    const s = this._polar(cx, cy, r, startDeg);
    const e = this._polar(cx, cy, r, endDeg);
    const span = ((endDeg - startDeg) % 360 + 360) % 360;
    const largeArc = span > 180 ? 1 : 0;
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${largeArc} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  _confirmedRanges(series) {
    const days = (series || []).filter((step) => step.confirmed).map((step) => step.day).sort((a, b) => a - b);
    if (!days.length) return [];
    const ranges = [];
    let start = days[0];
    let prev = days[0];
    for (let i = 1; i < days.length; i += 1) {
      const day = days[i];
      if (day === prev + 1) {
        prev = day;
        continue;
      }
      ranges.push({ start, end: prev });
      start = day;
      prev = day;
    }
    ranges.push({ start, end: prev });
    return ranges;
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
    return {
      showPeriodToggle: true,
      continuationBlock: null,
    };
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

  _renderGauge(model, palette) {
    const cx = 210;
    const cy = 210;
    const rInner = 126;
    const baseTick = 4.2;
    const extraBar = 26;
    const total = model.daysInMonth || 30;
    const safePeriodDuration = Number.isFinite(Number(model.periodDuration))
      ? Math.max(1, Math.min(14, Math.round(Number(model.periodDuration))))
      : 5;
    const gaugeWidth = Number(this._lastCardWidth || 0);
    let labelStep = 1;
    if (gaugeWidth > 0 && gaugeWidth < 320) labelStep = 5;
    else if (gaugeWidth > 0 && gaugeWidth < 380) labelStep = 3;
    else if (gaugeWidth > 0 && gaugeWidth < 480) labelStep = 2;
    const now = new Date();
    const dayNow = now.getDate();
    const handAngle = -90 + ((((dayNow - 1) + now.getHours() / 24) / total) * 360);
    const isCurrentViewMonth = this._viewDate.getMonth() === now.getMonth()
      && this._viewDate.getFullYear() === now.getFullYear();

    const baseTicks = model.series.map((_, i) => {
      const angle = -90 + ((i / total) * 360);
      return `<g transform="translate(${cx} ${cy}) rotate(${angle})"><rect x="-1.3" y="-${(rInner + baseTick).toFixed(1)}" width="2.6" height="${baseTick.toFixed(1)}" rx="1.2" fill="${palette.tick}"></rect></g>`;
    }).join('');

    const dayLabels = model.series.map((step, i) => {
      const isFirst = step.day === 1;
      const isLast = step.day === total;
      if (!isFirst && !isLast && (step.day % labelStep !== 0)) return '';
      const angle = -90 + ((((i + 0.5) / total) * 360));
      const pos = this._polar(cx, cy, 178, angle);
      return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" fill="${palette.dayLabel}" font-size="10" text-anchor="middle" dominant-baseline="middle">${step.day}</text>`;
    }).join('');

    const confirmedRanges = this._confirmedRanges(model.series);

    const currentMonthPeriodWindowBars = isCurrentViewMonth
      ? confirmedRanges.map((range) => {
        const windowEnd = Math.min(total, range.start + safePeriodDuration - 1);
        const startAngle = -90 + ((((range.start - 1) + 0.08) / total) * 360);
        const endAngle = -90 + ((((windowEnd) - 0.08) / total) * 360);
        const dPath = this._arcPath(cx, cy, rInner + extraBar * 0.74, startAngle, endAngle);
        return `<path d="${dPath}" fill="none" stroke="${palette.confirmed}" stroke-width="9" stroke-linecap="round" stroke-opacity="0.24"></path>`;
      }).join('')
      : '';

    const confirmedBars = confirmedRanges.map((range) => {
      const startAngle = -90 + ((((range.start - 1) + 0.08) / total) * 360);
      const endAngle = -90 + ((((range.end) - 0.08) / total) * 360);
      const dPath = this._arcPath(cx, cy, rInner + extraBar * 0.74, startAngle, endAngle);
      return `<path d="${dPath}" fill="none" stroke="${palette.confirmed}" stroke-width="9" stroke-linecap="round" stroke-opacity="0.78"></path>`;
    }).join('');

    const showFertile = this._config?.show_fertile_period !== false;
    const fertileBars = model.series.map((step) => {
      if (!showFertile) return '';
      if (!step.fertile) return '';
      const day = step.day;
      const startAngle = -90 + ((((day - 1) + 0.08) / total) * 360);
      const endAngle = -90 + ((((day - 0.08) / total) * 360));
      const dPath = this._arcPath(cx, cy, rInner + extraBar * 0.46, startAngle, endAngle);
      return `<path d="${dPath}" fill="none" stroke="${palette.fertile}" stroke-width="6" stroke-linecap="round" stroke-opacity=".62"></path>`;
    }).join('');

    let ovulationMarker = '';
    if (showFertile && model.ovulationDay) {
      const ovulationDt = this._parseISO(model.ovulationDay);
      if (ovulationDt
        && ovulationDt.getFullYear() === this._viewDate.getFullYear()
        && ovulationDt.getMonth() === this._viewDate.getMonth()) {
        const oDay = ovulationDt.getDate();
        if (oDay >= 1 && oDay <= total) {
          const angle = -90 + ((((oDay - 1) + 0.5) / total) * 360);
          const pos = this._polar(cx, cy, rInner + extraBar * 0.46, angle);
          ovulationMarker = `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="5" fill="${palette.ovulation}" stroke="${palette.markerStroke}" stroke-width="1.5" opacity="0.90"></circle>`;
        }
      }
    }

    let predictedMarker = '';
    let predictedBars = '';
    const predictedDt = this._parseISO(model.predicted);
    const showPredictedInView = predictedDt
      && predictedDt.getFullYear() === this._viewDate.getFullYear()
      && predictedDt.getMonth() === this._viewDate.getMonth();
    if (showPredictedInView) {
      const pDay = predictedDt.getDate();
      const marker = (offset, fill, radius) => {
        const d = pDay + offset;
        if (d < 1 || d > total) return '';
        const angle = -90 + ((((d - 1) + 0.5) / total) * 360);
        const pos = this._polar(cx, cy, rInner + extraBar + 3, angle);
        return `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${radius}" fill="${fill}" stroke="${palette.markerStroke}" stroke-width="2"></circle>`;
      };
      predictedMarker = `${marker(-1, '#fb7185', '4.6')}${marker(0, palette.confirmed, '5.5')}${marker(1, '#fb7185', '4.6')}`;

      predictedBars = Array.from({ length: safePeriodDuration }).map((_, idx) => {
        const dt = new Date(predictedDt);
        dt.setDate(dt.getDate() + idx);
        if (dt.getMonth() !== this._viewDate.getMonth() || dt.getFullYear() !== this._viewDate.getFullYear()) return '';
        const day = dt.getDate();
        const startAngle = -90 + ((((day - 1) + 0.06) / total) * 360);
        const endAngle = -90 + ((((day - 0.06) / total) * 360));
        const dPath = this._arcPath(cx, cy, rInner + extraBar * 0.74, startAngle, endAngle);
        const alpha = idx === 0 ? 0.60 : 0.38;
        const sw = idx === 0 ? 8.6 : 7.2;
        return `<path d="${dPath}" fill="none" stroke="${palette.confirmed}" stroke-width="${sw}" stroke-linecap="round" stroke-opacity="${alpha}"></path>`;
      }).join('');
    }

    const handA = this._polar(cx, cy, rInner - 2, handAngle);
    const handB = this._polar(cx, cy, rInner + extraBar - 2, handAngle);
    const monthLabel = new Intl.DateTimeFormat(this._hass?.locale?.language || 'de', { month: 'long' }).format(this._viewDate);

    return `
      <svg class="gauge" viewBox="0 0 420 420" role="img" aria-label="Menstruation gauge">
        <text x="${cx}" y="44" class="month">${monthLabel}</text>
        ${dayLabels}
        ${baseTicks}
        ${fertileBars}
        ${ovulationMarker}
        ${currentMonthPeriodWindowBars}
        ${confirmedBars}
        ${predictedBars}
        ${predictedMarker}
        ${isCurrentViewMonth ? `<line x1="${handA.x.toFixed(1)}" y1="${handA.y.toFixed(1)}" x2="${handB.x.toFixed(1)}" y2="${handB.y.toFixed(1)}" stroke="${palette.hand}" stroke-width="1.9" stroke-linecap="round"></line>` : ''}
        <circle cx="${cx}" cy="${cy}" r="106" fill="none" stroke="${palette.ring}" stroke-width="1"></circle>
      </svg>
    `;
  }

  _renderCenterContent(model, palette, canEdit, isOverdueSoon, countdown) {
    if (!model.pregnancyInfo?.isPregnant) {
      const statusIconMarkup = window.ProductIcons?.getStatusIcon?.(model.state, 64) || '';
      return `
        <button type="button" class="center-panel ${isOverdueSoon ? 'overdue-soon' : ''} ${canEdit ? '' : 'passive'}" data-action="toggle-editor">
          ${statusIconMarkup ? `<div class="center-icon" aria-hidden="true">${statusIconMarkup}</div>` : ''}
          <div class="center-days">${countdown}</div>
        </button>
      `;
    }

    const pregnancyInfo = model.pregnancyInfo;
    const iconMarkup = window.ProductIcons?.getPregnancyIcon?.(pregnancyInfo, 56)
      || window.ProductIcons?.getStatusAnimatedIcon?.('pregnant', pregnancyInfo, 56)
      || '';
    const secondaryParts = [`${this._t('month')} ${pregnancyInfo.month}`];
    if (Number.isFinite(Number(pregnancyInfo.trimester))) {
      secondaryParts.push(`${this._t('trimester')} ${pregnancyInfo.trimester}`);
    }

    return `
      <button type="button" class="center-panel pregnancy-panel ${canEdit ? '' : 'passive'}" data-action="toggle-editor">
        <div class="center-icon" aria-hidden="true">${iconMarkup}</div>
        <div class="center-primary">${this._t('week')} ${pregnancyInfo.week}</div>
        <div class="center-secondary">${secondaryParts.join(' · ')}</div>
      </button>
    `;
  }

  _calendarGrid(model, locale) {
    const y = this._viewDate.getFullYear();
    const m = this._viewDate.getMonth();
    const first = new Date(y, m, 1, 12, 0, 0, 0);
    const count = new Date(y, m + 1, 0).getDate();
    const firstDowMon0 = (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((firstDowMon0 + count) / 7) * 7;
    const dows = this._weekdayLabels(locale || this._hass?.locale?.language || 'de');

    const items = [];
    dows.forEach((d) => items.push(`<div class="dow">${d}</div>`));

    for (let i = 0; i < totalCells; i++) {
      const day = i - firstDowMon0 + 1;
      const valid = day >= 1 && day <= count;
      if (!valid) {
        items.push('<button class="day other" type="button" disabled></button>');
        continue;
      }
      const iso = this._isoFromDate(new Date(y, m, day, 12, 0, 0, 0));
      const active = model.confirmedSet.has(iso);
      const today = iso === model.todayIso;
      const hasSymptoms = !!model.symptomByDate?.[iso];
      items.push(`<button class="day ${active ? 'active' : ''} ${today ? 'today' : ''} ${hasSymptoms ? 'has-symptoms' : ''}" type="button" data-iso="${iso}">${day}</button>`);
    }
    return items.join('');
  }

  _weekdayLabels(locale) {
    const monday = new Date(Date.UTC(2026, 0, 5)); // Monday
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const label = formatter.format(d).replace('.', '').trim();
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  }

  async _toggleCycleStart(iso) {
    if (this._config?.calendar_edit_enabled === false) return;
    const model = this._buildModel();
    if (model.pregnancyInfo?.isPregnant) return;
    const service = model.confirmedSet.has(iso) ? 'remove_cycle_start' : 'add_cycle_start';
    const profile = model.stateObj?.attributes?.profile;
    const entityId = model.entityId || this._config?.entity || '';
    const entryId = model.stateObj?.attributes?.entry_id || this._config?.entry_id || '';
    const attempts = [];
    attempts.push({ date: iso, ...(entityId ? { entity_id: entityId } : {}), ...(profile ? { profile } : {}), ...(entryId ? { entry_id: entryId } : {}) });
    attempts.push({ date: iso, ...(entityId ? { entity_id: entityId } : {}), ...(profile ? { profile } : {}) });
    attempts.push({ date: iso, ...(profile ? { profile } : {}), ...(entryId ? { entry_id: entryId } : {}) });
    attempts.push({ date: iso, ...(profile ? { profile } : {}) });
    attempts.push({ date: iso });

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

  _renderSymptomModal(iso, model, palette) {
    const dt = this._parseISO(iso);
    const locale = this._hass?.locale?.language || 'de';
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
      if (cat.hiddenInModal) {
        return '';
      }
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
          </div>
        `;
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
        <div class="sym-dialog" style="border-color:${palette.border};background:${palette.cardBg};color:${palette.cardColor}">
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
            <button type="button" class="btn sym-cancel">${this._t('cancel')}</button>
          </div>
        </div>
      </div>
    `;
  }

  _periodSaveLabel(iso, model) {
    if (iso !== model?.todayIso) {
      return this._t('save');
    }
    if (model?.currentBleedingBlock?.is_active) {
      return this._t('log_today');
    }
    return this._t('period_start');
  }

  async _handleModalSave() {
    const iso = this._modalIso;
    if (!iso) return;

    const root = this.shadowRoot;
    const model = this._buildModel();
    const entityId = model.entityId || this._config?.entity || '';
    const entryId = model.stateObj?.attributes?.entry_id || this._config?.entry_id || '';
    const profile = model.stateObj?.attributes?.profile;

    // Determine period toggle state from modal
    const periodModalContext = this._periodModalContext(iso, model);
    const allowPeriodToggle = !model.pregnancyInfo?.isPregnant && model.state !== 'pre_menarche' && periodModalContext.showPeriodToggle;
    const periodYesBtn = root.querySelector('.sym-opt-btn[data-cat="_period"][data-val="yes"]');
    const wantsPeriod = allowPeriodToggle
      ? (periodYesBtn?.classList.contains('sym-selected') ?? model.confirmedSet.has(iso))
      : model.confirmedSet.has(iso);
    const hasPeriod = model.confirmedSet.has(iso);

    // Collect symptom data from modal inputs
    const symptomData = {};
    this._symptomConfig(model.state, model.pregnancyInfo?.isPregnant).forEach((cat) => {
      if (cat.hiddenInModal) {
        return;
      }
      if (cat.multi) {
        const checked = Array.from(root.querySelectorAll(`.sym-multi[name="${cat.key}"]:checked`)).map((el) => el.value);
        if (checked.length > 0) symptomData[cat.key] = checked;
      } else {
        const selected = root.querySelector(`.sym-opt-btn.sym-selected[data-cat="${cat.key}"]`);
        if (selected) symptomData[cat.key] = selected.getAttribute('data-val');
      }
    });
    if (symptomData.clots !== 'yes') {
      delete symptomData.clot_size;
    }
    const rawTemp = root.getElementById('sym-basal-temp')?.value;
    const basalTemp = parseFloat(rawTemp);
    if (!Number.isNaN(basalTemp) && rawTemp !== '') symptomData.basal_temp = basalTemp;
    const autoConfirmDays = symptomData.bleeding_strength && symptomData.bleeding_strength !== 'none'
      ? this._daysToAutoConfirm(iso, model, periodModalContext.continuationBlock)
      : [];

    this._modalIso = null;

    // Toggle period start if state changed
    if (allowPeriodToggle && wantsPeriod !== hasPeriod) {
      try {
        await this._toggleCycleStart(iso);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('menstruation-gauge-card: failed to toggle period', err);
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
        console.error('menstruation-gauge-card: failed to auto-confirm period day', err);
      }
    }

    // Save symptom data if any fields are set
    if (Object.keys(symptomData).length > 0) {
      try {
        const payload = {
          date: iso,
          symptom_data: symptomData,
          ...(entityId ? { entity_id: entityId } : {}),
          ...(entryId ? { entry_id: entryId } : {}),
          ...(profile ? { profile } : {}),
        };
        await this._hass.callService('menstruation_gauge', 'add_symptom', payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('menstruation-gauge-card: failed to save symptoms', err);
      }
    }

    await this._refreshSensorEntity(entityId);
    this._render();
  }

  _removeFirstPeriodModal() {
    this.shadowRoot?.querySelector('#pm-first-period-modal')?.remove();
    this._pmModalOpen = false;
  }

  _handleLogFirstPeriod() {
    this._removeFirstPeriodModal();
    this._pendingFirstPeriodSymptoms = null;
    this._pmModalOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'pm-first-period-modal';
    overlay.className = 'pm-overlay';
    overlay.innerHTML = `
      <div class="pm-modal" role="dialog" aria-modal="true">
        <div class="pm-modal-header">
          <span class="pm-modal-emoji">🩸</span>
          <h3>${this._t('log_first_period_symptoms')}</h3>
        </div>
        <div class="pm-modal-body">
          <p class="pm-modal-description">${this._t('first_period_description')}</p>
          <div class="pm-symptom-grid">
            <label class="pm-symptom-btn">
              <input type="checkbox" name="pm-symptom" value="spotting" />
              <span>🩸 ${this._t('spotting')}</span>
            </label>
            <label class="pm-symptom-btn">
              <input type="checkbox" name="pm-symptom" value="discharge" />
              <span>💧 ${this._t('discharge')}</span>
            </label>
            <label class="pm-symptom-btn">
              <input type="checkbox" name="pm-symptom" value="pain" />
              <span>😣 ${this._t('pain')}</span>
            </label>
          </div>
        </div>
        <div class="pm-modal-actions">
          <button type="button" class="btn pm-btn-secondary" data-action="pm-cancel-symptoms">${this._t('cancel')}</button>
          <button type="button" class="btn pm-btn-primary" data-action="pm-confirm-symptoms">${this._t('continue')}</button>
        </div>
      </div>
    `;
    this.shadowRoot?.appendChild(overlay);
  }

  _collectFirstPeriodSymptoms() {
    const root = this.shadowRoot;
    if (!root) return {};
    const symptomData = {};
    if (root.querySelector('input[name="pm-symptom"][value="spotting"]:checked')) {
      symptomData.spotting = 'red';
    }
    if (root.querySelector('input[name="pm-symptom"][value="discharge"]:checked')) {
      symptomData.discharge = 'other';
    }
    if (root.querySelector('input[name="pm-symptom"][value="pain"]:checked')) {
      symptomData.pain = ['cramps'];
    }
    return symptomData;
  }

  _showLeavePreMenarcheDialog() {
    this._pendingFirstPeriodSymptoms = this._collectFirstPeriodSymptoms();
    this._removeFirstPeriodModal();
    this._pmModalOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'pm-first-period-modal';
    overlay.className = 'pm-overlay';
    overlay.innerHTML = `
      <div class="pm-modal" role="dialog" aria-modal="true">
        <div class="pm-modal-header">
          <span class="pm-modal-emoji">🌸</span>
          <h3>${this._t('leave_pre_menarche_title')}</h3>
        </div>
        <div class="pm-modal-body">
          <p class="pm-modal-description">${this._t('leave_pre_menarche_message')}</p>
        </div>
        <div class="pm-modal-actions">
          <button type="button" class="btn pm-btn-secondary" data-action="pm-cancel-leave">${this._t('no')}</button>
          <button type="button" class="btn pm-btn-primary" data-action="pm-confirm-leave">${this._t('yes')}</button>
        </div>
      </div>
    `;
    this.shadowRoot?.appendChild(overlay);
  }

  async _doLogFirstPeriod() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const model = this._buildModel();
      const entityId = model.entityId || this._config?.entity || '';
      const profile = model.stateObj?.attributes?.profile || '';
      const entryId = model.stateObj?.attributes?.entry_id || this._config?.entry_id || '';
      const serviceBase = {
        ...(entityId ? { entity_id: entityId } : {}),
        ...(profile ? { profile } : {}),
        ...(entryId ? { entry_id: entryId } : {}),
      };

      // Log any selected symptoms (include bleeding_strength: light for first period)
      const symptoms = this._pendingFirstPeriodSymptoms || {};
      await this._hass.callService('menstruation_gauge', 'add_symptom', {
        ...serviceBase,
        date: today,
        symptom_data: { bleeding_strength: 'light', ...symptoms },
      });

      // Atomically record menarche date and add cycle start (transitions from pre_menarche to normal)
      await this._hass.callService('menstruation_gauge', 'log_first_period', {
        ...serviceBase,
        date: today,
      });

      this._pendingFirstPeriodSymptoms = null;
      this._showWelcomePeriodPopup();
    } catch (error) {
      console.error('menstruation-gauge-card: error logging first period', error);
      this._removeFirstPeriodModal();
    }
  }

  _showWelcomePeriodPopup() {
    this._removeFirstPeriodModal();
    this._pmModalOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'pm-first-period-modal';
    overlay.className = 'pm-overlay';
    overlay.innerHTML = `
      <div class="pm-modal pm-modal-welcome" role="dialog" aria-modal="true">
        <div class="pm-modal-header">
          <span class="pm-modal-emoji">🎉</span>
          <h3>${this._t('welcome_period_title')}</h3>
        </div>
        <div class="pm-modal-body">
          <ul class="pm-info-list">
            <li>📊 ${this._t('welcome_period_cycle_tracking')}</li>
            <li>✨ ${this._t('welcome_period_features')}</li>
            <li>🌸 ${this._t('welcome_period_contraception')}</li>
            <li>↩️ ${this._t('welcome_period_return')}</li>
          </ul>
        </div>
        <div class="pm-modal-actions pm-modal-actions-center">
          <button type="button" class="btn pm-btn-primary pm-btn-ok" data-action="pm-welcome-ok">OK</button>
        </div>
      </div>
    `;
    this.shadowRoot?.appendChild(overlay);
  }

  _attachHandlers() {
    if (this._handlersAttached) return;
    this._handlersAttached = true;

    // Single delegated click listener on shadowRoot — survives innerHTML replacements
    this.shadowRoot.addEventListener('click', (ev) => {
      // Navigation: previous month
      if (ev.target?.closest('[data-nav="prev"]')) {
        this._viewDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth() - 1, 1);
        this._render();
        return;
      }
      // Navigation: next month
      if (ev.target?.closest('[data-nav="next"]')) {
        this._viewDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth() + 1, 1);
        this._render();
        return;
      }
      // Toggle editor button
      if (this._config?.calendar_edit_enabled !== false && ev.target?.closest('[data-action="toggle-editor"]')) {
        this._editorOpen = !this._editorOpen;
        this._render();
        return;
      }
      // Calendar day cell — open symptom modal
      if (this._config?.calendar_edit_enabled !== false) {
        const dayBtn = ev.target?.closest?.('.day[data-iso]');
        if (dayBtn) {
          ev.stopPropagation();
          ev.preventDefault();
          const iso = dayBtn.getAttribute('data-iso');
          if (iso) {
            this._modalIso = iso;
            this._render();
          }
          return;
        }
      }
      // Modal: close on backdrop / close / cancel
      if (ev.target?.closest('.sym-backdrop') || ev.target?.closest('.sym-close') || ev.target?.closest('.sym-cancel')) {
        this._modalIso = null;
        this._render();
        return;
      }
      // Modal: save
      if (ev.target?.closest('.sym-save')) {
        this._handleModalSave();
        return;
      }
      // Modal: single-select symptom option buttons (event delegation)
      const optBtn = ev.target?.closest('.sym-opt-btn[data-cat]');
      if (optBtn) {
        const cat = optBtn.getAttribute('data-cat');
        const modal = this.shadowRoot.getElementById('sym-modal');
        modal?.querySelectorAll(`.sym-opt-btn[data-cat="${cat}"]`).forEach((b) => b.classList.remove('sym-selected'));
        optBtn.classList.add('sym-selected');
        if (cat === 'clots') {
          const showSize = optBtn.getAttribute('data-val') === 'yes';
          const clotSizeRow = modal?.querySelector('[data-sym-row="clot_size"]');
          if (clotSizeRow) {
            clotSizeRow.classList.toggle('sym-hidden', !showSize);
          }
          if (!showSize) {
            modal?.querySelectorAll('.sym-opt-btn[data-cat="clot_size"]').forEach((b) => b.classList.remove('sym-selected'));
          }
        }
      }
      // First period (pre-menarche) flow buttons
      const pmAction = ev.target?.closest('[data-action]')?.getAttribute('data-action');
      if (pmAction === 'log-first-period') {
        this._handleLogFirstPeriod();
        return;
      }
      if (pmAction === 'pm-confirm-symptoms') {
        this._showLeavePreMenarcheDialog();
        return;
      }
      if (pmAction === 'pm-cancel-symptoms') {
        this._removeFirstPeriodModal();
        return;
      }
      if (pmAction === 'pm-confirm-leave') {
        this._doLogFirstPeriod();
        return;
      }
      if (pmAction === 'pm-cancel-leave') {
        this._handleLogFirstPeriod();
        return;
      }
      if (pmAction === 'pm-welcome-ok') {
        this._removeFirstPeriodModal();
        this._render();
        return;
      }
    });
  }

  _buildRenderKey(model, countdown, isOverdueSoon, canEdit, cardTitle, friendlyName) {
    return [
      model.state,
      model.pregnancyInfo?.isPregnant ? 1 : 0,
      model.pregnancyInfo?.week,
      model.pregnancyInfo?.month,
      model.pregnancyInfo?.trimester,
      countdown,
      model.predicted || '',
      model.daysUntilMenarche,
      isOverdueSoon ? 1 : 0,
      this._editorOpen ? 1 : 0,
      this._viewDate?.getFullYear(),
      this._viewDate?.getMonth(),
      this._lastCardWidth,
      this._lang(),
      [...model.confirmedSet].sort().join(','),
      model.fertileStart || '',
      model.fertileEnd || '',
      model.ovulationDay || '',
      this._modalIso || '',
      canEdit ? 1 : 0,
      this._resolveThemeMode(),
      cardTitle,
      friendlyName,
      Object.keys(model.symptomByDate || {}).sort().join(','),
    ].join('|');
  }

  _render() {
    this._ensureRoot();
    if (!this._config || !this._hass) return;

    const model = this._buildModel();
    const palette = this._palette(model.state);
    // Use width from ResizeObserver; fall back to a direct measurement only if not yet available.
    if (!this._lastCardWidth) {
      this._lastCardWidth = this.getBoundingClientRect()?.width || 0;
    }
    const locale = this._hass?.locale?.language || 'de';
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(this._viewDate);
    const cardTitle = String(this._config.title || '').trim();
    const friendlyName = String(this._config.friendly_name || model.stateObj?.attributes?.friendly_name || '').trim();
    const canEdit = this._config?.calendar_edit_enabled !== false;
    const daysUntil = Number(model.stateObj?.attributes?.days_until_next_start);
    const isPreMenarche = model.state === 'pre_menarche' && model.menarcheData?.estimated_date;
    const isOverdueSoon = !isPreMenarche && Number.isFinite(daysUntil) && daysUntil <= -3;
    const countdown = isPreMenarche && Number.isFinite(model.daysUntilMenarche)
      ? (model.daysUntilMenarche >= 0
        ? this._t('menarche_expected_in').replace('{days}', String(model.daysUntilMenarche))
        : this._t('menarche_overdue').replace('{days}', String(Math.abs(model.daysUntilMenarche))))
      : (Number.isFinite(daysUntil)
        ? `${daysUntil} ${this._t('days_unit')}`
        : this._t('days_unknown'));

    // Skip full DOM replacement when nothing visible has changed — prevents
    // the pregnancy SVG mask from being torn down and re-applied on every
    // unrelated hass state push (which caused the preg_02.svg flicker).
    const renderKey = this._buildRenderKey(model, countdown, isOverdueSoon, canEdit, cardTitle, friendlyName);
    if (renderKey === this._lastRenderKey) {
      this._attachHandlers();
      return;
    }
    this._lastRenderKey = renderKey;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; position: relative; }
        .root-wrap { position: relative; }
        ha-card {
          border-radius: 16px;
          border: 1px solid ${palette.border};
          background: ${palette.cardBg};
          color: ${palette.cardColor};
          box-shadow: ${palette.shadow};
          padding: 10px;
          overflow: hidden;
        }
        .wrap { display: grid; gap: 10px; }
        .head { display: grid; gap: 2px; }
        .friendly { font-size: .78rem; font-weight: 600; color: ${palette.monthText}; text-align: left; }
        .title-label { font-size: .95rem; font-weight: 700; color: ${palette.cardColor}; text-align: left; }
        .gauge-wrap { position: relative; max-width: 420px; width: 100%; aspect-ratio: 1/1; margin: 0 auto; }
        .gauge { width: 100%; height: 100%; display: block; }
        .month { font-size: 12px; fill: ${palette.monthText}; font-weight: 700; letter-spacing: .02em; text-anchor: middle; dominant-baseline: middle; }
        .center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; padding: 52px; box-sizing: border-box; }
        .countdown { pointer-events: auto; border-radius: 999px; border: 1px solid ${palette.buttonBorder}; padding: 4px 10px; background: ${palette.countdownBg}; cursor: pointer; font-size: 1.05rem; font-weight: 700; color: ${palette.countdownColor}; }
        .countdown.overdue-soon { border-style: dashed; border-width: 2px; }
        .countdown.passive { cursor: default; pointer-events: none; opacity: .92; }
        .center-panel {
          pointer-events: auto;
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          max-width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
          cursor: pointer;
          color: ${palette.countdownColor};
        }
        .center-panel.passive { cursor: default; pointer-events: none; opacity: .92; }
        .center-panel.overdue-soon { border: 2px dashed ${palette.buttonBorder}; border-radius: 12px; padding: 6px 10px; }
        .center .pregnancy-panel { border: none; outline: none; background: none; box-shadow: none; padding: 4px 0; min-width: unset; border-radius: 0; -webkit-appearance: none; appearance: none; }
        .center-icon { width: 56px; height: 56px; display: inline-flex; align-items: center; justify-content: center; }
        .center-icon svg { width: 56px; height: 56px; display: block; }
        .center-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .center-days { font-size: 1.05rem; font-weight: 700; line-height: 1.3; }
        .center-primary { font-size: 1rem; font-weight: 700; line-height: 1.2; }
        .center-secondary { font-size: .76rem; line-height: 1.25; opacity: .84; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .title { font-weight: 700; }
        .nav { display: inline-flex; gap: 6px; }
        .btn { border: 1px solid ${palette.buttonBorder}; border-radius: 8px; background: ${palette.buttonBg}; color: ${palette.buttonColor}; padding: 4px 8px; cursor: pointer; }
        .btn[disabled] { cursor: default; opacity: .55; }
        .editor { display: ${this._editorOpen ? 'grid' : 'none'}; gap: 8px; }
        .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .dow { text-align: center; font-size: 12px; opacity: .75; }
        .day { min-height: 32px; border: 1px solid ${palette.dayBorder}; border-radius: 8px; background: ${palette.dayBg}; color: ${palette.dayColor}; cursor: pointer; user-select: none; -webkit-user-select: none; }
        .day.active { background: ${palette.confirmed}; color: #fff; border-color: ${palette.confirmed}; }
        .day.today { outline: 2px solid ${palette.dayToday}; }
        .day.other { opacity: .3; }
        .day.has-symptoms { box-shadow: 0 0 0 2px ${palette.fertile} inset; }
        .day.active.has-symptoms { box-shadow: 0 0 0 2px ${palette.fertile} inset, 0 0 0 4px ${palette.confirmedInset} inset; }
        /* Symptom modal */
        .sym-overlay { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; border-radius: 16px; overflow: hidden; }
        .sym-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); }
        .sym-dialog { position: relative; z-index: 1; border-radius: 12px; border: 1px solid; padding: 0; width: 92%; max-width: 360px; max-height: 85%; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,.32); }
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
        .sym-opt-btn:hover { border-color: rgba(190,18,60,.45); }
        .sym-opt-btn.sym-selected { background: ${palette.confirmed}; color: #fff; border-color: ${palette.confirmed}; }
        .sym-opt-label { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: .82rem; }
        .sym-opt-label input[type="checkbox"] { accent-color: ${palette.confirmed}; }
        .sym-temp-input { padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(128,128,128,.35); background: transparent; color: inherit; font-size: .88rem; width: 100px; }
        .sym-disabled { opacity: .62; }
        /* Pre-Menarche first period flow */
        .btn-log-first-period { display: block; width: 100%; padding: 10px 16px; font-size: .95rem; font-weight: 600; cursor: pointer; border-radius: 10px; border: 2px solid ${palette.confirmed}; background: ${palette.confirmed}; color: #fff; }
        .btn-log-first-period:hover { opacity: .88; }
        .pm-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .pm-modal { background: ${palette.cardBg}; color: ${palette.cardColor}; border-radius: 16px; padding: 24px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 16px; }
        .pm-modal-header { display: flex; align-items: center; gap: 12px; }
        .pm-modal-emoji { font-size: 2rem; line-height: 1; flex-shrink: 0; }
        .pm-modal-header h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
        .pm-modal-body { color: ${palette.cardColor}; }
        .pm-modal-description { margin: 0 0 12px 0; font-size: 0.95rem; opacity: .8; line-height: 1.5; }
        .pm-symptom-grid { display: flex; flex-direction: column; gap: 8px; }
        .pm-symptom-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid ${palette.border}; border-radius: 8px; cursor: pointer; font-size: 0.95rem; color: ${palette.cardColor}; transition: border-color 0.15s ease, background 0.15s ease; }
        .pm-symptom-btn:hover { border-color: ${palette.confirmed}; background: rgba(${palette.confirmed},0.1); }
        .pm-symptom-btn input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
        .pm-info-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .pm-info-list li { padding: 10px 14px; background: rgba(39,174,96,0.12); border: 1px solid rgba(39,174,96,0.3); border-radius: 8px; font-size: 0.9rem; line-height: 1.4; }
        .pm-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .pm-modal-actions-center { justify-content: center; }
        .pm-btn-primary { background: ${palette.confirmed}; color: #fff; padding: 10px 24px; flex: none; border-color: ${palette.confirmed}; font-weight: 600; }
        .pm-btn-primary:hover { opacity: .88; }
        .pm-btn-secondary { background: #95a5a6; color: #fff; padding: 10px 20px; flex: none; border-color: #95a5a6; }
        .pm-btn-secondary:hover { background: #7f8c8d; border-color: #7f8c8d; }
        .pm-btn-ok { min-width: 100px; }
        @media (max-width: 420px) {
          .center { padding: 64px; }
          .center-panel { min-width: 124px; padding: 10px 12px; }
          .center .pregnancy-panel { padding: 4px 0; min-width: unset; border-radius: 0; }
          .center-icon { width: 44px; height: 44px; }
          .center-icon svg { width: 44px; height: 44px; }
          .center-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }
          .center-primary { font-size: .92rem; }
          .center-secondary { font-size: .72rem; }
        }
      </style>
      <div class="root-wrap">
        <ha-card>
          <div class="wrap">
            ${(friendlyName || cardTitle) ? `
            <div class="head">
              ${friendlyName ? `<div class="friendly">${friendlyName}</div>` : ''}
              ${cardTitle ? `<div class="title-label">${cardTitle}</div>` : ''}
            </div>` : ''}
            <div class="gauge-wrap">
              ${this._renderGauge(model, palette)}
              <div class="center">${this._renderCenterContent(model, palette, canEdit, isOverdueSoon, countdown)}</div>
            </div>
            ${model.state === 'pre_menarche' ? `
            <div style="padding: 0 4px;">
              <button type="button" class="btn btn-log-first-period" data-action="log-first-period">
                🩸 ${this._t('log_first_period')}
              </button>
            </div>` : ''}
            ${this._config.show_editor && canEdit ? `
            <div class="editor">
              <div class="toolbar">
                <div class="title">${monthYear}</div>
                <div class="nav">
                  <button type="button" class="btn" data-nav="prev">◀</button>
                  <button type="button" class="btn" data-nav="next">▶</button>
                </div>
              </div>
              <div class="grid">${this._calendarGrid(model, locale)}</div>
            </div>` : ''}
          </div>
        </ha-card>
        ${this._modalIso ? this._renderSymptomModal(this._modalIso, model, palette) : ''}
      </div>
    `;

    this._attachHandlers();
  }
}

class MenstruationGaugeCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handlersAttached = false;
    this._onEditorChange = null;
    this._onEditorClick = null;
    this._onEditorInput = null;
    this._onEditorKeydown = null;
    this._editorEntities = [];
  }

  setConfig(config) {
    this._config = {
      theme_mode: 'auto',
      show_fertile_period: true,
      calendar_edit_enabled: true,
      period_duration_days: 5,
      ...config
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Avoid stealing focus while user is typing in the editor.
    if (this.shadowRoot?.activeElement) return;
    this._render();
  }

  disconnectedCallback() {
    this._detachHandlers();
  }

  _lang() {
    const language = String(this._hass?.locale?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        entity: 'Entität',
        fallback_note: 'HA-Entity-Picker nicht verfügbar, Fallback-Dropdown aktiv.',
        sensor_search: 'Sensor suchen...',
        friendly_name: 'Anzeigename (Gauge)',
        use_sensor_name: 'Aus Sensor',
        title: 'Titel',
        period_duration: 'Periodendauer (Zahl 1-14 oder "learnt", leer = Sensorwert)',
        period_placeholder: 'z. B. 5 oder "learnt"',
        theme: 'Theme',
        theme_auto: 'auto',
        theme_light: 'hell',
        theme_dark: 'dunkel',
        show_fertile: 'Fruchtbare Phase anzeigen',
        calendar_edit: 'Neue Einträge im Kalender erlauben',
      },
      en: {
        entity: 'Entity',
        fallback_note: 'HA entity picker unavailable, fallback dropdown active.',
        sensor_search: 'Search sensor...',
        friendly_name: 'Friendly Name (Gauge)',
        use_sensor_name: 'From sensor',
        title: 'Title',
        period_duration: 'Period Duration (number 1-14 or "learnt", empty = sensor value)',
        period_placeholder: 'e.g. 5 or "learnt"',
        theme: 'Theme',
        theme_auto: 'auto',
        theme_light: 'light',
        theme_dark: 'dark',
        show_fertile: 'Show fertile period',
        calendar_edit: 'Allow new entries through calendar',
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
  }

  _sensorLabelFromEntity(entityId) {
    const normalized = String(entityId || '').trim();
    if (!normalized) return '';
    const attrs = this._hass?.states?.[normalized]?.attributes || {};
    return String(attrs.friendly_name || attrs.name || normalized);
  }

  _entityOptions() {
    const states = this._hass?.states || {};
    return Object.keys(states)
      .filter((entityId) => entityId.startsWith('sensor.'))
      .sort()
      .map((entityId) => ({
        entity_id: entityId,
        label: String(states[entityId]?.attributes?.friendly_name || states[entityId]?.attributes?.name || entityId),
      }));
  }

  _entityOptionsHtml(options, selectedEntity) {
    return (options || []).map((row) => {
      const selected = row.entity_id === selectedEntity ? 'selected' : '';
      return `<option value="${row.entity_id}" ${selected}>${row.label} (${row.entity_id})</option>`;
    }).join('');
  }

  _emit(nextConfig) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true
    }));
  }

  _handleInput(key, value) {
    const next = { ...this._config, [key]: value };
    this._emit(next);
  }

  _applySelectedEntity(valueRaw) {
    const value = String(valueRaw || '').trim();
    if (!value) return;
    const next = { ...this._config, entity: value };
    delete next.entry_id;
    if (!String(next.friendly_name || '').trim()) next.friendly_name = this._sensorLabelFromEntity(value);
    this._emit(next);
  }

  _handlePeriodDurationChange(valueRaw) {
    const raw = String(valueRaw || '').trim();
    if (!raw) {
      const next = { ...this._config };
      delete next.period_duration_days;
      this._emit(next);
      return;
    }
    const lowered = raw.toLowerCase();
    if (lowered === 'learnt' || lowered === 'learned') {
      this._handleInput('period_duration_days', 'learnt');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(1, Math.min(14, Math.round(parsed)));
    this._handleInput('period_duration_days', clamped);
  }

  _handleEntitySearchInput(valueRaw) {
    const entitySelect = this.shadowRoot?.getElementById('entity_select');
    if (!entitySelect) return;
    const needle = String(valueRaw || '').trim().toLowerCase();
    const filtered = needle
      ? this._editorEntities.filter((row) => `${row.label} ${row.entity_id}`.toLowerCase().includes(needle))
      : this._editorEntities;
    entitySelect.innerHTML = this._entityOptionsHtml(filtered, String(this._config.entity || ''));
    if (!entitySelect.value && filtered.length) entitySelect.value = filtered[0].entity_id;
  }

  _attachHandlers() {
    if (this._handlersAttached || !this.shadowRoot) return;
    this._handlersAttached = true;

    this._onEditorChange = (ev) => {
      const target = ev.target;
      if (!target?.id) return;
      if (target.id === 'entity_selector' || target.id === 'entity_picker') {
        this._applySelectedEntity(ev?.detail?.value ?? target.value);
        return;
      }
      if (target.id === 'entity_select') {
        this._applySelectedEntity(target.value);
        return;
      }
      if (target.id === 'friendly_name') return this._handleInput('friendly_name', target.value);
      if (target.id === 'period_duration_days') return this._handlePeriodDurationChange(target.value);
      if (target.id === 'title') return this._handleInput('title', target.value);
      if (target.id === 'theme_mode') return this._handleInput('theme_mode', target.value);
      if (target.id === 'show_fertile_period') return this._handleInput('show_fertile_period', !!target.checked);
      if (target.id === 'calendar_edit_enabled') return this._handleInput('calendar_edit_enabled', !!target.checked);
    };

    this._onEditorClick = (ev) => {
      if (!ev.target?.closest('#use_sensor_name')) return;
      const entitySelector = this.shadowRoot.getElementById('entity_selector');
      const entityPicker = this.shadowRoot.getElementById('entity_picker');
      const entitySelect = this.shadowRoot.getElementById('entity_select');
      const selected = entitySelector?.value || entityPicker?.value || entitySelect?.value || String(this._config.entity || '');
      const fromSensor = this._sensorLabelFromEntity(selected);
      this._emit({ ...this._config, friendly_name: fromSensor || '' });
    };

    this._onEditorInput = (ev) => {
      if (ev.target?.id === 'entity_search') {
        this._handleEntitySearchInput(ev.target.value);
      }
    };

    this._onEditorKeydown = (ev) => {
      if (ev.target?.id !== 'entity_search' || ev.key !== 'Enter') return;
      ev.preventDefault();
      const entitySelect = this.shadowRoot?.getElementById('entity_select');
      this._applySelectedEntity(entitySelect?.value);
    };

    this.shadowRoot.addEventListener('change', this._onEditorChange);
    this.shadowRoot.addEventListener('value-changed', this._onEditorChange);
    this.shadowRoot.addEventListener('click', this._onEditorClick);
    this.shadowRoot.addEventListener('input', this._onEditorInput);
    this.shadowRoot.addEventListener('keydown', this._onEditorKeydown);
  }

  _detachHandlers() {
    if (!this.shadowRoot || !this._handlersAttached) return;
    this.shadowRoot.removeEventListener('change', this._onEditorChange);
    this.shadowRoot.removeEventListener('value-changed', this._onEditorChange);
    this.shadowRoot.removeEventListener('click', this._onEditorClick);
    this.shadowRoot.removeEventListener('input', this._onEditorInput);
    this.shadowRoot.removeEventListener('keydown', this._onEditorKeydown);
    this._onEditorChange = null;
    this._onEditorClick = null;
    this._onEditorInput = null;
    this._onEditorKeydown = null;
    this._handlersAttached = false;
  }

  _render() {
    if (!this._config) return;
    const entities = this._entityOptions();
    this._editorEntities = entities;
    const selectedEntity = String(this._config.entity || '');
    const hasHaSelector = Boolean(customElements.get('ha-selector'));
    const hasHaEntityPicker = Boolean(customElements.get('ha-entity-picker'));
    const options = this._entityOptionsHtml(entities, selectedEntity);

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 10px; padding: 2px 0; }
        .row { display: grid; gap: 4px; }
        .inline { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
        .entity { display: grid; gap: 6px; }
        .entity-fallback { display: grid; gap: 6px; }
        label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
        input, select, button, ha-entity-picker, ha-selector { width: 100%; box-sizing: border-box; }
        input, select, button {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        button { width: auto; cursor: pointer; }
        .check { display: flex; gap: 8px; align-items: center; justify-content: flex-start; text-align: left; }
        .check input[type="checkbox"] { width: auto; min-width: 0; margin: 0; }
        .fallback-note { font-size: 11px; color: var(--secondary-text-color); opacity: .85; }
      </style>
      <div class="wrap">
        <div class="row">
          <label>${this._t('entity')}</label>
          <div class="entity">
          ${hasHaSelector
            ? '<ha-selector id="entity_selector"></ha-selector>'
            : hasHaEntityPicker
            ? '<ha-entity-picker id="entity_picker"></ha-entity-picker>'
            : `<div class="entity-fallback"><input id="entity_search" type="text" placeholder="${this._t('sensor_search')}"><select id="entity_select" size="8">${options}</select><div class="fallback-note">${this._t('fallback_note')}</div></div>`}
          </div>
        </div>
        <div class="row">
          <label>${this._t('friendly_name')}</label>
          <div class="inline">
            <input id="friendly_name" value="${this._config.friendly_name || ''}" placeholder="Anna">
            <button id="use_sensor_name" type="button">${this._t('use_sensor_name')}</button>
          </div>
        </div>
        <div class="row">
          <label>${this._t('title')}</label>
          <input id="title" value="${this._config.title || ''}" placeholder="Cycle Gauge">
        </div>
        <div class="row">
          <label>${this._t('period_duration')}</label>
          <input id="period_duration_days" type="text" value="${String(this._config.period_duration_days ?? '')}" placeholder='${this._t('period_placeholder')}'>
        </div>
        <div class="row">
          <label>${this._t('theme')}</label>
          <select id="theme_mode">
            <option value="auto" ${this._config.theme_mode === 'auto' ? 'selected' : ''}>${this._t('theme_auto')}</option>
            <option value="light" ${this._config.theme_mode === 'light' ? 'selected' : ''}>${this._t('theme_light')}</option>
            <option value="dark" ${this._config.theme_mode === 'dark' ? 'selected' : ''}>${this._t('theme_dark')}</option>
          </select>
        </div>
        <label class="check"><input type="checkbox" id="show_fertile_period" ${this._config.show_fertile_period !== false ? 'checked' : ''}> ${this._t('show_fertile')}</label>
        <label class="check"><input type="checkbox" id="calendar_edit_enabled" ${this._config.calendar_edit_enabled !== false ? 'checked' : ''}> ${this._t('calendar_edit')}</label>
      </div>
    `;

    const entitySelector = this.shadowRoot.getElementById('entity_selector');
    const entityPicker = this.shadowRoot.getElementById('entity_picker');

    if (entitySelector) {
      entitySelector.hass = this._hass;
      entitySelector.selector = { entity: { domain: 'sensor' } };
      entitySelector.value = String(this._config.entity || '');
    }
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = String(this._config.entity || '');
      entityPicker.includeDomains = ['sensor'];
      entityPicker.allowCustomEntity = false;
    }
    this._attachHandlers();
  }
}

customElements.define('menstruation-gauge-card', MenstruationGaugeCard);
customElements.define('menstruation-gauge-card-editor', MenstruationGaugeCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-gauge-card',
  name: localize('card.name', this.hass.language),
  description: localize('card_description', this.hass.language)
});
