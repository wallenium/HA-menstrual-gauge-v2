class MenstruationCalendarCardEditor extends HTMLElement {
  setConfig(config) {
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
        entry_id: 'Eintrags-ID (optional)',
        title: 'Titel',
        options: 'Optionen',
        show_fertile_period: 'Fruchtbare Phase anzeigen',
        show_ovulation_marker: 'Ovulationsmarker anzeigen',
        show_cycle_day_numbers: 'Zyklustagnummern anzeigen',
        week_start: 'Wochenstart',
        monday: 'Montag',
        sunday: 'Sonntag',
        show_predicted_cycles: 'Vorhergesagte Zyklen anzeigen',
        num_predicted_cycles: 'Anzahl Vorhersagen (1–12)',
      },
      en: {
        entity: 'Entity',
        entry_id: 'Entry ID (optional)',
        title: 'Title',
        options: 'Options',
        show_fertile_period: 'Show fertile period',
        show_ovulation_marker: 'Show ovulation marker',
        show_cycle_day_numbers: 'Show cycle day numbers',
        week_start: 'Week start',
        monday: 'Monday',
        sunday: 'Sunday',
        show_predicted_cycles: 'Show predicted cycles',
        num_predicted_cycles: 'Number of predictions (1–12)',
      },
    };
    return (i18n[this._lang()]?.[key]) ?? (i18n.en[key] ?? key);
  }

  _emit(nextConfig) {
    this._config = { ...nextConfig };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  _entityOptions() {
    const states = this._hass?.states || {};
    return Object.keys(states)
      .filter((id) => id.startsWith('sensor.'))
      .sort()
      .map((id) => ({
        entity_id: id,
        label: String(states[id]?.attributes?.friendly_name || states[id]?.attributes?.name || id),
      }));
  }

  _entityOptionsHtml(options, selected) {
    return options.map((row) => {
      const sel = row.entity_id === selected ? 'selected' : '';
      return `<option value="${row.entity_id}" ${sel}>${this._escapeHtml(row.label)} (${row.entity_id})</option>`;
    }).join('');
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    const entities = this._entityOptions();
    const selectedEntity = String(this._config.entity || '');

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 12px; }
        .row { display: grid; gap: 4px; }
        .section-title { font-size: 12px; font-weight: 700; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
        input[type='text'], select {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        .check { display: flex; gap: 8px; align-items: center; color: var(--primary-text-color); font-size: 13px; }
        .check input[type='checkbox'] { width: auto; min-width: 0; margin: 0; }
      </style>
      <div class="wrap">
        <div>
          <div class="section-title">${this._t('entity')}</div>
          <div class="row">
            <select id="entity">${this._entityOptionsHtml(entities, selectedEntity)}</select>
          </div>
          <div class="row" style="margin-top:8px;">
            <label for="entry_id">${this._t('entry_id')}</label>
            <input id="entry_id" type="text" value="${this._escapeHtml(this._config.entry_id || '')}">
          </div>
        </div>

        <div>
          <div class="section-title">${this._t('title')}</div>
          <div class="row">
            <input id="title" type="text" value="${this._escapeHtml(this._config.title || '')}">
          </div>
        </div>

        <div>
          <div class="section-title">${this._t('options')}</div>
          <div class="row">
            <label class="check"><input id="show_fertile_period" type="checkbox" ${this._config.show_fertile_period !== false ? 'checked' : ''}> <span>${this._t('show_fertile_period')}</span></label>
            <label class="check"><input id="show_ovulation_marker" type="checkbox" ${this._config.show_ovulation_marker !== false ? 'checked' : ''}> <span>${this._t('show_ovulation_marker')}</span></label>
            <label class="check"><input id="show_cycle_day_numbers" type="checkbox" ${this._config.show_cycle_day_numbers ? 'checked' : ''}> <span>${this._t('show_cycle_day_numbers')}</span></label>
            <label class="check"><input id="show_predicted_cycles" type="checkbox" ${this._config.show_predicted_cycles !== false ? 'checked' : ''}> <span>${this._t('show_predicted_cycles')}</span></label>
          </div>
          <div class="row" style="margin-top:8px;">
            <label for="num_predicted_cycles">${this._t('num_predicted_cycles')}</label>
            <input id="num_predicted_cycles" type="number" min="1" max="12" value="${Math.max(1, Math.min(12, Number(this._config.num_predicted_cycles || 6)))}">
          </div>
          <div class="row" style="margin-top:8px;">
            <label for="week_start">${this._t('week_start')}</label>
            <select id="week_start">
              <option value="monday" ${String(this._config.week_start || 'monday').toLowerCase() === 'monday' ? 'selected' : ''}>${this._t('monday')}</option>
              <option value="sunday" ${String(this._config.week_start || 'monday').toLowerCase() === 'sunday' ? 'selected' : ''}>${this._t('sunday')}</option>
            </select>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('entity')?.addEventListener('change', (ev) => {
      const v = String(ev.target?.value || '').trim();
      const next = { ...this._config, entity: v };
      delete next.entry_id;
      this._emit(next);
    });

    this.shadowRoot.getElementById('entry_id')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, entry_id: String(ev.target?.value || '').trim() });
    });

    this.shadowRoot.getElementById('title')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, title: String(ev.target?.value || '') });
    });

    this.shadowRoot.getElementById('show_fertile_period')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, show_fertile_period: Boolean(ev.target?.checked) });
    });

    this.shadowRoot.getElementById('show_ovulation_marker')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, show_ovulation_marker: Boolean(ev.target?.checked) });
    });

    this.shadowRoot.getElementById('show_cycle_day_numbers')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, show_cycle_day_numbers: Boolean(ev.target?.checked) });
    });

    this.shadowRoot.getElementById('show_predicted_cycles')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, show_predicted_cycles: Boolean(ev.target?.checked) });
    });

    this.shadowRoot.getElementById('num_predicted_cycles')?.addEventListener('change', (ev) => {
      const v = Math.max(1, Math.min(12, Number(ev.target?.value || 6)));
      this._emit({ ...this._config, num_predicted_cycles: v });
    });

    this.shadowRoot.getElementById('week_start')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, week_start: String(ev.target?.value || 'monday').toLowerCase() });
    });
  }
}

if (!customElements.get('menstruation-calendar-card-editor')) {
  customElements.define('menstruation-calendar-card-editor', MenstruationCalendarCardEditor);
}
