class MenstruationProductStatsCard extends HTMLElement {
  setConfig(config) {
    if (!config?.entity) {
      throw new Error("Entity is required");
    }
    this.config = {
      tampon_price: 0.12,
      pad_price: 0.10,
      cup_price: 30,
      tampon_co2_g: 1.5,
      pad_co2_g: 2.5,
      cup_co2_g: 18,
      co2_source_url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10148749/",
      underwear_total_owned: 12,
      target_wash_days: 7,
      ...config,
    };
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
      title: 'Product usage'
    };
  }

  connectedCallback() {
    if (this._handlersAttached) return;
    this._handlersAttached = true;
    this.addEventListener("click", async (event) => {
      const button = event.target?.closest?.("button[data-action]");
      if (!button || !this._hass) return;
      if (button.dataset.action !== "add-underwear-shopping") return;
      const quantity = Math.max(1, Number(button.dataset.quantity || 1));
      await this._hass.callService("menstruation_gauge", "manage_household_inventory", {
        inventory_action: "add_to_shopping_list",
        product: "underwear",
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
    const averageDailyUnderwearUsage = this.calculateAverageDailyUsage(productUsageTimeline, "underwear");
    const washPlan = this.calculateUnderwearWashPlan(averageDailyUnderwearUsage);
    const cupSavings = this.calculateCupSavings(productUsageTimeline);

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

        .stat-card button {
          margin-top: 8px;
          border: 1px solid var(--mg-border);
          border-radius: 8px;
          padding: 6px 10px;
          background: var(--mg-card-bg);
          color: var(--mg-text-primary);
          cursor: pointer;
        }

        .stat-card a {
          color: inherit;
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
          <div class="stat-card plan">
            <div class="stat-label">${this._t("wash_every_x_days")}</div>
            <div class="stat-value">${washPlan.washEveryDaysText}</div>
            <div class="stat-detail">${this._t("based_on_daily_usage", { value: this.formatNumber(averageDailyUnderwearUsage) })}</div>
          </div>
          <div class="stat-card underwear">
            <div class="stat-label">${this._t("buy_x_more_underwear")}</div>
            <div class="stat-value">${washPlan.buyMore}</div>
            <div class="stat-detail">${this._t("for_wash_goal", { days: washPlan.targetWashDays })}</div>
            ${washPlan.buyMore > 0 ? `<button data-action="add-underwear-shopping" data-quantity="${washPlan.buyMore}">${this._t("add_to_shopping_list")}</button>` : ""}
          </div>
          <div class="stat-card cup">
            <div class="stat-label">${this._t("cup_cost_savings")}</div>
            <div class="stat-value">€${this.formatNumber(cupSavings.costSavingsEur)}</div>
            <div class="stat-detail">${this._t("annual_projection")}</div>
          </div>
          <div class="stat-card cup">
            <div class="stat-label">${this._t("cup_co2_savings")}</div>
            <div class="stat-value">${this.formatNumber(cupSavings.co2SavingsKg)} kg</div>
            <div class="stat-detail">${this._t("annual_projection")}${this.config.co2_source_url ? ` · <a href="${this.escapeHtml(this.config.co2_source_url)}" target="_blank" rel="noopener noreferrer">${this._t("source")}</a>` : ""}</div>
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
    const getCycleValue = (averageKey, currentKey) => {
      const averageValue = Number(averagePerCycle[averageKey]);
      if (cyclesConsidered > 0 || averageValue > 0) {
        return Number.isFinite(averageValue) ? averageValue : 0;
      }
      return Number(productUsageThisCycle[currentKey] || 0);
    };

    return {
      cyclesConsidered: Math.max(0, cyclesConsidered),
      tamponsPerCycle: getCycleValue("tampon", "tampon"),
      padsPerCycle: getCycleValue("pad", "pad"),
      cupEmptiesPerDay: Number(averagePerCycle.cup ?? averagePerCycle.cup_empties ?? productUsageThisCycle.cup ?? 0),
      linersPerCycle: getCycleValue("liner", "liner"),
      underwearPerCycle: getCycleValue("underwear", "underwear"),
      planningDays: Math.max(0, Number(daysUntilNextStart || 0)),
    };
  }

  calculateAverageDailyUsage(productUsage, product) {
    const entries = (Array.isArray(productUsage) ? productUsage : [])
      .map((entry) => ({
        ...entry,
        product: this.normalizeProductKey(entry?.product),
        date: this.normalizeDateKey(entry?.date ?? entry?.created_at ?? entry?.logged_at ?? entry?.timestamp),
        quantity: this.normalizeQuantity(entry?.quantity),
      }))
      .filter((entry) => entry.product === product && entry.date);

    if (!entries.length) return 0;
    const sortedDates = entries.map((entry) => entry.date).sort();
    const start = new Date(`${sortedDates[0]}T00:00:00Z`).getTime();
    const end = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00Z`).getTime();
    const daySpan = Math.max(1, Math.floor((end - start) / 86400000) + 1);
    const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    return total / daySpan;
  }

  calculateUnderwearWashPlan(averageDailyUsage) {
    const totalOwned = Math.max(1, Number(this.config?.underwear_total_owned ?? 12));
    const targetWashDays = Math.max(1, Number(this.config?.target_wash_days ?? 7));
    if (averageDailyUsage <= 0) {
      return { washEveryDays: 0, washEveryDaysText: "—", buyMore: 0, targetWashDays };
    }
    const washEveryDays = totalOwned / averageDailyUsage;
    const buyMore = Math.max(0, Math.ceil((averageDailyUsage * targetWashDays) - totalOwned));
    return {
      washEveryDays,
      washEveryDaysText: this.formatNumber(washEveryDays),
      buyMore,
      targetWashDays,
    };
  }

  calculateCupSavings(productUsage) {
    const entries = Array.isArray(productUsage) ? productUsage : [];
    const cupUseTotal = entries
      .filter((entry) => this.normalizeProductKey(entry?.product) === "cup")
      .reduce((sum, entry) => sum + this.normalizeQuantity(entry?.quantity), 0);
    const cupUsesPerDay = cupUseTotal / 30;
    const annualCupUses = cupUsesPerDay * 365;

    const tamponPrice = Math.max(0, Number(this.config?.tampon_price ?? 0.12));
    const padPrice = Math.max(0, Number(this.config?.pad_price ?? 0.10));
    const cupPrice = Math.max(0, Number(this.config?.cup_price ?? 30));
    const disposableAvgPrice = (tamponPrice + padPrice) / 2;

    const tamponCo2 = Math.max(0, Number(this.config?.tampon_co2_g ?? 1.5));
    const padCo2 = Math.max(0, Number(this.config?.pad_co2_g ?? 2.5));
    const cupCo2 = Math.max(0, Number(this.config?.cup_co2_g ?? 18));
    const disposableAvgCo2 = (tamponCo2 + padCo2) / 2;

    return {
      annualCupUses,
      costSavingsEur: (annualCupUses * disposableAvgPrice) - cupPrice,
      co2SavingsKg: ((annualCupUses * disposableAvgCo2) - cupCo2) / 1000,
    };
  }

  renderTimeline(productUsage) {
    const usageByDate = new Map();
    const todayOrdinal = this.todayOrdinal();

    for (const entry of Array.isArray(productUsage) ? productUsage : []) {
      const dateKey = this.normalizeDateKey(entry?.date ?? entry?.created_at ?? entry?.logged_at ?? entry?.timestamp);
      const productKey = this.normalizeProductKey(entry?.product);
      if (!dateKey || !productKey) continue;
      const entryOrdinal = this.dateKeyToOrdinal(dateKey);
      if (entryOrdinal === null) continue;
      const diffDays = todayOrdinal - entryOrdinal;
      if (diffDays < 0 || diffDays >= 30) continue;

      if (!usageByDate.has(dateKey)) {
        usageByDate.set(dateKey, []);
      }
      usageByDate.get(dateKey).push({
        ...entry,
        date: dateKey,
        product: productKey,
        quantity: this.normalizeQuantity(entry?.quantity),
      });
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
                  ${this._getSvgIcon(entry.product)} × ${this.normalizeQuantity(entry.quantity)}
                </span>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  productLabel(entry) {
    const product = this.normalizeProductKey(entry?.product) || entry?.product;
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
    let parsed = null;
    if (typeof value === "number") {
      parsed = value;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        const match = trimmed.match(/[-+]?\d+(?:[.,]\d+)?/);
        if (match) {
          parsed = Number(match[0].replace(",", "."));
        }
      }
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return Math.max(1, Math.floor(parsed));
  }

  normalizeProductKey(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) {
      return null;
    }
    const normalized = raw.replace(/-/g, "_");
    return {
      tampon: "tampon",
      tampons: "tampon",
      pad: "pad",
      pads: "pad",
      binde: "pad",
      binden: "pad",
      cup: "cup",
      cups: "cup",
      menstrual_cup: "cup",
      "menstrual cup": "cup",
      liner: "liner",
      liners: "liner",
      pantyliner: "liner",
      pantyliners: "liner",
      slipeinlage: "liner",
      slipeinlagen: "liner",
      underwear: "underwear",
      period_underwear: "underwear",
      "period underwear": "underwear",
      period_panties: "underwear",
      "period panties": "underwear",
      period_panty: "underwear",
      "period panty": "underwear",
      periodenunterwaesche: "underwear",
      "periodenunterwäsche": "underwear",
    }[normalized] || {
      "period underwear": "underwear",
      "period panties": "underwear",
      "period panty": "underwear",
      "menstrual cup": "cup",
    }[raw] || raw;
  }

  normalizeDateKey(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (
        parsed.getUTCFullYear() === Number(year)
        && parsed.getUTCMonth() + 1 === Number(month)
        && parsed.getUTCDate() === Number(day)
      ) {
        return `${year}-${month}-${day}`;
      }
    }

    const numeric = Number(raw);
    if (Number.isFinite(numeric) && Number.isInteger(numeric)) {
      const timestamp = Math.abs(numeric) >= 1_000_000_000_000 ? numeric : numeric * 1000;
      const parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
      }
    }

    return null;
  }

  dateKeyToOrdinal(value) {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const [, year, month, day] = match;
    return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86400000);
  }

  todayOrdinal() {
    const now = new Date();
    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
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
    const dateKey = this.normalizeDateKey(value);
    if (!dateKey) {
      return value;
    }
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return value;
    }
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
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
        wash_every_x_days: "Wasche alle X Tage",
        buy_x_more_underwear: "Kaufe X mehr Slips",
        based_on_daily_usage: `bei ~${placeholders.value || 0} pro Tag`,
        for_wash_goal: `für alle ${placeholders.days || 0} Tage Waschrhythmus`,
        add_to_shopping_list: "Zur Einkaufsliste",
        cup_cost_savings: "Cup Kostenersparnis",
        cup_co2_savings: "Cup CO2-Ersparnis",
        annual_projection: "Jahres-Prognose",
        source: "Quelle",
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
        wash_every_x_days: "Wash every X days",
        buy_x_more_underwear: "Buy X more underwear",
        based_on_daily_usage: `based on ~${placeholders.value || 0}/day`,
        for_wash_goal: `for a ${placeholders.days || 0}-day wash routine`,
        add_to_shopping_list: "Add to shopping list",
        cup_cost_savings: "Cup cost savings",
        cup_co2_savings: "Cup CO2 savings",
        annual_projection: "Annual projection",
        source: "Source",
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
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
    this._render();
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const cfg = this._config || {};
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; padding: 8px 0; }
        .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
        input { border: 1px solid var(--divider-color, #ccc); border-radius: 6px; padding: 6px 8px; }
      </style>
      <div class="field"><label>Title</label><input data-key="title" value="${this._escape(cfg.title || "")}"></div>
      <div class="field"><label>Entity</label><input data-key="entity" value="${this._escape(cfg.entity || "")}"></div>
      <div class="field"><label>Tampon price (€)</label><input type="number" step="0.01" min="0" data-key="tampon_price" value="${Number(cfg.tampon_price ?? 0.12)}"></div>
      <div class="field"><label>Pad price (€)</label><input type="number" step="0.01" min="0" data-key="pad_price" value="${Number(cfg.pad_price ?? 0.10)}"></div>
      <div class="field"><label>Cup price (€)</label><input type="number" step="0.01" min="0" data-key="cup_price" value="${Number(cfg.cup_price ?? 30)}"></div>
      <div class="field"><label>Tampon CO2 (g)</label><input type="number" step="0.1" min="0" data-key="tampon_co2_g" value="${Number(cfg.tampon_co2_g ?? 1.5)}"></div>
      <div class="field"><label>Pad CO2 (g)</label><input type="number" step="0.1" min="0" data-key="pad_co2_g" value="${Number(cfg.pad_co2_g ?? 2.5)}"></div>
      <div class="field"><label>Cup CO2 (g one-time)</label><input type="number" step="0.1" min="0" data-key="cup_co2_g" value="${Number(cfg.cup_co2_g ?? 18)}"></div>
      <div class="field"><label>CO2 source URL</label><input data-key="co2_source_url" value="${this._escape(cfg.co2_source_url || "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10148749/")}"></div>
      <div class="field"><label>Underwear total owned</label><input type="number" min="1" data-key="underwear_total_owned" value="${Math.max(1, Number(cfg.underwear_total_owned ?? 12))}"></div>
      <div class="field"><label>Target wash cadence (days)</label><input type="number" min="1" data-key="target_wash_days" value="${Math.max(1, Number(cfg.target_wash_days ?? 7))}"></div>
    `;
    this.shadowRoot.querySelectorAll("input[data-key]").forEach((input) => {
      input.addEventListener("change", (event) => {
        const key = event.target.dataset.key;
        const raw = event.target.value;
        const numericKeys = new Set([
          "tampon_price", "pad_price", "cup_price",
          "tampon_co2_g", "pad_co2_g", "cup_co2_g",
          "underwear_total_owned", "target_wash_days",
        ]);
        const value = numericKeys.has(key) ? Number(raw) : raw;
        this._fireConfigChanged({ ...this._config, [key]: value });
      });
    });
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

if (!customElements.get("menstruation-product-stats-card")) {
  customElements.define("menstruation-product-stats-card", MenstruationProductStatsCard);
}
if (!customElements.get("menstruation-product-stats-card-editor")) {
  customElements.define("menstruation-product-stats-card-editor", MenstruationProductStatsCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstruation-product-stats-card",
  name: "Menstruation Product Stats Card",
  description: "Shows per-cycle product usage KPIs and a 30-day usage timeline.",
});
