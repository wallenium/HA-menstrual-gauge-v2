/**
 * menstrual-underwear-inventory-card
 * Displays period underwear status (clean / dirty) with wear tracking.
 *
 * Config:
 *   type: custom:menstrual-underwear-inventory-card
 *   entity: sensor.my_profile
 *   title: "Periodenunterwäsche"   (optional)
 */

class MenstrualUnderwearInventoryCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity.");
    }
    this.config = config;
  }

  getCardSize() {
    return 3;
  }

  _t(key, vars = {}) {
    const t = {
      de: {
        title: "Periodenunterwäsche",
        clean: "Sauber",
        dirty: "Schmutzig",
        total: "Gesamt",
        wash_needed: "Waschen empfohlen",
        days: "Tage",
        mark_clean: "Als sauber markieren",
        mark_dirty: "Als schmutzig markieren",
        wear_count: "Trageanzahl",
        no_items: "Keine Unterwäsche konfiguriert. Bitte in den Einstellungen einrichten.",
        since: "seit",
      },
      en: {
        title: "Period underwear",
        clean: "Clean",
        dirty: "Dirty",
        total: "Total",
        wash_needed: "Wash recommended",
        days: "days",
        mark_clean: "Mark as clean",
        mark_dirty: "Mark as dirty",
        wear_count: "Wear count",
        no_items: "No underwear configured. Please set up in integration settings.",
        since: "since",
      },
    };
    const lang = this._hass?.language?.split("-")[0] || "de";
    const strings = t[lang] || t.de;
    let result = strings[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{${k}}`, v);
    }
    return result;
  }

  _statusColor(status) {
    return status === "clean" ? "var(--success-color, #4CAF50)" : "var(--warning-color, #FF9800)";
  }

  _statusIcon(status) {
    return status === "clean" ? "✅" : "🔄";
  }

  async _toggleStatus(underwearId, currentStatus) {
    const newStatus = currentStatus === "clean" ? "dirty" : "clean";
    const state = this._hass.states[this.config.entity];
    const entryId = state?.attributes?.entry_id;
    const entityId = this.config.entity;

    try {
      await this._hass.callService("menstruation_gauge", "update_underwear_status", {
        entity_id: entityId,
        underwear_id: underwearId,
        status: newStatus,
      });
    } catch (e) {
      console.error("Error toggling underwear status:", e);
    }
  }

  _render() {
    if (!this._hass || !this.config) return;

    const state = this._hass.states[this.config.entity];
    if (!state) {
      this.innerHTML = `<ha-card><div style="padding:16px">Entity not found: ${this.config.entity}</div></ha-card>`;
      return;
    }

    const attrs = state.attributes || {};
    const inventoryAttr = attrs.product_inventory || {};
    const underwear = inventoryAttr.underwear || {};
    const items = underwear.items || [];
    const cleanCount = underwear.clean || 0;
    const dirtyCount = underwear.dirty || 0;
    const totalCount = underwear.total || 0;
    const washNeeded = underwear.wash_needed || false;

    const washRec = attrs.wash_recommendation || {};

    const title = this.config.title || this._t("title");

    let itemsHtml = "";
    if (items.length === 0) {
      itemsHtml = `<div class="no-items">${this._t("no_items")}</div>`;
    } else {
      itemsHtml = items.map((item) => {
        const daysText = item.since
          ? (() => {
              try {
                const since = new Date(item.since);
                const now = new Date();
                const diff = Math.floor((now - since) / 86400000);
                return diff > 0 ? `${diff} ${this._t("days")}` : "";
              } catch {
                return "";
              }
            })()
          : "";

        const statusLabel = item.status === "clean" ? this._t("clean") : this._t("dirty");
        const toggleLabel = item.status === "clean" ? this._t("mark_dirty") : this._t("mark_clean");
        const color = this._statusColor(item.status);
        const icon = this._statusIcon(item.status);

        return `
          <div class="item" data-id="${item.id}" data-status="${item.status}">
            <div class="item-header">
              <span class="item-icon">${icon}</span>
              <span class="item-label">${item.label || "Unterwäsche " + item.id}</span>
              <span class="item-status" style="color:${color}">${statusLabel}</span>
            </div>
            <div class="item-meta">
              ${daysText ? `<span class="meta-days">${this._t("since")} ${daysText}</span>` : ""}
              ${item.wear_count > 0 ? `<span class="meta-wear">${this._t("wear_count")}: ${item.wear_count}</span>` : ""}
            </div>
            <button class="toggle-btn" data-id="${item.id}" data-status="${item.status}">
              ${toggleLabel}
            </button>
          </div>
        `;
      }).join("");
    }

    this.innerHTML = `
      <ha-card>
        <style>
          .card-header {
            padding: 16px 16px 0;
            font-size: 1.1em;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .summary {
            display: flex;
            gap: 16px;
            padding: 12px 16px;
            flex-wrap: wrap;
          }
          .summary-chip {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 0.9em;
            font-weight: 500;
          }
          .chip-clean {
            background: rgba(76, 175, 80, 0.15);
            color: var(--success-color, #4CAF50);
          }
          .chip-dirty {
            background: rgba(255, 152, 0, 0.15);
            color: var(--warning-color, #FF9800);
          }
          .chip-total {
            background: var(--secondary-background-color, #f5f5f5);
            color: var(--secondary-text-color);
          }
          .wash-alert {
            margin: 0 16px;
            padding: 8px 12px;
            border-radius: 8px;
            background: rgba(255, 152, 0, 0.15);
            color: var(--warning-color, #FF9800);
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .items-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
            padding: 12px 16px 16px;
          }
          .item {
            border: 1px solid var(--divider-color, #e0e0e0);
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .item-header {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .item-icon { font-size: 1.2em; }
          .item-label { font-size: 0.85em; flex: 1; color: var(--secondary-text-color); }
          .item-status { font-size: 0.8em; font-weight: bold; }
          .item-meta {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 0.78em;
            color: var(--secondary-text-color);
          }
          .toggle-btn {
            margin-top: 4px;
            padding: 6px 10px;
            border-radius: 8px;
            border: 1px solid var(--divider-color, #e0e0e0);
            background: var(--card-background-color, white);
            color: var(--primary-color);
            cursor: pointer;
            font-size: 0.8em;
            font-family: inherit;
            transition: background 0.2s;
          }
          .toggle-btn:hover {
            background: var(--primary-color);
            color: white;
          }
          .no-items {
            padding: 16px;
            color: var(--secondary-text-color);
            font-size: 0.9em;
          }
        </style>
        <div class="card-header">
          <span>🩲</span>
          <span>${title}</span>
        </div>
        <div class="summary">
          <div class="summary-chip chip-total">📦 ${this._t("total")}: ${totalCount}</div>
          <div class="summary-chip chip-clean">✅ ${this._t("clean")}: ${cleanCount}</div>
          <div class="summary-chip chip-dirty">🔄 ${this._t("dirty")}: ${dirtyCount}</div>
        </div>
        ${washNeeded ? `<div class="wash-alert">🧺 ${this._t("wash_needed")}${washRec.recommendation ? ": " + washRec.recommendation : ""}</div>` : ""}
        <div class="items-grid">
          ${itemsHtml}
        </div>
      </ha-card>
    `;

    // Attach click handlers to toggle buttons
    this.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const status = e.currentTarget.dataset.status;
        this._toggleStatus(id, status);
      });
    });
  }
}

customElements.define("menstrual-underwear-inventory-card", MenstrualUnderwearInventoryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstrual-underwear-inventory-card",
  name: "Menstrual Underwear Inventory Card",
  description: "Track clean/dirty status of period underwear with wear count and wash recommendations.",
  preview: false,
});
