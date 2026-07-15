class MenstrualCycleCard extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <ha-card>
        <div class="card-content">
          <div class="status-badge" id="statusBadge"></div>
          <div class="cycle-info" id="cycleInfo"></div>
        </div>
      </ha-card>
    `;
    this.appendChild(this._getStyles());
    this.render();
  }

  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    if (!this._hass || !this.config?.entity) return;

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) return;

    const attrs = stateObj.attributes || {};
    const status = this._getStatusInfo(stateObj.state);
    const statusBadge = this.querySelector("#statusBadge");
    const cycleInfo = this.querySelector("#cycleInfo");

    // Parse cycle values
    const cycleLength = parseInt(String(attrs.avg_cycle_length || "28"), 10);
    const nextStart = attrs.next_predicted_start;
    
    // Calculate cycleDay from nextStart date
    let cycleDay = 1;
    
    if (nextStart) {
      try {
        const nextDate = new Date(nextStart);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);
        
        const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
        cycleDay = cycleLength - daysUntil;
      } catch (e) {
        const daysUntil = parseInt(String(attrs.days_until_next_start || "0"), 10);
        cycleDay = cycleLength - daysUntil;
      }
    } else {
      const daysUntil = parseInt(String(attrs.days_until_next_start || "0"), 10);
      cycleDay = cycleLength - daysUntil;
    }

    if (statusBadge) {
      statusBadge.style.borderColor = status.color;
      statusBadge.style.background = `${status.color}20`;
      statusBadge.style.boxShadow = `0 0 0 3px ${status.color}40, inset 0 0 0 2px ${status.color}`;
      statusBadge.innerHTML = `
        <span class="status-emoji">${status.emoji}</span>
        <span class="status-label">${status.label}</span>
      `;
    }

    if (cycleInfo) {
      cycleInfo.innerHTML = `
        <div class="info-row">
          <span class="info-label">${this._t('cycle_day')}</span>
          <span class="info-value">${cycleDay}/${cycleLength}</span>
        </div>
      `;
    }
  }

  _getStatusInfo(state) {
    const statusMap = {
      period: {
        emoji: "🩸",
        color: "#e74c3c",
        label: this._t('period'),
      },
      fertile: {
        emoji: "💚",
        color: "#27ae60",
        label: this._t('fertile'),
      },
      pms: {
        emoji: "⚠️",
        color: "#f39c12",
        label: this._t('pms'),
      },
      neutral: {
        emoji: "⭕",
        color: "#95a5a6",
        label: this._t('neutral'),
      },
    };

    return statusMap[state] || statusMap.neutral;
  }

  _t(key) {
    const translations = {
      de: {
        cycle_day: "Zyklustag",
        period: "Periode",
        fertile: "Fruchtbar",
        pms: "PMS",
        neutral: "Neutral",
      },
      en: {
        cycle_day: "Cycle Day",
        period: "Period",
        fertile: "Fertile",
        pms: "PMS",
        neutral: "Neutral",
      },
    };

    const lang = this._hass?.language || 'de';
    return translations[lang]?.[key] || translations['en'][key];
  }

  _getStyles() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
      }

      ha-card {
        height: 100%;
        background: var(--ha-card-background);
        border-radius: 16px;
      }

      .card-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }

      .status-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 16px 24px;
        border-radius: 12px;
        border: 3px solid;
        width: 100%;
      }

      .status-emoji {
        font-size: 2.5rem;
        line-height: 1;
      }

      .status-label {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--primary-text-color);
        letter-spacing: 0.5px;
      }

      .cycle-info {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--ha-card-background);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.9rem;
      }

      .info-label {
        color: var(--secondary-text-color);
        font-weight: 500;
      }

      .info-value {
        color: var(--primary-text-color);
        font-weight: 600;
      }

      /* Dark Mode */
      @media (prefers-color-scheme: dark) {
        .status-badge {
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1) !important;
        }
      }

      @media (max-width: 300px) {
        .status-badge {
          padding: 12px 16px;
          gap: 4px;
        }

        .status-emoji {
          font-size: 2rem;
        }

        .status-label {
          font-size: 1rem;
        }

        .cycle-info {
          padding: 8px;
          gap: 6px;
        }

        .info-row {
          font-size: 0.8rem;
        }
      }
    `;
    return style;
  }

  static getConfigElement() {
    return document.createElement("menstrual-cycle-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:menstrual-cycle-card",
      entity: "sensor.cycle_status",
    };
  }
}

customElements.define("menstrual-cycle-card", MenstrualCycleCard);
