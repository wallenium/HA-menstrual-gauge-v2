class MenstruationCountdownTimerEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      product_animations: true,
      animation_style: "realistic",
      tampon_duration: 4,
      pad_duration: 4,
      cup_duration: 7,
      underwear_duration: 6,
      liner_duration: 8,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.shadowRoot?.activeElement) return;
    this._render();
  }

  _lang() {
    const language = String(this._hass?.locale?.language || "en").toLowerCase();
    return language.startsWith("de") ? "de" : "en";
  }

  _t(key) {
    const i18n = {
      de: {
        entity: "Entität",
        entity_help: "Wähle die Sensor-Entität mit dem Menstruationsstatus.",
        animations: "Animationen",
        product_animations: "Produktanimationen aktivieren",
        product_animations_help: "Zeigt eine visuelle Füllanimation während des Countdowns.",
        animation_style: "Animationsstil",
        animation_style_help: "Wähle die Farb-/Darstellungsart für die Animation.",
        realistic: "Realistisch",
        avoid_blood: "Blutarm (blau)",
        durations: "Dauern (Stunden)",
        durations_help: "Standard-Countdown pro Produkttyp in Stunden.",
        tampon_duration: "Tampon",
        pad_duration: "Binde",
        cup_duration: "Menstruationstasse",
        underwear_duration: "Periodenunterwäsche",
        liner_duration: "Slipeinlage",
        preview: "Vorschau / Aktuelle Konfiguration",
        preview_note: "Diese Übersicht zeigt die aktuell gesetzten Werte.",
        fallback_note: "HA Entity-Picker nicht verfügbar, Fallback-Dropdown aktiv.",
        sensor_search: "Sensor suchen…",
        no_sensors: "Keine Sensoren gefunden.",
        hours_suffix: "h",
      },
      en: {
        entity: "Entity",
        entity_help: "Select the sensor entity containing menstruation status.",
        animations: "Animations",
        product_animations: "Enable product animations",
        product_animations_help: "Shows a visual fill animation during countdown.",
        animation_style: "Animation style",
        animation_style_help: "Choose the color/visual style for animations.",
        realistic: "Realistic",
        avoid_blood: "Avoid blood (blue)",
        durations: "Durations (hours)",
        durations_help: "Default countdown duration per product type in hours.",
        tampon_duration: "Tampon",
        pad_duration: "Pad",
        cup_duration: "Menstrual Cup",
        underwear_duration: "Period Underwear",
        liner_duration: "Liner",
        preview: "Preview / Current configuration",
        preview_note: "This summary reflects the currently configured values.",
        fallback_note: "HA entity picker unavailable, fallback dropdown active.",
        sensor_search: "Search sensor…",
        no_sensors: "No sensors found.",
        hours_suffix: "h",
      },
    };
    return (i18n[this._lang()]?.[key]) ?? (i18n.en[key] ?? key);
  }

  _emit(nextConfig) {
    this._config = { ...nextConfig };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _entityOptions() {
    const states = this._hass?.states || {};
    return Object.keys(states)
      .filter((id) => id.startsWith("sensor."))
      .sort()
      .map((id) => ({
        entity_id: id,
        label: String(states[id]?.attributes?.friendly_name || states[id]?.attributes?.name || id),
      }));
  }

  _entityOptionsHtml(options, selected) {
    return options.map((row) => {
      const sel = row.entity_id === selected ? "selected" : "";
      return `<option value="${row.entity_id}" ${sel}>${this._escapeHtml(row.label)} (${row.entity_id})</option>`;
    }).join("");
  }

  _escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  _normalizeDuration(value, fallback) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
  }

  _durationValue(key, fallback) {
    return this._normalizeDuration(this._config[key], fallback);
  }

  _buildPreview() {
    const values = {
      entity: this._config.entity || "",
      product_animations: this._config.product_animations !== false,
      animation_style: this._config.animation_style === "avoid_blood" ? "avoid_blood" : "realistic",
      tampon_duration: this._durationValue("tampon_duration", 4),
      pad_duration: this._durationValue("pad_duration", 4),
      cup_duration: this._durationValue("cup_duration", 7),
      underwear_duration: this._durationValue("underwear_duration", 6),
      liner_duration: this._durationValue("liner_duration", 8),
    };
    return this._escapeHtml(JSON.stringify(values, null, 2));
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    const entities = this._entityOptions();
    const selectedEntity = String(this._config.entity || "");
    const productAnimations = this._config.product_animations !== false;
    const animationStyle = this._config.animation_style === "avoid_blood" ? "avoid_blood" : "realistic";
    const tamponDuration = this._durationValue("tampon_duration", 4);
    const padDuration = this._durationValue("pad_duration", 4);
    const cupDuration = this._durationValue("cup_duration", 7);
    const underwearDuration = this._durationValue("underwear_duration", 6);
    const linerDuration = this._durationValue("liner_duration", 8);

    const hasHaSelector = Boolean(customElements.get("ha-selector"));
    const hasHaEntityPicker = Boolean(customElements.get("ha-entity-picker"));

    const entityPickerHtml = hasHaSelector
      ? '<ha-selector id="entity_selector"></ha-selector>'
      : hasHaEntityPicker
      ? '<ha-entity-picker id="entity_picker"></ha-entity-picker>'
      : `<div class="entity-fallback">
           <input id="entity_search" type="text" placeholder="${this._t("sensor_search")}">
           <select id="entity_select" size="5">${this._entityOptionsHtml(entities, selectedEntity)}</select>
           <div class="help">${this._t("fallback_note")}</div>
         </div>`;

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 14px; padding: 2px 0; }
        .section-title { font-size: 12px; font-weight: 700; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .row { display: grid; gap: 6px; }
        label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
        input[type='text'], input[type='number'], select {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        input[type='number'] { max-width: 120px; }
        .help { font-size: 11px; color: var(--secondary-text-color); opacity: 0.9; }
        .check { display: flex; gap: 8px; align-items: center; color: var(--primary-text-color); font-size: 13px; }
        .check input[type='checkbox'] { width: auto; min-width: 0; margin: 0; }
        .radio-group { display: flex; flex-direction: column; gap: 6px; }
        .radio-label { display: flex; gap: 8px; align-items: center; color: var(--primary-text-color); font-size: 13px; font-weight: normal; }
        .duration-grid { display: grid; gap: 8px; }
        .duration-row { display: grid; grid-template-columns: minmax(140px, 1fr) auto; gap: 10px; align-items: center; }
        .duration-label { color: var(--primary-text-color); font-size: 13px; }
        .input-with-suffix { display: inline-flex; align-items: center; gap: 6px; }
        .preview-box {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 10px;
          background: var(--card-background-color);
        }
        .preview-json {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--primary-text-color);
          font-size: 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        ha-selector, ha-entity-picker { width: 100%; display: block; }
      </style>

      <div class="wrap">
        <div>
          <div class="section-title">${this._t("entity")}</div>
          <div class="row">
            ${entityPickerHtml}
            <div class="help">${this._t("entity_help")}</div>
          </div>
        </div>

        <div>
          <div class="section-title">${this._t("animations")}</div>
          <div class="row">
            <label class="check">
              <input id="product_animations" type="checkbox" ${productAnimations ? "checked" : ""}>
              <span>${this._t("product_animations")}</span>
            </label>
            <div class="help">${this._t("product_animations_help")}</div>
          </div>
          <div class="row" style="margin-top:8px;">
            <label for="animation_style">${this._t("animation_style")}</label>
            <select id="animation_style">
              <option value="realistic" ${animationStyle === "realistic" ? "selected" : ""}>${this._t("realistic")}</option>
              <option value="avoid_blood" ${animationStyle === "avoid_blood" ? "selected" : ""}>${this._t("avoid_blood")}</option>
            </select>
            <div class="help">${this._t("animation_style_help")}</div>
          </div>
        </div>

        <div>
          <div class="section-title">${this._t("durations")}</div>
          <div class="help" style="margin-bottom:8px;">${this._t("durations_help")}</div>
          <div class="duration-grid">
            <div class="duration-row">
              <span class="duration-label">${this._t("tampon_duration")}</span>
              <div class="input-with-suffix">
                <input id="tampon_duration" type="number" min="1" step="1" value="${tamponDuration}">
                <span>${this._t("hours_suffix")}</span>
              </div>
            </div>
            <div class="duration-row">
              <span class="duration-label">${this._t("pad_duration")}</span>
              <div class="input-with-suffix">
                <input id="pad_duration" type="number" min="1" step="1" value="${padDuration}">
                <span>${this._t("hours_suffix")}</span>
              </div>
            </div>
            <div class="duration-row">
              <span class="duration-label">${this._t("cup_duration")}</span>
              <div class="input-with-suffix">
                <input id="cup_duration" type="number" min="1" step="1" value="${cupDuration}">
                <span>${this._t("hours_suffix")}</span>
              </div>
            </div>
            <div class="duration-row">
              <span class="duration-label">${this._t("underwear_duration")}</span>
              <div class="input-with-suffix">
                <input id="underwear_duration" type="number" min="1" step="1" value="${underwearDuration}">
                <span>${this._t("hours_suffix")}</span>
              </div>
            </div>
            <div class="duration-row">
              <span class="duration-label">${this._t("liner_duration")}</span>
              <div class="input-with-suffix">
                <input id="liner_duration" type="number" min="1" step="1" value="${linerDuration}">
                <span>${this._t("hours_suffix")}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="section-title">${this._t("preview")}</div>
          <div class="preview-box">
            <pre class="preview-json">${this._buildPreview()}</pre>
            <div class="help">${this._t("preview_note")}</div>
          </div>
        </div>
      </div>
    `;

    const applyEntity = (value) => {
      const v = String(value || "").trim();
      if (!v) return;
      this._emit({ ...this._config, entity: v });
    };

    const entitySelector = this.shadowRoot.getElementById("entity_selector");
    if (entitySelector) {
      entitySelector.hass = this._hass;
      entitySelector.selector = { entity: { domain: "sensor" } };
      entitySelector.value = selectedEntity;
      entitySelector.addEventListener("value-changed", (ev) => applyEntity(ev?.detail?.value));
      entitySelector.addEventListener("change", (ev) => applyEntity(ev?.detail?.value));
    }

    const entityPicker = this.shadowRoot.getElementById("entity_picker");
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = selectedEntity;
      entityPicker.includeDomains = ["sensor"];
      entityPicker.allowCustomEntity = false;
      entityPicker.addEventListener("value-changed", (ev) => applyEntity(ev?.detail?.value));
      entityPicker.addEventListener("change", (ev) => applyEntity(ev?.detail?.value));
    }

    const entitySelect = this.shadowRoot.getElementById("entity_select");
    const entitySearch = this.shadowRoot.getElementById("entity_search");
    if (entitySelect) {
      entitySelect.addEventListener("change", (ev) => applyEntity(ev?.target?.value));
      entitySearch?.addEventListener("input", (ev) => {
        const needle = String(ev?.target?.value || "").trim().toLowerCase();
        const filtered = needle
          ? entities.filter((r) => `${r.label} ${r.entity_id}`.toLowerCase().includes(needle))
          : entities;
        entitySelect.innerHTML = this._entityOptionsHtml(filtered, selectedEntity);
      });
      entitySearch?.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          applyEntity(entitySelect?.value);
        }
      });
    }

    this.shadowRoot.getElementById("product_animations")?.addEventListener("change", (ev) => {
      this._emit({ ...this._config, product_animations: Boolean(ev.target?.checked) });
    });

    this.shadowRoot.getElementById("animation_style")?.addEventListener("change", (ev) => {
      const value = String(ev.target?.value || "realistic");
      this._emit({
        ...this._config,
        animation_style: value === "avoid_blood" ? "avoid_blood" : "realistic",
      });
    });

    const durationDefaults = {
      tampon_duration: 4,
      pad_duration: 4,
      cup_duration: 7,
      underwear_duration: 6,
      liner_duration: 8,
    };
    Object.keys(durationDefaults).forEach((key) => {
      this.shadowRoot.getElementById(key)?.addEventListener("change", (ev) => {
        this._emit({
          ...this._config,
          [key]: this._normalizeDuration(ev.target?.value, durationDefaults[key]),
        });
      });
    });
  }
}

if (!customElements.get("menstruation-countdown-timer-editor")) {
  customElements.define("menstruation-countdown-timer-editor", MenstruationCountdownTimerEditor);
}
