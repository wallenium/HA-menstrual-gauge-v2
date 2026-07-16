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
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
  }

  _lang() {
    const language = String(this._hass?.locale?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: { days_unit: 'Tage', days_unknown: '-- Tage' },
      en: { days_unit: 'days', days_unknown: '-- days' },
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

  _buildModel() {
    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    const attrs = stateObj?.attributes || {};
    const history = Array.isArray(attrs.history) ? attrs.history.map((x) => this._normalizeISO(x)).filter(Boolean) : [];
    const confirmedSet = new Set(history);
    const periodDuration = this._resolvePeriodDuration(attrs);
    const predicted = this._normalizeISO(attrs.next_predicted_start);
    const fertileStart = this._normalizeISO(attrs.fertile_window_start);
    const fertileEnd = this._normalizeISO(attrs.fertile_window_end);
    const ovulationDay = this._normalizeISO(attrs.ovulation_day);

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
        cardColor: '#4a044e',
        border: 'rgba(190,24,93,.20)',
        shadow: '0 8px 20px rgba(131,24,67,.10)',
        monthText: 'rgba(131,24,67,.72)',
        dayLabel: 'rgba(131,24,67,.68)',
        tick: 'rgba(190,24,93,.22)',
        confirmed: '#be123c',
        fertile: '#facc15',
        ovulation: '#16a34a',
        markerStroke: '#ffe4e6',
        hand: '#be123c',
        ring: 'rgba(190,24,93,.16)',
        countdownBg: 'rgba(255,255,255,.44)',
        countdownColor: '#831843',
        buttonBg: '#fff',
        buttonColor: '#831843',
        buttonBorder: 'rgba(190,24,93,.25)',
        dayBg: '#fff',
        dayColor: '#6b1b4a',
        dayBorder: 'rgba(190,24,93,.16)',
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
      cardColor: '#f8d9e9',
      border: 'rgba(251,113,133,.34)',
      shadow: '0 10px 24px rgba(0,0,0,.34)',
      monthText: 'rgba(251,214,232,.82)',
      dayLabel: 'rgba(251,214,232,.78)',
      tick: 'rgba(251,113,133,.42)',
      confirmed: '#fb7185',
      fertile: '#fde047',
      ovulation: '#4ade80',
      markerStroke: '#2f1f29',
      hand: '#fb7185',
      ring: 'rgba(251,113,133,.32)',
      countdownBg: 'rgba(32,20,29,.72)',
      countdownColor: '#ffd4e6',
      buttonBg: 'rgba(41,27,36,.95)',
      buttonColor: '#ffd4e6',
      buttonBorder: 'rgba(251,113,133,.45)',
      dayBg: 'rgba(41,27,36,.95)',
      dayColor: '#f9d8e9',
      dayBorder: 'rgba(251,113,133,.30)',
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
      items.push(`<button class="day ${active ? 'active' : ''} ${today ? 'today' : ''}" type="button" data-iso="${iso}">${day}</button>`);
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

  _attachHandlers() {
    this.shadowRoot.querySelector('[data-nav="prev"]')?.addEventListener('click', () => {
      this._viewDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth() - 1, 1);
      this._render();
    });
    this.shadowRoot.querySelector('[data-nav="next"]')?.addEventListener('click', () => {
      this._viewDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth() + 1, 1);
      this._render();
    });
    if (this._config?.calendar_edit_enabled !== false) {
      this.shadowRoot.querySelector('[data-action="toggle-editor"]')?.addEventListener('click', () => {
        this._editorOpen = !this._editorOpen;
        this._render();
      });
    }

    if (this._config?.calendar_edit_enabled !== false) {
      this.shadowRoot.querySelector('.grid')?.addEventListener('click', async (ev) => {
        const btn = ev.target?.closest?.('.day[data-iso]');
        if (!btn) return;
        const iso = btn.getAttribute('data-iso');
        if (!iso || this._toggleInFlight) return;
        this._toggleInFlight = true;
        try {
          await this._toggleCycleStart(iso);
          await this._refreshSensorEntity(this._buildModel().entityId);
          this._render();
        } catch (err) {
          // Keep a visible trace in browser console when backend rejects the write.
          // This avoids silent failures in the editor calendar.
          // eslint-disable-next-line no-console
          console.error('menstruation-gauge-card: failed to toggle cycle day', err);
        } finally {
          this._toggleInFlight = false;
        }
      });
    }
  }

  _render() {
    this._ensureRoot();
    if (!this._config || !this._hass) return;

    const model = this._buildModel();
    const palette = this._palette(model.state);
    this._lastCardWidth = this.getBoundingClientRect()?.width || 0;
    const locale = this._hass?.locale?.language || 'de';
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(this._viewDate);
    const cardTitle = String(this._config.title || '').trim();
    const friendlyName = String(this._config.friendly_name || model.stateObj?.attributes?.friendly_name || '').trim();
    const canEdit = this._config?.calendar_edit_enabled !== false;
    const daysUntil = Number(model.stateObj?.attributes?.days_until_next_start);
    const isOverdueSoon = Number.isFinite(daysUntil) && daysUntil <= -3;
    const countdown = Number.isFinite(daysUntil)
      ? `${daysUntil} ${this._t('days_unit')}`
      : this._t('days_unknown');

    this.shadowRoot.innerHTML = `
      <style>
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
        .center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .countdown { pointer-events: auto; border-radius: 999px; border: 1px solid ${palette.buttonBorder}; padding: 4px 10px; background: ${palette.countdownBg}; cursor: pointer; font-size: 1.05rem; font-weight: 700; color: ${palette.countdownColor}; }
        .countdown.overdue-soon { border-style: dashed; border-width: 2px; }
        .countdown.passive { cursor: default; pointer-events: none; opacity: .92; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .title { font-weight: 700; }
        .nav { display: inline-flex; gap: 6px; }
        .btn { border: 1px solid ${palette.buttonBorder}; border-radius: 8px; background: ${palette.buttonBg}; color: ${palette.buttonColor}; padding: 4px 8px; cursor: pointer; }
        .editor { display: ${this._editorOpen ? 'grid' : 'none'}; gap: 8px; }
        .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .dow { text-align: center; font-size: 12px; opacity: .75; }
        .day { min-height: 32px; border: 1px solid ${palette.dayBorder}; border-radius: 8px; background: ${palette.dayBg}; color: ${palette.dayColor}; cursor: pointer; }
        .day.active { background: ${palette.confirmed}; color: #fff; border-color: ${palette.confirmed}; }
        .day.today { outline: 2px solid ${palette.dayToday}; }
        .day.other { opacity: .3; }
      </style>
      <ha-card>
        <div class="wrap">
          ${(friendlyName || cardTitle) ? `
          <div class="head">
            ${friendlyName ? `<div class="friendly">${friendlyName}</div>` : ''}
            ${cardTitle ? `<div class="title-label">${cardTitle}</div>` : ''}
          </div>` : ''}
          <div class="gauge-wrap">
            ${this._renderGauge(model, palette)}
            <div class="center"><button type="button" class="countdown ${isOverdueSoon ? 'overdue-soon' : ''} ${canEdit ? '' : 'passive'}" data-action="toggle-editor">${countdown}</button></div>
          </div>
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
    `;

    this._attachHandlers();
  }
}

class MenstruationGaugeCardEditor extends HTMLElement {
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

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const entities = this._entityOptions();
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
    const entitySelect = this.shadowRoot.getElementById('entity_select');
    const entitySearch = this.shadowRoot.getElementById('entity_search');
    const applySelectedEntity = (valueRaw) => {
      const value = String(valueRaw || '').trim();
      if (!value) return;
      const next = { ...this._config, entity: value };
      delete next.entry_id;
      if (!String(next.friendly_name || '').trim()) next.friendly_name = this._sensorLabelFromEntity(value);
      this._emit(next);
    };

    if (entitySelector) {
      entitySelector.hass = this._hass;
      entitySelector.selector = { entity: { domain: 'sensor' } };
      entitySelector.value = String(this._config.entity || '');
      const onSelect = (ev) => applySelectedEntity(ev?.detail?.value);
      entitySelector.addEventListener('value-changed', onSelect);
      entitySelector.addEventListener('change', onSelect);
    }
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = String(this._config.entity || '');
      entityPicker.includeDomains = ['sensor'];
      entityPicker.allowCustomEntity = false;
      const onEntityPick = (ev) => applySelectedEntity(ev?.detail?.value);
      entityPicker.addEventListener('value-changed', onEntityPick);
      entityPicker.addEventListener('change', onEntityPick);
    }
    if (entitySelect) {
      entitySelect.addEventListener('change', (ev) => applySelectedEntity(ev?.target?.value));
      entitySearch?.addEventListener('input', (ev) => {
        const needle = String(ev?.target?.value || '').trim().toLowerCase();
        const filtered = needle
          ? entities.filter((row) => `${row.label} ${row.entity_id}`.toLowerCase().includes(needle))
          : entities;
        entitySelect.innerHTML = this._entityOptionsHtml(filtered, String(this._config.entity || ''));
        if (!entitySelect.value && filtered.length) entitySelect.value = filtered[0].entity_id;
      });
      entitySearch?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          applySelectedEntity(entitySelect?.value);
        }
      });
    }

    this.shadowRoot.getElementById('friendly_name')?.addEventListener('change', (ev) => this._handleInput('friendly_name', ev.target.value));
    this.shadowRoot.getElementById('use_sensor_name')?.addEventListener('click', () => {
      const selected = entitySelector?.value || entityPicker?.value || entitySelect?.value || String(this._config.entity || '');
      const fromSensor = this._sensorLabelFromEntity(selected);
      const next = { ...this._config, friendly_name: fromSensor || '' };
      this._emit(next);
    });
    this.shadowRoot.getElementById('period_duration_days')?.addEventListener('change', (ev) => {
      const raw = String(ev.target.value || '').trim();
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
    });
    this.shadowRoot.getElementById('title')?.addEventListener('change', (ev) => this._handleInput('title', ev.target.value));
    this.shadowRoot.getElementById('theme_mode')?.addEventListener('change', (ev) => this._handleInput('theme_mode', ev.target.value));
    this.shadowRoot.getElementById('show_fertile_period')?.addEventListener('change', (ev) => this._handleInput('show_fertile_period', !!ev.target.checked));
    this.shadowRoot.getElementById('calendar_edit_enabled')?.addEventListener('change', (ev) => this._handleInput('calendar_edit_enabled', !!ev.target.checked));
  }
}

customElements.define('menstruation-gauge-card', MenstruationGaugeCard);
customElements.define('menstruation-gauge-card-editor', MenstruationGaugeCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-gauge-card',
  name: 'Menstruation Gauge Card',
  description: 'Cycle gauge with profile support and visual editor (entity/entry_id/theme/flags).'
});
