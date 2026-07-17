class MenstrualCycleHistoryCardAnalog extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstrual-cycle-history-card-analog',
      entity: 'sensor.menstruation',
      entry_id: '',
      title: 'Zyklus Analog',
      show_labels: true,
      show_fertile_window: true,
      show_pregnancy_status: true,
      show_menarche_status: true,
      size: 'medium',
    };
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      show_labels: true,
      show_fertile_window: true,
      show_pregnancy_status: true,
      show_menarche_status: true,
      size: 'medium',
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
        title: 'Zyklus Analog',
        cycle_day: 'Zyklustag',
        period: 'Periode',
        fertile: 'Fruchtbar',
        ovulation: 'Eissprung',
        pms: 'PMS',
        pregnant: 'Schwanger',
        pre_menarche: 'Vor Menarche',
      },
      en: {
        entity_not_found: 'Entity not found',
        unknown: 'unknown',
        title: 'Cycle Analog',
        cycle_day: 'Cycle Day',
        period: 'Period',
        fertile: 'Fertile',
        ovulation: 'Ovulation',
        pms: 'PMS',
        pregnant: 'Pregnant',
        pre_menarche: 'Pre-Menarche',
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

  _createAnalogCycle(cycleDay, cycleLength, periodDays) {
    const showFertile = this._config.show_fertile_window !== false;
    const radius = 120;
    const centerX = 160;
    const centerY = 160;

    let segments = '';
    for (let day = 1; day <= cycleLength; day++) {
      const startAngle = (day - 1) * (2 * Math.PI / cycleLength) - Math.PI / 2;
      const endAngle = day * (2 * Math.PI / cycleLength) - Math.PI / 2;

      const x1 = centerX + (radius - 20) * Math.cos(startAngle);
      const y1 = centerY + (radius - 20) * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(startAngle);
      const y2 = centerY + radius * Math.sin(startAngle);
      const x3 = centerX + radius * Math.cos(endAngle);
      const y3 = centerY + radius * Math.sin(endAngle);
      const x4 = centerX + (radius - 20) * Math.cos(endAngle);
      const y4 = centerY + (radius - 20) * Math.sin(endAngle);

      let segmentClass = 'segment';
      if (day <= periodDays) segmentClass += ' period';
      else if (showFertile && day >= 8 && day <= 19) {
        if (day === 14) segmentClass += ' ovulation';
        else segmentClass += ' fertile';
      }
      if (day === cycleDay) segmentClass += ' current';

      const path = `M ${x1} ${y1} L ${x2} ${y2} A ${radius} ${radius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${radius - 20} ${radius - 20} 0 0 0 ${x1} ${y1} Z`;
      segments += `<path class="${segmentClass}" d="${path}" />`;
    }

    const currentDayLabel = this._config.show_labels !== false ? `<text x="${centerX}" y="${centerY - 60}" class="day-label">${cycleDay}</text>` : '';

    return `<svg width="320" height="320" viewBox="0 0 320 320" class="cycle-analog">
      <defs>
        <style>
          .segment { fill: color-mix(in srgb, var(--secondary-text-color, #6b7280) 14%, transparent); stroke: var(--divider-color, rgba(127, 127, 127, 0.35)); stroke-width: 0.5; }
          .segment.period { fill: color-mix(in srgb, var(--error-color, #e74c3c) 62%, transparent); }
          .segment.fertile { fill: color-mix(in srgb, var(--warning-color, #f39c12) 52%, transparent); }
          .segment.ovulation { fill: color-mix(in srgb, var(--success-color, #27ae60) 72%, transparent); filter: drop-shadow(0 0 2px color-mix(in srgb, var(--success-color, #27ae60) 80%, transparent)); }
          .segment.current { stroke: var(--primary-text-color); stroke-width: 2; }
          .center-circle { fill: var(--ha-card-background); stroke: var(--divider-color); stroke-width: 1; }
          .day-label { text-anchor: middle; dominant-baseline: central; font-size: 32px; font-weight: 700; color: var(--primary-text-color); }
          .info-text { text-anchor: middle; dominant-baseline: central; font-size: 12px; fill: var(--secondary-text-color); }
        </style>
      </defs>
      <g id="cycle-segments">${segments}</g>
      <circle cx="${centerX}" cy="${centerY}" r="50" class="center-circle" />
      ${currentDayLabel}
      <text x="${centerX}" y="${centerY + 20}" class="info-text">/ ${cycleLength}</text>
    </svg>`;
  }

  _render() {
    this._ensureRoot();
    if (!this._config || !this.shadowRoot) return;

    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    
    if (!stateObj) {
      this.shadowRoot.innerHTML = '<ha-card><div class="pad">Entity not found</div></ha-card>';
      return;
    }

    const attrs = stateObj.attributes || {};
    const state = stateObj.state || 'neutral';
    const cycleLength = parseInt(String(attrs.avg_cycle_length || '28'), 10) || 28;
    const daysUntilStart = parseInt(String(attrs.days_until_next_start || '0'), 10) || 0;
    const cycleDay = Math.max(1, cycleLength - daysUntilStart);
    const periodDays = parseInt(String(attrs.period_duration_days || '5'), 10) || 5;

    const showPregnancy = this._config.show_pregnancy_status !== false;
    const showMenarche = this._config.show_menarche_status !== false;

    let statusEmoji = '⭕';
    let statusText = 'Neutral';

    if (showPregnancy && attrs.is_pregnant) {
      statusEmoji = '🤰';
      statusText = this._t('pregnant');
    } else if (showMenarche && attrs.awaiting_menarche) {
      statusEmoji = '🌱';
      statusText = this._t('pre_menarche');
    } else {
      const statusMap = {
        period: { emoji: '🩸', text: this._t('period') },
        fertile: { emoji: '💚', text: this._t('fertile') },
        pms: { emoji: '⚠️', text: this._t('pms') },
        neutral: { emoji: '⭕', text: 'Neutral' },
      };
      const statusInfo = statusMap[state] || statusMap.neutral;
      statusEmoji = statusInfo.emoji;
      statusText = statusInfo.text;
    }

    const cycleContent = this._createAnalogCycle(cycleDay, cycleLength, periodDays);

    let legendHtml = '<div class="legend-item"><span class="legend-swatch period"></span><span>' + this._t('period') + '</span></div>';
    if (this._config.show_fertile_window !== false) {
      legendHtml += '<div class="legend-item"><span class="legend-swatch fertile"></span><span>' + this._t('fertile') + '</span></div>';
      legendHtml += '<div class="legend-item"><span class="legend-swatch ovulation"></span><span>' + this._t('ovulation') + '</span></div>';
    }

    const html = `<style>
      :host {
        display: block;
        --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
        --mg-border: var(--divider-color, rgba(127, 127, 127, 0.35));
      }
      ha-card { padding: 16px; background: var(--mg-card-bg); }
      .title { font-weight: 600; margin: 0 0 12px; color: var(--primary-text-color); text-align: center; }
      .content { display: flex; flex-direction: column; align-items: center; gap: 16px; }
      .cycle-analog { max-width: 100%; height: auto; }
      .status-info { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; background: color-mix(in srgb, var(--secondary-text-color, #6b7280) 8%, transparent); border-radius: 8px; width: 100%; border: 1px solid var(--mg-border); }
      .status-emoji { font-size: 2rem; }
      .status-text { font-weight: 600; color: var(--primary-text-color); }
      .status-subtext { font-size: 0.85rem; color: var(--secondary-text-color); }
      .legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; width: 100%; font-size: 0.8rem; color: var(--secondary-text-color); margin-top: 8px; }
      .legend-item { display: flex; align-items: center; gap: 4px; }
      .legend-swatch { width: 12px; height: 12px; border-radius: 2px; }
      .legend-swatch.period { background: color-mix(in srgb, var(--error-color, #e74c3c) 62%, transparent); }
      .legend-swatch.fertile { background: color-mix(in srgb, var(--warning-color, #f39c12) 52%, transparent); }
      .legend-swatch.ovulation { background: color-mix(in srgb, var(--success-color, #27ae60) 72%, transparent); }
      @media (prefers-color-scheme: dark) {
        .status-info { background: color-mix(in srgb, var(--secondary-text-color, #c5ccd5) 16%, transparent); }
      }
    </style>
    <ha-card>
      <div class="title">${this._config.title || this._t('title')}</div>
      <div class="content">
        ${cycleContent}
        <div class="status-info">
          <div class="status-emoji">${statusEmoji}</div>
          <div class="status-text">${statusText}</div>
          <div class="status-subtext">${this._t('cycle_day')} ${cycleDay}/${cycleLength}</div>
        </div>
        <div class="legend">
          ${legendHtml}
        </div>
      </div>
    </ha-card>`;

    this.shadowRoot.innerHTML = html;
  }
}

customElements.define('menstrual-cycle-history-card-analog', MenstrualCycleHistoryCardAnalog);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstrual-cycle-history-card-analog',
  name: 'Menstrual Cycle History (Analog)',
  description: 'Menstrual cycle in circular analog format',
});
