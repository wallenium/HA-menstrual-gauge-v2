class MenstruationCalendarCard extends HTMLElement {
  constructor() {
    super();
    this._viewDate = new Date();
    this._selectedIso = null;
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
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
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
    let isFertile = false;
    let isOvulation = false;

    const cycleStart = this._cycleStartForDate(iso, ctx.starts);
    if (cycleStart) {
      const idx = ctx.starts.indexOf(cycleStart);
      const next = idx >= 0 ? ctx.starts[idx + 1] : null;
      const window = this._windowForCycleStart(cycleStart, next, ctx.avgCycleLength);
      if (window) {
        isOvulation = iso === window.ovulationDay;
        isFertile = this._dayDiff(iso, window.fertileStart) >= 0 && this._dayDiff(window.fertileEnd, iso) >= 0;
      }
    }

    if (!isOvulation && ctx.sensorOvulation && iso === ctx.sensorOvulation) {
      isOvulation = true;
    }
    if (!isFertile && ctx.sensorFertileStart && ctx.sensorFertileEnd) {
      isFertile = this._dayDiff(iso, ctx.sensorFertileStart) >= 0 && this._dayDiff(ctx.sensorFertileEnd, iso) >= 0;
    }

    const cycleDay = cycleStart ? this._dayDiff(iso, cycleStart) + 1 : null;
    return { isPeriod, isFertile, isOvulation, cycleDay };
  }

  _buildModel() {
    const entityId = this._resolveEntityId();
    const stateObj = this._hass?.states?.[entityId];
    if (!stateObj) return { missing: true, entityId };

    const attrs = stateObj.attributes || {};
    const starts = this._allCycleStarts(attrs);
    const avgCycleLength = this._effectiveCycleLength(attrs);

    return {
      missing: false,
      entityId,
      stateObj,
      attrs,
      starts,
      avgCycleLength,
      periodSet: this._periodHistorySet(attrs),
      sensorFertileStart: this._normalizeISO(attrs.fertile_window_start),
      sensorFertileEnd: this._normalizeISO(attrs.fertile_window_end),
      sensorOvulation: this._normalizeISO(attrs.ovulation_day),
      todayIso: this._isoFromDate(new Date()),
      symptomByDate: this._symptomMap(attrs),
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

  _calendarGrid(model, locale) {
    const y = this._viewDate.getFullYear();
    const m = this._viewDate.getMonth();
    const first = new Date(y, m, 1, 12, 0, 0, 0);
    const count = new Date(y, m + 1, 0).getDate();
    const weekStart = String(this._config?.week_start || 'monday').toLowerCase();
    const firstDow = weekStart === 'sunday' ? first.getDay() : (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((firstDow + count) / 7) * 7;

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
      const classes = [
        'day',
        st.isPeriod ? 'is-period-day' : '',
        (this._config?.show_fertile_period !== false && st.isFertile) ? 'is-fertile' : '',
        (this._config?.show_ovulation_marker !== false && st.isOvulation) ? 'is-ovulation' : '',
        isToday ? 'today' : '',
      ].filter(Boolean).join(' ');

      const cycleHint = Number.isFinite(st.cycleDay)
        ? `${this._t('cycle_day')}: ${st.cycleDay}`
        : this._t('no_data');
      const selected = this._selectedIso === iso;
      items.push(`
        <button
          class="${classes} ${selected ? 'selected' : ''}"
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
          ${(this._config?.show_ovulation_marker !== false && st.isOvulation)
            ? '<span class="ovulation-dot" aria-hidden="true"></span>'
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

  _openDayEditor(iso) {
    this._selectedIso = iso;
    this._focusedIso = iso;
    this._render();
    this.dispatchEvent(new CustomEvent('menstruation-calendar-day-click', {
      detail: { date: iso, entity_id: this._resolveEntityId() },
      bubbles: true,
      composed: true,
    }));
  }

  _closeEditor() {
    this._selectedIso = null;
    this._render();
  }

  async _saveSymptoms() {
    const iso = this._selectedIso;
    const model = this._buildModel();
    if (!iso || model.missing) return;

    const root = this.shadowRoot;
    const bleeding = root?.getElementById('sym_bleeding')?.value;
    const spotting = root?.getElementById('sym_spotting')?.value;
    const painValues = Array.from(root?.querySelectorAll('.sym-pain:checked') || []).map((el) => el.value);

    const symptomData = {};
    if (bleeding && bleeding !== 'none') symptomData.bleeding_strength = bleeding;
    if (spotting && spotting !== 'none') symptomData.spotting = spotting;
    if (painValues.length) symptomData.pain = painValues;

    const profile = model.stateObj?.attributes?.profile;
    const entryId = model.stateObj?.attributes?.entry_id || this._config?.entry_id || '';
    const entityId = model.entityId || this._config?.entity || '';

    try {
      if (Object.keys(symptomData).length > 0) {
        await this._hass.callService('menstruation_gauge', 'add_symptom', {
          date: iso,
          symptom_data: symptomData,
          ...(entityId ? { entity_id: entityId } : {}),
          ...(entryId ? { entry_id: entryId } : {}),
          ...(profile ? { profile } : {}),
        });
      }
      await this._hass.callService('homeassistant', 'update_entity', { entity_id: entityId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('menstruation-calendar-card: failed to save symptom data', err);
    }

    this._closeEditor();
  }

  _selectedDayContent(model) {
    if (!this._selectedIso) return '';
    const iso = this._selectedIso;
    const dt = this._parseISO(iso);
    const locale = this._hass?.locale?.language || 'en';
    const dateLabel = dt
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(dt)
      : iso;
    const st = this._statusForDay(iso, model);
    const existing = model.symptomByDate?.[iso] || {};
    const pain = Array.isArray(existing.pain) ? existing.pain : [];

    return `
      <div class="editor-wrap">
        <div class="editor-head">
          <div class="editor-date">${dateLabel}</div>
          <button type="button" class="btn ghost" data-action="close-editor">✕</button>
        </div>
        <div class="editor-subtitle">${this._t('day_of_cycle')} ${st.cycleDay || '-'} ${this._t('of_cycle')}</div>

        <label class="field">
          <span>${this._t('bleeding_strength')}</span>
          <select id="sym_bleeding">
            <option value="none">${this._t('none')}</option>
            <option value="light" ${existing.bleeding_strength === 'light' ? 'selected' : ''}>Light</option>
            <option value="medium" ${existing.bleeding_strength === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="heavy" ${existing.bleeding_strength === 'heavy' ? 'selected' : ''}>Heavy</option>
            <option value="very_heavy" ${existing.bleeding_strength === 'very_heavy' ? 'selected' : ''}>Very heavy</option>
          </select>
        </label>

        <label class="field">
          <span>${this._t('spotting')}</span>
          <select id="sym_spotting">
            <option value="none">${this._t('none')}</option>
            <option value="red" ${existing.spotting === 'red' ? 'selected' : ''}>Red</option>
            <option value="brown" ${existing.spotting === 'brown' ? 'selected' : ''}>Brown</option>
          </select>
        </label>

        <div class="field">
          <span>${this._t('pain')}</span>
          <label><input type="checkbox" class="sym-pain" value="cramps" ${pain.includes('cramps') ? 'checked' : ''}> Cramps</label>
          <label><input type="checkbox" class="sym-pain" value="mittelschmerz" ${pain.includes('mittelschmerz') ? 'checked' : ''}> Mittelschmerz</label>
          <label><input type="checkbox" class="sym-pain" value="headache" ${pain.includes('headache') ? 'checked' : ''}> Headache</label>
        </div>

        <div class="editor-actions">
          <button type="button" class="btn" data-action="save-symptoms">${this._t('save')}</button>
          <button type="button" class="btn ghost" data-action="close-editor">${this._t('close')}</button>
        </div>
      </div>
    `;
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
        .day-number { font-size: .88rem; font-weight: 650; }
        .cycle-day { font-size: .66rem; color: var(--secondary-text-color); line-height: 1; }
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
        .editor-wrap { border-top: 1px solid var(--divider-color); padding-top: 10px; display: grid; gap: 8px; }
        .editor-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .editor-date { font-size: .92rem; font-weight: 650; }
        .editor-subtitle { font-size: .8rem; color: var(--secondary-text-color); }
        .field { display: grid; gap: 4px; font-size: .8rem; color: var(--secondary-text-color); }
        .field > span { font-weight: 600; }
        .field select { min-height: 34px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); }
        .field label { font-size: .82rem; color: var(--primary-text-color); display: flex; gap: 6px; align-items: center; }
        .editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
        @media (max-width: 480px) {
          .day { min-height: 46px; padding: 5px; border-radius: 10px; }
          .day-number { font-size: .8rem; }
          .cycle-day { font-size: .62rem; }
          .btn { min-height: 36px; }
        }
      </style>
      <ha-card>
        <div class="wrap" id="root">
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
          </div>
          ${this._selectedDayContent(model)}
        </div>
      </ha-card>
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
        if (action === 'close-editor') {
          this._closeEditor();
          return;
        }
        if (action === 'save-symptoms') {
          this._saveSymptoms();
          return;
        }
      }

      const dayBtn = ev.target?.closest?.('[data-iso]');
      const iso = dayBtn?.getAttribute?.('data-iso');
      if (iso) this._openDayEditor(iso);
    });

    root?.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); this._moveFocusByDays(-1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); this._moveFocusByDays(1); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); this._moveFocusByDays(-7); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); this._moveFocusByDays(7); }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target?.matches?.('[data-iso]')) {
        ev.preventDefault();
        const iso = ev.target.getAttribute('data-iso');
        if (iso) this._openDayEditor(iso);
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
