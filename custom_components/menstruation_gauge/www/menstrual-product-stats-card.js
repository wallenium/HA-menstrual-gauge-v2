class MenstrualProductStatsCard extends HTMLElement {
  setConfig(config) {
    if (!config?.entity) {
      throw new Error("Entity is required");
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 5;
  }

  static getConfigElement() {
    return document.createElement('menstrual-product-stats-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:menstrual-product-stats-card',
      entity: 'sensor.menstruation_gauge',
      title: 'Product usage'
    };
  }

  render() {
    if (!this._hass || !this.config?.entity) {
      return;
    }

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.innerHTML = `<ha-card><div class="empty-state">Entity not found: ${this.escapeHtml(this.config.entity)}</div></ha-card>`;
      return;
    }

    const attrs = stateObj.attributes || {};
    const productUsageTimeline = Array.isArray(attrs.product_usage_timeline)
      ? attrs.product_usage_timeline
      : (Array.isArray(attrs.product_usage) ? attrs.product_usage : []);
    const productUsageThisCycle = attrs.product_usage_this_cycle && typeof attrs.product_usage_this_cycle === "object"
      ? attrs.product_usage_this_cycle
      : {};
    const productUsageStats = attrs.product_usage_stats && typeof attrs.product_usage_stats === "object"
      ? attrs.product_usage_stats
      : {};
    const stats = this.calculateStats(productUsageThisCycle, productUsageStats, attrs.days_until_next_start);

    this.innerHTML = `
      <style>
        :host {
          display: block;
          --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
          --mg-border: var(--divider-color, rgba(128, 128, 128, 0.3));
          --mg-text-primary: var(--primary-text-color, #1f2937);
          --mg-text-secondary: var(--secondary-text-color, #6b7280);
          --mg-color-error: var(--error-color, #e74c3c);
          --mg-color-warning: var(--warning-color, #f39c12);
          --mg-color-success: var(--success-color, #27ae60);
          --mg-color-info: #3498db;
          --mg-chip-text-error: #b03a2e;
          --mg-chip-text-warning: #af601a;
          --mg-chip-text-accent: #6c3483;
          --mg-chip-text-info: #21618c;
          --mg-stat-alpha-strong: 12%;
          --mg-stat-alpha-soft: 5%;
          --mg-chip-alpha: 16%;
          --mg-chip-border-alpha: 26%;
        }

        ha-card {
          background: var(--mg-card-bg);
          color: var(--mg-text-primary);
        }

        .header {
          padding: 16px 16px 8px;
        }

        .title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .subtitle {
          margin: 4px 0 0;
          color: var(--mg-text-secondary);
          font-size: 0.9rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          padding: 8px 16px 16px;
        }

        .stat-card {
          border-radius: 12px;
          border: 1px solid var(--mg-border);
          padding: 14px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--mg-color-error) var(--mg-stat-alpha-strong), transparent), color-mix(in srgb, var(--mg-color-error) var(--mg-stat-alpha-soft), transparent));
        }

        .stat-card.pad {
          background: linear-gradient(135deg, color-mix(in srgb, var(--mg-color-warning) var(--mg-stat-alpha-strong), transparent), color-mix(in srgb, var(--mg-color-warning) var(--mg-stat-alpha-soft), transparent));
        }

        .stat-card.cup {
          background: linear-gradient(135deg, color-mix(in srgb, #8e44ad var(--mg-stat-alpha-strong), transparent), color-mix(in srgb, #8e44ad var(--mg-stat-alpha-soft), transparent));
        }

        .stat-card.liner {
          background: linear-gradient(135deg, color-mix(in srgb, var(--mg-color-info) var(--mg-stat-alpha-strong), transparent), color-mix(in srgb, var(--mg-color-info) var(--mg-stat-alpha-soft), transparent));
        }

        .stat-card.underwear {
          background: linear-gradient(135deg, color-mix(in srgb, var(--mg-color-info) var(--mg-stat-alpha-strong), transparent), color-mix(in srgb, var(--mg-color-info) var(--mg-stat-alpha-soft), transparent));
        }

        .stat-card.plan {
          background: linear-gradient(135deg, color-mix(in srgb, var(--mg-color-success) var(--mg-stat-alpha-strong), transparent), color-mix(in srgb, var(--mg-color-success) var(--mg-stat-alpha-soft), transparent));
        }

        .stat-label {
          color: var(--mg-text-secondary);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .stat-detail {
          margin-top: 6px;
          color: var(--mg-text-secondary);
          font-size: 0.85rem;
        }

        .timeline {
          border-top: 1px solid var(--mg-border);
          padding: 16px;
        }

        .timeline-title {
          margin: 0 0 12px;
          font-size: 1rem;
          font-weight: 600;
        }

        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .timeline-row {
          display: grid;
          grid-template-columns: 92px 1fr;
          gap: 12px;
          align-items: start;
        }

        .timeline-date {
          color: var(--mg-text-secondary);
          font-size: 0.85rem;
          padding-top: 4px;
        }

        .timeline-items {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.85rem;
          font-weight: 600;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .chip svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .chip img {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          object-fit: contain;
          display: block;
        }

        .chip.tampon {
          background: color-mix(in srgb, var(--mg-color-error) var(--mg-chip-alpha), transparent);
          color: var(--mg-chip-text-error);
          border-color: color-mix(in srgb, var(--mg-color-error) var(--mg-chip-border-alpha), transparent);
        }

        .chip.pad {
          background: color-mix(in srgb, var(--mg-color-warning) var(--mg-chip-alpha), transparent);
          color: var(--mg-chip-text-warning);
          border-color: color-mix(in srgb, var(--mg-color-warning) var(--mg-chip-border-alpha), transparent);
        }

        .chip.cup {
          background: color-mix(in srgb, #8e44ad var(--mg-chip-alpha), transparent);
          color: var(--mg-chip-text-accent);
          border-color: color-mix(in srgb, #8e44ad var(--mg-chip-border-alpha), transparent);
        }

        .chip.liner,
        .chip.underwear {
          background: color-mix(in srgb, var(--mg-color-info) var(--mg-chip-alpha), transparent);
          color: var(--mg-chip-text-info);
          border-color: color-mix(in srgb, var(--mg-color-info) var(--mg-chip-border-alpha), transparent);
        }

        .empty-state {
          padding: 16px;
          color: var(--mg-text-secondary);
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --mg-stat-alpha-strong: 24%;
            --mg-stat-alpha-soft: 12%;
            --mg-chip-alpha: 26%;
            --mg-chip-border-alpha: 40%;
            --mg-chip-text-error: #ffd1cc;
            --mg-chip-text-warning: #ffe3b1;
            --mg-chip-text-accent: #e8d3ff;
            --mg-chip-text-info: #d2ebff;
          }

          .chip.tampon,
          .chip.pad,
          .chip.cup,
          .chip.liner,
          .chip.underwear { text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25); }
        }
      </style>
      <ha-card>
        <div class="header">
          <h2 class="title">${this.escapeHtml(this.config.title || this._t("title"))}</h2>
          <p class="subtitle">${this.escapeHtml(attrs.friendly_name || this.config.entity)}</p>
        </div>
        <div class="stats-grid">
          <div class="stat-card tampon">
            <div class="stat-label">${this._t("tampons_per_cycle")}</div>
            <div class="stat-value">${this.formatNumber(stats.tamponsPerCycle)}</div>
            <div class="stat-detail">${this._t("last_cycles", { count: stats.cyclesConsidered })}</div>
          </div>
          <div class="stat-card pad">
            <div class="stat-label">${this._t("pads_per_cycle")}</div>
            <div class="stat-value">${this.formatNumber(stats.padsPerCycle)}</div>
            <div class="stat-detail">${this._t("last_cycles", { count: stats.cyclesConsidered })}</div>
          </div>
          <div class="stat-card cup">
            <div class="stat-label">${this._t("cup_empties_per_day")}</div>
            <div class="stat-value">${this.formatNumber(stats.cupEmptiesPerDay)}</div>
            <div class="stat-detail">${this._t("last_cycle")}</div>
          </div>
          <div class="stat-card liner">
            <div class="stat-label">${this._t("liners_per_cycle")}</div>
            <div class="stat-value">${this.formatNumber(stats.linersPerCycle)}</div>
            <div class="stat-detail">${this._t("last_cycles", { count: stats.cyclesConsidered })}</div>
          </div>
          <div class="stat-card underwear">
            <div class="stat-label">${this._t("underwear_per_cycle")}</div>
            <div class="stat-value">${this.formatNumber(stats.underwearPerCycle)}</div>
            <div class="stat-detail">${this._t("last_cycles", { count: stats.cyclesConsidered })}</div>
          </div>
          <div class="stat-card plan">
            <div class="stat-label">${this._t("planning_days")}</div>
            <div class="stat-value">${stats.planningDays}</div>
            <div class="stat-detail">${this._t("days")}</div>
          </div>
        </div>
        <div class="timeline">
          <h3 class="timeline-title">${this._t("last_30_days")}</h3>
          ${this.renderTimeline(productUsageTimeline)}
        </div>
      </ha-card>
    `;
  }

  calculateStats(productUsageThisCycle, productUsageStats, daysUntilNextStart) {
    const statsData = productUsageStats.stats || productUsageStats;
    const averagePerCycle = statsData.average_per_cycle || {};
    const cyclesConsidered = Number(statsData.cycles_considered || 0);
    const thisCycleCup = Number(productUsageThisCycle.cup || 0);

    return {
      cyclesConsidered: Math.max(0, cyclesConsidered),
      tamponsPerCycle: Number(averagePerCycle.tampon || 0),
      padsPerCycle: Number(averagePerCycle.pad || 0),
      cupEmptiesPerDay: Number(averagePerCycle.cup ?? averagePerCycle.cup_empties ?? thisCycleCup),
      linersPerCycle: Number(averagePerCycle.liner || 0),
      underwearPerCycle: Number(averagePerCycle.underwear || 0),
      planningDays: Math.max(0, Number(daysUntilNextStart || 0)),
    };
  }

  renderTimeline(productUsage) {
    const usageByDate = new Map();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const entry of productUsage) {
      if (!entry?.date) continue;
      const entryDate = new Date(`${entry.date}T00:00:00`);
      const diffDays = Math.floor((now - entryDate) / 86400000);
      if (diffDays < 0 || diffDays >= 30) continue;

      if (!usageByDate.has(entry.date)) {
        usageByDate.set(entry.date, []);
      }
      usageByDate.get(entry.date).push(entry);
    }

    const dates = Array.from(usageByDate.keys()).sort().reverse();
    if (!dates.length) {
      return `<div class="empty-state">${this._t("no_usage_last_30_days")}</div>`;
    }

    return `
      <div class="timeline-list">
        ${dates.map((dateKey) => `
          <div class="timeline-row">
            <div class="timeline-date">${this.formatDate(dateKey)}</div>
            <div class="timeline-items">
              ${usageByDate.get(dateKey).map((entry) => `
                <span class="chip ${this.escapeClassName(entry.product)}">
                  ${this._getSvgIcon(entry.product)}${this.escapeHtml(this.productLabel(entry))} ×${this.normalizeQuantity(entry.quantity)}
                </span>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  productLabel(entry) {
    const product = entry?.product;
    if (product === "cup" && entry?.action === "emptied") {
      return this._t("cup_empty");
    }

    return {
      tampon: this._t("tampon"),
      pad: this._t("pad"),
      cup: this._t("cup"),
      liner: this._t("liner"),
      underwear: this._t("underwear"),
    }[product] || product;
  }

  normalizeQuantity(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  formatNumber(value) {
    return Number(value || 0).toFixed(1).replace(/\.0$/, "");
  }

  _lang() {
    const language = String(this._hass?.locale?.language || "en").toLowerCase();
    return language.startsWith("de") ? "de" : "en";
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  escapeClassName(value) {
    const sanitized = String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    return sanitized || "unknown";
  }

  dateLocale() {
    const locale = this._hass?.locale?.language || this._hass?.language;
    if (!locale) {
      return this._lang();
    }

    try {
      return Intl.getCanonicalLocales(locale)[0] || this._lang();
    } catch (_error) {
      return this._lang();
    }
  }

  formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    try {
      return new Intl.DateTimeFormat(this.dateLocale(), {
        month: "short",
        day: "numeric",
      }).format(date);
    } catch (_error) {
      return value;
    }
  }

  _getSvgIcon(product) {
    return window.ProductIcons?.getSvgIcon(product) || '';
  }

  _t(key, placeholders = {}) {
    const translations = {
      de: {
        title: "Produktverbrauch",
        tampons_per_cycle: "Tampons / Periode",
        pads_per_cycle: "Binden / Periode",
        cup_empties_per_day: "Cup-Leerungen / Tag",
        liners_per_cycle: "Slipeinlagen / Periode",
        underwear_per_cycle: "Periodenunterwäsche / Periode",
        planning_days: "Planungstage",
        days: "Tage",
        last_cycle: "Letzte Periode",
        last_cycles: `${placeholders.count || 0} Zyklen`,
        last_30_days: "Letzte 30 Tage",
        no_usage_last_30_days: "In den letzten 30 Tagen wurden keine Produkte geloggt.",
        tampon: "Tampon",
        pad: "Binde",
        cup: "Cup",
        cup_empty: "Cup geleert",
        liner: "Slipeinlage",
        underwear: "Periodenunterwäsche",
      },
      en: {
        title: "Product usage",
        tampons_per_cycle: "Tampons / period",
        pads_per_cycle: "Pads / period",
        cup_empties_per_day: "Cup empties / day",
        liners_per_cycle: "Liners / period",
        underwear_per_cycle: "Period underwear / period",
        planning_days: "Planning days",
        days: "days",
        last_cycle: "Last period",
        last_cycles: `${placeholders.count || 0} cycles`,
        last_30_days: "Last 30 days",
        no_usage_last_30_days: "No products were logged in the last 30 days.",
        tampon: "Tampon",
        pad: "Pad",
        cup: "Cup",
        cup_empty: "Cup emptied",
        liner: "Liner",
        underwear: "Period underwear",
      },
    };

    const lang = this._lang();
    return translations[lang]?.[key] || translations.en[key] || key;
  }
}

if (!customElements.get("menstrual-product-stats-card")) {
  customElements.define("menstrual-product-stats-card", MenstrualProductStatsCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstrual-product-stats-card",
  name: "Menstrual Product Stats Card",
  description: "Shows per-cycle product usage KPIs and a 30-day usage timeline.",
});
