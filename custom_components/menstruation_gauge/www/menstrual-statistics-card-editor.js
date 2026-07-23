/**
 * Menstrual Statistics Card Editor
 * Config UI for the Menstrual Statistics Card.
 */
class MenstrualStatisticsCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  get _schema() {
    return [
      { name: 'entity', required: false, label: 'Entity (sensor)', type: 'entity', domain: 'sensor' },
      { name: 'title', required: false, label: 'Card Title', type: 'text' },
      { name: 'days_back', required: false, label: 'Default days back (30–730)', type: 'number', min: 30, max: 730 },
      { name: 'language', required: false, label: 'Language (auto / de / en)', type: 'select', options: ['auto', 'de', 'en'] },
    ];
  }

  _fireEvent(detail) {
    this.dispatchEvent(new CustomEvent('config-changed', { detail, bubbles: true, composed: true }));
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const cfg = this._config || {};

    const entityOptions = this._hass
      ? Object.keys(this._hass.states)
          .filter(eid => eid.startsWith('sensor.'))
          .sort()
          .map(eid => `<option value="${eid}" ${cfg.entity === eid ? 'selected' : ''}>${eid}</option>`)
          .join('')
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        .field { margin-bottom: 12px; }
        label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
        select, input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
      </style>
      <div>
        <div class="field">
          <label>Entity (sensor)</label>
          <select id="entity">
            <option value="">-- select entity --</option>
            ${entityOptions}
          </select>
        </div>
        <div class="field">
          <label>Card Title</label>
          <input type="text" id="title" value="${this._esc(cfg.title || '')}" placeholder="Statistiken" />
        </div>
        <div class="field">
          <label>Default days back (30–730)</label>
          <input type="number" id="days_back" value="${this._esc(String(cfg.days_back || 180))}" min="30" max="730" />
        </div>
        <div class="field">
          <label>Language</label>
          <select id="language">
            <option value="auto" ${(cfg.language || 'auto') === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="de" ${cfg.language === 'de' ? 'selected' : ''}>Deutsch (DE)</option>
            <option value="en" ${cfg.language === 'en' ? 'selected' : ''}>English (EN)</option>
          </select>
        </div>
      </div>`;

    this.shadowRoot.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', () => this._onChange());
      el.addEventListener('input', () => this._onChange());
    });
  }

  _onChange() {
    const root = this.shadowRoot;
    if (!root) return;
    const cfg = {
      ...this._config,
      entity: root.getElementById('entity')?.value || '',
      title: root.getElementById('title')?.value || '',
      days_back: parseInt(root.getElementById('days_back')?.value || '180', 10),
      language: root.getElementById('language')?.value || 'auto',
    };
    this._config = cfg;
    this._fireEvent({ config: cfg });
  }

  _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

customElements.define('menstrual-statistics-card-editor', MenstrualStatisticsCardEditor);
