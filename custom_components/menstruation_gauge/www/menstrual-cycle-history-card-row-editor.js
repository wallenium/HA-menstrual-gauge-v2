class MenstrualCycleHistoryCardRowEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      max_rows: 12,
      show_fertile_window: true,
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
        display: 'Anzeige',
        title: 'Titel',
        max_rows: 'Max. Zeilen',
        features: 'Funktionen',
        show_fertile_window: 'Fruchtbarkeitsfenster anzeigen',
        preview: 'Vorschau',
        preview_note: 'Vorschau zeigt Beispieldaten.',
        fallback_note: 'HA Entity-Picker nicht verfügbar, Fallback-Dropdown aktiv.',
        sensor_search: 'Sensor suchen…',
        no_sensors: 'Keine Sensoren gefunden.',
        col_cycle: 'Zyklus',
        col_start: 'Start',
        col_end: 'Ende',
        col_length: 'Länge',
        col_status: 'Status',
        status_actual: 'Vergangen',
        status_current: 'Aktuell',
        status_predicted: 'Vorhergesagt',
        days: 'T',
      },
      en: {
        entity: 'Entity',
        entry_id: 'Entry ID (optional)',
        display: 'Display',
        title: 'Title',
        max_rows: 'Max Rows',
        features: 'Features',
        show_fertile_window: 'Show fertile window',
        preview: 'Preview',
        preview_note: 'Preview uses sample data.',
        fallback_note: 'HA entity picker unavailable, fallback dropdown active.',
        sensor_search: 'Search sensor…',
        no_sensors: 'No sensors found.',
        col_cycle: 'Cycle',
        col_start: 'Start',
        col_end: 'End',
        col_length: 'Length',
        col_status: 'Status',
        status_actual: 'Past',
        status_current: 'Current',
        status_predicted: 'Predicted',
        days: 'd',
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

  _escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  _buildPreview() {
    const maxRows = Math.min(Number(this._config.max_rows) || 12, 5);
    const showFertile = this._config.show_fertile_window !== false;

    const today = new Date();
    const rows = [];
    for (let i = maxRows - 1; i >= 0; i--) {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - (i + 1) * 28);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 27);
      const isLast = i === 0;
      const status = isLast ? this._t('status_current') : this._t('status_actual');
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = isLast ? '—' : endDate.toISOString().slice(0, 10);
      rows.push({ idx: maxRows - i, startStr, endStr, length: 28, status, isCurrent: isLast });
    }

    const fertileCell = showFertile
      ? `<td style="font-size:10px;color:#16a34a;">8-19</td>`
      : '';
    const fertileHeader = showFertile
      ? `<th style="padding:4px 6px;border-bottom:1px solid var(--divider-color);">${this._t('show_fertile_window')}</th>`
      : '';

    const tableRows = rows.map((r) => `
      <tr style="background:${r.isCurrent ? 'rgba(var(--rgb-primary-color,33,150,243),0.08)' : 'transparent'}">
        <td style="padding:3px 6px;font-size:11px;">C${r.idx}</td>
        <td style="padding:3px 6px;font-size:11px;">${r.startStr}</td>
        <td style="padding:3px 6px;font-size:11px;">${r.endStr}</td>
        <td style="padding:3px 6px;font-size:11px;">${r.length} ${this._t('days')}</td>
        <td style="padding:3px 6px;font-size:11px;">${r.status}</td>
        ${showFertile ? fertileCell : ''}
      </tr>
    `).join('');

    return `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="border-bottom:2px solid var(--divider-color);">
              <th style="padding:4px 6px;text-align:left;font-size:11px;">${this._t('col_cycle')}</th>
              <th style="padding:4px 6px;text-align:left;font-size:11px;">${this._t('col_start')}</th>
              <th style="padding:4px 6px;text-align:left;font-size:11px;">${this._t('col_end')}</th>
              <th style="padding:4px 6px;text-align:left;font-size:11px;">${this._t('col_length')}</th>
              <th style="padding:4px 6px;text-align:left;font-size:11px;">${this._t('col_status')}</th>
              ${fertileHeader}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div style="font-size:10px;color:var(--secondary-text-color);margin-top:6px;">${this._t('preview_note')}</div>
    `;
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    const entities = this._entityOptions();
    const selectedEntity = String(this._config.entity || '');
    const entryId = String(this._config.entry_id || '');
    const maxRows = Number(this._config.max_rows) || 12;
    const showFertile = this._config.show_fertile_window !== false;

    const hasHaSelector = Boolean(customElements.get('ha-selector'));
    const hasHaEntityPicker = Boolean(customElements.get('ha-entity-picker'));

    const entityPickerHtml = hasHaSelector
      ? '<ha-selector id="entity_selector"></ha-selector>'
      : hasHaEntityPicker
      ? '<ha-entity-picker id="entity_picker"></ha-entity-picker>'
      : `<div class="entity-fallback">
           <input id="entity_search" type="text" placeholder="${this._t('sensor_search')}">
           <select id="entity_select" size="5">${this._entityOptionsHtml(entities, selectedEntity)}</select>
           <div class="fallback-note">${this._t('fallback_note')}</div>
         </div>`;

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 14px; padding: 2px 0; }
        .section-title { font-size: 12px; font-weight: 700; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .row { display: grid; gap: 4px; }
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
        .slider-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
        input[type='range'] { width: 100%; }
        .slider-val { font-size: 13px; font-weight: 600; color: var(--primary-text-color); min-width: 28px; text-align: right; }
        .fallback-note { font-size: 11px; color: var(--secondary-text-color); opacity: 0.85; }
        .entity-fallback { display: grid; gap: 6px; }
        .preview-box { border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; background: var(--card-background-color); overflow-x: auto; }
        ha-selector, ha-entity-picker { width: 100%; display: block; }
      </style>
      <div class="wrap">
        <div>
          <div class="section-title">${this._t('entity')}</div>
          <div class="row">
            ${entityPickerHtml}
          </div>
          <div class="row" style="margin-top:8px;">
            <label for="entry_id">${this._t('entry_id')}</label>
            <input id="entry_id" type="text" value="${this._escapeHtml(entryId)}" placeholder="">
          </div>
        </div>

        <div>
          <div class="section-title">${this._t('display')}</div>
          <div class="row">
            <label for="title">${this._t('title')}</label>
            <input id="title" type="text" value="${this._escapeHtml(this._config.title || '')}" placeholder="Zyklus History">
          </div>
          <div class="row" style="margin-top:8px;">
            <label>${this._t('max_rows')} (1-24)</label>
            <div class="slider-row">
              <input id="max_rows" type="range" min="1" max="24" value="${maxRows}">
              <span class="slider-val" id="max_rows_val">${maxRows}</span>
            </div>
          </div>
        </div>

        <div>
          <div class="section-title">${this._t('features')}</div>
          <label class="check">
            <input id="show_fertile_window" type="checkbox" ${showFertile ? 'checked' : ''}>
            <span>${this._t('show_fertile_window')}</span>
          </label>
        </div>

        <div>
          <div class="section-title">${this._t('preview')}</div>
          <div class="preview-box">${this._buildPreview()}</div>
        </div>
      </div>
    `;

    // ── Entity picker wiring ──────────────────────────────────────────────
    const applyEntity = (value) => {
      const v = String(value || '').trim();
      if (!v) return;
      const next = { ...this._config, entity: v };
      delete next.entry_id;
      this._emit(next);
    };

    const entitySelector = this.shadowRoot.getElementById('entity_selector');
    if (entitySelector) {
      entitySelector.hass = this._hass;
      entitySelector.selector = { entity: { domain: 'sensor' } };
      entitySelector.value = selectedEntity;
      entitySelector.addEventListener('value-changed', (ev) => applyEntity(ev?.detail?.value));
      entitySelector.addEventListener('change', (ev) => applyEntity(ev?.detail?.value));
    }

    const entityPicker = this.shadowRoot.getElementById('entity_picker');
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = selectedEntity;
      entityPicker.includeDomains = ['sensor'];
      entityPicker.allowCustomEntity = false;
      entityPicker.addEventListener('value-changed', (ev) => applyEntity(ev?.detail?.value));
      entityPicker.addEventListener('change', (ev) => applyEntity(ev?.detail?.value));
    }

    const entitySelect = this.shadowRoot.getElementById('entity_select');
    const entitySearch = this.shadowRoot.getElementById('entity_search');
    if (entitySelect) {
      entitySelect.addEventListener('change', (ev) => applyEntity(ev?.target?.value));
      entitySearch?.addEventListener('input', (ev) => {
        const needle = String(ev?.target?.value || '').trim().toLowerCase();
        const filtered = needle
          ? entities.filter((r) => `${r.label} ${r.entity_id}`.toLowerCase().includes(needle))
          : entities;
        entitySelect.innerHTML = this._entityOptionsHtml(filtered, selectedEntity);
      });
      entitySearch?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); applyEntity(entitySelect?.value); }
      });
    }

    // ── Entry ID ─────────────────────────────────────────────────────────
    this.shadowRoot.getElementById('entry_id')?.addEventListener('change', (ev) => {
      const v = String(ev.target?.value || '').trim();
      this._emit({ ...this._config, entry_id: v });
    });

    // ── Title ─────────────────────────────────────────────────────────────
    this.shadowRoot.getElementById('title')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, title: String(ev.target?.value || '') });
    });

    // ── Max rows slider ───────────────────────────────────────────────────
    const maxRowsInput = this.shadowRoot.getElementById('max_rows');
    const maxRowsVal = this.shadowRoot.getElementById('max_rows_val');
    maxRowsInput?.addEventListener('input', (ev) => {
      const v = Number(ev.target?.value);
      if (maxRowsVal) maxRowsVal.textContent = v;
    });
    maxRowsInput?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, max_rows: Number(ev.target?.value) });
    });

    // ── Show fertile window ───────────────────────────────────────────────
    this.shadowRoot.getElementById('show_fertile_window')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, show_fertile_window: Boolean(ev.target?.checked) });
    });
  }
}

if (!customElements.get('menstrual-cycle-history-card-row-editor')) {
  customElements.define('menstrual-cycle-history-card-row-editor', MenstrualCycleHistoryCardRowEditor);
}
