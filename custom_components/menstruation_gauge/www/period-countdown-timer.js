class PeriodCountdownTimer extends HTMLElement {
  constructor() {
    super();
    this.timerState = {
      isRunning: false,
      totalSeconds: 0,
      remainingSeconds: 0,
      intervalId: null,
      feedbackTimeoutId: null,
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
          this.renderNeutralMode(cardContent);
        } else if (status === "pre_menarche") {
          this.renderPreMearcheMode(cardContent);
        } else if (status === "pregnant") {
          this.renderPregnancyMode(cardContent, stateObj.attributes);
        } else if (status === "postpartum") {
          this.renderPostpartumMode(cardContent, stateObj.attributes);
        } else if (status === "menopause") {
          this.renderMenopauseMode(cardContent);
        } else if (status === "period" || status === "fertile" || status === "pms") {
          this.renderPeriodMode(cardContent);
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  renderNeutralMode(cardContent) {
    cardContent.innerHTML = `
      <div class="neutral-message">
        <div class="message-icon">✨</div>
        <div class="message-text">
          <h3>${this._t('neutral_title')}</h3>
          <p>${this._t('neutral_products_message')}</p>
        </div>
      </div>
    `;
  }

  renderPreMearcheMode(cardContent) {
    cardContent.innerHTML = `
      <div class="premenarche-container">
        <div class="premenarche-badge">
          <div class="badge-emoji">🌸</div>
          <div class="badge-text">
            <h3>${this._t('pre_menarche')}</h3>
            <p>${this._t('pre_menarche_desc')}</p>
          </div>
        </div>
        
        <div class="info-section">
          <h4>${this._t('preparation_tips')}</h4>
          <div class="tips-grid">
            <div class="tip-card">
              <div class="tip-emoji">📚</div>
              <span>${this._t('learn_about_cycle')}</span>
            </div>
            <div class="tip-card">
              <div class="tip-emoji">🛡️</div>
              <span>${this._t('hygiene_products')}</span>
            </div>
            <div class="tip-card">
              <div class="tip-emoji">🤝</div>
              <span>${this._t('talk_to_parent')}</span>
            </div>
            <div class="tip-card">
              <div class="tip-emoji">📱</div>
              <span>${this._t('use_app_tracking')}</span>
            </div>
          </div>
        </div>

        <div class="reminder-section">
          <label class="reminder-label">
            <input type="checkbox" id="reminderCheckbox" checked />
            ${this._t('enable_reminder')}
          </label>
        </div>
      </div>
    `;
    this.attachReminderListener();
  }

  renderPregnancyMode(cardContent, attributes) {
    const pregnancyWeek = attributes?.pregnancy_week || 0;
    const dueDate = attributes?.due_date || "TBD";
    const trimester = Math.ceil(pregnancyWeek / 13);

    cardContent.innerHTML = `
      <div class="pregnancy-container">
        <div class="pregnancy-badge">
          <div class="badge-emoji">🤰</div>
          <div class="badge-text">
            <h3>${this._t('pregnant')}</h3>
            <p>${this._t('week')} ${pregnancyWeek} • ${this._t('trimester')} ${trimester}</p>
          </div>
        </div>

        <div class="pregnancy-info-grid">
          <div class="info-box">
            <span class="info-label">${this._t('due_date')}</span>
            <span class="info-value">${dueDate}</span>
          </div>
          <div class="info-box">
            <span class="info-label">${this._t('pregnancy_week')}</span>
            <span class="info-value">${pregnancyWeek}</span>
          </div>
        </div>

        <div class="milestone-section">
          <h4>${this._t('milestones_trimester')} ${trimester}</h4>
          <div class="milestone-list" id="milestoneList"></div>
        </div>

        <div class="checklist-section">
          <h4>${this._t('trimester_checklist')}</h4>
          <div class="checklist" id="trimesterChecklist"></div>
        </div>

        <div class="symptom-tracker">
          <h4>${this._t('symptoms')}</h4>
          <div class="symptom-grid" id="symptomGrid"></div>
        </div>

        <div class="reminder-section">
          <label class="reminder-label">
            <input type="checkbox" id="reminderCheckbox" checked />
            ${this._t('enable_reminder')}
          </label>
        </div>
      </div>
    `;

    this.renderPregnancyMilestones(trimester);
    this.renderTrimesterChecklist(trimester);
    this.renderSymptomTracker('pregnancy');
    this.attachReminderListener();
  }

  renderPostpartumMode(cardContent, attributes) {
    const birthDate = attributes?.birth_date || new Date().toISOString();
    const daysSinceBirth = this.calculateDaysSince(birthDate);
    const weeksSinceBirth = Math.floor(daysSinceBirth / 7);

    cardContent.innerHTML = `
      <div class="postpartum-container">
        <div class="postpartum-badge">
          <div class="badge-emoji">👶</div>
          <div class="badge-text">
            <h3>${this._t('postpartum')}</h3>
            <p>${daysSinceBirth} ${this._t('days_since_birth')}</p>
          </div>
        </div>

        <div class="postpartum-info-grid">
          <div class="info-box">
            <span class="info-label">${this._t('weeks_postpartum')}</span>
            <span class="info-value">${weeksSinceBirth}</span>
          </div>
          <div class="info-box">
            <span class="info-label">${this._t('days_postpartum')}</span>
            <span class="info-value">${daysSinceBirth}</span>
          </div>
        </div>

        <div class="recovery-section">
          <h4>${this._t('recovery_tracker')}</h4>
          <div class="recovery-items" id="recoveryItems"></div>
        </div>

        <div class="bleeding-monitor">
          <h4>${this._t('bleeding_monitor')}</h4>
          <div class="bleeding-grid" id="bleedingGrid"></div>
        </div>

        <div class="postpartum-checklist">
          <h4>${this._t('postpartum_checklist')}</h4>
          <div class="checklist" id="postpartumChecklist"></div>
        </div>

        <div class="reminder-section">
          <label class="reminder-label">
            <input type="checkbox" id="reminderCheckbox" checked />
            ${this._t('enable_reminder')}
          </label>
        </div>
      </div>
    `;

    this.renderRecoveryItems(weeksSinceBirth);
    this.renderBleedingMonitor();
    this.renderPostpartumChecklist(weeksSinceBirth);
    this.attachReminderListener();
  }

  renderMenopauseMode(cardContent) {
    cardContent.innerHTML = `
      <div class="menopause-container">
        <div class="menopause-badge">
          <div class="badge-emoji">🌙</div>
          <div class="badge-text">
            <h3>${this._t('menopause')}</h3>
            <p>${this._t('menopause_desc')}</p>
          </div>
        </div>

        <div class="symptom-tracker">
          <h4>${this._t('menopause_symptoms')}</h4>
          <div class="symptom-grid" id="menopauseSymptoms"></div>
        </div>

        <div class="mood-tracker">
          <h4>${this._t('mood_tracker')}</h4>
          <div class="mood-grid" id="moodGrid"></div>
        </div>

        <div class="wellness-tips">
          <h4>${this._t('wellness_tips')}</h4>
          <div class="tips-list" id="wellnessTips"></div>
        </div>

        <div class="reminder-section">
          <label class="reminder-label">
            <input type="checkbox" id="reminderCheckbox" checked />
            ${this._t('enable_reminder')}
          </label>
        </div>
      </div>
    `;

    this.renderMenopauseSymptoms();
    this.renderMoodTracker();
    this.renderWellnessTips();
    this.attachReminderListener();
  }

  renderPeriodMode(cardContent) {
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

        <div class="usage-controls">
          <button id="logUsageBtn" class="btn btn-usage" disabled>${this._t('log_used')}</button>
          <button id="logCupBtn" class="btn btn-cup" hidden disabled>${this._t('log_cup_emptied')}</button>
        </div>

        <div class="usage-feedback" id="usageFeedback" hidden></div>

        <div class="reminder-section">
          <label class="reminder-label">
            <input type="checkbox" id="reminderCheckbox" checked />
            ${this._t('enable_reminder')}
          </label>
        </div>
      </div>
    `;

    this.updateProductDropdown(this.timerState.currentStatus);
    this.attachTimerEventListeners();
  }

  renderPregnancyMilestones(trimester) {
    const milestoneList = this.querySelector("#milestoneList");
    if (!milestoneList) return;

    const milestones = {
      1: ['Herzschlag erkennbar', 'Erstes Ultraschall', 'Geschlechtsbestimmung möglich'],
      2: ['Bewegungen spürbar', 'Detailliertes Ultraschall', 'Gewichtszunahme'],
      3: ['Babys Position fest', 'Geburt nahbar', 'Letzter Check-up']
    };

    const items = milestones[trimester] || [];
    milestoneList.innerHTML = items.map(m => `
      <div class="milestone-item">
        <span class="milestone-check">✓</span>
        <span>${m}</span>
      </div>
    `).join('');
  }

  renderTrimesterChecklist(trimester) {
    const checklist = this.querySelector("#trimesterChecklist");
    if (!checklist) return;

    const checklists = {
      1: ['Arzttermin vereinbaren', 'Vorsorgeuntersuchung', 'Vitamins starten'],
      2: ['Zahnarzt-Check', 'Gewichtszunahme kontrollieren', 'Bewegungsübungen'],
      3: ['Geburtsplan besprechen', 'Krankenhaus anmelden', 'Tasche packen']
    };

    const items = checklists[trimester] || [];
    checklist.innerHTML = items.map((item, i) => `
      <label class="checkbox-item">
        <input type="checkbox" data-item="${i}" />
        <span>${item}</span>
      </label>
    `).join('');
  }

  renderSymptomTracker(mode) {
    const symptomGrid = this.querySelector("#symptomGrid");
    if (!symptomGrid) return;

    const symptoms = mode === 'pregnancy' 
      ? ['Übelkeit', 'Müdigkeit', 'Kopfschmerz', 'Rückenschmerz', 'Sodbrennen', 'Schwellungen']
      : ['Hitzewallungen', 'Schweißausbrüche', 'Schlafstörungen', 'Stimmungsschwankungen'];

    symptomGrid.innerHTML = symptoms.map(s => `
      <label class="symptom-btn">
        <input type="checkbox" />
        <span>${s}</span>
      </label>
    `).join('');
  }

  renderRecoveryItems(weeksSinceBirth) {
    const recoveryItems = this.querySelector("#recoveryItems");
    if (!recoveryItems) return;

    const items = [
      { label: 'Wundheilung', weeks: 2 },
      { label: 'Blutung normalisiert', weeks: 4 },
      { label: 'Rückbildung aktiv', weeks: 6 },
      { label: 'Sex möglich', weeks: 6 }
    ];

    recoveryItems.innerHTML = items.map(item => {
      const completed = weeksSinceBirth >= item.weeks;
      return `
        <div class="recovery-item ${completed ? 'completed' : ''}">
          <span class="recovery-check">${completed ? '✓' : '○'}</span>
          <span>${item.label}</span>
          <span class="week-label">Woche ${item.weeks}</span>
        </div>
      `;
    }).join('');
  }

  renderBleedingMonitor() {
    const bleedingGrid = this.querySelector("#bleedingGrid");
    if (!bleedingGrid) return;

    const levels = ['Gering', 'Moderat', 'Stark'];
    bleedingGrid.innerHTML = levels.map(level => `
      <label class="bleeding-option">
        <input type="radio" name="bleeding" value="${level}" />
        <span>${level}</span>
      </label>
    `).join('');
  }

  renderPostpartumChecklist(weeksSinceBirth) {
    const checklist = this.querySelector("#postpartumChecklist");
    if (!checklist) return;

    const items = [
      'Arzttermin Wochenbett',
      'Rückbildungskurs starten',
      'Beckenbodentraining',
      'Blutung überprüfen',
      'Emotional Check-in'
    ];

    checklist.innerHTML = items.map((item, i) => `
      <label class="checkbox-item">
        <input type="checkbox" data-item="${i}" />
        <span>${item}</span>
      </label>
    `).join('');
  }

  renderMenopauseSymptoms() {
    const symptomsGrid = this.querySelector("#menopauseSymptoms");
    if (!symptomsGrid) return;

    const symptoms = ['Hitzewallungen', 'Nachtschweiß', 'Schlafstörungen', 'Reizbarkeit', 'Trockenheit', 'Gewichtszunahme'];
    symptomsGrid.innerHTML = symptoms.map(s => `
      <label class="symptom-btn">
        <input type="checkbox" />
        <span>${s}</span>
      </label>
    `).join('');
  }

  renderMoodTracker() {
    const moodGrid = this.querySelector("#moodGrid");
    if (!moodGrid) return;

    const moods = ['😊 Glücklich', '😐 Neutral', '😔 Traurig', '😤 Reizbar', '😰 Ängstlich'];
    moodGrid.innerHTML = moods.map(mood => `
      <label class="mood-option">
        <input type="radio" name="mood" />
        <span>${mood}</span>
      </label>
    `).join('');
  }

  renderWellnessTips() {
    const wellnessTips = this.querySelector("#wellnessTips");
    if (!wellnessTips) return;

    const tips = [
      '🧘 Entspannungstechniken & Yoga',
      '🏃 Regelmäßige Bewegung',
      '🥗 Gesunde Ernährung',
      '💧 Ausreichend Wasser trinken',
      '😴 Guter Schlaf wichtig',
      '🤝 Unterstützung suchen'
    ];

    wellnessTips.innerHTML = tips.map(tip => `
      <div class="wellness-tip">${tip}</div>
    `).join('');
  }

  calculateDaysSince(date) {
    const startDate = new Date(date);
    const today = new Date();
    const diffTime = today - startDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  attachTimerEventListeners() {
    const startBtn = this.querySelector("#startBtn");
    const pauseBtn = this.querySelector("#pauseBtn");
    const resetBtn = this.querySelector("#resetBtn");
    const logUsageBtn = this.querySelector("#logUsageBtn");
    const logCupBtn = this.querySelector("#logCupBtn");
    const reminderCheckbox = this.querySelector("#reminderCheckbox");

    if (startBtn) startBtn.addEventListener("click", () => this.startTimer());
    if (pauseBtn) pauseBtn.addEventListener("click", () => this.pauseTimer());
    if (resetBtn) resetBtn.addEventListener("click", () => this.resetTimer());
    if (logUsageBtn) logUsageBtn.addEventListener("click", () => this.logProductUsage("used"));
    if (logCupBtn) logCupBtn.addEventListener("click", () => this.logProductUsage("emptied"));

    if (reminderCheckbox) {
      reminderCheckbox.addEventListener("change", (e) => {
        this.timerState.reminderEnabled = e.target.checked;
      });
    }

  }

  attachReminderListener() {
    const reminderCheckbox = this.querySelector("#reminderCheckbox");
    if (reminderCheckbox) {
      reminderCheckbox.addEventListener("change", (e) => {
        this.timerState.reminderEnabled = e.target.checked;
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
      this.timerState.selectedProduct = null;
      this.timerState.totalSeconds = 0;
      this.timerState.remainingSeconds = 0;
      this.pauseTimer();
      productSelect.value = "";

      while (productSelect.options.length > 1) {
        productSelect.remove(1);
      }

      const products = productConfig[status];
      
      if (!products) {
        productSelect.disabled = true;
        this.updateUsageButtons();
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
      if (productSelect) {
        productSelect.addEventListener("change", (e) => {
          if (e.target.value) {
            this.selectProductFromDropdown(e.target.value);
          }
        });
      }
      this.updateDisplay();
      this.updateButtonStates();
      this.updateUsageButtons();
    } catch (error) {
      console.error("Error updating product dropdown:", error);
    }
  }

  selectProductFromDropdown(key) {
    try {
      const productSelect = this.querySelector("#productSelect");
      if (!productSelect) {
        console.warn("ProductSelect element not found");
        return;
      }
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
      this.updateUsageButtons();
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
      this.timerState.intervalId = null;
      this.updateButtonStates();
      this.updateDisplay();
    } catch (error) {
      console.error("Error resetting timer:", error);
    }
  }

  callService(domain, service, serviceData) {
    if (!this._hass) {
      throw new Error("Home Assistant instance not available");
    }
    return this._hass.callService(domain, service, serviceData);
  }

  async logProductUsage(action = "used") {
    try {
      if (!this.timerState.selectedProduct) {
        this.showUsageFeedback(this._t('select_product_first'), "error");
        return;
      }

      if (action === "emptied" && this.timerState.selectedProduct !== "cup") {
        this.showUsageFeedback(this._t('cup_empty_only'), "error");
        return;
      }

      await this.callService("menstruation_gauge", "log_product_usage", {
        entity_id: this.config?.entity,
        profile: this.config?.profile,
        entry_id: this.config?.entry_id,
        product: this.timerState.selectedProduct,
        action,
        quantity: 1,
      });

      clearInterval(this.timerState.intervalId);
      this.timerState.intervalId = null;
      this.timerState.isRunning = false;
      this.timerState.remainingSeconds = this.timerState.totalSeconds;
      this.updateDisplay();
      this.updateButtonStates();
      this.updateUsageButtons();

      const successKey = action === "emptied" ? "usage_logged_emptied" : "usage_logged_used";
      this.showUsageFeedback(this._t(successKey), "success");
    } catch (error) {
      console.error("Error logging product usage:", error);
      this.showUsageFeedback(this._t('usage_logged_error'), "error");
    }
  }

  showUsageFeedback(message, type = "success") {
    const feedback = this.querySelector("#usageFeedback");
    const timerDisplay = this.querySelector("#timerDisplay");

    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = message;
      feedback.className = `usage-feedback ${type}`;
    }

    if (timerDisplay) {
      timerDisplay.classList.remove("logged-success", "logged-error");
      timerDisplay.classList.add(type === "success" ? "logged-success" : "logged-error");
    }

    clearTimeout(this.timerState.feedbackTimeoutId);
    this.timerState.feedbackTimeoutId = window.setTimeout(() => {
      if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
        feedback.className = "usage-feedback";
      }
      timerDisplay?.classList.remove("logged-success", "logged-error");
    }, 2200);
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
      const logUsageBtn = this.querySelector("#logUsageBtn");

      if (startBtn && pauseBtn) {
        startBtn.disabled = this.timerState.isRunning;
        pauseBtn.disabled = !this.timerState.isRunning;
      }

      if (logUsageBtn) {
        logUsageBtn.disabled = !this.timerState.selectedProduct;
      }
    } catch (error) {
      console.error("Error updating button states:", error);
    }
  }

  updateUsageButtons() {
    const logUsageBtn = this.querySelector("#logUsageBtn");
    const logCupBtn = this.querySelector("#logCupBtn");
    const isCupSelected = this.timerState.selectedProduct === "cup";

    if (logUsageBtn) {
      logUsageBtn.disabled = !this.timerState.selectedProduct;
    }

    if (logCupBtn) {
      logCupBtn.hidden = !isCupSelected;
      logCupBtn.disabled = !isCupSelected;
    }
  }

  _t(key) {
    const translations = {
      de: {
        pre_menarche: "Pre-Menarche",
        pre_menarche_desc: "Pubertät - Zyklus noch nicht begonnen",
        neutral_title: "Keine Periode",
        neutral_products_message: "Keine Periode - keine Produkte nötig",
        pregnant: "Schwanger",
        postpartum: "Wochenbett",
        menopause: "Menopause",
        preparation_tips: "Vorbereitungstipps",
        learn_about_cycle: "Lerne über den Zyklus",
        hygiene_products: "Hygiene-Produkte",
        talk_to_parent: "Sprich mit Eltern",
        use_app_tracking: "Nutze App zum Tracking",
        enable_reminder: "Benachrichtigungen aktivieren",
        week: "Woche",
        trimester: "Trimester",
        due_date: "Geburtstermin",
        pregnancy_week: "Schwangerschaftswoche",
        milestones_trimester: "Meilensteine",
        trimester_checklist: "Checkliste",
        symptoms: "Symptome",
        days_since_birth: "Tage seit Geburt",
        weeks_postpartum: "Wochen Wochenbett",
        days_postpartum: "Tage Wochenbett",
        recovery_tracker: "Genesungs-Tracker",
        bleeding_monitor: "Blutungs-Monitor",
        postpartum_checklist: "Wochenbett-Checkliste",
        menopause_symptoms: "Menopause-Symptome",
        mood_tracker: "Stimmungs-Tracker",
        wellness_tips: "Wellness-Tipps",
        menopause_desc: "Menopause-Phase",
        log_used: "✓ Verbraucht",
        log_cup_emptied: "🔄 Geleert",
        select_product_first: "Bitte zuerst ein Produkt auswählen.",
        cup_empty_only: "Cup-Leerung ist nur für die Menstruationstasse verfügbar.",
        usage_logged_used: "Produktverbrauch gespeichert.",
        usage_logged_emptied: "Cup-Leerung gespeichert.",
        usage_logged_error: "Produktverbrauch konnte nicht gespeichert werden."
      },
      en: {
        pre_menarche: "Pre-Menarche",
        pre_menarche_desc: "Puberty - cycle not yet started",
        neutral_title: "No period",
        neutral_products_message: "No period - no products needed",
        pregnant: "Pregnant",
        postpartum: "Postpartum",
        menopause: "Menopause",
        preparation_tips: "Preparation Tips",
        learn_about_cycle: "Learn about your cycle",
        hygiene_products: "Hygiene products",
        talk_to_parent: "Talk to parents",
        use_app_tracking: "Use app to track",
        enable_reminder: "Enable notifications",
        week: "Week",
        trimester: "Trimester",
        due_date: "Due date",
        pregnancy_week: "Pregnancy week",
        milestones_trimester: "Milestones",
        trimester_checklist: "Checklist",
        symptoms: "Symptoms",
        days_since_birth: "Days since birth",
        weeks_postpartum: "Weeks postpartum",
        days_postpartum: "Days postpartum",
        recovery_tracker: "Recovery tracker",
        bleeding_monitor: "Bleeding monitor",
        postpartum_checklist: "Postpartum checklist",
        menopause_symptoms: "Menopause symptoms",
        mood_tracker: "Mood tracker",
        wellness_tips: "Wellness tips",
        menopause_desc: "Menopause phase",
        log_used: "✓ Used",
        log_cup_emptied: "🔄 Emptied",
        select_product_first: "Please select a product first.",
        cup_empty_only: "Cup emptying is only available for the menstrual cup.",
        usage_logged_used: "Product usage saved.",
        usage_logged_emptied: "Cup emptying saved.",
        usage_logged_error: "Could not save product usage."
      },
    };

    const lang = this._hass?.locale?.language || 'de';
    return translations[lang]?.[key] || translations['en'][key];
  }

  getStyles() {
    return `
      :host {
        display: block;
        --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
        --mg-border: var(--divider-color, rgba(127, 127, 127, 0.35));
        --mg-status-error: var(--error-color, #e74c3c);
        --mg-status-warning: var(--warning-color, #f39c12);
        --mg-status-success: var(--success-color, #27ae60);
        --mg-status-info: var(--state-icon-color, #2980b9);
        --mg-status-accent: var(--primary-color, #8e44ad);
      }

      ha-card {
        height: 100%;
        background: var(--mg-card-bg);
        border: 1px solid var(--mg-border);
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
        background: var(--mg-status-error);
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

      /* Neutral Message */
      .neutral-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 40px 20px;
        text-align: center;
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-success) 18%, transparent) 0%, color-mix(in srgb, var(--mg-status-success) 9%, transparent) 100%);
        border: 2px solid var(--mg-status-success);
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

      /* Pre-Menarche */
      .premenarche-container,
      .pregnancy-container,
      .postpartum-container,
      .menopause-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .premenarche-badge,
      .pregnancy-badge,
      .postpartum-badge,
      .menopause-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-accent) 20%, transparent) 0%, color-mix(in srgb, var(--mg-status-accent) 10%, transparent) 100%);
        border: 2px solid var(--mg-status-accent);
        border-radius: 12px;
      }

      .pregnancy-badge {
        border-color: var(--mg-status-info);
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-info) 20%, transparent) 0%, color-mix(in srgb, var(--mg-status-info) 10%, transparent) 100%);
      }

      .postpartum-badge {
        border-color: var(--mg-status-success);
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-success) 20%, transparent) 0%, color-mix(in srgb, var(--mg-status-success) 10%, transparent) 100%);
      }

      .menopause-badge {
        border-color: var(--mg-border);
        background: linear-gradient(135deg, color-mix(in srgb, var(--secondary-text-color, #34495e) 20%, transparent) 0%, color-mix(in srgb, var(--secondary-text-color, #34495e) 10%, transparent) 100%);
      }

      .badge-emoji {
        font-size: 2.5rem;
      }

      .badge-text h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .badge-text p {
        margin: 4px 0 0 0;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }

      /* Info Sections */
      .info-section,
      .milestone-section,
      .checklist-section,
      .symptom-tracker,
      .recovery-section,
      .bleeding-monitor,
      .postpartum-checklist,
      .mood-tracker,
      .wellness-tips {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .info-section h4,
      .milestone-section h4,
      .checklist-section h4,
      .symptom-tracker h4,
      .recovery-section h4,
      .bleeding-monitor h4,
      .postpartum-checklist h4,
      .mood-tracker h4,
      .wellness-tips h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      /* Grids */
      .tips-grid,
      .pregnancy-info-grid,
      .postpartum-info-grid,
      .symptom-grid,
      .mood-grid,
      .bleeding-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 8px;
      }

      .tip-card,
      .info-box,
      .symptom-btn,
      .mood-option,
      .bleeding-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px;
        background: var(--mg-card-bg);
        border: 1px solid var(--mg-border);
        border-radius: 8px;
        text-align: center;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tip-card:hover,
      .symptom-btn:hover,
      .mood-option:hover,
      .bleeding-option:hover {
        border-color: var(--mg-status-accent);
        background: color-mix(in srgb, var(--mg-status-accent) 10%, transparent);
      }

      .tip-emoji {
        font-size: 1.5rem;
      }

      .info-box {
        border: 2px solid var(--divider-color);
        padding: 16px;
      }

      .info-label {
        font-size: 0.75rem;
        color: var(--secondary-text-color);
        font-weight: 600;
        text-transform: uppercase;
      }

      .info-value {
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--primary-text-color);
      }

      /* Lists */
      .milestone-list,
      .recovery-items,
      .tips-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .milestone-item,
      .recovery-item,
      .wellness-tip {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--ha-card-background);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        font-size: 0.9rem;
      }

      .milestone-check,
      .recovery-check {
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--mg-status-success);
        min-width: 24px;
      }

      .recovery-item.completed {
        opacity: 0.6;
        text-decoration: line-through;
      }

      .week-label {
        margin-left: auto;
        font-size: 0.75rem;
        color: var(--secondary-text-color);
      }

      /* Checkboxes */
      .checklist,
      .checkbox-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .checkbox-item {
        flex-direction: row;
        align-items: center;
        padding: 8px;
        cursor: pointer;
      }

      .checkbox-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .checkbox-item span {
        font-size: 0.9rem;
        flex: 1;
      }

      /* Reminders */
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

      /* Product Selector & Timer */
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
        border: 2px solid var(--mg-border);
        border-radius: 8px;
        background: var(--mg-card-bg);
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
        border-color: var(--mg-status-error);
      }

      .product-select:focus {
        outline: none;
        border-color: var(--mg-status-error);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mg-status-error) 18%, transparent);
      }

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
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-error) 14%, transparent) 0%, color-mix(in srgb, var(--mg-status-error) 8%, transparent) 100%);
        border: 2px solid var(--mg-status-error);
        border-radius: 12px;
        transition: all 0.3s ease;
      }

      .timer-display.warning {
        border-color: var(--mg-status-warning);
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-warning) 14%, transparent) 0%, color-mix(in srgb, var(--mg-status-warning) 8%, transparent) 100%);
      }

      .timer-display.critical {
        border-color: var(--mg-status-error);
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-error) 24%, transparent) 0%, color-mix(in srgb, var(--mg-status-error) 14%, transparent) 100%);
        animation: pulse-border 1s infinite;
      }

      @keyframes pulse-border {
        0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mg-status-error) 34%, transparent); }
        50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--mg-status-error) 0%, transparent); }
      }

      .timer-display.timer-complete {
        animation: complete-pulse 0.5s ease-in-out 3;
        background: var(--mg-status-error);
      }

      .timer-display.logged-success {
        border-color: var(--mg-status-success);
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-success) 14%, transparent) 0%, color-mix(in srgb, var(--mg-status-success) 8%, transparent) 100%);
      }

      .timer-display.logged-error {
        border-color: var(--mg-status-error);
        background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-error) 14%, transparent) 0%, color-mix(in srgb, var(--mg-status-error) 8%, transparent) 100%);
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

      .usage-controls {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .usage-feedback {
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        text-align: center;
        border: 1px solid transparent;
      }

      .usage-feedback.success {
        color: var(--mg-status-success);
        background: color-mix(in srgb, var(--mg-status-success) 14%, transparent);
        border-color: color-mix(in srgb, var(--mg-status-success) 36%, transparent);
      }

      .usage-feedback.error {
        color: var(--mg-status-error);
        background: color-mix(in srgb, var(--mg-status-error) 14%, transparent);
        border-color: color-mix(in srgb, var(--mg-status-error) 36%, transparent);
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
        background: var(--mg-status-success);
      }

      .btn-start:hover:not(:disabled) {
        background: color-mix(in srgb, var(--mg-status-success) 85%, #000);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px color-mix(in srgb, var(--mg-status-success) 30%, transparent);
      }

      .btn-pause {
        background: var(--mg-status-warning);
      }

      .btn-pause:hover:not(:disabled) {
        background: color-mix(in srgb, var(--mg-status-warning) 85%, #000);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px color-mix(in srgb, var(--mg-status-warning) 30%, transparent);
      }

      .btn-reset {
        background: #95a5a6;
      }

      .btn-usage {
        background: var(--mg-status-info);
      }

      .btn-usage:hover:not(:disabled) {
        background: color-mix(in srgb, var(--mg-status-info) 85%, #000);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px color-mix(in srgb, var(--mg-status-info) 30%, transparent);
      }

      .btn-cup {
        background: var(--mg-status-accent);
      }

      .btn-cup:hover:not(:disabled) {
        background: color-mix(in srgb, var(--mg-status-accent) 85%, #000);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px color-mix(in srgb, var(--mg-status-accent) 30%, transparent);
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

      @media (prefers-color-scheme: dark) {
        .timer-display { background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-error) 24%, transparent) 0%, color-mix(in srgb, var(--mg-status-error) 12%, transparent) 100%); }
        .timer-display.warning { background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-warning) 24%, transparent) 0%, color-mix(in srgb, var(--mg-status-warning) 12%, transparent) 100%); }
        .timer-display.critical { background: linear-gradient(135deg, color-mix(in srgb, var(--mg-status-error) 34%, transparent) 0%, color-mix(in srgb, var(--mg-status-error) 18%, transparent) 100%); }
      }

      @media (max-width: 600px) {
        .timer-display { flex-direction: column; gap: 12px; padding: 16px; }
        .timer-time { font-size: 2rem; }
        .timer-icon { font-size: 2.5rem; }
        .btn { padding: 8px 12px; font-size: 0.8rem; }
        
        .tips-grid,
        .pregnancy-info-grid,
        .postpartum-info-grid,
        .symptom-grid,
        .mood-grid,
        .bleeding-grid {
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        }
        
        .badge-emoji {
          font-size: 2rem;
        }
        
        .badge-text h3 {
          font-size: 1rem;
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

window.customCards = window.customCards || [];
window.customCards.push({
  type: "period-countdown-timer",
  name: "Period Countdown Timer",
  description: "Countdown timer with direct product-usage logging for period products.",
});