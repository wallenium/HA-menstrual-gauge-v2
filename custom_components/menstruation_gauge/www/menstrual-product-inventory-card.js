class MenstrualProductInventoryCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:menstrual-product-inventory-card",
      inventory_entity: "sensor.household_product_stock",
      title: "Household inventory",
      member: "",
      visible_products: ["tampon", "pad", "cup", "liner", "underwear"],
      product_order: ["tampon", "pad", "cup", "liner", "underwear"],
      show_thresholds: true,
    };
  }

  static getConfigElement() {
    return document.createElement("menstrual-product-inventory-card-editor");
  }

  setConfig(config) {
    this.config = {
      inventory_entity: "sensor.household_product_stock",
      title: "",
      member: "",
      show_thresholds: true,
      ...config,
    };
    this._ensureRoot();
    this._attachHandlers();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Only re-render when the inventory entity state actually changes to avoid
    // destroying the DOM (and losing input focus) on every HA poll cycle.
    const entityId = this.config?.inventory_entity || "sensor.household_product_stock";
    const newState = hass?.states?.[entityId];
    if (newState === this._lastRenderedState) return;
    this._lastRenderedState = newState;
    this._render();
  }

  getCardSize() {
    return 6;
  }

  _ensureRoot() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
  }

  _lang() {
    const language = String(this._hass?.locale?.language || "en").toLowerCase();
    return language.startsWith("de") ? "de" : "en";
  }

  _t(key) {
    const i18n = {
      de: {
        title: "Haushaltsvorrat",
        entity_not_found: "Inventar-Entity nicht gefunden",
        members: "Haushaltsmitglieder",
        member: "Mitglied",
        all_members: "Alle",
        last_usage: "Zuletzt genutzt",
        no_usage: "Noch kein Verbrauch erfasst",
        product: "Produkt",
        stock: "Bestand",
        actions: "Aktionen",
        quick_minus: "-1",
        quick_plus: "+1",
        quantity: "Menge",
        set: "Setzen",
        add: "Auffüllen",
        consume: "Verbrauch",
        warning: "Warnung",
        critical: "Kritisch",
        save_thresholds: "Schwellen speichern",
        recent_usage: "Letzte Verbräuche",
        no_logs: "Keine Verbrauchseinträge",
        status_good: "Gut",
        status_warning: "Warnung",
        status_critical: "Kritisch",
        unknown_member: "Unbekannt",
        error_prefix: "Fehler",
        tampon: "Tampons",
        pad: "Binden",
        cup: "Menstruationstassen",
        liner: "Slipeinlagen",
        underwear: "Periodenunterwäsche",
      },
      en: {
        title: "Household inventory",
        entity_not_found: "Inventory entity not found",
        members: "Household members",
        member: "Member",
        all_members: "All",
        last_usage: "Last usage",
        no_usage: "No usage logged yet",
        product: "Product",
        stock: "Stock",
        actions: "Actions",
        quick_minus: "-1",
        quick_plus: "+1",
        quantity: "Qty",
        set: "Set",
        add: "Add stock",
        consume: "Consume",
        warning: "Warning",
        critical: "Critical",
        save_thresholds: "Save thresholds",
        recent_usage: "Recent usage",
        no_logs: "No consumption logs",
        status_good: "Good",
        status_warning: "Warning",
        status_critical: "Critical",
        unknown_member: "Unknown",
        error_prefix: "Error",
        tampon: "Tampons",
        pad: "Pads",
        cup: "Menstrual cups",
        liner: "Liners",
        underwear: "Period underwear",
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
  }

  _products() {
    const ALL_PRODUCTS = ["tampon", "pad", "cup", "liner", "underwear"];

    // Apply custom order if specified
    let ordered;
    if (Array.isArray(this.config?.product_order) && this.config.product_order.length > 0) {
      const validOrder = this.config.product_order.filter((p) => ALL_PRODUCTS.includes(p));
      const missing = ALL_PRODUCTS.filter((p) => !validOrder.includes(p));
      ordered = [...validOrder, ...missing];
    } else {
      ordered = [...ALL_PRODUCTS];
    }

    // Apply visibility filter – if not set, show all products (backward compatible)
    if (Array.isArray(this.config?.visible_products) && this.config.visible_products.length > 0) {
      const visibleSet = new Set(this.config.visible_products.filter((p) => ALL_PRODUCTS.includes(p)));
      return ordered.filter((p) => visibleSet.has(p));
    }

    return ordered;
  }

  _getEntity() {
    return this._hass?.states?.[this.config?.inventory_entity || "sensor.household_product_stock"];
  }

  _stockStatus(quantity, threshold) {
    const warning = Number(threshold?.warning ?? 10);
    const critical = Number(threshold?.critical ?? 5);
    if (quantity <= critical) return "critical";
    if (quantity <= warning) return "warning";
    return "good";
  }

  async _callInventory(action, product, quantity, extra = {}) {
    const serviceData = {
      inventory_action: action,
      ...extra,
    };
    if (product) serviceData.product = product;
    if (quantity !== undefined && quantity !== null) serviceData.quantity = Number(quantity) || 0;

    try {
      await this._hass.callService("menstruation_gauge", "manage_household_inventory", serviceData);
      this._setError("");
    } catch (error) {
      this._setError(`${this._t("error_prefix")}: ${error?.message || error}`);
      throw error;
    }
  }

  _setError(message) {
    this._errorMessage = message;
    this._render();
  }

  _escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  _getProductIconSvg(productKey) {
    return window.ProductIcons?.getSvgIcon(productKey, 'large') || '';
  }

  _formatTimestamp(ts) {
    if (!ts) return "";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    const locale = typeof this._hass?.locale?.language === "string" ? this._hass.locale.language : "en";
    const safeLocale = Intl.DateTimeFormat.supportedLocalesOf([locale])[0] || "en";
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };

    try {
      return new Intl.DateTimeFormat(safeLocale, options).format(date);
    } catch (error) {
      return new Intl.DateTimeFormat("en", options).format(date);
    }
  }

  _attachHandlers() {
    if (this._handlersAttached) return;
    this._handlersAttached = true;

    // Single delegated click listener on shadowRoot — survives innerHTML replacements
    this.shadowRoot.addEventListener("click", async (ev) => {
      const button = ev.target?.closest("button[data-action]");
      if (!button) return;

      try {
        const action = button.dataset.action;
        const product = button.dataset.product;
        if (!action || !product) return;

        const inputQuantity = Number(this._inputValues?.[product] ?? 1);
        let quantity = Number(button.dataset.quantity || inputQuantity || 1);
        if (["set-input", "add-input", "consume-input"].includes(button.dataset.role)) {
          quantity = inputQuantity;
        }

        if (action === "set_thresholds") {
          const warning = Number(this._thresholdValues?.[product]?.warning);
          const critical = Number(this._thresholdValues?.[product]?.critical);
          await this._callInventory("set_thresholds", product, null, {
            warning_threshold: Number.isFinite(warning) ? warning : undefined,
            critical_threshold: Number.isFinite(critical) ? critical : undefined,
          });
          return;
        }

        const member = this._selectedMember || this.config.member || "";
        await this._callInventory(action, product, quantity, member ? { member } : {});
      } catch (error) {
        console.error("Button click error:", error);
      }
    });

    // Delegated input handler for qty and threshold inputs
    this.shadowRoot.addEventListener("input", (ev) => {
      const input = ev.target;
      if (!input) return;

      const role = input.dataset?.role;
      const product = input.dataset?.product;
      if (!role || !product) return;

      if (role === "qty") {
        const value = Number(input.value || 0);
        this._inputValues = { ...(this._inputValues || {}), [product]: value };
      } else if (role === "warning" || role === "critical") {
        const value = Number(input.value || 0);
        this._thresholdValues = {
          ...(this._thresholdValues || {}),
          [product]: {
            ...(this._thresholdValues?.[product] || {}),
            [role]: value,
          },
        };
      }
    });

    // Delegated change handler for member selector
    this.shadowRoot.addEventListener("change", (ev) => {
      if (ev.target?.id === "memberSelector") {
        this._selectedMember = ev.target.value;
      }
    });
  }

  _render() {
    if (!this.shadowRoot || !this._hass || !this.config) return;

    // Keep _lastRenderedState in sync so the set hass() guard stays accurate
    // even when _render() is called directly (e.g. from _setError).
    const entityId = this.config?.inventory_entity || "sensor.household_product_stock";
    this._lastRenderedState = this._hass?.states?.[entityId];

    const inventoryEntity = this._escapeHtml(this.config.inventory_entity);
    const stateObj = this._getEntity();
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">${this._t("entity_not_found")}: ${inventoryEntity}</div></ha-card>`;
      return;
    }

    const attrs = stateObj.attributes || {};
    const inventory = attrs.inventory || {};
    const thresholds = attrs.thresholds || {};
    const members = Array.isArray(attrs.household_members) ? attrs.household_members : [];
    const memberNames = members.map((member) => member?.name).filter(Boolean);
    const selectedMember = (this._selectedMember ?? this.config.member) || "";
    const lastUsage = attrs.last_usage;
    const recentLogs = Array.isArray(attrs.consumption_log) ? attrs.consumption_log.slice(-5).reverse() : [];
    const title = this._escapeHtml(this.config.title || this._t("title"));
    const memberList = memberNames.length ? memberNames.map((name) => this._escapeHtml(name)).join(", ") : "-";
    const lastUsageText = lastUsage
      ? `${this._escapeHtml(this._t(lastUsage.product))} ×${this._escapeHtml(lastUsage.quantity)} · ${this._escapeHtml(lastUsage.member || this._t("unknown_member"))} · ${this._escapeHtml(this._formatTimestamp(lastUsage.timestamp))}`
      : this._t("no_usage");

    const showThresholds = this.config.show_thresholds !== false;

    const rows = this._products()
      .map((product) => {
        const quantity = Math.max(0, Number(inventory[product] || 0));
        const threshold = thresholds[product] || { warning: 10, critical: 5 };
        const status = this._stockStatus(quantity, threshold);
        const qtyValue = this._inputValues?.[product] ?? 1;
        const warningValue = this._thresholdValues?.[product]?.warning ?? threshold.warning;
        const criticalValue = this._thresholdValues?.[product]?.critical ?? threshold.critical;

        return `
          <div class="row">
            <div class="product-header">
              <div class="product-name">${this._t(product)}</div>
              <div class="product-icon">${this._getProductIconSvg(product)}</div>
            </div>
            <div class="stock ${status}">${quantity}<span>${this._t(`status_${status}`)}</span></div>
            <div class="controls">
              <button class="btn" data-action="consume" data-product="${product}" data-quantity="1">${this._t("quick_minus")}</button>
              <button class="btn" data-action="add" data-product="${product}" data-quantity="1">${this._t("quick_plus")}</button>
              <input class="qty" type="number" min="0" data-role="qty" data-product="${product}" value="${qtyValue}">
              <button class="btn" data-action="set" data-product="${product}" data-role="set-input">${this._t("set")}</button>
              <button class="btn" data-action="add" data-product="${product}" data-role="add-input">${this._t("add")}</button>
              <button class="btn warn" data-action="consume" data-product="${product}" data-role="consume-input">${this._t("consume")}</button>
              ${showThresholds ? `
              <input class="thr" type="number" min="0" data-role="warning" data-product="${product}" value="${warningValue}" placeholder="${this._t("warning")}">
              <input class="thr" type="number" min="0" data-role="critical" data-product="${product}" value="${criticalValue}" placeholder="${this._t("critical")}">
              <button class="btn" data-action="set_thresholds" data-product="${product}">${this._t("save_thresholds")}</button>
              ` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
          --mg-text-primary: var(--primary-text-color, #1f2937);
          --mg-text-secondary: var(--secondary-text-color, #6b7280);
          --mg-border: var(--divider-color, rgba(127, 127, 127, 0.35));
          --mg-status-success: var(--success-color, #1e8449);
          --mg-status-warning: var(--warning-color, #b9770e);
          --mg-status-error: var(--error-color, #c0392b);
          --mg-surface-accent: color-mix(in srgb, var(--mg-status-error) 10%, transparent);
        }
        ha-card { padding: 14px; background: var(--mg-card-bg); color: var(--mg-text-primary); }
        .title { margin: 0 0 8px; font-size: 1.2rem; font-weight: 700; }
        .meta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; color: var(--mg-text-secondary); }
        .error { color: var(--error-color); margin-bottom: 10px; font-size: 0.9rem; }
        .rows { display: grid; gap: 12px; }
        .row { border: 1px solid var(--mg-border); border-radius: 12px; padding: 10px; background: linear-gradient(135deg, var(--mg-surface-accent), transparent); }
        .product-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
        .product-name { flex: 1; font-weight: 600; color: var(--primary-text-color); }
        .product-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--primary-color, #8e44ad); opacity: 0.85; }
        .product-icon svg { width: 100%; height: 100%; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .stock { font-size: 1.5rem; font-weight: 700; display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
        .stock span { font-size: 0.8rem; font-weight: 500; }
        .stock.good { color: var(--mg-status-success); }
        .stock.warning { color: var(--mg-status-warning); }
        .stock.critical { color: var(--mg-status-error); }
        .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
        button, select { border: 1px solid var(--mg-border); border-radius: 8px; padding: 7px 9px; cursor: pointer; background: var(--mg-card-bg); color: var(--mg-text-primary); }
        button.warn { border-color: color-mix(in srgb, var(--mg-status-error) 55%, transparent); }
        input { border: 1px solid var(--mg-border); border-radius: 8px; padding: 7px; min-width: 0; background: transparent; color: var(--mg-text-primary); }
        .logs { margin-top: 12px; border-top: 1px solid var(--mg-border); padding-top: 10px; }
        .log-item { display: flex; justify-content: space-between; gap: 8px; font-size: 0.88rem; margin-top: 6px; }
        .empty { padding: 16px; color: var(--mg-text-secondary); }
        @media (prefers-color-scheme: dark) {
          :host { --mg-surface-accent: color-mix(in srgb, var(--mg-status-error) 20%, transparent); }
          button, select, input { background: color-mix(in srgb, var(--mg-card-bg) 88%, #000 12%); }
        }
        @media (max-width: 600px) {
          .product-icon { width: 32px; height: 32px; }
        }
      </style>
      <ha-card>
        <h2 class="title">${title}</h2>
        <div class="meta">
          <div><strong>${this._t("members")}:</strong> ${memberList}</div>
          <label>
            <strong>${this._t("member")}:</strong>
            <select id="memberSelector">
              <option value="">${this._t("all_members")}</option>
              ${memberNames.map((name) => `<option value="${this._escapeHtml(name)}" ${selectedMember === name ? "selected" : ""}>${this._escapeHtml(name)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="meta"><strong>${this._t("last_usage")}:</strong> ${lastUsageText}</div>
        ${this._errorMessage ? `<div class="error">${this._escapeHtml(this._errorMessage)}</div>` : ""}
        <div class="rows">${rows}</div>
        <div class="logs">
          <strong>${this._t("recent_usage")}</strong>
          ${recentLogs.length ? recentLogs.map((entry) => `
            <div class="log-item">
              <span>${this._escapeHtml(this._t(entry.product))} ×${this._escapeHtml(entry.quantity)} · ${this._escapeHtml(entry.member || this._t("unknown_member"))}</span>
              <span>${this._escapeHtml(this._formatTimestamp(entry.timestamp))}</span>
            </div>
          `).join("") : `<div class="empty">${this._t("no_logs")}</div>`}
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get("menstrual-product-inventory-card")) {
  customElements.define("menstrual-product-inventory-card", MenstrualProductInventoryCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstrual-product-inventory-card",
  name: "Menstrual Product Inventory Card",
  description: "Shared household inventory management for period products.",
});
