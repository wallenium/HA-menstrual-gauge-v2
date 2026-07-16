/**
 * menstrual-quick-status-card
 * Mini dashboard widget summarising all product inventory at a glance.
 *
 * Config:
 *   type: custom:menstrual-quick-status-card
 *   entity: sensor.my_profile
 *   title: "Schnellstatus"   (optional)
 */

class MenstrualQuickStatusCard extends HTMLElement {
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
    return 2;
  }

  _t(key) {
    const t = {
      de: {
        title: "Schnellstatus",
        tampons: "Tampons",
        pads: "Binden",
        underwear: "Unterwäsche",
        clean: "sauber",
        dirty: "schmutzig",
        total: "gesamt",
        low_stock: "Niedrig",
        wash_needed: "Waschen empfohlen",
        all_ok: "Alles in Ordnung ✅",
      },
      en: {
        title: "Quick status",
        tampons: "Tampons",
        pads: "Pads",
        underwear: "Underwear",
        clean: "clean",
        dirty: "dirty",
        total: "total",
        low_stock: "Low stock",
        wash_needed: "Wash recommended",
        all_ok: "All stocked ✅",
      },
    };
    const lang = this._hass?.language?.split("-")[0] || "de";
    return (t[lang] || t.de)[key] || key;
  }

  _statusColor(status) {
    if (status === "critical") return "var(--error-color, #f44336)";
    if (status === "low") return "var(--warning-color, #FF9800)";
    return "var(--success-color, #4CAF50)";
  }

  _render() {
    if (!this._hass || !this.config) return;

    const state = this._hass.states[this.config.entity];
    if (!state) {
      this.innerHTML = `<ha-card><div style="padding:12px">Entity not found: ${this.config.entity}</div></ha-card>`;
      return;
    }

    const attrs = state.attributes || {};
    const inv = attrs.product_inventory || {};
    const lowStockAlerts = attrs.low_stock_alerts || [];
    const washRec = attrs.wash_recommendation || {};
    const title = this.config.title || this._t("title");

    const tampons = inv.tampons || {};
    const pads = inv.pads || {};
    const underwear = inv.underwear || {};

    const tamponTotal = tampons.total_stock ?? 0;
    const padTotal = pads.total_stock ?? 0;
    const tamponStatus = tampons.status || "ok";
    const padStatus = pads.status || "ok";
    const cleanCount = underwear.clean ?? 0;
    const dirtyCount = underwear.dirty ?? 0;
    const underwearStatus = underwear.status || "ok";

    const alerts = lowStockAlerts.length > 0 || washRec.wash_needed;

    this.innerHTML = `
      <ha-card>
        <style>
          .qs-header {
            padding: 12px 16px 8px;
            font-size: 1em;
            font-weight: bold;
            color: var(--primary-text-color);
          }
          .qs-row {
            display: flex;
            align-items: center;
            padding: 6px 16px;
            gap: 10px;
            font-size: 0.9em;
          }
          .qs-icon { font-size: 1.2em; width: 24px; text-align: center; }
          .qs-label { color: var(--secondary-text-color); flex: 1; }
          .qs-value { font-weight: bold; }
          .qs-status {
            font-size: 0.78em;
            padding: 2px 7px;
            border-radius: 10px;
            font-weight: 500;
          }
          .qs-divider {
            height: 1px;
            background: var(--divider-color, #e0e0e0);
            margin: 4px 16px;
          }
          .qs-alert-row {
            padding: 6px 16px 10px;
            font-size: 0.85em;
            color: var(--warning-color, #FF9800);
            display: flex;
            gap: 6px;
            align-items: center;
          }
          .qs-ok-row {
            padding: 6px 16px 10px;
            font-size: 0.85em;
            color: var(--success-color, #4CAF50);
          }
        </style>
        <div class="qs-header">🗒️ ${title}</div>

        <div class="qs-row">
          <span class="qs-icon">🩸</span>
          <span class="qs-label">${this._t("tampons")}</span>
          <span class="qs-value" style="color:${this._statusColor(tamponStatus)}">${tamponTotal}</span>
          <span class="qs-status" style="background:${this._statusColor(tamponStatus)}22;color:${this._statusColor(tamponStatus)}">${tamponStatus.toUpperCase()}</span>
        </div>

        <div class="qs-row">
          <span class="qs-icon">🩹</span>
          <span class="qs-label">${this._t("pads")}</span>
          <span class="qs-value" style="color:${this._statusColor(padStatus)}">${padTotal}</span>
          <span class="qs-status" style="background:${this._statusColor(padStatus)}22;color:${this._statusColor(padStatus)}">${padStatus.toUpperCase()}</span>
        </div>

        <div class="qs-row">
          <span class="qs-icon">🩲</span>
          <span class="qs-label">${this._t("underwear")}</span>
          <span class="qs-value">${cleanCount} ${this._t("clean")} / ${dirtyCount} ${this._t("dirty")}</span>
          ${washRec.wash_needed ? `<span class="qs-status" style="background:rgba(255,152,0,0.15);color:var(--warning-color,#FF9800)">🧺</span>` : ""}
        </div>

        <div class="qs-divider"></div>

        ${alerts
          ? `<div class="qs-alert-row">
              ⚠️ ${[
                ...lowStockAlerts.filter(a => a.product !== "underwear").map(a => `${a.product} (${a.location})`),
                washRec.wash_needed ? this._t("wash_needed") : null,
              ].filter(Boolean).join(" · ")}
            </div>`
          : `<div class="qs-ok-row">${this._t("all_ok")}</div>`
        }
      </ha-card>
    `;
  }
}

customElements.define("menstrual-quick-status-card", MenstrualQuickStatusCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "menstrual-quick-status-card",
  name: "Menstrual Quick Status Card",
  description: "Mini dashboard showing all product inventory status at a glance.",
  preview: false,
});
