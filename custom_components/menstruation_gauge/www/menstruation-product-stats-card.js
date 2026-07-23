class MenstruationProductStatsCard extends HTMLElement {
  setConfig(config) {
    if (!config?.entity) {
      throw new Error('Entity is required');
    }
    this.config = window.MenstruationProductStatsShared.mergeConfig(config);
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 5;
  }

  static getConfigElement() {
    return document.createElement('menstruation-product-stats-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:menstruation-product-stats-card',
      entity: 'sensor.menstruation_gauge',
      title: 'Product usage',
    };
  }

  connectedCallback() {
    if (this._handlersAttached) return;
    this._handlersAttached = true;
    this.addEventListener('click', async (event) => {
      const button = event.target?.closest?.('button[data-action]');
      if (!button || !this._hass) return;
      if (button.dataset.action !== 'add-underwear-shopping') return;
      const quantity = Math.max(1, Number(button.dataset.quantity || 1));
      await this._hass.callService('menstruation_gauge', 'manage_household_inventory', {
        inventory_action: 'add_to_shopping_list',
        product: 'underwear',
        quantity,
      });
    });
  }

  render() {
    if (!this._hass || !this.config?.entity) {
      return;
    }

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.innerHTML = `<ha-card><div class="mgp-empty-state">Entity not found: ${this.escapeHtml(this.config.entity)}</div></ha-card>`;
      return;
    }

    this.innerHTML = window.MenstruationProductStatsShared.renderStandalone(
      this._hass,
      this.config,
      stateObj.attributes || {},
    );
  }

  calculateStats(productUsageThisCycle, productUsageStats, daysUntilNextStart) {
    return window.MenstruationProductStatsShared.calculateStats(productUsageThisCycle, productUsageStats, daysUntilNextStart);
  }

  calculateAverageDailyUsage(productUsage, product) {
    return window.MenstruationProductStatsShared.calculateAverageDailyUsage(productUsage, product);
  }

  calculateUnderwearWashPlan(averageDailyUsage) {
    return window.MenstruationProductStatsShared.calculateUnderwearWashPlan(this.config, averageDailyUsage);
  }

  calculateCupSavings(productUsage) {
    return window.MenstruationProductStatsShared.calculateCupSavings(this.config, productUsage);
  }

  renderTimeline(productUsage) {
    return window.MenstruationProductStatsShared.renderTimeline(this._hass, productUsage);
  }

  productLabel(entry) {
    return window.MenstruationProductStatsShared.productLabel(this._hass, entry);
  }

  normalizeQuantity(value) {
    return window.MenstruationProductStatsShared.normalizeQuantity(value);
  }

  normalizeProductKey(value) {
    return window.MenstruationProductStatsShared.normalizeProductKey(value);
  }

  normalizeDateKey(value) {
    return window.MenstruationProductStatsShared.normalizeDateKey(value);
  }

  dateKeyToOrdinal(value) {
    return window.MenstruationProductStatsShared.dateKeyToOrdinal(value);
  }

  todayOrdinal() {
    return window.MenstruationProductStatsShared.todayOrdinal();
  }

  formatNumber(value) {
    return window.MenstruationProductStatsShared.formatNumber(value);
  }

  _lang() {
    return window.MenstruationProductStatsShared.getLang(this._hass);
  }

  escapeHtml(value) {
    return window.MenstruationProductStatsShared.escapeHtml(value);
  }

  escapeClassName(value) {
    return window.MenstruationProductStatsShared.escapeClassName(value);
  }

  dateLocale() {
    return window.MenstruationProductStatsShared.dateLocale(this._hass);
  }

  formatDate(value) {
    return window.MenstruationProductStatsShared.formatDate(this._hass, value);
  }

  _getSvgIcon(product) {
    return window.MenstruationProductStatsShared.getSvgIcon(product);
  }

  _t(key, placeholders = {}) {
    return window.MenstruationProductStatsShared.translate(this._hass, key, placeholders);
  }
}

class MenstruationProductStatsCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _fireConfigChanged(nextConfig) {
    this._config = { ...nextConfig };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
    this._render();
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const cfg = this._config || {};
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; padding: 8px 0; }
        .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
        input { border: 1px solid var(--divider-color, #ccc); border-radius: 6px; padding: 6px 8px; }
      </style>
      <div class="field"><label>Title</label><input data-key="title" value="${this._escape(cfg.title || '')}"></div>
      <div class="field"><label>Entity</label><input data-key="entity" value="${this._escape(cfg.entity || '')}"></div>
      <div class="field"><label>Tampon price (€)</label><input type="number" step="0.01" min="0" data-key="tampon_price" value="${Number(cfg.tampon_price ?? 0.12)}"></div>
      <div class="field"><label>Pad price (€)</label><input type="number" step="0.01" min="0" data-key="pad_price" value="${Number(cfg.pad_price ?? 0.10)}"></div>
      <div class="field"><label>Cup price (€)</label><input type="number" step="0.01" min="0" data-key="cup_price" value="${Number(cfg.cup_price ?? 30)}"></div>
      <div class="field"><label>Tampon CO2 (g)</label><input type="number" step="0.1" min="0" data-key="tampon_co2_g" value="${Number(cfg.tampon_co2_g ?? 1.5)}"></div>
      <div class="field"><label>Pad CO2 (g)</label><input type="number" step="0.1" min="0" data-key="pad_co2_g" value="${Number(cfg.pad_co2_g ?? 2.5)}"></div>
      <div class="field"><label>Cup CO2 (g one-time)</label><input type="number" step="0.1" min="0" data-key="cup_co2_g" value="${Number(cfg.cup_co2_g ?? 18)}"></div>
      <div class="field"><label>CO2 source URL</label><input data-key="co2_source_url" value="${this._escape(cfg.co2_source_url || 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10148749/')}"></div>
      <div class="field"><label>Period underwear owned</label><input type="number" step="1" min="1" data-key="underwear_total_owned" value="${Number(cfg.underwear_total_owned ?? 12)}"></div>
      <div class="field"><label>Target wash days</label><input type="number" step="1" min="1" data-key="target_wash_days" value="${Number(cfg.target_wash_days ?? 7)}"></div>
    `;

    this.shadowRoot.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => this._onInput());
      input.addEventListener('input', () => this._onInput());
    });
  }

  _onInput() {
    const inputs = Array.from(this.shadowRoot.querySelectorAll('input'));
    const nextConfig = { ...this._config };
    for (const input of inputs) {
      const key = input.dataset.key;
      if (!key) continue;
      if (input.type === 'number') nextConfig[key] = Number(input.value);
      else nextConfig[key] = input.value;
    }
    this._fireConfigChanged(nextConfig);
  }

  _escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

if (!customElements.get('menstruation-product-stats-card')) {
  customElements.define('menstruation-product-stats-card', MenstruationProductStatsCard);
}
if (!customElements.get('menstruation-product-stats-card-editor')) {
  customElements.define('menstruation-product-stats-card-editor', MenstruationProductStatsCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-product-stats-card',
  name: 'Menstruation Product Stats Card',
  description: 'Shows per-cycle product usage KPIs and a 30-day usage timeline.',
  preview: true,
  documentationURL: 'https://github.com/wallenium/HA-menstrual-gauge-v2',
});
