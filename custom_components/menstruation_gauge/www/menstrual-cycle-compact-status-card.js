class MenstrualCycleCompactStatusCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstrual-cycle-compact-status',
      entity: 'sensor.menstruation',
      entry_id: '',
      title: '',
      show_title: false,
    };
  }

  static getConfigElement() {
    return document.createElement('menstrual-cycle-compact-status-editor');
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      show_title: false,
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
    return 2;
  }

  _ensureRoot() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
  }

  _lang() {
    const language = String(this._hass?.locale?.language || this._hass?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        entity_not_found: 'Entity nicht gefunden',
        unknown: 'Unbekannt',
        title: 'Zyklus Status',
        cycle_day: 'Zyklustag',
        period: 'Periode',
        fertile: 'Fruchtbar',
        ovulation: 'Eisprung',
        pms: 'PMS',
        neutral: 'Neutral',
        pre_menarche: 'Vor Menarche',
        pregnant: 'Schwanger',
        postpartum: 'Wochenbett',
        menarche: 'Menarche',
        menopause: 'Menopause',
      },
      en: {
        entity_not_found: 'Entity not found',
        unknown: 'Unknown',
        title: 'Cycle Status',
        cycle_day: 'Cycle Day',
        period: 'Period',
        fertile: 'Fertile',
        ovulation: 'Ovulation',
        pms: 'PMS',
        neutral: 'Neutral',
        pre_menarche: 'Pre-Menarche',
        pregnant: 'Pregnant',
        postpartum: 'Postpartum',
        menarche: 'Menarche',
        menopause: 'Menopause',
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

  _todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _calcCycleDay(attrs) {
    const cycleLength = Math.max(1, parseInt(String(attrs.avg_cycle_length || '28'), 10) || 28);
    const hasDaysUntil = attrs.days_until_next_start !== null
      && attrs.days_until_next_start !== undefined
      && String(attrs.days_until_next_start).trim() !== '';
    const daysUntilStart = hasDaysUntil ? parseInt(String(attrs.days_until_next_start), 10) : NaN;
    if (Number.isFinite(daysUntilStart)) {
      return {
        cycleDay: Math.min(cycleLength, Math.max(1, cycleLength - daysUntilStart)),
        cycleLength,
      };
    }

    const nextStartRaw = attrs.next_predicted_start;
    if (nextStartRaw) {
      const today = new Date();
      const nextDate = new Date(nextStartRaw);
      if (!Number.isNaN(nextDate.getTime())) {
        today.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((nextDate - today) / 86400000);
        return {
          cycleDay: Math.min(cycleLength, Math.max(1, cycleLength - daysUntil)),
          cycleLength,
        };
      }
    }

    return { cycleDay: 1, cycleLength };
  }

  _resolveStatus(stateObj) {
    const attrs = stateObj?.attributes || {};
    const todayIso = this._todayISO();
    const ovulationIso = this._normalizeISO(attrs.ovulation_day);

    if (attrs.is_pregnant || stateObj?.state === 'pregnant') return 'pregnant';
    if (attrs.awaiting_menarche || stateObj?.state === 'pre_menarche') return 'pre_menarche';
    if (stateObj?.state === 'fertile' && ovulationIso && ovulationIso === todayIso) return 'ovulation';
    return stateObj?.state || 'neutral';
  }

  _statusMeta(statusKey) {
    const map = {
      period: { color: '#e74c3c', label: this._t('period'), icon: 'drop' },
      pms: { color: '#f39c12', label: this._t('pms'), icon: 'warning' },
      fertile: { color: '#27ae60', label: this._t('fertile'), icon: 'heart' },
      ovulation: { color: '#f39c12', label: this._t('ovulation'), icon: 'ovulation' },
      neutral: { color: '#95a5a6', label: this._t('neutral'), icon: 'dash' },
      pre_menarche: { color: '#9b59b6', label: this._t('pre_menarche'), icon: 'flower' },
      pregnant: { color: '#9b59b6', label: this._t('pregnant'), icon: 'heart' },
      postpartum: { color: '#95a5a6', label: this._t('postpartum'), icon: 'dash' },
      menarche: { color: '#9b59b6', label: this._t('menarche'), icon: 'flower' },
      menopause: { color: '#95a5a6', label: this._t('menopause'), icon: 'dash' },
    };
    return map[statusKey] || map.neutral;
  }

  _iconPath(icon) {
    if (icon === 'drop') {
      return '<path d="M12 2C12 2 6 9 6 13a6 6 0 1 0 12 0c0-4-6-11-6-11z" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    }
    if (icon === 'warning') {
      return '<path d="M12 3 2.5 20h19L12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/>';
    }
    if (icon === 'heart' || icon === 'ovulation') {
      return '<path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    }
    if (icon === 'flower') {
      return '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="17" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>';
    }
    return '<path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  }

  _statusIcon(icon, color) {
    const marker = icon === 'ovulation' ? `<circle cx="18" cy="6" r="3" fill="${color}" stroke="var(--ha-card-background, #fff)" stroke-width="1.2"/>` : '';
    return `<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">${this._iconPath(icon)}${marker}</svg>`;
  }

  _render() {
    this._ensureRoot();
    if (!this._config || !this.shadowRoot) return;

    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">${this._t('entity_not_found')}</div></ha-card>`;
      return;
    }

    const attrs = stateObj.attributes || {};
    const { cycleDay, cycleLength } = this._calcCycleDay(attrs);
    const statusKey = this._resolveStatus(stateObj);
    const status = this._statusMeta(statusKey);
    const progressPercent = Math.max(0, Math.min(100, (cycleDay / cycleLength) * 100));
    const circleLength = 2 * Math.PI * 24;
    const offset = circleLength - (circleLength * progressPercent / 100);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 10px 12px; }
        .wrap { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .progress-wrap { width: clamp(56px, 20vw, 72px); height: clamp(56px, 20vw, 72px); position: relative; flex: 0 0 auto; }
        .progress-wrap svg { width: 100%; height: 100%; }
        .track { fill: none; stroke: var(--divider-color, rgba(127,127,127,0.3)); stroke-width: 6; }
        .progress { fill: none; stroke: ${status.color}; stroke-width: 6; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 220ms ease, stroke 220ms ease; }
        .center-day { font-size: 0.8rem; font-weight: 700; fill: var(--primary-text-color); text-anchor: middle; dominant-baseline: central; }
        .info { min-width: 0; flex: 1; display: grid; gap: 4px; }
        .status-line { display: flex; align-items: center; gap: 8px; }
        .status-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid ${status.color};
          color: ${status.color};
          background: var(--ha-card-background, var(--card-background-color));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }
        .status-icon svg { width: 18px; height: 18px; display: block; }
        .status-text { font-size: 0.95rem; font-weight: 600; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cycle-day { color: var(--secondary-text-color); font-size: 0.82rem; }
        .title { color: var(--secondary-text-color); font-size: 0.78rem; margin: 0 0 6px; }
        .empty { padding: 12px; color: var(--secondary-text-color); }
        @media (max-width: 380px) {
          ha-card { padding: 8px 10px; }
          .wrap { gap: 10px; }
          .status-icon { width: 24px; height: 24px; }
          .status-icon svg { width: 16px; height: 16px; }
          .status-text { font-size: 0.9rem; }
          .cycle-day { font-size: 0.76rem; }
        }
      </style>
      <ha-card>
        ${this._config.show_title ? `<div class="title">${this._config.title || this._t('title')}</div>` : ''}
        <div class="wrap">
          <div class="progress-wrap" aria-label="${this._t('cycle_day')} ${cycleDay}">
            <svg viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
              <circle class="track" cx="32" cy="32" r="24"></circle>
              <circle class="progress" cx="32" cy="32" r="24" stroke-dasharray="${circleLength.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
              <text x="32" y="33" class="center-day">${cycleDay}</text>
            </svg>
          </div>
          <div class="info">
            <div class="status-line">
              <span class="status-icon">${this._statusIcon(status.icon, status.color)}</span>
              <span class="status-text">${status.label}</span>
            </div>
            <div class="cycle-day">${this._t('cycle_day')} ${cycleDay}/${cycleLength}</div>
          </div>
        </div>
      </ha-card>
    `;
  }
}

class MenstrualCycleCompactStatusEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      show_title: false,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _lang() {
    const language = String(this._hass?.locale?.language || this._hass?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        entity: 'Entität',
        title: 'Titel',
        show_title: 'Titel anzeigen',
      },
      en: {
        entity: 'Entity',
        title: 'Title',
        show_title: 'Show title',
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
  }

  _emit(nextConfig) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 10px; }
        .row { display: grid; gap: 4px; }
        label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
        input[type='text'] {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .check {
          display: flex;
          gap: 8px;
          align-items: center;
          color: var(--primary-text-color);
        }
      </style>
      <div class="wrap">
        <div class="row">
          <label for="entity">${this._t('entity')}</label>
          <input id="entity" type="text" value="${String(this._config.entity || '')}" placeholder="sensor.menstruation" />
        </div>
        <div class="row">
          <label for="title">${this._t('title')}</label>
          <input id="title" type="text" value="${String(this._config.title || '')}" />
        </div>
        <label class="check">
          <input id="show_title" type="checkbox" ${this._config.show_title ? 'checked' : ''} />
          <span>${this._t('show_title')}</span>
        </label>
      </div>
    `;

    const entityInput = this.shadowRoot.getElementById('entity');
    const titleInput = this.shadowRoot.getElementById('title');
    const showTitleInput = this.shadowRoot.getElementById('show_title');

    entityInput?.addEventListener('change', (ev) => {
      const value = String(ev.target?.value || '').trim();
      this._emit({ ...this._config, entity: value });
    });

    titleInput?.addEventListener('change', (ev) => {
      const value = String(ev.target?.value || '');
      this._emit({ ...this._config, title: value });
    });

    showTitleInput?.addEventListener('change', (ev) => {
      const checked = Boolean(ev.target?.checked);
      this._emit({ ...this._config, show_title: checked });
    });
  }
}

if (!customElements.get('menstrual-cycle-compact-status')) {
  customElements.define('menstrual-cycle-compact-status', MenstrualCycleCompactStatusCard);
}

if (!customElements.get('menstrual-cycle-compact-status-editor')) {
  customElements.define('menstrual-cycle-compact-status-editor', MenstrualCycleCompactStatusEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstrual-cycle-compact-status',
  name: 'Menstrual Cycle Compact Status',
  description: 'Compact cycle status with circular day indicator and status icon',
});
