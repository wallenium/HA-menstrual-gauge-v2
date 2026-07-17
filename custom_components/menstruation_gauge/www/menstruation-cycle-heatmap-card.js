class MenstruationCycleHeatmapCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstruation-cycle-heatmap-card',
      entity: 'sensor.menstruation',
      entry_id: '',
      title: 'Zyklus Heatmap',
      max_cycles: 18,
      period_duration_days: 5,
      show_fertile_period: true,
      symptom_entities: [],
      cycle_alignment: 'top',
    };
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      max_cycles: 18,
      period_duration_days: 5,
      title: 'Zyklus Heatmap',
      show_fertile_period: true,
      symptom_entities: [],
      cycle_alignment: 'top',
      ...config,
    };
    this._ensureRoot();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  _ensureRoot() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
  }

  _lang() {
    const language = String(this._hass?.locale?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        entity_not_found: 'Entity nicht gefunden',
        unknown: 'unbekannt',
        too_little_history: 'Zu wenig Verlaufsdaten in',
        cycle_start: 'Start',
        day: 'Tag',
        end: 'Ende',
        days_before_end: 'Tage vor Ende',
        symptoms: 'Symptome',
        legend_actual_period: 'Tatsächliche Periode',
        legend_period_window: 'Periodenfenster',
        legend_fertile: 'Fruchtbar (hohe Wahrscheinlichkeit, Standard-Days/Kalendermethode 8-19)',
        legend_ovulation: 'Ovulation (hohe Wahrscheinlichkeit um Tag 14)',
        legend_alignment_bottom: 'Ausrichtung: Zyklusende (E/-Tage)',
        legend_alignment_top: 'Ausrichtung: Zyklusstart (Tag 1..X)',
        scroll: 'scroll',
      },
      en: {
        entity_not_found: 'Entity not found',
        unknown: 'unknown',
        too_little_history: 'Not enough history data in',
        cycle_start: 'Start',
        day: 'Day',
        end: 'End',
        days_before_end: 'days before end',
        symptoms: 'Symptoms',
        legend_actual_period: 'Actual period',
        legend_period_window: 'Period window',
        legend_fertile: 'Fertile (high probability, Standard Days/calendar method 8-19)',
        legend_ovulation: 'Ovulation (high probability around day 14)',
        legend_alignment_bottom: 'Alignment: cycle end (E/-days)',
        legend_alignment_top: 'Alignment: cycle start (day 1..X)',
        scroll: 'scroll',
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
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

  _normalizeISO(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  _parseISO(iso) {
    const normalized = this._normalizeISO(iso);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map((part) => Number(part));
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  _dayDiff(aIso, bIso) {
    const a = this._parseISO(aIso);
    const b = this._parseISO(bIso);
    if (!a || !b) return 0;
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  _toLocalDateLabel(iso) {
    const dt = this._parseISO(iso);
    if (!dt) return iso || '';
    const language = this._hass?.locale?.language || 'de-DE';
    return new Intl.DateTimeFormat(language, {
      day: '2-digit',
      month: '2-digit',
    }).format(dt);
  }

  _startsFromHistory(history) {
    const unique = Array.from(new Set((history || []).map((iso) => this._normalizeISO(iso)).filter(Boolean))).sort();
    if (!unique.length) return [];

    const starts = [unique[0]];
    for (let i = 1; i < unique.length; i += 1) {
      if (this._dayDiff(unique[i], unique[i - 1]) > 2) starts.push(unique[i]);
    }
    return starts;
  }

  _buildCycles(groupedStarts, predictedNextStart) {
    const starts = Array.from(new Set((groupedStarts || []).map((iso) => this._normalizeISO(iso)).filter(Boolean))).sort();
    if (starts.length < 2) return [];

    const cycles = [];
    for (let index = 0; index < starts.length - 1; index += 1) {
      const start = starts[index];
      const end = starts[index + 1];
      const length = this._dayDiff(end, start);
      if (length > 0 && length <= 80) cycles.push({ start, end, length, predicted: false });
    }

    const normalizedPredicted = this._normalizeISO(predictedNextStart);
    const lastStart = starts[starts.length - 1];
    if (normalizedPredicted && lastStart) {
      const predictedLength = this._dayDiff(normalizedPredicted, lastStart);
      if (predictedLength > 0 && predictedLength <= 80) {
        cycles.push({ start: lastStart, end: normalizedPredicted, length: predictedLength, predicted: true });
      }
    }

    return cycles;
  }

  _historyDaySetForCycle(history, cycle) {
    const start = this._parseISO(cycle?.start);
    if (!start) return new Set();

    const days = new Set();
    (history || []).forEach((iso) => {
      const entryDate = this._parseISO(iso);
      if (!entryDate) return;
      const dayOffset = Math.round((entryDate.getTime() - start.getTime()) / 86400000);
      if (dayOffset >= 0 && dayOffset < cycle.length) days.add(dayOffset + 1);
    });
    return days;
  }

  _addDaysISO(startIso, days) {
    const dt = this._parseISO(startIso);
    if (!dt) return null;
    dt.setDate(dt.getDate() + Number(days || 0));
    return this._normalizeISO(dt.toISOString().slice(0, 10));
  }

  _resolveSymptomSources() {
    const rawConfig = Array.isArray(this._config?.symptom_entities) ? this._config.symptom_entities : [];
    const states = this._hass?.states || {};

    return rawConfig.map((rawItem) => {
      const item = typeof rawItem === 'string' ? { entity: rawItem } : (rawItem || {});
      const entityId = String(item.entity || item.entity_id || '').trim();
      if (!entityId || !states[entityId]) return null;

      const stateObj = states[entityId];
      const attrs = stateObj?.attributes || {};
      const configuredDates = Array.isArray(item.dates) ? item.dates : null;
      const datesRaw = configuredDates
        || (Array.isArray(attrs.dates) ? attrs.dates : null)
        || (Array.isArray(attrs.date_list) ? attrs.date_list : null)
        || (Array.isArray(attrs.history) ? attrs.history : null)
        || [];
      const dates = new Set(datesRaw.map((iso) => this._normalizeISO(iso)).filter(Boolean));
      if (!dates.size) return null;

      return {
        name: item.name || attrs.friendly_name || attrs.name || entityId,
        icon: item.icon || attrs.icon || 'mdi:alert-circle-outline',
        dates,
      };
    }).filter(Boolean);
  }

  _symptomsForDate(symptomSources, dateIso) {
    return (symptomSources || []).filter((source) => source.dates.has(dateIso));
  }

  _symptomConfig() {
    return [
      { key: 'bleeding_strength', icon: 'mdi:water-opacity' },
      { key: 'spotting', icon: 'mdi:blood-bag' },
      { key: 'intercourse', icon: 'mdi:heart' },
      { key: 'pain', icon: 'mdi:emoticon-sad-outline' },
      { key: 'hygiene', icon: 'mdi:medical-bag' },
      { key: 'test', icon: 'mdi:test-tube' },
      { key: 'basal_temp', icon: 'mdi:thermometer' },
    ];
  }

  _resolveBuiltinSymptomSources() {
    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    const symptomHistory = Array.isArray(stateObj?.attributes?.symptom_history)
      ? stateObj.attributes.symptom_history
      : [];

    if (!symptomHistory.length) return [];

    const sources = [];
    for (const cat of this._symptomConfig()) {
      const dates = new Set();
      for (const entry of symptomHistory) {
        const iso = this._normalizeISO(entry?.date);
        if (!iso) continue;
        const val = entry[cat.key];
        if (val === null || val === undefined) continue;
        if (Array.isArray(val) && val.length === 0) continue;
        dates.add(iso);
      }
      if (dates.size > 0) sources.push({ name: cat.key, icon: cat.icon, dates });
    }
    return sources;
  }

  _phaseClass(day, cycleLength, showFertile) {
    if (!showFertile) return '';
    const fertileStart = 8;
    const fertileEnd = Math.min(19, cycleLength);
    const ovulationDay = Math.min(Math.max(14, fertileStart), fertileEnd);
    if (day === ovulationDay) return 'is-ovulation';
    if (day >= fertileStart && day <= fertileEnd) return 'is-fertile';
    return '';
  }

  _bindHeatmapScrollCues() {
    const root = this.shadowRoot;
    if (!root) return;
    const wrap = root.querySelector('.heatmap-wrap');
    const heatmap = root.querySelector('.heatmap');
    const cueLeft = root.querySelector('.scroll-cue.left');
    const cueRight = root.querySelector('.scroll-cue.right');
    if (!wrap || !heatmap || !cueLeft || !cueRight) return;

    const update = () => {
      const hasOverflow = heatmap.scrollWidth > heatmap.clientWidth + 1;
      const canLeft = heatmap.scrollLeft > 1;
      const canRight = heatmap.scrollLeft + heatmap.clientWidth < heatmap.scrollWidth - 1;
      wrap.classList.toggle('is-scrollable', hasOverflow);
      cueLeft.classList.toggle('active', hasOverflow && canLeft);
      cueRight.classList.toggle('active', hasOverflow && canRight);
    };

    heatmap.addEventListener('scroll', update, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(heatmap);
      this._heatmapCueObserver = observer;
    }
    requestAnimationFrame(update);
  }

  _render() {
    if (this._heatmapCueObserver) {
      this._heatmapCueObserver.disconnect();
      this._heatmapCueObserver = null;
    }
    this._ensureRoot();
    if (!this._config || !this.shadowRoot) return;

    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    if (!stateObj) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div class="pad">${this._t('entity_not_found')}: ${this._config.entity || this._config.entry_id || this._t('unknown')}</div>
        </ha-card>
      `;
      return;
    }

    const attrs = stateObj.attributes || {};
    const history = Array.isArray(attrs.history) ? attrs.history : [];
    const groupedStartsAttr = Array.isArray(attrs.grouped_starts) ? attrs.grouped_starts : [];
    const groupedStarts = groupedStartsAttr.length ? groupedStartsAttr : this._startsFromHistory(history);
    const predictedNextStart = attrs.next_predicted_start || null;
    const cycles = this._buildCycles(groupedStarts, predictedNextStart);

    const maxCycles = Math.max(1, Number(this._config.max_cycles || 18));
    const visibleCycles = cycles.slice(-maxCycles);
    const maxCycleLength = Math.max(1, ...visibleCycles.map((cycle) => cycle.length));

    const sensorPeriodDays = Number(attrs.period_duration_days || 5);
    const periodDays = Math.max(1, Math.min(14, Number(this._config.period_duration_days || sensorPeriodDays || 5)));
    const showFertile = this._config.show_fertile_period !== false;
    const symptomSources = [...this._resolveSymptomSources(), ...this._resolveBuiltinSymptomSources()];
    const todayIso = this._normalizeISO(new Date().toISOString().slice(0, 10));
    const alignMode = String(this._config.cycle_alignment || 'top').toLowerCase() === 'bottom' ? 'bottom' : 'top';

    if (!visibleCycles.length) {
      this.shadowRoot.innerHTML = `
        <style>
          .pad { padding: 16px; color: var(--secondary-text-color); }
        </style>
        <ha-card>
          <div class="pad">${this._t('too_little_history')} <code>grouped_starts/history</code>.</div>
        </ha-card>
      `;
      return;
    }

    const yAxis = Array.from({ length: maxCycleLength }).map((_, rowIndex) => {
      if (alignMode === 'bottom') {
        const daysBeforeEnd = maxCycleLength - rowIndex - 1;
        return `<div class="y-label">${daysBeforeEnd === 0 ? 'E' : `-${daysBeforeEnd}`}</div>`;
      }
      const dayFromStart = rowIndex + 1;
      return `<div class="y-label">${dayFromStart}</div>`;
    }).join('');

    const columns = visibleCycles.map((cycle) => {
      const actualPeriodDays = this._historyDaySetForCycle(history, cycle);
      const dayCells = Array.from({ length: maxCycleLength }).map((_, index) => {
        const rowIndex = index;
        const cycleDay = alignMode === 'bottom'
          ? rowIndex - (maxCycleLength - cycle.length) + 1
          : rowIndex + 1;
        if (cycleDay < 1 || cycleDay > cycle.length) return '<div class="cell spacer" aria-hidden="true"></div>';
        const classes = ['cell'];
        if (cycleDay <= periodDays) classes.push('is-period-window');
        const phase = this._phaseClass(cycleDay, cycle.length, showFertile);
        if (phase) classes.push(phase);
        if (actualPeriodDays.has(cycleDay)) classes.push('is-period-day');
        const dayIso = this._addDaysISO(cycle.start, cycleDay - 1);
        if (dayIso && todayIso && dayIso > todayIso) classes.push('is-future');
        if (dayIso && todayIso && dayIso === todayIso) classes.push('is-today');
        const symptoms = this._symptomsForDate(symptomSources, dayIso);
        if (symptoms.length) classes.push('has-symptom');
        const symptomInfo = symptoms.length ? ` | ${this._t('symptoms')}: ${symptoms.map((item) => item.name).join(', ')}` : '';
        const daysBeforeEnd = cycle.length - cycleDay;
        const tooltip = `${this._t('cycle_start')} ${cycle.start}, ${this._t('day')} ${cycleDay}/${cycle.length} | ${daysBeforeEnd === 0 ? this._t('end') : `${daysBeforeEnd} ${this._t('days_before_end')}`}${symptomInfo}`;
        const symptomIconHtml = symptoms.length
          ? `<span class="symptom-wrap"><ha-icon class="symptom-icon" icon="${symptoms[0].icon}"></ha-icon>${symptoms.length > 1 ? `<span class="symptom-count">${symptoms.length}</span>` : ''}</span>`
          : '';
        return `<div class="${classes.join(' ')}" title="${tooltip}">${symptomIconHtml}</div>`;
      }).join('');

      const predictedClass = cycle.predicted ? ' predicted' : '';
      return `
        <div class="cycle-col${predictedClass}">
          <div class="cells">${dayCells}</div>
        </div>
      `;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
          --mg-border: var(--divider-color, rgba(127, 127, 127, 0.35));
        }
        ha-card {
          --cell-size: 11px;
          --cell-gap: 2px;
          padding: 12px;
          background: var(--mg-card-bg);
          border: 1px solid var(--mg-border);
        }
        .title {
          font-weight: 600;
          margin: 2px 0 10px;
          color: var(--primary-text-color);
        }
        .wrap {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 8px;
          align-items: start;
        }
        .y-axis {
          display: grid;
          grid-template-rows: repeat(${maxCycleLength}, var(--cell-size));
          gap: var(--cell-gap);
          padding-top: 0;
        }
        .y-label {
          height: var(--cell-size);
          line-height: var(--cell-size);
          text-align: right;
          font-size: 10px;
          color: var(--secondary-text-color);
          user-select: none;
        }
        .heatmap {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: min-content;
          gap: 6px;
          overflow-x: auto;
          padding: 0 14px 2px;
        }
        .heatmap-wrap {
          position: relative;
          min-width: 0;
        }
        .scroll-cue {
          position: absolute;
          top: 0;
          bottom: 14px;
          width: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: var(--secondary-text-color);
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms ease;
          z-index: 2;
          user-select: none;
        }
        .scroll-cue.left {
          left: 0;
          background: linear-gradient(90deg, var(--mg-card-bg) 18%, transparent);
        }
        .scroll-cue.right {
          right: 0;
          background: linear-gradient(270deg, var(--mg-card-bg) 18%, transparent);
        }
        .scroll-cue.active { opacity: 0.92; }
        .heatmap-wrap.is-scrollable::after {
          content: '${this._t('scroll')}';
          position: absolute;
          right: 4px;
          bottom: -2px;
          font-size: 9px;
          letter-spacing: 0.03em;
          color: var(--secondary-text-color);
          opacity: 0.8;
          pointer-events: none;
        }
        .cycle-col {
          display: grid;
          grid-template-rows: auto;
          gap: 4px;
          justify-items: center;
        }
        .cells {
          display: grid;
          grid-template-rows: repeat(${maxCycleLength}, var(--cell-size));
          gap: var(--cell-gap);
        }
        .cell {
          width: var(--cell-size);
          height: var(--cell-size);
          border-radius: 2px;
          background: transparent;
          border: 1px solid var(--mg-border);
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }
        .spacer { visibility: hidden; }
        .is-period-window { background: color-mix(in srgb, var(--error-color, #be123c) 16%, transparent); }
        .is-period-day {
          background:
            radial-gradient(circle at 36% 28%, rgba(255,255,255,0.52) 0 16%, transparent 17%),
            linear-gradient(165deg, color-mix(in srgb, var(--error-color, #be123c) 78%, #50051f), color-mix(in srgb, var(--error-color, #be123c) 92%, #ff4f7a));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error-color, #be123c) 30%, transparent);
        }
        .is-fertile { background: color-mix(in srgb, var(--warning-color, #facc15) 50%, transparent); }
        .is-ovulation { background: color-mix(in srgb, var(--success-color, #16a34a) 58%, transparent); }
        .is-future {
          opacity: 0.42;
          filter: saturate(0.7);
        }
        .is-today {
          border: 2px solid var(--primary-text-color);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
          z-index: 1;
        }
        .symptom-wrap {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .symptom-icon {
          --mdc-icon-size: 9px;
          width: 9px;
          height: 9px;
          color: var(--primary-text-color);
          opacity: 0.92;
        }
        .symptom-count {
          position: absolute;
          right: -1px;
          bottom: -1px;
          min-width: 8px;
          height: 8px;
          border-radius: 999px;
          font-size: 6px;
          line-height: 8px;
          text-align: center;
          background: var(--mg-card-bg);
          color: var(--secondary-text-color);
          border: 1px solid var(--mg-border);
          box-sizing: border-box;
        }
        .legend {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          color: var(--secondary-text-color);
          font-size: 11px;
          flex-wrap: wrap;
        }
        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .legend-swatch {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
        @media (prefers-color-scheme: dark) {
          .is-period-window { background: color-mix(in srgb, var(--error-color, #ff6b89) 26%, transparent); }
          .is-fertile { background: color-mix(in srgb, var(--warning-color, #ffd45a) 62%, transparent); }
          .is-ovulation { background: color-mix(in srgb, var(--success-color, #4ade80) 68%, transparent); }
          .is-today { box-shadow: 0 0 0 1px color-mix(in srgb, var(--mg-card-bg) 20%, white); }
        }
      </style>
      <ha-card>
        <div class="title">${this._config.title}</div>
        <div class="wrap">
          <div class="y-axis">${yAxis}</div>
          <div class="heatmap-wrap">
            <div class="scroll-cue left" aria-hidden="true">◀</div>
            <div class="heatmap">${columns}</div>
            <div class="scroll-cue right" aria-hidden="true">▶</div>
          </div>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="legend-swatch is-period-day"></span>${this._t('legend_actual_period')}</span>
          <span class="legend-item"><span class="legend-swatch is-period-window"></span>${this._t('legend_period_window')} (${this._t('day')} 1-${periodDays})</span>
          ${showFertile ? `<span class="legend-item"><span class="legend-swatch is-fertile"></span>${this._t('legend_fertile')}</span><span class="legend-item"><span class="legend-swatch is-ovulation"></span>${this._t('legend_ovulation')}</span>` : ''}
          ${symptomSources.length ? `<span class="legend-item"><ha-icon class="symptom-icon" icon="mdi:sticker-text-outline"></ha-icon>${this._t('symptoms')}</span>` : ''}
          <span class="legend-item">${alignMode === 'bottom' ? this._t('legend_alignment_bottom') : this._t('legend_alignment_top')}</span>
        </div>
      </ha-card>
    `;
    this._bindHeatmapScrollCues();
  }
}

customElements.define('menstruation-cycle-heatmap-card', MenstruationCycleHeatmapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-cycle-heatmap-card',
  name: 'Menstruation Cycle Heatmap',
  description: 'Heatmap mit einer Spalte pro Zyklus und einem Feld pro Zyklustag (grouped_starts kompatibel).',
});
