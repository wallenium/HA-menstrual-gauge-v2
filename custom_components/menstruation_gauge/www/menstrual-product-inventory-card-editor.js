class MenstrualProductInventoryCardEditor extends HTMLElement {
  static get ALL_PRODUCTS() {
    return ["tampon", "pad", "cup", "liner", "underwear"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._dragSrcIdx = null;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _lang() {
    return String(this._hass?.locale?.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  }

  _t(key) {
    const i18n = {
      de: {
        visible_products: "Sichtbare Produkte",
        product_order: "Produktreihenfolge (Ziehen zum Sortieren)",
        show_thresholds: "Schwellenwerte anzeigen",
        options: "Optionen",
        tampon: "Tampons",
        pad: "Binden",
        cup: "Menstruationstassen",
        liner: "Slipeinlagen",
        underwear: "Periodenunterwäsche",
      },
      en: {
        visible_products: "Visible Products",
        product_order: "Product Order (Drag to reorder)",
        show_thresholds: "Show Threshold Controls",
        options: "Options",
        tampon: "Tampons",
        pad: "Pads",
        cup: "Menstrual Cups",
        liner: "Liners",
        underwear: "Period Underwear",
      },
    };
    const lang = this._lang();
    return (i18n[lang] && i18n[lang][key]) || (i18n.en[key] || key);
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

  _getOrderedProducts() {
    const all = MenstrualProductInventoryCardEditor.ALL_PRODUCTS;
    if (Array.isArray(this._config.product_order) && this._config.product_order.length > 0) {
      const validOrder = this._config.product_order.filter((p) => all.includes(p));
      const missing = all.filter((p) => !validOrder.includes(p));
      return [...validOrder, ...missing];
    }
    return [...all];
  }

  _getVisibleSet() {
    const all = MenstrualProductInventoryCardEditor.ALL_PRODUCTS;
    if (Array.isArray(this._config.visible_products) && this._config.visible_products.length > 0) {
      return new Set(this._config.visible_products.filter((p) => all.includes(p)));
    }
    // Default: all products visible
    return new Set(all);
  }

  _fireConfigChanged(newConfig) {
    this._config = { ...newConfig };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
    this._render();
  }

  _render() {
    const ordered = this._getOrderedProducts();
    const visible = this._getVisibleSet();
    const showThresholds = this._config.show_thresholds !== false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 8px 0;
          color: var(--primary-text-color, #1f2937);
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
          color: var(--secondary-text-color, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .product-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
        }
        .product-item label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .product-item input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--primary-color, #6200ea);
        }
        .order-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .order-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
          border-radius: 8px;
          cursor: grab;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          user-select: none;
          font-size: 0.95rem;
          transition: opacity 0.15s;
        }
        .order-item.dragging {
          opacity: 0.45;
          cursor: grabbing;
        }
        .order-item.drag-over {
          border: 2px dashed var(--primary-color, #6200ea);
          background: color-mix(in srgb, var(--primary-color, #6200ea) 8%, transparent);
        }
        .drag-handle {
          color: var(--secondary-text-color, #6b7280);
          font-size: 1.1rem;
          line-height: 1;
          pointer-events: none;
        }
        .toggle-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 0;
        }
        .toggle-row input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--primary-color, #6200ea);
        }
        .toggle-row label {
          cursor: pointer;
          font-size: 0.95rem;
        }
      </style>

      <div class="section">
        <div class="section-title">${this._escapeHtml(this._t("visible_products"))}</div>
        <div id="visibility-list">
          ${ordered.map((product) => `
            <div class="product-item">
              <label>
                <input type="checkbox" data-product="${product}" ${visible.has(product) ? "checked" : ""}>
                ${this._escapeHtml(this._t(product))}
              </label>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section">
        <div class="section-title">${this._escapeHtml(this._t("product_order"))}</div>
        <div id="order-list" class="order-list">
          ${ordered.map((product, idx) => `
            <div class="order-item" draggable="true" data-idx="${idx}" data-product="${product}">
              <span class="drag-handle">⠿</span>
              <span>${this._escapeHtml(this._t(product))}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section">
        <div class="section-title">${this._escapeHtml(this._t("options"))}</div>
        <div class="toggle-row">
          <input type="checkbox" id="show-thresholds" ${showThresholds ? "checked" : ""}>
          <label for="show-thresholds">${this._escapeHtml(this._t("show_thresholds"))}</label>
        </div>
      </div>
    `;

    this._attachVisibilityHandlers(ordered, visible);
    this._attachOrderHandlers(ordered);
    this._attachOptionsHandlers();
  }

  _attachVisibilityHandlers(ordered, visible) {
    this.shadowRoot.querySelectorAll("#visibility-list input[type='checkbox']").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const newVisible = ordered.filter((p) => {
          const cb = this.shadowRoot.querySelector(`#visibility-list input[data-product="${p}"]`);
          return cb ? cb.checked : visible.has(p);
        });
        this._fireConfigChanged({ ...this._config, visible_products: newVisible });
      });
    });
  }

  _attachOrderHandlers(ordered) {
    const orderItems = this.shadowRoot.querySelectorAll("#order-list .order-item");

    orderItems.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        this._dragSrcIdx = Number(item.dataset.idx);
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.dataset.idx);
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        this.shadowRoot.querySelectorAll("#order-list .order-item").forEach((i) => i.classList.remove("drag-over"));
        this._dragSrcIdx = null;
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        this.shadowRoot.querySelectorAll("#order-list .order-item").forEach((i) => i.classList.remove("drag-over"));
        item.classList.add("drag-over");
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        const srcIdx = this._dragSrcIdx;
        const dstIdx = Number(item.dataset.idx);
        if (srcIdx === null || srcIdx === dstIdx) return;
        const newOrder = [...ordered];
        const [moved] = newOrder.splice(srcIdx, 1);
        newOrder.splice(dstIdx, 0, moved);
        this._fireConfigChanged({ ...this._config, product_order: newOrder });
      });
    });
  }

  _attachOptionsHandlers() {
    const thresholdsCheckbox = this.shadowRoot.querySelector("#show-thresholds");
    if (thresholdsCheckbox) {
      thresholdsCheckbox.addEventListener("change", (e) => {
        this._fireConfigChanged({ ...this._config, show_thresholds: e.target.checked });
      });
    }
  }
}

if (!customElements.get("menstrual-product-inventory-card-editor")) {
  customElements.define("menstrual-product-inventory-card-editor", MenstrualProductInventoryCardEditor);
}
