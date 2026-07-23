class MenstruationProductInventoryCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:menstruation-product-inventory-card",
      inventory_entity: "sensor.household_product_stock",
      title: "Household inventory",
      member: "",
      visible_products: ["tampon", "pad", "cup", "liner", "underwear"],
      product_order: ["tampon", "pad", "cup", "liner", "underwear"],
      thresholds: {},
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
      thresholds: {},
      underwear_total_owned: 12,
      underwear_washing_threshold: 3,
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
        quantity: "Menge",
        consume: "Verbrauch",
        use: "Verwenden",
        emptied_dried: "Geleert/Trocken",
        refill: "Auffüllen",
        washed: "Gereinigt",
        wash_needed: "Dringend waschen!",
        available: "Verfügbar",
        in_use: "In Nutzung",
        buy_recommendation: "Kaufempfehlung",
        add_to_shopping: "Zur Einkaufsliste",
        recent_usage: "Letzte Verbräuche",
        no_logs: "Keine Verbrauchseinträge",
        status_good: "Gut",
        status_warning: "Warnung",
        status_critical: "Kritisch",
        pregnancy: "Schwangerschaft",
        week: "Woche",
        trimester: "Trimester",
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
        quantity: "Qty",
        consume: "Consume",
        use: "Use",
        emptied_dried: "Emptied/Dried",
        refill: "Refill",
        washed: "Washed",
        wash_needed: "Washing needed urgently!",
        available: "Available",
        in_use: "In use",
        buy_recommendation: "Buy recommendation",
        add_to_shopping: "Add to shopping list",
        recent_usage: "Recent usage",
        no_logs: "No consumption logs",
        status_good: "Good",
        status_warning: "Warning",
        status_critical: "Critical",
        pregnancy: "Pregnancy",
        week: "Week",
        trimester: "Trimester",
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

  _products(pregnancyInfo = null) {
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
    let products = ordered;
    if (Array.isArray(this.config?.visible_products) && this.config.visible_products.length > 0) {
      const visibleSet = new Set(this.config.visible_products.filter((p) => ALL_PRODUCTS.includes(p)));
      products = ordered.filter((p) => visibleSet.has(p));
    }

    if (pregnancyInfo?.isPregnant) {
      return products.filter((product) => product !== "tampon" && product !== "cup");
    }

    return products;
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

  _averageDailyUsageFromLog(log, product) {
    const entries = Array.isArray(log)
      ? log.filter((entry) => String(entry?.product || "").toLowerCase() === product)
      : [];
    if (!entries.length) return 0;

    const dates = entries
      .map((entry) => String(entry?.timestamp || "").trim().slice(0, 10))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort();
    if (!dates.length) return 0;
    const totalQuantity = entries.reduce((sum, entry) => sum + Math.max(1, Number(entry?.quantity || 1)), 0);
    const start = new Date(`${dates[0]}T00:00:00Z`).getTime();
    const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime();
    const daysSpan = Math.max(1, Math.floor((end - start) / 86400000) + 1);
    return totalQuantity / daysSpan;
  }

  async _callInventory(action, product, quantity, extra = {}) {
    const serviceData = {
      inventory_action: action,
      ...extra,
    };
    if (product) serviceData.product = product;
    if (quantity !== undefined && quantity !== null) serviceData.quantity = Number(quantity) || 0;

    // Forward card-configured thresholds so the backend keeps its stored thresholds in
    // sync and can use them for shopping-list checks.
    if (product && action !== "set_thresholds" && product !== "cup") {
      const configThreshold = this.config?.thresholds?.[product];
      if (configThreshold) {
        if (configThreshold.warning !== undefined) serviceData.warning_threshold = Number(configThreshold.warning);
        if (configThreshold.critical !== undefined) serviceData.critical_threshold = Number(configThreshold.critical);
      }
    }

    if (product === "underwear") {
      const totalOwned = Math.max(1, Number(this.config?.underwear_total_owned ?? 12));
      serviceData.underwear_total_owned = totalOwned;
      if (this.config?.underwear_washing_threshold !== undefined) {
        serviceData.warning_threshold = Math.min(totalOwned, Math.max(0, Number(this.config.underwear_washing_threshold)));
      }
    }

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

  _resolvePregnancyInfo(source = {}) {
    const sharedResolver = window.ProductIcons?.resolvePregnancyInfo;
    if (typeof sharedResolver === "function") {
      return sharedResolver(source);
    }

    const parsePositiveInt = (value) => {
      const normalized = parseInt(String(value ?? "").trim(), 10);
      return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
    };
    const clampInt = (value, min, max) => Math.max(min, Math.min(max, value));
    const weeksValue = parsePositiveInt(source?.weeks_pregnant ?? source?.pregnancy_week ?? source?.week);
    const monthValue = parsePositiveInt(source?.pregnancy_month ?? source?.month);
    const trimesterValue = parsePositiveInt(source?.pregnancy_trimester ?? source?.trimester);
    const month = monthValue !== null
      ? clampInt(monthValue, 1, 9)
      : clampInt(Math.ceil((weeksValue || 1) / 4), 1, 9);
    const week = weeksValue ?? (((month - 1) * 4) + 1);
    const trimester = trimesterValue !== null
      ? clampInt(trimesterValue, 1, 3)
      : clampInt(weeksValue !== null ? Math.ceil(weeksValue / 13) : Math.ceil(month / 3), 1, 3);
    const isPregnant = Boolean(source?.is_pregnant) || String(source?.state || "").toLowerCase() === "pregnant";

    return { isPregnant, week, month, trimester };
  }

  _isCycleState(stateObj) {
    const attrs = stateObj?.attributes || {};
    return Boolean(
      stateObj
      && typeof attrs === "object"
      && ("history" in attrs || "pregnancy_data" in attrs || "cycle_statistics" in attrs)
    );
  }

  _findMemberCycleState(member, inventoryEntityId) {
    const wantedProfile = String(member?.profile || "").trim().toLowerCase();
    const wantedName = String(member?.name || "").trim().toLowerCase();
    const states = Object.entries(this._hass?.states || {});

    for (const [entityId, stateObj] of states) {
      if (entityId === inventoryEntityId || !entityId.startsWith("sensor.") || !this._isCycleState(stateObj)) {
        continue;
      }

      const attrs = stateObj.attributes || {};
      const profile = String(attrs.profile || "").trim().toLowerCase();
      const friendlyName = String(attrs.friendly_name || "").trim().toLowerCase();
      if ((wantedProfile && profile === wantedProfile) || (wantedName && friendlyName === wantedName)) {
        return stateObj;
      }
    }

    return null;
  }

  _resolvePregnancyContext(attrs, inventoryEntityId) {
    const members = Array.isArray(attrs.household_members) ? attrs.household_members : [];
    const selectedMember = String((this._selectedMember ?? this.config.member) || "").trim();
    const targetMember = selectedMember
      ? members.find((member) => member?.name === selectedMember || member?.profile === selectedMember) || { name: selectedMember, profile: selectedMember }
      : (members.length === 1 ? members[0] : null);

    if (!targetMember) {
      return { isPregnant: false, week: 1, month: 1, trimester: 1 };
    }

    const cycleState = this._findMemberCycleState(targetMember, inventoryEntityId);
    if (!cycleState) {
      return { isPregnant: false, week: 1, month: 1, trimester: 1 };
    }

    const pregnancyInfo = this._resolvePregnancyInfo({ state: cycleState.state, ...(cycleState.attributes || {}) });
    return pregnancyInfo.isPregnant
      ? pregnancyInfo
      : { ...pregnancyInfo, isPregnant: false };
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

        let quantity;
        if (button.dataset.role === "consume-input") {
          quantity = Math.max(1, Number(this._consumeValues?.[product] ?? 1));
        } else if (button.dataset.role === "refill-input") {
          quantity = Math.max(0, Number(this._refillValues?.[product] ?? 1));
        } else {
          quantity = Math.max(1, Number(button.dataset.quantity || 1));
        }

        const member = this._selectedMember || this.config.member || "";
        await this._callInventory(action, product, quantity, member ? { member } : {});
      } catch (error) {
        console.error("Button click error:", error);
      }
    });

    // Delegated input handler for consume and refill qty inputs
    this.shadowRoot.addEventListener("input", (ev) => {
      const input = ev.target;
      if (!input) return;

      const role = input.dataset?.role;
      const product = input.dataset?.product;
      if (!role || !product) return;

      if (role === "consume-qty") {
        const value = Math.max(1, Number(input.value || 1));
        this._consumeValues = { ...(this._consumeValues || {}), [product]: value };
      } else if (role === "refill-qty") {
        const value = Math.max(0, Number(input.value || 1));
        this._refillValues = { ...(this._refillValues || {}), [product]: value };
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
    const fullLog = Array.isArray(attrs.consumption_log) ? attrs.consumption_log : [];
    const underwearTotalOwned = Math.max(1, Number(this.config.underwear_total_owned ?? attrs.underwear_total_owned ?? 12));
    const underwearWashingThreshold = Math.max(0, Number(this.config.underwear_washing_threshold ?? attrs.underwear_washing_threshold ?? this.config.thresholds?.underwear?.warning ?? 3));
    const underwearInUse = Math.max(0, Number(inventory.underwear || 0));
    const underwearAvailable = Math.max(0, Math.min(underwearTotalOwned, Number(attrs.underwear_available ?? (underwearTotalOwned - underwearInUse))));
    const underwearDailyUsage = this._averageDailyUsageFromLog(fullLog, "underwear");
    const underwearRecommendedBuy = Math.max(0, Math.ceil((underwearDailyUsage * 7) - underwearTotalOwned));
    const title = this._escapeHtml(this.config.title || this._t("title"));
    const memberList = memberNames.length ? memberNames.map((name) => this._escapeHtml(name)).join(", ") : "-";
    const lastUsageText = lastUsage
      ? `${this._escapeHtml(this._t(lastUsage.product))} ×${this._escapeHtml(lastUsage.quantity)} · ${this._escapeHtml(lastUsage.member || this._t("unknown_member"))} · ${this._escapeHtml(this._formatTimestamp(lastUsage.timestamp))}`
      : this._t("no_usage");
    const pregnancyInfo = this._resolvePregnancyContext(attrs, entityId);
    const pregnancyMetaText = pregnancyInfo.isPregnant
      ? `${this._t("week")} ${pregnancyInfo.week} · ${this._t("trimester")} ${pregnancyInfo.trimester}`
      : "";

    const rows = this._products(pregnancyInfo)
      .map((product) => {
        const quantity = Math.max(0, Number(inventory[product] || 0));
        // Prefer card-config thresholds (set in editor) over entity-attribute thresholds.
        const configThreshold = this.config.thresholds?.[product] || {};
        const threshold = {
          warning: configThreshold.warning !== undefined ? Number(configThreshold.warning) : (thresholds[product]?.warning ?? 10),
          critical: configThreshold.critical !== undefined ? Number(configThreshold.critical) : (thresholds[product]?.critical ?? 5),
        };
        const displayQuantity = product === "underwear" ? underwearAvailable : (product === "cup" ? 1 : quantity);
        const status = product === "underwear"
          ? (displayQuantity <= underwearWashingThreshold ? "warning" : "good")
          : this._stockStatus(displayQuantity, threshold);
        const consumeQtyValue = this._consumeValues?.[product] ?? 1;
        const refillQtyValue = this._refillValues?.[product] ?? 1;
        const showWashNeeded = product === "underwear" && displayQuantity <= underwearWashingThreshold;
        const showUnderwearBuyRecommendation = product === "underwear" && underwearRecommendedBuy > 0;

        return `
          <div class="row">
            <div class="product-header">
              <div class="product-name">${this._t(product)}</div>
              <div class="product-icon">${this._getProductIconSvg(product)}</div>
            </div>
            <div class="stock ${status}">${displayQuantity}<span>${product === "underwear" ? this._t("available") : this._t(`status_${status}`)}</span></div>
            ${product === "underwear" ? `<div class="meta-inline">${this._t("in_use")}: ${Math.max(0, Math.min(underwearTotalOwned, underwearInUse))} / ${underwearTotalOwned}</div>` : ""}
            ${showWashNeeded ? `<div class="wash-needed">🧺 ${this._t("wash_needed")}</div>` : ""}
            ${showUnderwearBuyRecommendation ? `<div class="meta-inline">${this._t("buy_recommendation")}: ${underwearRecommendedBuy}</div>` : ""}
            <div class="controls">
              ${product === "cup" ? `
                <div class="action-group">
                  <button class="btn warn" data-action="consume" data-product="${product}" data-quantity="1">${this._t("emptied_dried")}</button>
                </div>
              ` : product === "underwear" ? `
                <div class="action-group">
                  <button class="btn warn" data-action="consume" data-product="${product}" data-quantity="1">${this._t("use")}</button>
                </div>
                <div class="action-group">
                  <input class="qty" type="number" min="0" data-role="refill-qty" data-product="${product}" value="${refillQtyValue}">
                  <button class="btn" data-action="add" data-product="${product}" data-role="refill-input">${this._t("washed")}</button>
                </div>
                ${showUnderwearBuyRecommendation ? `
                  <div class="action-group">
                    <button class="btn" data-action="add_to_shopping_list" data-product="${product}" data-quantity="${underwearRecommendedBuy}">${this._t("add_to_shopping")}</button>
                  </div>
                ` : ""}
              ` : `
                <div class="action-group">
                  <input class="qty" type="number" min="1" data-role="consume-qty" data-product="${product}" value="${consumeQtyValue}">
                  <button class="btn warn" data-action="consume" data-product="${product}" data-role="consume-input">${this._t("consume")}</button>
                </div>
                <div class="action-group">
                  <input class="qty" type="number" min="0" data-role="refill-qty" data-product="${product}" value="${refillQtyValue}">
                  <button class="btn" data-action="add" data-product="${product}" data-role="refill-input">${this._t("refill")}</button>
                </div>
              `}
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
        .product-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .stock { font-size: 1.5rem; font-weight: 700; display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
        .stock span { font-size: 0.8rem; font-weight: 500; }
        .stock.good { color: var(--mg-status-success); }
        .stock.warning { color: var(--mg-status-warning); }
        .stock.critical { color: var(--mg-status-error); }
        .controls { display: flex; flex-wrap: wrap; gap: 10px; }
        .action-group { display: flex; gap: 6px; align-items: center; }
        .action-group .qty { width: 64px; }
        button, select { border: 1px solid var(--mg-border); border-radius: 8px; padding: 7px 9px; cursor: pointer; background: var(--mg-card-bg); color: var(--mg-text-primary); }
        button.warn { border-color: color-mix(in srgb, var(--mg-status-error) 55%, transparent); }
        input { border: 1px solid var(--mg-border); border-radius: 8px; padding: 7px; min-width: 0; background: transparent; color: var(--mg-text-primary); }
        .wash-needed { display: flex; align-items: center; gap: 6px; background: color-mix(in srgb, var(--mg-status-warning) 15%, transparent); border: 1px solid var(--mg-status-warning); border-radius: 8px; padding: 6px 10px; color: var(--mg-status-warning); font-size: 0.9rem; margin-bottom: 8px; }
        .logs { margin-top: 12px; border-top: 1px solid var(--mg-border); padding-top: 10px; }
        .meta-inline { margin-bottom: 8px; font-size: 0.9rem; color: var(--mg-text-secondary); }
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
        ${pregnancyInfo.isPregnant ? `<div class="meta"><strong>${this._t("pregnancy")}:</strong> ${this._escapeHtml(pregnancyMetaText)}</div>` : ""}
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

if (!customElements.get("menstruation-product-inventory-card")) {
  customElements.define("menstruation-product-inventory-card", MenstruationProductInventoryCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstruation-product-inventory-card",
  name: "Menstruation Product Inventory Card",
  description: "Shared household inventory management for period products.",
});
