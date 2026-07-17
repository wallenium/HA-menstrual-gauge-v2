class MenstruationCycleHeatmapCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      max_cycles: 18,
      show_fertile_period: true,
      symptom_entities: [],
      cycle_alignment: 'top',
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
        max_cycles: 'Max. Zyklen',
        features: 'Funktionen',
        show_fertile_period: 'Fruchtbare Phase anzeigen',
        alignment: 'Ausrichtung',
        align_top: 'Oben (Tag 1..X)',
        align_bottom: 'Unten (E/-Tage)',
        symptom_entities: 'Symptom-Entitäten',
        symptom_entities_hint: 'Wähle Sensor-Entitäten aus, die als Symptome angezeigt werden.',
        preview: 'Vorschau',
        preview_note: 'Vorschau zeigt Beispieldaten.',
        fallback_note: 'HA Entity-Picker nicht verfügbar, Fallback-Dropdown aktiv.',
        sensor_search: 'Sensor suchen…',
        no_sensors: 'Keine Sensoren gefunden.',
        day: 'T',
        period: 'P',
        fertile: 'F',
      },
      en: {
        entity: 'Entity',
        entry_id: 'Entry ID (optional)',
        display: 'Display',
        title: 'Title',
        max_cycles: 'Max Cycles',
        features: 'Features',
        show_fertile_period: 'Show fertile period',
        alignment: 'Alignment',
        align_top: 'Top (Day 1..X)',
        align_bottom: 'Bottom (E/-days)',
        symptom_entities: 'Symptom Entities',
        symptom_entities_hint: 'Select sensor entities to track as symptoms on the heatmap.',
        preview: 'Preview',
        preview_note: 'Preview uses sample data.',
        fallback_note: 'HA entity picker unavailable, fallback dropdown active.',
        sensor_search: 'Search sensor…',
        no_sensors: 'No sensors found.',
        day: 'D',
        period: 'P',
        fertile: 'F',
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
    const maxCols = Math.min(Number(this._config.max_cycles) || 18, 8);
    const cycleLen = 28;
    const periodDays = 5;
    const alignment = String(this._config.cycle_alignment || 'top').toLowerCase();
    const showFertile = this._config.show_fertile_period !== false;

    const cellSize = 8;
    const gap = 1;
    const colGap = 4;
    const colWidth = cellSize;
    const totalRows = cycleLen;

    let cols = '';
    for (let c = 0; c < maxCols; c++) {
      let cells = '';
      for (let r = 0; r < totalRows; r++) {
        let day;
        if (alignment === 'bottom') {
          day = cycleLen - (totalRows - 1 - r);
        } else {
          day = r + 1;
        }
        let bg = 'var(--divider-color, #e0e0e0)';
        if (day >= 1 && day <= periodDays) bg = '#be123c';
        else if (showFertile && day >= 8 && day <= 19) bg = '#16a34a';
        else if (showFertile && day === 14) bg = '#15803d';
        cells += `<div style="width:${cellSize}px;height:${cellSize}px;border-radius:2px;background:${bg};margin-bottom:${gap}px;"></div>`;
      }
      cols += `<div style="display:flex;flex-direction:column;margin-right:${colGap}px;">${cells}</div>`;
    }

    return `
      <div style="display:flex;flex-direction:row;overflow:hidden;max-width:100%;padding:4px;">
        ${cols}
      </div>
      <div style="font-size:10px;color:var(--secondary-text-color);margin-top:4px;">${this._t('preview_note')}</div>
    `;
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    const entities = this._entityOptions();
    const selectedEntity = String(this._config.entity || '');
    const entryId = String(this._config.entry_id || '');
    const maxCycles = Number(this._config.max_cycles) || 18;
    const showFertile = this._config.show_fertile_period !== false;
    const alignment = String(this._config.cycle_alignment || 'top').toLowerCase();
    const symptomEntities = Array.isArray(this._config.symptom_entities) ? this._config.symptom_entities : [];

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

    const symptomCheckboxes = entities.map((row) => {
      const checked = symptomEntities.includes(row.entity_id) ? 'checked' : '';
      return `<label class="check symptom-item">
        <input type="checkbox" class="symptom-cb" data-entity="${row.entity_id}" ${checked}>
        <span>${this._escapeHtml(row.label)} <small>(${row.entity_id})</small></span>
      </label>`;
    }).join('') || `<div style="color:var(--secondary-text-color);font-size:12px;">${this._t('no_sensors')}</div>`;

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 14px; padding: 2px 0; }
        .section-title { font-size: 12px; font-weight: 700; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .row { display: grid; gap: 4px; }
        label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
        input[type='text'], input[type='number'], select {
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
        .radio-group { display: flex; flex-direction: column; gap: 6px; }
        .radio-label { display: flex; gap: 8px; align-items: center; color: var(--primary-text-color); font-size: 13px; font-weight: normal; }
        .symptom-list { max-height: 160px; overflow-y: auto; border: 1px solid var(--divider-color); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .symptom-item { font-weight: normal; }
        .symptom-item small { color: var(--secondary-text-color); font-size: 10px; }
        .fallback-note { font-size: 11px; color: var(--secondary-text-color); opacity: 0.85; }
        .entity-fallback { display: grid; gap: 6px; }
        .preview-box { border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; background: var(--card-background-color); }
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
            <input id="title" type="text" value="${this._escapeHtml(this._config.title || '')}" placeholder="Zyklus Heatmap">
          </div>
          <div class="row" style="margin-top:8px;">
            <label>${this._t('max_cycles')} (1-50)</label>
            <div class="slider-row">
              <input id="max_cycles" type="range" min="1" max="50" value="${maxCycles}">
              <span class="slider-val" id="max_cycles_val">${maxCycles}</span>
            </div>
          </div>
        </div>

        <div>
          <div class="section-title">${this._t('features')}</div>
          <label class="check">
            <input id="show_fertile_period" type="checkbox" ${showFertile ? 'checked' : ''}>
            <span>${this._t('show_fertile_period')}</span>
          </label>
        </div>

        <div>
          <div class="section-title">${this._t('alignment')}</div>
          <div class="radio-group">
            <label class="radio-label">
              <input id="align_top" type="radio" name="cycle_alignment" value="top" ${alignment === 'top' ? 'checked' : ''}>
              <span>${this._t('align_top')}</span>
            </label>
            <label class="radio-label">
              <input id="align_bottom" type="radio" name="cycle_alignment" value="bottom" ${alignment === 'bottom' ? 'checked' : ''}>
              <span>${this._t('align_bottom')}</span>
            </label>
          </div>
        </div>

        <div>
          <div class="section-title">${this._t('symptom_entities')}</div>
          <div style="font-size:11px;color:var(--secondary-text-color);margin-bottom:6px;">${this._t('symptom_entities_hint')}</div>
          <div class="symptom-list">${symptomCheckboxes}</div>
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

    // ── Max cycles slider ─────────────────────────────────────────────────
    const maxCyclesInput = this.shadowRoot.getElementById('max_cycles');
    const maxCyclesVal = this.shadowRoot.getElementById('max_cycles_val');
    maxCyclesInput?.addEventListener('input', (ev) => {
      const v = Number(ev.target?.value);
      if (maxCyclesVal) maxCyclesVal.textContent = v;
    });
    maxCyclesInput?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, max_cycles: Number(ev.target?.value) });
    });

    // ── Show fertile period ───────────────────────────────────────────────
    this.shadowRoot.getElementById('show_fertile_period')?.addEventListener('change', (ev) => {
      this._emit({ ...this._config, show_fertile_period: Boolean(ev.target?.checked) });
    });

    // ── Cycle alignment radios ────────────────────────────────────────────
    this.shadowRoot.querySelectorAll('input[name="cycle_alignment"]').forEach((radio) => {
      radio.addEventListener('change', (ev) => {
        if (ev.target?.checked) {
          this._emit({ ...this._config, cycle_alignment: ev.target?.value });
        }
      });
    });

    // ── Symptom entities checkboxes ───────────────────────────────────────
    this.shadowRoot.querySelectorAll('.symptom-cb').forEach((cb) => {
      cb.addEventListener('change', () => {
        const checked = Array.from(this.shadowRoot.querySelectorAll('.symptom-cb'))
          .filter((el) => el.checked)
          .map((el) => el.dataset.entity);
        this._emit({ ...this._config, symptom_entities: checked });
      });
    });
  }
}

if (!customElements.get('menstruation-cycle-heatmap-card-editor')) {
  customElements.define('menstruation-cycle-heatmap-card-editor', MenstruationCycleHeatmapCardEditor);
}
