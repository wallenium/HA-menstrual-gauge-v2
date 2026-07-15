class PeriodCountdownTimer extends HTMLElement {
  constructor() {
    super();
    this.timerState = {
      isRunning: false,
      totalSeconds: 0,
      remainingSeconds: 0,
      intervalId: null,
      selectedProduct: null,
      currentStatus: null,
      reminderEnabled: true,
    };
    this.config = {};
  }

  connectedCallback() {
    try {
      this.render();
      this.setupEventListeners();
      
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch (error) {
      console.error("PeriodCountdownTimer Error:", error);
      this.innerHTML = `<ha-card><div style="padding: 16px; color: red;">⚠️ Fehler beim Laden</div></ha-card>`;
    }
  }

  setConfig(config) {
    this.config = config || {};
    if (this._hass) {
      this.updateStatus();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this.config && this.config.entity) {
      this.updateStatus();
    }
  }

  render() {
    this.innerHTML = `
      <ha-card>
        <div class="card-header">
          <h2 class="card-title">Menstruations-Countdown</h2>
          <div class="card-meta" id="cardMeta"></div>
        </div>
        <div class="card-content" id="cardContent">
          <!-- Will be filled by updateStatus -->
        </div>
      </ha-card>
    `;

    const style = document.createElement("style");
    style.textContent = this.getStyles();
    this.appendChild(style);
  }

  setupEventListeners() {
    // Will be reattached in updateStatus
  }

  updateStatus() {
    try {
      if (!this.config?.entity || !this._hass) {
        console.log("Missing config or hass", { entity: this.config?.entity, hass: !!this._hass });
        return;
      }

      const stateObj = this._hass.states[this.config.entity];
      if (!stateObj) {
        console.warn("Entity not found:", this.config.entity);
        return;
      }

      const status = stateObj.state;
      console.log("Status updated:", status);
      this.timerState.currentStatus = status;

      // Update card meta
      const cardMeta = this.querySelector("#cardMeta");
      if (cardMeta) {
        const friendlyName = stateObj.attributes?.friendly_name || this.config.entity;
        cardMeta.innerHTML = `
          <div class="meta-info">
            <span class="status">${status.toUpperCase()}</span>
            <span class="entity-name">${friendlyName}</span>
          </div>
        `;
      }

      // Update card content based on status
      const cardContent = this.querySelector("#cardContent");
      if (cardContent) {
        if (status === "neutral") {
          // Show neutral message - no timer needed
          cardContent.innerHTML = `
            <div class="neutral-message">
              <div class="message-icon">✨</div>
              <div class="message-text">
                <h3>Keine Periode</h3>
                <p>Aktuell werden keine Periodenprodukte benötigt.</p>
              </div>
            </div>
          `;
        } else {
          // Show product selector and timer
          cardContent.innerHTML = `
            <div class="product-selector">
              <label class="selector-label">Wähle Produkt</label>
              <div class="product-dropdown-wrapper">
                <select id="productSelect" class="product-select">
                  <option value="">-- Produkt wählen --</option>
                </select>
              </div>
            </div>

            <div class="timer-container">
              <div class="timer-display" id="timerDisplay">
                <div class="timer-icon" id="timerIcon">🩸</div>
                <div class="timer-content">
                  <div class="timer-time" id="timerTime">00:00</div>
                  <div class="timer-label" id="timerLabel">Bereit</div>
                </div>
              </div>

              <div class="timer-controls">
                <button id="startBtn" class="btn btn-start">Start</button>
                <button id="pauseBtn" class="btn btn-pause" disabled>Pause</button>
                <button id="resetBtn" class="btn btn-reset">Zurück</button>
              </div>

              <div class="reminder-section">
                <label class="reminder-label">
                  <input type="checkbox" id="reminderCheckbox" checked />
                  Benachrichtigungen aktivieren
                </label>
              </div>
            </div>
          `;

          // Attach event listeners for timer controls
          this.attachTimerEventListeners();
          
          // Update product dropdown
          this.updateProductDropdown(status);
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  attachTimerEventListeners() {
    const startBtn = this.querySelector("#startBtn");
    const pauseBtn = this.querySelector("#pauseBtn");
    const resetBtn = this.querySelector("#resetBtn");
    const reminderCheckbox = this.querySelector("#reminderCheckbox");
    const productSelect = this.querySelector("#productSelect");

    if (startBtn) startBtn.addEventListener("click", () => this.startTimer());
    if (pauseBtn) pauseBtn.addEventListener("click", () => this.pauseTimer());
    if (resetBtn) resetBtn.addEventListener("click", () => this.resetTimer());

    if (reminderCheckbox) {
      reminderCheckbox.addEventListener("change", (e) => {
        this.timerState.reminderEnabled = e.target.checked;
      });
    }

    if (productSelect) {
      productSelect.addEventListener("change", (e) => {
        if (e.target.value) {
          this.selectProductFromDropdown(e.target.value);
        }
      });
    }
  }

  updateProductDropdown(status) {
    try {
      const productSelect = this.querySelector("#productSelect");
      if (!productSelect) {
        console.warn("ProductSelect element not found");
        return;
      }

      const productConfig = {
        period: {
          tampon: { icon: "🩸", name: "Tampon", seconds: (this.config?.tampon_duration || 4) * 3600 },
          pad: { icon: "🩹", name: "Binde", seconds: (this.config?.pad_duration || 4) * 3600 },
          cup: { icon: "🔴", name: "Menstruationstasse", seconds: (this.config?.cup_duration || 7) * 3600 },
          underwear: { icon: "👙", name: "Periodenunterwäsche", seconds: (this.config?.underwear_duration || 6) * 3600 },
        },
        fertile: {
          liner: { icon: "🧴", name: "Slipeinlage", seconds: (this.config?.liner_duration || 8) * 3600 },
        },
        pms: {
          liner: { icon: "🧴", name: "Slipeinlage", seconds: (this.config?.liner_duration || 8) * 3600 },
        },
      };

      this.productConfig = productConfig;

      // Clear all options except the first
      while (productSelect.options.length > 1) {
        productSelect.remove(1);
      }

      const products = productConfig[status];
      console.log("Products for status", status, ":", products);
      
      if (!products) {
        console.warn("No products for status:", status);
        productSelect.disabled = true;
        return;
      }

      productSelect.disabled = false;

      Object.entries(products).forEach(([key, product]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = `${product.icon} ${product.name}`;
        option.dataset.icon = product.icon;
        option.dataset.seconds = product.seconds;
        productSelect.appendChild(option);
      });
      
      console.log("Dropdown updated successfully");
    } catch (error) {
      console.error("Error updating product dropdown:", error);
    }
  }

  selectProductFromDropdown(key) {
    try {
      const productSelect = this.querySelector("#productSelect");
      const selectedOption = productSelect.options[productSelect.selectedIndex];

      if (!selectedOption || !selectedOption.dataset.seconds) {
        console.warn("Invalid selection");
        return;
      }

      const product = {
        icon: selectedOption.dataset.icon,
        name: selectedOption.textContent.substring(2),
        seconds: parseInt(selectedOption.dataset.seconds),
      };

      this.timerState.selectedProduct = key;
      this.timerState.totalSeconds = product.seconds;
      this.timerState.remainingSeconds = product.seconds;

      const timerIcon = this.querySelector("#timerIcon");
      if (timerIcon) timerIcon.textContent = product.icon;

      this.updateDisplay();
      this.updateButtonStates();
    } catch (error) {
      console.error("Error selecting product:", error);
    }
  }

  startTimer() {
    try {
      if (!this.timerState.selectedProduct) {
        console.warn("No product selected");
        return;
      }

      if (this.timerState.remainingSeconds <= 0) {
        this.timerState.remainingSeconds = this.timerState.totalSeconds;
      }

      if (this.timerState.remainingSeconds > 0) {
        this.timerState.isRunning = true;
        this.updateButtonStates();

        this.timerState.intervalId = setInterval(() => {
          this.timerState.remainingSeconds--;

          if (this.timerState.remainingSeconds <= 0) {
            this.timerComplete();
          } else {
            this.updateDisplay();
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  }

  pauseTimer() {
    try {
      this.timerState.isRunning = false;
      clearInterval(this.timerState.intervalId);
      this.updateButtonStates();
      this.updateDisplay();
    } catch (error) {
      console.error("Error pausing timer:", error);
    }
  }

  resetTimer() {
    try {
      this.timerState.isRunning = false;
      this.timerState.remainingSeconds = 0;
      clearInterval(this.timerState.intervalId);
      this.updateButtonStates();
      this.updateDisplay();
    } catch (error) {
      console.error("Error resetting timer:", error);
    }
  }

  updateDisplay() {
    try {
      const hours = Math.floor(this.timerState.remainingSeconds / 3600);
      const minutes = Math.floor((this.timerState.remainingSeconds % 3600) / 60);
      const seconds = this.timerState.remainingSeconds % 60;

      let timeStr = hours > 0 
        ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

      const timerTime = this.querySelector("#timerTime");
      if (timerTime) timerTime.textContent = timeStr;

      const timerLabel = this.querySelector("#timerLabel");
      if (timerLabel) {
        if (this.timerState.isRunning) {
          timerLabel.textContent = "Läuft...";
        } else if (this.timerState.remainingSeconds > 0) {
          timerLabel.textContent = "Pausiert";
        } else {
          timerLabel.textContent = "Bereit";
        }
      }

      const timerDisplay = this.querySelector("#timerDisplay");
      if (timerDisplay) {
        timerDisplay.classList.remove("warning", "critical");
        if (this.timerState.remainingSeconds <= 600 && this.timerState.remainingSeconds > 0) {
          timerDisplay.classList.add("critical");
        } else if (this.timerState.remainingSeconds <= 1800) {
          timerDisplay.classList.add("warning");
        }
      }
    } catch (error) {
      console.error("Error updating display:", error);
    }
  }

  timerComplete() {
    try {
      this.timerState.isRunning = false;
      clearInterval(this.timerState.intervalId);
      this.updateButtonStates();

      const timerLabel = this.querySelector("#timerLabel");
      if (timerLabel) timerLabel.textContent = "Zeit abgelaufen!";

      const timerDisplay = this.querySelector("#timerDisplay");
      if (timerDisplay) timerDisplay.classList.add("timer-complete");

      if (this.timerState.reminderEnabled && Notification.permission === "granted") {
        new Notification("Menstruations-Countdown", {
          body: "Wechsel erforderlich!",
          tag: "period-timer",
          requireInteraction: true,
        }).catch(() => {});
      }

      this.playAlert();

      setTimeout(() => {
        this.resetTimer();
        timerDisplay?.classList.remove("timer-complete");
      }, 3000);
    } catch (error) {
      console.error("Error on timer complete:", error);
    }
  }

  playAlert() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn("Audio not available:", error);
    }
  }

  updateButtonStates() {
    try {
      const startBtn = this.querySelector("#startBtn");
      const pauseBtn = this.querySelector("#pauseBtn");

      if (startBtn && pauseBtn) {
        startBtn.disabled = this.timerState.isRunning;
        pauseBtn.disabled = !this.timerState.isRunning;
      }
    } catch (error) {
      console.error("Error updating button states:", error);
    }
  }

  getStyles() {
    return `
      :host {
        display: block;
      }

      ha-card {
        height: 100%;
      }

      .card-header {
        padding: 16px;
        border-bottom: 1px solid var(--divider-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .card-title {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
      }

      .card-meta {
        font-size: 0.8rem;
        color: var(--secondary-text-color);
      }

      .meta-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }

      .status {
        font-weight: 600;
        padding: 2px 8px;
        background: #e74c3c;
        color: white;
        border-radius: 4px;
        font-size: 0.75rem;
      }

      .entity-name {
        font-weight: 500;
        font-size: 0.8rem;
      }

      .card-content {
        padding: 20px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 200px;
      }

      /* Neutral Status Message */
      .neutral-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 40px 20px;
        text-align: center;
        background: linear-gradient(135deg, #27ae6020 0%, #27ae6010 100%);
        border: 2px solid #27ae60;
        border-radius: 12px;
      }

      .message-icon {
        font-size: 3rem;
        line-height: 1;
      }

      .message-text h3 {
        margin: 0 0 8px 0;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .message-text p {
        margin: 0;
        font-size: 0.95rem;
        color: var(--secondary-text-color);
      }

      /* Product Selector */
      .product-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .selector-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .product-dropdown-wrapper {
        position: relative;
      }

      .product-select {
        width: 100%;
        padding: 12px 16px;
        font-size: 1rem;
        font-weight: 600;
        border: 2px solid var(--divider-color);
        border-radius: 8px;
        background: var(--ha-card-background);
        color: var(--primary-text-color);
        cursor: pointer;
        transition: all 0.2s ease;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 12px center;
        background-size: 20px;
        padding-right: 40px;
      }

      .product-select:hover {
        border-color: #e74c3c;
        box-shadow: 0 2px 8px rgba(231, 76, 60, 0.2);
      }

      .product-select:focus {
        outline: none;
        border-color: #e74c3c;
        box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
      }

      .product-select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .product-select option {
        background: var(--ha-card-background);
        color: var(--primary-text-color);
        padding: 8px;
      }

      /* Timer */
      .timer-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .timer-display {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 24px;
        background: linear-gradient(135deg, #e74c3c20 0%, #e74c3c10 100%);
        border: 2px solid #e74c3c;
        border-radius: 12px;
        transition: all 0.3s ease;
      }

      .timer-display.warning {
        border-color: #f39c12;
        background: linear-gradient(135deg, #f39c1220 0%, #f39c1210 100%);
      }

      .timer-display.critical {
        border-color: #e74c3c;
        background: linear-gradient(135deg, #e74c3c30 0%, #e74c3c20 100%);
        animation: pulse-border 1s infinite;
      }

      @keyframes pulse-border {
        0%, 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.3); }
        50% { box-shadow: 0 0 0 8px rgba(231, 76, 60, 0); }
      }

      .timer-display.timer-complete {
        animation: complete-pulse 0.5s ease-in-out 3;
        background: #e74c3c;
      }

      @keyframes complete-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .timer-icon {
        font-size: 3rem;
        line-height: 1;
      }

      .timer-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .timer-time {
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--primary-text-color);
        font-family: 'Monaco', 'Courier New', monospace;
      }

      .timer-label {
        font-size: 0.9rem;
        color: var(--secondary-text-color);
        font-weight: 500;
      }

      .timer-controls {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        color: white;
      }

      .btn-start {
        background: #27ae60;
      }

      .btn-start:hover:not(:disabled) {
        background: #229954;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(39, 174, 96, 0.3);
      }

      .btn-pause {
        background: #f39c12;
      }

      .btn-pause:hover:not(:disabled) {
        background: #e67e22;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(243, 156, 18, 0.3);
      }

      .btn-reset {
        background: #95a5a6;
      }

      .btn-reset:hover:not(:disabled) {
        background: #7f8c8d;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(149, 165, 166, 0.3);
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .reminder-section {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        background: var(--ha-card-background);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }

      .reminder-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        color: var(--primary-text-color);
        user-select: none;
      }

      .reminder-label input[type="checkbox"] {
        cursor: pointer;
        width: 18px;
        height: 18px;
      }

      @media (prefers-color-scheme: dark) {
        .neutral-message {
          background: linear-gradient(135deg, #27ae6030 0%, #27ae6015 100%);
        }

        .timer-display { background: linear-gradient(135deg, #e74c3c30 0%, #e74c3c15 100%); }
        .timer-display.warning { background: linear-gradient(135deg, #f39c1230 0%, #f39c1215 100%); }
        .timer-display.critical { background: linear-gradient(135deg, #e74c3c40 0%, #e74c3c25 100%); }
        
        .product-select {
          background-color: var(--ha-card-background);
        }
      }

      @media (max-width: 600px) {
        .timer-display { flex-direction: column; gap: 12px; padding: 16px; }
        .timer-time { font-size: 2rem; }
        .timer-icon { font-size: 2.5rem; }
        .btn { padding: 8px 12px; font-size: 0.8rem; }
        .product-select { font-size: 0.9rem; }
        
        .neutral-message {
          padding: 30px 16px;
        }
        
        .message-icon {
          font-size: 2.5rem;
        }
        
        .message-text h3 {
          font-size: 1.1rem;
        }
        
        .message-text p {
          font-size: 0.9rem;
        }
      }
    `;
  }

  static getConfigElement() {
    return document.createElement("period-countdown-timer-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:period-countdown-timer",
      entity: "sensor.anna",
      tampon_duration: 4,
      pad_duration: 4,
      cup_duration: 7,
      underwear_duration: 6,
      liner_duration: 8,
    };
  }
}

customElements.define("period-countdown-timer", PeriodCountdownTimer);