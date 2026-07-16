class MenstrualProductInventoryCard extends HTMLElement {
  constructor() {
    super();
    this._pendingValues = {};
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error("Entity is required");
    }
    this.config = {
      warning_threshold: 5,
      critical_threshold: 2,
      ...config,
    };
  }

  static getStubConfig() {
    return {
      type: "custom:menstrual-product-inventory-card",
      entity: "sensor.menstruation_gauge",
      title: "Product Inventory",
      warning_threshold: 5,
      critical_threshold: 2,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 4;
  }

  get _products() {
    return ["tampon", "pad", "cup", "liner", "underwear"];
  }

  _getInventory() {
    if (!this._hass || !this.config?.entity) return {};
    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) return {};
    const inv = stateObj.attributes?.product_inventory;
    return typeof inv === "object" && inv !== null && !Array.isArray(inv) ? inv : {};
  }

  _getStockLevel(qty) {
    const critical = Number(this.config.critical_threshold ?? 2);
    const warning = Number(this.config.warning_threshold ?? 5);
    if (qty <= critical) return "critical";
    if (qty <= warning) return "warning";
    return "good";
  }

  _callService(inventoryData) {
    if (!this._hass || !this.config?.entity) return;
    this._hass.callService("menstruation_gauge", "update_product_inventory", {
      entity_id: this.config.entity,
      inventory_data: inventoryData,
    }).catch((err) => {
      console.error("MenstrualProductInventoryCard: service call failed", err);
    });
  }

  _adjust(product, delta) {
    const inv = this._getInventory();
    const current = Number(inv[product] ?? 0);
    const next = Math.max(0, current + delta);
    const update = { [product]: next };
    this._callService(update);
  }

  _setFromInput(product, value) {
    const qty = Math.max(0, parseInt(value, 10) || 0);
    this._callService({ [product]: qty });
  }

  render() {
    if (!this._hass || !this.config?.entity) return;

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) {
      this.innerHTML = `<ha-card><div class="empty-state">Entity not found: ${this.config.entity}</div></ha-card>`;
      return;
    }

    const inventory = this._getInventory();
    const lang = this._hass?.language || "de";
    const title = this.config.title || this._t("title");

    this.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color);
          overflow: hidden;
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

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          padding: 8px 16px 16px;
        }

        .product-card {
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .product-card.tampon {
          background: linear-gradient(135deg, rgba(231, 76, 60, 0.08), rgba(231, 76, 60, 0.02));
        }
        .product-card.pad {
          background: linear-gradient(135deg, rgba(243, 156, 18, 0.08), rgba(243, 156, 18, 0.02));
        }
        .product-card.cup {
          background: linear-gradient(135deg, rgba(142, 68, 173, 0.08), rgba(142, 68, 173, 0.02));
        }
        .product-card.liner {
          background: linear-gradient(135deg, rgba(52, 152, 219, 0.08), rgba(52, 152, 219, 0.02));
        }
        .product-card.underwear {
          background: linear-gradient(135deg, rgba(39, 174, 96, 0.08), rgba(39, 174, 96, 0.02));
        }

        .product-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .product-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stock-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid transparent;
        }

        .stock-badge.good {
          background: rgba(39, 174, 96, 0.15);
          color: #1a8a4a;
          border-color: rgba(39, 174, 96, 0.25);
        }

        .stock-badge.warning {
          background: rgba(243, 156, 18, 0.15);
          color: #af601a;
          border-color: rgba(243, 156, 18, 0.25);
        }

        .stock-badge.critical {
          background: rgba(231, 76, 60, 0.15);
          color: #b03a2e;
          border-color: rgba(231, 76, 60, 0.25);
        }

        .stock-count {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1;
        }

        .stock-count.good { color: var(--primary-text-color); }
        .stock-count.warning { color: #af601a; }
        .stock-count.critical { color: #b03a2e; }

        .controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .qty-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid var(--divider-color);
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color);
          font-size: 1.2rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          flex-shrink: 0;
        }

        .qty-btn:hover {
          background: var(--secondary-background-color);
        }

        .qty-input {
          flex: 1;
          min-width: 0;
          text-align: center;
          font-size: 1rem;
          font-weight: 600;
          padding: 4px 6px;
          border-radius: 6px;
          border: 1px solid var(--divider-color);
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color);
          width: 100%;
          box-sizing: border-box;
        }

        .qty-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .empty-state {
          padding: 16px;
          color: var(--secondary-text-color);
        }

        @media (prefers-color-scheme: dark) {
          .stock-badge.good { color: #2ecc71; }
          .stock-badge.warning { color: #f8c471; }
          .stock-badge.critical { color: #f5b7b1; }
          .stock-count.warning { color: #f8c471; }
          .stock-count.critical { color: #f5b7b1; }
        }
      </style>
      <ha-card>
        <div class="header">
          <h2 class="title">${title}</h2>
          <p class="subtitle">${stateObj.attributes?.friendly_name || this.config.entity}</p>
        </div>
        <div class="products-grid">
          ${this._products.map((product) => {
            const qty = Number(inventory[product] ?? 0);
            const level = this._getStockLevel(qty);
            const label = this._t(product);
            const statusLabel = this._t("status_" + level);
            return `
              <div class="product-card ${product}" data-product="${product}">
                <div class="product-header">
                  <span class="product-label">${label}</span>
                  <span class="stock-badge ${level}">${statusLabel}</span>
                </div>
                <div class="stock-count ${level}">${qty}</div>
                <div class="controls">
                  <button class="qty-btn" data-action="minus" data-product="${product}" title="${this._t("decrease")}">−</button>
                  <input
                    class="qty-input"
                    type="number"
                    min="0"
                    value="${qty}"
                    data-product="${product}"
                    aria-label="${label} ${this._t("quantity")}"
                  />
                  <button class="qty-btn" data-action="plus" data-product="${product}" title="${this._t("increase")}">+</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </ha-card>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    this.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const product = e.currentTarget.dataset.product;
        const action = e.currentTarget.dataset.action;
        this._adjust(product, action === "plus" ? 1 : -1);
      });
    });

    this.querySelectorAll(".qty-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const product = e.currentTarget.dataset.product;
        this._setFromInput(product, e.currentTarget.value);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const product = e.currentTarget.dataset.product;
          this._setFromInput(product, e.currentTarget.value);
          e.currentTarget.blur();
        }
      });
    });
  }

  _t(key) {
    const translations = {
      de: {
        title: "Produktvorrat",
        tampon: "Tampons",
        pad: "Binden",
        cup: "Menstruationscup",
        liner: "Slipeinlagen",
        underwear: "Periodenunterwäsche",
        status_good: "Gut",
        status_warning: "Niedrig",
        status_critical: "Kritisch",
        quantity: "Menge",
        decrease: "Verringern",
        increase: "Erhöhen",
      },
      en: {
        title: "Product Inventory",
        tampon: "Tampons",
        pad: "Pads",
        cup: "Menstrual Cup",
        liner: "Liners",
        underwear: "Period Underwear",
        status_good: "Good",
        status_warning: "Low",
        status_critical: "Critical",
        quantity: "quantity",
        decrease: "Decrease",
        increase: "Increase",
      },
    };

    const lang = this._hass?.language || "de";
    return translations[lang]?.[key] || translations.en[key] || key;
  }
}

customElements.define("menstrual-product-inventory-card", MenstrualProductInventoryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstrual-product-inventory-card",
  name: "Menstrual Product Inventory Card",
  description: "Manage and view menstrual product stock levels with color-coded indicators.",
  preview: false,
  documentationURL: "https://github.com/wallenium/HA-menstrual-gauge-v2",
});
