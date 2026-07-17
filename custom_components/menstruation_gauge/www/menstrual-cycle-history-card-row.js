class MenstrualCycleHistoryCardRow extends HTMLElement {
  static getConfigElement() {
    return document.createElement('menstrual-cycle-history-card-row-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:menstrual-cycle-history-card-row',
      entity: 'sensor.menstruation',
      entry_id: '',
      title: 'Zyklus History',
      max_rows: 12,
      show_fertile_window: true,
      show_pregnancy_status: true,
      show_menarche_status: true,
    };
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      max_rows: 12,
      show_fertile_window: true,
      show_pregnancy_status: true,
      show_menarche_status: true,
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
        title: 'Zyklus History',
        cycle: 'Zyklus',
        start_date: 'Startdatum',
        end_date: 'Enddatum',
        length: 'Länge',
        days: 'Tage',
        status: 'Status',
        fertile_window: 'Fruchtbar (Tag 8-19)',
        ovulation: 'Eisprung (Tag ~14)',
        pregnant: 'Schwanger',
        pre_menarche: 'Vor Menarche',
        menarche: 'Menarche',
        actual_period: 'Tatsächliche Periode',
        predicted: 'Vorhergesagt',
        current_cycle: 'Aktueller Zyklus',
        previous_cycles: 'Vorherige Zyklen',
      },
      en: {
        entity_not_found: 'Entity not found',
        unknown: 'unknown',
        title: 'Cycle History',
        cycle: 'Cycle',
        start_date: 'Start Date',
        end_date: 'End Date',
        length: 'Length',
        days: 'Days',
        status: 'Status',
        fertile_window: 'Fertile (Day 8-19)',
        ovulation: 'Ovulation (Day ~14)',
        pregnant: 'Pregnant',
        pre_menarche: 'Pre-Menarche',
        menarche: 'Menarche',
        actual_period: 'Actual Period',
        predicted: 'Predicted',
        current_cycle: 'Current Cycle',
        previous_cycles: 'Previous Cycles',
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
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
  }

  _buildCycles(groupedStarts, predictedNextStart) {
    const starts = Array.from(new Set((groupedStarts || []).map((iso) => this._normalizeISO(iso)).filter(Boolean))).sort();
    if (starts.length < 1) return [];

    const cycles = [];
    for (let index = 0; index < starts.length - 1; index += 1) {
      const start = starts[index];
      const end = starts[index + 1];
      const length = this._dayDiff(end, start);
      if (length > 0 && length <= 80) {
        cycles.push({ start, end, length, predicted: false });
      }
    }

    const normalizedPredicted = this._normalizeISO(predictedNextStart);
    const lastStart = starts[starts.length - 1];
    if (normalizedPredicted && lastStart) {
      const predictedLength = this._dayDiff(normalizedPredicted, lastStart);
      if (predictedLength > 0 && predictedLength <= 80) {
        cycles.push({ start: lastStart, end: normalizedPredicted, length: predictedLength, predicted: true });
      }
    }

    return cycles.reverse();
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
    const groupedStartsAttr = Array.isArray(attrs.grouped_starts) ? attrs.grouped_starts : [];
    const predictedNextStart = attrs.next_predicted_start || null;
    const cycles = this._buildCycles(groupedStartsAttr, predictedNextStart);
    const maxRows = Math.max(1, Number(this._config.max_rows || 12));
    const visibleCycles = cycles.slice(0, maxRows);

    let tableRows = '';
    if (visibleCycles.length > 0) {
      visibleCycles.forEach((cycle, index) => {
        const isCurrentCycle = index === 0 && cycle.predicted;
        const cycleLabel = isCurrentCycle ? this._t('current_cycle') : `${this._t('cycle')} ${visibleCycles.length - index}`;
        const startLabel = this._toLocalDateLabel(cycle.start);
        const endLabel = this._toLocalDateLabel(cycle.end);
        const statusClass = cycle.predicted ? 'predicted' : 'completed';
        const statusLabel = cycle.predicted ? this._t('predicted') : this._t('actual_period');
        tableRows += `<tr class="cycle-row ${statusClass}"><td class="cell-label">${cycleLabel}</td><td class="cell-date">${startLabel}</td><td class="cell-date">${endLabel}</td><td class="cell-length">${cycle.length} ${this._t('days')}</td><td class="cell-status"><span class="status-label">${statusLabel}</span></td></tr>`;
      });
    }

    const html = `<style>
      :host {
        display: block;
        --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
        --mg-text-secondary: var(--secondary-text-color, #6b7280);
        --mg-border: var(--divider-color, rgba(127, 127, 127, 0.35));
      }
      ha-card { padding: 12px; background: var(--mg-card-bg); }
      .title { font-weight: 600; margin: 0 0 12px; color: var(--primary-text-color); }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
      thead { background: color-mix(in srgb, var(--mg-text-secondary) 10%, transparent); color: var(--mg-text-secondary); }
      th { padding: 8px 6px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--mg-border); font-size: 0.75rem; }
      .cycle-row { border-bottom: 1px solid var(--mg-border); transition: background-color 120ms ease; }
      .cycle-row:hover { background: color-mix(in srgb, var(--mg-text-secondary) 8%, transparent); }
      .cycle-row.predicted { opacity: 0.7; font-style: italic; }
      td { padding: 10px 6px; color: var(--primary-text-color); }
      .cell-label { font-weight: 500; min-width: 80px; }
      .cell-date { min-width: 70px; color: var(--mg-text-secondary); font-size: 0.85rem; }
      .cell-length { text-align: center; font-weight: 500; min-width: 50px; }
      .cell-status { text-align: right; min-width: 80px; }
      .status-label { display: inline-block; padding: 2px 8px; border-radius: 12px; background: color-mix(in srgb, var(--mg-text-secondary) 14%, transparent); font-size: 0.75rem; font-weight: 500; color: var(--mg-text-secondary); border: 1px solid var(--mg-border); }
      @media (prefers-color-scheme: dark) {
        .cycle-row:hover { background: color-mix(in srgb, var(--mg-text-secondary) 16%, transparent); }
      }
      @media (max-width: 600px) { table { font-size: 0.8rem; } th, td { padding: 6px 4px; } }
    </style>
    <ha-card>
      <div class="title">${this._config.title || this._t('title')}</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${this._t('cycle')}</th>
              <th>${this._t('start_date')}</th>
              <th>${this._t('end_date')}</th>
              <th>${this._t('length')}</th>
              <th>${this._t('status')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="5">No cycles available</td></tr>'}
          </tbody>
        </table>
      </div>
    </ha-card>`;

    this.shadowRoot.innerHTML = html;
  }
}

customElements.define('menstrual-cycle-history-card-row', MenstrualCycleHistoryCardRow);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstrual-cycle-history-card-row',
  name: 'Menstrual Cycle History (Table)',
  description: 'Menstrual cycle history in table format',
});
