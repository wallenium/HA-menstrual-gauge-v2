class MenstrualProductInventoryCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:menstrual-product-inventory-card",
      inventory_entity: "sensor.household_product_stock",
      title: "Household inventory",
      member: "",
    };
  }

  setConfig(config) {
    this.config = {
      inventory_entity: "sensor.household_product_stock",
      title: "",
      member: "",
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
    return ["tampon", "pad", "cup", "liner", "underwear"];
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
    }
  }

  _setError(message) {
    this._errorMessage = message;
    this._render();
  }

  _formatTimestamp(ts) {
    if (!ts) return "";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    return new Intl.DateTimeFormat(this._hass?.locale?.language || "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  _render() {
    if (!this.shadowRoot || !this._hass || !this.config) return;

    const stateObj = this._getEntity();
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">${this._t("entity_not_found")}: ${this.config.inventory_entity}</div></ha-card>`;
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
            <div class="product">${this._t(product)}</div>
            <div class="stock ${status}">${quantity}<span>${this._t(`status_${status}`)}</span></div>
            <div class="controls">
              <button class="btn" data-action="consume" data-product="${product}" data-quantity="1">${this._t("quick_minus")}</button>
              <button class="btn" data-action="add" data-product="${product}" data-quantity="1">${this._t("quick_plus")}</button>
              <input class="qty" type="number" min="0" data-role="qty" data-product="${product}" value="${qtyValue}">
              <button class="btn" data-action="set" data-product="${product}" data-role="set-input">${this._t("set")}</button>
              <button class="btn" data-action="add" data-product="${product}" data-role="add-input">${this._t("add")}</button>
              <button class="btn warn" data-action="consume" data-product="${product}" data-role="consume-input">${this._t("consume")}</button>
              <input class="thr" type="number" min="0" data-role="warning" data-product="${product}" value="${warningValue}" placeholder="${this._t("warning")}">
              <input class="thr" type="number" min="0" data-role="critical" data-product="${product}" value="${criticalValue}" placeholder="${this._t("critical")}">
              <button class="btn" data-action="set_thresholds" data-product="${product}">${this._t("save_thresholds")}</button>
            </div>
          </div>
        `;
      })
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 14px; background: var(--ha-card-background, var(--card-background-color, #fff)); }
        .title { margin: 0 0 8px; font-size: 1.2rem; font-weight: 700; }
        .meta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; color: var(--secondary-text-color); }
        .error { color: var(--error-color); margin-bottom: 10px; font-size: 0.9rem; }
        .rows { display: grid; gap: 12px; }
        .row { border: 1px solid var(--divider-color); border-radius: 12px; padding: 10px; background: linear-gradient(135deg, rgba(255, 99, 132, 0.08), rgba(75, 192, 192, 0.04)); }
        .product { font-weight: 600; margin-bottom: 8px; }
        .stock { font-size: 1.5rem; font-weight: 700; display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
        .stock span { font-size: 0.8rem; font-weight: 500; }
        .stock.good { color: #1e8449; }
        .stock.warning { color: #b9770e; }
        .stock.critical { color: #c0392b; }
        .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
        button { border: 1px solid var(--divider-color); border-radius: 8px; padding: 7px 9px; cursor: pointer; background: var(--ha-card-background, #fff); color: var(--primary-text-color); }
        button.warn { border-color: rgba(192, 57, 43, 0.5); }
        input { border: 1px solid var(--divider-color); border-radius: 8px; padding: 7px; min-width: 0; background: transparent; color: var(--primary-text-color); }
        .logs { margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 10px; }
        .log-item { display: flex; justify-content: space-between; gap: 8px; font-size: 0.88rem; margin-top: 6px; }
        .empty { padding: 16px; color: var(--secondary-text-color); }
      </style>
      <ha-card>
        <h2 class="title">${this.config.title || this._t("title")}</h2>
        <div class="meta">
          <div><strong>${this._t("members")}:</strong> ${memberNames.length ? memberNames.join(", ") : "-"}</div>
          <label>
            <strong>${this._t("member")}:</strong>
            <select id="memberSelector">
              <option value="">${this._t("all_members")}</option>
              ${memberNames.map((name) => `<option value="${name}" ${selectedMember === name ? "selected" : ""}>${name}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="meta"><strong>${this._t("last_usage")}:</strong> ${lastUsage ? `${this._t(lastUsage.product)} ×${lastUsage.quantity} · ${lastUsage.member || this._t("unknown_member")} · ${this._formatTimestamp(lastUsage.timestamp)}` : this._t("no_usage")}</div>
        ${this._errorMessage ? `<div class="error">${this._errorMessage}</div>` : ""}
        <div class="rows">${rows}</div>
        <div class="logs">
          <strong>${this._t("recent_usage")}</strong>
          ${recentLogs.length ? recentLogs.map((entry) => `
            <div class="log-item">
              <span>${this._t(entry.product)} ×${entry.quantity} · ${entry.member || this._t("unknown_member")}</span>
              <span>${this._formatTimestamp(entry.timestamp)}</span>
            </div>
          `).join("") : `<div class="empty">${this._t("no_logs")}</div>`}
        </div>
      </ha-card>
    `;

    const memberSelector = this.shadowRoot.querySelector("#memberSelector");
    if (memberSelector) {
      memberSelector.addEventListener("change", (event) => {
        this._selectedMember = event.target.value;
      });
    }

    this.shadowRoot.querySelectorAll("input[data-role='qty']").forEach((input) => {
      input.addEventListener("input", (event) => {
        const product = event.target.dataset.product;
        const value = Number(event.target.value || 0);
        this._inputValues = { ...(this._inputValues || {}), [product]: value };
      });
    });

    this.shadowRoot.querySelectorAll("input[data-role='warning'], input[data-role='critical']").forEach((input) => {
      input.addEventListener("input", (event) => {
        const product = event.target.dataset.product;
        const role = event.target.dataset.role;
        const value = Number(event.target.value || 0);
        this._thresholdValues = {
          ...(this._thresholdValues || {}),
          [product]: {
            ...(this._thresholdValues?.[product] || {}),
            [role]: value,
          },
        };
      });
    });

    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        try {
          const action = event.currentTarget.dataset.action;
          const product = event.currentTarget.dataset.product;
          if (!action || !product) return;

          const inputQuantity = Number(this._inputValues?.[product] ?? 1);
          let quantity = Number(event.currentTarget.dataset.quantity || inputQuantity || 1);
          if (["set-input", "add-input", "consume-input"].includes(event.currentTarget.dataset.role)) {
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
    });
  }
}

customElements.define("menstrual-product-inventory-card", MenstrualProductInventoryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstrual-product-inventory-card",
  name: "Menstrual Product Inventory Card",
  description: "Shared household inventory management for period products.",
});
