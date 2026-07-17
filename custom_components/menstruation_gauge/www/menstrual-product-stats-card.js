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
    const productUsage = Array.isArray(attrs.product_usage) ? attrs.product_usage : [];
    const bleedingBlocks = Array.isArray(attrs.bleeding_blocks) ? attrs.bleeding_blocks : [];
    const stats = this.calculateStats(productUsage, bleedingBlocks, attrs.days_until_next_start);

    this.innerHTML = `
      <style>
        :host {
          display: block;
        }

        ha-card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color);
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
          color: var(--secondary-text-color);
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
          border: 1px solid var(--divider-color);
          padding: 14px;
          background: linear-gradient(135deg, rgba(231, 76, 60, 0.08), rgba(231, 76, 60, 0.02));
        }

        .stat-card.pad {
          background: linear-gradient(135deg, rgba(243, 156, 18, 0.08), rgba(243, 156, 18, 0.02));
        }

        .stat-card.cup {
          background: linear-gradient(135deg, rgba(142, 68, 173, 0.08), rgba(142, 68, 173, 0.02));
        }

        .stat-card.plan {
          background: linear-gradient(135deg, rgba(39, 174, 96, 0.08), rgba(39, 174, 96, 0.02));
        }

        .stat-label {
          color: var(--secondary-text-color);
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
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }

        .timeline {
          border-top: 1px solid var(--divider-color);
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
          color: var(--secondary-text-color);
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
        }

        .chip.tampon {
          background: rgba(231, 76, 60, 0.14);
          color: #b03a2e;
          border-color: rgba(231, 76, 60, 0.18);
        }

        .chip.pad {
          background: rgba(243, 156, 18, 0.14);
          color: #af601a;
          border-color: rgba(243, 156, 18, 0.18);
        }

        .chip.cup {
          background: rgba(142, 68, 173, 0.14);
          color: #6c3483;
          border-color: rgba(142, 68, 173, 0.18);
        }

        .chip.liner,
        .chip.underwear {
          background: rgba(52, 152, 219, 0.14);
          color: #21618c;
          border-color: rgba(52, 152, 219, 0.18);
        }

        .empty-state {
          padding: 16px;
          color: var(--secondary-text-color);
        }

        @media (prefers-color-scheme: dark) {
          .chip.tampon { color: #f5b7b1; }
          .chip.pad { color: #f8c471; }
          .chip.cup { color: #d2b4de; }
          .chip.liner,
          .chip.underwear { color: #aed6f1; }
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
          <div class="stat-card plan">
            <div class="stat-label">${this._t("planning_days")}</div>
            <div class="stat-value">${stats.planningDays}</div>
            <div class="stat-detail">${this._t("days")}</div>
          </div>
        </div>
        <div class="timeline">
          <h3 class="timeline-title">${this._t("last_30_days")}</h3>
          ${this.renderTimeline(productUsage)}
        </div>
      </ha-card>
    `;
  }

  calculateStats(productUsage, bleedingBlocks, daysUntilNextStart) {
    const blocks = bleedingBlocks.slice(-3).filter((block) => block?.start && block?.end);
    const countInRange = (product, start, end, action) =>
      productUsage.reduce((total, entry) => {
        if (entry?.product !== product) return total;
        if (action && entry?.action !== action) return total;
        if (entry?.date < start || entry?.date > end) return total;
        return total + this.normalizeQuantity(entry?.quantity);
      }, 0);

    const averageForBlocks = (product, action) => {
      if (!blocks.length) return 0;
      const total = blocks.reduce((sum, block) => sum + countInRange(product, block.start, block.end, action), 0);
      return total / blocks.length;
    };

    const lastBlock = bleedingBlocks.length ? bleedingBlocks[bleedingBlocks.length - 1] : null;
    const lastBlockDays = Math.max(1, Number(lastBlock?.length || 1));
    const lastBlockCupEmpties = lastBlock?.start && lastBlock?.end
      ? countInRange("cup", lastBlock.start, lastBlock.end, "emptied")
      : 0;

    return {
      cyclesConsidered: blocks.length,
      tamponsPerCycle: averageForBlocks("tampon"),
      padsPerCycle: averageForBlocks("pad"),
      cupEmptiesPerDay: lastBlockCupEmpties / lastBlockDays,
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
                  ${this.escapeHtml(this.productLabel(entry))} ×${this.normalizeQuantity(entry.quantity)}
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

  _t(key, placeholders = {}) {
    const translations = {
      de: {
        title: "Produktverbrauch",
        tampons_per_cycle: "Tampons / Periode",
        pads_per_cycle: "Binden / Periode",
        cup_empties_per_day: "Cup-Leerungen / Tag",
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
